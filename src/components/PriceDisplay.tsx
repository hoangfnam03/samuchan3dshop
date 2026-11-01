import { formatPrice } from '../utils/format'

export function PriceDisplay({ price, originalPrice, discountPercent, discountEndsOn, className = '' }: { price: number; originalPrice?: number; discountPercent?: number; discountEndsOn?: string | null; className?: string }) {
  const discounted = Boolean(discountPercent && discountPercent > 0 && originalPrice !== undefined && originalPrice > price)
  const endLabel = discountEndsOn ? new Date(discountEndsOn + 'T00:00:00').toLocaleDateString('vi-VN') : null
  return <span className={'price-display ' + (discounted ? 'has-discount ' : '') + className}>
    <b>{formatPrice(price)}</b>
    {discounted && <><del>{formatPrice(originalPrice!)}</del><small>Giảm {discountPercent}%{endLabel ? ` · tới ${endLabel}` : ''}</small></>}
  </span>
}
