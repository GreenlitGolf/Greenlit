/**
 * Format a number as USD currency with proper decimal places.
 *
 * @param amount  - The numeric amount to format
 * @param cents   - If true, always show 2 decimal places ($197.50).
 *                  If false, omit decimals for whole numbers ($197).
 *                  Default: true
 */
export function formatCurrency(amount: number, cents = true): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: 2,
  })
}
