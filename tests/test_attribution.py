import pandas as pd
import pytest

from growth import attribution

CHANNELS = ["A", "B", "C"]


def _touches(journeys):
    """journeys: lista de (user_id, [canales], convirtió)."""
    rows = []
    base = pd.Timestamp("2026-01-01")
    for user, channels, converted in journeys:
        for i, ch in enumerate(channels):
            rows.append({"user_id": user, "session_start": base + pd.Timedelta(days=i), "channel": ch})
    sessions = pd.DataFrame(rows)
    conv = pd.DataFrame([
        {"user_id": u, "converted_at": base + pd.Timedelta(days=len(chs)) if c else pd.NaT}
        for u, chs, c in journeys
    ])
    return attribution.prepare_touches(sessions, conv, lookback_days=30)


JOURNEYS = [
    ("u1", ["A", "B", "C"], True),
    ("u2", ["A", "C"], True),
    ("u3", ["B"], True),
    ("u4", ["A", "B"], False),
    ("u5", ["C", "C"], False),
    ("u6", ["A"], False),
]


def test_heuristics_distribute_one_credit_per_conversion():
    credits = attribution.heuristic_credits(_touches(JOURNEYS))
    totals = credits.groupby("model")["credit"].sum()
    assert set(totals.index) == set(attribution.HEURISTIC_MODELS)
    assert totals.to_numpy() == pytest.approx(3.0)


def test_first_and_last_click():
    credits = attribution.heuristic_credits(_touches(JOURNEYS))
    by = credits.groupby(["model", "channel"])["credit"].sum()
    assert by["Primer clic"].to_dict() == {"A": 2.0, "B": 1.0, "C": 0.0}
    assert by["Último clic"].to_dict() == {"A": 0.0, "B": 1.0, "C": 2.0}


def test_position_based_weights():
    credits = attribution.heuristic_credits(_touches([("u1", ["A", "B", "C"], True)]))
    pos = credits[credits["model"] == "Posicional (40/20/40)"].set_index("channel")["credit"]
    assert pos.to_dict() == pytest.approx({"A": 0.4, "B": 0.2, "C": 0.4})


def test_markov_and_shapley_sum_to_total_conversions():
    paths = attribution.build_paths(_touches(JOURNEYS))
    for fn in (attribution.markov_credits, attribution.shapley_credits):
        assert fn(paths, CHANNELS).sum() == pytest.approx(3.0)


def test_single_channel_gets_all_credit():
    paths = attribution.build_paths(_touches([("u1", ["A"], True), ("u2", ["A", "A"], False)]))
    assert attribution.markov_credits(paths, ["A", "B"])["A"] == pytest.approx(1.0)
    assert attribution.shapley_credits(paths, ["A", "B"])["A"] == pytest.approx(1.0)


def test_shapley_splits_symmetric_channels_equally():
    paths = attribution.build_paths(_touches([("u1", ["A", "B"], True), ("u2", ["B", "A"], True)]))
    credits = attribution.shapley_credits(paths, ["A", "B"])
    assert credits["A"] == pytest.approx(credits["B"]) == pytest.approx(1.0)


def test_lookback_drops_old_touches():
    sessions = pd.DataFrame({
        "user_id": ["u1", "u1"],
        "session_start": pd.to_datetime(["2026-01-01", "2026-03-01"]),
        "channel": ["A", "B"],
    })
    conv = pd.DataFrame({"user_id": ["u1"], "converted_at": pd.to_datetime(["2026-03-02"])})
    touches = attribution.prepare_touches(sessions, conv, lookback_days=30)
    assert touches["channel"].tolist() == ["B"]
