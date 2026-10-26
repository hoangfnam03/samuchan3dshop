import { useEffect, useState } from 'react'
import { Footer as SiteFooter } from '../components/Footer'
import { Header } from '../components/Header'
import { Cart, Checkout, Home, OrderSuccess, ProductDetail, Shop, Tracking, TrackingLogin } from './Storefront'
import type { CartItem, Product, View } from '../types'
import type { SiteConfig } from '../data/siteConfig'

interface Props {
  initialProducts: Product[]
  initialConfig: SiteConfig
  onSave: (products: Product[], config: SiteConfig) => void
  onCancel: () => void
}
type EditTarget = { kind: 'site'; field: keyof SiteConfig } | { kind: 'product'; id: string | number; field: 'name' | 'image' } | null

export default function VisualEditorWorkspace({ initialProducts, initialConfig, onSave, onCancel }: Props) {
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [previewView, setPreviewView] = useState<View>('home')
  const [draftProducts, setDraftProducts] = useState(() => structuredClone(initialProducts))
  const [originalProducts, setOriginalProducts] = useState(() => structuredClone(initialProducts))
  const [draftConfig, setDraftConfig] = useState(() => ({ ...initialConfig }))
  const [cart, setCart] = useState<CartItem[]>([])
  const [orderCode, setOrderCode] = useState('SAMU-1025')
  const [editing, setEditing] = useState<EditTarget>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  useEffect(() => {
    fetch('/api/admin/me', { credentials: 'include' }).then(async response => {
      if (!response.ok) throw new Error('unauthorized')
      const result = await fetch('/api/admin/products', { credentials: 'include' })
      if (!result.ok) throw new Error('catalog unavailable')
      const payload = await result.json()
      const liveProducts: Product[] = payload.data.map((item: { id: string; name: string; description: string; category: string | null; basePriceVnd: number; imageUrl: string | null; demoVideoUrl: string | null; variants: Array<{ id: string; color: string; size: string; priceVnd: number | null; stockQuantity: number }> }) => {
        const variants = item.variants.map(variant => ({ id: variant.id, color: variant.color, size: variant.size, price: variant.priceVnd ?? item.basePriceVnd, stockQuantity: variant.stockQuantity }))
        return { id: item.id, name: item.name, description: item.description, category: item.category ?? 'Quà tặng', price: item.basePriceVnd, image: item.imageUrl ?? '/brand/logo_samuchan.jpg', demoVideoUrl: item.demoVideoUrl ?? undefined, colors: [...new Set(variants.map(variant => variant.color))], sizes: [...new Set(variants.map(variant => variant.size))], stockQuantity: variants.reduce((sum, variant) => sum + variant.stockQuantity, 0), variants }
      })
      setDraftProducts(liveProducts); setOriginalProducts(structuredClone(liveProducts))
      setAuthorized(true)
    }).catch(() => { window.location.href = '/admin' })
  }, [])

  function setView(view: View) { setPreviewView(view); setEditing(null) }
  function addToCart(item: CartItem) {
    setCart(current => {
      const index = current.findIndex(existing => existing.id === item.id && existing.color === item.color && existing.size === item.size)
      return index < 0 ? [...current, item] : current.map((existing, currentIndex) => currentIndex === index ? { ...existing, quantity: existing.quantity + item.quantity } : existing)
    })
  }
  function updateSite(field: keyof SiteConfig, value: string) { setDraftConfig(current => ({ ...current, [field]: value })) }
  function updateProduct(id: string | number, field: 'name' | 'image', value: string) { setDraftProducts(current => current.map(product => product.id === id ? { ...product, [field]: value } : product)) }
  async function uploadImage(file: File, targetId: string | number) {
    if (!file.type.startsWith('image/')) throw new Error('Vui lòng chọn một file ảnh.')
    if (file.size <= 0 || file.size > 25 * 1024 * 1024) throw new Error('Ảnh phải có dung lượng tối đa 25MB.')
    const form = new FormData()
    form.set('productId', String(targetId))
    form.append('files', file)
    setUploadingImage(true)
    try {
      const response = await fetch('/api/admin/media', { method: 'POST', credentials: 'include', body: form })
      const payload = await response.json() as { data?: Array<{ url?: string }>; message?: string }
      const url = payload.data?.[0]?.url
      if (!response.ok || !url) throw new Error(payload.message ?? 'Không thể tải ảnh lên.')
      return url
    } finally {
      setUploadingImage(false)
    }
  }
  async function selectSiteImage(file: File) {
    const previous = draftConfig.heroImage
    const previewUrl = URL.createObjectURL(file)
    updateSite('heroImage', previewUrl)
    try { updateSite('heroImage', await uploadImage(file, 'homepage')) }
    catch (reason) { updateSite('heroImage', previous); window.alert(reason instanceof Error ? reason.message : 'Không thể tải ảnh lên.') }
    finally { URL.revokeObjectURL(previewUrl) }
  }
  async function selectProductImage(id: string | number, file: File) {
    const previous = draftProducts.find(product => product.id === id)?.image ?? ''
    const previewUrl = URL.createObjectURL(file)
    updateProduct(id, 'image', previewUrl)
    try { updateProduct(id, 'image', await uploadImage(file, id)) }
    catch (reason) { updateProduct(id, 'image', previous); window.alert(reason instanceof Error ? reason.message : 'Không thể tải ảnh lên.') }
    finally { URL.revokeObjectURL(previewUrl) }
  }
  async function save() {
    for (const product of draftProducts) {
      const original = originalProducts.find(item => item.id === product.id)
      if (!original || original.name === product.name && original.image === product.image) continue
      const response = await fetch('/api/admin/products/' + encodeURIComponent(String(product.id)), { method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: product.name, imageUrl: product.image || null }) })
      if (!response.ok) throw new Error('Không thể lưu ' + product.name)
    }
    onSave(draftProducts, draftConfig)
  }
  function renderPreview() {
    if (typeof previewView === 'object') return <ProductDetail product={draftProducts.find(product => product.id === previewView.id) ?? draftProducts[0]} setView={setView} addToCart={addToCart} />
    if (previewView === 'home') return <Home products={draftProducts} siteConfig={draftConfig} setView={setView} onEditField={field => setEditing({ kind: 'site', field })} onEditProduct={(id, field) => setEditing({ kind: 'product', id, field })} />
    if (previewView === 'shop') return <Shop products={draftProducts} setView={setView} onEditProduct={(id, field) => setEditing({ kind: 'product', id, field })} />
    if (previewView === 'cart') return <Cart cart={cart} setCart={setCart} setView={setView} />
    if (previewView === 'checkout') return <Checkout cart={cart} setCart={setCart} setOrderCode={setOrderCode} setView={setView} preview />
    if (previewView === 'success') return <OrderSuccess orderCode={orderCode} trackingToken="" setTrackingToken={() => undefined} setView={setView} />
    if (previewView === 'tracking-login') return <TrackingLogin setToken={() => undefined} setOrderCode={() => undefined} setView={setView} />
    return <Tracking token="" orderCode="" />
  }

  if (authorized !== true) return <main className="admin-loading">Đang kiểm tra quyền truy cập…</main>

  const editingLabel = editing?.kind === 'site'
    ? ({ heroTitle: 'Tiêu đề chính', heroAccent: 'Tiêu đề nhấn mạnh', heroDescription: 'Mô tả banner', heroImage: 'Ảnh banner', processHeading: 'Tiêu đề quy trình', featuredHeading: 'Tiêu đề sản phẩm nổi bật', footerDescription: 'Mô tả footer', footerProduct1: 'Sản phẩm footer 1', footerProduct2: 'Sản phẩm footer 2', footerProduct3: 'Sản phẩm footer 3', footerZalo: 'Số Zalo', footerEmail: 'Email', footerAddress: 'Địa chỉ', footerCopyright: 'Bản quyền', footerTagline: 'Slogan footer' }[editing.field])
    : editing?.kind === 'product' ? (editing.field === 'name' ? 'Tên sản phẩm' : 'Ảnh sản phẩm') : ''

  const Footer = () => <SiteFooter siteConfig={draftConfig} onEditField={field => setEditing({ kind: 'site', field })} />

  return <main className="visual-editor"><header className="visual-editor-bar"><div><span className="editor-live-dot" /><b>Chế độ Visual Editor (Preview)</b><small>Nhấn ✎ ngay cạnh nội dung cần chỉnh</small></div><div><button className="editor-cancel" onClick={onCancel}>Hủy thay đổi</button><button className="editor-save" disabled={uploadingImage} onClick={() => void save().catch(reason => window.alert(reason instanceof Error ? reason.message : 'Không thể lưu'))}>{uploadingImage ? 'Đang tải ảnh…' : 'Lưu cho toàn trang'}</button></div></header><div className="visual-preview-label">LIVE PREVIEW · GIAO DIỆN KHÁCH HÀNG</div><section className="visual-preview-frame"><Header cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)} setView={setView} />{renderPreview()}<Footer /></section>{editing && <aside className="inline-editor-popover"><button className="popover-close" onClick={() => setEditing(null)}>×</button><p className="admin-kicker">CHỈNH TRỰC TIẾP</p><h2>{editingLabel}</h2>{editing.kind === 'site' && editing.field !== 'heroImage' && <>{editing.field === 'heroDescription' ? <textarea rows={5} value={draftConfig[editing.field]} onChange={event => updateSite(editing.field, event.target.value)} autoFocus /> : <input value={draftConfig[editing.field]} onChange={event => updateSite(editing.field, event.target.value)} autoFocus />}</>}{editing.kind === 'site' && editing.field === 'heroImage' && <label>Chọn ảnh banner<input type="file" accept="image/*" onChange={event => { const file = event.target.files?.[0]; if (file) void selectSiteImage(file); event.currentTarget.value = '' }} autoFocus /></label>}{editing.kind === 'product' && (editing.field === 'image' ? <label>Chọn ảnh sản phẩm<input type="file" accept="image/*" onChange={event => { const file = event.target.files?.[0]; if (file) void selectProductImage(editing.id, file); event.currentTarget.value = '' }} autoFocus /></label> : <input value={draftProducts.find(product => product.id === editing.id)?.name ?? ''} onChange={event => updateProduct(editing.id, 'name', event.target.value)} autoFocus />)}<p className="editor-help">Thay đổi đang ở chế độ preview. {uploadingImage ? 'Đang tải ảnh lên…' : 'Bấm “Lưu cho toàn trang” để ghi lại.'}</p></aside>}</main>
}
