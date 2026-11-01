import type { Env, OrderStatus } from './contracts'
import { parseStoredFilamentTypes } from './filament-types'
import { filamentTypeKey } from './filament-pricing'
import { activeDiscountPercent, discountedPrice } from './discounts'

interface CreateOrderItemInput {
  variantId?: string
  filamentColorId?: string
  quantity: number
  customColorId?: string
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
  size_id: string
  sku: string
  color: string
  color_is_available: number
  product_filament_types: string | null
  product_filament_type: string | null
  size: string
  price_vnd: number | null
  product_name: string
  base_price_vnd: number
  unit_cost_vnd: number
}

interface PriceTierRow { product_id: string; size_id: string; price_vnd: number | null; base_price_vnd: number; discount_percent: number; discount_ends_on: string | null }
interface FilamentColorRow { id: string; code: string; display_name: string; brand: string; filament_type: string; is_active: number }
interface FilamentTypePriceRow { material_type_key: string; material_type: string; price_vnd: number; total_cost_vnd: number; purchase_lot_count: number; discount_percent: number; discount_ends_on: string | null }

const priceTierKey = (productId: string, sizeId: string) => productId + ':' + sizeId

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
  option_snapshot_json: string | null
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
    if (!isRecord(rawItem)) return errorResponse('INVALID_ITEM', 'Sản phẩm trong đơn hàng không hợp lệ.', 400)
    const variantId = typeof rawItem.variantId === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(rawItem.variantId) ? rawItem.variantId : undefined
    const filamentColorId = typeof rawItem.filamentColorId === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(rawItem.filamentColorId) ? rawItem.filamentColorId : undefined
    if (Boolean(variantId) === Boolean(filamentColorId)) return errorResponse('INVALID_ITEM', 'Mỗi sản phẩm phải là một variant hoặc một cuộn nhựa hợp lệ.', 400)
    if (!Number.isInteger(rawItem.quantity) || Number(rawItem.quantity) < 1 || Number(rawItem.quantity) > MAX_QUANTITY_PER_ITEM) {
      return errorResponse('INVALID_QUANTITY', 'Số lượng mỗi sản phẩm phải từ 1 đến 100.', 400)
    }
    if (rawItem.customColorId !== undefined && (typeof rawItem.customColorId !== 'string' || !/^[A-Za-z0-9_-]{1,120}$/.test(rawItem.customColorId))) {
      return errorResponse('INVALID_COLOR', 'Màu tùy chỉnh trong đơn hàng không hợp lệ.', 400)
    }
    if (rawItem.customColorId !== undefined && !variantId) return errorResponse('INVALID_COLOR', 'Màu tùy chỉnh chỉ áp dụng cho sản phẩm in 3D.', 400)
    const customColorId = typeof rawItem.customColorId === 'string' ? rawItem.customColorId : undefined
    const key = filamentColorId ? 'filament:' + filamentColorId : 'variant:' + variantId + ':' + (customColorId ?? '')
    const existing = merged.get(key)
    const quantity = (existing?.quantity ?? 0) + Number(rawItem.quantity)
    if (quantity > MAX_QUANTITY_PER_ITEM) return errorResponse('INVALID_QUANTITY', 'Tổng số lượng một variant không được vượt quá 100.', 400)
    const option = isRecord(rawItem.option) ? { ...rawItem.option } : undefined
    if (option) {
      delete option.customColorId
      delete option.customColorOrder
      delete option.availabilityNote
    }
    merged.set(key, {
      ...(variantId ? { variantId } : { filamentColorId }),
      quantity,
      customColorId,
      option,
    })
  }

  return { customerName, customerPhone, shippingAddress, note, items: [...merged.values()] }
}

export async function createOrder(request: Request, env: Env): Promise<Response> {
  const input = await parseCreateOrder(request)
  if (input instanceof Response) return input

  const variantItems = input.items.filter((item): item is CreateOrderItemInput & { variantId: string } => Boolean(item.variantId))
  const filamentItems = input.items.filter((item): item is CreateOrderItemInput & { filamentColorId: string } => Boolean(item.filamentColorId))
  const variantPlaceholders = variantItems.map(() => '?').join(', ')
  const rows = variantItems.length ? await env.DB.prepare(
    'SELECT v.id AS variant_id, v.product_id, v.size_id, v.sku, c.display_name AS color, c.is_active AS color_is_available, p.filament_types AS product_filament_types, p.filament_type AS product_filament_type, s.name AS size, v.price_vnd, p.name AS product_name, p.base_price_vnd, (SELECT COALESCE(SUM(ci.cost_vnd), 0) FROM product_cost_items ci WHERE ci.product_id = p.id) AS unit_cost_vnd FROM product_variants v INNER JOIN products p ON p.id = v.product_id INNER JOIN colors c ON c.id = v.color_id INNER JOIN sizes s ON s.id = v.size_id WHERE v.id IN (' + variantPlaceholders + ') AND v.status = ? AND p.status = ?',
  ).bind(...variantItems.map(item => item.variantId), 'active', 'active').all<VariantPriceRow>() : { results: [] as VariantPriceRow[] }

  const byId = new Map(rows.results.map(row => [row.variant_id, row]))
  if (byId.size !== new Set(variantItems.map(item => item.variantId)).size) return errorResponse('VARIANT_UNAVAILABLE', 'Một hoặc nhiều variant không còn khả dụng.', 409)

  const pricePairs = [...new Map(variantItems.map(item => {
    const variant = byId.get(item.variantId)!
    return [priceTierKey(variant.product_id, variant.size_id), { productId: variant.product_id, sizeId: variant.size_id }]
  })).values()]
  const pricePairConditions = pricePairs.map(() => '(v.product_id = ? AND v.size_id = ?)').join(' OR ')
  const priceTierRows = pricePairs.length ? await env.DB.prepare('SELECT v.product_id, v.size_id, v.price_vnd, p.base_price_vnd, p.discount_percent, p.discount_ends_on FROM product_variants v INNER JOIN products p ON p.id = v.product_id WHERE p.status = ? AND v.status = ? AND (' + pricePairConditions + ') ORDER BY v.product_id, v.size_id, v.created_at ASC, v.id ASC').bind('active', 'active', ...pricePairs.flatMap(pair => [pair.productId, pair.sizeId])).all<PriceTierRow>() : { results: [] as PriceTierRow[] }
  const priceBySize = new Map<string, number>()
  const pricingNow = Date.now()
  for (const row of priceTierRows.results) {
    const key = priceTierKey(row.product_id, row.size_id)
    if (!priceBySize.has(key)) {
      const regularPrice = row.price_vnd ?? row.base_price_vnd
      const discountPercent = activeDiscountPercent(row.discount_percent, row.discount_ends_on, pricingNow)
      priceBySize.set(key, discountedPrice(regularPrice, discountPercent))
    }
  }

  const filamentColorIds = [...new Set(filamentItems.map(item => item.filamentColorId))]
  const filamentColorPlaceholders = filamentColorIds.map(() => '?').join(', ')
  const filamentColorRows = filamentColorIds.length ? await env.DB.prepare('SELECT id, code, display_name, brand, filament_type, is_active FROM colors WHERE id IN (' + filamentColorPlaceholders + ')').bind(...filamentColorIds).all<FilamentColorRow>() : { results: [] as FilamentColorRow[] }
  const filamentColors = new Map(filamentColorRows.results.map(item => [item.id, item]))
  if (filamentColors.size !== filamentColorIds.length) return errorResponse('FILAMENT_COLOR_UNAVAILABLE', 'Một hoặc nhiều màu nhựa không còn trong danh sách.', 409)
  const typePriceRows = filamentColorIds.length ? await env.DB.prepare('SELECT material_type_key, material_type, price_vnd, total_cost_vnd, (SELECT COUNT(*) FROM filament_purchase_lots WHERE filament_purchase_lots.material_type_key = filament_type_prices.material_type_key) AS purchase_lot_count, discount_percent, discount_ends_on FROM filament_type_prices').all<FilamentTypePriceRow>() : { results: [] as FilamentTypePriceRow[] }
  const fixedFilamentCostTotal = filamentColorIds.length ? (await env.DB.prepare('SELECT COALESCE(SUM(cost_vnd), 0) AS total_cost_vnd FROM fixed_filament_cost_items').first<{ total_cost_vnd: number }>())?.total_cost_vnd ?? 0 : 0
  const priceByType = new Map(typePriceRows.results.map(item => {
    const discountPercent = activeDiscountPercent(item.discount_percent, item.discount_ends_on, pricingNow)
    return [item.material_type_key, discountedPrice(item.price_vnd, discountPercent)]
  }))
  const costByType = new Map(typePriceRows.results.map(item => [item.material_type_key, item.total_cost_vnd + (item.purchase_lot_count ? 0 : fixedFilamentCostTotal)]))
  const priceByFilamentColor = new Map<string, number>()
  for (const color of filamentColorRows.results) {
    const price = priceByType.get(filamentTypeKey(color.filament_type))
    if (price === undefined) return errorResponse('FILAMENT_PRICE_UNAVAILABLE', 'Shop chưa cài giá bán cho loại nhựa này.', 409)
    priceByFilamentColor.set(color.id, price)
  }

  const customColorIds = [...new Set(input.items.map(item => item.customColorId).filter((id): id is string => Boolean(id)))]
  const customColors = new Map<string, { name: string; materialType: string; isAvailable: boolean }>()
  if (customColorIds.length) {
    const colorPlaceholders = customColorIds.map(() => '?').join(', ')
    const colorRows = await env.DB.prepare('SELECT id, display_name, filament_type, is_active FROM colors WHERE id IN (' + colorPlaceholders + ')').bind(...customColorIds).all<{ id: string; display_name: string; filament_type: string; is_active: number }>()
    for (const colorRow of colorRows.results) customColors.set(colorRow.id, { name: colorRow.display_name, materialType: colorRow.filament_type, isAvailable: colorRow.is_active === 1 })
    if (customColors.size !== customColorIds.length) return errorResponse('CUSTOM_COLOR_UNAVAILABLE', 'Màu tùy chỉnh không còn khả dụng.', 409)

    const productIds = [...new Set(variantItems.map(item => byId.get(item.variantId)!.product_id))]
    const productPlaceholders = productIds.map(() => '?').join(', ')
    const existingProductColors = await env.DB.prepare('SELECT product_id, color_id FROM product_variants WHERE product_id IN (' + productPlaceholders + ') AND color_id IN (' + colorPlaceholders + ') AND status = ?').bind(...productIds, ...customColorIds, 'active').all<{ product_id: string; color_id: string }>()
    const existingPairs = new Set(existingProductColors.results.map(row => row.product_id + ':' + row.color_id))
    for (const item of variantItems) {
      if (!item.customColorId) continue
      const variant = byId.get(item.variantId)!
      const customColor = customColors.get(item.customColorId)!
      const previewFilamentTypes = parseStoredFilamentTypes(variant.product_filament_types, variant.product_filament_type)
      if (previewFilamentTypes.length && !previewFilamentTypes.includes(customColor.materialType)) return errorResponse('CUSTOM_COLOR_FILAMENT_MISMATCH', 'Màu tùy chỉnh phải thuộc một trong các loại nhựa đã chọn cho sản phẩm.', 409)
      if (existingPairs.has(variant.product_id + ':' + item.customColorId)) return errorResponse('CUSTOM_COLOR_IS_VARIANT', 'Màu này đã có variant riêng của sản phẩm. Vui lòng chọn màu có sẵn.', 409)
    }
  }

  let subtotalVnd = 0
  for (const item of input.items) {
    if (item.filamentColorId) {
      const price = priceByFilamentColor.get(item.filamentColorId)
      if (price === undefined) return errorResponse('FILAMENT_PRICE_UNAVAILABLE', 'Shop chưa cài giá bán cho loại nhựa này.', 409)
      subtotalVnd += price * item.quantity
      continue
    }
    const variant = byId.get(item.variantId!)!
    const price = priceBySize.get(priceTierKey(variant.product_id, variant.size_id))
    if (price === undefined) return errorResponse('VARIANT_UNAVAILABLE', 'Không tìm thấy giá cho kích thước đã chọn.', 409)
    subtotalVnd += price * item.quantity
  }

  const shippingFeeVnd = 0
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
    if (item.filamentColorId) {
      const color = filamentColors.get(item.filamentColorId)!
      const unitPriceVnd = priceByFilamentColor.get(color.id)!
      const unitCostVnd = costByType.get(filamentTypeKey(color.filament_type)) ?? 0
      const availabilityNote = color.is_active === 1 ? undefined : 'Màu này chưa có sẵn, vui lòng đợi 7 ngày để hàng về.'
      const optionSnapshot = { kind: 'filament', filamentColorId: color.id, brand: color.brand, materialType: color.filament_type, ...(availabilityNote ? { availabilityNote } : {}) }
      statements.push(env.DB.prepare(
        'INSERT INTO order_items (id, order_id, product_id, variant_id, product_name_snapshot, sku_snapshot, color_snapshot, size_snapshot, unit_price_vnd, unit_cost_vnd, quantity, option_snapshot_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).bind(crypto.randomUUID(), id, 'filament', 'filament-' + color.id, 'Nhựa in 3D · ' + color.filament_type, 'FILAMENT-' + color.code, color.display_name + (color.brand ? ' · ' + color.brand : ''), 'Cuộn 1kg', unitPriceVnd, unitCostVnd, item.quantity, JSON.stringify(optionSnapshot)))
      continue
    }
    const variant = byId.get(item.variantId!)!
    const unitPriceVnd = priceBySize.get(priceTierKey(variant.product_id, variant.size_id)) ?? variant.base_price_vnd
    const isAvailable = item.customColorId ? customColors.get(item.customColorId)!.isAvailable : variant.color_is_available === 1
    const availabilityNote = isAvailable ? undefined : 'Màu này chưa có sẵn, vui lòng đợi 7 ngày để hàng về.'
    const optionSnapshot = item.customColorId
      ? { ...item.option, ...(availabilityNote ? { availabilityNote } : {}), customColorId: item.customColorId, customColorOrder: true }
      : availabilityNote ? { ...item.option, availabilityNote } : item.option
    statements.push(env.DB.prepare(
      'INSERT INTO order_items (id, order_id, product_id, variant_id, product_name_snapshot, sku_snapshot, color_snapshot, size_snapshot, unit_price_vnd, unit_cost_vnd, quantity, option_snapshot_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(crypto.randomUUID(), id, variant.product_id, variant.variant_id, variant.product_name, variant.sku, item.customColorId ? 'Màu tùy chỉnh: ' + customColors.get(item.customColorId)!.name : variant.color, variant.size, unitPriceVnd, variant.unit_cost_vnd, item.quantity, optionSnapshot ? JSON.stringify(optionSnapshot) : null))
  }

  statements.push(env.DB.prepare(
    'INSERT INTO order_status_history (id, order_id, from_status, to_status, note, changed_by_admin_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).bind(crypto.randomUUID(), id, null, 'received', 'Đơn hàng được tạo.', null, now))

  try {
    await env.DB.batch(statements)
  } catch {
    return errorResponse('ORDER_SAVE_FAILED', 'Không thể lưu đơn hàng lúc này. Vui lòng thử lại.', 500)
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
    env.DB.prepare('SELECT i.product_name_snapshot, i.sku_snapshot, i.color_snapshot, i.size_snapshot, i.unit_price_vnd, i.quantity, i.option_snapshot_json FROM order_items i WHERE i.order_id = ? ORDER BY i.rowid ASC').bind(orderResult.id),
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
      items: (itemsResult.results as unknown as PublicItemRow[]).map(item => {
        let availabilityNote: string | undefined
        if (item.option_snapshot_json) {
          try {
            const option = JSON.parse(item.option_snapshot_json) as unknown
            if (typeof option === 'object' && option !== null && !Array.isArray(option)) {
              const note = (option as Record<string, unknown>).availabilityNote
              if (typeof note === 'string') availabilityNote = note
            }
          } catch { /* Ignore malformed legacy snapshots. */ }
        }
        return {
          name: item.product_name_snapshot,
          sku: item.sku_snapshot,
          color: item.color_snapshot,
          size: item.size_snapshot,
          unitPriceVnd: item.unit_price_vnd,
          quantity: item.quantity,
          availabilityNote,
        }
      }),
      history: (historyResult.results as unknown as StatusRow[]).map(event => ({
        fromStatus: event.from_status,
        toStatus: event.to_status,
        note: event.note,
        createdAt: event.created_at,
      })),
    },
  }, { headers: { 'cache-control': 'no-store' } })
}
