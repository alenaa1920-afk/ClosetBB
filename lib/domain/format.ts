const CURRENCY_SYMBOL: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AED: "AED ",
  SGD: "S$",
};

export function currencySymbol(currency = "INR"): string {
  return CURRENCY_SYMBOL[currency.toUpperCase()] ?? `${currency.toUpperCase()} `;
}

export function formatPrice(
  price: number | null | undefined,
  currency = "INR",
): string {
  if (price == null || Number.isNaN(price)) return "—";
  const fraction = Number.isInteger(price) ? 0 : 2;
  return `${currencySymbol(currency)}${price.toLocaleString("en-IN", {
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
  })}`;
}

/** "12 March 2026" */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "March 2026" */
export function formatMonth(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/**
 * Soft, human relative time — "Added today", "3 days ago". Nothing in this
 * app should ever show a raw timestamp.
 */
export function formatRelative(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const days = Math.floor((now - then) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "Last week";
  if (days < 31) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return formatMonth(iso);
  return formatMonth(iso);
}

export function pluralise(
  count: number,
  singular: string,
  plural?: string,
): string {
  return `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;
}

/** Joins class names, dropping anything falsy. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
