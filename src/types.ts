export type Category = 'Custom' | 'Quà tặng' | 'Trang trí' | string

export interface ProductVariant {
  id: string
  color: string
  size: string
  price?: number
  stockQuantity: number
}

export interface Product {
  id: string | number
  name: string
  price: number
  category: Category
  description?: string
  image: string
  images?: string[]
  badge?: string
  colors: string[]
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
}

export type View =
  | 'home'
  | 'shop'
  | 'cart'
  | 'checkout'
  | 'success'
  | 'tracking-login'
  | 'tracking'
  | 'warranty'
  | { name: 'product'; id: string | number }
