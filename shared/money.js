/**
 * Money helpers.
 *
 * All amounts are stored and passed around as integer centavos to avoid
 * floating point rounding errors. These helpers are the only place that should
 * convert to and from human-facing values.
 */

export const CURRENCIES = {
  PHP: { code: 'PHP', symbol: '\u20B1', locale: 'en-PH' },
  USD: { code: 'USD', symbol: '$', locale: 'en-US' },
  EUR: { code: 'EUR', symbol: '\u20AC', locale: 'en-IE' },
};

export const DEFAULT_CURRENCY = 'PHP';

function resolveCurrency(currency) {
  return CURRENCIES[currency] ?? CURRENCIES[DEFAULT_CURRENCY];
}

/** "12.34" / 12.34 -> 1234 */
export function toCents(amount) {
  const value = Number(amount ?? 0);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

/** 1234 -> 12.34 */
export function fromCents(cents) {
  const value = Number(cents ?? 0);
  if (!Number.isFinite(value)) return 0;
  return value / 100;
}

/** 1234 -> "₱12.34" */
export function formatCents(cents, currency = DEFAULT_CURRENCY) {
  const { symbol, locale } = resolveCurrency(currency);
  const value = fromCents(cents);
  return (
    symbol +
    value.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

/** 1234 -> "12.34" (no symbol), handy for CSV export and inputs. */
export function centsToPlainString(cents) {
  return fromCents(cents).toFixed(2);
}
