import { getMedia, listCatalog } from './catalog'
import { bodyRecord, createProduct, createVariant, customers, dashboard, deleteColorImage, deleteProduct, login, logout, masterData, masterDataCrud, me, orders, products, requireAdmin, updateCustomer, updateOrderStatus, updateProduct, updateVariant, uploadColorImage, uploadMedia } from './admin'
import { createOrder, trackOrder, trackOrderByCode } from './orders'
import type { Env, HealthResponse } from './contracts'

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

function json<T>(body: T, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...jsonHeaders, ...init.headers },
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'access-control-allow-headers': 'content-type',
          'access-control-allow-methods': 'GET, OPTIONS',
          'access-control-allow-origin': '*',
        },
      })
    }

    const url = new URL(request.url)
    if (url.pathname === '/api/health' && request.method === 'GET') {
      const payload: HealthResponse = {
        service: 'samuchan-api',
        status: 'ok',
        phase: 'orders',
      }
      return json(payload, { headers: { 'access-control-allow-origin': '*' } })
    }

    if (url.pathname === '/api/admin/login' && request.method === 'POST') return login(request, env)
    if (url.pathname === '/api/admin/logout' && request.method === 'POST') return logout(request, env)

    if (url.pathname.startsWith('/api/admin/')) {
      const identity = await requireAdmin(request, env)
      if (identity instanceof Response) return identity
      if (url.pathname === '/api/admin/me' && request.method === 'GET') return me(request, env)
      if (url.pathname === '/api/admin/dashboard' && request.method === 'GET') return dashboard(request, env)
      if (url.pathname === '/api/admin/master-data' && request.method === 'GET') return masterData(request, env)
      const masterMatch = url.pathname.match(/^\/api\/admin\/master-data\/(categories|colors|sizes|statuses)(?:\/([^/]+))?$/)
      if (masterMatch && ['POST', 'PATCH', 'DELETE'].includes(request.method)) return masterDataCrud(request, env, masterMatch[1], masterMatch[2] ? decodeURIComponent(masterMatch[2]) : undefined)
      if (url.pathname === '/api/admin/products' && request.method === 'GET') return products(request, env)
      if (url.pathname === '/api/admin/products' && request.method === 'POST') return createProduct(request, env)
      if (url.pathname === '/api/admin/media' && request.method === 'POST') return uploadMedia(request, env)
      const colorImageMatch = url.pathname.match(/^\/api\/admin\/colors\/([^/]+)\/image$/)
      if (colorImageMatch && request.method === 'POST') return uploadColorImage(request, env, decodeURIComponent(colorImageMatch[1]))
      if (colorImageMatch && request.method === 'DELETE') return deleteColorImage(request, env, decodeURIComponent(colorImageMatch[1]))
      if (url.pathname === '/api/admin/orders' && request.method === 'GET') return orders(request, env)
      if (url.pathname === '/api/admin/customers' && request.method === 'GET') return customers(request, env)

      const productMatch = url.pathname.match(/^\/api\/admin\/products\/([^/]+)$/)
      if (productMatch && request.method === 'PATCH') return updateProduct(request, env, decodeURIComponent(productMatch[1]))
      if (productMatch && request.method === 'DELETE') return deleteProduct(request, env, decodeURIComponent(productMatch[1]))
      const variantCreateMatch = url.pathname.match(/^\/api\/admin\/products\/([^/]+)\/variants$/)
      if (variantCreateMatch && request.method === 'POST') return createVariant(request, env, decodeURIComponent(variantCreateMatch[1]))
      const variantMatch = url.pathname.match(/^\/api\/admin\/variants\/([^/]+)$/)
      if (variantMatch && request.method === 'PATCH') return updateVariant(request, env, decodeURIComponent(variantMatch[1]))
      const orderMatch = url.pathname.match(/^\/api\/admin\/orders\/([^/]+)\/status$/)
      if (orderMatch && request.method === 'PATCH') return updateOrderStatus(request, env, decodeURIComponent(orderMatch[1]), identity.adminId, await bodyRecord(request))
      const customerMatch = url.pathname.match(/^\/api\/admin\/customers\/([^/]+)$/)
      if (customerMatch && request.method === 'PATCH') return updateCustomer(request, env, decodeURIComponent(customerMatch[1]), await bodyRecord(request))
      return json({ error: 'NOT_FOUND', message: 'Admin endpoint không tồn tại.' }, { status: 404 })
    }

    if (url.pathname === '/api/catalog/products' && request.method === 'GET') {
      return listCatalog(request, env)
    }

    if (url.pathname === '/api/orders' && request.method === 'POST') {
      return createOrder(request, env)
    }

    const orderCodeMatch = url.pathname.match(/^\/api\/orders\/track\/code\/([^/]+)$/)
    if (orderCodeMatch && request.method === 'GET') return trackOrderByCode(request, env, decodeURIComponent(orderCodeMatch[1]))

    const trackingMatch = url.pathname.match(/^\/api\/orders\/track\/([^/]+)$/)
    if (trackingMatch && request.method === 'GET') {
      return trackOrder(request, env, trackingMatch[1])
    }

    if (url.pathname.startsWith('/media/') && request.method === 'GET') {
      return getMedia(request, env)
    }

    return env.ASSETS.fetch(request)
  },
}
