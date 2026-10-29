"""Pipeline completo: fuentes crudas → análisis → marts para Power BI → resumen.

Uso:  python -m growth.pipeline
"""
from __future__ import annotations

import time

import numpy as np
import pandas as pd

from . import ab_testing, attribution, config, data_quality, funnel, report, retention, segmentation
from .generate_data import CHANNELS, PLATFORM, generate

CHANNEL_TYPE = {
    "Paid Search": "Pagado", "Paid Social": "Pagado", "TikTok Ads": "Pagado", "Afiliados": "Pagado",
    "Email": "Propio", "Orgánico": "Ganado", "Directo": "Ganado", "Referidos": "Propio",
}


def main() -> None:
    t0 = time.time()
    config.RAW_DIR.mkdir(parents=True, exist_ok=True)
    config.MARTS_DIR.mkdir(parents=True, exist_ok=True)
    config.REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    raw = generate()
    raw["app_customers"] = raw["app_customers"].drop(columns="first_channel")
    for name, df in raw.items():
        df.to_csv(config.RAW_DIR / f"{name}.csv", index=False, encoding="utf-8")
    print(f"[{time.time() - t0:5.1f}s] fuentes crudas generadas")

    marts = build_marts(raw)
    for name, df in marts.items():
        df.to_csv(config.MARTS_DIR / f"{name}.csv", index=False, encoding="utf-8")
    print(f"[{time.time() - t0:5.1f}s] {len(marts)} marts escritos en {config.MARTS_DIR}")

    report.write_summary(marts, config.REPORTS_DIR / "resumen_kpis.md")
    print(f"[{time.time() - t0:5.1f}s] resumen en {config.REPORTS_DIR / 'resumen_kpis.md'}")


def build_marts(raw: dict[str, pd.DataFrame]) -> dict[str, pd.DataFrame]:
    sessions = raw["ga4_sessions"].rename(columns={"channel_group": "channel"})
    transactions, balances = raw["core_transactions"], raw["core_balances"]

    users = funnel.user_funnel(sessions, raw["app_customers"])
    customers = raw["app_customers"].merge(users[["user_id", "first_channel", "last_channel", "n_touches"]],
                                           on="user_id")
    activated_ids = customers.loc[customers["first_deposit_at"].notna(), "user_id"]

    touches = attribution.prepare_touches(
        sessions, customers.rename(columns={"first_deposit_at": "converted_at"}), config.LOOKBACK_DAYS)
    attr = attribution.attribution_by_period(touches, CHANNELS)

    cm = retention.customer_month(transactions, balances)
    cohorts = retention.cohort_retention(cm, customers)
    churn = retention.churn_status(customers, transactions)
    value_ltv = retention.value_by_horizon(cm, customers, months=config.LTV_MONTHS)
    rfm_table = segmentation.rfm(transactions, activated_ids)
    audiences = segmentation.audiences(rfm_table, customers, transactions)
    ab_results = ab_testing.evaluate_tests(raw["ab_assignments"], customers, cm)
    quality = data_quality.run_checks(raw, users.set_index("user_id")["first_channel"])

    marts = {
        "dim_fecha": _dim_date(),
        "dim_canal": pd.DataFrame({
            "canal": CHANNELS,
            "tipo_canal": [CHANNEL_TYPE[c] for c in CHANNELS],
            "plataforma": [PLATFORM.get(c, "—") for c in CHANNELS],
            "orden": range(1, len(CHANNELS) + 1),
        }),
        "dim_cliente": _dim_customer(customers, churn, rfm_table, value_ltv, raw["ab_assignments"]),
        "fact_sesiones_diarias": _sessions_daily(sessions),
        "fact_embudo_diario": funnel.funnel_daily(users),
        "fact_inversion_diaria": raw["ad_spend"].rename(columns={
            "date": "fecha", "channel": "canal", "platform": "plataforma", "spend_cop": "inversion_cop"}),
        "fact_atribucion": attr.rename(columns={
            "period": "trimestre", "model": "modelo", "channel": "canal",
            "conversions": "activaciones_atribuidas"}),
        "fact_cliente_mes": cm.rename(columns={"customer_id": "user_id", "month": "mes",
                                               "avg_balance_cop": "saldo_promedio_cop"}),
        "fact_retencion_cohortes": cohorts,
        "fact_audiencias": audiences.rename(columns={"customer_id": "user_id"}),
        "ab_resultados": ab_results,
        "calidad_datos": quality,
    }
    marts["resumen_canal"] = _channel_summary(marts, users)
    return marts


def _dim_date() -> pd.DataFrame:
    dates = pd.date_range(config.START_DATE, config.SNAPSHOT_DATE, freq="D")
    months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
    return pd.DataFrame({
        "fecha": dates,
        "anio": dates.year,
        "mes": dates.month,
        "nombre_mes": [months[m - 1] for m in dates.month],
        "anio_mes": dates.strftime("%Y-%m"),
        "trimestre": dates.to_period("Q").astype(str),
        "dia_semana": dates.dayofweek + 1,
        "es_fin_de_semana": dates.dayofweek >= 5,
    })


def _dim_customer(customers, churn, rfm_table, value_ltv, ab) -> pd.DataFrame:
    out = customers.rename(columns={
        "first_channel": "canal_primer_toque", "last_channel": "canal_ultimo_toque", "n_touches": "n_toques",
        "device": "dispositivo", "city": "ciudad", "age_band": "rango_edad", "signup_at": "fecha_registro",
        "kyc_completed_at": "fecha_kyc", "approved_at": "fecha_aprobacion", "first_deposit_at": "fecha_activacion",
    })
    out["etapa_maxima"] = np.select(
        [out["fecha_activacion"].notna(), out["fecha_aprobacion"].notna(), out["fecha_kyc"].notna()],
        ["Primer depósito", "Cuenta aprobada", "KYC completo"], default="Registro")
    out["cohorte_activacion"] = out["fecha_activacion"].dt.to_period("M").dt.to_timestamp()
    out = (out.merge(churn, on="user_id", how="left")
           .merge(rfm_table.rename(columns={"customer_id": "user_id", "monto_cop": "monto_180d_cop",
                                            "frecuencia": "frecuencia_180d"}), on="user_id", how="left")
           .merge(value_ltv.rename_axis("user_id").reset_index(), on="user_id", how="left"))
    variants = ab.pivot_table(index="user_id", columns="test_id", values="variant", aggfunc="first")
    variants.columns = [f"variante_{c.split('_')[0].lower()}" for c in variants.columns]
    return out.merge(variants, left_on="user_id", right_index=True, how="left")


def _sessions_daily(sessions: pd.DataFrame) -> pd.DataFrame:
    keys = [sessions["session_start"].dt.normalize().rename("fecha"), "channel", "source", "medium",
            "campaign", "device"]
    out = sessions.groupby(keys).agg(
        sesiones=("session_id", "size"),
        sesiones_comprometidas=("engaged_session", "sum"),
        usuarios=("user_id", "nunique"),
    ).reset_index()
    return out.rename(columns={"channel": "canal", "source": "fuente", "medium": "medio",
                               "campaign": "campana", "device": "dispositivo"})


def _channel_summary(marts: dict[str, pd.DataFrame], users: pd.DataFrame) -> pd.DataFrame:
    """Tabla de auditoría de canales: inversión, CAC por modelo, calidad y valor."""
    attr = (marts["fact_atribucion"].groupby(["canal", "modelo"])["activaciones_atribuidas"].sum()
            .unstack().reindex(columns=attribution.ALL_MODELS))
    spend = marts["fact_inversion_diaria"].groupby("canal")["inversion_cop"].sum()
    clients = marts["dim_cliente"][marts["dim_cliente"]["fecha_activacion"].notna()]
    by_first = clients.groupby("canal_primer_toque")
    cohort_m3 = marts["fact_retencion_cohortes"]
    m3 = cohort_m3[cohort_m3["mes_desde_activacion"] == 3].groupby("canal")[["clientes_activos", "tamano_cohorte"]].sum()

    out = pd.DataFrame(index=pd.Index(CHANNELS, name="canal"))
    out["inversion_cop"] = spend
    out["visitantes_primer_toque"] = users.groupby("first_channel").size()
    out["activados_primer_toque"] = by_first.size()
    for model in attribution.ALL_MODELS:
        out[f"act_{model}"] = attr[model]
    out["cac_ultimo_clic"] = out["inversion_cop"] / out["act_Último clic"]
    out["cac_markov"] = out["inversion_cop"] / out["act_Markov"]
    out["retencion_m3"] = m3["clientes_activos"] / m3["tamano_cohorte"]
    out["churn_actual"] = by_first["churn"].mean()
    out["ingreso_12m_promedio_cop"] = by_first["ingreso_12m_cop"].mean()
    out["ltv12m_cac_markov"] = out["ingreso_12m_promedio_cop"] / out["cac_markov"]
    return out.fillna({"inversion_cop": 0}).reset_index()


if __name__ == "__main__":
    main()
