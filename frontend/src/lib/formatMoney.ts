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

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-IN").format(n);
}

export function formatPct(n: number): string {
  return `${n.toFixed(1)}%`;
}
