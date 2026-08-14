"""Test currency formatting and conversion logic."""
import pytest


def format_money_inr(amount: float) -> str:
    """Format INR amounts with Indian digit grouping and Lakh/Crore abbreviation."""
    if amount >= 1e7:
        return f"\u20b9{amount / 1e7:.2f} Cr"
    elif amount >= 1e5:
        return f"\u20b9{amount / 1e5:.2f} L"
    elif amount >= 1e3:
        return f"\u20b9{amount / 1e3:.1f}K"
    return f"\u20b9{amount:.0f}"


def format_money_western(amount: float, symbol: str = "$") -> str:
    """Format with K/M/B abbreviation."""
    if amount >= 1e9:
        return f"{symbol}{amount / 1e9:.2f}B"
    elif amount >= 1e6:
        return f"{symbol}{amount / 1e6:.2f}M"
    elif amount >= 1e3:
        return f"{symbol}{amount / 1e3:.1f}K"
    return f"{symbol}{amount:.0f}"


def convert_currency(amount: float, rate: float) -> float:
    return round(amount * rate, 2)


class TestCurrencyFormatting:
    def test_inr_crore(self):
        assert format_money_inr(24500000) == "\u20b92.45 Cr"

    def test_inr_lakh(self):
        assert format_money_inr(245000) == "\u20b92.45 L"

    def test_inr_thousand(self):
        assert format_money_inr(15000) == "\u20b915.0K"

    def test_inr_small(self):
        assert format_money_inr(500) == "\u20b9500"

    def test_western_millions(self):
        assert format_money_western(2500000) == "$2.50M"

    def test_western_billions(self):
        assert format_money_western(1500000000) == "$1.50B"

    def test_western_thousands(self):
        assert format_money_western(15000) == "$15.0K"

    def test_inr_zero(self):
        assert format_money_inr(0) == "\u20b90"

    def test_inr_negative(self):
        result = format_money_inr(-500000)
        assert "\u20b9" in result


class TestCurrencyConversion:
    def test_basic_conversion(self):
        assert convert_currency(1000, 0.012) == 12.00

    def test_identity_conversion(self):
        assert convert_currency(1000, 1.0) == 1000.00

    def test_zero_amount(self):
        assert convert_currency(0, 83.5) == 0.00

    def test_precision(self):
        result = convert_currency(1000, 0.01234567)
        assert isinstance(result, float)
