// Money helpers — always integer cents internally.

export function toCents(amount: number): number {
  // Avoid 1.99 * 100 → 198.999... by rounding.
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function formatCents(cents: number, currency = 'CNY'): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const main = Math.floor(abs / 100);
  const rest = abs % 100;
  const symbol = currency === 'CNY' ? '¥'
              : currency === 'USD' ? '$'
              : currency === 'EUR' ? '€'
              : currency === 'JPY' ? '¥'
              : '';
  return `${sign}${symbol}${main}.${rest.toString().padStart(2, '0')}`;
}
