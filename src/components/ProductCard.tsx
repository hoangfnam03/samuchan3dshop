import { useState } from 'react'
import type { Product, View } from '../types'
import { formatPrice } from '../utils/format'

interface ProductCardProps {
  product: Product
  setView: (view: View) => void
  onEdit?: (productId: string | number, field: 'name' | 'image') => void
}

export function ProductCard({ product, setView, onEdit }: ProductCardProps) {
  const images = product.images?.length ? product.images : [product.image]
  const [hoverImage, setHoverImage] = useState(0)
  const hasGallery = images.length > 1
  return (
    <div className="product-card" role="button" tabIndex={0} onClick={() => setView({ name: 'product', id: product.id })} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') setView({ name: 'product', id: product.id }) }}>
      <span className="product-image" onMouseEnter={() => hasGallery && setHoverImage(1)} onMouseLeave={() => setHoverImage(0)}>
        <span className="product-image-track" style={{ transform: `translateX(-${hoverImage * 50}%)` }}>
          {images.slice(0, 2).map((image, index) => <img key={image} src={image} alt={index === 0 ? product.name : ''} />)}
        </span>
        {onEdit && <button className="inline-edit image-edit" type="button" onClick={event => { event.stopPropagation(); onEdit(product.id, 'image') }} aria-label="Chỉnh ảnh sản phẩm">✎</button>}
        {product.stockQuantity === 0 && <b className="sold-out">Hết hàng</b>}
        {product.badge && product.stockQuantity > 0 && <b className="product-badge">{product.badge}</b>}
      </span>
      <span className="product-info">
        <span>
          <strong>{product.name}{onEdit && <button className="inline-edit" type="button" onClick={event => { event.stopPropagation(); onEdit(product.id, 'name') }} aria-label="Chỉnh tên sản phẩm">✎</button>}</strong>
          <small>{product.colors.length} màu sắc · {product.sizes.length} size</small>
        </span>
        <b>{formatPrice(product.price)}</b>
      </span>
    </div>
  )
}
