"""Parámetros globales del proyecto."""
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
MARTS_DIR = ROOT / "data" / "marts"
REPORTS_DIR = ROOT / "reports"

SEED = 42
N_USERS = 60_000

START_DATE = pd.Timestamp("2025-01-01")
ACQ_END = pd.Timestamp("2026-06-30")  # último día en que llegan visitantes nuevos
SNAPSHOT_DATE = pd.Timestamp("2026-09-30")  # fecha de corte del análisis

LOOKBACK_DAYS = 45  # ventana de atribución antes de la conversión
INACTIVITY_DAYS = 60  # días sin transacciones para considerar churn
RFM_WINDOW_DAYS = 180
LTV_MONTHS = 12  # horizonte para el ingreso por cliente (LTV observado)
NIM_MONTHLY = 0.008  # margen financiero mensual sobre saldo promedio

AB_TESTS = {
    "AB01_onboarding_kyc": {
        "nombre": "Onboarding KYC simplificado",
        "inicio": pd.Timestamp("2026-01-15"),
        "fin": pd.Timestamp("2026-04-15"),
        "metrica": "Tasa de KYC completo",
    },
    "AB02_email_bienvenida": {
        "nombre": "Email de bienvenida personalizado",
        "inicio": pd.Timestamp("2026-04-01"),
        "fin": pd.Timestamp("2026-05-31"),
        "metrica": "Activo en el mes 2",
    },
}
