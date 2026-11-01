import type { Env, ProductRecord, ProductVariantRecord } from './contracts'
import { parseStoredFilamentTypes } from './filament-types'
import { filamentTypeKey } from './filament-pricing'
import { activeDiscountPercent, discountedPrice } from './discounts'

interface ProductRow {
  id: string
  slug: string
  name: string
  description: string
  category: string | null
  status: ProductRecord['status']
  base_price_vnd: number
  discount_percent: number
  discount_ends_on: string | null
  image_key: string | null
  image_url: string | null
  color_preview_url: string | null
  filament_types: string | null
  filament_type: string | null
  demo_video_url: string | null
  created_at: string
  updated_at: string
}

interface VariantRow {
  id: string
  product_id: string
  sku: string
  color_id: string
  color: string
  color_image_url: string | null
  color_hex: string | null
  color_brand: string | null
  color_material_type: string | null
  color_is_available: number
  size_id: string
  size: string
  image_url: string | null
  price_vnd: number | null
  stock_quantity: number
  base_price_vnd: number
  discount_percent: number
  discount_ends_on: string | null
  status: ProductVariantRecord['status']
  created_at: string
  updated_at: string
}

interface MediaRow { product_id: string; media_type: 'image' | 'video'; url: string; sort_order: number }

export interface CatalogVariant {
  id: string
  sku: string
  colorId: string
  color: string
  colorImageUrl: string | null
  colorHex: string | null
  colorBrand: string | null
  colorMaterialType: string | null
  colorIsAvailable: boolean
  size: string
  imageUrl: string | null
  priceVnd: number
  originalPriceVnd: number
  discountPercent: number
  discountEndsOn: string | null
  stockQuantity: number
}

export interface CatalogColor {
  id: string
  name: string
  imageUrl: string | null
  hex: string | null
  brand: string | null
  materialType: string | null
  isAvailable: boolean
  priceVnd: number | null
  originalPriceVnd: number | null
  discountPercent: number
  discountEndsOn: string | null
}

interface CatalogColorRow extends Omit<CatalogColor, 'isAvailable' | 'priceVnd' | 'originalPriceVnd' | 'discountPercent' | 'discountEndsOn'> { isAvailable: number }
interface FilamentTypePriceRow { material_type_key: string; price_vnd: number; discount_percent: number; discount_ends_on: string | null }

export interface CatalogProduct {
  id: string
  slug: string
  name: string
  description: string
  category: string | null
  priceVnd: number
  originalPriceVnd: number
  discountPercent: number
  discountEndsOn: string | null
  imageUrl: string | null
  imageUrls: string[]
  colorPreviewUrl: string | null
  filamentTypes: string[]
  demoVideoUrl: string | null
  variants: CatalogVariant[]
}

function productUrl(request: Request, imageKey: string | null, imageUrl: string | null) {
  if (imageUrl) return imageUrl
  if (!imageKey) return null
  return new URL('/media/' + imageKey, request.url).toString()
}

export async function listCatalog(request: Request, env: Env): Promise<Response> {
  const products = await env.DB.prepare(
    'SELECT id, slug, name, description, category, status, base_price_vnd, discount_percent, discount_ends_on, image_key, image_url, color_preview_url, filament_types, filament_type, demo_video_url, created_at, updated_at FROM products WHERE status = ? ORDER BY created_at DESC',
  ).bind('active').all<ProductRow>()

  const variants = await env.DB.prepare(
    'SELECT v.id, v.product_id, v.sku, c.id AS color_id, c.display_name AS color, c.image_url AS color_image_url, c.hex AS color_hex, c.brand AS color_brand, c.filament_type AS color_material_type, c.is_active AS color_is_available, v.size_id, s.name AS size, v.image_url, v.price_vnd, v.stock_quantity, v.status, p.base_price_vnd, p.discount_percent, p.discount_ends_on, v.created_at, v.updated_at FROM product_variants v INNER JOIN products p ON p.id = v.product_id INNER JOIN colors c ON c.id = v.color_id INNER JOIN sizes s ON s.id = v.size_id WHERE p.status = ? ORDER BY v.product_id, v.size_id, v.created_at ASC, v.id ASC',
  ).bind('active').all<VariantRow>()
  const media = await env.DB.prepare('SELECT product_id, media_type, url, sort_order FROM product_media ORDER BY product_id, sort_order ASC').all<MediaRow>()
  const colors = await env.DB.prepare('SELECT id, display_name AS name, image_url AS imageUrl, hex, brand, filament_type AS materialType, is_active AS isAvailable FROM colors ORDER BY display_name COLLATE NOCASE, filament_type COLLATE NOCASE, brand COLLATE NOCASE').all<CatalogColorRow>()
  const categoryRows = await env.DB.prepare('SELECT name FROM product_categories WHERE is_active = 1 ORDER BY sort_order, name COLLATE NOCASE').all<{ name: string }>()
  const typePrices = await env.DB.prepare('SELECT material_type_key, price_vnd, discount_percent, discount_ends_on FROM filament_type_prices').all<FilamentTypePriceRow>()
  const now = Date.now()
  const priceByType = new Map(typePrices.results.map(item => {
    const discountPercent = activeDiscountPercent(item.discount_percent, item.discount_ends_on, now)
    return [item.material_type_key, { priceVnd: discountedPrice(item.price_vnd, discountPercent), originalPriceVnd: item.price_vnd, discountPercent, discountEndsOn: discountPercent ? item.discount_ends_on : null }]
  }))
  const mediaByProduct = new Map<string, MediaRow[]>()
  for (const item of media.results) mediaByProduct.set(item.product_id, [...(mediaByProduct.get(item.product_id) ?? []), item])

  const variantsByProduct = new Map<string, CatalogVariant[]>()
  const priceBySize = new Map<string, number>()
  for (const variant of variants.results) {
    const priceKey = variant.product_id + ':' + variant.size_id
    if (variant.status !== 'active') continue
    if (!priceBySize.has(priceKey)) priceBySize.set(priceKey, variant.price_vnd ?? variant.base_price_vnd)
    const list = variantsByProduct.get(variant.product_id) ?? []
    const originalPriceVnd = priceBySize.get(priceKey) ?? variant.price_vnd ?? variant.base_price_vnd
    const discountPercent = activeDiscountPercent(variant.discount_percent, variant.discount_ends_on, now)
    list.push({
      id: variant.id,
      sku: variant.sku,
      colorId: variant.color_id,
      color: variant.color,
      colorImageUrl: variant.color_image_url,
      colorHex: variant.color_hex,
      colorBrand: variant.color_brand,
      colorMaterialType: variant.color_material_type,
      colorIsAvailable: variant.color_is_available === 1,
      size: variant.size,
      imageUrl: variant.image_url,
      priceVnd: discountedPrice(originalPriceVnd, discountPercent),
      originalPriceVnd,
      discountPercent,
      discountEndsOn: discountPercent ? variant.discount_ends_on : null,
      stockQuantity: variant.stock_quantity,
    })
    variantsByProduct.set(variant.product_id, list)
  }

  const payload: CatalogProduct[] = products.results.map(product => {
    const imageUrls = (mediaByProduct.get(product.id) ?? []).filter(item => item.media_type === 'image').map(item => item.url)
    const productVariants = variantsByProduct.get(product.id) ?? []
    const originalPriceVnd = productVariants.length ? Math.min(...productVariants.map(variant => variant.originalPriceVnd)) : product.base_price_vnd
    const priceVnd = productVariants.length ? Math.min(...productVariants.map(variant => variant.priceVnd ?? variant.originalPriceVnd)) : discountedPrice(product.base_price_vnd, activeDiscountPercent(product.discount_percent, product.discount_ends_on, now))
    const discountPercent = activeDiscountPercent(product.discount_percent, product.discount_ends_on, now)
    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      category: product.category,
      priceVnd,
      originalPriceVnd,
      discountPercent,
      discountEndsOn: discountPercent ? product.discount_ends_on : null,
      imageUrl: imageUrls[0] ?? productUrl(request, product.image_key, product.image_url) ?? null,
      imageUrls,
      colorPreviewUrl: product.color_preview_url,
      filamentTypes: parseStoredFilamentTypes(product.filament_types, product.filament_type),
      demoVideoUrl: product.demo_video_url,
      variants: productVariants,
    }
  })

  const categoryNames = new Map<string, string>()
  for (const category of categoryRows.results) categoryNames.set(category.name.normalize('NFC').trim().toLocaleLowerCase('vi-VN'), category.name.trim())
  for (const product of products.results) {
    const name = product.category?.trim()
    if (name) categoryNames.set(name.normalize('NFC').toLocaleLowerCase('vi-VN'), name)
  }

  return Response.json({ data: payload, categories: [...categoryNames.values()], colors: colors.results.map(color => { const price = priceByType.get(filamentTypeKey(color.materialType)); return { ...color, isAvailable: color.isAvailable === 1, priceVnd: price?.priceVnd ?? null, originalPriceVnd: price?.originalPriceVnd ?? null, discountPercent: price?.discountPercent ?? 0, discountEndsOn: price?.discountEndsOn ?? null } }) })
}

export async function getMedia(request: Request, env: Env): Promise<Response> {
  const key = decodeURIComponent(new URL(request.url).pathname.slice('/media/'.length))
  if (!key || key.includes('..')) return Response.json({ error: 'INVALID_MEDIA_KEY' }, { status: 400 })

  const object = await env.MEDIA.get(key)
  if (!object) return new Response('Not Found', { status: 404 })
  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  return new Response(object.body, { headers })
}
