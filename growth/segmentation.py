"""Segmentación RFM y audiencias dinámicas para pauta y CRM.

Las audiencias son reglas evaluadas en una fecha de corte: al volver a correr
el pipeline con otro corte, los clientes entran y salen solos de cada lista.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from . import config

SEGMENT_ORDER = ["Campeones", "Leales", "Potenciales", "Necesitan atención",
                 "En riesgo", "Hibernando", "Perdidos"]


def _score(values: pd.Series, ascending: bool = True) -> pd.Series:
    ranks = values.rank(method="first", ascending=ascending)
    return pd.qcut(ranks, 5, labels=[1, 2, 3, 4, 5]).astype(int)


def rfm(transactions: pd.DataFrame, customer_ids: pd.Series,
        snapshot: pd.Timestamp = config.SNAPSHOT_DATE,
        window_days: int = config.RFM_WINDOW_DAYS) -> pd.DataFrame:
    tx = transactions[transactions["transaction_at"] <= snapshot + pd.Timedelta(days=1)]
    recent = tx[tx["transaction_at"] > snapshot - pd.Timedelta(days=window_days)]
    out = pd.DataFrame(index=pd.Index(customer_ids, name="customer_id"))
    out["recencia_dias"] = (snapshot - tx.groupby("customer_id")["transaction_at"].max()).dt.days
    out["frecuencia"] = recent.groupby("customer_id").size()
    out["monto_cop"] = recent.groupby("customer_id")["amount_cop"].sum()
    out = out.fillna({"frecuencia": 0, "monto_cop": 0})

    out["r"] = _score(out["recencia_dias"], ascending=False)
    out["f"] = _score(out["frecuencia"])
    out["m"] = _score(out["monto_cop"])
    fm = (out["f"] + out["m"]) / 2
    out["segmento_rfm"] = np.select(
        [out["recencia_dias"] > window_days,
         (out["r"] >= 4) & (fm >= 4.5),
         (out["r"] >= 3) & (fm >= 3.5),
         (out["r"] >= 4),
         (out["r"] == 3),
         fm >= 3],
        ["Perdidos", "Campeones", "Leales", "Potenciales", "Necesitan atención", "En riesgo"],
        default="Hibernando",
    )
    return out.reset_index()


def audiences(rfm_table: pd.DataFrame, customers: pd.DataFrame, transactions: pd.DataFrame,
              snapshot: pd.Timestamp = config.SNAPSHOT_DATE) -> pd.DataFrame:
    """Listas accionables: cada fila es (cliente, audiencia, destino, objetivo)."""
    seg = rfm_table.set_index("customer_id")
    recent_cut = snapshot - pd.Timedelta(days=config.RFM_WINDOW_DAYS)
    card_users = set(transactions.loc[
        (transactions["transaction_type"] == "Compra tarjeta")
        & (transactions["transaction_at"] > recent_cut), "customer_id"])
    recent_signups = customers[customers["signup_at"] > recent_cut]

    rules = [
        ("Reactivación alto valor", "Meta Ads + HubSpot", "Recuperar clientes valiosos que se están enfriando",
         seg.index[(seg["segmento_rfm"] == "En riesgo") & (seg["m"] >= 4)]),
        ("Semilla lookalike", "Meta Ads / Google Customer Match", "Encontrar prospectos parecidos a los mejores clientes",
         seg.index[seg["segmento_rfm"] == "Campeones"]),
        ("Cross-sell tarjeta débito", "HubSpot", "Activar compras con tarjeta en clientes leales",
         seg.index[seg["segmento_rfm"].isin(["Campeones", "Leales"]) & ~seg.index.isin(card_users)]),
        ("Recuperar KYC incompleto", "HubSpot + retargeting Meta", "Terminar la verificación de identidad",
         pd.Index(recent_signups.loc[recent_signups["kyc_completed_at"].isna(), "user_id"])),
        ("Impulsar primer depósito", "HubSpot + Google Ads", "Convertir cuentas aprobadas sin fondear",
         pd.Index(recent_signups.loc[recent_signups["approved_at"].notna()
                                     & recent_signups["first_deposit_at"].isna(), "user_id"])),
        ("Exclusión de adquisición", "Google Ads / Meta Ads / TikTok Ads", "No pagar por adquirir a quien ya es cliente activo",
         seg.index[~seg["segmento_rfm"].isin(["Perdidos", "Hibernando"])]),
    ]
    frames = [pd.DataFrame({"customer_id": ids, "audiencia": name, "destino": dest, "objetivo": goal})
              for name, dest, goal, ids in rules]
    out = pd.concat(frames, ignore_index=True)
    out["fecha_corte"] = snapshot.date()
    return out
