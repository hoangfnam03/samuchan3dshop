export type Category = 'Custom' | 'Quà tặng' | 'Trang trí' | string

export interface ProductVariant {
  id: string
  colorId?: string
  color: string
  colorName?: string
  colorImageUrl?: string | null
  colorHex?: string | null
  colorBrand?: string | null
  colorMaterialType?: string | null
  colorIsAvailable?: boolean
  size: string
  imageUrl?: string | null
  price?: number
  originalPrice?: number
  stockQuantity: number
}

export interface ProductColor {
  id: string
  name: string
  imageUrl?: string | null
  hex?: string | null
  brand?: string | null
  materialType?: string | null
  isAvailable?: boolean
  priceVnd?: number | null
  originalPriceVnd?: number | null
  discountPercent?: number
  discountEndsOn?: string | null
}

export interface Product {
  id: string | number
  name: string
  price: number
  originalPrice?: number
  discountPercent?: number
  discountEndsOn?: string | null
  category: Category
  description?: string
  image: string
  images?: string[]
  colorPreviewUrl?: string | null
  filamentTypes?: string[]
  badge?: string
  colors: string[]
  masterColors?: ProductColor[]
  sizes: string[]
  stockQuantity: number
  variants?: ProductVariant[]
  demoVideoUrl?: string
}

export interface CartItem extends Product {
  color: string
  size: string
  quantity: number
  variantId?: string
  customColorId?: string
  filamentColorId?: string
  customColorImageUrl?: string | null
  customColorHex?: string | null
  availabilityNote?: string
}

export type View =
  | 'home'
  | 'shop'
  | 'filament-shop'
  | 'cart'
  | 'checkout'
  | 'success'
  | 'tracking-login'
  | 'tracking'
  | 'warranty'
  | { name: 'product'; id: string | number }
