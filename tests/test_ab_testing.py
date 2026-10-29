import pytest

from growth import ab_testing


def test_two_proportion_test_known_values():
    res = ab_testing.two_proportion_test(100, 1000, 130, 1000)
    assert res["diferencia_abs"] == pytest.approx(0.03)
    assert res["lift_relativo"] == pytest.approx(0.30)
    assert res["p_valor"] == pytest.approx(0.0357, abs=1e-3)
    assert res["significativo"]
    assert res["ic_inf"] < 0.03 < res["ic_sup"]


def test_no_difference_is_not_significant():
    res = ab_testing.two_proportion_test(50, 500, 50, 500)
    assert res["p_valor"] == pytest.approx(1.0)
    assert not res["significativo"]


def test_srm_detects_unbalanced_split():
    assert ab_testing.srm_p_value(5000, 5000) == pytest.approx(1.0)
    assert ab_testing.srm_p_value(5000, 5400) < 0.001


def test_mde_shrinks_with_sample_size():
    small = ab_testing.minimum_detectable_effect(500, 0.6)
    large = ab_testing.minimum_detectable_effect(5000, 0.6)
    assert large == pytest.approx(small / 10 ** 0.5)
