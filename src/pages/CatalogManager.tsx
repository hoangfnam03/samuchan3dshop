import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import ProductMediaManager, { ImageCropModal, MediaDraft } from '../components/ProductMediaManager'
import FilamentTypeProductModal, { type FilamentTypePrice, type FilamentTypePricePayload } from '../components/FilamentTypeProductModal'
import FilamentPurchaseBatchModal, { FilamentPurchaseBatchDetails, formatBatchDate, type FilamentPurchaseBatchPayload, type FilamentPurchaseBaseline, type FilamentPurchaseHistoryItem } from '../components/FilamentPurchaseBatchModal'
import { joinProductDescription, splitProductDescription } from '../utils/product-description'

interface Variant { id: string; sku: string; colorId?: string | null; color: string; sizeId?: string | null; size: string; priceVnd: number | null; stockQuantity: number; status: string; imageUrl?: string | null }
interface Product { id: string; name: string; description: string; category: string | null; status: string; basePriceVnd: number; discountPercent?: number; discountEndsOn?: string | null; imageUrl: string | null; imageUrls?: string[]; colorPreviewUrl?: string | null; filamentTypes?: string[]; filamentType?: string | null; demoVideoUrl: string | null; costItems?: Array<{ id: string; label: string; costVnd: number; sortOrder: number; fixedCostId?: string | null }>; totalCostVnd?: number; variants: Variant[] }
interface FixedCostItem { id: string; label: string; costVnd: number; sortOrder: number }
interface MasterOption { id: string; code: string; name: string; hex?: string | null; imageUrl?: string | null; brand?: string | null; materialType?: string; isActive?: boolean | number }
interface FixedFilamentCostItem { id: string; label: string; costVnd: number; sortOrder: number }
interface MasterData { colors: MasterOption[]; sizes: MasterOption[]; categories: MasterOption[]; filamentTypePrices: FilamentTypePrice[]; filamentPurchaseBaselines: FilamentPurchaseBaseline[]; fixedFilamentCostItems: FixedFilamentCostItem[] }
type VariantDraft = { colorId: string; width: string; length: string; price: string; imageFile?: File; imagePreview?: string }
type ExistingVariantDraft = { colorId: string; sizeId: string; price: string; status: string; imageUrl?: string | null; imageFile?: File; imagePreview?: string; removeImage?: boolean }
type CostDraft = { label: string; costVnd: string; isFixed: boolean; fixedCostId?: string }

const money = (value: number) => new Intl.NumberFormat('vi-VN').format(value) + 'đ'
const slug = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '')
const filamentNames: Record<string, string> = { pla: 'PLA', pla_plus: 'PLA+', pla_matte: 'PLA Matte', pla_silk: 'PLA Silk' }
const filamentTypeKey = (value: string) => value.normalize('NFC').trim().toLocaleLowerCase('vi-VN')
const filamentLabel = (value: string) => { const key = value.trim().toLocaleLowerCase('vi-VN').replace(/\+/g, '_plus').replace(/[\s-]+/g, '_'); return filamentNames[key] ?? value }
const colorLabel = (item?: MasterOption) => item ? `${item.name}${item.brand ? ` · ${item.brand}` : ''}${item.materialType ? ` · ${filamentNames[item.materialType] ?? (item.materialType === 'unclassified' ? 'Chưa phân loại' : item.materialType)}` : ''}${item.isActive === false || item.isActive === 0 ? ' · Chưa có sẵn · đợi 7 ngày' : ''}` : 'Chọn màu'
const normalizeColorSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLocaleLowerCase('vi')

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
  colorPreviewUrl?: string
  colorPreviewFile?: File
  setColorPreviewFile: (file: File) => void
  removeColorPreview: () => void
  addMediaFiles: (files: File[]) => void
  removeMedia: (key: string) => void
  replaceMedia: (key: string, file: File) => void
  costItems: CostDraft[]
  setCostItems: (items: CostDraft[]) => void
  removedFixedCostIds: string[]
  setRemovedFixedCostIds: (ids: string[]) => void
  nameDraft: string
  setNameDraft: (value: string) => void
  variant: VariantDraft
  setVariant: (value: VariantDraft) => void
  previewSku: string
  setVariantImage: (file: File | null) => void
  existingVariants: Record<string, ExistingVariantDraft>
  setExistingVariant: (id: string, draft: ExistingVariantDraft) => void
  setExistingVariantImage: (id: string, file: File | null) => void
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

function VariantImageField({ imageUrl, disabled, onSelect }: { imageUrl?: string | null; disabled: boolean; onSelect: (file: File | null) => void }) {
  const [cropping, setCropping] = useState(false)
  const cropItem: MediaDraft | null = imageUrl ? { key: 'variant-image', type: 'image', url: imageUrl } : null
  return <div className="variant-image-field"><label>Ảnh cho variant<input type="file" accept="image/*" disabled={disabled} onChange={event => { const selectedFile = event.target.files?.[0] ?? null; event.currentTarget.value = ''; if (selectedFile) onSelect(selectedFile) }} /><small>Ảnh sẽ nằm trong gallery và tự hiện khi khách chọn variant này.</small></label>{imageUrl && <div className="variant-image-preview"><img src={imageUrl} alt="Ảnh variant" /><div className="variant-image-actions"><button className="button button-light" type="button" onClick={() => setCropping(true)} disabled={disabled}>Cắt ảnh</button><button className="button button-light media-remove" type="button" onClick={() => onSelect(null)} disabled={disabled}>Xóa ảnh</button></div></div>}{cropping && cropItem && <ImageCropModal item={cropItem} onCancel={() => setCropping(false)} onSave={croppedFile => { onSelect(croppedFile); setCropping(false) }} />}</div>
}

function ProductColorPreviewField({ imageUrl, file, disabled, onSelect, onRemove }: { imageUrl?: string; file?: File; disabled: boolean; onSelect: (file: File) => void; onRemove: () => void }) {
  const [cropping, setCropping] = useState(false)
  const cropItem: MediaDraft | null = imageUrl ? { key: 'product-color-preview', type: 'image', url: imageUrl, file } : null
  return <section className="span-two product-color-preview-field"><div className="product-color-preview-heading"><div><b>Ảnh preview nhúng màu</b><small>Ảnh riêng để thử màu ở trang tùy chỉnh, không đưa vào gallery sản phẩm.</small></div><label className="button button-light product-color-preview-add">Chọn ảnh<input type="file" accept="image/*" disabled={disabled} onChange={event => { const selectedFile = event.target.files?.[0]; event.currentTarget.value = ''; if (selectedFile) onSelect(selectedFile) }} /></label></div>{imageUrl ? <div className="product-color-preview-card"><img src={imageUrl} alt="Ảnh xem trước để nhúng màu" /><div className="variant-image-actions"><button className="button button-light" type="button" onClick={() => setCropping(true)} disabled={disabled}>Cắt ảnh</button><button className="button button-light media-remove" type="button" onClick={onRemove} disabled={disabled}>Xóa ảnh</button></div></div> : <p className="product-color-preview-empty">Chưa có ảnh preview. Chọn ảnh rõ hình sản phẩm để khách xem màu tùy chỉnh.</p>}{cropping && cropItem && <ImageCropModal item={cropItem} onCancel={() => setCropping(false)} onSave={croppedFile => { onSelect(croppedFile); setCropping(false) }} />}</section>
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

function ProductEditorModal({ product, editingId, master, media, colorPreviewUrl, colorPreviewFile, setColorPreviewFile, removeColorPreview, addMediaFiles, removeMedia, replaceMedia, costItems, setCostItems, removedFixedCostIds, setRemovedFixedCostIds, nameDraft, setNameDraft, variant, setVariant, previewSku, setVariantImage, existingVariants, setExistingVariant, setExistingVariantImage, queuedVariants, showVariantCreator, setShowVariantCreator, queueVariant, addVariant, cancelVariantCreation, busy, message, save, onCancel }: ProductEditorModalProps) {
  const descriptionSections = splitProductDescription(product?.description ?? '')
  const allColors = master.colors
  const [filamentTypes, setFilamentTypes] = useState<string[]>(product?.filamentTypes?.length ? product.filamentTypes : product?.filamentType ? [product.filamentType] : [])
  const materialTypes = useMemo(() => [...new Set([...allColors.map(item => item.materialType), ...(product?.filamentTypes ?? []), ...(product?.filamentType ? [product.filamentType] : []), ...filamentTypes].filter((value): value is string => Boolean(value)))].sort(), [allColors, filamentTypes, product?.filamentType, product?.filamentTypes])
  const colorOptions = allColors
  useEffect(() => {
    if (filamentTypes.length || !product || !master.colors.length) return
    const existingType = master.colors.find(item => item.id === product.variants[0]?.colorId)?.materialType
    if (existingType) setFilamentTypes([existingType])
  }, [filamentTypes, master.colors, product])
  function colorOptionsIncludingCurrent(colorId: string) {
    const currentColor = master.colors.find(item => item.id === colorId)
    return currentColor && !colorOptions.some(item => item.id === colorId) ? [...colorOptions, currentColor] : colorOptions
  }
  return <div className="admin-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onCancel() }}><section className="admin-modal catalog-editor-modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title"><div className="admin-modal-heading"><div><p className="admin-kicker">PRODUCT WORKSPACE</p><h2 id="product-modal-title">{product ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm'}</h2></div><button type="button" className="admin-modal-close" onClick={onCancel} disabled={busy}>×</button></div><form className="admin-product-form" onSubmit={save}><label>Tên sản phẩm<input name="name" value={nameDraft} onChange={event => setNameDraft(event.target.value)} required /></label><fieldset className="product-filament-field span-two"><legend>Loại nhựa cho preview màu tùy chỉnh</legend>{filamentTypes.map(type => <input key={type} type="hidden" name="filamentTypes" value={type} />)}<div className="filament-type-options">{materialTypes.map(type => <label className="filament-type-option" key={type}><input type="checkbox" checked={filamentTypes.includes(type)} onChange={event => setFilamentTypes(current => event.target.checked ? [...current, type] : current.filter(value => value !== type))} /><span><b>{filamentNames[type] ?? (type === 'unclassified' ? 'Chưa phân loại' : type)}</b><small>{allColors.filter(item => item.materialType === type).length} màu trong nhóm</small></span></label>)}</div><small>Chọn một hoặc nhiều loại nhựa. Preview chỉ hiện màu thuộc các nhóm đã chọn; không giới hạn màu variant.</small></fieldset><label>Danh mục<input name="category" maxLength={80} defaultValue={product?.category ?? ''} key={editingId + '-category'} placeholder="Tự nhập tên danh mục" /><small>Danh mục chỉ được gán theo tên bạn nhập.</small></label><label>Giá cơ bản (VND)<input name="basePriceVnd" type="number" min="0" defaultValue={product?.basePriceVnd ?? 0} key={editingId + '-price'} required /></label><label>Giảm giá (%)<input name="discountPercent" type="number" min="0" max="99" step="1" defaultValue={product?.discountPercent ?? 0} key={editingId + '-discount'} /></label><label>Giảm giá tới ngày<input name="discountEndsOn" type="date" defaultValue={product?.discountEndsOn ?? ''} key={editingId + '-discount-date'} /></label><label>Trạng thái<select name="status" defaultValue={product?.status ?? 'draft'} key={editingId + '-status'}><option value="draft">Nháp</option><option value="active">Đang bán</option><option value="archived">Lưu trữ</option></select></label><DescriptionEditor key={(editingId ?? '') + '-story'} name="descriptionStory" title="Giới thiệu hiển thị dưới ảnh sản phẩm" placeholder="Thông điệp, câu chuyện và tính năng nổi bật. Dùng dòng trống để chia đoạn." initialValue={descriptionSections.introduction} /><DescriptionEditor key={(editingId ?? '') + '-details'} name="descriptionDetails" title="Thông tin sản phẩm hiển thị bên cạnh" placeholder="Ví dụ: Chất liệu, kích thước, thiết kế, cá nhân hóa, thương hiệu…" initialValue={descriptionSections.details} /><ProductMediaManager items={media} onAdd={addMediaFiles} onRemove={removeMedia} onReplace={replaceMedia} disabled={busy} /><ProductColorPreviewField imageUrl={colorPreviewUrl} file={colorPreviewFile} disabled={busy} onSelect={setColorPreviewFile} onRemove={removeColorPreview} /><fieldset className="span-two product-cost-editor"><legend>Giá vốn (chỉ admin)</legend><div className="cost-editor-summary"><p>Khoản được ghim sẽ tự thêm vào sản phẩm tạo sau; các khoản khác chỉ áp dụng cho sản phẩm này.</p><b>Tổng giá vốn: {money(costItems.reduce((sum, item) => sum + (Number(item.costVnd) || 0), 0))}</b><button type="button" className="button button-light" onClick={() => setCostItems([...costItems, { label: '', costVnd: '', isFixed: false }])} disabled={busy || costItems.length >= 30}>＋ Thêm khoản chi phí</button></div>{costItems.map((item, index) => <div className="product-cost-row" key={item.fixedCostId ?? index}><label>Tên khoản<input value={item.label} maxLength={100} placeholder="Ví dụ: Đóng gói" onChange={event => setCostItems(costItems.map((row, rowIndex) => rowIndex === index ? { ...row, label: event.target.value } : row))} /></label><label>Chi phí (VND)<input type="number" min="0" step="1" value={item.costVnd} onChange={event => setCostItems(costItems.map((row, rowIndex) => rowIndex === index ? { ...row, costVnd: event.target.value } : row))} /></label><button type="button" className={'cost-fixed-toggle ' + (item.isFixed ? 'is-fixed' : '')} title={item.isFixed ? 'Đang cố định cho sản phẩm tạo sau' : 'Cố định khoản này cho sản phẩm tạo sau'} aria-label={item.isFixed ? 'Bỏ cố định khoản phí' : 'Cố định khoản phí cho sản phẩm tạo sau'} aria-pressed={item.isFixed} onClick={() => { const fixedCostId = item.fixedCostId ?? crypto.randomUUID(); setCostItems(costItems.map((row, rowIndex) => rowIndex === index ? { ...row, isFixed: !row.isFixed, fixedCostId } : row)); setRemovedFixedCostIds(removedFixedCostIds.filter(id => id !== fixedCostId)) }} disabled={busy}><span aria-hidden="true">📌</span></button><button type="button" className="button button-light" onClick={() => { if (item.fixedCostId && !removedFixedCostIds.includes(item.fixedCostId)) setRemovedFixedCostIds([...removedFixedCostIds, item.fixedCostId]); setCostItems(costItems.filter((_, rowIndex) => rowIndex !== index)) }} disabled={busy}>Xóa khoản</button></div>)}</fieldset>{product && <section className="admin-modal-variants existing-variants-section"><div className="admin-modal-variants-heading"><div><h3>Variant hiện có</h3><span>Chỉnh giá rồi bấm “Lưu sản phẩm và variant” ở cuối form.</span></div><span>{product.variants.length} variant</span></div>{product.variants.map(item => { const draft = existingVariants[item.id] ?? { colorId: item.colorId ?? '', sizeId: item.sizeId ?? '', price: item.priceVnd === null ? '' : String(item.priceVnd), status: item.status, imageUrl: item.imageUrl ?? null }; return <div className="admin-variant-form" key={item.id}><label>SKU<input value={item.sku} readOnly /></label><label>Màu sắc<ColorSelect options={colorOptionsIncludingCurrent(draft.colorId)} value={draft.colorId} onChange={colorId => setExistingVariant(item.id, { ...draft, colorId })} /></label><label>Kích thước<select value={draft.sizeId} onChange={event => setExistingVariant(item.id, { ...draft, sizeId: event.target.value })}><option value="">Chọn kích thước</option>{master.sizes.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label><label>Giá riêng<input type="number" min="0" value={draft.price} onChange={event => setExistingVariant(item.id, { ...draft, price: event.target.value })} /></label><VariantImageField imageUrl={draft.removeImage ? undefined : draft.imagePreview ?? draft.imageUrl} disabled={busy} onSelect={file => setExistingVariantImage(item.id, file)} /></div>})}</section>}<fieldset className={'span-two variant-fields ' + (showVariantCreator ? 'variant-creator-open' : 'variant-creator-closed')}><legend>Thêm variant</legend><div className="variant-editor-heading"><span>{showVariantCreator ? 'Thông tin variant mới' : 'Tạo variant mới khi cần'}</span><button type="button" className="button button-light" onClick={() => setShowVariantCreator(!showVariantCreator)} disabled={busy}>{showVariantCreator ? 'Thu gọn' : '＋ Thêm variant'}</button></div>{showVariantCreator && <><label>Màu sắc<ColorSelect options={colorOptions} value={variant.colorId} onChange={colorId => setVariant({ ...variant, colorId })} /></label><VariantImageField imageUrl={variant.imagePreview} disabled={busy} onSelect={setVariantImage} /><label>Rộng<div className="dimension-input"><input type="number" min="0.1" step="0.1" value={variant.width} onChange={event => setVariant({ ...variant, width: event.target.value })} /><span>cm</span></div></label><label>Dài<div className="dimension-input"><input type="number" min="0.1" step="0.1" value={variant.length} onChange={event => setVariant({ ...variant, length: event.target.value })} /><span>cm</span></div></label><label>SKU tự tạo<input value={previewSku} readOnly /><small>Mã gồm tên sản phẩm, màu, kích thước và mã variant riêng.</small></label><label>Giá riêng<input type="number" min="0" value={variant.price} onChange={event => setVariant({ ...variant, price: event.target.value })} /></label><div className="variant-creator-actions"><button type="button" className="button button-light" onClick={cancelVariantCreation} disabled={busy}>Hủy thêm variant</button><button type="button" className="button button-light" onClick={queueVariant} disabled={busy}>＋ Thêm vào danh sách</button></div>{queuedVariants.length > 0 && <div className="queued-variants"><b>{queuedVariants.length} variant đã sẵn sàng</b><button type="button" className="text-button" onClick={() => setVariant({ ...variant, width: '', length: '', price: '' })}>Đóng form</button></div>}</>}</fieldset><div className="admin-product-actions"><button className="button button-light" type="button" onClick={onCancel} disabled={busy}>Hủy</button><button className="button button-dark" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : product ? 'Lưu sản phẩm và variant' : 'Tạo sản phẩm'}</button></div>{message && <p className="admin-form-message span-two">{message}</p>}</form></section></div>
}

function ColorSelect({ options, value, onChange }: { options: MasterOption[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find(option => option.id === value)
  const filteredOptions = options.filter(option => normalizeColorSearch(colorLabel(option)).includes(normalizeColorSearch(query)))
  useEffect(() => {
    function close(event: MouseEvent) { if (!ref.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])
  function selectColor(id: string) { onChange(id); setQuery(''); setOpen(false) }
  return <div className="color-select-control" ref={ref}>
    <button type="button" className="color-select-trigger" onClick={() => { setOpen(!open); setQuery('') }} aria-haspopup="listbox" aria-expanded={open}>{selected?.imageUrl ? <img className="color-select-image" src={selected.imageUrl} alt="" /> : <i style={{ backgroundColor: selected?.hex ?? '#e5e7eb' }} />}<span className="color-select-label">{colorLabel(selected)}</span><span className="color-select-chevron">⌄</span></button>
    {open && <div className="color-select-menu"><input className="color-select-search" type="search" autoFocus value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') setOpen(false); if (event.key === 'Enter') { event.preventDefault(); if (filteredOptions[0]) selectColor(filteredOptions[0].id) } }} placeholder="Gõ tên màu để tìm…" aria-label="Tìm màu sắc" /><div className="color-select-options" role="listbox">{filteredOptions.length ? filteredOptions.map(option => <button type="button" role="option" aria-selected={option.id === value} className="color-select-option" key={option.id} onClick={() => selectColor(option.id)}>{option.imageUrl ? <img className="color-select-image" src={option.imageUrl} alt="" /> : <i style={{ backgroundColor: option.hex ?? '#e5e7eb' }} />}{colorLabel(option)}</button>) : <p className="color-select-empty">Không tìm thấy màu phù hợp.</p>}</div></div>}
  </div>
}

export default function CatalogManager({ products, fixedCostItems, reload }: { products: Product[]; fixedCostItems: FixedCostItem[]; reload: () => Promise<void> }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [master, setMaster] = useState<MasterData>({ colors: [], sizes: [], categories: [], filamentTypePrices: [], filamentPurchaseBaselines: [], fixedFilamentCostItems: [] })
  const [filamentTypePrices, setFilamentTypePrices] = useState<FilamentTypePrice[]>([])
  const [filamentEditorKey, setFilamentEditorKey] = useState<string | null>(null)
  const [filamentEditorMode, setFilamentEditorMode] = useState<'profile' | 'lot'>('profile')
  const [filamentBatchModalOpen, setFilamentBatchModalOpen] = useState(false)
  const [viewingBatchDate, setViewingBatchDate] = useState<string | null>(null)
  const [isSavingFilament, setIsSavingFilament] = useState(false)
  const [createMenuOpen, setCreateMenuOpen] = useState(false)
  const [catalogMessage, setCatalogMessage] = useState('')
  const [media, setMedia] = useState<MediaDraft[]>([])
  const [costItems, setCostItems] = useState<CostDraft[]>([])
  const [removedFixedCostIds, setRemovedFixedCostIds] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [categoryDraft, setCategoryDraft] = useState('')
  const [variant, setVariant] = useState<VariantDraft>({ colorId: '', width: '', length: '', price: '' })
  const [showVariantCreator, setShowVariantCreator] = useState(false)
  const [queuedVariants, setQueuedVariants] = useState<VariantDraft[]>([])
  const [existingVariants, setExistingVariants] = useState<Record<string, ExistingVariantDraft>>({})
  const [colorPreviewFile, setColorPreviewFileState] = useState<File | null>(null)
  const [colorPreviewDraftUrl, setColorPreviewDraftUrl] = useState<string | undefined>()
  const [removeColorPreviewDraft, setRemoveColorPreviewDraft] = useState(false)
  const colorPreviewObjectUrl = useRef<string | null>(null)
  const product = products.find(item => item.id === editingId)
  const descriptionSections = splitProductDescription(product?.description ?? '')
  const categories = useMemo(() => Array.from(new Set(products.map(item => item.category).filter((item): item is string => Boolean(item)))), [products])
  const materialTypes = useMemo(() => [...new Map(master.colors.map(item => item.materialType?.trim()).filter((type): type is string => Boolean(type) && type !== 'unclassified').map(type => [filamentTypeKey(type), type])).values()].sort((a, b) => a.localeCompare(b, 'vi')), [master.colors])
  const unconfiguredMaterialTypes = materialTypes.filter(type => !filamentTypePrices.some(item => item.materialTypeKey === filamentTypeKey(type)))
  const baselineDate = master.filamentPurchaseBaselines.map(item => item.purchaseDate).sort().at(-1) ?? null
  const purchaseBatches = useMemo(() => {
    const grouped = new Map<string, FilamentPurchaseHistoryItem[]>()
    for (const baseline of master.filamentPurchaseBaselines) grouped.set(baseline.purchaseDate, [...(grouped.get(baseline.purchaseDate) ?? []), { materialType: baseline.materialType, baseline }])
    for (const price of filamentTypePrices) for (const lot of price.purchaseLots ?? []) grouped.set(lot.purchaseDate, [...(grouped.get(lot.purchaseDate) ?? []), { materialType: price.materialType, lot }])
    return [...grouped.entries()].map(([purchaseDate, items]) => ({ purchaseDate, items: items.sort((a, b) => a.materialType.localeCompare(b.materialType, 'vi')), materialTypeCount: new Set(items.map(item => item.materialType)).size, spoolCount: items.reduce((sum, item) => sum + (item.lot?.spoolCount ?? 0), 0), baselineCount: items.filter(item => item.baseline).length })).sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate))
  }, [filamentTypePrices, master.filamentPurchaseBaselines])
  const visibleProducts = useMemo(() => products.filter(item => item.name.toLocaleLowerCase('vi-VN').includes(search.toLocaleLowerCase('vi-VN')) && (!categoryFilter || item.category === categoryFilter)), [products, search, categoryFilter])
  const allVisibleSelected = visibleProducts.length > 0 && visibleProducts.every(item => selectedIds.includes(item.id))

  useEffect(() => { setSelectedIds(current => current.filter(id => products.some(item => item.id === id))) }, [products])

  useEffect(() => {
    if (colorPreviewObjectUrl.current) URL.revokeObjectURL(colorPreviewObjectUrl.current)
    colorPreviewObjectUrl.current = null
    setColorPreviewFileState(null)
    setColorPreviewDraftUrl(undefined)
    setRemoveColorPreviewDraft(false)
  }, [editingId, product?.id])

  useEffect(() => { api<{ data: MasterData }>('/api/admin/master-data').then(result => { setMaster(result.data); setFilamentTypePrices(result.data.filamentTypePrices ?? []) }).catch(() => undefined) }, [])
  async function saveFilamentType(payload: FilamentTypePricePayload) {
    setIsSavingFilament(true)
    setCatalogMessage('')
    try {
      await api('/api/admin/filament-type-prices', { method: 'PUT', body: JSON.stringify(payload) })
      const refreshed = await api<{ data: MasterData }>('/api/admin/master-data')
      setMaster(refreshed.data)
      setFilamentTypePrices(refreshed.data.filamentTypePrices ?? [])
      setFilamentEditorKey(null)
      setCatalogMessage(payload.purchaseLot ? `Đã ghi nhận lô mua mới cho ${payload.materialType}.` : `Đã lưu giá bán và khuyến mãi cho ${payload.materialType}.`)
      void reload().catch(() => undefined)
    } finally { setIsSavingFilament(false) }
  }
  async function saveFilamentBatch(payload: FilamentPurchaseBatchPayload) {
    setIsSavingFilament(true)
    setCatalogMessage('')
    try {
      await api('/api/admin/filament-purchase-batches', { method: 'POST', body: JSON.stringify(payload) })
      const refreshed = await api<{ data: MasterData }>('/api/admin/master-data')
      setMaster(refreshed.data)
      setFilamentTypePrices(refreshed.data.filamentTypePrices ?? [])
      setFilamentBatchModalOpen(false)
      setCatalogMessage(`Đã lưu đợt nhập ngày ${formatBatchDate(payload.purchaseDate)} cho ${payload.entries.length} loại nhựa.`)
      void reload().catch(() => undefined)
    } finally { setIsSavingFilament(false) }
  }
  useEffect(() => {
    setNameDraft(product?.name ?? '')
    setCostItems(product ? (product.costItems ?? []).map(item => ({ label: item.label, costVnd: String(item.costVnd), isFixed: Boolean(item.fixedCostId && fixedCostItems.some(fixed => fixed.id === item.fixedCostId)), fixedCostId: item.fixedCostId ?? undefined })) : fixedCostItems.map(item => ({ label: item.label, costVnd: String(item.costVnd), isFixed: true, fixedCostId: item.id })))
    setRemovedFixedCostIds([])
    setVariant({ colorId: product?.variants[0]?.colorId ?? master.colors[0]?.id ?? '', width: '', length: '', price: '' })
    setShowVariantCreator(!product)
    setQueuedVariants([])
    setExistingVariants(Object.fromEntries((product?.variants ?? []).map(item => [item.id, { colorId: item.colorId ?? '', sizeId: item.sizeId ?? '', price: item.priceVnd === null ? '' : String(item.priceVnd), status: item.status, imageUrl: item.imageUrl ?? null, imagePreview: item.imageUrl ?? undefined, removeImage: false }])) as Record<string, ExistingVariantDraft>)
    setMessage('')
  }, [editingId, product?.id])
  useEffect(() => {
    if (master.colors.length) setVariant(current => current.colorId ? current : { ...current, colorId: product?.variants[0]?.colorId ?? master.colors[0].id })
  }, [master.colors, product?.id])
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
  function setColorPreviewFile(file: File) {
    if (colorPreviewObjectUrl.current) URL.revokeObjectURL(colorPreviewObjectUrl.current)
    const previewUrl = URL.createObjectURL(file)
    colorPreviewObjectUrl.current = previewUrl
    setColorPreviewFileState(file)
    setColorPreviewDraftUrl(previewUrl)
    setRemoveColorPreviewDraft(false)
  }
  function removeColorPreview() {
    if (colorPreviewObjectUrl.current) URL.revokeObjectURL(colorPreviewObjectUrl.current)
    colorPreviewObjectUrl.current = null
    setColorPreviewFileState(null)
    setColorPreviewDraftUrl(undefined)
    setRemoveColorPreviewDraft(Boolean(product?.colorPreviewUrl))
  }
  function discardColorPreviewDraft() {
    if (colorPreviewObjectUrl.current) URL.revokeObjectURL(colorPreviewObjectUrl.current)
    colorPreviewObjectUrl.current = null
    setColorPreviewFileState(null)
    setColorPreviewDraftUrl(undefined)
    setRemoveColorPreviewDraft(false)
  }
  function setVariantImage(file: File | null) {
    setVariant(current => {
      if (current.imagePreview?.startsWith('blob:')) URL.revokeObjectURL(current.imagePreview)
      return { ...current, imageFile: file ?? undefined, imagePreview: file ? URL.createObjectURL(file) : undefined }
    })
  }
  function setExistingVariantImage(id: string, file: File | null) {
    setExistingVariants(current => {
      const draft = current[id]
      if (draft?.imagePreview?.startsWith('blob:')) URL.revokeObjectURL(draft.imagePreview)
      return { ...current, [id]: { ...draft, imageFile: file ?? undefined, imagePreview: file ? URL.createObjectURL(file) : undefined, removeImage: file ? false : Boolean(draft?.imageUrl) } }
    })
  }
  function discardVariantImageDrafts() {
    if (variant.imagePreview?.startsWith('blob:')) URL.revokeObjectURL(variant.imagePreview)
    for (const draft of queuedVariants) if (draft.imagePreview?.startsWith('blob:')) URL.revokeObjectURL(draft.imagePreview)
    for (const draft of Object.values(existingVariants)) if (draft.imagePreview?.startsWith('blob:')) URL.revokeObjectURL(draft.imagePreview)
  }
  function queueVariant() {
    if (product) { void addVariant(); return }
    if (!showVariantCreator) { setShowVariantCreator(true); return }
    if (!variant.colorId || !variant.width || !variant.length) { setMessage('Vui lòng chọn màu và nhập đủ rộng, dài trước khi thêm variant.'); return }
    setQueuedVariants(items => [...items, variant])
    setVariant({ colorId: master.colors[0]?.id ?? '', width: '', length: '', price: '' })
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
  function closeEditor() { discardMediaDraft(); discardVariantImageDrafts(); discardColorPreviewDraft(); setEditingId(null) }
  async function upload(productId: string, uploadFiles: File[]) {
    if (!uploadFiles.length) return [] as Array<{ url: string; mediaType: string }>
    const form = new FormData(); form.set('productId', productId); uploadFiles.forEach(file => form.append('files', file))
    return (await api<{ data: Array<{ url: string; mediaType: string }> }>('/api/admin/media', { method: 'POST', body: form })).data
  }
  async function uploadVariantImage(variantId: string, file: File) {
    const form = new FormData(); form.set('image', file)
    return (await api<{ data: { imageUrl: string } }>('/api/admin/variants/' + encodeURIComponent(variantId) + '/image', { method: 'POST', body: form })).data.imageUrl
  }
  async function deleteVariantImage(variantId: string) {
    await api('/api/admin/variants/' + encodeURIComponent(variantId) + '/image', { method: 'DELETE' })
  }
  async function uploadProductColorPreview(productId: string, file: File) {
    const form = new FormData(); form.set('image', file)
    return (await api<{ data: { imageUrl: string } }>('/api/admin/products/' + encodeURIComponent(productId) + '/color-preview', { method: 'POST', body: form })).data.imageUrl
  }
  async function deleteProductColorPreview(productId: string) {
    await api('/api/admin/products/' + encodeURIComponent(productId) + '/color-preview', { method: 'DELETE' })
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
  function cancelVariantCreation() { if (variant.imagePreview?.startsWith('blob:')) URL.revokeObjectURL(variant.imagePreview); for (const draft of queuedVariants) if (draft.imagePreview?.startsWith('blob:')) URL.revokeObjectURL(draft.imagePreview); setVariant({ colorId: master.colors[0]?.id ?? '', width: '', length: '', price: '' }); setQueuedVariants([]); setShowVariantCreator(false); setMessage('') }
  async function addVariant() {
    if (!variant.colorId || !variant.width || !variant.length) { setMessage('Vui lòng chọn màu và nhập đủ rộng, dài cho variant.'); return }
    if (!product) { queueVariant(); return }
    setBusy(true); setMessage('')
    try {
      const sku = `SAMU-${slug(nameDraft).slice(0, 24) || 'PRODUCT'}-${slug(master.colors.find(item => item.id === variant.colorId)?.code ?? 'COLOR')}-${variant.width}X${variant.length}-${product.id.slice(0, 6).toUpperCase()}`
      const created = await api<{ data: { id: string } }>('/api/admin/products/' + encodeURIComponent(product.id) + '/variants', { method: 'POST', body: JSON.stringify({ sku, colorId: variant.colorId, size: `${variant.width}x${variant.length} cm`, priceVnd: variant.price === '' ? null : Number(variant.price), status: 'active' }) })
      if (variant.imageFile) await uploadVariantImage(created.data.id, variant.imageFile)
      if (variant.imagePreview?.startsWith('blob:')) URL.revokeObjectURL(variant.imagePreview)
      await reload()
      setVariant({ colorId: master.colors[0]?.id ?? '', width: '', length: '', price: '' })
      setShowVariantCreator(false)
      setMessage('Đã lưu variant mới.')
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Không thể lưu variant.') }
    finally { setBusy(false) }
  }
  if (editingId) return <ProductEditorModal product={product} editingId={editingId} master={master} media={media} colorPreviewUrl={removeColorPreviewDraft ? undefined : colorPreviewDraftUrl ?? product?.colorPreviewUrl ?? undefined} colorPreviewFile={colorPreviewFile ?? undefined} setColorPreviewFile={setColorPreviewFile} removeColorPreview={removeColorPreview} addMediaFiles={addMediaFiles} removeMedia={removeMedia} replaceMedia={replaceMedia} costItems={costItems} setCostItems={setCostItems} removedFixedCostIds={removedFixedCostIds} setRemovedFixedCostIds={setRemovedFixedCostIds} nameDraft={nameDraft} setNameDraft={setNameDraft} variant={variant} setVariant={setVariant} previewSku={previewSku} setVariantImage={setVariantImage} existingVariants={existingVariants} setExistingVariant={(id, draft) => setExistingVariants(current => ({ ...current, [id]: draft }))} setExistingVariantImage={setExistingVariantImage} queuedVariants={queuedVariants} showVariantCreator={showVariantCreator} setShowVariantCreator={setShowVariantCreator} queueVariant={queueVariant} addVariant={addVariant} cancelVariantCreation={cancelVariantCreation} busy={busy} message={message} save={save} onCancel={closeEditor} />
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(''); const form = new FormData(event.currentTarget)
    try {
      const enteredCostItems = costItems.filter(item => item.label.trim() || item.costVnd.trim() || item.isFixed)
      if (enteredCostItems.length > 30 || enteredCostItems.some(item => !item.label.trim() || item.costVnd.trim() === '' || !Number.isSafeInteger(Number(item.costVnd)) || Number(item.costVnd) < 0 || Number(item.costVnd) > 2000000000)) throw new Error('Kiểm tra lại tên và số tiền của từng khoản giá vốn.')
      const nextFixedCosts = new Map(fixedCostItems.filter(item => !removedFixedCostIds.includes(item.id)).map(item => [item.id, item]))
      const costItemsPayload = enteredCostItems.map((item, index) => {
        const fixedCostId = item.isFixed ? item.fixedCostId ?? crypto.randomUUID() : undefined
        if (fixedCostId) nextFixedCosts.set(fixedCostId, { id: fixedCostId, label: item.label.trim(), costVnd: Number(item.costVnd), sortOrder: index })
        else if (item.fixedCostId) nextFixedCosts.delete(item.fixedCostId)
        return { label: item.label.trim(), costVnd: Number(item.costVnd), ...(fixedCostId ? { fixedCostId } : {}) }
      })
      const fixedCostItemsPayload = [...nextFixedCosts.values()].map((item, sortOrder) => ({ ...item, sortOrder }))
      const filamentTypes = form.getAll('filamentTypes').map(value => String(value))
      if (!filamentTypes.length) throw new Error('Vui lòng chọn ít nhất một loại nhựa để lọc màu preview tùy chỉnh.')
      const discountPercent = Number(form.get('discountPercent') ?? 0)
      const discountEndsOn = String(form.get('discountEndsOn') ?? '')
      if (!Number.isSafeInteger(discountPercent) || discountPercent < 0 || discountPercent > 99 || discountPercent > 0 && !/^\d{4}-\d{2}-\d{2}$/.test(discountEndsOn)) throw new Error('Phần trăm giảm phải từ 0 đến 99; nếu có giảm giá, hãy chọn ngày kết thúc.')
      const newColorDrafts = [...queuedVariants, ...(variant.colorId && generatedSize ? [variant] : [])]
      const base = { name: nameDraft, description: joinProductDescription(String(form.get('descriptionStory') ?? ''), String(form.get('descriptionDetails') ?? '')), category: String(form.get('category') ?? '').trim() || null, status: form.get('status'), basePriceVnd: Number(form.get('basePriceVnd')), discountPercent, discountEndsOn: discountPercent ? discountEndsOn : null, filamentTypes, costItems: costItemsPayload, fixedCostItems: fixedCostItemsPayload }
      const hasNewVariant = Boolean(queuedVariants.length || (variant.colorId && generatedSize))
      const hasPartialVariant = Boolean(variant.width || variant.length || variant.price)
      if (!product && !hasNewVariant) throw new Error(hasPartialVariant ? 'Vui lòng nhập đủ màu, rộng và dài cho variant.' : 'Vui lòng nhập ít nhất một variant.')
      if (product && hasPartialVariant && !(variant.colorId && generatedSize)) throw new Error('Vui lòng nhập đủ màu, rộng và dài cho variant mới hoặc để trống phần thêm variant.')
      let productId = editingId
      if (product) await api('/api/admin/products/' + encodeURIComponent(product.id), { method: 'PATCH', body: JSON.stringify(base) })
      else productId = (await api<{ data: { id: string } }>('/api/admin/products', { method: 'POST', body: JSON.stringify(base) })).data.id
      if (colorPreviewFile) await uploadProductColorPreview(productId!, colorPreviewFile)
      else if (removeColorPreviewDraft && product) await deleteProductColorPreview(product.id)
      const newFiles = media.filter(item => item.file).map(item => item.file!)
      const uploaded = await upload(productId!, newFiles)
      let uploadedIndex = 0
      const savedMedia = media.map(item => item.file ? { ...item, file: undefined, url: uploaded[uploadedIndex++].url } : item)
      const imageUrls = savedMedia.filter(item => item.type === 'image').map(item => item.url)
      const demoVideoUrl = savedMedia.find(item => item.type === 'video')?.url ?? null
      await api('/api/admin/products/' + encodeURIComponent(productId!), { method: 'PATCH', body: JSON.stringify({ imageUrls, demoVideoUrl }) })
      const drafts = [...queuedVariants, ...(variant.colorId && generatedSize ? [variant] : [])]
      if (!drafts.length && !product) throw new Error('Vui lòng nhập ít nhất một variant.')
      for (const draft of drafts) { const size = `${draft.width}x${draft.length} cm`; const sku = `SAMU-${slug(nameDraft).slice(0, 24) || 'PRODUCT'}-${slug(master.colors.find(item => item.id === draft.colorId)?.code ?? 'COLOR')}-${draft.width}X${draft.length}-${productId!.slice(0, 6).toUpperCase()}`; const created = await api<{ data: { id: string } }>('/api/admin/products/' + encodeURIComponent(productId!) + '/variants', { method: 'POST', body: JSON.stringify({ sku, colorId: draft.colorId, size, priceVnd: draft.price === '' ? null : Number(draft.price), status: 'active' }) }); if (draft.imageFile) await uploadVariantImage(created.data.id, draft.imageFile) }
      if (product) for (const item of product.variants) { const draft = existingVariants[item.id]; if (!draft) continue; await api('/api/admin/variants/' + encodeURIComponent(item.id), { method: 'PATCH', body: JSON.stringify({ colorId: draft.colorId, sizeId: draft.sizeId, priceVnd: draft.price === '' ? null : Number(draft.price), status: draft.status }) }); if (draft.imageFile) await uploadVariantImage(item.id, draft.imageFile); else if (draft.removeImage) await deleteVariantImage(item.id) }
      await reload(); discardMediaDraft(); discardVariantImageDrafts(); discardColorPreviewDraft(); setEditingId(null)
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Không thể lưu sản phẩm.') } finally { setBusy(false) }
  }
  return <div className={'admin-catalog-manager ' + (showVariantCreator ? 'variant-creator-open' : 'variant-creator-closed')}>
        <section className="admin-panel filament-product-manager">
      <header className="filament-product-heading">
        <div><p className="admin-kicker">SẢN PHẨM / NHỰA IN 3D</p><h2>Sản phẩm theo loại nhựa</h2><p>Mỗi màu master data là một mặt hàng riêng. Giá vốn/cuộn được tính bình quân gia quyền theo số cuộn của từng lô đã ghi nhận.</p></div>
        <span>{materialTypes.length} loại nhựa · {master.colors.filter(color => color.materialType && color.materialType !== 'unclassified').length} màu</span>
      </header>
      {materialTypes.length ? <div className="filament-product-workspace">
        <div className="filament-summary-table-scroll"><table className="filament-summary-table">
          <thead><tr><th>Loại nhựa</th><th>Lịch sử nhập</th><th>Giá vốn bình quân/cuộn</th><th>Giá bán/cuộn</th><th>Lãi gộp/cuộn</th><th>Khuyến mãi</th><th>Thao tác</th></tr></thead>
          <tbody>{materialTypes.map(type => {
            const key = filamentTypeKey(type)
            const configured = filamentTypePrices.find(item => item.materialTypeKey === key)
            const colorCount = master.colors.filter(color => filamentTypeKey(color.materialType ?? '') === key).length
            const importedDates = new Set((configured?.purchaseLots ?? []).map(lot => lot.purchaseDate))
            return <tr key={key}>
              <td><div className="filament-summary-type"><b>{filamentLabel(type)}</b><small>{colorCount} màu</small>{configured?.purchaseUrl && <a href={configured.purchaseUrl} target="_blank" rel="noreferrer">Mở link mua</a>}</div></td>
              <td>{configured?.hasRecordedLots ? <><b>{importedDates.size} ngày nhập</b><small>{configured.totalSpoolsPurchased} cuộn đã nhập</small></> : configured ? <span className="filament-no-lots">Chưa có số lượng lô</span> : <span>Chưa thiết lập</span>}</td>
              <td>{configured ? configured.hasRecordedLots ? <b>{money(configured.totalCostVnd)}</b> : <><span className="filament-no-lots">Chưa có bình quân</span><small>Giá vốn cũ: {money(configured.totalCostVnd)}</small></> : '—'}</td>
              <td>{configured ? <b>{money(configured.priceVnd)}</b> : '—'}</td>
              <td>{configured && configured.hasRecordedLots ? <b className={configured.priceVnd >= configured.totalCostVnd ? 'filament-profit-positive' : 'filament-profit-negative'}>{money(configured.priceVnd - configured.totalCostVnd)}</b> : '—'}</td>
              <td>{configured?.discountPercent ? <><b>{configured.discountPercent}%</b><small>tới {configured.discountEndsOn}</small></> : '—'}</td>
              <td><div className="filament-summary-actions"><button type="button" className={configured ? 'button button-light' : 'button button-dark'} onClick={() => { setFilamentEditorMode('profile'); setFilamentEditorKey(key) }}>{configured ? 'Giá bán' : 'Thiết lập'}</button></div></td>
            </tr>
          })}</tbody>
        </table></div>
        <aside className="filament-purchase-dates"><header><div><b>Các đợt nhập</b><small>Bấm ngày để xem đủ các loại nhựa và thông số của đợt.</small></div><button type="button" className="button button-dark" onClick={() => setFilamentBatchModalOpen(true)} disabled={!filamentTypePrices.length || isSavingFilament}>＋ Nhập đợt mới</button></header>
          {purchaseBatches.length ? <div className="filament-purchase-date-list">{purchaseBatches.map(batch => <button type="button" className="filament-purchase-date" key={batch.purchaseDate} onClick={() => setViewingBatchDate(batch.purchaseDate)}><b>{formatBatchDate(batch.purchaseDate)}</b><span>{batch.baselineCount && !batch.spoolCount ? `${batch.materialTypeCount} loại nhựa · thông số hiện tại` : `${batch.materialTypeCount} loại nhựa · ${batch.spoolCount} cuộn${batch.baselineCount ? ' · có thông số ban đầu' : ''}`}</span></button>)}</div> : <p className="filament-empty-hint">Chưa có đợt nhập nào.</p>}
        </aside>
      </div> : <p className="admin-empty">Chưa có loại nhựa. Hãy thêm loại nhựa vào master data trước.</p>}
      {catalogMessage && <p className="catalog-bulk-message" role="status">{catalogMessage}</p>}
    </section>

<section className="admin-panel catalog-list-panel">
      <div className="catalog-list-toolbar"><div><h2>Danh sách sản phẩm</h2><p>Quản lý thông tin, hình ảnh và các variant của sản phẩm.</p></div><div className="catalog-toolbar-actions"><button className="button button-light catalog-delete-button" type="button" onClick={() => void deleteSelected()} disabled={!selectedIds.length || busy}>Xóa đã chọn ({selectedIds.length})</button><div className="product-create-menu"><button className="button button-dark" type="button" aria-haspopup="menu" aria-expanded={createMenuOpen} onClick={() => setCreateMenuOpen(open => !open)}>＋ Thêm sản phẩm</button>{createMenuOpen && <div className="product-create-options" role="menu"><button type="button" role="menuitem" onClick={() => { setCreateMenuOpen(false); setEditingId('new') }}>Sản phẩm thông thường</button><button type="button" role="menuitem" onClick={() => { setCreateMenuOpen(false); setFilamentEditorMode('lot'); setFilamentEditorKey('__new__') }} disabled={!unconfiguredMaterialTypes.length}>Sản phẩm nhựa in 3D{unconfiguredMaterialTypes.length > 0 ? ` · ${unconfiguredMaterialTypes.length} loại chưa tạo` : ''}</button></div>}</div></div></div>
      <div className="catalog-list-filters"><label>Tìm sản phẩm<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Nhập tên sản phẩm..." /></label><label>Danh mục<select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}><option value="">Tất cả danh mục</option>{categories.map(category => <option key={category} value={category}>{category}</option>)}</select></label></div>
      {visibleProducts.length > 0 && <label className="catalog-select-all"><input type="checkbox" checked={allVisibleSelected} onChange={event => setSelectedIds(current => event.target.checked ? Array.from(new Set([...current, ...visibleProducts.map(item => item.id)])) : current.filter(id => !visibleProducts.some(item => item.id === id)))} /> Chọn tất cả sản phẩm đang hiển thị ({visibleProducts.length})</label>}
      {selectedIds.length > 0 && <div className="catalog-category-bulk"><span>Đã chọn {selectedIds.length} sản phẩm</span><label>Tên danh mục<input value={categoryDraft} onChange={event => setCategoryDraft(event.target.value)} maxLength={80} placeholder="Nhập tên danh mục bạn muốn" /></label><button className="button button-dark" type="button" onClick={() => void assignCategory()} disabled={busy || !categoryDraft.trim()}>Gán danh mục</button></div>}
      <div className="catalog-product-list">{visibleProducts.length ? visibleProducts.map(item => <article className="catalog-product-row" key={item.id}><label className="catalog-product-select" aria-label={`Chọn ${item.name}`}><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={event => setSelectedIds(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))} /></label><div className="catalog-product-thumb">{(item.imageUrl || item.imageUrls?.[0]) && <img src={item.imageUrl || item.imageUrls?.[0] || ''} alt="" />}</div><div className="catalog-product-info"><h3>{item.name}</h3><span>{item.category || 'Chưa phân loại'} · {item.variants.length} variant</span></div><div className="catalog-product-meta"><span className="catalog-price-pair"><small>Giá bán</small><b>{money(item.basePriceVnd)}</b></span><span className="catalog-price-pair catalog-cost-pair"><small>Giá vốn</small><b>{money(item.totalCostVnd ?? 0)}</b></span><small className={'status-' + item.status}>{item.status === 'active' ? 'Đang bán' : item.status === 'archived' ? 'Lưu trữ' : 'Nháp'}</small></div><button className="button button-light" type="button" onClick={() => setEditingId(item.id)}>Chỉnh sửa</button></article>) : <p className="catalog-empty">Không tìm thấy sản phẩm phù hợp.</p>}</div>
      {message && <p className="catalog-bulk-message" role="status">{message}</p>}
    </section>
    {editingId && <div className="admin-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setEditingId(null) }}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title"><div className="admin-modal-heading"><div><p className="admin-kicker">PRODUCT WORKSPACE</p><h2 id="product-modal-title">{product ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm'}</h2></div><button type="button" className="admin-modal-close" onClick={() => setEditingId(null)} disabled={busy}>×</button></div><form className="admin-product-form" onSubmit={save}><label>Tên sản phẩm<input name="name" value={nameDraft} onChange={event => setNameDraft(event.target.value)} required /></label><label>Danh mục<select name="category" defaultValue={product?.category ?? ''} key={(editingId ?? '') + '-category'}><option value="">Chọn danh mục</option>{categories.map(category => <option key={category} value={category}>{category}</option>)}</select></label><label>Giá cơ bản (VND)<input name="basePriceVnd" type="number" min="0" defaultValue={product?.basePriceVnd ?? 0} key={(editingId ?? '') + '-price'} required /></label><label>Trạng thái<select name="status" defaultValue={product?.status ?? 'draft'} key={(editingId ?? '') + '-status'}><option value="draft">Nháp</option><option value="active">Đang bán</option><option value="archived">Lưu trữ</option></select></label><DescriptionEditor key={(editingId ?? '') + '-story'} name="descriptionStory" title="Giới thiệu hiển thị dưới ảnh sản phẩm" placeholder="Thông điệp, câu chuyện và tính năng nổi bật. Dùng dòng trống để chia đoạn." initialValue={descriptionSections.introduction} /><DescriptionEditor key={(editingId ?? '') + '-details'} name="descriptionDetails" title="Thông tin sản phẩm hiển thị bên cạnh" placeholder="Ví dụ: Chất liệu, kích thước, thiết kế, cá nhân hóa, thương hiệu…" initialValue={descriptionSections.details} /><ProductMediaManager items={media} onAdd={addMediaFiles} onRemove={removeMedia} onReplace={replaceMedia} disabled={busy} /><fieldset className="span-two variant-fields"><legend>{product ? 'Thêm variant' : 'Variant đầu tiên'}</legend><div className="variant-editor-heading"><span>Thông tin variant mới</span><button type="button" className="button button-light" onClick={queueVariant} disabled={busy}>＋ Thêm variant</button></div><label>Màu sắc<ColorSelect options={master.colors} value={variant.colorId} onChange={colorId => setVariant({ ...variant, colorId })} /></label><label>Rộng<div className="dimension-input"><input type="number" min="0.1" step="0.1" value={variant.width} onChange={event => setVariant({ ...variant, width: event.target.value })} /><span>cm</span></div></label><label>Dài<div className="dimension-input"><input type="number" min="0.1" step="0.1" value={variant.length} onChange={event => setVariant({ ...variant, length: event.target.value })} /><span>cm</span></div></label><label>SKU tự tạo<input value={previewSku} readOnly /><small>Mã gồm tên sản phẩm, màu, kích thước và mã variant riêng.</small></label><label>Giá riêng<input type="number" min="0" value={variant.price} onChange={event => setVariant({ ...variant, price: event.target.value })} /></label>{queuedVariants.length > 0 && <div className="queued-variants"><b>{queuedVariants.length} variant đã sẵn sàng</b><button type="button" className="text-button" onClick={() => setQueuedVariants([])}>Xóa danh sách chờ</button></div>}</fieldset><div className="admin-product-actions"><button className="button button-light" type="button" onClick={() => setEditingId(null)} disabled={busy}>Hủy</button><button className="button button-dark" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : product ? 'Lưu sản phẩm và variant' : 'Tạo sản phẩm'}</button></div>{message && <p className="admin-form-message span-two">{message}</p>}</form>{product && <section className="admin-modal-variants"><div className="admin-modal-variants-heading"><h3>Variant hiện có</h3><span>Chỉnh sửa trực tiếp và bấm lưu ở cuối form.</span></div>{product.variants.map(item => { const draft = existingVariants[item.id] ?? { colorId: item.colorId ?? '', sizeId: item.sizeId ?? '', price: item.priceVnd === null ? '' : String(item.priceVnd), status: item.status }; return <div className="admin-variant-form" key={item.id}><label>SKU<input value={item.sku} readOnly /></label><label>Màu sắc<ColorSelect options={master.colors} value={draft.colorId} onChange={colorId => setExistingVariants(current => ({ ...current, [item.id]: { ...draft, colorId } }))} /></label><label>Kích thước<select value={draft.sizeId} onChange={event => setExistingVariants(current => ({ ...current, [item.id]: { ...draft, sizeId: event.target.value } }))}><option value="">Chọn kích thước</option>{master.sizes.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label><label>Giá riêng<input type="number" min="0" value={draft.price} onChange={event => setExistingVariants(current => ({ ...current, [item.id]: { ...draft, price: event.target.value } }))} /></label></div>})}</section>}</section></div>}
    {filamentEditorKey && <FilamentTypeProductModal key={filamentEditorKey + filamentEditorMode} materialTypes={materialTypes} prices={filamentTypePrices} fixedFilamentCostItems={master.fixedFilamentCostItems ?? []} initialTypeKey={filamentEditorKey} initialMode={filamentEditorMode} saving={isSavingFilament} onCancel={() => setFilamentEditorKey(null)} onSave={saveFilamentType} />}
    {filamentBatchModalOpen && <FilamentPurchaseBatchModal prices={filamentTypePrices} fixedCostItems={master.fixedFilamentCostItems ?? []} baselineDate={baselineDate} saving={isSavingFilament} onCancel={() => setFilamentBatchModalOpen(false)} onSave={saveFilamentBatch} />}
    {viewingBatchDate && purchaseBatches.find(batch => batch.purchaseDate === viewingBatchDate) && <FilamentPurchaseBatchDetails purchaseDate={viewingBatchDate} items={purchaseBatches.find(batch => batch.purchaseDate === viewingBatchDate)!.items} onClose={() => setViewingBatchDate(null)} />}
  </div>
}
