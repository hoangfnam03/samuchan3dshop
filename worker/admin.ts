import type { Env, OrderStatus } from './contracts'
import { parseFilamentTypesInput, parseStoredFilamentTypes } from './filament-types'
import { filamentTypeKey } from './filament-pricing'
import { isValidDateOnly } from './discounts'

interface AdminIdentity { adminId: string }
interface AdminRow { id: string; email: string; password_hash: string }
interface SessionRow { admin_id: string; expires_at: string }
interface ProductAdminRow { id: string; slug: string; name: string; description: string; category: string | null; status: string; base_price_vnd: number; discount_percent: number; discount_ends_on: string | null; image_key: string | null; image_url: string | null; color_preview_url: string | null; filament_types: string | null; filament_type: string | null; demo_video_url: string | null; variant_id: string | null; sku: string | null; color_id: string | null; color: string | null; size_id: string | null; size: string | null; price_vnd: number | null; stock_quantity: number | null; variant_status: string | null; variant_image_url: string | null }
interface ProductMediaAdminRow { product_id: string; media_type: 'image' | 'video'; url: string; sort_order: number }
interface OrderAdminRow { id: string; order_code: string; customer_name: string; customer_phone: string; shipping_address: string | null; note: string | null; status: OrderStatus; subtotal_vnd: number; shipping_fee_vnd: number; total_vnd: number; created_at: string; updated_at: string; items_summary: string }
interface CustomerAdminRow { id: string; customer_code: string; name: string; normalized_phone: string; email: string | null; note: string | null; created_at: string; updated_at: string; order_count: number; total_spent_vnd: number; last_order_at: string | null }
interface SiteConfigRow { value_json: string }
interface FilamentPurchaseCostItem { label: string; costVnd: number; isFixed: boolean }

function parseStoredFilamentCosts(value: string): FilamentPurchaseCostItem[] {
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap(item => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) return []
      const row = item as Record<string, unknown>
      if (typeof row.label !== 'string' || !Number.isSafeInteger(row.costVnd) || Number(row.costVnd) < 0) return []
      return [{ label: row.label, costVnd: Number(row.costVnd), isFixed: row.isFixed === true }]
    })
  } catch {
    return []
  }
}

const siteConfigFields = [
  'heroTitle', 'heroAccent', 'heroDescription', 'heroImage', 'processHeading', 'featuredHeading',
  'footerDescription', 'footerProduct1', 'footerProduct2', 'footerProduct3', 'footerZalo',
  'footerEmail', 'footerAddress', 'footerCopyright', 'footerTagline',
] as const

const SESSION_HOURS = 8
const orderTransitions: Record<OrderStatus, OrderStatus[]> = {
  received: ['confirmed', 'cancelled'], confirmed: ['preparing', 'cancelled'], preparing: ['packing', 'cancelled'],
  packing: ['shipping'], shipping: ['completed'],
  completed: [], cancelled: [],
}

function fail(error: string, message: string, status: number) {
  return Response.json({ error, message }, { status, headers: { 'cache-control': 'no-store' } })
}
function randomHex(bytesLength: number) {
  const bytes = new Uint8Array(bytesLength)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}
async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}
function hexBytes(value: string) {
  const output = new Uint8Array(value.length / 2)
  for (let i = 0; i < output.length; i++) output[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16)
  return output
}
function equalBytes(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false
  let difference = 0
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i]
  return difference === 0
}
async function verifyPassword(password: string, encoded: string) {
  const parts = encoded.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256') return false
  const iterations = Number(parts[1])
  if (!Number.isSafeInteger(iterations) || iterations < 10000 || iterations > 500000 || !/^[0-9a-f]+$/.test(parts[2]) || !/^[0-9a-f]+$/.test(parts[3])) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: hexBytes(parts[2]), iterations, hash: 'SHA-256' }, key, 256)
  return equalBytes(new Uint8Array(bits), hexBytes(parts[3]))
}
function parseCookie(request: Request, name: string) {
  const cookie = request.headers.get('cookie')?.split(';').map(value => value.trim()).find(value => value.startsWith(name + '='))
  return cookie?.slice(name.length + 1)
}
function sessionToken(request: Request) {
  return parseCookie(request, 'samuchan_admin') ?? request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
}
function sessionCookie(request: Request, token: string, maxAge: number) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  return 'samuchan_admin=' + token + '; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=' + maxAge + secure
}
export async function bodyRecord(request: Request) {
  try {
    const value: unknown = await request.json()
    return value && typeof value === 'object' ? value as Record<string, unknown> : null
  } catch { return null }
}
function stringField(value: unknown, max: number) {
  return typeof value === 'string' && value.trim() && value.trim().length <= max ? value.trim() : undefined
}
function parseDiscountPercent(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 99 ? Number(value) : undefined
}
function parseDiscountEndDate(value: unknown): string | null | undefined {
  if (value === null || value === '') return null
  return isValidDateOnly(value) ? value : undefined
}
function parsePurchaseUrl(value: unknown): string | null | undefined {
  if (value === null || value === '') return null
  const text = stringField(value, 2000)
  if (!text) return undefined
  try {
    const url = new URL(text)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return undefined
    return url.toString()
  } catch { return undefined }
}

export async function login(request: Request, env: Env) {
  const body = await bodyRecord(request)
  const email = stringField(body?.email, 320)?.toLowerCase()
  const password = typeof body?.password === 'string' ? body.password : undefined
  if (!email || !password) return fail('INVALID_CREDENTIALS', 'Email hoặc mật khẩu không hợp lệ.', 401)

  const row = await env.DB.prepare('SELECT id, email, password_hash FROM admins WHERE email = ? LIMIT 1').bind(email).first<AdminRow>()
  const configuredEmail = env.ADMIN_EMAIL?.toLowerCase()
  const adminEmail = row?.email ?? configuredEmail
  const passwordHash = row?.password_hash ?? (configuredEmail === email ? env.ADMIN_PASSWORD_HASH : undefined)
  if (!adminEmail || !passwordHash || adminEmail.toLowerCase() !== email || !(await verifyPassword(password, passwordHash))) {
    return fail('INVALID_CREDENTIALS', 'Email hoặc mật khẩu không hợp lệ.', 401)
  }

  const token = randomHex(32)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + SESSION_HOURS * 60 * 60 * 1000).toISOString()
  await env.DB.prepare('INSERT INTO admin_sessions (id, token_hash, admin_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), await sha256Hex(token), row?.id ?? 'bootstrap', expiresAt, now.toISOString()).run()
  return Response.json({ data: { email: adminEmail, expiresAt } }, { headers: { 'cache-control': 'no-store', 'set-cookie': sessionCookie(request, token, SESSION_HOURS * 60 * 60) } })
}

export async function logout(request: Request, env: Env) {
  const token = sessionToken(request)
  if (token) await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run()
  return new Response(null, { status: 204, headers: { 'set-cookie': sessionCookie(request, '', 0) } })
}

export async function requireAdmin(request: Request, env: Env): Promise<AdminIdentity | Response> {
  const token = sessionToken(request)
  if (!token || token.length < 32) return fail('UNAUTHORIZED', 'Cần đăng nhập admin.', 401)
  const session = await env.DB.prepare('SELECT admin_id, expires_at FROM admin_sessions WHERE token_hash = ?').bind(await sha256Hex(token)).first<SessionRow>()
  if (!session || Date.parse(session.expires_at) <= Date.now()) return fail('UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn.', 401)
  return { adminId: session.admin_id }
}

export async function me(request: Request, env: Env) {
  const identity = await requireAdmin(request, env)
  if (identity instanceof Response) return identity
  return Response.json({ data: identity }, { headers: { 'cache-control': 'no-store' } })
}

export async function getSiteConfig(_request: Request, env: Env) {
  const row = await env.DB.prepare("SELECT value_json FROM site_settings WHERE setting_key = 'storefront'").first<SiteConfigRow>()
  if (!row) return Response.json({ data: null }, { headers: { 'cache-control': 'no-store' } })
  try {
    const data: unknown = JSON.parse(row.value_json)
    if (!data || typeof data !== 'object' || Array.isArray(data)) return fail('INVALID_SITE_CONFIG', 'Cấu hình giao diện không hợp lệ.', 500)
    return Response.json({ data }, { headers: { 'cache-control': 'no-store' } })
  } catch {
    return fail('INVALID_SITE_CONFIG', 'Cấu hình giao diện không hợp lệ.', 500)
  }
}

export async function saveSiteConfig(_request: Request, env: Env, body: Record<string, unknown> | null) {
  const candidate = body?.config
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return fail('INVALID_SITE_CONFIG', 'Cấu hình giao diện không hợp lệ.', 400)
  const input = candidate as Record<string, unknown>
  const config: Record<string, string> = {}
  for (const field of siteConfigFields) {
    const value = input[field]
    const maxLength = field === 'heroDescription' || field === 'footerDescription' ? 2000 : 500
    if (typeof value !== 'string' || value.length > maxLength) return fail('INVALID_SITE_CONFIG', 'Một hoặc nhiều nội dung giao diện không hợp lệ.', 400)
    config[field] = value.trim()
  }
  const now = new Date().toISOString()
  await env.DB.prepare("INSERT INTO site_settings (setting_key, value_json, updated_at) VALUES ('storefront', ?, ?) ON CONFLICT(setting_key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at")
    .bind(JSON.stringify(config), now).run()
  return Response.json({ data: config, updatedAt: now }, { headers: { 'cache-control': 'no-store' } })
}

export async function dashboard(request: Request, env: Env) {
  const url = new URL(request.url)
  const period = url.searchParams.get('period') ?? '30d'
  const days = period === '7d' ? 7 : period === '90d' ? 90 : period === 'all' ? 0 : 30
  const end = new Date(); const start = new Date(end)
  if (days) start.setDate(end.getDate() - days + 1)
  const from = days ? start.toISOString().slice(0, 10) : '1970-01-01'; const to = end.toISOString().slice(0, 10)
  const range = 'date(created_at) BETWEEN ? AND ?'
  const [summary, daily, statuses, categories, topProducts, topCustomers] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN status NOT IN ('completed', 'cancelled') THEN 1 ELSE 0 END) AS active, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed, COALESCE(SUM(CASE WHEN status = 'completed' THEN total_vnd ELSE 0 END), 0) AS revenue FROM orders WHERE ${range}`).bind(from, to).first<{ total: number; active: number; completed: number; revenue: number }>(),
    env.DB.prepare(`SELECT date(created_at) AS day, COUNT(*) AS orders, COALESCE(SUM(CASE WHEN status = 'completed' THEN total_vnd ELSE 0 END), 0) AS revenue FROM orders WHERE ${range} GROUP BY date(created_at) ORDER BY day`).bind(from, to).all(),
    env.DB.prepare(`SELECT status, COUNT(*) AS count FROM orders WHERE ${range} GROUP BY status ORDER BY count DESC`).bind(from, to).all(),
    env.DB.prepare(`SELECT COALESCE(CASE WHEN oi.product_id = 'filament' THEN 'Nhựa in' ELSE p.category END, 'Chưa phân loại') AS category, COALESCE(SUM(oi.unit_price_vnd * oi.quantity), 0) AS revenue, SUM(oi.quantity) AS quantity FROM order_items oi INNER JOIN orders o ON o.id = oi.order_id LEFT JOIN products p ON p.id = oi.product_id WHERE o.status = 'completed' AND date(o.created_at) BETWEEN ? AND ? GROUP BY COALESCE(CASE WHEN oi.product_id = 'filament' THEN 'Nhựa in' ELSE p.category END, 'Chưa phân loại') ORDER BY revenue DESC LIMIT 10`).bind(from, to).all(),
    env.DB.prepare(`SELECT oi.product_name_snapshot AS product, SUM(oi.quantity) AS quantity, COALESCE(SUM(oi.unit_price_vnd * oi.quantity), 0) AS revenue FROM order_items oi INNER JOIN orders o ON o.id = oi.order_id WHERE o.status = 'completed' AND date(o.created_at) BETWEEN ? AND ? GROUP BY oi.product_name_snapshot ORDER BY quantity DESC, revenue DESC LIMIT 10`).bind(from, to).all(),
    env.DB.prepare(`SELECT COALESCE(customer_name, 'Khách lẻ') AS customer, COUNT(*) AS orders, COALESCE(SUM(total_vnd), 0) AS revenue FROM orders WHERE status = 'completed' AND date(created_at) BETWEEN ? AND ? GROUP BY COALESCE(customer_id, customer_phone, customer_name) ORDER BY revenue DESC LIMIT 10`).bind(from, to).all(),
  ])
  return Response.json({ data: { period, from, to, totalOrders: Number(summary?.total ?? 0), activeOrders: Number(summary?.active ?? 0), completedOrders: Number(summary?.completed ?? 0), completedRevenueVnd: Number(summary?.revenue ?? 0), daily: daily.results, byStatus: statuses.results, byCategory: categories.results, topProducts: topProducts.results, topCustomers: topCustomers.results } })
}

export async function products(_request: Request, env: Env) {
  const result = await env.DB.prepare('SELECT p.id, p.slug, p.name, p.description, p.category, p.status, p.base_price_vnd, p.discount_percent, p.discount_ends_on, p.image_key, p.image_url, p.color_preview_url, p.filament_types, p.filament_type, p.demo_video_url, v.id AS variant_id, v.sku, c.id AS color_id, c.display_name AS color, s.id AS size_id, s.name AS size, v.price_vnd, v.stock_quantity, v.status AS variant_status, v.image_url AS variant_image_url FROM products p LEFT JOIN product_variants v ON v.product_id = p.id LEFT JOIN colors c ON c.id = v.color_id LEFT JOIN sizes s ON s.id = v.size_id ORDER BY p.created_at DESC, v.created_at ASC').all<ProductAdminRow>()
  const media = await env.DB.prepare('SELECT product_id, media_type, url, sort_order FROM product_media ORDER BY product_id, sort_order ASC').all<ProductMediaAdminRow>()
  const costs = await env.DB.prepare('SELECT id, product_id, label, cost_vnd AS costVnd, sort_order AS sortOrder, fixed_cost_item_id AS fixedCostId FROM product_cost_items ORDER BY product_id, sort_order, label').all<{ id: string; product_id: string; label: string; costVnd: number; sortOrder: number; fixedCostId: string | null }>()
  const fixedCostItems = await env.DB.prepare('SELECT id, label, cost_vnd AS costVnd, sort_order AS sortOrder FROM fixed_cost_items ORDER BY sort_order, label').all<{ id: string; label: string; costVnd: number; sortOrder: number }>()
  const mediaByProduct = new Map<string, string[]>()
  const costsByProduct = new Map<string, Array<{ id: string; label: string; costVnd: number; sortOrder: number; fixedCostId: string | null }>>()
  for (const item of media.results) if (item.media_type === 'image') mediaByProduct.set(item.product_id, [...(mediaByProduct.get(item.product_id) ?? []), item.url])
  for (const item of costs.results) costsByProduct.set(item.product_id, [...(costsByProduct.get(item.product_id) ?? []), { id: item.id, label: item.label, costVnd: item.costVnd, sortOrder: item.sortOrder, fixedCostId: item.fixedCostId }])
  const map = new Map<string, Record<string, unknown>>()
  for (const row of result.results) {
    const product = map.get(row.id) ?? { id: row.id, slug: row.slug, name: row.name, description: row.description, category: row.category, status: row.status, basePriceVnd: row.base_price_vnd, discountPercent: row.discount_percent, discountEndsOn: row.discount_ends_on, imageKey: row.image_key, imageUrl: row.image_url, imageUrls: mediaByProduct.get(row.id) ?? (row.image_url ? [row.image_url] : []), colorPreviewUrl: row.color_preview_url, filamentTypes: parseStoredFilamentTypes(row.filament_types, row.filament_type), demoVideoUrl: row.demo_video_url, costItems: costsByProduct.get(row.id) ?? [], totalCostVnd: (costsByProduct.get(row.id) ?? []).reduce((sum, item) => sum + item.costVnd, 0), variants: [] as unknown[] }
    if (row.variant_id) (product.variants as unknown[]).push({ id: row.variant_id, sku: row.sku, colorId: row.color_id, color: row.color, sizeId: row.size_id, size: row.size, priceVnd: row.price_vnd, stockQuantity: row.stock_quantity, status: row.variant_status, imageUrl: row.variant_image_url })
    map.set(row.id, product)
  }
  return Response.json({ data: [...map.values()], fixedCostItems: fixedCostItems.results })
}

export async function uploadMedia(request: Request, env: Env) {
  let form: FormData
  try { form = await request.formData() } catch { return fail('INVALID_MEDIA_FORM', 'Dữ liệu file không hợp lệ.', 400) }
  const productId = stringField(form.get('productId'), 120) ?? 'unassigned'
  const files = form.getAll('files').filter((value): value is File => value instanceof File)
  if (!files.length || files.length > 12) return fail('INVALID_MEDIA_FILES', 'Chọn từ 1 đến 12 file.', 400)
  const uploaded: Array<{ key: string; url: string; mediaType: string; name: string }> = []
  for (const file of files) {
    if (file.size <= 0 || file.size > 25 * 1024 * 1024 || !/^(image|video)\//.test(file.type)) return fail('INVALID_MEDIA_FILE', 'Chỉ nhận ảnh/video tối đa 25MB mỗi file.', 400)
    const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin'
    const key = 'products/' + productId + '/' + crypto.randomUUID() + '.' + extension
    await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type } })
    uploaded.push({ key, url: '/media/' + key, mediaType: file.type.startsWith('video/') ? 'video' : 'image', name: file.name })
  }
  return Response.json({ data: uploaded }, { status: 201 })
}

export async function uploadColorImage(request: Request, env: Env, id: string) {
  let form: FormData
  try { form = await request.formData() } catch { return fail('INVALID_COLOR_IMAGE', 'Tệp ảnh không hợp lệ.', 400) }
  const file = form.get('image')
  if (!(file instanceof File) || file.size <= 0 || file.size > 10 * 1024 * 1024 || !file.type.startsWith('image/')) return fail('INVALID_COLOR_IMAGE', 'Chọn một ảnh có dung lượng tối đa 10MB.', 400)
  const hex = stringField(form.get('hex'), 7)
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return fail('INVALID_COLOR_IMAGE', 'Không đọc được mã màu đại diện từ ảnh.', 400)
  const color = await env.DB.prepare('SELECT image_url FROM colors WHERE id = ?').bind(id).first<{ image_url: string | null }>()
  if (!color) return fail('NOT_FOUND', 'Không tìm thấy màu sắc.', 404)
  const extension = file.type.split('/')[1]?.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'img'
  const key = 'colors/' + id + '/' + crypto.randomUUID() + '.' + extension
  await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type } })
  const imageUrl = '/media/' + key
  await env.DB.prepare('UPDATE colors SET image_url = ?, hex = ?, updated_at = ? WHERE id = ?').bind(imageUrl, hex.toUpperCase(), new Date().toISOString(), id).run()
  if (color.image_url?.startsWith('/media/')) await env.MEDIA.delete(color.image_url.slice('/media/'.length))
  return Response.json({ data: { imageUrl } }, { status: 201 })
}

export async function deleteColorImage(_request: Request, env: Env, id: string) {
  const color = await env.DB.prepare('SELECT image_url FROM colors WHERE id = ?').bind(id).first<{ image_url: string | null }>()
  if (!color) return fail('NOT_FOUND', 'Không tìm thấy màu sắc.', 404)
  await env.DB.prepare('UPDATE colors SET image_url = NULL, hex = NULL, updated_at = ? WHERE id = ?').bind(new Date().toISOString(), id).run()
  if (color.image_url?.startsWith('/media/')) await env.MEDIA.delete(color.image_url.slice('/media/'.length))
  return Response.json({ data: { id, imageRemoved: true } })
}

export async function uploadVariantImage(request: Request, env: Env, id: string) {
  let form: FormData
  try { form = await request.formData() } catch { return fail('INVALID_VARIANT_IMAGE', 'Tệp ảnh không hợp lệ.', 400) }
  const file = form.get('image')
  if (!(file instanceof File) || file.size <= 0 || file.size > 25 * 1024 * 1024 || !file.type.startsWith('image/')) return fail('INVALID_VARIANT_IMAGE', 'Chọn một ảnh có dung lượng tối đa 25MB.', 400)
  const variant = await env.DB.prepare('SELECT product_id, image_url FROM product_variants WHERE id = ?').bind(id).first<{ product_id: string; image_url: string | null }>()
  if (!variant) return fail('NOT_FOUND', 'Không tìm thấy variant.', 404)
  const extension = file.type.split('/')[1]?.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'img'
  const key = 'products/' + variant.product_id + '/variants/' + id + '/' + crypto.randomUUID() + '.' + extension
  await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type } })
  const imageUrl = '/media/' + key
  const result = await env.DB.prepare('UPDATE product_variants SET image_url = ?, updated_at = ? WHERE id = ?').bind(imageUrl, new Date().toISOString(), id).run()
  if (!result.meta.changes) { await env.MEDIA.delete(key); return fail('NOT_FOUND', 'Không tìm thấy variant.', 404) }
  if (variant.image_url?.startsWith('/media/')) await env.MEDIA.delete(variant.image_url.slice('/media/'.length))
  return Response.json({ data: { id, imageUrl } }, { status: 201 })
}

export async function deleteVariantImage(_request: Request, env: Env, id: string) {
  const variant = await env.DB.prepare('SELECT image_url FROM product_variants WHERE id = ?').bind(id).first<{ image_url: string | null }>()
  if (!variant) return fail('NOT_FOUND', 'Không tìm thấy variant.', 404)
  await env.DB.prepare('UPDATE product_variants SET image_url = NULL, updated_at = ? WHERE id = ?').bind(new Date().toISOString(), id).run()
  if (variant.image_url?.startsWith('/media/')) await env.MEDIA.delete(variant.image_url.slice('/media/'.length))
  return Response.json({ data: { id, imageRemoved: true } })
}

export async function uploadProductColorPreview(request: Request, env: Env, id: string) {
  let form: FormData
  try { form = await request.formData() } catch { return fail('INVALID_COLOR_PREVIEW', 'Tệp ảnh không hợp lệ.', 400) }
  const file = form.get('image')
  if (!(file instanceof File) || file.size <= 0 || file.size > 25 * 1024 * 1024 || !file.type.startsWith('image/')) return fail('INVALID_COLOR_PREVIEW', 'Chọn một ảnh có dung lượng tối đa 25MB.', 400)
  const product = await env.DB.prepare('SELECT color_preview_url FROM products WHERE id = ?').bind(id).first<{ color_preview_url: string | null }>()
  if (!product) return fail('NOT_FOUND', 'Không tìm thấy sản phẩm.', 404)
  const extension = file.type.split('/')[1]?.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'img'
  const key = 'products/' + id + '/color-preview/' + crypto.randomUUID() + '.' + extension
  await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type } })
  const imageUrl = '/media/' + key
  const result = await env.DB.prepare('UPDATE products SET color_preview_url = ?, updated_at = ? WHERE id = ?').bind(imageUrl, new Date().toISOString(), id).run()
  if (!result.meta.changes) { await env.MEDIA.delete(key); return fail('NOT_FOUND', 'Không tìm thấy sản phẩm.', 404) }
  if (product.color_preview_url?.startsWith('/media/')) await env.MEDIA.delete(product.color_preview_url.slice('/media/'.length))
  return Response.json({ data: { id, imageUrl } }, { status: 201 })
}

export async function deleteProductColorPreview(_request: Request, env: Env, id: string) {
  const product = await env.DB.prepare('SELECT color_preview_url FROM products WHERE id = ?').bind(id).first<{ color_preview_url: string | null }>()
  if (!product) return fail('NOT_FOUND', 'Không tìm thấy sản phẩm.', 404)
  const result = await env.DB.prepare('UPDATE products SET color_preview_url = NULL, updated_at = ? WHERE id = ?').bind(new Date().toISOString(), id).run()
  if (!result.meta.changes) return fail('NOT_FOUND', 'Không tìm thấy sản phẩm.', 404)
  if (product.color_preview_url?.startsWith('/media/')) await env.MEDIA.delete(product.color_preview_url.slice('/media/'.length))
  return Response.json({ data: { id, imageRemoved: true } })
}

function slugify(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 180)
}

function imageUrlList(value: unknown) {
  if (!Array.isArray(value) || value.length > 30) return undefined
  const urls = value.map(item => typeof item === 'string' ? item.trim() : '').filter(Boolean)
  return urls.length === value.length && urls.every(url => url.length <= 2000) ? urls : undefined
}

async function resolveMasterId(env: Env, table: 'colors' | 'sizes', idValue: unknown, nameValue: unknown) {
  const requestedId = stringField(idValue, 120)
  if (requestedId) {
    const activeFilter = table === 'sizes' ? ' AND is_active = 1' : ''
    const row = await env.DB.prepare('SELECT id FROM ' + table + ' WHERE id = ?' + activeFilter).bind(requestedId).first<{ id: string }>()
    return row?.id
  }
  const name = stringField(nameValue, 80)
  if (!name) return undefined
  const nameColumn = table === 'colors' ? 'display_name' : 'name'
  const existing = await env.DB.prepare('SELECT id FROM ' + table + ' WHERE ' + nameColumn + ' = ?').bind(name).first<{ id: string }>()
  if (existing) return existing.id
  const id = crypto.randomUUID()
  const code = slugify(name).slice(0, 60) + '-' + id.slice(0, 8)
  const now = new Date().toISOString()
  if (table === 'colors') await env.DB.prepare("INSERT INTO colors (id, code, name, display_name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)").bind(id, code, '__color_' + id, name, now, now).run()
  else await env.DB.prepare('INSERT INTO sizes (id, code, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)').bind(id, code, name, now, now).run()
  return id
}

export async function masterData(_request: Request, env: Env) {
  const [colors, sizes, categories, statuses, filamentTypePrices, fixedFilamentCostItems, purchaseLotRows, purchaseBaselineRows] = await env.DB.batch([
    env.DB.prepare('SELECT id, code, display_name AS name, hex, image_url AS imageUrl, brand, filament_type AS materialType, sort_order, is_active AS isActive FROM colors ORDER BY display_name COLLATE NOCASE, filament_type COLLATE NOCASE, brand COLLATE NOCASE'),
    env.DB.prepare('SELECT id, code, name, sort_order, is_active AS isActive FROM sizes ORDER BY sort_order, name'),
    env.DB.prepare('SELECT id, code, name, sort_order, is_active AS isActive FROM product_categories ORDER BY sort_order, name'),
    env.DB.prepare('SELECT code, name, description, sort_order, is_terminal AS isTerminal, is_active AS isActive FROM order_statuses ORDER BY sort_order'),
    env.DB.prepare('SELECT material_type_key AS materialTypeKey, material_type AS materialType, price_vnd AS priceVnd, purchase_price_cny AS purchasePriceCny, exchange_rate_vnd_per_cny AS exchangeRateVndPerCny, shipping_cost_vnd AS shippingCostVnd, additional_costs_json AS additionalCostsJson, total_cost_vnd AS totalCostVnd, purchase_url AS purchaseUrl, discount_percent AS discountPercent, discount_ends_on AS discountEndsOn FROM filament_type_prices ORDER BY material_type COLLATE NOCASE'),
    env.DB.prepare('SELECT id, label, cost_vnd AS costVnd, sort_order AS sortOrder FROM fixed_filament_cost_items ORDER BY sort_order, label COLLATE NOCASE'),
    env.DB.prepare('SELECT id, material_type_key AS materialTypeKey, purchase_date AS purchaseDate, spool_count AS spoolCount, purchase_price_cny AS purchasePriceCny, exchange_rate_vnd_per_cny AS exchangeRateVndPerCny, shipping_cost_vnd AS shippingCostVnd, additional_costs_json AS additionalCostsJson, cost_items_json AS costItemsJson, fixed_cost_per_spool_vnd AS fixedCostPerSpoolVnd, unit_cost_vnd AS unitCostVnd, total_cost_vnd AS totalCostVnd, created_at AS createdAt FROM filament_purchase_lots ORDER BY purchase_date DESC, created_at DESC'),
    env.DB.prepare('SELECT id, material_type_key AS materialTypeKey, material_type AS materialType, purchase_date AS purchaseDate, purchase_price_cny AS purchasePriceCny, exchange_rate_vnd_per_cny AS exchangeRateVndPerCny, shipping_cost_vnd AS shippingCostVnd, additional_costs_json AS additionalCostsJson, fixed_costs_json AS fixedCostsJson, unit_cost_vnd AS unitCostVnd, price_vnd AS priceVnd, purchase_url AS purchaseUrl, discount_percent AS discountPercent, discount_ends_on AS discountEndsOn, created_at AS createdAt FROM filament_purchase_baselines ORDER BY material_type COLLATE NOCASE'),
  ])
  const fixedCosts = fixedFilamentCostItems.results as Array<{ id: string; label: string; costVnd: number; sortOrder: number }>
  const fixedCostsTotal = fixedCosts.reduce((sum, item) => sum + item.costVnd, 0)
  const lotsByType = new Map<string, Array<Record<string, unknown>>>()
  for (const rawLot of purchaseLotRows.results as Array<Record<string, unknown>>) {
    const lot = {
      ...rawLot,
      additionalCostItems: parseStoredFilamentCosts(String(rawLot.additionalCostsJson ?? '')).filter(item => !item.isFixed),
      costItems: parseStoredFilamentCosts(String(rawLot.costItemsJson ?? '')),
    }
    const key = String(rawLot.materialTypeKey ?? '')
    lotsByType.set(key, [...(lotsByType.get(key) ?? []), lot])
  }
  const transitions = await env.DB.prepare('SELECT from_status AS fromStatus, to_status AS toStatus FROM order_status_transitions ORDER BY from_status, to_status').all()
  const parsedFilamentPrices = filamentTypePrices.results.map(rawItem => {
    const item = rawItem as { materialTypeKey: string; materialType: string; priceVnd: number; purchasePriceCny: number; exchangeRateVndPerCny: number; shippingCostVnd: number; additionalCostsJson: string; totalCostVnd: number; purchaseUrl: string | null; discountPercent: number; discountEndsOn: string | null }
    let storedAdditionalCosts: Array<{ label: string; costVnd: number }> = []
    try {
      const parsed: unknown = JSON.parse(item.additionalCostsJson)
      if (Array.isArray(parsed)) storedAdditionalCosts = parsed.filter((cost): cost is { label: string; costVnd: number } => typeof cost === 'object' && cost !== null && !('fixedCostId' in cost) && typeof (cost as { label?: unknown }).label === 'string' && Number.isSafeInteger((cost as { costVnd?: unknown }).costVnd))
    } catch { /* Ignore malformed legacy values. */ }
    const additionalCostItems = [...fixedCosts.map(cost => ({ label: cost.label, costVnd: cost.costVnd, fixedCostId: cost.id })), ...storedAdditionalCosts]
    const purchaseLots = lotsByType.get(item.materialTypeKey) ?? []
    const hasRecordedLots = purchaseLots.length > 0
    const totalSpoolsPurchased = purchaseLots.reduce((sum, lot) => sum + Number(lot.spoolCount), 0)
    return { materialTypeKey: item.materialTypeKey, materialType: item.materialType, priceVnd: item.priceVnd, purchasePriceCny: item.purchasePriceCny, exchangeRateVndPerCny: item.exchangeRateVndPerCny, shippingCostVnd: item.shippingCostVnd, additionalCostItems, totalCostVnd: item.totalCostVnd + (hasRecordedLots ? 0 : fixedCostsTotal), purchaseUrl: item.purchaseUrl, discountPercent: item.discountPercent, discountEndsOn: item.discountEndsOn, purchaseLots, purchaseLotCount: purchaseLots.length, totalSpoolsPurchased, hasRecordedLots }
  })
  const filamentPurchaseBaselines = (purchaseBaselineRows.results as Array<Record<string, unknown>>).map(item => ({
    ...item,
    additionalCostItems: parseStoredFilamentCosts(String(item.additionalCostsJson ?? '[]')).map(({ label, costVnd }) => ({ label, costVnd })),
    fixedCostItems: parseStoredFilamentCosts(String(item.fixedCostsJson ?? '[]')).map(({ label, costVnd }) => ({ label, costVnd })),
  }))
  return Response.json({ data: { colors: colors.results, sizes: sizes.results, categories: categories.results, orderStatuses: statuses.results, orderStatusTransitions: transitions.results, filamentTypePrices: parsedFilamentPrices, filamentPurchaseBaselines, fixedFilamentCostItems: fixedCosts } })
}

export async function updateFilamentTypePrice(request: Request, env: Env, body: Record<string, unknown> | null) {
  const materialType = stringField(body?.materialType, 120)
  const priceVnd = body?.priceVnd
  const fixedCostItems = parseFixedCostItems(body?.fixedCostItems)
  const purchaseUrl = parsePurchaseUrl(body?.purchaseUrl)
  const discountPercent = parseDiscountPercent(body?.discountPercent)
  const enteredDiscountEnd = parseDiscountEndDate(body?.discountEndsOn)
  const discountEndsOn = discountPercent ? enteredDiscountEnd : null
  if (!materialType || !Number.isSafeInteger(priceVnd) || Number(priceVnd) < 0 || Number(priceVnd) > 2_000_000_000 || !fixedCostItems || fixedCostItems.length > 30 || purchaseUrl === undefined || discountPercent === undefined || enteredDiscountEnd === undefined || discountPercent > 0 && !discountEndsOn) return fail('INVALID_FILAMENT_PRICE', 'Thông tin giá bán, chi phí ghim, link mua hàng hoặc khuyến mãi theo loại nhựa không hợp lệ.', 400)

  let purchaseLot: {
    purchaseDate: string
    spoolCount: number
    purchasePriceCny: number
    exchangeRateVndPerCny: number
    shippingCostVnd: number
    additionalCostItems: Array<{ label: string; costVnd: number }>
  } | undefined
  const parsedAdditionalCosts: Array<{ label: string; costVnd: number }> = []
  if (body?.purchaseLot !== undefined) {
    if (typeof body.purchaseLot !== 'object' || body.purchaseLot === null || Array.isArray(body.purchaseLot)) return fail('INVALID_FILAMENT_LOT', 'Thông tin lô nhập không hợp lệ.', 400)
    const lot = body.purchaseLot as Record<string, unknown>
    const purchaseDate = stringField(lot.purchaseDate, 10)
    const spoolCount = lot.spoolCount
    const purchasePriceCny = lot.purchasePriceCny
    const exchangeRateVndPerCny = lot.exchangeRateVndPerCny
    const shippingCostVnd = lot.shippingCostVnd
    const additionalCostItems = lot.additionalCostItems
    if (!isValidDateOnly(purchaseDate) || !Number.isSafeInteger(spoolCount) || Number(spoolCount) < 1 || Number(spoolCount) > 1_000_000 || typeof purchasePriceCny !== 'number' || !Number.isFinite(purchasePriceCny) || purchasePriceCny < 0 || typeof exchangeRateVndPerCny !== 'number' || !Number.isFinite(exchangeRateVndPerCny) || exchangeRateVndPerCny <= 0 || !Number.isSafeInteger(shippingCostVnd) || Number(shippingCostVnd) < 0 || Number(shippingCostVnd) > 2_000_000_000 || !Array.isArray(additionalCostItems) || additionalCostItems.length > 20) return fail('INVALID_FILAMENT_LOT', 'Ngày mua, số cuộn, giá CNY, tỷ giá hoặc phí của lô không hợp lệ.', 400)
    for (const item of additionalCostItems) {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) return fail('INVALID_FILAMENT_COST', 'Khoản phí trong lô không hợp lệ.', 400)
      const record = item as Record<string, unknown>
      const label = stringField(record.label, 120)
      if (!label || !Number.isSafeInteger(record.costVnd) || Number(record.costVnd) < 0 || Number(record.costVnd) > 2_000_000_000) return fail('INVALID_FILAMENT_COST', 'Tên và số tiền phí trong lô không hợp lệ.', 400)
      parsedAdditionalCosts.push({ label, costVnd: Number(record.costVnd) })
    }
    purchaseLot = { purchaseDate, spoolCount: Number(spoolCount), purchasePriceCny, exchangeRateVndPerCny, shippingCostVnd: Number(shippingCostVnd), additionalCostItems: parsedAdditionalCosts }
  }

  const materialTypeKey = filamentTypeKey(materialType)
  const colorTypes = await env.DB.prepare('SELECT DISTINCT filament_type AS materialType FROM colors WHERE TRIM(filament_type) <> ?').bind('').all<{ materialType: string }>()
  const matchingType = colorTypes.results.find(item => filamentTypeKey(item.materialType) === materialTypeKey)
  if (!matchingType) return fail('FILAMENT_TYPE_NOT_FOUND', 'Loại nhựa này chưa được dùng trong master data màu sắc.', 404)
  const existing = await env.DB.prepare('SELECT material_type_key FROM filament_type_prices WHERE material_type_key = ?').bind(materialTypeKey).first<{ material_type_key: string }>()
  if (!purchaseLot && !existing) return fail('FILAMENT_FIRST_LOT_REQUIRED', 'Hãy ghi nhận lô mua đầu tiên để thiết lập loại nhựa này.', 400)

  const fixedCostPerSpoolVnd = fixedCostItems.reduce((sum, item) => sum + item.costVnd, 0)
  if (!Number.isSafeInteger(fixedCostPerSpoolVnd) || fixedCostPerSpoolVnd > 2_000_000_000) return fail('INVALID_FILAMENT_COST', 'Tổng chi phí ghim vượt giới hạn hợp lệ.', 400)
  const baseCostPerSpoolVnd = purchaseLot ? Math.round(purchaseLot.purchasePriceCny * purchaseLot.exchangeRateVndPerCny) + purchaseLot.shippingCostVnd + parsedAdditionalCosts.reduce((sum, item) => sum + item.costVnd, 0) : 0
  const unitCostVnd = baseCostPerSpoolVnd + fixedCostPerSpoolVnd
  const lotTotalCostVnd = purchaseLot ? unitCostVnd * purchaseLot.spoolCount : 0
  if (purchaseLot && (!Number.isSafeInteger(baseCostPerSpoolVnd) || baseCostPerSpoolVnd > 2_000_000_000 || !Number.isSafeInteger(unitCostVnd) || unitCostVnd > 2_000_000_000 || !Number.isSafeInteger(lotTotalCostVnd))) return fail('INVALID_FILAMENT_COST', 'Tổng giá vốn của lô vượt giới hạn hợp lệ.', 400)
  const now = new Date().toISOString()
  const statements = [
    env.DB.prepare('DELETE FROM fixed_filament_cost_items'),
    ...fixedCostItems.map(item => env.DB.prepare('INSERT INTO fixed_filament_cost_items (id, label, cost_vnd, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').bind(item.id, item.label, item.costVnd, item.sortOrder, now, now)),
  ]
  if (purchaseLot) {
    const costItems = [
      ...parsedAdditionalCosts.map(item => ({ ...item, isFixed: false })),
      ...fixedCostItems.map(item => ({ label: item.label, costVnd: item.costVnd, isFixed: true, fixedCostId: item.id })),
    ]
    statements.push(
      env.DB.prepare('INSERT INTO filament_type_prices (material_type_key, material_type, price_vnd, purchase_price_cny, exchange_rate_vnd_per_cny, shipping_cost_vnd, additional_costs_json, total_cost_vnd, purchase_url, discount_percent, discount_ends_on, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(material_type_key) DO UPDATE SET material_type = excluded.material_type, price_vnd = excluded.price_vnd, purchase_price_cny = excluded.purchase_price_cny, exchange_rate_vnd_per_cny = excluded.exchange_rate_vnd_per_cny, shipping_cost_vnd = excluded.shipping_cost_vnd, additional_costs_json = excluded.additional_costs_json, total_cost_vnd = excluded.total_cost_vnd, purchase_url = excluded.purchase_url, discount_percent = excluded.discount_percent, discount_ends_on = excluded.discount_ends_on, updated_at = excluded.updated_at')
        .bind(materialTypeKey, matchingType.materialType.trim(), Number(priceVnd), purchaseLot.purchasePriceCny, purchaseLot.exchangeRateVndPerCny, purchaseLot.shippingCostVnd, JSON.stringify(parsedAdditionalCosts), unitCostVnd, purchaseUrl, discountPercent, discountEndsOn, now),
      env.DB.prepare('INSERT INTO filament_purchase_lots (id, material_type_key, purchase_date, spool_count, purchase_price_cny, exchange_rate_vnd_per_cny, shipping_cost_vnd, additional_costs_json, cost_items_json, base_cost_per_spool_vnd, fixed_cost_per_spool_vnd, unit_cost_vnd, total_cost_vnd, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(crypto.randomUUID(), materialTypeKey, purchaseLot.purchaseDate, purchaseLot.spoolCount, purchaseLot.purchasePriceCny, purchaseLot.exchangeRateVndPerCny, purchaseLot.shippingCostVnd, JSON.stringify(parsedAdditionalCosts), JSON.stringify(costItems), baseCostPerSpoolVnd, fixedCostPerSpoolVnd, unitCostVnd, lotTotalCostVnd, now),
      env.DB.prepare('UPDATE filament_type_prices SET total_cost_vnd = (SELECT CAST(ROUND(SUM(unit_cost_vnd * spool_count) * 1.0 / SUM(spool_count)) AS INTEGER) FROM filament_purchase_lots WHERE material_type_key = ?) WHERE material_type_key = ?')
        .bind(materialTypeKey, materialTypeKey),
    )
  } else {
    statements.push(env.DB.prepare('UPDATE filament_type_prices SET material_type = ?, price_vnd = ?, purchase_url = ?, discount_percent = ?, discount_ends_on = ?, updated_at = ? WHERE material_type_key = ?')
      .bind(matchingType.materialType.trim(), Number(priceVnd), purchaseUrl, discountPercent, discountEndsOn, now, materialTypeKey))
  }
  await env.DB.batch(statements)
  return Response.json({ data: { materialType: matchingType.materialType.trim(), priceVnd: Number(priceVnd), purchaseLotAdded: Boolean(purchaseLot), purchaseUrl, discountPercent, discountEndsOn, updatedAt: now } })
}

export async function createFilamentPurchaseBatch(_request: Request, env: Env, body: Record<string, unknown> | null) {
  const purchaseDate = stringField(body?.purchaseDate, 10)
  const rawEntries = body?.entries
  if (!isValidDateOnly(purchaseDate) || !Array.isArray(rawEntries) || rawEntries.length < 1 || rawEntries.length > 100) return fail('INVALID_FILAMENT_BATCH', 'Chọn ngày hợp lệ và ít nhất một loại nhựa cho đợt nhập.', 400)

  const seenTypes = new Set<string>()
  const entries: Array<{ materialType: string; materialTypeKey: string; spoolCount: number; purchasePriceCny: number; exchangeRateVndPerCny: number; shippingCostVnd: number; additionalCostItems: Array<{ label: string; costVnd: number }> }> = []
  for (const value of rawEntries) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return fail('INVALID_FILAMENT_BATCH', 'Thông tin một loại nhựa trong đợt không hợp lệ.', 400)
    const row = value as Record<string, unknown>
    const materialType = stringField(row.materialType, 120)
    const materialTypeKey = materialType ? filamentTypeKey(materialType) : ''
    const spoolCount = row.spoolCount
    const purchasePriceCny = row.purchasePriceCny
    const exchangeRateVndPerCny = row.exchangeRateVndPerCny
    const shippingCostVnd = row.shippingCostVnd
    const rawCosts = row.additionalCostItems
    if (!materialType || seenTypes.has(materialTypeKey) || !Number.isSafeInteger(spoolCount) || Number(spoolCount) < 1 || Number(spoolCount) > 1_000_000 || typeof purchasePriceCny !== 'number' || !Number.isFinite(purchasePriceCny) || purchasePriceCny < 0 || typeof exchangeRateVndPerCny !== 'number' || !Number.isFinite(exchangeRateVndPerCny) || exchangeRateVndPerCny <= 0 || !Number.isSafeInteger(shippingCostVnd) || Number(shippingCostVnd) < 0 || Number(shippingCostVnd) > 2_000_000_000 || !Array.isArray(rawCosts) || rawCosts.length > 20) return fail('INVALID_FILAMENT_BATCH_ENTRY', 'Kiểm tra loại nhựa, số cuộn, giá CNY, tỷ giá và các khoản phí trong đợt.', 400)
    const additionalCostItems: Array<{ label: string; costVnd: number }> = []
    for (const cost of rawCosts) {
      if (typeof cost !== 'object' || cost === null || Array.isArray(cost)) return fail('INVALID_FILAMENT_COST', 'Khoản phí trong lô không hợp lệ.', 400)
      const costRow = cost as Record<string, unknown>
      const label = stringField(costRow.label, 120)
      const costVnd = costRow.costVnd
      if (!label || !Number.isSafeInteger(costVnd) || Number(costVnd) < 0 || Number(costVnd) > 2_000_000_000) return fail('INVALID_FILAMENT_COST', 'Tên và số tiền phí trong lô không hợp lệ.', 400)
      additionalCostItems.push({ label, costVnd: Number(costVnd) })
    }
    seenTypes.add(materialTypeKey)
    entries.push({ materialType, materialTypeKey, spoolCount: Number(spoolCount), purchasePriceCny, exchangeRateVndPerCny, shippingCostVnd: Number(shippingCostVnd), additionalCostItems })
  }

  const [colorTypes, configuredTypes, fixedCostRows] = await env.DB.batch([
    env.DB.prepare('SELECT DISTINCT filament_type AS materialType FROM colors WHERE TRIM(filament_type) <> ?').bind(''),
    env.DB.prepare('SELECT material_type_key AS materialTypeKey, material_type AS materialType FROM filament_type_prices'),
    env.DB.prepare('SELECT id, label, cost_vnd AS costVnd FROM fixed_filament_cost_items ORDER BY sort_order, label COLLATE NOCASE'),
  ])
  const colorTypeByKey = new Map((colorTypes.results as Array<{ materialType: string }>).map(item => [filamentTypeKey(item.materialType), item.materialType.trim()]))
  const configuredKeys = new Set((configuredTypes.results as Array<{ materialTypeKey: string }>).map(item => item.materialTypeKey))
  const fixedCosts = fixedCostRows.results as Array<{ id: string; label: string; costVnd: number }>
  const fixedCostPerSpoolVnd = fixedCosts.reduce((sum, item) => sum + Number(item.costVnd), 0)
  if (!Number.isSafeInteger(fixedCostPerSpoolVnd) || fixedCostPerSpoolVnd > 2_000_000_000) return fail('INVALID_FILAMENT_COST', 'Tổng chi phí ghim vượt giới hạn hợp lệ.', 400)

  const statements: D1PreparedStatement[] = []
  const now = new Date().toISOString()
  for (const entry of entries) {
    const canonicalType = colorTypeByKey.get(entry.materialTypeKey)
    if (!canonicalType || !configuredKeys.has(entry.materialTypeKey)) return fail('FILAMENT_TYPE_NOT_CONFIGURED', `Loại nhựa ${entry.materialType} chưa được thiết lập giá bán.`, 400)
    const duplicate = await env.DB.prepare('SELECT id FROM filament_purchase_lots WHERE material_type_key = ? AND purchase_date = ? LIMIT 1').bind(entry.materialTypeKey, purchaseDate).first<{ id: string }>()
    if (duplicate) return fail('FILAMENT_BATCH_ENTRY_EXISTS', `${canonicalType} đã có trong đợt ngày ${purchaseDate}. Chọn ngày khác hoặc bỏ chọn loại này.`, 409)
    const additionalCostVnd = entry.additionalCostItems.reduce((sum, item) => sum + item.costVnd, 0)
    const baseCostPerSpoolVnd = Math.round(entry.purchasePriceCny * entry.exchangeRateVndPerCny) + entry.shippingCostVnd + additionalCostVnd
    const unitCostVnd = baseCostPerSpoolVnd + fixedCostPerSpoolVnd
    const totalCostVnd = unitCostVnd * entry.spoolCount
    if (!Number.isSafeInteger(baseCostPerSpoolVnd) || baseCostPerSpoolVnd > 2_000_000_000 || !Number.isSafeInteger(unitCostVnd) || unitCostVnd > 2_000_000_000 || !Number.isSafeInteger(totalCostVnd)) return fail('INVALID_FILAMENT_COST', `Tổng giá vốn của ${canonicalType} vượt giới hạn hợp lệ.`, 400)
    const costItems = [
      ...entry.additionalCostItems.map(item => ({ ...item, isFixed: false })),
      ...fixedCosts.map(item => ({ label: item.label, costVnd: Number(item.costVnd), isFixed: true, fixedCostId: item.id })),
    ]
    statements.push(
      env.DB.prepare('INSERT INTO filament_purchase_lots (id, material_type_key, purchase_date, spool_count, purchase_price_cny, exchange_rate_vnd_per_cny, shipping_cost_vnd, additional_costs_json, cost_items_json, base_cost_per_spool_vnd, fixed_cost_per_spool_vnd, unit_cost_vnd, total_cost_vnd, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(crypto.randomUUID(), entry.materialTypeKey, purchaseDate, entry.spoolCount, entry.purchasePriceCny, entry.exchangeRateVndPerCny, entry.shippingCostVnd, JSON.stringify(entry.additionalCostItems), JSON.stringify(costItems), baseCostPerSpoolVnd, fixedCostPerSpoolVnd, unitCostVnd, totalCostVnd, now),
      env.DB.prepare('UPDATE filament_type_prices SET material_type = ?, purchase_price_cny = ?, exchange_rate_vnd_per_cny = ?, shipping_cost_vnd = ?, additional_costs_json = ?, total_cost_vnd = (SELECT CAST(ROUND(SUM(unit_cost_vnd * spool_count) * 1.0 / SUM(spool_count)) AS INTEGER) FROM filament_purchase_lots WHERE material_type_key = ?) WHERE material_type_key = ?')
        .bind(canonicalType, entry.purchasePriceCny, entry.exchangeRateVndPerCny, entry.shippingCostVnd, JSON.stringify(entry.additionalCostItems), entry.materialTypeKey, entry.materialTypeKey),
    )
  }
  await env.DB.batch(statements)
  return Response.json({ data: { purchaseDate, entryCount: entries.length, materialTypes: entries.map(item => colorTypeByKey.get(item.materialTypeKey)) } })
}

export async function masterDataCrud(request: Request, env: Env, kind: string, id?: string) {
  const config = {
    categories: { table: 'product_categories', idColumn: 'id' },
    colors: { table: 'colors', idColumn: 'id' },
    sizes: { table: 'sizes', idColumn: 'id' },
    statuses: { table: 'order_statuses', idColumn: 'code' },
  }[kind as 'categories' | 'colors' | 'sizes' | 'statuses']
  if (!config) return fail('INVALID_MASTER_TYPE', 'Loại master data không hợp lệ.', 400)
  if (request.method === 'DELETE' && id) {
    const references = kind === 'colors' ? await env.DB.prepare('SELECT COUNT(*) AS count FROM product_variants WHERE color_id = ?').bind(id).first<{ count: number }>() : kind === 'sizes' ? await env.DB.prepare('SELECT COUNT(*) AS count FROM product_variants WHERE size_id = ?').bind(id).first<{ count: number }>() : kind === 'statuses' ? await env.DB.prepare('SELECT (SELECT COUNT(*) FROM orders WHERE status = ?) + (SELECT COUNT(*) FROM order_status_transitions WHERE from_status = ? OR to_status = ?) AS count').bind(id, id, id).first<{ count: number }>() : await env.DB.prepare('SELECT COUNT(*) AS count FROM products WHERE category = (SELECT name FROM product_categories WHERE id = ?)').bind(id).first<{ count: number }>()
    if (references && references.count > 0) return fail('MASTER_IN_USE', 'Không thể xóa dữ liệu master đang được sử dụng.', 409)
    const result = await env.DB.prepare('DELETE FROM ' + config.table + ' WHERE ' + config.idColumn + ' = ?').bind(id).run()
    if (!result.meta.changes) return fail('NOT_FOUND', 'Không tìm thấy dữ liệu master.', 404)

    return Response.json({ data: { id, deleted: true } })
  }
  const body = await bodyRecord(request)
  if (!body) return fail('INVALID_PAYLOAD', 'Payload không hợp lệ.', 400)
  const name = stringField(body.name, 120)
  const code = stringField(body.code, 120) ?? (kind === 'colors' ? 'color-' + crypto.randomUUID().slice(0, 8) : undefined)
  const hex = body.hex === null || body.hex === undefined ? null : stringField(body.hex, 20)
  const brand = body.brand === undefined ? undefined : body.brand === null || typeof body.brand === 'string' && !body.brand.trim() ? null : stringField(body.brand, 120)
  const materialType = body.materialType === undefined ? (request.method === 'POST' ? 'unclassified' : undefined) : stringField(body.materialType, 80)
  const description = body.description === null || body.description === undefined ? null : stringField(body.description, 300)
  const sortOrder = kind === 'colors' ? 0 : body.sortOrder === undefined ? 0 : (Number.isInteger(body.sortOrder) ? Number(body.sortOrder) : undefined)
  const active = body.isActive === undefined ? 1 : (body.isActive ? 1 : 0)
  if (sortOrder === undefined || body.brand !== undefined && brand === undefined || body.hex !== undefined && body.hex !== null && body.hex !== '' && (!hex || !/^#[0-9a-f]{6}$/i.test(hex))) return fail('INVALID_MASTER', 'Thứ tự, hãng hoặc màu HEX không hợp lệ.', 400)
  if (request.method === 'POST') {
    const newId = kind === 'statuses' ? code : crypto.randomUUID()
    if (!name || !code || kind === 'colors' && !materialType) return fail('INVALID_MASTER', kind === 'colors' ? 'Cần nhập tên và loại nhựa cho màu.' : 'Cần nhập mã và tên.', 400)
    try {
      if (kind === 'statuses') await env.DB.prepare('INSERT INTO order_statuses (code, name, description, sort_order, is_terminal, is_active) VALUES (?, ?, ?, ?, ?, ?)').bind(newId, name, description, sortOrder, body.isTerminal ? 1 : 0, active).run()
      else if (kind === 'colors') await env.DB.prepare("INSERT INTO colors (id, code, name, display_name, hex, brand, filament_type, sort_order, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(newId, code, '__color_' + newId, name, hex, brand ?? '', materialType, sortOrder, active, new Date().toISOString(), new Date().toISOString()).run()
      else if (kind === 'sizes') await env.DB.prepare('INSERT INTO sizes (id, code, name, sort_order, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(newId, code, name, sortOrder, active, new Date().toISOString(), new Date().toISOString()).run()
      else await env.DB.prepare('INSERT INTO product_categories (id, code, name, sort_order, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(newId, code, name, sortOrder, active, new Date().toISOString(), new Date().toISOString()).run()
    } catch { return fail('MASTER_DUPLICATE', 'Mã hoặc tên master đã tồn tại.', 409) }
    return Response.json({ data: { id: newId } }, { status: 201 })
  }
  if (request.method === 'PATCH' && id) {
    if (!name) return fail('INVALID_MASTER', 'Tên không hợp lệ.', 400)
    try {
      if (kind === 'statuses') await env.DB.prepare('UPDATE order_statuses SET name = ?, description = ?, sort_order = ?, is_terminal = ?, is_active = ? WHERE code = ?').bind(name, description, sortOrder, body.isTerminal ? 1 : 0, active, id).run()
      else if (kind === 'colors') {
        if (!name || body.materialType !== undefined && !materialType) return fail('INVALID_MASTER', 'Tên màu, hãng hoặc loại nhựa không hợp lệ.', 400)
        if (materialType !== undefined && brand !== undefined) await env.DB.prepare('UPDATE colors SET display_name = ?, hex = ?, brand = ?, filament_type = ?, sort_order = ?, is_active = ?, updated_at = ? WHERE id = ?').bind(name, hex, brand ?? '', materialType, sortOrder, active, new Date().toISOString(), id).run()
        else if (materialType !== undefined) await env.DB.prepare('UPDATE colors SET display_name = ?, hex = ?, filament_type = ?, sort_order = ?, is_active = ?, updated_at = ? WHERE id = ?').bind(name, hex, materialType, sortOrder, active, new Date().toISOString(), id).run()
        else if (brand !== undefined) await env.DB.prepare('UPDATE colors SET display_name = ?, hex = ?, brand = ?, sort_order = ?, is_active = ?, updated_at = ? WHERE id = ?').bind(name, hex, brand ?? '', sortOrder, active, new Date().toISOString(), id).run()
        else await env.DB.prepare('UPDATE colors SET display_name = ?, hex = ?, sort_order = ?, is_active = ?, updated_at = ? WHERE id = ?').bind(name, hex, sortOrder, active, new Date().toISOString(), id).run()
      }
      else if (kind === 'sizes') await env.DB.prepare('UPDATE sizes SET name = ?, sort_order = ?, is_active = ?, updated_at = ? WHERE id = ?').bind(name, sortOrder, active, new Date().toISOString(), id).run()
      else await env.DB.prepare('UPDATE product_categories SET name = ?, sort_order = ?, is_active = ?, updated_at = ? WHERE id = ?').bind(name, sortOrder, active, new Date().toISOString(), id).run()
    } catch { return fail('MASTER_DUPLICATE', 'Tên master đã tồn tại.', 409) }
    return Response.json({ data: { id, updated: true } })
  }
  return fail('INVALID_MASTER_METHOD', 'Phương thức master data không hợp lệ.', 405)
}

type ParsedProductCostItem = { label: string; costVnd: number; fixedCostId: string | null }
type ParsedFixedCostItem = { id: string; label: string; costVnd: number; sortOrder: number }

function validCostId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function parseProductCostItems(value: unknown): ParsedProductCostItem[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.length > 30) return undefined
  const parsed = value.map(item => {
    if (!item || typeof item !== 'object') return undefined
    const row = item as Record<string, unknown>
    const label = stringField(row.label, 100)
    const costVnd = Number.isSafeInteger(row.costVnd) && Number(row.costVnd) >= 0 && Number(row.costVnd) <= 2_000_000_000 ? Number(row.costVnd) : undefined
    const fixedCostId = row.fixedCostId === undefined || row.fixedCostId === null || row.fixedCostId === '' ? null : validCostId(row.fixedCostId) ? row.fixedCostId : undefined
    return label && costVnd !== undefined && fixedCostId !== undefined ? { label, costVnd, fixedCostId } : undefined
  })
  return parsed.every((item): item is ParsedProductCostItem => Boolean(item)) ? parsed as ParsedProductCostItem[] : undefined
}

function parseFixedCostItems(value: unknown): ParsedFixedCostItem[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.length > 30) return undefined
  const ids = new Set<string>()
  const parsed = value.map((item, sortOrder) => {
    if (!item || typeof item !== 'object') return undefined
    const row = item as Record<string, unknown>
    const label = stringField(row.label, 100)
    const costVnd = Number.isSafeInteger(row.costVnd) && Number(row.costVnd) >= 0 && Number(row.costVnd) <= 2_000_000_000 ? Number(row.costVnd) : undefined
    if (!validCostId(row.id) || ids.has(row.id) || !label || costVnd === undefined) return undefined
    ids.add(row.id)
    return { id: row.id, label, costVnd, sortOrder }
  })
  return parsed.every((item): item is ParsedFixedCostItem => Boolean(item)) ? parsed as ParsedFixedCostItem[] : undefined
}

function fixedCostStatements(env: Env, items: ParsedFixedCostItem[], now: string) {
  return [
    env.DB.prepare('DELETE FROM fixed_cost_items'),
    ...items.map(item => env.DB.prepare('INSERT INTO fixed_cost_items (id, label, cost_vnd, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').bind(item.id, item.label, item.costVnd, item.sortOrder, now, now)),
  ]
}

function parseProductFilamentTypes(body: Record<string, unknown>): string[] | undefined {
  if (body.filamentTypes !== undefined) return parseFilamentTypesInput(body.filamentTypes)
  if (body.filamentType === undefined || body.filamentType === null || body.filamentType === '') return []
  const legacyType = stringField(body.filamentType, 80)
  return legacyType ? [legacyType] : undefined
}

async function hasColorGroups(env: Env, filamentTypes: string[]) {
  if (!filamentTypes.length) return true
  const placeholders = filamentTypes.map(() => '?').join(', ')
  const groups = await env.DB.prepare('SELECT DISTINCT filament_type FROM colors WHERE filament_type IN (' + placeholders + ')').bind(...filamentTypes).all<{ filament_type: string }>()
  const found = new Set(groups.results.map(item => item.filament_type))
  return filamentTypes.every(type => found.has(type))
}

export async function createProduct(request: Request, env: Env) {
  const body = await bodyRecord(request)
  const name = stringField(body?.name, 200)
  const description = typeof body?.description === 'string' && body.description.length <= 2000 ? body.description.trim() : undefined
  const category = body?.category === null ? null : stringField(body?.category, 80)
  const status = body?.status === 'active' ? 'active' : body?.status === 'archived' ? 'archived' : body?.status === 'draft' || body?.status === undefined ? 'draft' : undefined
  const price = Number.isInteger(body?.basePriceVnd) && Number(body?.basePriceVnd) >= 0 ? Number(body?.basePriceVnd) : undefined
  const discountPercent = body?.discountPercent === undefined ? 0 : parseDiscountPercent(body.discountPercent)
  const enteredDiscountEnd = body?.discountEndsOn === undefined ? null : parseDiscountEndDate(body.discountEndsOn)
  const discountEndsOn = discountPercent ? enteredDiscountEnd : null
  const imageUrl = body?.imageUrl === '' || body?.imageUrl === null ? null : (body?.imageUrl === undefined ? null : stringField(body.imageUrl, 2000))
  const imageUrls = body?.imageUrls === undefined ? (imageUrl ? [imageUrl] : []) : imageUrlList(body.imageUrls)
  const demoVideoUrl = body?.demoVideoUrl === '' || body?.demoVideoUrl === null ? null : (body?.demoVideoUrl === undefined ? null : stringField(body.demoVideoUrl, 2000))
  const hasFilamentTypes = body?.filamentTypes !== undefined || body?.filamentType !== undefined
  const filamentTypes = body ? parseProductFilamentTypes(body) : []
  const costItems = parseProductCostItems(body?.costItems)
  const fixedCostItems = parseFixedCostItems(body?.fixedCostItems)
  if (!body || !name || description === undefined || body.category !== undefined && body.category !== null && !category || !status || price === undefined || discountPercent === undefined || enteredDiscountEnd === undefined || discountPercent > 0 && !discountEndsOn || body.imageUrl !== undefined && body.imageUrl !== '' && body.imageUrl !== null && !imageUrl || body.demoVideoUrl !== undefined && body.demoVideoUrl !== '' && body.demoVideoUrl !== null && !demoVideoUrl || hasFilamentTypes && (!filamentTypes || body.filamentTypes !== undefined && !filamentTypes.length) || body.costItems !== undefined && !costItems || body.fixedCostItems !== undefined && !fixedCostItems || fixedCostItems && costItems?.some(item => item.fixedCostId && !fixedCostItems.some(fixed => fixed.id === item.fixedCostId))) return fail('INVALID_PRODUCT', 'Dữ liệu sản phẩm hoặc khuyến mãi không hợp lệ.', 400)
  if (filamentTypes?.length && !await hasColorGroups(env, filamentTypes)) return fail('INVALID_FILAMENT_TYPE', 'Một hoặc nhiều loại nhựa chưa có màu trong master data.', 400)
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const slug = slugify(stringField(body.slug, 200) ?? name) + '-' + id.slice(0, 8)
  await env.DB.batch([
    env.DB.prepare('INSERT INTO products (id, slug, name, description, category, status, base_price_vnd, discount_percent, discount_ends_on, image_url, demo_video_url, filament_type, filament_types, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, slug, name, description, category ?? null, status, price, discountPercent, discountEndsOn, imageUrls?.[0] ?? null, demoVideoUrl, filamentTypes?.[0] ?? null, JSON.stringify(filamentTypes ?? []), now, now),
    ...((imageUrls ?? []).map((url, index) => env.DB.prepare('INSERT INTO product_media (id, product_id, media_type, url, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), id, 'image', url, index, now))),
    ...(costItems ?? []).map((item, index) => env.DB.prepare('INSERT INTO product_cost_items (id, product_id, label, cost_vnd, sort_order, fixed_cost_item_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), id, item.label, item.costVnd, index, item.fixedCostId, now, now)),
    ...(fixedCostItems === undefined ? [] : fixedCostStatements(env, fixedCostItems, now)),
  ])
  return Response.json({ data: { id, slug } }, { status: 201 })
}

export async function createVariant(request: Request, env: Env, productId: string) {
  const body = await bodyRecord(request)
  const sku = stringField(body?.sku, 120)
  const colorId = await resolveMasterId(env, 'colors', body?.colorId, body?.color)
  const sizeId = await resolveMasterId(env, 'sizes', body?.sizeId, body?.size)
  const color = colorId
  const size = sizeId
  const price = body?.priceVnd === '' || body?.priceVnd === null || body?.priceVnd === undefined ? null : (Number.isInteger(body.priceVnd) && Number(body.priceVnd) >= 0 ? Number(body.priceVnd) : undefined)
  const status = body?.status === 'draft' ? 'draft' : body?.status === 'archived' ? 'archived' : body?.status === 'active' || body?.status === undefined ? 'active' : undefined
  if (!body || !sku || !color || !size || price === undefined || !status) return fail('INVALID_VARIANT', 'Dữ liệu biến thể không hợp lệ.', 400)
  const exists = await env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(productId).first<{ id: string }>()
  if (!exists) return fail('NOT_FOUND', 'Không tìm thấy sản phẩm.', 404)
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await env.DB.prepare('INSERT INTO product_variants (id, product_id, color_id, size_id, sku, price_vnd, stock_quantity, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, productId, colorId, sizeId, sku, price, 0, status, now, now).run()
  return Response.json({ data: { id } }, { status: 201 })
}

export async function updateProduct(request: Request, env: Env, id: string) {
  const body = await bodyRecord(request)
  if (!body) return fail('INVALID_PAYLOAD', 'Payload không hợp lệ.', 400)
  const fields: string[] = []
  const values: (string | number | null)[] = []
  const name = body.name === undefined ? undefined : stringField(body.name, 200)
  const description = body.description === undefined ? undefined : (body.description === '' ? '' : stringField(body.description, 2000))
  const category = body.category === null ? null : (body.category === undefined ? undefined : stringField(body.category, 80))
  const status = body.status === undefined ? undefined : (body.status === 'draft' || body.status === 'active' || body.status === 'archived' ? body.status : undefined)
  const price = body.basePriceVnd === undefined ? undefined : (Number.isInteger(body.basePriceVnd) && Number(body.basePriceVnd) >= 0 ? Number(body.basePriceVnd) : undefined)
  const hasDiscount = body.discountPercent !== undefined || body.discountEndsOn !== undefined
  const discountPercent = hasDiscount ? parseDiscountPercent(body.discountPercent) : undefined
  const enteredDiscountEnd = hasDiscount ? parseDiscountEndDate(body.discountEndsOn) : undefined
  const discountEndsOn = discountPercent ? enteredDiscountEnd : null
  const imageUrl = body.imageUrl === null || body.imageUrl === '' ? null : (body.imageUrl === undefined ? undefined : stringField(body.imageUrl, 2000))
  const imageUrls = body.imageUrls === undefined ? (body.imageUrl === undefined ? undefined : imageUrl ? [imageUrl] : []) : imageUrlList(body.imageUrls)
  const demoVideoUrl = body.demoVideoUrl === null || body.demoVideoUrl === '' ? null : (body.demoVideoUrl === undefined ? undefined : stringField(body.demoVideoUrl, 2000))
  const hasFilamentTypes = body.filamentTypes !== undefined || body.filamentType !== undefined
  const filamentTypes = hasFilamentTypes ? parseProductFilamentTypes(body) : undefined
  const costItems = parseProductCostItems(body?.costItems)
  const fixedCostItems = parseFixedCostItems(body.fixedCostItems)
  if (body.name !== undefined && !name || body.description !== undefined && description === undefined || body.category !== undefined && body.category !== null && !category || body.status !== undefined && !status || body.basePriceVnd !== undefined && price === undefined || hasDiscount && (discountPercent === undefined || enteredDiscountEnd === undefined || discountPercent > 0 && !discountEndsOn) || body.imageUrl !== undefined && body.imageUrl !== null && body.imageUrl !== '' && !imageUrl || body.demoVideoUrl !== undefined && body.demoVideoUrl !== null && body.demoVideoUrl !== '' && !demoVideoUrl || hasFilamentTypes && (!filamentTypes || body.filamentTypes !== undefined && !filamentTypes.length) || body.costItems !== undefined && !costItems || body.fixedCostItems !== undefined && !fixedCostItems || fixedCostItems && costItems?.some(item => item.fixedCostId && !fixedCostItems.some(fixed => fixed.id === item.fixedCostId))) return fail('INVALID_PRODUCT', 'Dữ liệu sản phẩm hoặc khuyến mãi không hợp lệ.', 400)
  if (filamentTypes?.length && !await hasColorGroups(env, filamentTypes)) return fail('INVALID_FILAMENT_TYPE', 'Một hoặc nhiều loại nhựa chưa có màu trong master data.', 400)
  if (name !== undefined) { fields.push('name = ?'); values.push(name) }
  if (description !== undefined) { fields.push('description = ?'); values.push(description) }
  if (body.category !== undefined) { fields.push('category = ?'); values.push(category ?? null) }
  if (status !== undefined) { fields.push('status = ?'); values.push(status) }
  if (price !== undefined) { fields.push('base_price_vnd = ?'); values.push(price) }
  if (hasDiscount) { fields.push('discount_percent = ?'); values.push(discountPercent!); fields.push('discount_ends_on = ?'); values.push(discountEndsOn ?? null) }
  if (body.imageUrl !== undefined || body.imageUrls !== undefined) { fields.push('image_url = ?'); values.push(imageUrls?.[0] ?? null) }
  if (body.demoVideoUrl !== undefined) { fields.push('demo_video_url = ?'); values.push(demoVideoUrl ?? null) }
  if (filamentTypes !== undefined) { fields.push('filament_type = ?'); values.push(filamentTypes[0] ?? null); fields.push('filament_types = ?'); values.push(JSON.stringify(filamentTypes)) }
  if (!fields.length && costItems === undefined && fixedCostItems === undefined) return fail('NO_CHANGES', 'Không có field cần cập nhật.', 400)
  fields.push('updated_at = ?'); values.push(new Date().toISOString()); values.push(id)
  const result = await env.DB.prepare('UPDATE products SET ' + fields.join(', ') + ' WHERE id = ?').bind(...values).run()
  if (imageUrls !== undefined) {
    await env.DB.prepare('DELETE FROM product_media WHERE product_id = ? AND media_type = ?').bind(id, 'image').run()
    await env.DB.batch(imageUrls.map((url, index) => env.DB.prepare('INSERT INTO product_media (id, product_id, media_type, url, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), id, 'image', url, index, new Date().toISOString())))
  }
  if (!result.meta.changes) return fail('NOT_FOUND', 'Không tìm thấy sản phẩm.', 404)
  if (costItems !== undefined || fixedCostItems !== undefined) {
    const now = new Date().toISOString()
    const statements = [
      ...(costItems === undefined ? [] : [env.DB.prepare('DELETE FROM product_cost_items WHERE product_id = ?').bind(id), ...costItems.map((item, index) => env.DB.prepare('INSERT INTO product_cost_items (id, product_id, label, cost_vnd, sort_order, fixed_cost_item_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), id, item.label, item.costVnd, index, item.fixedCostId, now, now))]),
      ...(fixedCostItems === undefined ? [] : fixedCostStatements(env, fixedCostItems, now)),
    ]
    await env.DB.batch(statements)
  }
  return Response.json({ data: { id, updated: true } })
}

export async function deleteProduct(_request: Request, env: Env, id: string) {
  const references = await env.DB.prepare('SELECT COUNT(*) AS count FROM order_items WHERE product_id = ?').bind(id).first<{ count: number }>()
  if (Number(references?.count ?? 0) > 0) return fail('PRODUCT_HAS_ORDERS', 'Sản phẩm đã có trong đơn hàng nên không thể xóa để bảo toàn lịch sử.', 409)
  const variantImages = await env.DB.prepare('SELECT image_url FROM product_variants WHERE product_id = ? AND image_url IS NOT NULL').bind(id).all<{ image_url: string }>()
  const colorPreview = await env.DB.prepare('SELECT color_preview_url FROM products WHERE id = ?').bind(id).first<{ color_preview_url: string | null }>()
  const result = await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run()
  if (!result.meta.changes) return fail('NOT_FOUND', 'Không tìm thấy sản phẩm.', 404)
  await Promise.allSettled(variantImages.results.filter(item => item.image_url.startsWith('/media/')).map(item => env.MEDIA.delete(item.image_url.slice('/media/'.length))))
  if (colorPreview?.color_preview_url?.startsWith('/media/')) await env.MEDIA.delete(colorPreview.color_preview_url.slice('/media/'.length))
  return Response.json({ data: { id, deleted: true } })
}

export async function updateVariant(request: Request, env: Env, id: string) {
  const body = await bodyRecord(request)
  if (!body) return fail('INVALID_PAYLOAD', 'Payload không hợp lệ.', 400)
  const current = await env.DB.prepare('SELECT id FROM product_variants WHERE id = ?').bind(id).first<{ id: string }>()
  if (!current) return fail('NOT_FOUND', 'Không tìm thấy variant.', 404)
  const fields: string[] = []
  const values: (string | number | null)[] = []
  const price = body.priceVnd === null ? null : (body.priceVnd === undefined ? undefined : (Number.isInteger(body.priceVnd) && Number(body.priceVnd) >= 0 ? Number(body.priceVnd) : undefined))
  const status = body.status === undefined ? undefined : (body.status === 'draft' || body.status === 'active' || body.status === 'archived' ? body.status : undefined)
  const sku = body.sku === undefined ? undefined : stringField(body.sku, 120)
  const colorId = body.colorId === undefined && body.color === undefined ? undefined : await resolveMasterId(env, 'colors', body.colorId, body.color)
  const sizeId = body.sizeId === undefined && body.size === undefined ? undefined : await resolveMasterId(env, 'sizes', body.sizeId, body.size)
  const color = colorId
  const size = sizeId
  if (body.priceVnd !== undefined && body.priceVnd !== null && price === undefined || body.status !== undefined && !status || body.sku !== undefined && !sku || body.color !== undefined && !color || body.size !== undefined && !size) return fail('INVALID_VARIANT', 'Dữ liệu variant không hợp lệ.', 400)
  if (price !== undefined || body.priceVnd === null) { fields.push('price_vnd = ?'); values.push(price ?? null) }
  if (status !== undefined) { fields.push('status = ?'); values.push(status) }
  if (sku !== undefined) { fields.push('sku = ?'); values.push(sku) }
  if (colorId !== undefined) { fields.push('color_id = ?'); values.push(colorId) }
  if (sizeId !== undefined) { fields.push('size_id = ?'); values.push(sizeId) }
  if (!fields.length) return fail('NO_CHANGES', 'Không có field cần cập nhật.', 400)
  fields.push('updated_at = ?'); values.push(new Date().toISOString()); values.push(id)
  const result = await env.DB.prepare('UPDATE product_variants SET ' + fields.join(', ') + ' WHERE id = ?').bind(...values).run()
  if (!result.meta.changes) return fail('NOT_FOUND', 'Không tìm thấy variant.', 404)
  return Response.json({ data: { id, updated: true } })
}

export async function orders(_request: Request, env: Env) {
  const result = await env.DB.prepare("SELECT o.id, o.order_code, o.customer_name, o.customer_phone, o.shipping_address, o.note, o.status, o.subtotal_vnd, o.shipping_fee_vnd, o.total_vnd, o.created_at, o.updated_at, COALESCE((SELECT GROUP_CONCAT(i.product_name_snapshot || ' · ' || i.color_snapshot || ' · ' || i.size_snapshot || ' × ' || i.quantity, char(10)) FROM order_items i WHERE i.order_id = o.id), '') AS items_summary FROM orders o ORDER BY o.created_at DESC LIMIT 100").all<OrderAdminRow>()
  return Response.json({ data: result.results })
}

export async function customers(request: Request, env: Env) {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  const pattern = '%' + query + '%'
  const result = await env.DB.prepare(`SELECT c.id, c.customer_code, c.name, c.normalized_phone, c.email, c.note, c.created_at, c.updated_at, COUNT(o.id) AS order_count, COALESCE(SUM(CASE WHEN o.status <> 'cancelled' THEN o.total_vnd ELSE 0 END), 0) AS total_spent_vnd, MAX(o.created_at) AS last_order_at FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE c.name LIKE ? OR c.normalized_phone LIKE ? OR COALESCE(c.email, '') LIKE ? OR c.customer_code LIKE ? GROUP BY c.id ORDER BY last_order_at IS NULL, last_order_at DESC, c.created_at DESC LIMIT 200`).bind(pattern, pattern, pattern, pattern).all<CustomerAdminRow>()
  return Response.json({ data: result.results })
}

export async function updateCustomer(request: Request, env: Env, id: string, body: Record<string, unknown> | null) {
  if (!body) return fail('INVALID_PAYLOAD', 'Payload khách hàng không hợp lệ.', 400)
  const name = stringField(body.name, 120)
  const email = body.email === null || body.email === '' ? null : stringField(body.email, 320)
  const note = body.note === null || body.note === '' ? null : stringField(body.note, 1000)
  if (!name || (body.email !== undefined && body.email !== null && body.email !== '' && !email) || (body.note !== undefined && body.note !== null && body.note !== '' && !note)) return fail('INVALID_CUSTOMER', 'Thông tin khách hàng không hợp lệ.', 400)
  const result = await env.DB.prepare('UPDATE customers SET name = ?, email = ?, note = ?, updated_at = ? WHERE id = ?').bind(name, email, note, new Date().toISOString(), id).run()
  if (!result.meta.changes) return fail('NOT_FOUND', 'Không tìm thấy khách hàng.', 404)
  return Response.json({ data: { id, updated: true } })
}

export async function updateOrderStatus(_request: Request, env: Env, id: string, adminId: string, body: Record<string, unknown> | null) {
  const nextStatus = body?.status
  if (typeof nextStatus !== 'string') return fail('INVALID_STATUS', 'Trạng thái đơn không hợp lệ.', 400)
  const current = await env.DB.prepare('SELECT status FROM orders WHERE id = ?').bind(id).first<{ status: OrderStatus }>()
  if (!current) return fail('NOT_FOUND', 'Không tìm thấy đơn hàng.', 404)
  const transition = await env.DB.prepare('SELECT 1 AS allowed FROM order_status_transitions WHERE from_status = ? AND to_status = ?').bind(current.status, nextStatus).first<{ allowed: number }>()
  if (!transition) return fail('INVALID_TRANSITION', 'Không thể chuyển trạng thái đơn theo flow đã định.', 409)
  const now = new Date().toISOString()
  const statements: D1PreparedStatement[] = [
    env.DB.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').bind(nextStatus, now, id),
    env.DB.prepare('INSERT INTO order_status_history (id, order_id, from_status, to_status, note, changed_by_admin_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), id, current.status, nextStatus, null, adminId, now),
  ]
  await env.DB.batch(statements)
  return Response.json({ data: { id, status: nextStatus } })
}

/* Legacy print job handlers intentionally disabled after removing the print workflow.
export async function printJobs(_request: Request, env: Env) {
  return fail('REMOVED_ENDPOINT', 'Print job khong con duoc su dung.', 410)
}

export async function updatePrintJob(_request: Request, env: Env, id: string, adminId: string, body: Record<string, unknown> | null) {
  const nextStatus = body?.status
  if (typeof nextStatus !== 'string' || !Object.prototype.hasOwnProperty.call(printTransitions, nextStatus)) return fail('INVALID_STATUS', 'Trạng thái print job không hợp lệ.', 400)
  const current = await env.DB.prepare('SELECT status, order_id FROM print_jobs WHERE id = ?').bind(id).first<{ status: PrintJobStatus; order_id: string }>()
  if (!current) return fail('NOT_FOUND', 'Không tìm thấy print job.', 404)
  if (!printTransitions[current.status].includes(nextStatus as PrintJobStatus)) return fail('INVALID_TRANSITION', 'Không thể chuyển trạng thái print job.', 409)
  const failureNote = typeof body?.note === 'string' ? body.note.slice(0, 1000) : null
  const now = new Date().toISOString()
  const order = await env.DB.prepare('SELECT status FROM orders WHERE id = ?').bind(current.order_id).first<{ status: OrderStatus }>()
  const statements: D1PreparedStatement[] = [env.DB.prepare('UPDATE print_jobs SET status = ?, failure_note = ?, updated_at = ? WHERE id = ?').bind(nextStatus, failureNote, now, id)]
  let synchronizedOrderStatus: string | undefined
  if (order && nextStatus === 'printing' && order.status === 'preparing' && (orderTransitions.preparing as string[]).includes('printing')) {
    synchronizedOrderStatus = 'printing'
  }
  if (order && nextStatus === 'quality_check' && (order.status as string) === 'printing') {
    const pending = await env.DB.prepare("SELECT COUNT(*) AS count FROM print_jobs WHERE order_id = ? AND id <> ? AND status NOT IN ('quality_check', 'completed')").bind(current.order_id, id).first<{ count: number }>()
    if (Number(pending?.count ?? 0) === 0) synchronizedOrderStatus = 'quality_check'
  }
  if (synchronizedOrderStatus) {
    statements.push(env.DB.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').bind(synchronizedOrderStatus, now, current.order_id))
    statements.push(env.DB.prepare('INSERT INTO order_status_history (id, order_id, from_status, to_status, note, changed_by_admin_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), current.order_id, order!.status, synchronizedOrderStatus, 'Đồng bộ từ trạng thái sản xuất.', adminId, now))
  }
  await env.DB.batch(statements)
  return Response.json({ data: { id, status: nextStatus, orderStatus: synchronizedOrderStatus ?? order?.status, changedByAdminId: adminId } })
}
*/
