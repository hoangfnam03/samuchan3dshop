export function isValidDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(value + 'T00:00:00.000Z')
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export function activeDiscountPercent(percent: number | null | undefined, endsOn: string | null | undefined, now = Date.now()) {
  if (!Number.isSafeInteger(percent) || !percent || percent < 1 || percent > 99 || !isValidDateOnly(endsOn)) return 0
  const expiresAt = Date.parse(endsOn + 'T23:59:59.999+07:00')
  return now <= expiresAt ? percent : 0
}

export function discountedPrice(priceVnd: number, percent: number) {
  return percent > 0 ? Math.floor(priceVnd * (100 - percent) / 100) : priceVnd
}
