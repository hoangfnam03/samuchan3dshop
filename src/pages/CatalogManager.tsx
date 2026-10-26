import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'

interface Variant { id: string; sku: string; colorId?: string | null; color: string; sizeId?: string | null; size: string; priceVnd: number | null; stockQuantity: number; status: string }
interface Product { id: string; name: string; description: string; category: string | null; status: string; basePriceVnd: number; imageUrl: string | null; imageUrls?: string[]; demoVideoUrl: string | null; variants: Variant[] }
interface MasterOption { id: string; code: string; name: string; hex?: string | null }
interface MasterData { colors: MasterOption[]; sizes: MasterOption[]; categories: MasterOption[] }
type VariantDraft = { colorId: string; width: string; length: string; price: string; stock: string }
type ExistingVariantDraft = { colorId: string; sizeId: string; price: string; stock: string; status: string }

const money = (value: number) => new Intl.NumberFormat('vi-VN').format(value) + 'đ'
const slug = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '')

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = init?.body instanceof FormData ? { ...init?.headers } : { 'content-type': 'application/json', ...init?.headers }
  const response = await fetch(path, { ...init, credentials: 'include', headers })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || data.error || 'Request thất bại')
  return data
}

interface ProductEditorModalProps {
  product?: Product
  editingId: string
  categories: string[]
  master: MasterData
  files: File[]
  setFiles: (files: File[]) => void
  nameDraft: string
  setNameDraft: (value: string) => void
  variant: VariantDraft
  setVariant: (value: VariantDraft) => void
  previewSku: string
  existingVariants: Record<string, ExistingVariantDraft>
  setExistingVariant: (id: string, draft: ExistingVariantDraft) => void
  queuedVariants: VariantDraft[]
  showVariantCreator: boolean
  setShowVariantCreator: (value: boolean) => void
  queueVariant: () => void
  addVariant: () => Promise<void>
  cancelVariantCreation: () => void
  busy: boolean
  message: string
  save: (event: FormEvent<HTMLFormElement>) => Promise<void>
  onCancel: () => void
}

function ProductEditorModal({ product, editingId, categories, master, files, setFiles, nameDraft, setNameDraft, variant, setVariant, previewSku, existingVariants, setExistingVariant, queuedVariants, showVariantCreator, setShowVariantCreator, queueVariant, addVariant, cancelVariantCreation, busy, message, save, onCancel }: ProductEditorModalProps) {
  return <div className="admin-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onCancel() }}><section className="admin-modal catalog-editor-modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title"><div className="admin-modal-heading"><div><p className="admin-kicker">PRODUCT WORKSPACE</p><h2 id="product-modal-title">{product ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm'}</h2></div><button type="button" className="admin-modal-close" onClick={onCancel} disabled={busy}>×</button></div><form className="admin-product-form" onSubmit={save}><label>Tên sản phẩm<input name="name" value={nameDraft} onChange={event => setNameDraft(event.target.value)} required /></label><label>Danh mục<select name="category" defaultValue={product?.category ?? ''} key={editingId + '-category'}><option value="">Chọn danh mục</option>{categories.map(category => <option key={category} value={category}>{category}</option>)}</select></label><label>Giá cơ bản (VND)<input name="basePriceVnd" type="number" min="0" defaultValue={product?.basePriceVnd ?? 0} key={editingId + '-price'} required /></label><label>Trạng thái<select name="status" defaultValue={product?.status ?? 'draft'} key={editingId + '-status'}><option value="draft">Nháp</option><option value="active">Đang bán</option><option value="archived">Lưu trữ</option></select></label><label className="span-two">Mô tả<textarea name="description" defaultValue={product?.description ?? ''} key={editingId + '-description'} rows={3} /></label><label className="span-two">Chọn ảnh/video<input type="file" accept="image/*,video/*" multiple onChange={event => setFiles(Array.from(event.target.files ?? []))} /></label>{product && <section className="admin-modal-variants existing-variants-section"><div className="admin-modal-variants-heading"><div><h3>Variant hiện có</h3><span>Chỉnh tồn kho hoặc giá rồi bấm “Lưu sản phẩm và variant” ở cuối form.</span></div><span>{product.variants.length} variant</span></div>{product.variants.map(item => { const draft = existingVariants[item.id] ?? { colorId: item.colorId ?? '', sizeId: item.sizeId ?? '', price: item.priceVnd === null ? '' : String(item.priceVnd), stock: String(item.stockQuantity), status: item.status }; return <div className="admin-variant-form" key={item.id}><label>SKU<input value={item.sku} readOnly /></label><label>Màu sắc<ColorSelect options={master.colors} value={draft.colorId} onChange={colorId => setExistingVariant(item.id, { ...draft, colorId })} /></label><label>Kích thước<select value={draft.sizeId} onChange={event => setExistingVariant(item.id, { ...draft, sizeId: event.target.value })}><option value="">Chọn kích thước</option>{master.sizes.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label><label>Giá riêng<input type="number" min="0" value={draft.price} onChange={event => setExistingVariant(item.id, { ...draft, price: event.target.value })} /></label><label>Tồn kho<input type="number" min="0" value={draft.stock} onChange={event => setExistingVariant(item.id, { ...draft, stock: event.target.value })} /></label></div>})}</section>}<fieldset className={'span-two variant-fields ' + (showVariantCreator ? 'variant-creator-open' : 'variant-creator-closed')}><legend>Thêm variant</legend><div className="variant-editor-heading"><span>{showVariantCreator ? 'Thông tin variant mới' : 'Tạo variant mới khi cần'}</span><button type="button" className="button button-light" onClick={() => setShowVariantCreator(!showVariantCreator)} disabled={busy}>{showVariantCreator ? 'Thu gọn' : '＋ Thêm variant'}</button></div>{showVariantCreator && <><label>Màu sắc<ColorSelect options={master.colors} value={variant.colorId} onChange={colorId => setVariant({ ...variant, colorId })} /></label><label>Rộng<div className="dimension-input"><input type="number" min="0.1" step="0.1" value={variant.width} onChange={event => setVariant({ ...variant, width: event.target.value })} /><span>cm</span></div></label><label>Dài<div className="dimension-input"><input type="number" min="0.1" step="0.1" value={variant.length} onChange={event => setVariant({ ...variant, length: event.target.value })} /><span>cm</span></div></label><label>SKU tự tạo<input value={previewSku} readOnly /><small>Mã gồm tên sản phẩm, màu, kích thước và mã variant riêng.</small></label><label>Giá riêng<input type="number" min="0" value={variant.price} onChange={event => setVariant({ ...variant, price: event.target.value })} /></label><label>Tồn kho<input type="number" min="0" value={variant.stock} onChange={event => setVariant({ ...variant, stock: event.target.value })} /></label><div className="variant-creator-actions"><button type="button" className="button button-light" onClick={cancelVariantCreation} disabled={busy}>Hủy thêm variant</button><button type="button" className="button button-light" onClick={queueVariant} disabled={busy}>＋ Thêm vào danh sách</button></div>{queuedVariants.length > 0 && <div className="queued-variants"><b>{queuedVariants.length} variant đã sẵn sàng</b><button type="button" className="text-button" onClick={() => setVariant({ ...variant, width: '', length: '', price: '', stock: '0' })}>Đóng form</button></div>}</>}</fieldset><div className="admin-product-actions"><button className="button button-light" type="button" onClick={onCancel} disabled={busy}>Hủy</button><button className="button button-dark" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : product ? 'Lưu sản phẩm và variant' : 'Tạo sản phẩm'}</button></div>{message && <p className="admin-form-message span-two">{message}</p>}</form></section></div>
}

function ColorSelect({ options, value, onChange }: { options: MasterOption[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find(option => option.id === value)
  useEffect(() => {
    function close(event: MouseEvent) { if (!ref.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])
  return <div className="color-select-control" ref={ref}>
    <button type="button" className="color-select-trigger" onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open}><i style={{ backgroundColor: selected?.hex ?? '#e5e7eb' }} />{selected?.name ?? 'Chọn màu'}<span className="color-select-chevron">⌄</span></button>
    {open && <div className="color-select-menu" role="listbox">{options.map(option => <button type="button" role="option" aria-selected={option.id === value} className="color-select-option" key={option.id} onClick={() => { onChange(option.id); setOpen(false) }}><i style={{ backgroundColor: option.hex ?? '#e5e7eb' }} />{option.name}</button>)}</div>}
  </div>
}

export default function CatalogManager({ products, reload }: { products: Product[]; reload: () => Promise<void> }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [master, setMaster] = useState<MasterData>({ colors: [], sizes: [], categories: [] })
  const [files, setFiles] = useState<File[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [variant, setVariant] = useState<VariantDraft>({ colorId: '', width: '', length: '', price: '', stock: '0' })
  const [showVariantCreator, setShowVariantCreator] = useState(false)
  const [queuedVariants, setQueuedVariants] = useState<VariantDraft[]>([])
  const [existingVariants, setExistingVariants] = useState<Record<string, ExistingVariantDraft>>({})
  const product = products.find(item => item.id === editingId)
  const categories = useMemo(() => Array.from(new Set([...master.categories.map(item => item.name), ...products.map(item => item.category).filter((item): item is string => Boolean(item))])).sort(), [master.categories, products])
  const visibleProducts = useMemo(() => products.filter(item => item.name.toLocaleLowerCase('vi-VN').includes(search.toLocaleLowerCase('vi-VN')) && (!categoryFilter || item.category === categoryFilter)), [products, search, categoryFilter])

  useEffect(() => { api<{ data: MasterData }>('/api/admin/master-data').then(result => setMaster(result.data)).catch(() => undefined) }, [])
  useEffect(() => {
    setNameDraft(product?.name ?? '')
    setVariant({ colorId: product?.variants[0]?.colorId ?? master.colors[0]?.id ?? '', width: '', length: '', price: '', stock: '0' })
    setShowVariantCreator(!product)
    setQueuedVariants([])
    setExistingVariants(Object.fromEntries((product?.variants ?? []).map(item => [item.id, { colorId: item.colorId ?? '', sizeId: item.sizeId ?? '', price: item.priceVnd === null ? '' : String(item.priceVnd), stock: String(item.stockQuantity), status: item.status }])) as Record<string, ExistingVariantDraft>)
    setFiles([])
    setMessage('')
  }, [editingId, product?.id, master.colors])
  const selectedColor = useMemo(() => master.colors.find(item => item.id === variant.colorId), [master.colors, variant.colorId])
  const generatedSize = variant.width && variant.length ? `${variant.width}x${variant.length} cm` : ''
  const previewSku = `SAMU-${slug(nameDraft).slice(0, 24) || 'PRODUCT'}-${slug(selectedColor?.code ?? 'COLOR')}-${variant.width || 'W'}X${variant.length || 'L'}-AUTO`
  function finalSku(productId: string) { return `${previewSku.replace(/-AUTO$/, '')}-${productId.slice(0, 6).toUpperCase()}` }
  function queueVariant() {
    if (product) { void addVariant(); return }
    if (!showVariantCreator) { setShowVariantCreator(true); return }
    if (!variant.colorId || !variant.width || !variant.length) { setMessage('Vui lòng chọn màu và nhập đủ rộng, dài trước khi thêm variant.'); return }
    setQueuedVariants(items => [...items, variant])
    setVariant({ colorId: master.colors[0]?.id ?? '', width: '', length: '', price: '', stock: '0' })
    setMessage('Đã thêm variant vào danh sách chờ lưu.')
  }
  async function upload(productId: string) { if (!files.length) return [] as Array<{ url: string; mediaType: string }>; const form = new FormData(); form.set('productId', productId); files.forEach(file => form.append('files', file)); return (await api<{ data: Array<{ url: string; mediaType: string }> }>('/api/admin/media', { method: 'POST', body: form })).data }
  function cancelVariantCreation() { setVariant({ colorId: master.colors[0]?.id ?? '', width: '', length: '', price: '', stock: '0' }); setQueuedVariants([]); setShowVariantCreator(false); setMessage('') }
  async function addVariant() {
    if (!variant.colorId || !variant.width || !variant.length) { setMessage('Vui lòng chọn màu và nhập đủ rộng, dài cho variant.'); return }
    if (!product) { queueVariant(); return }
    setBusy(true); setMessage('')
    try {
      const sku = `SAMU-${slug(nameDraft).slice(0, 24) || 'PRODUCT'}-${slug(master.colors.find(item => item.id === variant.colorId)?.code ?? 'COLOR')}-${variant.width}X${variant.length}-${product.id.slice(0, 6).toUpperCase()}`
      await api('/api/admin/products/' + encodeURIComponent(product.id) + '/variants', { method: 'POST', body: JSON.stringify({ sku, colorId: variant.colorId, size: `${variant.width}x${variant.length} cm`, priceVnd: variant.price === '' ? null : Number(variant.price), stockQuantity: Number(variant.stock), status: 'active' }) })
      await reload()
      setVariant({ colorId: master.colors[0]?.id ?? '', width: '', length: '', price: '', stock: '0' })
      setShowVariantCreator(false)
      setMessage('Đã lưu variant mới.')
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Không thể lưu variant.') }
    finally { setBusy(false) }
  }
  if (editingId) return <ProductEditorModal product={product} editingId={editingId} categories={categories} master={master} files={files} setFiles={setFiles} nameDraft={nameDraft} setNameDraft={setNameDraft} variant={variant} setVariant={setVariant} previewSku={previewSku} existingVariants={existingVariants} setExistingVariant={(id, draft) => setExistingVariants(current => ({ ...current, [id]: draft }))} queuedVariants={queuedVariants} showVariantCreator={showVariantCreator} setShowVariantCreator={setShowVariantCreator} queueVariant={queueVariant} addVariant={addVariant} cancelVariantCreation={cancelVariantCreation} busy={busy} message={message} save={save} onCancel={() => setEditingId(null)} />
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(''); const form = new FormData(event.currentTarget)
    try {
      const base = { name: nameDraft, description: String(form.get('description') ?? ''), category: form.get('category') || null, status: form.get('status'), basePriceVnd: Number(form.get('basePriceVnd')) }
      const hasNewVariant = Boolean(queuedVariants.length || (variant.colorId && generatedSize))
      const hasPartialVariant = Boolean(variant.width || variant.length || variant.price)
      if (!product && !hasNewVariant) throw new Error(hasPartialVariant ? 'Vui lòng nhập đủ màu, rộng và dài cho variant.' : 'Vui lòng nhập ít nhất một variant.')
      if (product && hasPartialVariant && !(variant.colorId && generatedSize)) throw new Error('Vui lòng nhập đủ màu, rộng và dài cho variant mới hoặc để trống phần thêm variant.')
      let productId = editingId
      if (product) await api('/api/admin/products/' + encodeURIComponent(product.id), { method: 'PATCH', body: JSON.stringify(base) })
      else productId = (await api<{ data: { id: string } }>('/api/admin/products', { method: 'POST', body: JSON.stringify(base) })).data.id
      const uploaded = await upload(productId!)
      if (uploaded.length) { const previous = product?.imageUrls ?? (product?.imageUrl ? [product.imageUrl] : []); const images = [...previous, ...uploaded.filter(item => item.mediaType === 'image').map(item => item.url)]; const video = uploaded.find(item => item.mediaType === 'video')?.url; await api('/api/admin/products/' + encodeURIComponent(productId!), { method: 'PATCH', body: JSON.stringify({ imageUrls: images, ...(video ? { demoVideoUrl: video } : {}) }) }) }
      const drafts = [...queuedVariants, ...(variant.colorId && generatedSize ? [variant] : [])]
      if (!drafts.length && !product) throw new Error('Vui lòng nhập ít nhất một variant.')
      for (const draft of drafts) { const size = `${draft.width}x${draft.length} cm`; const sku = `SAMU-${slug(nameDraft).slice(0, 24) || 'PRODUCT'}-${slug(master.colors.find(item => item.id === draft.colorId)?.code ?? 'COLOR')}-${draft.width}X${draft.length}-${productId!.slice(0, 6).toUpperCase()}`; await api('/api/admin/products/' + encodeURIComponent(productId!) + '/variants', { method: 'POST', body: JSON.stringify({ sku, colorId: draft.colorId, size, priceVnd: draft.price === '' ? null : Number(draft.price), stockQuantity: Number(draft.stock), status: 'active' }) }) }
      if (product) for (const item of product.variants) { const draft = existingVariants[item.id]; if (draft?.colorId && draft.sizeId) await api('/api/admin/variants/' + encodeURIComponent(item.id), { method: 'PATCH', body: JSON.stringify({ colorId: draft.colorId, sizeId: draft.sizeId, priceVnd: draft.price === '' ? null : Number(draft.price), stockQuantity: Number(draft.stock), status: draft.status }) }) }
      await reload(); setEditingId(null); setFiles([])
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Không thể lưu sản phẩm.') } finally { setBusy(false) }
  }
  return <div className={'admin-catalog-manager ' + (showVariantCreator ? 'variant-creator-open' : 'variant-creator-closed')}>
    <section className="admin-panel catalog-list-panel">
      <div className="catalog-list-toolbar"><div><h2>Danh sách sản phẩm</h2><p>Quản lý thông tin, hình ảnh và các variant của sản phẩm.</p></div><button className="button button-dark" type="button" onClick={() => setEditingId('new')}>＋ Thêm sản phẩm</button></div>
      <div className="catalog-list-filters"><label>Tìm sản phẩm<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Nhập tên sản phẩm..." /></label><label>Danh mục<select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}><option value="">Tất cả danh mục</option>{categories.map(category => <option key={category} value={category}>{category}</option>)}</select></label></div>
      <div className="catalog-product-list">{visibleProducts.length ? visibleProducts.map(item => <article className="catalog-product-row" key={item.id}><div className="catalog-product-thumb">{(item.imageUrl || item.imageUrls?.[0]) && <img src={item.imageUrl || item.imageUrls?.[0] || ''} alt="" />}</div><div className="catalog-product-info"><h3>{item.name}</h3><span>{item.category || 'Chưa phân loại'} · {item.variants.length} variant</span></div><div className="catalog-product-meta"><b>{money(item.basePriceVnd)}</b><small className={'status-' + item.status}>{item.status === 'active' ? 'Đang bán' : item.status === 'archived' ? 'Lưu trữ' : 'Nháp'}</small></div><button className="button button-light" type="button" onClick={() => setEditingId(item.id)}>Chỉnh sửa</button></article>) : <p className="catalog-empty">Không tìm thấy sản phẩm phù hợp.</p>}</div>
    </section>
    {editingId && <div className="admin-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setEditingId(null) }}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title"><div className="admin-modal-heading"><div><p className="admin-kicker">PRODUCT WORKSPACE</p><h2 id="product-modal-title">{product ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm'}</h2></div><button type="button" className="admin-modal-close" onClick={() => setEditingId(null)} disabled={busy}>×</button></div><form className="admin-product-form" onSubmit={save}><label>Tên sản phẩm<input name="name" value={nameDraft} onChange={event => setNameDraft(event.target.value)} required /></label><label>Danh mục<select name="category" defaultValue={product?.category ?? ''} key={(editingId ?? '') + '-category'}><option value="">Chọn danh mục</option>{categories.map(category => <option key={category} value={category}>{category}</option>)}</select></label><label>Giá cơ bản (VND)<input name="basePriceVnd" type="number" min="0" defaultValue={product?.basePriceVnd ?? 0} key={(editingId ?? '') + '-price'} required /></label><label>Trạng thái<select name="status" defaultValue={product?.status ?? 'draft'} key={(editingId ?? '') + '-status'}><option value="draft">Nháp</option><option value="active">Đang bán</option><option value="archived">Lưu trữ</option></select></label><label className="span-two">Mô tả<textarea name="description" defaultValue={product?.description ?? ''} key={(editingId ?? '') + '-description'} rows={3} /></label><label className="span-two">Chọn ảnh/video<input type="file" accept="image/*,video/*" multiple onChange={event => setFiles(Array.from(event.target.files ?? []))} /></label><fieldset className="span-two variant-fields"><legend>{product ? 'Thêm variant' : 'Variant đầu tiên'}</legend><div className="variant-editor-heading"><span>Thông tin variant mới</span><button type="button" className="button button-light" onClick={queueVariant} disabled={busy}>＋ Thêm variant</button></div><label>Màu sắc<ColorSelect options={master.colors} value={variant.colorId} onChange={colorId => setVariant({ ...variant, colorId })} /></label><label>Rộng<div className="dimension-input"><input type="number" min="0.1" step="0.1" value={variant.width} onChange={event => setVariant({ ...variant, width: event.target.value })} /><span>cm</span></div></label><label>Dài<div className="dimension-input"><input type="number" min="0.1" step="0.1" value={variant.length} onChange={event => setVariant({ ...variant, length: event.target.value })} /><span>cm</span></div></label><label>SKU tự tạo<input value={previewSku} readOnly /><small>Mã gồm tên sản phẩm, màu, kích thước và mã variant riêng.</small></label><label>Giá riêng<input type="number" min="0" value={variant.price} onChange={event => setVariant({ ...variant, price: event.target.value })} /></label><label>Tồn kho<input type="number" min="0" value={variant.stock} onChange={event => setVariant({ ...variant, stock: event.target.value })} /></label>{queuedVariants.length > 0 && <div className="queued-variants"><b>{queuedVariants.length} variant đã sẵn sàng</b><button type="button" className="text-button" onClick={() => setQueuedVariants([])}>Xóa danh sách chờ</button></div>}</fieldset><div className="admin-product-actions"><button className="button button-light" type="button" onClick={() => setEditingId(null)} disabled={busy}>Hủy</button><button className="button button-dark" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : product ? 'Lưu sản phẩm và variant' : 'Tạo sản phẩm'}</button></div>{message && <p className="admin-form-message span-two">{message}</p>}</form>{product && <section className="admin-modal-variants"><div className="admin-modal-variants-heading"><h3>Variant hiện có</h3><span>Chỉnh sửa trực tiếp và bấm lưu ở cuối form.</span></div>{product.variants.map(item => { const draft = existingVariants[item.id] ?? { colorId: item.colorId ?? '', sizeId: item.sizeId ?? '', price: item.priceVnd === null ? '' : String(item.priceVnd), stock: String(item.stockQuantity), status: item.status }; return <div className="admin-variant-form" key={item.id}><label>SKU<input value={item.sku} readOnly /></label><label>Màu sắc<ColorSelect options={master.colors} value={draft.colorId} onChange={colorId => setExistingVariants(current => ({ ...current, [item.id]: { ...draft, colorId } }))} /></label><label>Kích thước<select value={draft.sizeId} onChange={event => setExistingVariants(current => ({ ...current, [item.id]: { ...draft, sizeId: event.target.value } }))}><option value="">Chọn kích thước</option>{master.sizes.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label><label>Giá riêng<input type="number" min="0" value={draft.price} onChange={event => setExistingVariants(current => ({ ...current, [item.id]: { ...draft, price: event.target.value } }))} /></label><label>Tồn kho<input type="number" min="0" value={draft.stock} onChange={event => setExistingVariants(current => ({ ...current, [item.id]: { ...draft, stock: event.target.value } }))} /></label></div>})}</section>}</section></div>}
  </div>
}
