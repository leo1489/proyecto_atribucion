"""Atribución multi-touch: modelos heurísticos y algorítmicos (Markov y Shapley).

Entrada común: una tabla de toques (user_id, session_start, channel) y la
fecha de conversión de cada usuario (NaT si no convirtió).
"""
from __future__ import annotations

from math import factorial

import numpy as np
import pandas as pd

HEURISTIC_MODELS = [
    "Último clic", "Primer clic", "Lineal", "Posicional (40/20/40)", "Decaimiento temporal",
]
ALGORITHMIC_MODELS = ["Markov", "Shapley"]
ALL_MODELS = HEURISTIC_MODELS + ALGORITHMIC_MODELS


def prepare_touches(sessions: pd.DataFrame, conversions: pd.DataFrame,
                    lookback_days: int) -> pd.DataFrame:
    """Une toques con conversiones y deja, para quien convirtió, solo los toques
    dentro de la ventana de lookback previa a la conversión."""
    df = sessions[["user_id", "session_start", "channel"]].merge(
        conversions[["user_id", "converted_at"]], on="user_id", how="left")
    converted = df["converted_at"].notna()
    in_window = ((df["session_start"] <= df["converted_at"])
                 & (df["session_start"] >= df["converted_at"] - pd.Timedelta(days=lookback_days)))
    df = df[~converted | in_window].sort_values(["user_id", "session_start"]).reset_index(drop=True)
    df["pos"] = df.groupby("user_id").cumcount()
    df["n"] = df.groupby("user_id")["channel"].transform("size")
    return df


def heuristic_credits(touches: pd.DataFrame, half_life_days: float = 7.0) -> pd.DataFrame:
    """Crédito por toque para cada modelo heurístico (cada conversión reparte 1)."""
    conv = touches[touches["converted_at"].notna()]
    pos, n = conv["pos"], conv["n"]
    middle = 0.2 / np.maximum(n - 2, 1)
    days_before = (conv["converted_at"] - conv["session_start"]).dt.total_seconds() / 86_400
    decay = 0.5 ** (days_before / half_life_days)

    weights = {
        "Último clic": (pos == n - 1).astype(float),
        "Primer clic": (pos == 0).astype(float),
        "Lineal": 1.0 / n,
        "Posicional (40/20/40)": pd.Series(
            np.select([n == 1, n == 2, (pos == 0) | (pos == n - 1)], [1.0, 0.5, 0.4], default=middle),
            index=conv.index),
        "Decaimiento temporal": decay / decay.groupby(conv["user_id"]).transform("sum"),
    }
    frames = [
        pd.DataFrame({"model": model, "user_id": conv["user_id"], "channel": conv["channel"],
                      "converted_at": conv["converted_at"], "credit": w})
        for model, w in weights.items()
    ]
    return pd.concat(frames, ignore_index=True)


def build_paths(touches: pd.DataFrame) -> pd.DataFrame:
    """Agrega journeys idénticos: path (tupla de canales), conversiones y total."""
    by_user = touches.groupby("user_id", sort=False)
    journeys = pd.DataFrame({
        "path": by_user["channel"].agg(tuple),
        "converted": by_user["converted_at"].first().notna(),
    })
    return (journeys.groupby("path")["converted"]
            .agg(conversions="sum", journeys="size").reset_index())


def markov_credits(paths: pd.DataFrame, channels: list[str]) -> pd.Series:
    """Cadena de Markov de primer orden con efecto de remoción."""
    states = ["start", *channels, "conv", "null"]
    ix = {s: i for i, s in enumerate(states)}
    counts = np.zeros((len(states), len(states)))
    for path, conv, total in zip(paths["path"], paths["conversions"], paths["journeys"]):
        seq = ["start", *path]
        for a, b in zip(seq[:-1], seq[1:]):
            counts[ix[a], ix[b]] += total
        counts[ix[path[-1]], ix["conv"]] += conv
        counts[ix[path[-1]], ix["null"]] += total - conv

    row_sums = counts.sum(axis=1, keepdims=True)
    P = np.divide(counts, row_sums, out=np.zeros_like(counts), where=row_sums > 0)
    P[ix["conv"], ix["conv"]] = P[ix["null"], ix["null"]] = 1.0

    base = _conversion_probability(P)
    removal = {}
    for c in channels:
        removed = P.copy()
        removed[ix[c], :] = 0.0
        removed[ix[c], ix["null"]] = 1.0
        removal[c] = 1 - _conversion_probability(removed) / base
    effects = pd.Series(removal)
    return effects / effects.sum() * paths["conversions"].sum()


def _conversion_probability(P: np.ndarray) -> float:
    """Probabilidad de absorción en 'conv' partiendo de 'start'.
    Asume que los dos últimos estados son conv y null (absorbentes)."""
    t = len(P) - 2
    Q, R = P[:t, :t], P[:t, t:]
    absorption = np.linalg.solve(np.eye(t) - Q, R)
    return absorption[0, 0]


def shapley_credits(paths: pd.DataFrame, channels: list[str]) -> pd.Series:
    """Valor de Shapley donde v(S) = conversiones de journeys cuyos canales ⊆ S."""
    n = len(channels)
    bit = {c: 1 << i for i, c in enumerate(channels)}
    v = np.zeros(1 << n)
    for path, conv in zip(paths["path"], paths["conversions"]):
        mask = 0
        for c in set(path):
            mask |= bit[c]
        v[mask] += conv
    for i in range(n):  # suma sobre subconjuntos
        for s in range(1 << n):
            if s & (1 << i):
                v[s] += v[s ^ (1 << i)]

    size = np.array([bin(s).count("1") for s in range(1 << n)])
    weight = [factorial(k) * factorial(n - k - 1) / factorial(n) for k in range(n)]
    phi = np.zeros(n)
    for s in range(1 << n):
        for i in range(n):
            if not s & (1 << i):
                phi[i] += weight[size[s]] * (v[s | (1 << i)] - v[s])
    return pd.Series(phi, index=channels)


def attribution_by_period(touches: pd.DataFrame, channels: list[str], freq: str = "Q") -> pd.DataFrame:
    """Conversiones atribuidas por periodo, modelo y canal.

    Cada journey se asigna al periodo de su conversión o, si no convirtió,
    al de su último toque, y los modelos algorítmicos se estiman por periodo."""
    last_touch = touches.groupby("user_id")["session_start"].transform("max")
    period_ts = touches["converted_at"].fillna(last_touch)
    touches = touches.assign(period=period_ts.dt.to_period(freq).astype(str))

    heur = heuristic_credits(touches)
    heur["period"] = heur["converted_at"].dt.to_period(freq).astype(str)
    frames = [heur.groupby(["period", "model", "channel"], as_index=False)["credit"].sum()]

    for period, group in touches.groupby("period"):
        paths = build_paths(group)
        if paths["conversions"].sum() == 0:
            continue
        for model, fn in [("Markov", markov_credits), ("Shapley", shapley_credits)]:
            credits = fn(paths, channels)
            frames.append(pd.DataFrame({"period": period, "model": model,
                                        "channel": credits.index, "credit": credits.to_numpy()}))
    out = pd.concat(frames, ignore_index=True)
    return out.rename(columns={"credit": "conversions"})
