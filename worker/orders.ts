import type { Env, OrderStatus } from './contracts'

interface CreateOrderItemInput {
  variantId: string
  quantity: number
  option?: Record<string, unknown>
}

interface CreateOrderInput {
  customerName: string
  customerPhone: string
  shippingAddress?: string
  note?: string
  items: CreateOrderItemInput[]
}

interface VariantPriceRow {
  variant_id: string
  product_id: string
  sku: string
  color: string
  size: string
  price_vnd: number | null
  stock_quantity: number
  product_name: string
  base_price_vnd: number
}

interface OrderRow {
  id: string
  order_code: string
  status: OrderStatus
  subtotal_vnd: number
  shipping_fee_vnd: number
  total_vnd: number
  created_at: string
  updated_at: string
}

interface PublicItemRow {
  product_name_snapshot: string
  sku_snapshot: string
  color_snapshot: string
  size_snapshot: string
  unit_price_vnd: number
  quantity: number
}

interface StatusRow {
  from_status: OrderStatus | null
  to_status: OrderStatus
  note: string | null
  created_at: string
}

const MAX_BODY_BYTES = 64 * 1024
const MAX_ITEMS = 20
const MAX_QUANTITY_PER_ITEM = 100

function errorResponse(error: string, message: string, status: number) {
  return Response.json({ error, message }, { status, headers: { 'cache-control': 'no-store' } })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function text(value: unknown, maxLength: number) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength
    ? value.trim()
    : undefined
}

function randomHex(byteLength: number) {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

function orderCode() {
  return 'SAMU-' + randomHex(5).toUpperCase()
}

async function parseCreateOrder(request: Request): Promise<CreateOrderInput | Response> {
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > MAX_BODY_BYTES) return errorResponse('PAYLOAD_TOO_LARGE', 'Dữ liệu đặt hàng quá lớn.', 413)

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return errorResponse('INVALID_JSON', 'Payload phải là JSON hợp lệ.', 400)
  }

  if (!isRecord(raw)) return errorResponse('INVALID_PAYLOAD', 'Payload đặt hàng không hợp lệ.', 400)

  const customerName = text(raw.customerName, 120)
  const customerPhone = text(raw.customerPhone, 30)
  const shippingAddress = raw.shippingAddress === undefined ? undefined : text(raw.shippingAddress, 500)
  const note = raw.note === undefined ? undefined : text(raw.note, 1000)
  if (!customerName || !customerPhone || (raw.shippingAddress !== undefined && !shippingAddress) || (raw.note !== undefined && raw.note !== '' && !note)) {
    return errorResponse('INVALID_CUSTOMER', 'Thiếu hoặc vượt giới hạn thông tin khách hàng.', 400)
  }
  if (!/^[-+() 0-9.]{7,30}$/.test(customerPhone)) return errorResponse('INVALID_PHONE', 'Số điện thoại không hợp lệ.', 400)

  if (!Array.isArray(raw.items) || raw.items.length === 0 || raw.items.length > MAX_ITEMS) {
    return errorResponse('INVALID_ITEMS', 'Đơn hàng phải có từ 1 đến 20 sản phẩm.', 400)
  }

  const merged = new Map<string, CreateOrderItemInput>()
  for (const rawItem of raw.items) {
    if (!isRecord(rawItem) || typeof rawItem.variantId !== 'string' || !/^[A-Za-z0-9_-]{1,120}$/.test(rawItem.variantId)) {
      return errorResponse('INVALID_VARIANT', 'Variant trong đơn hàng không hợp lệ.', 400)
    }
    if (!Number.isInteger(rawItem.quantity) || Number(rawItem.quantity) < 1 || Number(rawItem.quantity) > MAX_QUANTITY_PER_ITEM) {
      return errorResponse('INVALID_QUANTITY', 'Số lượng mỗi variant phải từ 1 đến 100.', 400)
    }
    const existing = merged.get(rawItem.variantId)
    const quantity = (existing?.quantity ?? 0) + Number(rawItem.quantity)
    if (quantity > MAX_QUANTITY_PER_ITEM) return errorResponse('INVALID_QUANTITY', 'Tổng số lượng một variant không được vượt quá 100.', 400)
    merged.set(rawItem.variantId, {
      variantId: rawItem.variantId,
      quantity,
      option: isRecord(rawItem.option) ? rawItem.option : undefined,
    })
  }

  return { customerName, customerPhone, shippingAddress, note, items: [...merged.values()] }
}

export async function createOrder(request: Request, env: Env): Promise<Response> {
  const input = await parseCreateOrder(request)
  if (input instanceof Response) return input

  const placeholders = input.items.map(() => '?').join(', ')
  const rows = await env.DB.prepare(
    'SELECT v.id AS variant_id, v.product_id, v.sku, c.name AS color, s.name AS size, v.price_vnd, v.stock_quantity, p.name AS product_name, p.base_price_vnd FROM product_variants v INNER JOIN products p ON p.id = v.product_id INNER JOIN colors c ON c.id = v.color_id INNER JOIN sizes s ON s.id = v.size_id WHERE v.id IN (' + placeholders + ') AND v.status = ? AND p.status = ?',
  ).bind(...input.items.map(item => item.variantId), 'active', 'active').all<VariantPriceRow>()

  const byId = new Map(rows.results.map(row => [row.variant_id, row]))
  if (byId.size !== input.items.length) return errorResponse('VARIANT_UNAVAILABLE', 'Một hoặc nhiều variant không còn khả dụng.', 409)

  let subtotalVnd = 0
  for (const item of input.items) {
    const variant = byId.get(item.variantId)!
    if (item.quantity > variant.stock_quantity) return errorResponse('OUT_OF_STOCK', 'Một hoặc nhiều variant không đủ tồn kho.', 409)
    subtotalVnd += (variant.price_vnd ?? variant.base_price_vnd) * item.quantity
  }

  const shippingFeeVnd = input.shippingAddress ? 30000 : 0
  const totalVnd = subtotalVnd + shippingFeeVnd
  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  const token = randomHex(32)
  const trackingTokenHash = await sha256Hex(token)
  const code = orderCode()

  const normalizedPhone = input.customerPhone.replace(/[^0-9+]/g, '')
  const customerId = crypto.randomUUID()
  const customerCode = 'CUS-' + randomHex(5).toUpperCase()
  const existingCustomer = await env.DB.prepare('SELECT id FROM customers WHERE normalized_phone = ?').bind(normalizedPhone).first<{ id: string }>()
  const resolvedCustomerId = existingCustomer?.id ?? customerId
  const statements: D1PreparedStatement[] = [
    ...(existingCustomer ? [] : [env.DB.prepare('INSERT INTO customers (id, customer_code, name, normalized_phone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').bind(customerId, customerCode, input.customerName, normalizedPhone, now, now)]),
    ...(existingCustomer ? [env.DB.prepare('UPDATE customers SET name = ?, updated_at = ? WHERE id = ?').bind(input.customerName, now, resolvedCustomerId)] : []),
    env.DB.prepare(
      'INSERT INTO orders (id, order_code, tracking_token_hash, customer_id, customer_name, customer_phone, shipping_address, note, status, subtotal_vnd, shipping_fee_vnd, total_vnd, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(id, code, trackingTokenHash, resolvedCustomerId, input.customerName, input.customerPhone, input.shippingAddress ?? null, input.note ?? null, 'received', subtotalVnd, shippingFeeVnd, totalVnd, now, now),
  ]

  for (const item of input.items) {
    const variant = byId.get(item.variantId)!
    const unitPriceVnd = variant.price_vnd ?? variant.base_price_vnd
    statements.push(env.DB.prepare(
      'UPDATE product_variants SET stock_quantity = stock_quantity - ?, updated_at = ? WHERE id = ? AND status = ?',
    ).bind(item.quantity, now, variant.variant_id, 'active'))
    statements.push(env.DB.prepare(
      'INSERT INTO order_items (id, order_id, product_id, variant_id, product_name_snapshot, sku_snapshot, color_snapshot, size_snapshot, unit_price_vnd, quantity, option_snapshot_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(crypto.randomUUID(), id, variant.product_id, variant.variant_id, variant.product_name, variant.sku, variant.color, variant.size, unitPriceVnd, item.quantity, item.option ? JSON.stringify(item.option) : null))
  }

  statements.push(env.DB.prepare(
    'INSERT INTO order_status_history (id, order_id, from_status, to_status, note, changed_by_admin_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).bind(crypto.randomUUID(), id, null, 'received', 'Đơn hàng được tạo.', null, now))

  try {
    await env.DB.batch(statements)
  } catch {
    return errorResponse('OUT_OF_STOCK', 'Một hoặc nhiều variant vừa hết tồn kho. Vui lòng thử lại.', 409)
  }

  return Response.json({
    data: {
      orderCode: code,
      trackingToken: token,
      trackingUrl: new URL('/api/orders/track/' + token, request.url).toString(),
      status: 'received',
      subtotalVnd,
      shippingFeeVnd,
      totalVnd,
    },
  }, { status: 201, headers: { 'cache-control': 'no-store' } })
}

export async function trackOrder(request: Request, env: Env, token: string): Promise<Response> {
  if (!/^[a-f0-9]{64}$/i.test(token)) return errorResponse('ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.', 404)
  const tokenHash = await sha256Hex(token.toLowerCase())
  const orderResult = await env.DB.prepare(
    'SELECT id, order_code, status, subtotal_vnd, shipping_fee_vnd, total_vnd, created_at, updated_at FROM orders WHERE tracking_token_hash = ?',
  ).bind(tokenHash).first<OrderRow>()
  if (!orderResult) return errorResponse('ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.', 404)

  return trackingPayload(env, orderResult)
}

export async function trackOrderByCode(_request: Request, env: Env, orderCode: string): Promise<Response> {
  if (!/^SAMU-[A-F0-9]{10}$/i.test(orderCode)) return errorResponse('ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.', 404)
  const orderResult = await env.DB.prepare(
    'SELECT id, order_code, status, subtotal_vnd, shipping_fee_vnd, total_vnd, created_at, updated_at FROM orders WHERE order_code = ? COLLATE NOCASE',
  ).bind(orderCode).first<OrderRow>()
  if (!orderResult) return errorResponse('ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.', 404)
  return trackingPayload(env, orderResult)
}

async function trackingPayload(env: Env, orderResult: OrderRow): Promise<Response> {
  const [itemsResult, historyResult] = await env.DB.batch([
    env.DB.prepare('SELECT i.product_name_snapshot, i.sku_snapshot, i.color_snapshot, i.size_snapshot, i.unit_price_vnd, i.quantity FROM order_items i WHERE i.order_id = ? ORDER BY i.rowid ASC').bind(orderResult.id),
    env.DB.prepare('SELECT from_status, to_status, note, created_at FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC').bind(orderResult.id),
  ])

  return Response.json({
    data: {
      orderCode: orderResult.order_code,
      status: orderResult.status,
      subtotalVnd: orderResult.subtotal_vnd,
      shippingFeeVnd: orderResult.shipping_fee_vnd,
      totalVnd: orderResult.total_vnd,
      createdAt: orderResult.created_at,
      updatedAt: orderResult.updated_at,
      items: (itemsResult.results as unknown as PublicItemRow[]).map(item => ({
        name: item.product_name_snapshot,
        sku: item.sku_snapshot,
        color: item.color_snapshot,
        size: item.size_snapshot,
        unitPriceVnd: item.unit_price_vnd,
        quantity: item.quantity,
      })),
      history: (historyResult.results as unknown as StatusRow[]).map(event => ({
        fromStatus: event.from_status,
        toStatus: event.to_status,
        note: event.note,
        createdAt: event.created_at,
      })),
    },
  }, { headers: { 'cache-control': 'no-store' } })
}
