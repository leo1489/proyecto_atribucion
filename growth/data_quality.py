"""Controles de calidad y gobierno sobre las fuentes integradas."""
from __future__ import annotations

import pandas as pd

from .generate_data import HUBSPOT_SOURCE


def run_checks(raw: dict[str, pd.DataFrame], first_channel: pd.Series) -> pd.DataFrame:
    """Cada control devuelve filas que fallan; el resultado es un tablero de estado."""
    s, c = raw["ga4_sessions"], raw["app_customers"]
    h, t, sp = raw["hubspot_contacts"], raw["core_transactions"], raw["ad_spend"]

    hub = h.drop_duplicates("user_id").set_index("user_id")["hs_analytics_source"]
    expected = first_channel.reindex(hub.index).map(HUBSPOT_SOURCE)

    checks = [
        ("ga4_sessions", "session_id duplicado", s["session_id"].duplicated().sum(), len(s)),
        ("ga4_sessions", "Canal sin clasificar", s["channel_group"].isna().sum(), len(s)),
        ("app_customers", "Registro sin sesión en GA4",
         (~c["user_id"].isin(s["user_id"])).sum(), len(c)),
        ("app_customers", "Orden de etapas (registro ≤ KYC ≤ aprobación ≤ depósito)",
         ((c["kyc_completed_at"] < c["signup_at"]) | (c["approved_at"] < c["kyc_completed_at"])
          | (c["first_deposit_at"] < c["approved_at"])).sum(), len(c)),
        ("hubspot_contacts", "user_id duplicado en CRM", h["user_id"].duplicated().sum(), len(h)),
        ("hubspot_contacts", "Fuente original vacía", h["hs_analytics_source"].isna().sum(), len(h)),
        ("hubspot_contacts", "Fuente HubSpot distinta al primer canal GA4",
         (hub.notna() & (hub != expected)).sum(), len(hub)),
        ("core_transactions", "Transacción de cliente no activado",
         (~t["customer_id"].isin(c.loc[c["first_deposit_at"].notna(), "user_id"])).sum(), len(t)),
        ("core_transactions", "Monto no positivo", (t["amount_cop"] <= 0).sum(), len(t)),
        ("ad_spend", "Inversión negativa", (sp["spend_cop"] < 0).sum(), len(sp)),
    ]
    out = pd.DataFrame(checks, columns=["tabla", "control", "filas_con_falla", "filas_evaluadas"])
    out["pct_falla"] = out["filas_con_falla"] / out["filas_evaluadas"]
    out["estado"] = pd.cut(out["pct_falla"], [-1, 0, 0.01, 1], labels=["OK", "Alerta", "Falla"]).astype(str)
    return out
