"""Evaluación de experimentos A/B con métricas de proporción."""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats

from . import config


def two_proportion_test(conv_a: int, n_a: int, conv_b: int, n_b: int, alpha: float = 0.05) -> dict:
    """Prueba z de dos proporciones (bilateral) con IC de la diferencia."""
    p_a, p_b = conv_a / n_a, conv_b / n_b
    pooled = (conv_a + conv_b) / (n_a + n_b)
    se_pooled = np.sqrt(pooled * (1 - pooled) * (1 / n_a + 1 / n_b))
    z = (p_b - p_a) / se_pooled
    p_value = 2 * (1 - stats.norm.cdf(abs(z)))
    se_diff = np.sqrt(p_a * (1 - p_a) / n_a + p_b * (1 - p_b) / n_b)
    z_crit = stats.norm.ppf(1 - alpha / 2)
    diff = p_b - p_a
    return {
        "tasa_a": p_a, "tasa_b": p_b, "diferencia_abs": diff, "lift_relativo": diff / p_a,
        "ic_inf": diff - z_crit * se_diff, "ic_sup": diff + z_crit * se_diff,
        "z": z, "p_valor": p_value, "significativo": p_value < alpha,
    }


def srm_p_value(n_a: int, n_b: int) -> float:
    """Sample Ratio Mismatch: chi-cuadrado contra una asignación 50/50."""
    return stats.chisquare([n_a, n_b]).pvalue


def minimum_detectable_effect(n_per_group: float, p_base: float,
                              alpha: float = 0.05, power: float = 0.8) -> float:
    """Diferencia absoluta mínima detectable con el tamaño de muestra dado."""
    z = stats.norm.ppf(1 - alpha / 2) + stats.norm.ppf(power)
    return z * np.sqrt(2 * p_base * (1 - p_base) / n_per_group)


def evaluate_tests(assignments: pd.DataFrame, customers: pd.DataFrame, cm: pd.DataFrame) -> pd.DataFrame:
    # Métrica de cada test: 1 si el usuario cumplió el objetivo.
    kyc = customers.set_index("user_id")["kyc_completed_at"].notna()
    act = customers.set_index("user_id")["first_deposit_at"].dropna()
    month2 = act.dt.to_period("M").dt.to_timestamp() + pd.DateOffset(months=2)
    active_m2 = cm.loc[cm["activo"] == 1, ["customer_id", "month"]]
    active_m2 = active_m2.merge(month2.rename("month").reset_index(), left_on=["customer_id", "month"],
                                right_on=["user_id", "month"])["customer_id"]
    successes = {
        "AB01_onboarding_kyc": set(kyc.index[kyc]),
        "AB02_email_bienvenida": set(active_m2),
    }

    rows = []
    for test_id, group in assignments.groupby("test_id"):
        meta = config.AB_TESTS[test_id]
        success = group["user_id"].isin(successes[test_id])
        counts = group.assign(ok=success).groupby("variant")["ok"].agg(["sum", "size"])
        (conv_a, n_a), (conv_b, n_b) = counts.loc["A"], counts.loc["B"]
        res = two_proportion_test(int(conv_a), int(n_a), int(conv_b), int(n_b))
        res.update({
            "test_id": test_id, "nombre": meta["nombre"], "metrica": meta["metrica"],
            "inicio": meta["inicio"].date(), "fin": meta["fin"].date(),
            "n_a": int(n_a), "n_b": int(n_b), "conv_a": int(conv_a), "conv_b": int(conv_b),
            "srm_p_valor": srm_p_value(int(n_a), int(n_b)),
            "mde_abs": minimum_detectable_effect((n_a + n_b) / 2, res["tasa_a"]),
        })
        # Significativo pero con efecto menor al MDE: el test tenía poca potencia y
        # el efecto observado probablemente está inflado (winner's curse).
        res["decision"] = (
            "Implementar B" if res["significativo"] and res["diferencia_abs"] >= res["mde_abs"]
            else "Implementar B con holdout" if res["significativo"] and res["diferencia_abs"] > 0
            else "Mantener A" if res["significativo"]
            else "Sin evidencia: ampliar muestra" if abs(res["diferencia_abs"]) < res["mde_abs"]
            else "No concluyente"
        )
        rows.append(res)
    cols = ["test_id", "nombre", "metrica", "inicio", "fin", "n_a", "n_b", "conv_a", "conv_b",
            "tasa_a", "tasa_b", "diferencia_abs", "lift_relativo", "ic_inf", "ic_sup", "z",
            "p_valor", "significativo", "srm_p_valor", "mde_abs", "decision"]
    return pd.DataFrame(rows)[cols]
