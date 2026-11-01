import { useEffect, useMemo, useState } from 'react'
import { ProductCard } from '../components/ProductCard'
import { PriceDisplay } from '../components/PriceDisplay'
import type { CartItem, Product, ProductColor, View } from '../types'
import type { SiteConfig } from '../data/siteConfig'
import { ORDER_STATUS_LABELS } from '../data/orderStatuses'
import { formatPrice } from '../utils/format'
import { splitProductDescription } from '../utils/product-description'

type SetView = (view: View) => void

interface CustomColorOption {
  id: string
  name: string
  imageUrl?: string | null
  hex?: string | null
  brand?: string | null
  materialType?: string | null
  isAvailable?: boolean
}

const preorderNote = 'Màu này chưa có sẵn, vui lòng đợi 7 ngày để hàng về.'

const materialTypeLabels: Record<string, string> = { pla: 'PLA', pla_plus: 'PLA+', pla_matte: 'PLA Matte', pla_silk: 'PLA Silk' }
const categoryKey = (value: string) => value.normalize('NFC').trim().toLocaleLowerCase('vi-VN')
const normalizeFilamentSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLocaleLowerCase('vi-VN').trim()

function descriptionBlocks(source: string) {
  let value = source.trim().replace(/\r\n?/g, '\n')
  if (!value.includes('\n')) {
    value = value
      .replace(/\s+(?=✨?\s*3\s+tính năng đặc biệt:)/i, '\n\n')
      .replace(/\s+(?=THÔNG TIN SẢN PHẨM\b)/i, '\n\n')
      .replace(/\s+(?=(?:NFC|Memory Photo|Clicker):)/gi, '\n')
      .replace(/\s+(?=(?:Chất liệu|Thiết kế|Cá nhân hóa|Thương hiệu):)/gi, '\n')
    const firstHeading = value.search(/\n/)
    const intro = firstHeading < 0 ? value : value.slice(0, firstHeading)
    const rest = firstHeading < 0 ? '' : value.slice(firstHeading)
    if (intro.length > 240) {
      const sentences = intro.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g)?.map(item => item.trim()).filter(Boolean) ?? [intro]
      const grouped: string[] = []
      for (let index = 0; index < sentences.length; index += 2) grouped.push(sentences.slice(index, index + 2).join(' '))
      value = grouped.join('\n\n') + rest
    }
  }
  return value.split(/\n\s*\n/).map(block => block.trim()).filter(Boolean)
}

function DescriptionText({ text }: { text: string }) {
  const marker = /(\*\*[^*]+\*\*|Made for moments that matter\.?|Một món quà nhỏ, chứa đựng thật nhiều yêu thương\.?|✨?\s*3 tính năng đặc biệt:|NFC:|Memory Photo:|Clicker:|THÔNG TIN SẢN PHẨM|Chất liệu:|Thiết kế:|Cá nhân hóa:|Thương hiệu:)/gi
  return <>{text.split(marker).map((part, index) => {
    if (!part) return null
    const explicit = part.startsWith('**') && part.endsWith('**')
    const autoEmphasis = /^(?:Made for moments that matter\.?|Một món quà nhỏ, chứa đựng thật nhiều yêu thương\.?|✨?\s*3 tính năng đặc biệt:|NFC:|Memory Photo:|Clicker:|THÔNG TIN SẢN PHẨM|Chất liệu:|Thiết kế:|Cá nhân hóa:|Thương hiệu:)$/i.test(part)
    return explicit || autoEmphasis ? <strong key={index}>{explicit ? part.slice(2, -2) : part}</strong> : part
  })}</>
}

function FormattedDescription({ description }: { description: string }) {
  return <div className="detail-description">{descriptionBlocks(description).map((block, index) => <p key={index}>{block.split('\n').map((line, lineIndex) => <span key={lineIndex}>{lineIndex > 0 && <br />}<DescriptionText text={line} /></span>)}</p>)}</div>
}
const itemKey = (item: CartItem) => [item.id, item.variantId ?? '', item.customColorId ?? item.filamentColorId ?? item.color, item.size].join('-')

const processSteps = [
  ['01', 'Chọn sản phẩm', 'Khám phá mẫu quà và chọn màu sắc, kích thước phù hợp.', 'gift'],
  ['02', 'Xác nhận ý tưởng', 'SAMUCHAN liên hệ để chốt thiết kế và đơn hàng.', 'sparkle'],
  ['03', 'In 3D & kiểm tra', 'Từng sản phẩm được hoàn thiện và kiểm tra kỹ lưỡng.', 'print'],
  ['04', 'Hoàn thiện & giao hàng', 'Đóng gói cẩn thận và giao đến tận tay bạn.', 'delivery'],
] as const

function ProcessIcon({ name }: { name: typeof processSteps[number][3] }) {
  if (name === 'gift') return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 14h22v14H5zM16 14v14M4 9h24v5H4zM16 9c-5 0-7-6-3-6 2 0 3 3 3 6Zm0 0c5 0 7-6 3-6-2 0-3 3-3 6Z" /></svg>
  if (name === 'sparkle') return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="m16 3 1.8 8.2L26 13l-8.2 1.8L16 23l-1.8-8.2L6 13l8.2-1.8L16 3Zm9 16 .8 3.2L29 23l-3.2.8L25 27l-.8-3.2L21 23l3.2-.8L25 19ZM7 20l.8 3.2L11 24l-3.2.8L7 28l-.8-3.2L3 24l3.2-.8L7 20Z" /></svg>
  if (name === 'print') return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M9 11V4h14v7M7 24H4v-10a3 3 0 0 1 3-3h18a3 3 0 0 1 3 3v10h-3M9 19h14v9H9zM24 15h1" /></svg>
  return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M3 8h17v14H3zM20 13h5l4 4v5h-9zM8 26a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm16 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM3 12H1" /></svg>
}

export function Home({ products, categories = [], filamentColors = [], siteConfig, setView, onOpenShop, onOpenCategory, onEditField, onEditProduct }: { products: Product[]; categories?: string[]; filamentColors?: ProductColor[]; siteConfig: SiteConfig; setView: SetView; onOpenShop?: () => void; onOpenCategory?: (category: string) => void; onEditField?: (field: keyof SiteConfig) => void; onEditProduct?: (productId: string | number, field: 'name' | 'image') => void }) {
  const edit = (field: keyof SiteConfig) => onEditField && <button className="inline-edit label-edit" type="button" onClick={() => onEditField(field)} aria-label="Chỉnh nội dung">✎</button>
  const categoryNames = Array.from(new Map([...categories, ...products.map(product => product.category)].map(name => name.trim()).filter(Boolean).map(name => [categoryKey(name), name])).values()).filter(name => categoryKey(name) !== 'in 3d' && categoryKey(name) !== 'nhựa in')
  const openShop = () => onOpenShop ? onOpenShop() : setView('shop')
  const openCategory = (category: string) => onOpenCategory ? onOpenCategory(category) : setView('shop')
  return <>
    <section className="hero"><div className="shell hero-grid"><div className="hero-copy"><p className="hero-eyebrow"><span>✦</span> Sản phẩm in 3D, dành cho bạn mỗi ngày</p><h1>{siteConfig.heroTitle}{edit('heroTitle')} <span>{siteConfig.heroAccent}{edit('heroAccent')}</span></h1>{siteConfig.heroDescription && <p>{siteConfig.heroDescription}{edit('heroDescription')}</p>}<div className="actions"><button className="button button-dark" onClick={openShop}>Khám phá sản phẩm <span>→</span></button><button className="button button-light" onClick={() => setView('tracking-login')}>Theo dõi đơn hàng</button></div><div className="hero-proof"><span><b>01</b> Thiết kế riêng</span><span><b>02</b> In 3D tỉ mỉ</span><span><b>03</b> Đóng gói cẩn thận</span></div></div><div className="hero-visual"><div className="hero-orbit hero-orbit-one" /><div className="hero-orbit hero-orbit-two" /><div className="hero-image-card"><img className="hero-image" src={siteConfig.heroImage} alt="Sản phẩm in 3D SAMUCHAN" onError={event => { event.currentTarget.src = '/brand/logo_samuchan.jpg' }} /><span className="hero-sticker hero-sticker-top">Made for you <i>✦</i></span><span className="hero-sticker hero-sticker-bottom"><b>100%</b> cá nhân hoá</span>{onEditField && <button className="inline-edit image-edit" type="button" onClick={() => onEditField('heroImage')} aria-label="Chỉnh ảnh banner">✎</button>}</div></div></div></section>
    <section className="process"><div className="shell"><div className="section-heading center"><p>Quy trình đặt hàng</p><h2>{siteConfig.processHeading}{edit('processHeading')}</h2><span className="section-lead">Đơn giản, rõ ràng và luôn có người đồng hành cùng bạn.</span></div><div className="process-grid">{processSteps.map(([number, title, text, icon]) => <article key={number} className="process-step"><div className="process-icon"><ProcessIcon name={icon} /></div><span className="process-number">{number}</span><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>
    <section className="shell home-categories"><div className="section-heading"><p>Mua sắm theo danh mục</p><h2>Chọn điều bạn cần</h2></div><div className="home-category-grid">
      {categoryNames.map(category => { const categoryProducts = products.filter(product => categoryKey(product.category) === categoryKey(category)); const image = categoryProducts[0]?.image; return <button className="home-category-card" key={categoryKey(category)} type="button" onClick={() => openCategory(category)}><span className="home-category-visual home-gift-visual">{image ? <img src={image} alt="" /> : <span className="home-category-placeholder">✦</span>}<b>{categoryProducts.length} sản phẩm</b></span><span className="home-category-copy"><small>DANH MỤC SẢN PHẨM</small><strong>{category}</strong><span>{categoryProducts.length ? `Khám phá ${categoryProducts.length} sản phẩm trong danh mục này.` : `Xem các sản phẩm thuộc danh mục ${category}.`}</span><b>Xem danh mục <i>→</i></b></span></button> })}
      <button className="home-category-card" type="button" onClick={() => openCategory('In 3D')}><span className="home-category-visual home-filament-visual">{filamentColors.slice(0, 3).map((color, index) => { const placement = ['translate(-44%, 8%) rotate(-9deg)', 'translate(0, -4%) rotate(2deg)', 'translate(42%, 8%) rotate(9deg)'][index]; return color.imageUrl ? <img key={color.id} src={color.imageUrl} alt="" style={{ zIndex: 3 - index, transform: placement }} /> : <i key={color.id} style={{ backgroundColor: color.hex ?? '#e5e7eb', zIndex: 3 - index, transform: placement }} /> })}{!filamentColors.length && <span className="home-category-placeholder">◉</span>}<b>{filamentColors.length} màu nhựa</b></span><span className="home-category-copy"><small>NHỰA IN THEO CUỘN 1KG</small><strong>In 3D</strong><span>Mỗi màu trong master data là một mặt hàng riêng để bạn chọn.</span><b>Xem các màu nhựa <i>→</i></b></span></button>
    </div></section>
    <section className="shell featured"><div className="section-heading row"><div><p>Bộ sưu tập nổi bật</p><h2>{siteConfig.featuredHeading}{edit('featuredHeading')}</h2></div><button className="text-button" onClick={openShop}>Xem tất cả <span>→</span></button></div><div className="product-grid">{products.slice(0, 4).map(product => <ProductCard key={product.id} product={product} setView={setView} onEdit={onEditProduct} />)}</div></section>
  </>
}

export function Shop({ products, categories: catalogCategories = [], colors = [], addToCart = () => undefined, setView, initialCategory = 'Tất cả', onFilterChange, onEditProduct }: { products: Product[]; categories?: string[]; colors?: ProductColor[]; addToCart?: (item: CartItem) => void; setView: SetView; initialCategory?: string; onFilterChange?: (category: string) => void; onEditProduct?: (productId: string | number, field: 'name' | 'image') => void }) {
  const [filter, setFilter] = useState<string>(initialCategory)
  const [filamentSearchQuery, setFilamentSearchQuery] = useState('')
  useEffect(() => setFilter(initialCategory), [initialCategory])
  const categories = Array.from(new Map([...catalogCategories, ...products.map(product => product.category)].map(name => name.trim()).filter(Boolean).map(name => [categoryKey(name), name])).values()).filter(name => categoryKey(name) !== 'in 3d' && categoryKey(name) !== 'nhựa in')
  const list = filter === 'Tất cả' ? products : products.filter(product => product.category === filter)
  const filamentGroups = Array.from(colors.reduce((groups, color) => {
    const key = (color.materialType ?? '').normalize('NFC').trim().toLocaleLowerCase('vi-VN') || 'unclassified'
    const group = groups.get(key) ?? { name: filamentTypeLabel(color.materialType), colors: [] as ProductColor[] }
    group.colors.push(color)
    groups.set(key, group)
    return groups
  }, new Map<string, { name: string; colors: ProductColor[] }>()).values()).sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  const normalizedFilamentSearch = filter === 'In 3D' ? normalizeFilamentSearch(filamentSearchQuery) : ''
  const visibleFilamentGroups = filamentGroups.map(group => ({
    ...group,
    colors: group.colors.filter(color => !normalizedFilamentSearch || normalizeFilamentSearch(color.name).includes(normalizedFilamentSearch) || normalizeFilamentSearch(group.name).includes(normalizedFilamentSearch)),
  })).filter(group => group.colors.length > 0)
  const showProducts = filter !== 'In 3D'
  const showFilaments = filter === 'Tất cả' || filter === 'In 3D'
  const hasItems = showProducts && list.length > 0 || showFilaments && visibleFilamentGroups.length > 0
  return <main className="shell page">
    <div className="catalogue-top">
      <h1>{filter === 'Tất cả' ? 'Tất cả sản phẩm' : filter}</h1>
      <div className="filters" aria-label="Lọc danh mục">{(['Tất cả', ...categories, ...(colors.length ? ['In 3D'] : [])] as string[]).map(category => <button key={category} className={filter === category ? 'active' : ''} onClick={() => { setFilter(category); onFilterChange?.(category) }}>{category}</button>)}</div>
      {!onEditProduct && <button className="button button-light" type="button" onClick={() => setView('filament-shop')}>Xem tất cả màu nhựa</button>}
    </div>
    {showProducts && <div className="product-grid">{list.map(product => <ProductCard key={product.id} product={product} setView={setView} onEdit={onEditProduct} />)}</div>}
    {showFilaments && <section className="filament-product-groups" aria-label="Nhựa in theo loại nhựa">
      {filter === 'In 3D' && <div className="filament-shop-inline-search"><label>Tìm tên màu hoặc loại nhựa<input type="search" value={filamentSearchQuery} onChange={event => setFilamentSearchQuery(event.target.value)} placeholder="Ví dụ: Sky Blue, PLA Matte" aria-label="Tìm theo tên màu hoặc loại nhựa" /></label><span>{visibleFilamentGroups.reduce((sum, group) => sum + group.colors.length, 0)} màu</span></div>}
      {visibleFilamentGroups.map(group => <section className="filament-product-group" key={group.name}><header><h2>{group.name}</h2><span>{group.colors.length} màu</span></header><div className="product-grid">{group.colors.map(color => <FilamentProductCard key={'filament-' + color.id} color={color} addToCart={addToCart} setView={setView} />)}</div></section>)}
    </section>}
    {!hasItems && (filter === 'In 3D' && normalizedFilamentSearch ? <div className="filament-search-empty" role="status"><p>Không tìm thấy màu hoặc loại nhựa phù hợp.</p><button type="button" className="text-button" onClick={() => setFilamentSearchQuery('')}>Xóa tìm kiếm</button></div> : <p className="admin-empty">Chưa có sản phẩm trong danh mục này.</p>)}
  </main>
}

function filamentTypeLabel(value?: string | null) {
  if (!value || value === 'unclassified') return 'Chưa phân loại'
  const key = value.trim().toLocaleLowerCase('vi-VN').replace(/\+/g, '_plus').replace(/[\s-]+/g, '_')
  return materialTypeLabels[key] ?? value
}

function addFilamentColorToCart(color: ProductColor, addToCart: (item: CartItem) => void, setView: SetView) {
  if (color.priceVnd === null || color.priceVnd === undefined) return
  const type = filamentTypeLabel(color.materialType)
  const brand = color.brand?.trim()
  addToCart({
    id: 'filament-' + color.id,
    name: 'Nhựa in 3D · ' + type,
    price: color.priceVnd,
    originalPrice: color.originalPriceVnd ?? undefined,
    discountPercent: color.discountPercent,
    discountEndsOn: color.discountEndsOn,
    category: 'Nhựa in',
    image: color.imageUrl || '/brand/logo_samuchan.jpg',
    colors: [color.name],
    sizes: ['Cuộn 1kg'],
    stockQuantity: 0,
    color: color.name + (brand ? ' · ' + brand : ''),
    size: 'Cuộn 1kg',
    quantity: 1,
    filamentColorId: color.id,
    availabilityNote: color.isAvailable === false ? preorderNote : undefined,
  })
  setView('cart')
}

function FilamentProductCard({ color, addToCart, setView }: { color: ProductColor; addToCart: (item: CartItem) => void; setView: SetView }) {
  const priceReady = color.priceVnd !== null && color.priceVnd !== undefined
  const type = filamentTypeLabel(color.materialType)
  return <article className="filament-product-card">
    <div className="product-image filament-product-image">
      {color.imageUrl ? <img src={color.imageUrl} alt={color.name} /> : <span className="filament-product-swatch" style={{ backgroundColor: color.hex ?? '#e5e7eb' }} aria-label={color.name} />}
    </div>
    <div className="product-info"><span><strong>{color.name} - Cuộn 1kg</strong><small className="product-category">Nhựa in · {type}</small><small className="product-option-count">{color.brand || 'Chưa có hãng'}</small>{color.isAvailable === false && <small className="preorder-note">{preorderNote}</small>}{!priceReady && <small>Shop đang cập nhật giá theo loại nhựa.</small>}</span>{priceReady ? <PriceDisplay price={color.priceVnd!} originalPrice={color.originalPriceVnd ?? undefined} discountPercent={color.discountPercent} discountEndsOn={color.discountEndsOn} /> : <b>Chưa có giá</b>}</div>
    <button className="button button-dark" type="button" disabled={!priceReady} onClick={() => addFilamentColorToCart(color, addToCart, setView)}>{priceReady ? 'Thêm cuộn vào giỏ' : 'Chưa thể đặt'}</button>
  </article>
}

export function FilamentShop({ colors, addToCart, setView }: { colors: ProductColor[]; addToCart: (item: CartItem) => void; setView: SetView }) {
  const [materialFilter, setMaterialFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const materialTypes = useMemo(() => [...new Set(colors.map(color => filamentTypeLabel(color.materialType)))].sort((a, b) => a.localeCompare(b, 'vi')), [colors])
  const normalizedSearch = useMemo(() => normalizeFilamentSearch(searchQuery), [searchQuery])
  const visibleColors = useMemo(() => colors.filter(color => {
    const matchesMaterial = !materialFilter || filamentTypeLabel(color.materialType) === materialFilter
    const matchesSearch = !normalizedSearch || normalizeFilamentSearch(color.name).includes(normalizedSearch) || normalizeFilamentSearch(filamentTypeLabel(color.materialType)).includes(normalizedSearch)
    return matchesMaterial && matchesSearch
  }), [colors, materialFilter, normalizedSearch])
  function choose(color: ProductColor) {
    addFilamentColorToCart(color, addToCart, setView)
  }
  return <main className="shell page filament-shop-page">
    <header className="filament-shop-heading"><p>NHỰA IN 3D</p><h1>Chọn màu nhựa theo cuộn 1kg</h1><span>Danh sách lấy từ toàn bộ màu trong master data.</span></header>
    <div className="filament-shop-filters"><span className="filament-shop-result-count">{visibleColors.length} / {colors.length} màu</span><label className="filament-shop-search">Tìm tên màu hoặc loại nhựa<input type="search" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Ví dụ: Sky Blue, PLA Matte" aria-label="Tìm theo tên màu hoặc loại nhựa" /></label><label className="filament-shop-material-filter">Loại nhựa<select value={materialFilter} onChange={event => setMaterialFilter(event.target.value)}><option value="">Tất cả loại nhựa</option>{materialTypes.map(type => <option key={type} value={type}>{type}</option>)}</select></label></div>
    {visibleColors.length ? <div className="filament-color-grid">{visibleColors.map(color => {
      const type = filamentTypeLabel(color.materialType)
      const priceReady = color.priceVnd !== null && color.priceVnd !== undefined
      return <article className="filament-color-card" key={color.id}>
        {color.imageUrl ? <img className="filament-color-image" src={color.imageUrl} alt={color.name} /> : <i className="filament-color-image filament-color-swatch" style={{ backgroundColor: color.hex ?? '#e5e7eb' }} aria-label={color.name} />}
        <div className="filament-color-info"><h2>{color.name}</h2><span>{color.brand || 'Chưa có hãng'} · {type}</span>{priceReady ? <PriceDisplay price={color.priceVnd!} originalPrice={color.originalPriceVnd ?? undefined} discountPercent={color.discountPercent} discountEndsOn={color.discountEndsOn} /> : <b>Chưa có giá</b>}{color.isAvailable === false && <small className="preorder-note">{preorderNote}</small>}{!priceReady && <small>Shop đang cập nhật giá theo loại nhựa.</small>}</div>
        <button className="button button-dark" type="button" disabled={!priceReady} onClick={() => choose(color)}>{priceReady ? 'Chọn cuộn này' : 'Chưa thể đặt'}</button>
      </article>
    })}</div> : colors.length ? <div className="filament-search-empty" role="status"><p>Không tìm thấy màu hoặc loại nhựa phù hợp.</p><button type="button" className="text-button" onClick={() => { setSearchQuery(''); setMaterialFilter('') }}>Xóa tìm kiếm và bộ lọc</button></div> : <p className="admin-empty">Chưa có màu nhựa trong master data.</p>}
  </main>
}

export function ProductDetail({ product, setView, addToCart }: { product: Product; setView: SetView; addToCart: (item: CartItem) => void }) {
  const images = useMemo(() => [...new Set([...(product.images?.length ? product.images : [product.image]), ...(product.variants ?? []).map(variant => variant.imageUrl).filter((imageUrl): imageUrl is string => Boolean(imageUrl))])], [product.image, product.images, product.variants])
  const productColorVariants = useMemo(() => product.variants ?? [], [product.variants])
  const allowedMasterColors = useMemo(() => (product.masterColors ?? []).filter(option => product.filamentTypes?.includes(option.materialType ?? '') ?? false), [product.masterColors, product.filamentTypes])
  const existingColorOptions = useMemo(() => {
    const options = new Map<string, CustomColorOption>()
    for (const variant of productColorVariants) {
      const id = variant.colorId ?? variant.color
      if (!options.has(id)) options.set(id, { id, name: variant.color, imageUrl: variant.colorImageUrl, hex: variant.colorHex, brand: variant.colorBrand, materialType: variant.colorMaterialType, isAvailable: variant.colorIsAvailable })
    }
    if (!options.size) for (const name of product.colors) options.set(name, { id: name, name })
    return [...options.values()]
  }, [productColorVariants, product.colors])
  const customColorOptions = useMemo(() => {
    const existingIds = new Set(productColorVariants.map(variant => variant.colorId).filter((id): id is string => Boolean(id)))
    const existingNames = new Set(productColorVariants.filter(variant => !variant.colorId).map(variant => variant.color))
    return allowedMasterColors.filter(option => !existingIds.has(option.id) && !existingNames.has(option.name)).map(option => ({ id: option.id, name: option.name, imageUrl: option.imageUrl, hex: option.hex, isAvailable: option.isAvailable }))
  }, [allowedMasterColors, productColorVariants])
  const [selectedImage, setSelectedImageState] = useState(images[0])
  const [colorKey, setColorKey] = useState(existingColorOptions[0]?.id ?? product.colors[0] ?? '')
  const [size, setSize] = useState(product.sizes[0])
  const [quantity, setQuantity] = useState(1)
  const [showCustomColorPage, setShowCustomColorPage] = useState(false)
  const selectedColorOption = existingColorOptions.find(option => option.id === colorKey)
  function colorOptionLabel(option: CustomColorOption) {
    const sameName = existingColorOptions.filter(item => item.name === option.name)
    if (sameName.length < 2) return option.name
    const detail = [option.brand, option.materialType ? materialTypeLabels[option.materialType] ?? option.materialType : null].filter(Boolean).join(' · ')
    return detail ? `${option.name} · ${detail}` : option.name
  }
  const color = selectedColorOption ? colorOptionLabel(selectedColorOption) : product.variants?.find(variant => (variant.colorId ?? variant.color) === colorKey)?.color ?? colorKey
  const variantMatchesColor = (variant: NonNullable<Product['variants']>[number]) => (variant.colorId ?? variant.color) === colorKey
  const selectedVariant = productColorVariants.find(variant => variantMatchesColor(variant) && variant.size === size)
  const selectedVariantImage = selectedVariant?.imageUrl ?? productColorVariants.find(variant => variantMatchesColor(variant) && variant.imageUrl)?.imageUrl ?? images[0]
  function setSelectedImage(imageUrl: string) {
    setSelectedImageState(imageUrl)
    const matchingVariants = productColorVariants.filter(variant => variant.imageUrl === imageUrl)
    const matchingVariant = matchingVariants.find(variant => (variant.colorId ?? variant.color) === colorKey && variant.size === size)
      ?? matchingVariants.find(variant => variant.size === size)
      ?? matchingVariants[0]
    if (matchingVariant) { setColorKey(matchingVariant.colorId ?? matchingVariant.color); setSize(matchingVariant.size) }
  }
  useEffect(() => { setSelectedImageState(selectedVariantImage) }, [product.id, colorKey, size, selectedVariantImage])
  function chooseColor(colorId: string) {
    const matchingVariant = productColorVariants.find(variant => (variant.colorId ?? variant.color) === colorId && variant.size === size)
      ?? productColorVariants.find(variant => (variant.colorId ?? variant.color) === colorId)
    setColorKey(colorId)
    if (matchingVariant) setSize(matchingVariant.size)
  }
  const descriptionSections = splitProductDescription(product.description || 'Sản phẩm được in 3D với độ hoàn thiện cao. Bạn có thể chọn màu sắc, kích thước phù hợp trước khi đặt hàng.')
  const priceVariant = productColorVariants.find(variant => variant.size === size)
  const price = priceVariant?.price ?? product.price
  const unavailable = productColorVariants.length > 0 && !selectedVariant
  const isColorAvailable = selectedVariant?.colorIsAvailable ?? selectedColorOption?.isAvailable ?? true
  function submit() { if (!unavailable) { addToCart({ ...product, price, originalPrice: selectedVariant?.originalPrice ?? product.originalPrice, color, size, quantity, variantId: selectedVariant?.id, availabilityNote: isColorAvailable ? undefined : preorderNote }); setView('cart') } }
  function addCustomColorToCart(option: CustomColorOption) {
    const priceVariant = productColorVariants.find(variant => variant.size === size)
    if (!priceVariant) return
    addToCart({ ...product, price: priceVariant.price ?? product.price, originalPrice: priceVariant.originalPrice ?? product.originalPrice, color: 'Màu tùy chỉnh: ' + option.name, size, quantity, variantId: priceVariant.id, customColorId: option.id, customColorImageUrl: option.imageUrl, customColorHex: option.hex, availabilityNote: option.isAvailable === false ? preorderNote : undefined })
    setView('cart')
  }
  if (showCustomColorPage) return <CustomColorPage product={product} colors={customColorOptions} onBack={() => setShowCustomColorPage(false)} onAddToCart={addCustomColorToCart} />
  return <main className="shell page product-detail"><button className="back-button" onClick={() => setView('shop')}>← Quay lại sản phẩm</button><div className="detail-grid"><div className="detail-gallery"><div className="detail-image">{images.length > 1 && <><button className="gallery-arrow gallery-arrow-left" type="button" onClick={() => setSelectedImage(images[(images.indexOf(selectedImage) - 1 + images.length) % images.length])} aria-label="Ảnh trước">‹</button><button className="gallery-arrow gallery-arrow-right" type="button" onClick={() => setSelectedImage(images[(images.indexOf(selectedImage) + 1) % images.length])} aria-label="Ảnh tiếp theo">›</button></>}<img src={selectedImage} alt={product.name} />{product.demoVideoUrl && <video controls preload="metadata" src={product.demoVideoUrl} aria-label={'Video giới thiệu ' + product.name} />}</div>{images.length > 1 && <div className="media-thumbnails" aria-label="Các ảnh sản phẩm">{images.map(image => <button key={image} className={selectedImage === image ? 'selected' : ''} type="button" onClick={() => setSelectedImage(image)}><img src={image} alt="" /></button>)}</div>}<FormattedDescription description={descriptionSections.introduction} /></div><div className="detail-content"><h1>{product.name}</h1><PriceDisplay className="detail-price" price={price} originalPrice={priceVariant?.originalPrice ?? product.originalPrice} discountPercent={product.discountPercent} discountEndsOn={product.discountEndsOn} />{descriptionSections.details && <section className="product-specifications"><h2>Thông tin sản phẩm</h2><FormattedDescription description={descriptionSections.details} /></section>}<fieldset><legend>Màu sắc: <b>{color}</b></legend><div className="choice-row">{existingColorOptions.map(option => <button key={option.id} className={colorKey === option.id ? 'selected' : ''} onClick={() => chooseColor(option.id)}>{colorOptionLabel(option)}</button>)}<button className="custom-color-open" type="button" onClick={() => setShowCustomColorPage(true)}>✦ Tùy chỉnh màu</button></div></fieldset><fieldset><legend>Kích thước: <b>{size}</b></legend><div className="choice-row">{product.sizes.map(option => <button key={option} className={size === option ? 'selected' : ''} onClick={() => setSize(option)}>{option}</button>)}</div></fieldset><div className="purchase-row"><div className="quantity" aria-label="Số lượng"><button onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="Giảm số lượng">−</button><span>{quantity}</span><button onClick={() => setQuantity(quantity + 1)} aria-label="Tăng số lượng">+</button></div><button className="button button-dark add-button" disabled={unavailable} onClick={submit}>{unavailable ? 'Chọn kích thước phù hợp' : 'Thêm vào giỏ hàng'}</button></div>{unavailable && <p className="stock-note">Không có variant cho kích thước này.</p>}{!unavailable && !isColorAvailable && <p className="stock-note preorder-note">{preorderNote}</p>}</div></div></main>
}

function CustomColorPage({ product, colors, onBack, onAddToCart }: { product: Product; colors: CustomColorOption[]; onBack: () => void; onAddToCart: (color: CustomColorOption) => void }) {
  const [selectedColorId, setSelectedColorId] = useState(colors[0]?.id ?? '')
  const selectedOption = colors.find(option => option.id === selectedColorId)
  return <main className="shell page custom-color-page">
    <button className="back-button" type="button" onClick={onBack}>← Quay lại sản phẩm</button>
    <header className="custom-color-heading"><p>TÙY CHỈNH THEO SỞ THÍCH</p><h1>Chọn màu cho sản phẩm</h1><span>{product.name}</span></header>
    <div className="custom-color-layout">
      <section className="custom-color-preview" aria-label="Xem trước sản phẩm">
        <div className="custom-color-product-image"><img src={product.colorPreviewUrl ?? product.images?.[0] ?? product.image} alt={product.name} />{selectedOption?.hex && <div className="custom-color-tint" style={{ backgroundColor: selectedOption.hex }} aria-hidden="true" />}</div>
        <div className="custom-color-preview-caption"><div><small>ĐANG XEM MÀU</small><h2>{selectedOption?.name ?? 'Chọn một màu bên cạnh'}</h2></div>{selectedOption?.imageUrl ? <img src={selectedOption.imageUrl} alt={`Mẫu màu ${selectedOption.name}`} /> : <i style={{ backgroundColor: selectedOption?.hex ?? '#e5e7eb' }} />}</div>
        <p>Màu phủ trên ảnh sản phẩm là bản xem trước để bạn tham khảo.</p>{selectedOption?.isAvailable === false && <p className="stock-note preorder-note">{preorderNote}</p>}
      </section>
      <section className="custom-color-picker"><div><h2>Bảng màu</h2><p>Chọn màu từ danh sách master data để xem thử trên sản phẩm.</p></div>{colors.length ? <div className="custom-color-options">{colors.map(option => <button key={option.id} type="button" className={selectedColorId === option.id ? 'selected' : ''} onClick={() => setSelectedColorId(option.id)} aria-pressed={selectedColorId === option.id}>{option.imageUrl ? <img className="custom-color-sample" src={option.imageUrl} alt="" /> : <i className="custom-color-sample" style={{ backgroundColor: option.hex ?? '#e5e7eb' }} />}<span className="custom-color-option-name"><b>{option.name}</b></span>{selectedColorId === option.id && <span className="custom-color-check" aria-hidden="true">✓</span>}</button>)}</div> : <p className="custom-color-empty">Không còn màu master nào khác chưa có trong sản phẩm.</p>}<button className="button button-dark custom-color-done" type="button" onClick={() => selectedOption && onAddToCart(selectedOption)} disabled={!selectedOption}>Thêm màu này vào giỏ hàng</button></section>
    </div>
  </main>
}

export function Cart({ cart, setCart, setView }: { cart: CartItem[]; setCart: (items: CartItem[]) => void; setView: SetView }) {
  const total = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart])
  function changeQuantity(index: number, amount: number) { setCart(cart.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Math.max(1, item.quantity + amount) } : item)) }
  if (!cart.length) return <main className="shell empty-state"><h1>Giỏ hàng của bạn đang trống</h1><p>Hãy khám phá các món quà in 3D của SAMUCHAN.</p><button className="button button-dark" onClick={() => setView('shop')}>Xem sản phẩm</button></main>
  return <main className="shell page"><h1 className="page-title">Giỏ hàng</h1><div className="cart-layout"><section className="cart-list">{cart.map((item, index) => <article className="cart-item" key={itemKey(item)}><img src={item.image} alt="" /><div><h2>{item.name}</h2><p>{item.color} · {item.size}</p>{item.availabilityNote && <small className="preorder-note">{item.availabilityNote}</small>}<PriceDisplay price={item.price} originalPrice={item.originalPrice} discountPercent={item.discountPercent} discountEndsOn={item.discountEndsOn} /></div><div className="cart-actions"><div className="quantity"><button onClick={() => changeQuantity(index, -1)}>−</button><span>{item.quantity}</span><button onClick={() => changeQuantity(index, 1)}>+</button></div><button className="remove" onClick={() => setCart(cart.filter((_, itemIndex) => itemIndex !== index))}>Xóa</button></div></article>)}</section><OrderSummary total={total} actionLabel="Tiến hành thanh toán" onAction={() => setView('checkout')} /></div></main>
}

function OrderSummary({ total, actionLabel, onAction }: { total: number; actionLabel: string; onAction?: () => void }) {
  return <aside className="order-summary"><h2>Tóm tắt đơn hàng</h2><p><span>Tạm tính</span><b>{formatPrice(total)}</b></p><p><span>Phí vận chuyển</span><b>Miễn phí</b></p><p className="grand-total"><span>Tổng cộng</span><b>{formatPrice(total)}</b></p>{onAction && <button className="button button-dark" onClick={onAction}>{actionLabel}</button>}</aside>
}

export function Checkout({ cart, setCart, setOrderCode, setTrackingToken, setTrackingOrderCode, setView, preview = false }: { cart: CartItem[]; setCart: (items: CartItem[]) => void; setOrderCode: (code: string) => void; setTrackingToken?: (token: string) => void; setTrackingOrderCode?: (code: string) => void; setView: SetView; preview?: boolean }) {
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  if (!cart.length) return <main className="shell empty-state"><h1>Chưa có đơn hàng để thanh toán</h1><button className="button button-dark" onClick={() => setView('shop')}>Xem sản phẩm</button></main>
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setSubmitting(true); setError(''); const form = new FormData(event.currentTarget); try { if (preview) { setOrderCode('SAMU-PREVIEW'); setCart([]); setView('success'); return } const response = await fetch('/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ customerName: form.get('name'), customerPhone: form.get('phone'), shippingAddress: form.get('address'), note: form.get('note'), items: cart.map(item => ({ variantId: item.variantId, filamentColorId: item.filamentColorId, quantity: item.quantity, customColorId: item.customColorId, option: item.availabilityNote ? { availabilityNote: item.availabilityNote } : undefined })) }) }); const result = await response.json(); if (!response.ok) throw new Error(result.message || result.error || 'Không thể tạo đơn hàng.'); setOrderCode(result.data.orderCode); setTrackingToken?.(result.data.trackingToken); setTrackingOrderCode?.(result.data.orderCode); setCart([]); setView('success') } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể tạo đơn hàng.') } finally { setSubmitting(false) } }
  return <main className="shell page checkout-layout"><section><h1>Thông tin giao hàng</h1><form className="checkout-form" onSubmit={submit}><label>Họ và tên<input required name="name" autoComplete="name" /></label><label>Số điện thoại<input required name="phone" type="tel" autoComplete="tel" /></label><label>Địa chỉ nhận hàng chi tiết<textarea required name="address" rows={3} autoComplete="street-address" /></label><label>Ghi chú cho shop (không bắt buộc)<textarea name="note" rows={2} placeholder="VD: Đơn quà tặng, khắc tên 'An'..." /></label><div className="notice"><b>Lưu ý quan trọng</b><p>Sau khi đặt hàng, SAMUCHAN sẽ liên hệ qua Zalo hoặc số điện thoại để xác nhận thông tin sản phẩm trước khi đưa vào sản xuất.</p></div>{error && <p className="admin-error">{error}</p>}<button className="button button-dark" type="submit" disabled={submitting}>{submitting ? 'Đang gửi đơn…' : 'Xác nhận đặt hàng'}</button></form></section><aside className="checkout-order"><h2>Đơn hàng của bạn</h2>{cart.map(item => <div className="checkout-item" key={itemKey(item)}><img src={item.image} alt="" /><p><b>{item.name}</b><span>{item.color} · {item.size}</span>{item.availabilityNote && <span className="preorder-note">{item.availabilityNote}</span>}<span>SL: {item.quantity}</span></p><PriceDisplay price={item.price * item.quantity} originalPrice={item.originalPrice === undefined ? undefined : item.originalPrice * item.quantity} discountPercent={item.discountPercent} discountEndsOn={item.discountEndsOn} /></div>)}<div className="checkout-total"><p><span>Tạm tính</span><b>{formatPrice(total)}</b></p><p><span>Phí vận chuyển</span><b>Miễn phí</b></p><p className="grand-total"><span>Tổng thanh toán</span><b>{formatPrice(total)}</b></p></div></aside></main>
}

export function OrderSuccess({ orderCode, trackingToken, setTrackingToken, setView }: { orderCode: string; trackingToken: string; setTrackingToken: (token: string) => void; setView: SetView }) {
  const trackingHref = orderCode ? '/tracking/' + encodeURIComponent(orderCode) : (trackingToken ? '/?tracking=' + encodeURIComponent(trackingToken) : undefined)
  return <main className="shell success-page"><div className="success-icon">✓</div><h1>Đặt hàng thành công!</h1><p>Cảm ơn bạn đã tin tưởng SAMUCHAN. Mã đơn hàng của bạn là:</p><b className="order-code">{orderCode}</b><p className="success-note">Shop sẽ sớm liên hệ qua số điện thoại để xác nhận đơn hàng trước khi tiến hành sản xuất.</p><div className="actions centered"><button className="button button-light" onClick={() => { setTrackingToken(trackingToken); setView('tracking') }}>Theo dõi đơn hàng</button><button className="button button-dark" onClick={() => setView('shop')}>Tiếp tục mua sắm</button></div>{trackingHref && <p className="tracking-link"><span>Link tra cứu đơn hàng:</span> <a href={trackingHref}>{window.location.origin}{trackingHref}</a></p>}</main>
}

export function TrackingLogin({ setToken, setOrderCode, setView }: { setToken: (token: string) => void; setOrderCode: (code: string) => void; setView: SetView }) {
  const [error, setError] = useState('')
  function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const input = String(form.get('code') ?? '').trim(); const token = input.match(/[a-f0-9]{64}/i)?.[0] ?? ''; const orderCode = input.match(/SAMU-[a-f0-9]{10}/i)?.[0] ?? ''; if (token) { setError(''); setToken(token); setView('tracking'); return } if (orderCode) { setError(''); setOrderCode(orderCode.toUpperCase()); setView('tracking'); return } setError('Nhập mã đơn dạng SAMU-XXXXXXXXXX hoặc link/token tracking hợp lệ.') }
  return <main className="tracking-login"><h1>Kiểm tra đơn hàng</h1><p>Nhập mã đơn hàng hiển thị sau khi đặt, ví dụ SAMU-D300164543. Bạn cũng có thể dán link tracking riêng.</p><form onSubmit={submit}><input name="code" required placeholder="Mã đơn hàng hoặc link tracking" aria-describedby={error ? 'tracking-input-error' : undefined} />{error && <p className="admin-error" id="tracking-input-error" role="alert">{error}</p>}<button className="button button-dark">Tra cứu</button></form></main>
}

export function Warranty() {
  const [modal, setModal] = useState(false)
  const [tab, setTab] = useState<'conditions' | 'excluded' | 'process'>('conditions')
  const conditions = ['Còn trong thời hạn bảo hành — Gửi yêu cầu trong vòng 3 ngày kể từ ngày nhận sản phẩm.', 'Có thông tin xác nhận mua hàng — Cung cấp mã đơn hàng hoặc thông tin tương đương để xác minh giao dịch.', 'Sản phẩm có lỗi kỹ thuật hoặc lỗi sản xuất — Ví dụ: chi tiết gãy, nứt do lỗi sản xuất hoặc khớp chuyển động lỗi.', 'Cung cấp hình ảnh thể hiện lỗi — Gửi hình ảnh tình trạng sản phẩm để SAMUCHAN kiểm tra.', 'Liên hệ trước khi tự sửa chữa — Không tự can thiệp vào sản phẩm trước khi được hướng dẫn.']
  const excluded = ['Hư hỏng do va đập, rơi vỡ hoặc tác động ngoại lực.', 'Hư hỏng do sử dụng sai hướng dẫn hoặc vượt quá giới hạn sử dụng.', 'Hư hỏng do nhiệt độ cao, lửa, hóa chất hoặc môi trường không phù hợp.', 'Hư hỏng do tự ý cắt, khoan, dán, gia công, tháo lắp hoặc sửa chữa.', 'Hao mòn tự nhiên hoặc dấu hiệu sử dụng lâu ngày không xuất phát từ lỗi sản xuất.']
  const process = ['Gửi yêu cầu và mã đơn hàng.', 'SAMUCHAN tiếp nhận, kiểm tra hình ảnh và phản hồi.', 'Gửi sản phẩm về shop nếu cần kiểm tra trực tiếp.', 'Hoàn tất hỗ trợ, sửa chữa hoặc thay thế theo chính sách.']
  const items = tab === 'conditions' ? conditions : tab === 'excluded' ? excluded : process
  return <main className="shell warranty-page"><div className="warranty-layout"><aside className="warranty-sidebar"><p>DANH MỤC</p><button className="active">Gửi yêu cầu <span>›</span></button><button>Lịch sử yêu cầu <span>›</span></button></aside><section className="warranty-main"><button className="warranty-banner" onClick={() => setModal(true)}><i className="fa-regular fa-file-lines"></i><div><strong>Chính sách bảo hành sản phẩm</strong><small>Xem điều kiện và quy trình trước khi gửi yêu cầu</small></div><b>›</b></button><div className="warranty-steps"><span className="active"><b>1</b>Thông tin đơn</span><i /><span><b>2</b>Tình trạng lỗi</span><i /><span><b>3</b>Nhận hỗ trợ</span></div><section className="warranty-form"><h1>Gửi yêu cầu bảo hành</h1><p>Chúng tôi sẽ hỗ trợ bạn nhanh chóng theo chính sách bảo hành của SAMUCHAN.</p><label>Mã đơn hàng <input placeholder="Ví dụ: SAMU-XXXXXXXXXX" /></label><label>Mô tả tình trạng sản phẩm <textarea rows={4} placeholder="Mô tả ngắn gọn tình trạng cần hỗ trợ..." /></label><button className="button button-dark">Tiếp tục <span>→</span></button></section></section></div>{modal && <div className="warranty-modal-backdrop" role="presentation" onClick={() => setModal(false)}><section className="warranty-modal" role="dialog" aria-modal="true" aria-labelledby="warranty-modal-title" onClick={event => event.stopPropagation()}><header><div><h2 id="warranty-modal-title">Bảo hành 1 đổi 1</h2><p>Trong 3 ngày kể từ khi nhận hàng.</p></div><button onClick={() => setModal(false)} aria-label="Đóng">×</button></header><nav>{[['conditions', 'Điều kiện'], ['excluded', 'Không áp dụng'], ['process', 'Quy trình']].map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key as typeof tab)}>{label}</button>)}</nav><div className="warranty-modal-list">{items.map((item, index) => <article key={item}><b>{String(index + 1).padStart(2, '0')}</b><p>{item}</p></article>)}{tab === 'excluded' && <div className="warranty-note">Việc loại trừ bảo hành dựa trên nguyên nhân hư hỏng thực tế. Không tự động từ chối chỉ vì sản phẩm đã qua sử dụng hoặc không còn bao bì nếu lỗi thuộc trách nhiệm của cửa hàng.</div>}<p className="warranty-legal">Chính sách này không hạn chế quyền lợi theo pháp luật.</p></div><button className="warranty-confirm" onClick={() => setModal(false)}>Đã hiểu</button></section></div>}</main>
}

interface TrackingData { orderCode: string; status: string; subtotalVnd: number; shippingFeeVnd: number; totalVnd: number; createdAt: string; updatedAt: string; items: Array<{ name: string; color: string; size: string; unitPriceVnd: number; quantity: number; availabilityNote?: string }>; history: Array<{ toStatus: string; note: string | null; createdAt: string }> }
export function Tracking({ token, orderCode }: { token: string; orderCode: string }) {
  const [data, setData] = useState<TrackingData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  async function refresh() { if (!token && !orderCode) return; setLoading(true); setError(''); try { const path = orderCode ? '/api/orders/track/code/' + encodeURIComponent(orderCode) : '/api/orders/track/' + encodeURIComponent(token); const response = await fetch(path); const result = await response.json(); if (!response.ok) throw new Error(result.message || 'Không tìm thấy đơn hàng.'); setData(result.data) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể tải trạng thái đơn hàng.') } finally { setLoading(false) } }
  useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(), 30000); return () => window.clearInterval(timer) }, [token, orderCode])
  if (!token && !orderCode) return <main className="tracking-page"><section className="tracking-card"><h1>Chưa có mã đơn</h1><p>Nhập mã đơn hàng SAMU-… để tra cứu.</p></section></main>
  return <main className="tracking-page"><section className="tracking-card"><header><div><h1>Đơn hàng #{data?.orderCode ?? orderCode}</h1><p>{data ? 'Đặt ngày: ' + new Date(data.createdAt).toLocaleString('vi-VN') : 'Thông tin trạng thái từ SAMUCHAN'}</p></div><div className="tracking-status"><b>{data ? ORDER_STATUS_LABELS[data.status] ?? data.status : 'ĐANG TẢI'}</b><button className="admin-refresh" onClick={() => void refresh()} disabled={loading}>{loading ? 'Đang tải…' : 'Cập nhật'}</button></div></header>{error && <p className="admin-error">{error}</p>}{data && <><ol className="timeline">{data.history.map((event, index) => <li className={index === data.history.length - 1 ? 'current' : 'done'} key={event.createdAt + event.toStatus}><i>{index < data.history.length - 1 ? '✓' : ''}</i><div><b>{ORDER_STATUS_LABELS[event.toStatus] ?? event.toStatus}</b>{event.note && <small>{event.note}</small>}</div><time>{new Date(event.createdAt).toLocaleString('vi-VN')}</time></li>)}</ol><div className="tracked-product"><h2>Sản phẩm đã đặt</h2>{data.items.map((item, index) => <p key={index}><span><b>{item.quantity}x</b> {item.name} ({item.color}, {item.size}){item.availabilityNote && <small className="preorder-note">{item.availabilityNote}</small>}</span><span>{new Intl.NumberFormat('vi-VN').format(item.unitPriceVnd * item.quantity)}đ</span></p>)}<p><span>Tạm tính</span><span>{new Intl.NumberFormat('vi-VN').format(data.subtotalVnd)}đ</span></p><p><span>Phí vận chuyển</span><span>{data.shippingFeeVnd === 0 ? 'Miễn phí' : new Intl.NumberFormat('vi-VN').format(data.shippingFeeVnd) + 'đ'}</span></p><p className="grand-total"><b>Tổng cộng</b><b>{new Intl.NumberFormat('vi-VN').format(data.totalVnd)}đ</b></p></div></>}</section></main>
}
