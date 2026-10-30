import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import ProductMediaManager, { MediaDraft } from '../components/ProductMediaManager'
import { joinProductDescription, splitProductDescription } from '../utils/product-description'

interface Variant { id: string; sku: string; colorId?: string | null; color: string; sizeId?: string | null; size: string; priceVnd: number | null; stockQuantity: number; status: string }
interface Product { id: string; name: string; description: string; category: string | null; status: string; basePriceVnd: number; imageUrl: string | null; imageUrls?: string[]; demoVideoUrl: string | null; costItems?: Array<{ id: string; label: string; costVnd: number; sortOrder: number }>; totalCostVnd?: number; variants: Variant[] }
interface MasterOption { id: string; code: string; name: string; hex?: string | null; imageUrl?: string | null; materialType?: string }
interface MasterData { colors: MasterOption[]; sizes: MasterOption[]; categories: MasterOption[] }
type VariantDraft = { colorId: string; width: string; length: string; price: string; stock: string }
type ExistingVariantDraft = { colorId: string; sizeId: string; price: string; stock: string; status: string }
type CostDraft = { label: string; costVnd: string }

const money = (value: number) => new Intl.NumberFormat('vi-VN').format(value) + 'đ'
const slug = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '')
const filamentNames: Record<string, string> = { pla: 'PLA', pla_plus: 'PLA+', pla_matte: 'PLA Matte', pla_silk: 'PLA Silk' }
const colorLabel = (item?: MasterOption) => item ? `${item.name}${item.materialType ? ` · ${filamentNames[item.materialType] ?? (item.materialType === 'unclassified' ? 'Chưa phân loại' : item.materialType)}` : ''}` : 'Chọn màu'

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
  master: MasterData
  media: MediaDraft[]
  addMediaFiles: (files: File[]) => void
  removeMedia: (key: string) => void
  replaceMedia: (key: string, file: File) => void
  costItems: CostDraft[]
  setCostItems: (items: CostDraft[]) => void
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

function DescriptionEditor({ initialValue, name, title, placeholder }: { initialValue: string; name: string; title: string; placeholder: string }) {
  const [value, setValue] = useState(initialValue)
  const textarea = useRef<HTMLTextAreaElement>(null)
  function insertText(text: string, bold = false) {
    const input = textarea.current
    if (!input) return
    const start = input.selectionStart
    const end = input.selectionEnd
    const selected = value.slice(start, end)
    const inserted = bold ? `**${selected || 'Thông điệp quan trọng'}**` : '\n\n'
    const next = value.slice(0, start) + inserted + value.slice(end)
    setValue(next)
    requestAnimationFrame(() => {
      input.focus()
      const offset = bold && selected ? inserted.length : bold ? 2 : inserted.length
      const selectionStart = bold && !selected ? start + 2 : start + offset
      input.setSelectionRange(selectionStart, bold && !selected ? selectionStart + 'Thông điệp quan trọng'.length : selectionStart)
    })
  }
  return <div className="description-editor span-two">
    <label>{title}<textarea ref={textarea} name={name} value={value} onChange={event => setValue(event.target.value)} rows={name === 'descriptionStory' ? 8 : 5} placeholder={placeholder} /></label>
    <div className="description-editor-toolbar"><button type="button" className="button button-light" onClick={() => insertText('', true)}>In đậm đoạn chọn</button><button type="button" className="button button-light" onClick={() => insertText('\n\n')}>＋ Tách đoạn</button><small>Chọn chữ rồi bấm “In đậm”, hoặc dùng **hai dấu sao**. Dòng trống sẽ tạo đoạn mới.</small></div>
  </div>
}

function ProductEditorModal({ product, editingId, master, media, addMediaFiles, removeMedia, replaceMedia, costItems, setCostItems, nameDraft, setNameDraft, variant, setVariant, previewSku, existingVariants, setExistingVariant, queuedVariants, showVariantCreator, setShowVariantCreator, queueVariant, addVariant, cancelVariantCreation, busy, message, save, onCancel }: ProductEditorModalProps) {
  const descriptionSections = splitProductDescription(product?.description ?? '')
  return <div className="admin-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onCancel() }}><section className="admin-modal catalog-editor-modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title"><div className="admin-modal-heading"><div><p className="admin-kicker">PRODUCT WORKSPACE</p><h2 id="product-modal-title">{product ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm'}</h2></div><button type="button" className="admin-modal-close" onClick={onCancel} disabled={busy}>×</button></div><form className="admin-product-form" onSubmit={save}><label>Tên sản phẩm<input name="name" value={nameDraft} onChange={event => setNameDraft(event.target.value)} required /></label><label>Danh mục<input name="category" maxLength={80} defaultValue={product?.category ?? ''} key={editingId + '-category'} placeholder="Tự nhập tên danh mục" /><small>Danh mục chỉ được gán theo tên bạn nhập.</small></label><label>Giá cơ bản (VND)<input name="basePriceVnd" type="number" min="0" defaultValue={product?.basePriceVnd ?? 0} key={editingId + '-price'} required /></label><label>Trạng thái<select name="status" defaultValue={product?.status ?? 'draft'} key={editingId + '-status'}><option value="draft">Nháp</option><option value="active">Đang bán</option><option value="archived">Lưu trữ</option></select></label><DescriptionEditor key={(editingId ?? '') + '-story'} name="descriptionStory" title="Giới thiệu hiển thị dưới ảnh sản phẩm" placeholder="Thông điệp, câu chuyện và tính năng nổi bật. Dùng dòng trống để chia đoạn." initialValue={descriptionSections.introduction} /><DescriptionEditor key={(editingId ?? '') + '-details'} name="descriptionDetails" title="Thông tin sản phẩm hiển thị bên cạnh" placeholder="Ví dụ: Chất liệu, kích thước, thiết kế, cá nhân hóa, thương hiệu…" initialValue={descriptionSections.details} /><ProductMediaManager items={media} onAdd={addMediaFiles} onRemove={removeMedia} onReplace={replaceMedia} disabled={busy} /><fieldset className="span-two product-cost-editor"><legend>Giá vốn (chỉ admin)</legend><div className="cost-editor-summary"><p>Ghi từng khoản chi phí để tự cộng thành giá vốn của một sản phẩm.</p><b>Tổng giá vốn: {money(costItems.reduce((sum, item) => sum + (Number(item.costVnd) || 0), 0))}</b><button type="button" className="button button-light" onClick={() => setCostItems([...costItems, { label: '', costVnd: '' }])} disabled={busy || costItems.length >= 30}>＋ Thêm khoản chi phí</button></div>{costItems.map((item, index) => <div className="product-cost-row" key={index}><label>Tên khoản<input value={item.label} maxLength={100} placeholder="Ví dụ: Đóng gói" onChange={event => setCostItems(costItems.map((row, rowIndex) => rowIndex === index ? { ...row, label: event.target.value } : row))} /></label><label>Chi phí (VND)<input type="number" min="0" step="1" value={item.costVnd} onChange={event => setCostItems(costItems.map((row, rowIndex) => rowIndex === index ? { ...row, costVnd: event.target.value } : row))} /></label><button type="button" className="button button-light" onClick={() => setCostItems(costItems.filter((_, rowIndex) => rowIndex !== index))} disabled={busy}>Xóa khoản</button></div>)}</fieldset>{product && <section className="admin-modal-variants existing-variants-section"><div className="admin-modal-variants-heading"><div><h3>Variant hiện có</h3><span>Chỉnh tồn kho hoặc giá rồi bấm “Lưu sản phẩm và variant” ở cuối form.</span></div><span>{product.variants.length} variant</span></div>{product.variants.map(item => { const draft = existingVariants[item.id] ?? { colorId: item.colorId ?? '', sizeId: item.sizeId ?? '', price: item.priceVnd === null ? '' : String(item.priceVnd), stock: String(item.stockQuantity), status: item.status }; return <div className="admin-variant-form" key={item.id}><label>SKU<input value={item.sku} readOnly /></label><label>Màu sắc<ColorSelect options={master.colors} value={draft.colorId} onChange={colorId => setExistingVariant(item.id, { ...draft, colorId })} /></label><label>Kích thước<select value={draft.sizeId} onChange={event => setExistingVariant(item.id, { ...draft, sizeId: event.target.value })}><option value="">Chọn kích thước</option>{master.sizes.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label><label>Giá riêng<input type="number" min="0" value={draft.price} onChange={event => setExistingVariant(item.id, { ...draft, price: event.target.value })} /></label><label>Tồn kho<input type="number" min="0" value={draft.stock} onChange={event => setExistingVariant(item.id, { ...draft, stock: event.target.value })} /></label></div>})}</section>}<fieldset className={'span-two variant-fields ' + (showVariantCreator ? 'variant-creator-open' : 'variant-creator-closed')}><legend>Thêm variant</legend><div className="variant-editor-heading"><span>{showVariantCreator ? 'Thông tin variant mới' : 'Tạo variant mới khi cần'}</span><button type="button" className="button button-light" onClick={() => setShowVariantCreator(!showVariantCreator)} disabled={busy}>{showVariantCreator ? 'Thu gọn' : '＋ Thêm variant'}</button></div>{showVariantCreator && <><label>Màu sắc<ColorSelect options={master.colors} value={variant.colorId} onChange={colorId => setVariant({ ...variant, colorId })} /></label><label>Rộng<div className="dimension-input"><input type="number" min="0.1" step="0.1" value={variant.width} onChange={event => setVariant({ ...variant, width: event.target.value })} /><span>cm</span></div></label><label>Dài<div className="dimension-input"><input type="number" min="0.1" step="0.1" value={variant.length} onChange={event => setVariant({ ...variant, length: event.target.value })} /><span>cm</span></div></label><label>SKU tự tạo<input value={previewSku} readOnly /><small>Mã gồm tên sản phẩm, màu, kích thước và mã variant riêng.</small></label><label>Giá riêng<input type="number" min="0" value={variant.price} onChange={event => setVariant({ ...variant, price: event.target.value })} /></label><label>Tồn kho<input type="number" min="0" value={variant.stock} onChange={event => setVariant({ ...variant, stock: event.target.value })} /></label><div className="variant-creator-actions"><button type="button" className="button button-light" onClick={cancelVariantCreation} disabled={busy}>Hủy thêm variant</button><button type="button" className="button button-light" onClick={queueVariant} disabled={busy}>＋ Thêm vào danh sách</button></div>{queuedVariants.length > 0 && <div className="queued-variants"><b>{queuedVariants.length} variant đã sẵn sàng</b><button type="button" className="text-button" onClick={() => setVariant({ ...variant, width: '', length: '', price: '', stock: '0' })}>Đóng form</button></div>}</>}</fieldset><div className="admin-product-actions"><button className="button button-light" type="button" onClick={onCancel} disabled={busy}>Hủy</button><button className="button button-dark" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : product ? 'Lưu sản phẩm và variant' : 'Tạo sản phẩm'}</button></div>{message && <p className="admin-form-message span-two">{message}</p>}</form></section></div>
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
    <button type="button" className="color-select-trigger" onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open}>{selected?.imageUrl ? <img className="color-select-image" src={selected.imageUrl} alt="" /> : <i style={{ backgroundColor: selected?.hex ?? '#e5e7eb' }} />}{colorLabel(selected)}<span className="color-select-chevron">⌄</span></button>
    {open && <div className="color-select-menu" role="listbox">{options.map(option => <button type="button" role="option" aria-selected={option.id === value} className="color-select-option" key={option.id} onClick={() => { onChange(option.id); setOpen(false) }}>{option.imageUrl ? <img className="color-select-image" src={option.imageUrl} alt="" /> : <i style={{ backgroundColor: option.hex ?? '#e5e7eb' }} />}{colorLabel(option)}</button>)}</div>}
  </div>
}

export default function CatalogManager({ products, reload }: { products: Product[]; reload: () => Promise<void> }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [master, setMaster] = useState<MasterData>({ colors: [], sizes: [], categories: [] })
  const [media, setMedia] = useState<MediaDraft[]>([])
  const [costItems, setCostItems] = useState<CostDraft[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [categoryDraft, setCategoryDraft] = useState('')
  const [variant, setVariant] = useState<VariantDraft>({ colorId: '', width: '', length: '', price: '', stock: '0' })
  const [showVariantCreator, setShowVariantCreator] = useState(false)
  const [queuedVariants, setQueuedVariants] = useState<VariantDraft[]>([])
  const [existingVariants, setExistingVariants] = useState<Record<string, ExistingVariantDraft>>({})
  const product = products.find(item => item.id === editingId)
  const descriptionSections = splitProductDescription(product?.description ?? '')
  const categories = useMemo(() => Array.from(new Set(products.map(item => item.category).filter((item): item is string => Boolean(item)))), [products])
  const visibleProducts = useMemo(() => products.filter(item => item.name.toLocaleLowerCase('vi-VN').includes(search.toLocaleLowerCase('vi-VN')) && (!categoryFilter || item.category === categoryFilter)), [products, search, categoryFilter])
  const allVisibleSelected = visibleProducts.length > 0 && visibleProducts.every(item => selectedIds.includes(item.id))

  useEffect(() => { setSelectedIds(current => current.filter(id => products.some(item => item.id === id))) }, [products])

  useEffect(() => { api<{ data: MasterData }>('/api/admin/master-data').then(result => setMaster(result.data)).catch(() => undefined) }, [])
  useEffect(() => {
    setNameDraft(product?.name ?? '')
    setCostItems((product?.costItems ?? []).map(item => ({ label: item.label, costVnd: String(item.costVnd) })))
    setVariant({ colorId: product?.variants[0]?.colorId ?? master.colors[0]?.id ?? '', width: '', length: '', price: '', stock: '0' })
    setShowVariantCreator(!product)
    setQueuedVariants([])
    setExistingVariants(Object.fromEntries((product?.variants ?? []).map(item => [item.id, { colorId: item.colorId ?? '', sizeId: item.sizeId ?? '', price: item.priceVnd === null ? '' : String(item.priceVnd), stock: String(item.stockQuantity), status: item.status }])) as Record<string, ExistingVariantDraft>)
    setMessage('')
  }, [editingId, product?.id, master.colors])
  useEffect(() => {
    setMedia([
      ...(product?.imageUrls ?? (product?.imageUrl ? [product.imageUrl] : [])).map((url, index) => ({ key: `saved-image-${index}-${url}`, type: 'image' as const, url })),
      ...(product?.demoVideoUrl ? [{ key: `saved-video-${product.id}`, type: 'video' as const, url: product.demoVideoUrl }] : []),
    ])
  }, [editingId, product?.id])
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
  function addMediaFiles(incoming: File[]) {
    const remaining = Math.max(0, 12 - media.filter(item => item.file).length)
    const accepted: MediaDraft[] = []
    for (const file of incoming) {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) continue
      if (file.type.startsWith('video/') && (media.some(item => item.type === 'video') || accepted.some(item => item.type === 'video'))) { setMessage('Mỗi sản phẩm chỉ hỗ trợ một video.'); continue }
      if (accepted.length >= remaining) { setMessage('Mỗi lần lưu có thể tải lên tối đa 12 file mới.'); break }
      accepted.push({ key: crypto.randomUUID(), type: file.type.startsWith('video/') ? 'video' : 'image', url: URL.createObjectURL(file), file })
    }
    if (accepted.length) setMedia(current => [...current, ...accepted])
  }
  function removeMedia(key: string) {
    const target = media.find(item => item.key === key)
    if (target?.file) URL.revokeObjectURL(target.url)
    setMedia(current => current.filter(item => item.key !== key))
  }
  function replaceMedia(key: string, file: File) {
    const target = media.find(item => item.key === key)
    if (!target) return
    if (target.file) URL.revokeObjectURL(target.url)
    setMedia(current => current.map(item => item.key === key ? { ...item, url: URL.createObjectURL(file), file } : item))
  }
  function discardMediaDraft() {
    for (const item of media) if (item.file) URL.revokeObjectURL(item.url)
    setMedia([])
  }
  function closeEditor() { discardMediaDraft(); setEditingId(null) }
  async function upload(productId: string, uploadFiles: File[]) {
    if (!uploadFiles.length) return [] as Array<{ url: string; mediaType: string }>
    const form = new FormData(); form.set('productId', productId); uploadFiles.forEach(file => form.append('files', file))
    return (await api<{ data: Array<{ url: string; mediaType: string }> }>('/api/admin/media', { method: 'POST', body: form })).data
  }
  async function deleteSelected() {
    const targets = products.filter(item => selectedIds.includes(item.id))
    if (!targets.length || !window.confirm(`Bạn chắc chắn muốn xóa ${targets.length} sản phẩm đã chọn? Thao tác này không thể hoàn tác.`)) return
    setBusy(true); setMessage('')
    const blocked: string[] = []; const failed: string[] = []; let deleted = 0
    try {
      for (const item of targets) {
        try { await api('/api/admin/products/' + encodeURIComponent(item.id), { method: 'DELETE' }); deleted++ }
        catch (reason) { (reason instanceof Error && reason.message.includes('đơn hàng') ? blocked : failed).push(item.name) }
      }
      setSelectedIds(current => current.filter(id => targets.some(item => item.id === id && (blocked.includes(item.name) || failed.includes(item.name)))))
      await reload()
      setMessage([deleted ? `Đã xóa ${deleted} sản phẩm.` : '', blocked.length ? `${blocked.length} sản phẩm có đơn hàng nên được giữ lại.` : '', failed.length ? `Không thể xóa ${failed.length} sản phẩm do lỗi request.` : ''].filter(Boolean).join(' '))
    } finally { setBusy(false) }
  }
  async function assignCategory() {
    const category = categoryDraft.trim()
    const targets = products.filter(item => selectedIds.includes(item.id))
    if (!category || !targets.length) return
    setBusy(true); setMessage('')
    const failed: string[] = []; let updated = 0
    try {
      for (const item of targets) {
        try { await api('/api/admin/products/' + encodeURIComponent(item.id), { method: 'PATCH', body: JSON.stringify({ category }) }); updated++ }
        catch { failed.push(item.name) }
      }
      await reload()
      if (!failed.length) setSelectedIds(current => current.filter(id => !targets.some(item => item.id === id)))
      setMessage([updated ? `Đã gán danh mục “${category}” cho ${updated} sản phẩm.` : '', failed.length ? `Không thể cập nhật ${failed.length} sản phẩm.` : ''].filter(Boolean).join(' '))
    } finally { setBusy(false) }
  }
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
  if (editingId) return <ProductEditorModal product={product} editingId={editingId} master={master} media={media} addMediaFiles={addMediaFiles} removeMedia={removeMedia} replaceMedia={replaceMedia} costItems={costItems} setCostItems={setCostItems} nameDraft={nameDraft} setNameDraft={setNameDraft} variant={variant} setVariant={setVariant} previewSku={previewSku} existingVariants={existingVariants} setExistingVariant={(id, draft) => setExistingVariants(current => ({ ...current, [id]: draft }))} queuedVariants={queuedVariants} showVariantCreator={showVariantCreator} setShowVariantCreator={setShowVariantCreator} queueVariant={queueVariant} addVariant={addVariant} cancelVariantCreation={cancelVariantCreation} busy={busy} message={message} save={save} onCancel={closeEditor} />
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(''); const form = new FormData(event.currentTarget)
    try {
      const enteredCostItems = costItems.filter(item => item.label.trim() || item.costVnd.trim())
      if (enteredCostItems.length > 30 || enteredCostItems.some(item => !item.label.trim() || item.costVnd.trim() === '' || !Number.isSafeInteger(Number(item.costVnd)) || Number(item.costVnd) < 0 || Number(item.costVnd) > 2000000000)) throw new Error('Kiểm tra lại tên và số tiền của từng khoản giá vốn.')
      const costItemsPayload = enteredCostItems.map(item => ({ label: item.label.trim(), costVnd: Number(item.costVnd) }))
      const base = { name: nameDraft, description: joinProductDescription(String(form.get('descriptionStory') ?? ''), String(form.get('descriptionDetails') ?? '')), category: String(form.get('category') ?? '').trim() || null, status: form.get('status'), basePriceVnd: Number(form.get('basePriceVnd')), costItems: costItemsPayload }
      const hasNewVariant = Boolean(queuedVariants.length || (variant.colorId && generatedSize))
      const hasPartialVariant = Boolean(variant.width || variant.length || variant.price)
      if (!product && !hasNewVariant) throw new Error(hasPartialVariant ? 'Vui lòng nhập đủ màu, rộng và dài cho variant.' : 'Vui lòng nhập ít nhất một variant.')
      if (product && hasPartialVariant && !(variant.colorId && generatedSize)) throw new Error('Vui lòng nhập đủ màu, rộng và dài cho variant mới hoặc để trống phần thêm variant.')
      let productId = editingId
      if (product) await api('/api/admin/products/' + encodeURIComponent(product.id), { method: 'PATCH', body: JSON.stringify(base) })
      else productId = (await api<{ data: { id: string } }>('/api/admin/products', { method: 'POST', body: JSON.stringify(base) })).data.id
      const newFiles = media.filter(item => item.file).map(item => item.file!)
      const uploaded = await upload(productId!, newFiles)
      let uploadedIndex = 0
      const savedMedia = media.map(item => item.file ? { ...item, file: undefined, url: uploaded[uploadedIndex++].url } : item)
      const imageUrls = savedMedia.filter(item => item.type === 'image').map(item => item.url)
      const demoVideoUrl = savedMedia.find(item => item.type === 'video')?.url ?? null
      await api('/api/admin/products/' + encodeURIComponent(productId!), { method: 'PATCH', body: JSON.stringify({ imageUrls, demoVideoUrl }) })
      const drafts = [...queuedVariants, ...(variant.colorId && generatedSize ? [variant] : [])]
      if (!drafts.length && !product) throw new Error('Vui lòng nhập ít nhất một variant.')
      for (const draft of drafts) { const size = `${draft.width}x${draft.length} cm`; const sku = `SAMU-${slug(nameDraft).slice(0, 24) || 'PRODUCT'}-${slug(master.colors.find(item => item.id === draft.colorId)?.code ?? 'COLOR')}-${draft.width}X${draft.length}-${productId!.slice(0, 6).toUpperCase()}`; await api('/api/admin/products/' + encodeURIComponent(productId!) + '/variants', { method: 'POST', body: JSON.stringify({ sku, colorId: draft.colorId, size, priceVnd: draft.price === '' ? null : Number(draft.price), stockQuantity: Number(draft.stock), status: 'active' }) }) }
      if (product) for (const item of product.variants) { const draft = existingVariants[item.id]; if (draft?.colorId && draft.sizeId) await api('/api/admin/variants/' + encodeURIComponent(item.id), { method: 'PATCH', body: JSON.stringify({ colorId: draft.colorId, sizeId: draft.sizeId, priceVnd: draft.price === '' ? null : Number(draft.price), stockQuantity: Number(draft.stock), status: draft.status }) }) }
      await reload(); discardMediaDraft(); setEditingId(null)
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Không thể lưu sản phẩm.') } finally { setBusy(false) }
  }
  return <div className={'admin-catalog-manager ' + (showVariantCreator ? 'variant-creator-open' : 'variant-creator-closed')}>
    <section className="admin-panel catalog-list-panel">
      <div className="catalog-list-toolbar"><div><h2>Danh sách sản phẩm</h2><p>Quản lý thông tin, hình ảnh và các variant của sản phẩm.</p></div><div className="catalog-toolbar-actions"><button className="button button-light catalog-delete-button" type="button" onClick={() => void deleteSelected()} disabled={!selectedIds.length || busy}>Xóa đã chọn ({selectedIds.length})</button><button className="button button-dark" type="button" onClick={() => setEditingId('new')}>＋ Thêm sản phẩm</button></div></div>
      <div className="catalog-list-filters"><label>Tìm sản phẩm<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Nhập tên sản phẩm..." /></label><label>Danh mục<select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}><option value="">Tất cả danh mục</option>{categories.map(category => <option key={category} value={category}>{category}</option>)}</select></label></div>
      {visibleProducts.length > 0 && <label className="catalog-select-all"><input type="checkbox" checked={allVisibleSelected} onChange={event => setSelectedIds(current => event.target.checked ? Array.from(new Set([...current, ...visibleProducts.map(item => item.id)])) : current.filter(id => !visibleProducts.some(item => item.id === id)))} /> Chọn tất cả sản phẩm đang hiển thị ({visibleProducts.length})</label>}
      {selectedIds.length > 0 && <div className="catalog-category-bulk"><span>Đã chọn {selectedIds.length} sản phẩm</span><label>Tên danh mục<input value={categoryDraft} onChange={event => setCategoryDraft(event.target.value)} maxLength={80} placeholder="Nhập tên danh mục bạn muốn" /></label><button className="button button-dark" type="button" onClick={() => void assignCategory()} disabled={busy || !categoryDraft.trim()}>Gán danh mục</button></div>}
      <div className="catalog-product-list">{visibleProducts.length ? visibleProducts.map(item => <article className="catalog-product-row" key={item.id}><label className="catalog-product-select" aria-label={`Chọn ${item.name}`}><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={event => setSelectedIds(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))} /></label><div className="catalog-product-thumb">{(item.imageUrl || item.imageUrls?.[0]) && <img src={item.imageUrl || item.imageUrls?.[0] || ''} alt="" />}</div><div className="catalog-product-info"><h3>{item.name}</h3><span>{item.category || 'Chưa phân loại'} · {item.variants.length} variant</span></div><div className="catalog-product-meta"><span className="catalog-price-pair"><small>Giá bán</small><b>{money(item.basePriceVnd)}</b></span><span className="catalog-price-pair catalog-cost-pair"><small>Giá vốn</small><b>{money(item.totalCostVnd ?? 0)}</b></span><small className={'status-' + item.status}>{item.status === 'active' ? 'Đang bán' : item.status === 'archived' ? 'Lưu trữ' : 'Nháp'}</small></div><button className="button button-light" type="button" onClick={() => setEditingId(item.id)}>Chỉnh sửa</button></article>) : <p className="catalog-empty">Không tìm thấy sản phẩm phù hợp.</p>}</div>
      {message && <p className="catalog-bulk-message" role="status">{message}</p>}
    </section>
    {editingId && <div className="admin-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setEditingId(null) }}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title"><div className="admin-modal-heading"><div><p className="admin-kicker">PRODUCT WORKSPACE</p><h2 id="product-modal-title">{product ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm'}</h2></div><button type="button" className="admin-modal-close" onClick={() => setEditingId(null)} disabled={busy}>×</button></div><form className="admin-product-form" onSubmit={save}><label>Tên sản phẩm<input name="name" value={nameDraft} onChange={event => setNameDraft(event.target.value)} required /></label><label>Danh mục<select name="category" defaultValue={product?.category ?? ''} key={(editingId ?? '') + '-category'}><option value="">Chọn danh mục</option>{categories.map(category => <option key={category} value={category}>{category}</option>)}</select></label><label>Giá cơ bản (VND)<input name="basePriceVnd" type="number" min="0" defaultValue={product?.basePriceVnd ?? 0} key={(editingId ?? '') + '-price'} required /></label><label>Trạng thái<select name="status" defaultValue={product?.status ?? 'draft'} key={(editingId ?? '') + '-status'}><option value="draft">Nháp</option><option value="active">Đang bán</option><option value="archived">Lưu trữ</option></select></label><DescriptionEditor key={(editingId ?? '') + '-story'} name="descriptionStory" title="Giới thiệu hiển thị dưới ảnh sản phẩm" placeholder="Thông điệp, câu chuyện và tính năng nổi bật. Dùng dòng trống để chia đoạn." initialValue={descriptionSections.introduction} /><DescriptionEditor key={(editingId ?? '') + '-details'} name="descriptionDetails" title="Thông tin sản phẩm hiển thị bên cạnh" placeholder="Ví dụ: Chất liệu, kích thước, thiết kế, cá nhân hóa, thương hiệu…" initialValue={descriptionSections.details} /><ProductMediaManager items={media} onAdd={addMediaFiles} onRemove={removeMedia} onReplace={replaceMedia} disabled={busy} /><fieldset className="span-two variant-fields"><legend>{product ? 'Thêm variant' : 'Variant đầu tiên'}</legend><div className="variant-editor-heading"><span>Thông tin variant mới</span><button type="button" className="button button-light" onClick={queueVariant} disabled={busy}>＋ Thêm variant</button></div><label>Màu sắc<ColorSelect options={master.colors} value={variant.colorId} onChange={colorId => setVariant({ ...variant, colorId })} /></label><label>Rộng<div className="dimension-input"><input type="number" min="0.1" step="0.1" value={variant.width} onChange={event => setVariant({ ...variant, width: event.target.value })} /><span>cm</span></div></label><label>Dài<div className="dimension-input"><input type="number" min="0.1" step="0.1" value={variant.length} onChange={event => setVariant({ ...variant, length: event.target.value })} /><span>cm</span></div></label><label>SKU tự tạo<input value={previewSku} readOnly /><small>Mã gồm tên sản phẩm, màu, kích thước và mã variant riêng.</small></label><label>Giá riêng<input type="number" min="0" value={variant.price} onChange={event => setVariant({ ...variant, price: event.target.value })} /></label><label>Tồn kho<input type="number" min="0" value={variant.stock} onChange={event => setVariant({ ...variant, stock: event.target.value })} /></label>{queuedVariants.length > 0 && <div className="queued-variants"><b>{queuedVariants.length} variant đã sẵn sàng</b><button type="button" className="text-button" onClick={() => setQueuedVariants([])}>Xóa danh sách chờ</button></div>}</fieldset><div className="admin-product-actions"><button className="button button-light" type="button" onClick={() => setEditingId(null)} disabled={busy}>Hủy</button><button className="button button-dark" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : product ? 'Lưu sản phẩm và variant' : 'Tạo sản phẩm'}</button></div>{message && <p className="admin-form-message span-two">{message}</p>}</form>{product && <section className="admin-modal-variants"><div className="admin-modal-variants-heading"><h3>Variant hiện có</h3><span>Chỉnh sửa trực tiếp và bấm lưu ở cuối form.</span></div>{product.variants.map(item => { const draft = existingVariants[item.id] ?? { colorId: item.colorId ?? '', sizeId: item.sizeId ?? '', price: item.priceVnd === null ? '' : String(item.priceVnd), stock: String(item.stockQuantity), status: item.status }; return <div className="admin-variant-form" key={item.id}><label>SKU<input value={item.sku} readOnly /></label><label>Màu sắc<ColorSelect options={master.colors} value={draft.colorId} onChange={colorId => setExistingVariants(current => ({ ...current, [item.id]: { ...draft, colorId } }))} /></label><label>Kích thước<select value={draft.sizeId} onChange={event => setExistingVariants(current => ({ ...current, [item.id]: { ...draft, sizeId: event.target.value } }))}><option value="">Chọn kích thước</option>{master.sizes.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label><label>Giá riêng<input type="number" min="0" value={draft.price} onChange={event => setExistingVariants(current => ({ ...current, [item.id]: { ...draft, price: event.target.value } }))} /></label><label>Tồn kho<input type="number" min="0" value={draft.stock} onChange={event => setExistingVariants(current => ({ ...current, [item.id]: { ...draft, stock: event.target.value } }))} /></label></div>})}</section>}</section></div>}
  </div>
}
