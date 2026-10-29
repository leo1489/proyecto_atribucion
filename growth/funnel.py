"""Embudo de adquisición: visita → registro → KYC → aprobación → primer depósito."""
from __future__ import annotations

import pandas as pd

STAGES = {
    "visitantes": "Visita",
    "registros": "Registro",
    "kyc_completo": "KYC completo",
    "aprobados": "Cuenta aprobada",
    "activados": "Primer depósito",
}


def user_funnel(sessions: pd.DataFrame, customers: pd.DataFrame) -> pd.DataFrame:
    """Una fila por visitante con su primer/último canal y hasta dónde llegó."""
    ordered = sessions.sort_values("session_start").groupby("user_id")
    users = pd.DataFrame({
        "first_touch_at": ordered["session_start"].first(),
        "first_channel": ordered["channel"].first(),
        "last_channel": ordered["channel"].last(),
        "n_touches": ordered.size(),
        "device": ordered["device"].first(),
        "city": ordered["city"].first(),
    }).reset_index()
    cols = ["user_id", "signup_at", "kyc_completed_at", "approved_at", "first_deposit_at"]
    users = users.merge(customers[cols], on="user_id", how="left")
    users["visitantes"] = 1
    users["registros"] = users["signup_at"].notna().astype(int)
    users["kyc_completo"] = users["kyc_completed_at"].notna().astype(int)
    users["aprobados"] = users["approved_at"].notna().astype(int)
    users["activados"] = users["first_deposit_at"].notna().astype(int)
    users["dias_a_activacion"] = (users["first_deposit_at"] - users["first_touch_at"]).dt.total_seconds() / 86_400
    return users


def funnel_daily(users: pd.DataFrame) -> pd.DataFrame:
    """Conteos por etapa según fecha y canal del primer toque (cohorte de visita)."""
    keys = [users["first_touch_at"].dt.normalize().rename("fecha"),
            users["first_channel"].rename("canal"), users["device"].rename("dispositivo"),
            users["city"].rename("ciudad")]
    return users.groupby(keys)[list(STAGES)].sum().reset_index()


def funnel_summary(users: pd.DataFrame, by: str = "first_channel") -> pd.DataFrame:
    """Tasas de paso entre etapas por dimensión."""
    g = users.groupby(by)
    out = g[list(STAGES)].sum()
    out["tasa_registro"] = out["registros"] / out["visitantes"]
    out["tasa_kyc"] = out["kyc_completo"] / out["registros"]
    out["tasa_aprobacion"] = out["aprobados"] / out["kyc_completo"]
    out["tasa_deposito"] = out["activados"] / out["aprobados"]
    out["conversion_total"] = out["activados"] / out["visitantes"]
    out["mediana_dias_activacion"] = g["dias_a_activacion"].median()
    return out.sort_values("activados", ascending=False)
