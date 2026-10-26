export type Id = string
export type IsoDate = string
export type MoneyVnd = number

export type ProductStatus = 'draft' | 'active' | 'archived'

export interface ProductRecord {
  id: Id
  slug: string
  name: string
  description: string
  categoryId?: Id
  status: ProductStatus
  basePriceVnd: MoneyVnd
  createdAt: IsoDate
  updatedAt: IsoDate
}

export interface ProductVariantRecord {
  id: Id
  productId: Id
  sku: string
  colorId: Id
  sizeId: Id
  priceVnd?: MoneyVnd
  stockQuantity: number
  status: ProductStatus
  createdAt: IsoDate
  updatedAt: IsoDate
}

export type OrderStatus = 'received' | 'confirmed' | 'preparing' | 'packing' | 'shipping' | 'completed' | 'cancelled'

export interface OrderRecord {
  id: Id
  orderCode: string
  trackingTokenHash: string
  customerId?: Id
  customerName: string
  customerPhone: string
  shippingAddress?: string
  note?: string
  status: OrderStatus
  subtotalVnd: MoneyVnd
  shippingFeeVnd: MoneyVnd
  totalVnd: MoneyVnd
  createdAt: IsoDate
  updatedAt: IsoDate
}

export interface OrderItemRecord {
  id: Id
  orderId: Id
  productId: Id
  variantId: Id
  productNameSnapshot: string
  skuSnapshot: string
  colorSnapshot: string
  sizeSnapshot: string
  unitPriceVnd: MoneyVnd
  quantity: number
  optionSnapshotJson?: string
}

export interface OrderStatusHistoryRecord {
  id: Id
  orderId: Id
  fromStatus?: OrderStatus
  toStatus: OrderStatus
  note?: string
  changedByAdminId?: Id
  createdAt: IsoDate
}

export interface AdminRecord {
  id: Id
  email: string
  passwordHash: string
  createdAt: IsoDate
  updatedAt: IsoDate
}

export interface Env {
  DB: D1Database
  MEDIA: R2Bucket
  ASSETS: Fetcher
  ADMIN_EMAIL?: string
  ADMIN_PASSWORD_HASH?: string
}

export interface HealthResponse {
  service: 'samuchan-api'
  status: 'ok'
  phase: 'orders'
}
