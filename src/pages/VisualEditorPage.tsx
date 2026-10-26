import { useEffect, useState } from 'react'
import { Home } from './Storefront'
import type { Product } from '../types'
import type { SiteConfig } from '../data/siteConfig'

interface Props {
  initialProducts: Product[]
  initialConfig: SiteConfig
  onSave: (products: Product[], config: SiteConfig) => void
  onCancel: () => void
}

export default function VisualEditorPage({ initialProducts, initialConfig, onSave, onCancel }: Props) {
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [draftProducts, setDraftProducts] = useState(() => structuredClone(initialProducts))
  const [draftConfig, setDraftConfig] = useState(() => ({ ...initialConfig }))
  const [selectedProductId, setSelectedProductId] = useState(initialProducts[0]?.id ?? 0)
  const selected = draftProducts.find(product => product.id === selectedProductId)

  useEffect(() => {
    fetch('/api/admin/me', { credentials: 'include' }).then(response => {
      if (!response.ok) throw new Error('unauthorized')
      setAuthorized(true)
    }).catch(() => { window.location.href = '/admin' })
  }, [])

  function updateSelected(field: 'name' | 'image', value: string) {
    setDraftProducts(current => current.map(product => product.id === selectedProductId ? { ...product, [field]: value } : product))
  }

  if (authorized !== true) return <main className="admin-loading">Đang kiểm tra quyền truy cập…</main>
  return <main className="visual-editor">
    <header className="visual-editor-bar"><div><span className="editor-live-dot" /> <b>Chế độ Visual Editor (Preview)</b><small>Chỉnh sửa trực tiếp trên giao diện khách hàng</small></div><div><button className="editor-cancel" onClick={onCancel}>Hủy thay đổi</button><button className="editor-save" onClick={() => onSave(draftProducts, draftConfig)}>Lưu cho toàn trang</button></div></header>
    <div className="visual-editor-layout">
      <section className="visual-preview"><div className="visual-preview-label">LIVE PREVIEW / TRANG CHỦ</div><div className="visual-preview-frame"><Home products={draftProducts} siteConfig={draftConfig} setView={() => undefined} /></div></section>
      <aside className="visual-controls"><div className="visual-controls-heading"><p className="admin-kicker">NỘI DUNG GIAO DIỆN</p><h1>Chỉnh sửa trực quan</h1></div><section className="editor-card"><h2>Banner trang chủ</h2><label>Tiêu đề chính<input value={draftConfig.heroTitle} onChange={event => setDraftConfig({ ...draftConfig, heroTitle: event.target.value })} /></label><label>Tiêu đề nhấn mạnh<input value={draftConfig.heroAccent} onChange={event => setDraftConfig({ ...draftConfig, heroAccent: event.target.value })} /></label><label>Mô tả ngắn<textarea rows={4} value={draftConfig.heroDescription} onChange={event => setDraftConfig({ ...draftConfig, heroDescription: event.target.value })} /></label><label>URL ảnh banner<input value={draftConfig.heroImage} onChange={event => setDraftConfig({ ...draftConfig, heroImage: event.target.value })} /></label></section><section className="editor-card"><h2>Sản phẩm hiển thị</h2><label>Chọn sản phẩm<select value={selectedProductId} onChange={event => setSelectedProductId(Number(event.target.value))}>{draftProducts.map(product => <option value={product.id} key={product.id}>{product.name}</option>)}</select></label>{selected && <><label>Tên sản phẩm<input value={selected.name} onChange={event => updateSelected('name', event.target.value)} /></label><label>URL ảnh sản phẩm<input value={selected.image} onChange={event => updateSelected('image', event.target.value)} /></label><p className="editor-help">Thay đổi chỉ được ghi vào trình duyệt sau khi bấm “Lưu cho toàn trang”.</p></>}</section></aside>
    </div>
  </main>
}
