import type { Env, ProductRecord, ProductVariantRecord } from './contracts'

interface ProductRow {
  id: string
  slug: string
  name: string
  description: string
  category: string | null
  status: ProductRecord['status']
  base_price_vnd: number
  image_key: string | null
  image_url: string | null
  demo_video_url: string | null
  created_at: string
  updated_at: string
}

interface VariantRow {
  id: string
  product_id: string
  sku: string
  color: string
  size: string
  price_vnd: number | null
  stock_quantity: number
  status: ProductVariantRecord['status']
  created_at: string
  updated_at: string
}

interface MediaRow { product_id: string; media_type: 'image' | 'video'; url: string; sort_order: number }

export interface CatalogVariant {
  id: string
  sku: string
  color: string
  size: string
  priceVnd: number | null
  stockQuantity: number
}

export interface CatalogProduct {
  id: string
  slug: string
  name: string
  description: string
  category: string | null
  priceVnd: number
  imageUrl: string | null
  imageUrls: string[]
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
    'SELECT id, slug, name, description, category, status, base_price_vnd, image_key, image_url, demo_video_url, created_at, updated_at FROM products WHERE status = ? ORDER BY created_at DESC',
  ).bind('active').all<ProductRow>()

  const variants = await env.DB.prepare(
    'SELECT v.id, v.product_id, v.sku, c.name AS color, s.name AS size, v.price_vnd, v.stock_quantity, v.status, v.created_at, v.updated_at FROM product_variants v INNER JOIN products p ON p.id = v.product_id INNER JOIN colors c ON c.id = v.color_id INNER JOIN sizes s ON s.id = v.size_id WHERE p.status = ? AND v.status = ? ORDER BY v.product_id, v.created_at ASC',
  ).bind('active', 'active').all<VariantRow>()
  const media = await env.DB.prepare('SELECT product_id, media_type, url, sort_order FROM product_media ORDER BY product_id, sort_order ASC').all<MediaRow>()
  const mediaByProduct = new Map<string, MediaRow[]>()
  for (const item of media.results) mediaByProduct.set(item.product_id, [...(mediaByProduct.get(item.product_id) ?? []), item])

  const variantsByProduct = new Map<string, CatalogVariant[]>()
  for (const variant of variants.results) {
    const list = variantsByProduct.get(variant.product_id) ?? []
    list.push({
      id: variant.id,
      sku: variant.sku,
      color: variant.color,
      size: variant.size,
      priceVnd: variant.price_vnd,
      stockQuantity: variant.stock_quantity,
    })
    variantsByProduct.set(variant.product_id, list)
  }

  const payload: CatalogProduct[] = products.results.map(product => {
    const imageUrls = (mediaByProduct.get(product.id) ?? []).filter(item => item.media_type === 'image').map(item => item.url)
    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      category: product.category,
      priceVnd: product.base_price_vnd,
      imageUrl: imageUrls[0] ?? productUrl(request, product.image_key, product.image_url) ?? null,
      imageUrls,
      demoVideoUrl: product.demo_video_url,
      variants: variantsByProduct.get(product.id) ?? [],
    }
  })

  return Response.json({ data: payload })
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
