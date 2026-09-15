export function formatMoney(amount: number, currencyCode: string = "INR"): string {
  if (amount == null || isNaN(amount)) amount = 0;
  if (currencyCode === "INR") {
    if (amount >= 1e7) return `\u20b9${(amount / 1e7).toFixed(2)} Cr`;
    if (amount >= 1e5) return `\u20b9${(amount / 1e5).toFixed(2)} L`;
    if (amount >= 1e3) return `\u20b9${(amount / 1e3).toFixed(1)}K`;
    return `\u20b9${amount.toFixed(0)}`;
  }

  const symbols: Record<string, string> = {
    USD: "$", GBP: "\u00a3", EUR: "\u20ac", AED: "AED",
  };
  const sym = symbols[currencyCode] || currencyCode + " ";

  if (amount >= 1e9) return `${sym}${(amount / 1e9).toFixed(2)}B`;
  if (amount >= 1e6) return `${sym}${(amount / 1e6).toFixed(2)}M`;
  if (amount >= 1e3) return `${sym}${(amount / 1e3).toFixed(1)}K`;
  return `${sym}${amount.toFixed(0)}`;
}

// Each country's own currency — India in ₹ (Lakh/Crore), everyone else in
// their own local currency code/symbol. Use this instead of a flat ₹/$ for
// any figure that belongs to one specific country/branch, so it never shows
// the wrong label just because the company's default currency is INR.
export function formatByCountry(n: number, country: string): string {
  switch (country) {
    case "India": {
      if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
      if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
      return `₹${(n / 1000).toFixed(0)}K`;
    }
    case "UAE": return `AED ${(n / 1000).toFixed(0)}K`;
    case "Oman": return `OMR ${(n / 1000).toFixed(0)}K`;
    case "Qatar": return `QAR ${(n / 1000).toFixed(0)}K`;
    case "Pakistan": return `PKR ${(n / 100000).toFixed(1)}L`;
    case "Malaysia": return `MYR ${(n / 1000).toFixed(0)}K`;
    case "UK": return `£${(n / 1000).toFixed(0)}K`;
    case "Bahrain": return `BHD ${(n / 1000).toFixed(0)}K`;
    default: return `${(n / 1000).toFixed(0)}K`;
  }
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-IN").format(n);
}

export function formatPct(n: number): string {
  return `${n.toFixed(1)}%`;
}
