"""Retención por cohortes, churn por inactividad y valor del cliente."""
from __future__ import annotations

import pandas as pd

from . import config


def customer_month(transactions: pd.DataFrame, balances: pd.DataFrame) -> pd.DataFrame:
    """Actividad mensual por cliente: transacciones, montos e ingresos."""
    tx = transactions.assign(month=transactions["transaction_at"].dt.to_period("M").dt.to_timestamp())
    monthly = tx.groupby(["customer_id", "month"]).agg(
        transacciones=("transaction_id", "size"),
        monto_cop=("amount_cop", "sum"),
        ingreso_comisiones_cop=("fee_revenue_cop", "sum"),
    ).reset_index()
    bal = balances.assign(month=pd.to_datetime(balances["month"]))
    out = bal.merge(monthly, on=["customer_id", "month"], how="outer")
    out[["transacciones", "monto_cop", "ingreso_comisiones_cop"]] = (
        out[["transacciones", "monto_cop", "ingreso_comisiones_cop"]].fillna(0))
    out["transacciones"] = out["transacciones"].astype(int)
    out["avg_balance_cop"] = out["avg_balance_cop"].fillna(0)
    out["ingreso_margen_cop"] = (out["avg_balance_cop"] * config.NIM_MONTHLY).round(0)
    out["ingreso_total_cop"] = out["ingreso_comisiones_cop"] + out["ingreso_margen_cop"]
    out["activo"] = (out["transacciones"] > 0).astype(int)
    return out.sort_values(["customer_id", "month"]).reset_index(drop=True)


def _months_between(later: pd.Series, earlier: pd.Series) -> pd.Series:
    return (later.dt.year - earlier.dt.year) * 12 + (later.dt.month - earlier.dt.month)


def cohort_retention(cm: pd.DataFrame, customers: pd.DataFrame) -> pd.DataFrame:
    """% de clientes activos en cada mes desde la activación, por cohorte y canal."""
    base = customers.loc[customers["first_deposit_at"].notna(), ["user_id", "first_deposit_at", "first_channel"]]
    base = base.assign(cohorte=base["first_deposit_at"].dt.to_period("M").dt.to_timestamp())
    sizes = base.groupby(["cohorte", "first_channel"]).size().rename("tamano_cohorte")

    act = cm[cm["activo"] == 1].merge(base, left_on="customer_id", right_on="user_id")
    act["mes_desde_activacion"] = _months_between(act["month"], act["cohorte"])
    active = act.groupby(["cohorte", "first_channel", "mes_desde_activacion"]).size().rename("clientes_activos")

    # Grilla completa: los meses observados sin clientes activos cuentan como 0.
    snapshot_month = config.SNAPSHOT_DATE.to_period("M").to_timestamp()
    grid = sizes.reset_index()
    grid["meses_observados"] = _months_between(pd.Series(snapshot_month, index=grid.index), grid["cohorte"])
    grid = grid.loc[grid.index.repeat(grid["meses_observados"] + 1)]
    grid["mes_desde_activacion"] = grid.groupby(["cohorte", "first_channel"]).cumcount()
    out = grid.drop(columns="meses_observados").merge(
        active.reset_index(), on=["cohorte", "first_channel", "mes_desde_activacion"], how="left")
    out["clientes_activos"] = out["clientes_activos"].fillna(0).astype(int)
    out["retencion"] = out["clientes_activos"] / out["tamano_cohorte"]
    return out.rename(columns={"first_channel": "canal"})


def churn_status(customers: pd.DataFrame, transactions: pd.DataFrame) -> pd.DataFrame:
    """Churn = sin transacciones en los últimos INACTIVITY_DAYS a la fecha de corte."""
    last_tx = transactions.groupby("customer_id")["transaction_at"].max().rename("ultima_transaccion")
    out = customers.loc[customers["first_deposit_at"].notna(), ["user_id"]].merge(
        last_tx, left_on="user_id", right_index=True, how="left")
    out["dias_inactivo"] = (config.SNAPSHOT_DATE - out["ultima_transaccion"]).dt.days
    out["churn"] = (out["dias_inactivo"] > config.INACTIVITY_DAYS).astype(int)
    return out


def value_by_horizon(cm: pd.DataFrame, customers: pd.DataFrame, months: int = 6) -> pd.Series:
    """Ingreso acumulado en los primeros `months` meses (solo cohortes con ese horizonte observado)."""
    act = customers.loc[customers["first_deposit_at"].notna(), ["user_id", "first_deposit_at"]]
    act = act.assign(cohorte=act["first_deposit_at"].dt.to_period("M").dt.to_timestamp())
    last_full = (config.SNAPSHOT_DATE.to_period("M") - months + 1).to_timestamp()
    act = act[act["cohorte"] < last_full]
    m = cm.merge(act, left_on="customer_id", right_on="user_id")
    m = m[_months_between(m["month"], m["cohorte"]) < months]
    value = m.groupby("customer_id")["ingreso_total_cop"].sum()
    return value.reindex(act["user_id"], fill_value=0).rename(f"ingreso_{months}m_cop")
