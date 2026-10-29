"""Resumen de KPIs en Markdown, generado a partir de los marts."""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from . import config
from .attribution import ALL_MODELS
from .funnel import funnel_summary
from .segmentation import SEGMENT_ORDER


def _cop(x: float) -> str:
    return "—" if pd.isna(x) else f"${x:,.0f}".replace(",", ".")


def _pct(x: float) -> str:
    return "—" if pd.isna(x) else f"{x:.1%}"


def _num(x: float) -> str:
    return "—" if pd.isna(x) else f"{x:,.0f}".replace(",", ".")


def _table(df: pd.DataFrame) -> str:
    header = "| " + " | ".join(map(str, df.columns)) + " |"
    sep = "|" + "|".join(["---"] * len(df.columns)) + "|"
    rows = ["| " + " | ".join(map(str, r)) + " |" for r in df.itertuples(index=False)]
    return "\n".join([header, sep, *rows])


def write_summary(marts: dict[str, pd.DataFrame], path: Path) -> None:
    channel = marts["resumen_canal"]
    clients = marts["dim_cliente"]
    funnel_days = marts["fact_embudo_diario"]
    spend = marts["fact_inversion_diaria"]["inversion_cop"].sum()
    activated = clients["fecha_activacion"].notna().sum()
    stages = funnel_days[["visitantes", "registros", "kyc_completo", "aprobados", "activados"]].sum()

    kpis = pd.DataFrame([
        ("Visitantes únicos", _num(stages["visitantes"])),
        ("Registros", _num(stages["registros"])),
        ("Clientes activados (primer depósito)", _num(activated)),
        ("Conversión visita → activación", _pct(stages["activados"] / stages["visitantes"])),
        ("Inversión total de marketing", _cop(spend)),
        ("CAC promedio (inversión / activados)", _cop(spend / activated)),
        ("Churn actual (sin transacciones > 60 días)", _pct(clients["churn"].mean())),
        ("Ingreso promedio primeros 12 meses", _cop(clients["ingreso_12m_cop"].mean())),
    ], columns=["KPI", "Valor"])

    funnel_rows = funnel_days.rename(columns={"canal": "first_channel"})
    summary = funnel_rows.groupby("first_channel")[["visitantes", "registros", "kyc_completo",
                                                    "aprobados", "activados"]].sum()
    summary["tasa_registro"] = summary["registros"] / summary["visitantes"]
    summary["tasa_kyc"] = summary["kyc_completo"] / summary["registros"]
    summary["tasa_deposito"] = summary["activados"] / summary["aprobados"]
    summary["conversion_total"] = summary["activados"] / summary["visitantes"]
    funnel_tbl = summary.sort_values("activados", ascending=False).reset_index()
    funnel_tbl = pd.DataFrame({
        "Canal (1er toque)": funnel_tbl["first_channel"],
        "Visitantes": funnel_tbl["visitantes"].map(_num),
        "Registro": funnel_tbl["tasa_registro"].map(_pct),
        "KYC": funnel_tbl["tasa_kyc"].map(_pct),
        "Depósito": funnel_tbl["tasa_deposito"].map(_pct),
        "Visita→activación": funnel_tbl["conversion_total"].map(_pct),
    })

    attr_tbl = channel[["canal"] + [f"act_{m}" for m in ALL_MODELS]].copy()
    attr_tbl.columns = ["Canal"] + ALL_MODELS
    for m in ALL_MODELS:
        attr_tbl[m] = attr_tbl[m].map(_num)

    audit = pd.DataFrame({
        "Canal": channel["canal"],
        "Inversión": channel["inversion_cop"].map(_cop),
        "CAC último clic": channel["cac_ultimo_clic"].map(_cop),
        "CAC Markov": channel["cac_markov"].map(_cop),
        "Retención M3": channel["retencion_m3"].map(_pct),
        "Churn": channel["churn_actual"].map(_pct),
        "Ingreso 12m": channel["ingreso_12m_promedio_cop"].map(_cop),
        "LTV12m / CAC": channel["ltv12m_cac_markov"].map(lambda x: "—" if pd.isna(x) or x == float("inf") else f"{x:.2f}x"),
    })

    seg = (clients["segmento_rfm"].value_counts().reindex(SEGMENT_ORDER).fillna(0)
           .rename_axis("Segmento").reset_index(name="Clientes"))
    seg["% clientes"] = (seg["Clientes"] / seg["Clientes"].sum()).map(_pct)
    seg["Clientes"] = seg["Clientes"].map(_num)

    aud = (marts["fact_audiencias"].groupby(["audiencia", "destino"]).size()
           .rename("Tamaño").reset_index().rename(columns={"audiencia": "Audiencia", "destino": "Destino"}))

    ab = marts["ab_resultados"]
    ab_tbl = pd.DataFrame({
        "Test": ab["nombre"], "Métrica": ab["metrica"], "n (A/B)": ab["n_a"].astype(str) + " / " + ab["n_b"].astype(str),
        "Tasa A": ab["tasa_a"].map(_pct), "Tasa B": ab["tasa_b"].map(_pct),
        "Lift": ab["lift_relativo"].map(_pct), "p-valor": ab["p_valor"].map(lambda x: f"{x:.3f}"),
        "MDE": ab["mde_abs"].map(lambda x: f"{x * 100:.1f} pp"), "SRM p": ab["srm_p_valor"].map(lambda x: f"{x:.2f}"),
        "Decisión": ab["decision"],
    })

    dq = marts["calidad_datos"][["tabla", "control", "filas_con_falla", "pct_falla", "estado"]].copy()
    dq["pct_falla"] = dq["pct_falla"].map(lambda x: f"{x:.2%}")

    cohorts = marts["fact_retencion_cohortes"]
    ret = (cohorts[cohorts["mes_desde_activacion"].isin([1, 3, 6])]
           .groupby("mes_desde_activacion")[["clientes_activos", "tamano_cohorte"]].sum())
    ret_line = " · ".join(f"M{int(k)}: {_pct(r.clientes_activos / r.tamano_cohorte)}"
                          for k, r in ret.iterrows())

    md = f"""# Resumen de KPIs — FinDemo (datos sintéticos)

Generado por `python -m growth.pipeline`. Fecha de corte: {config.SNAPSHOT_DATE.date()}.
Las cifras cambian si se modifican los parámetros de `growth/config.py` o `growth/generate_data.py`.

## KPIs globales

{_table(kpis)}

Retención promedio de cohortes (clientes con al menos una transacción en el mes): {ret_line}

## Embudo por canal de primer toque

{_table(funnel_tbl)}

## Activaciones atribuidas por modelo

Ventana de lookback: {config.LOOKBACK_DAYS} días. Cada modelo reparte el mismo total de activaciones.

{_table(attr_tbl)}

## Auditoría de canales

CAC = inversión del canal / activaciones atribuidas. LTV12m = ingreso (comisiones + margen) de los primeros 12 meses (cohortes con 12 meses observados), por canal de primer toque.

{_table(audit)}

## Segmentos RFM

{_table(seg)}

## Audiencias dinámicas

{_table(aud)}

## Experimentos

{_table(ab_tbl)}

## Calidad de datos

{_table(dq)}
"""
    path.write_text(md, encoding="utf-8")
