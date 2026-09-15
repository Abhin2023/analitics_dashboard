export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

// Local calendar date (YYYY-MM-DD), not UTC — .toISOString() shifts the date
// for users east of UTC (e.g. IST) whenever it's already past local midnight
// but not yet UTC midnight.
export function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
