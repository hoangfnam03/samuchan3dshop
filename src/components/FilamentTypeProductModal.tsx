import { FormEvent, useState } from 'react'

export interface FilamentAdditionalCost { label: string; costVnd: number; fixedCostId?: string }
export interface FixedFilamentCostItem { id: string; label: string; costVnd: number; sortOrder: number }
export interface FilamentPurchaseCostItem { label: string; costVnd: number; isFixed: boolean; fixedCostId?: string }
export interface FilamentPurchaseLot {
  id: string
  purchaseDate: string
  spoolCount: number
  purchasePriceCny: number
  exchangeRateVndPerCny: number
  shippingCostVnd: number
  additionalCostItems: FilamentAdditionalCost[]
  costItems: FilamentPurchaseCostItem[]
  fixedCostPerSpoolVnd: number
  unitCostVnd: number
  totalCostVnd: number
}
export interface FilamentTypePrice {
  materialTypeKey: string
  materialType: string
  priceVnd: number
  purchasePriceCny: number
  exchangeRateVndPerCny: number
  shippingCostVnd: number
  additionalCostItems: FilamentAdditionalCost[]
  totalCostVnd: number
  purchaseUrl?: string | null
  discountPercent?: number
  discountEndsOn?: string | null
  purchaseLots?: FilamentPurchaseLot[]
  purchaseLotCount?: number
  totalSpoolsPurchased?: number
  hasRecordedLots?: boolean
}

export interface FilamentTypePricePayload {
  materialType: string
  priceVnd: number
  fixedCostItems: FixedFilamentCostItem[]
  purchaseUrl: string | null
  discountPercent: number
  discountEndsOn: string | null
  purchaseLot?: {
    purchaseDate: string
    spoolCount: number
    purchasePriceCny: number
    exchangeRateVndPerCny: number
    shippingCostVnd: number
    additionalCostItems: Array<{ label: string; costVnd: number }>
  }
}

const money = (value: number) => new Intl.NumberFormat('vi-VN').format(value) + 'đ'
const filamentTypeKey = (value: string) => value.normalize('NFC').trim().toLocaleLowerCase('vi-VN')
const filamentNames: Record<string, string> = { pla: 'PLA', pla_plus: 'PLA+', pla_matte: 'PLA Matte', pla_silk: 'PLA Silk' }
const filamentLabel = (value: string) => {
  const key = value.trim().toLocaleLowerCase('vi-VN').replace(/\+/g, '_plus').replace(/[\s-]+/g, '_')
  return filamentNames[key] ?? value
}

function todayInVietnam() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

export default function FilamentTypeProductModal({ materialTypes, prices, fixedFilamentCostItems, initialTypeKey, initialMode = 'profile', saving, onCancel, onSave }: {
  materialTypes: string[]
  prices: FilamentTypePrice[]
  fixedFilamentCostItems: FixedFilamentCostItem[]
  initialTypeKey: string
  initialMode?: 'profile' | 'lot'
  saving: boolean
  onCancel: () => void
  onSave: (payload: FilamentTypePricePayload) => Promise<void>
}) {
  const existing = prices.find(item => item.materialTypeKey === initialTypeKey)
  const availableTypes = existing ? materialTypes : materialTypes.filter(type => !prices.some(item => item.materialTypeKey === filamentTypeKey(type)))
  const requestedType = materialTypes.find(type => filamentTypeKey(type) === initialTypeKey)
  const latestLot = existing?.purchaseLots?.[0]
  const importDayCount = new Set((existing?.purchaseLots ?? []).map(lot => lot.purchaseDate)).size
  const initialAdditionalCosts = latestLot?.additionalCostItems ?? existing?.additionalCostItems.filter(item => !item.fixedCostId) ?? []
  const [materialType, setMaterialType] = useState(existing?.materialType ?? requestedType ?? availableTypes[0] ?? '')
  const [priceVnd, setPriceVnd] = useState(String(existing?.priceVnd ?? ''))
  const [purchaseDate, setPurchaseDate] = useState(todayInVietnam)
  const [spoolCount, setSpoolCount] = useState('1')
  const [purchasePriceCny, setPurchasePriceCny] = useState(String(latestLot?.purchasePriceCny ?? existing?.purchasePriceCny ?? ''))
  const [exchangeRate, setExchangeRate] = useState(String(latestLot?.exchangeRateVndPerCny ?? existing?.exchangeRateVndPerCny ?? ''))
  const [shippingCostVnd, setShippingCostVnd] = useState(String(latestLot?.shippingCostVnd ?? existing?.shippingCostVnd ?? ''))
  const [purchaseUrl, setPurchaseUrl] = useState(existing?.purchaseUrl ?? '')
  const [discountPercent, setDiscountPercent] = useState(String(existing?.discountPercent ?? 0))
  const [discountEndsOn, setDiscountEndsOn] = useState(existing?.discountEndsOn ?? '')
  const [fixedCosts, setFixedCosts] = useState<FixedFilamentCostItem[]>(fixedFilamentCostItems)
  const [additionalCosts, setAdditionalCosts] = useState<Array<{ label: string; costVnd: string }>>((initialAdditionalCosts.length ? initialAdditionalCosts : [{ label: '', costVnd: 0 }]).map(item => ({ label: item.label, costVnd: String(item.costVnd) })))
  const [addingLot, setAddingLot] = useState(!existing || initialMode === 'lot')
  const [error, setError] = useState('')
  const [historyOpen, setHistoryOpen] = useState(Boolean(initialMode === 'lot'))
  const purchaseVnd = Math.round((Number(purchasePriceCny) || 0) * (Number(exchangeRate) || 0))
  const extraCostVnd = additionalCosts.reduce((sum, item) => sum + (Number(item.costVnd) || 0), 0)
  const fixedCostVnd = fixedCosts.reduce((sum, item) => sum + item.costVnd, 0)
  const baseCostVnd = purchaseVnd + (Number(shippingCostVnd) || 0) + extraCostVnd
  const unitCostVnd = baseCostVnd + fixedCostVnd
  const draftLotTotalVnd = unitCostVnd * (Number(spoolCount) || 0)
  const activeMaterialTypes = existing ? materialTypes : availableTypes
  const isFirstProfile = !existing

  function updateAdditionalCost(index: number, patch: Partial<{ label: string; costVnd: string }>) {
    setAdditionalCosts(items => items.map((item, row) => row === index ? { ...item, ...patch } : item))
  }

  function updateFixedCost(index: number, patch: Partial<Pick<FixedFilamentCostItem, 'label' | 'costVnd'>>) {
    setFixedCosts(items => items.map((item, row) => row === index ? { ...item, ...patch } : item))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const sale = Number(priceVnd)
    const discount = Number(discountPercent)
    if (!materialType || !Number.isSafeInteger(sale) || sale < 0 || sale > 2_000_000_000) {
      setError('Nhập giá bán hợp lệ cho một cuộn.')
      return
    }
    if (!Number.isSafeInteger(discount) || discount < 0 || discount > 99 || discount > 0 && !/^\d{4}-\d{2}-\d{2}$/.test(discountEndsOn)) {
      setError('Phần trăm giảm phải từ 0 đến 99; nếu có giảm giá, hãy chọn ngày kết thúc.')
      return
    }
    if (purchaseUrl.trim()) {
      try { const url = new URL(purchaseUrl); if (!['http:', 'https:'].includes(url.protocol)) throw new Error() }
      catch { setError('Link mua hàng phải bắt đầu bằng http:// hoặc https://.'); return }
    }
    if (fixedCosts.some(item => !item.label.trim() || !Number.isSafeInteger(item.costVnd) || item.costVnd < 0 || item.costVnd > 2_000_000_000)) {
      setError('Mỗi khoản phí ghim cần có tên và số tiền VND hợp lệ.')
      return
    }

    let purchaseLot: FilamentTypePricePayload['purchaseLot']
    if (addingLot) {
      const count = Number(spoolCount)
      const purchase = Number(purchasePriceCny)
      const rate = Number(exchangeRate)
      const shipping = Number(shippingCostVnd)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate) || !Number.isSafeInteger(count) || count < 1 || count > 1_000_000 || !Number.isFinite(purchase) || purchase < 0 || !Number.isFinite(rate) || rate <= 0 || !Number.isSafeInteger(shipping) || shipping < 0) {
        setError('Nhập ngày mua, số cuộn, giá CNY, tỷ giá và phí vận chuyển hợp lệ.')
        return
      }
      const rows = additionalCosts.filter(item => item.label.trim() || item.costVnd.trim())
      if (rows.some(item => !item.label.trim() || !Number.isSafeInteger(Number(item.costVnd)) || Number(item.costVnd) < 0 || Number(item.costVnd) > 2_000_000_000)) {
        setError('Mỗi khoản phí riêng của lô cần có tên và số tiền VND hợp lệ.')
        return
      }
      if (!Number.isSafeInteger(unitCostVnd) || unitCostVnd < 0 || !Number.isSafeInteger(draftLotTotalVnd)) {
        setError('Tổng giá vốn của lô vượt giới hạn hợp lệ.')
        return
      }
      purchaseLot = { purchaseDate, spoolCount: count, purchasePriceCny: purchase, exchangeRateVndPerCny: rate, shippingCostVnd: shipping, additionalCostItems: rows.map(item => ({ label: item.label.trim(), costVnd: Number(item.costVnd) })) }
    } else if (isFirstProfile) {
      setError('Hãy ghi nhận lô mua đầu tiên cho loại nhựa này.')
      return
    }

    try {
      await onSave({
        materialType,
        priceVnd: sale,
        fixedCostItems: fixedCosts.map((item, sortOrder) => ({ ...item, sortOrder })),
        purchaseUrl: purchaseUrl.trim() || null,
        discountPercent: discount,
        discountEndsOn: discount ? discountEndsOn : null,
        ...(purchaseLot ? { purchaseLot } : {}),
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể lưu sản phẩm nhựa in.')
    }
  }

  return <div className="admin-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onCancel() }}>
    <section className="admin-modal filament-product-modal" role="dialog" aria-modal="true" aria-labelledby="filament-product-title">
      <div className="admin-modal-heading">
        <div><p className="admin-kicker">SẢN PHẨM / NHỰA IN 3D</p><h2 id="filament-product-title">{existing ? 'Quản lý nhựa in' : 'Thêm sản phẩm nhựa in'}</h2></div>
        <button type="button" className="admin-modal-close" onClick={onCancel} disabled={saving}>×</button>
      </div>
      <form className="filament-product-form" onSubmit={event => void submit(event)}>
        <label>Phân loại nhựa
          <select value={materialType} onChange={event => setMaterialType(event.target.value)} disabled={Boolean(existing) || initialTypeKey !== '__new__' || !activeMaterialTypes.length} required>
            <option value="">Chọn loại nhựa</option>{activeMaterialTypes.map(type => <option key={type} value={type}>{filamentLabel(type)}</option>)}
          </select>
          <small>Tất cả màu thuộc loại này sẽ được bán thành từng mặt hàng màu riêng.</small>
        </label>

        {existing && !existing.hasRecordedLots && <p className="filament-legacy-note">Thông số giá vốn cũ sẽ được điền sẵn khi tạo đợt nhập đầu tiên. Hồ sơ cũ chưa có số cuộn, nên hãy nhập số thực tế trong đợt để tính bình quân chính xác.</p>}
        {existing && existing.hasRecordedLots && <p className="filament-history-summary">Đã ghi nhận {importDayCount} ngày nhập, tổng {existing.totalSpoolsPurchased} cuộn. Giá vốn hiện tại là bình quân gia quyền của các lô này: <b>{money(existing.totalCostVnd)}/cuộn</b>.</p>}

        <fieldset className="filament-sales-settings">
          <legend>Giá bán và khuyến mãi</legend>
          <div className="filament-cost-form-grid">
            <label>Giá bán (VND / cuộn 1kg)<input type="number" min="0" step="1" value={priceVnd} onChange={event => setPriceVnd(event.target.value)} required /></label>
            <label>Giảm giá (%)<input type="number" min="0" max="99" step="1" value={discountPercent} onChange={event => setDiscountPercent(event.target.value)} /></label>
            <label>Giảm giá tới ngày<input type="date" value={discountEndsOn} onChange={event => setDiscountEndsOn(event.target.value)} disabled={Number(discountPercent) === 0} required={Number(discountPercent) > 0} /><small>Giá giảm có hiệu lực hết ngày đã chọn.</small></label>
            <label>Link mua hàng<input type="url" value={purchaseUrl} onChange={event => setPurchaseUrl(event.target.value)} placeholder="https://..." /><small>Chỉ hiển thị trong trang quản trị.</small></label>
          </div>
        </fieldset>

        <section className="filament-fixed-costs">
          <header><div><b>Chi phí ghim cho nhựa in</b><small>Các khoản này được áp dụng cho mọi loại nhựa và được chụp lại vào mỗi lô.</small></div>
            <button type="button" className="button button-light" onClick={() => setFixedCosts(items => [...items, { id: crypto.randomUUID(), label: '', costVnd: 0, sortOrder: items.length }])} disabled={saving || fixedCosts.length >= 30}>＋ Thêm phí ghim</button>
          </header>
          {fixedCosts.length ? fixedCosts.map((item, index) => <div className="filament-extra-cost-row" key={item.id}>
            <label>Tên khoản phí<input value={item.label} onChange={event => updateFixedCost(index, { label: event.target.value })} placeholder="Ví dụ: Phí vận chuyển nội địa" /></label>
            <label>Chi phí (VND/cuộn)<input type="number" min="0" step="1" value={item.costVnd} onChange={event => updateFixedCost(index, { costVnd: Number(event.target.value) || 0 })} /></label>
            <span className="filament-fixed-badge" aria-label="Đang ghim">📌 Ghim</span>
            <button type="button" className="button button-light" onClick={() => setFixedCosts(items => items.filter((_, row) => row !== index))} disabled={saving}>Xóa</button>
          </div>) : <p className="filament-empty-hint">Chưa có khoản phí ghim.</p>}
        </section>

        <section className="filament-lot-manager">
          <header><div><b>Lịch sử nhập theo ngày</b><small>Đợt mới nhập chung nhiều loại nhựa ở bảng tổng hợp. Các đợt cũ được giữ nguyên.</small></div>
            {!existing && !addingLot && <button type="button" className="button button-dark" onClick={() => { setError(''); setAddingLot(true); setHistoryOpen(true) }} disabled={saving}>＋ Thêm lô mua</button>}
          </header>
          {addingLot && <div className="filament-lot-entry">
            <div className="filament-lot-entry-heading"><div><h3>{existing ? 'Ghi nhận lô mua mới' : 'Lô mua đầu tiên'}</h3><p>Các trường giá mua, tỷ giá và phí được điền theo lô gần nhất để bạn chỉnh lại.</p></div>{existing && <button type="button" className="text-button" onClick={() => { setAddingLot(false); setError('') }} disabled={saving}>Hủy thêm lô</button>}</div>
            <div className="filament-cost-form-grid">
              <label>Ngày mua<input type="date" value={purchaseDate} onChange={event => setPurchaseDate(event.target.value)} required /></label>
              <label>Số cuộn<input type="number" min="1" step="1" value={spoolCount} onChange={event => setSpoolCount(event.target.value)} required /></label>
              <label>Giá mua (CNY / cuộn 1kg)<input type="number" min="0" step="0.01" value={purchasePriceCny} onChange={event => setPurchasePriceCny(event.target.value)} required /></label>
              <label>Tỷ giá lúc mua (VND / CNY)<input type="number" min="1" step="1" value={exchangeRate} onChange={event => setExchangeRate(event.target.value)} required /></label>
              <label>Phí vận chuyển (VND / cuộn)<input type="number" min="0" step="1" value={shippingCostVnd} onChange={event => setShippingCostVnd(event.target.value)} required /></label>
            </div>
            <section className="filament-extra-costs filament-lot-extra-costs">
              <header><div><b>Phí riêng của lô (VND / cuộn)</b><small>Chi phí ghim ở trên sẽ tự cộng vào lô và được lưu theo giá trị hiện tại.</small></div><button type="button" className="button button-light" onClick={() => setAdditionalCosts(items => [...items, { label: '', costVnd: '' }])} disabled={saving || additionalCosts.length >= 20}>＋ Thêm khoản phí</button></header>
              {additionalCosts.map((item, index) => <div className="filament-extra-cost-row" key={index}>
                <label>Tên khoản phí<input value={item.label} onChange={event => updateAdditionalCost(index, { label: event.target.value })} placeholder="Ví dụ: Thuế nhập hàng" /></label>
                <label>Chi phí (VND/cuộn)<input type="number" min="0" step="1" value={item.costVnd} onChange={event => updateAdditionalCost(index, { costVnd: event.target.value })} placeholder="0" /></label>
                <span />
                <button type="button" className="button button-light" onClick={() => setAdditionalCosts(items => items.filter((_, row) => row !== index))} disabled={saving}>Xóa</button>
              </div>)}
            </section>
            <div className="filament-cost-summary">
              <span>Giá CNY quy đổi/cuộn<b>{money(purchaseVnd)}</b></span>
              <span>Giá vốn/cuộn của lô<b>{money(unitCostVnd)}</b></span>
              <span>Tổng giá vốn {Number(spoolCount) || 0} cuộn<b>{money(draftLotTotalVnd)}</b></span>
            </div>
          </div>}

          {existing?.purchaseLots?.length ? <div className="filament-lot-history-wrap">
            <button className="text-button filament-history-toggle" type="button" onClick={() => setHistoryOpen(open => !open)} aria-expanded={historyOpen}>{historyOpen ? 'Thu gọn lịch sử' : `Xem ${importDayCount} ngày nhập · ${existing.totalSpoolsPurchased} cuộn`}</button>
            {historyOpen && <div className="filament-lot-table-scroll"><table className="filament-lot-table"><thead><tr><th>Ngày mua</th><th>Số cuộn</th><th>Giá CNY/cuộn</th><th>Tỷ giá</th><th>Phí/cuộn</th><th>Giá vốn/cuộn</th><th>Tổng lô</th></tr></thead><tbody>{existing.purchaseLots.map(lot => {
              const feeItems = lot.costItems ?? []
              const otherFees = feeItems.reduce((sum, item) => sum + item.costVnd, 0) + lot.shippingCostVnd
              return <tr key={lot.id}><td>{new Date(`${lot.purchaseDate}T00:00:00`).toLocaleDateString('vi-VN')}</td><td>{lot.spoolCount}</td><td>{lot.purchasePriceCny.toLocaleString('vi-VN')} CNY</td><td>{money(lot.exchangeRateVndPerCny)}</td><td><details><summary>{money(otherFees)}</summary><ul><li>Vận chuyển: {money(lot.shippingCostVnd)}</li>{feeItems.map((item, index) => <li key={index}>{item.label}{item.isFixed ? ' · phí ghim' : ''}: {money(item.costVnd)}</li>)}</ul></details></td><td><b>{money(lot.unitCostVnd)}</b></td><td>{money(lot.totalCostVnd)}</td></tr>
            })}</tbody></table></div>}
          </div> : existing && <p className="filament-empty-hint">Chưa có lịch sử lô. Giá vốn cũ vẫn dùng cho đơn hàng đến khi bạn ghi nhận lô đầu tiên.</p>}
        </section>

        {error && <p className="admin-error span-two">{error}</p>}
        {!existing && !availableTypes.length && <p className="admin-empty span-two">Tất cả loại nhựa đã có hồ sơ. Hãy chỉnh sửa hồ sơ hiện có hoặc thêm loại nhựa trong master data.</p>}
        <div className="admin-product-actions"><button className="button button-light" type="button" onClick={onCancel} disabled={saving}>Hủy</button><button className="button button-dark" type="submit" disabled={saving || !activeMaterialTypes.length}>{saving ? 'Đang lưu…' : addingLot ? existing ? 'Lưu lô mua và giá bán' : 'Tạo sản phẩm và lô đầu tiên' : 'Lưu thông tin bán'}</button></div>
      </form>
    </section>
  </div>
}
