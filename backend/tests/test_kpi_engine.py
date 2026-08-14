"""Test the KPI scoring engine and incentive band resolution."""
import pytest
from app.models.models import KPIWeight, IncentiveBand


def resolve_band(score: float, bands: list) -> tuple:
    sorted_bands = sorted(bands, key=lambda b: b.min_kpi_score, reverse=True)
    for band in sorted_bands:
        if score >= float(band.min_kpi_score):
            return band.label, float(band.multiplier)
    return "Below Target", 1.0


class MockBand:
    def __init__(self, min_kpi_score, multiplier, label):
        self.min_kpi_score = min_kpi_score
        self.multiplier = multiplier
        self.label = label


BANDS = [
    MockBand(1.10, 1.40, "140% Star"),
    MockBand(1.00, 1.20, "120% Accelerated"),
    MockBand(0.90, 1.00, "100% Full Pay"),
    MockBand(0.00, 1.00, "Below Target - TBD"),
]


def compute_weighted_score(scores: dict, weights: dict) -> float:
    return sum(scores.get(k, 0) * v for k, v in weights.items())


class TestKPIScoring:
    def test_star_band(self):
        label, mult = resolve_band(1.15, BANDS)
        assert label == "140% Star"
        assert mult == 1.40

    def test_above_target_band(self):
        label, mult = resolve_band(1.05, BANDS)
        assert label == "120% Accelerated"
        assert mult == 1.20

    def test_on_target_band(self):
        label, mult = resolve_band(0.92, BANDS)
        assert label == "100% Full Pay"
        assert mult == 1.00

    def test_below_target_band(self):
        label, mult = resolve_band(0.75, BANDS)
        assert "Below Target" in label
        assert mult == 1.00

    def test_zero_score(self):
        label, mult = resolve_band(0.0, BANDS)
        assert "Below Target" in label
        assert mult == 1.00

    def test_exact_boundary_star(self):
        label, mult = resolve_band(1.10, BANDS)
        assert label == "140% Star"

    def test_exact_boundary_above(self):
        label, mult = resolve_band(1.00, BANDS)
        assert label == "120% Accelerated"

    def test_exact_boundary_on_target(self):
        label, mult = resolve_band(0.90, BANDS)
        assert label == "100% Full Pay"

    def test_weighted_score_calculation(self):
        weights = {
            "revenue_vs_target": 0.30,
            "dsr_submission_rate": 0.10,
            "walk_in_conversion": 0.10,
            "cash_management": 0.10,
            "care_plus_attachment": 0.00,
            "calls_vs_target": 0.10,
            "stock_control": 0.10,
            "training_compliance": 0.05,
            "bp_app_update_rate": 0.05,
            "complaint_resolution": 0.10,
        }
        scores = {
            "revenue_vs_target": 1.0,
            "dsr_submission_rate": 1.0,
            "walk_in_conversion": 1.0,
            "cash_management": 1.0,
            "care_plus_attachment": 0.0,
            "calls_vs_target": 1.0,
            "stock_control": 1.0,
            "training_compliance": 1.0,
            "bp_app_update_rate": 1.0,
            "complaint_resolution": 1.0,
        }
        total = compute_weighted_score(scores, weights)
        assert abs(total - 1.0) < 0.01

    def test_weights_sum_to_one(self):
        weights = [0.30, 0.10, 0.10, 0.10, 0.00, 0.10, 0.10, 0.05, 0.05, 0.10]
        assert abs(sum(weights) - 1.0) < 0.01
