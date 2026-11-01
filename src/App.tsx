import { useEffect, useState } from 'react'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { loadSiteConfig, saveSiteConfig, type SiteConfig } from './data/siteConfig'
import { products as mockProducts } from './data/products'
import AdminPage from './pages/AdminWorkspace'
import VisualEditorPage from './pages/VisualEditorWorkspace'
import { Cart, Checkout, FilamentShop, Home, OrderSuccess, ProductDetail, Shop, Tracking, TrackingLogin, Warranty } from './pages/Storefront'
import type { CartItem, Product, ProductColor, View } from './types'

export default function App() {
  const trackingPathMatch = window.location.pathname.match(/^\/tracking\/(SAMU-[a-f0-9]{10})\/?$/i)
  const initialOrderCode = trackingPathMatch?.[1] ?? ''
  if (window.location.pathname === '/admin' || window.location.pathname === '/admin/') return <AdminPage />
  if (window.location.pathname === '/admin/visual-editor') {
    const initialProducts = mockProducts
    const initialConfig = loadSiteConfig()
    return <VisualEditorPage initialProducts={initialProducts} initialConfig={initialConfig} onSave={async (_nextProducts, nextConfig) => {
      const response = await fetch('/api/admin/site-config', { method: 'PUT', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ config: nextConfig }) })
      if (!response.ok) throw new Error('Không thể lưu nội dung giao diện lên cửa hàng.')
      saveSiteConfig(nextConfig)
      window.location.href = '/admin'
    }} onCancel={() => { window.location.href = '/admin' }} />
  }
  const [trackingToken, setTrackingTokenState] = useState(() => new URLSearchParams(window.location.search).get('tracking') ?? sessionStorage.getItem('samuchan_tracking_token') ?? '')
  const [trackingOrderCode, setTrackingOrderCodeState] = useState(initialOrderCode)
  const [view, setView] = useState<View>(() => initialOrderCode || new URLSearchParams(window.location.search).has('tracking') || Boolean(sessionStorage.getItem('samuchan_tracking_token')) ? 'tracking' : 'home')
  const [shopCategory, setShopCategory] = useState('Tất cả')
  const [cart, setCart] = useState<CartItem[]>([])
  const [storefrontProducts, setStorefrontProducts] = useState<Product[]>(mockProducts)
  const [storeCategories, setStoreCategories] = useState<string[]>([])
  const [filamentColors, setFilamentColors] = useState<ProductColor[]>([])
  const [catalogError, setCatalogError] = useState('')
  const [siteConfig, setSiteConfig] = useState(loadSiteConfig)
  const [orderCode, setOrderCode] = useState('SAMU-1025')
  function setTrackingToken(token: string) { setTrackingTokenState(token); if (token) sessionStorage.setItem('samuchan_tracking_token', token) }
  function setTrackingOrderCode(code: string) { setTrackingOrderCodeState(code); if (code) window.history.pushState({}, '', '/tracking/' + encodeURIComponent(code)) }
  function rememberTrackingOrderCode(code: string) { setTrackingOrderCodeState(code) }

  useEffect(() => {
    fetch('/api/catalog/products').then(async response => {
      if (!response.ok) throw new Error('Catalog API không khả dụng')
      const result = await response.json()
      const masterColors: ProductColor[] = (result.colors ?? []).map((color: ProductColor) => ({ id: color.id, name: color.name, imageUrl: color.imageUrl, hex: color.hex, brand: color.brand, materialType: color.materialType, isAvailable: color.isAvailable, priceVnd: color.priceVnd, originalPriceVnd: color.originalPriceVnd, discountPercent: color.discountPercent, discountEndsOn: color.discountEndsOn }))
      setFilamentColors(masterColors)
      setStoreCategories(Array.isArray(result.categories) ? result.categories.filter((category: unknown): category is string => typeof category === 'string' && Boolean(category.trim())) : [])
      const liveProducts: Product[] = result.data.map((item: { id: string; name: string; description: string; category: string | null; filamentTypes?: string[]; filamentType?: string | null; priceVnd: number; originalPriceVnd: number; discountPercent: number; discountEndsOn: string | null; imageUrl: string | null; colorPreviewUrl: string | null; demoVideoUrl: string | null; variants: Array<{ id: string; colorId: string; color: string; colorImageUrl: string | null; colorHex: string | null; colorBrand: string | null; colorMaterialType: string | null; colorIsAvailable: boolean; size: string; imageUrl: string | null; priceVnd: number | null; originalPriceVnd: number; discountPercent: number; discountEndsOn: string | null; stockQuantity: number }> }) => {
        const variants = item.variants.map(variant => ({ id: variant.id, colorId: variant.colorId, color: variant.color, colorName: variant.color, colorImageUrl: variant.colorImageUrl, colorHex: variant.colorHex, colorBrand: variant.colorBrand, colorMaterialType: variant.colorMaterialType, colorIsAvailable: variant.colorIsAvailable, size: variant.size, imageUrl: variant.imageUrl, price: variant.priceVnd ?? item.priceVnd, originalPrice: variant.originalPriceVnd, stockQuantity: variant.stockQuantity }))
        return { id: item.id, name: item.name, description: item.description, category: item.category ?? '', filamentTypes: item.filamentTypes ?? (item.filamentType ? [item.filamentType] : []), price: variants.length ? Math.min(...variants.map(variant => variant.price)) : item.priceVnd, originalPrice: item.originalPriceVnd, discountPercent: item.discountPercent, discountEndsOn: item.discountEndsOn, image: item.imageUrl ?? '/brand/logo_samuchan.jpg', colorPreviewUrl: item.colorPreviewUrl, demoVideoUrl: item.demoVideoUrl ?? undefined, colors: [...new Set(variants.map(variant => variant.color))], masterColors, sizes: [...new Set(variants.map(variant => variant.size))], stockQuantity: variants.reduce((sum, variant) => sum + variant.stockQuantity, 0), variants }
      })
      const liveImageUrls = new Map<string, string[]>(result.data.map((item: { id: string; imageUrls?: string[]; variants: Array<{ imageUrl: string | null }> }) => [item.id, [...(item.imageUrls ?? []), ...item.variants.map(variant => variant.imageUrl).filter((imageUrl): imageUrl is string => Boolean(imageUrl))]] as [string, string[]]))
      setStorefrontProducts(liveProducts.map(product => ({ ...product, images: [...new Set(liveImageUrls.get(String(product.id))?.length ? liveImageUrls.get(String(product.id))! : [product.image])] })))
      setCatalogError('')
    }).catch(() => setCatalogError('Đang dùng sản phẩm mẫu vì chưa kết nối được Worker.'))
  }, [])

  useEffect(() => {
    fetch('/api/site-config').then(async response => {
      if (!response.ok) return
      const result = await response.json() as { data?: SiteConfig | null }
      if (result.data) {
        setSiteConfig(result.data)
        saveSiteConfig(result.data)
      }
    }).catch(() => undefined)
  }, [])

  function addToCart(nextItem: CartItem) {
    setCart(current => {
      const existing = current.findIndex(item => item.id === nextItem.id && item.variantId === nextItem.variantId && item.customColorId === nextItem.customColorId && item.filamentColorId === nextItem.filamentColorId && item.color === nextItem.color && item.size === nextItem.size)
      if (existing < 0) return [...current, nextItem]
      return current.map((item, index) => index === existing ? { ...item, ...nextItem, quantity: item.quantity + nextItem.quantity } : item)
    })
  }

  function openShop(category = 'Tất cả') { setShopCategory(category); setView('shop') }

  const content = typeof view === 'object'
    ? <ProductDetail product={storefrontProducts.find(product => product.id === view.id) ?? storefrontProducts[0]} setView={setView} addToCart={addToCart} />
    : view === 'home' ? <Home products={storefrontProducts} categories={storeCategories} filamentColors={filamentColors} siteConfig={siteConfig} setView={setView} onOpenShop={() => openShop()} onOpenCategory={openShop} />
    : view === 'shop' ? <Shop products={storefrontProducts} categories={storeCategories} colors={filamentColors} addToCart={addToCart} setView={setView} initialCategory={shopCategory} onFilterChange={setShopCategory} />
    : view === 'filament-shop' ? <FilamentShop colors={filamentColors} addToCart={addToCart} setView={setView} />
    : view === 'cart' ? <Cart cart={cart} setCart={setCart} setView={setView} />
    : view === 'checkout' ? <Checkout cart={cart} setCart={setCart} setOrderCode={setOrderCode} setTrackingToken={setTrackingToken} setTrackingOrderCode={rememberTrackingOrderCode} setView={setView} />
    : view === 'success' ? <OrderSuccess orderCode={orderCode} trackingToken={trackingToken} setTrackingToken={setTrackingToken} setView={setView} />
    : view === 'tracking-login' ? <TrackingLogin setToken={setTrackingToken} setOrderCode={setTrackingOrderCode} setView={setView} />
    : view === 'warranty' ? <Warranty />
    : <Tracking token={trackingToken} orderCode={trackingOrderCode} />

  return <><Header cartCount={cart.reduce((total, item) => total + item.quantity, 0)} setView={setView} onShop={() => openShop()} showFilamentShop />{catalogError && <p className="shell notice" role="status">{catalogError}</p>}{content}<Footer siteConfig={siteConfig} /></>
}
