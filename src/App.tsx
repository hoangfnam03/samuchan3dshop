import { useEffect, useState } from 'react'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { loadSiteConfig, saveSiteConfig } from './data/siteConfig'
import { products as mockProducts } from './data/products'
import AdminPage from './pages/AdminWorkspace'
import VisualEditorPage from './pages/VisualEditorWorkspace'
import { Cart, Checkout, Home, OrderSuccess, ProductDetail, Shop, Tracking, TrackingLogin, Warranty } from './pages/Storefront'
import type { CartItem, Product, View } from './types'

export default function App() {
  const trackingPathMatch = window.location.pathname.match(/^\/tracking\/(SAMU-[a-f0-9]{10})\/?$/i)
  const initialOrderCode = trackingPathMatch?.[1] ?? ''
  if (window.location.pathname === '/admin' || window.location.pathname === '/admin/') return <AdminPage />
  if (window.location.pathname === '/admin/visual-editor') {
    const initialProducts = mockProducts
    const initialConfig = loadSiteConfig()
    return <VisualEditorPage initialProducts={initialProducts} initialConfig={initialConfig} onSave={(_nextProducts, nextConfig) => { saveSiteConfig(nextConfig); window.location.href = '/admin' }} onCancel={() => { window.location.href = '/admin' }} />
  }
  const [trackingToken, setTrackingTokenState] = useState(() => new URLSearchParams(window.location.search).get('tracking') ?? sessionStorage.getItem('samuchan_tracking_token') ?? '')
  const [trackingOrderCode, setTrackingOrderCodeState] = useState(initialOrderCode)
  const [view, setView] = useState<View>(() => initialOrderCode || new URLSearchParams(window.location.search).has('tracking') || Boolean(sessionStorage.getItem('samuchan_tracking_token')) ? 'tracking' : 'home')
  const [cart, setCart] = useState<CartItem[]>([])
  const [storefrontProducts, setStorefrontProducts] = useState<Product[]>(mockProducts)
  const [catalogError, setCatalogError] = useState('')
  const [siteConfig] = useState(loadSiteConfig)
  const [orderCode, setOrderCode] = useState('SAMU-1025')
  function setTrackingToken(token: string) { setTrackingTokenState(token); if (token) sessionStorage.setItem('samuchan_tracking_token', token) }
  function setTrackingOrderCode(code: string) { setTrackingOrderCodeState(code); if (code) window.history.pushState({}, '', '/tracking/' + encodeURIComponent(code)) }
  function rememberTrackingOrderCode(code: string) { setTrackingOrderCodeState(code) }

  useEffect(() => {
    fetch('/api/catalog/products').then(async response => {
      if (!response.ok) throw new Error('Catalog API không khả dụng')
      const result = await response.json()
      const liveProducts: Product[] = result.data.map((item: { id: string; name: string; description: string; category: string | null; priceVnd: number; imageUrl: string | null; demoVideoUrl: string | null; variants: Array<{ id: string; color: string; size: string; priceVnd: number | null; stockQuantity: number }> }) => {
        const variants = item.variants.map(variant => ({ id: variant.id, color: variant.color, size: variant.size, price: variant.priceVnd ?? item.priceVnd, stockQuantity: variant.stockQuantity }))
        return { id: item.id, name: item.name, description: item.description, category: item.category ?? 'Quà tặng', price: variants.length ? Math.min(...variants.map(variant => variant.price)) : item.priceVnd, image: item.imageUrl ?? '/brand/logo_samuchan.jpg', demoVideoUrl: item.demoVideoUrl ?? undefined, colors: [...new Set(variants.map(variant => variant.color))], sizes: [...new Set(variants.map(variant => variant.size))], stockQuantity: variants.reduce((sum, variant) => sum + variant.stockQuantity, 0), variants }
      })
      const liveImageUrls = new Map<string, string[]>(result.data.map((item: { id: string; imageUrls?: string[] }) => [item.id, item.imageUrls ?? []] as [string, string[]]))
      setStorefrontProducts(liveProducts.map(product => ({ ...product, images: liveImageUrls.get(String(product.id))?.length ? liveImageUrls.get(String(product.id)) : [product.image] })))
      setCatalogError('')
    }).catch(() => setCatalogError('Đang dùng sản phẩm mẫu vì chưa kết nối được Worker.'))
  }, [])

  function addToCart(nextItem: CartItem) {
    setCart(current => {
      const existing = current.findIndex(item => item.id === nextItem.id && item.color === nextItem.color && item.size === nextItem.size)
      if (existing < 0) return [...current, nextItem]
      return current.map((item, index) => index === existing ? { ...item, quantity: item.quantity + nextItem.quantity } : item)
    })
  }

  const content = typeof view === 'object'
    ? <ProductDetail product={storefrontProducts.find(product => product.id === view.id) ?? storefrontProducts[0]} setView={setView} addToCart={addToCart} />
    : view === 'home' ? <Home products={storefrontProducts} siteConfig={siteConfig} setView={setView} />
    : view === 'shop' ? <Shop products={storefrontProducts} setView={setView} />
    : view === 'cart' ? <Cart cart={cart} setCart={setCart} setView={setView} />
    : view === 'checkout' ? <Checkout cart={cart} setCart={setCart} setOrderCode={setOrderCode} setTrackingToken={setTrackingToken} setTrackingOrderCode={rememberTrackingOrderCode} setView={setView} />
    : view === 'success' ? <OrderSuccess orderCode={orderCode} trackingToken={trackingToken} setTrackingToken={setTrackingToken} setView={setView} />
    : view === 'tracking-login' ? <TrackingLogin setToken={setTrackingToken} setOrderCode={setTrackingOrderCode} setView={setView} />
    : view === 'warranty' ? <Warranty />
    : <Tracking token={trackingToken} orderCode={trackingOrderCode} />

  return <><Header cartCount={cart.reduce((total, item) => total + item.quantity, 0)} setView={setView} />{catalogError && <p className="shell notice" role="status">{catalogError}</p>}{content}<Footer /></>
}
