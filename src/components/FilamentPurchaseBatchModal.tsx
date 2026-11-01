import { FormEvent, useState } from 'react'
import type { FilamentPurchaseLot, FilamentTypePrice } from './FilamentTypeProductModal'

export interface FilamentPurchaseBatchEntry {
  materialType: string
  spoolCount: number
  purchasePriceCny: number
  exchangeRateVndPerCny: number
  shippingCostVnd: number
  additionalCostItems: Array<{ label: string; costVnd: number }>
}

export interface FilamentPurchaseBatchPayload {
  purchaseDate: string
  entries: FilamentPurchaseBatchEntry[]
}

export interface FilamentPurchaseBaseline {
  id: string
  materialTypeKey: string
  materialType: string
  purchaseDate: string
  purchasePriceCny: number
  exchangeRateVndPerCny: number
  shippingCostVnd: number
  additionalCostItems: Array<{ label: string; costVnd: number }>
  fixedCostItems: Array<{ label: string; costVnd: number }>
  unitCostVnd: number
  priceVnd: number
  purchaseUrl?: string | null
  discountPercent: number
  discountEndsOn?: string | null
}

export type FilamentPurchaseHistoryItem =
  | { materialType: string; lot: FilamentPurchaseLot; baseline?: never }
  | { materialType: string; baseline: FilamentPurchaseBaseline; lot?: never }

type BatchDraft = {
  included: boolean
  spoolCount: string
  purchasePriceCny: string
  exchangeRate: string
  shippingCostVnd: string
  additionalCosts: Array<{ label: string; costVnd: string }>
}

const money = (value: number) => new Intl.NumberFormat('vi-VN').format(value) + 'đ'
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

function newBatchDate(prices: FilamentTypePrice[], baselineDate?: string | null) {
  const today = todayInVietnam()
  const latestDate = [...prices.flatMap(price => price.purchaseLots ?? []).map(lot => lot.purchaseDate), ...(baselineDate ? [baselineDate] : [])].sort().at(-1)
  if (!latestDate || latestDate < today) return today
  const nextDate = new Date(`${latestDate}T00:00:00Z`)
  nextDate.setUTCDate(nextDate.getUTCDate() + 1)
  return nextDate.toISOString().slice(0, 10)
}

function initialBatchDrafts(prices: FilamentTypePrice[]) {
  const latestBatchDate = prices.flatMap(price => price.purchaseLots ?? []).map(lot => lot.purchaseDate).sort().at(-1)
  return Object.fromEntries(prices.map(price => {
    const latestLot = price.purchaseLots?.[0]
    const extraCosts = latestLot?.additionalCostItems ?? price.additionalCostItems.filter(item => !item.fixedCostId)
    return [price.materialTypeKey, {
      included: latestBatchDate ? latestLot?.purchaseDate === latestBatchDate : true,
      spoolCount: latestLot ? String(latestLot.spoolCount) : '',
      purchasePriceCny: String(latestLot?.purchasePriceCny ?? price.purchasePriceCny ?? ''),
      exchangeRate: String(latestLot?.exchangeRateVndPerCny ?? price.exchangeRateVndPerCny ?? ''),
      shippingCostVnd: String(latestLot?.shippingCostVnd ?? price.shippingCostVnd ?? ''),
      additionalCosts: extraCosts.map(item => ({ label: item.label, costVnd: String(item.costVnd) })),
    } satisfies BatchDraft]
  }))
}

export function formatBatchDate(value: string) {
  const [year, month, day] = value.split('-')
  return `${day}.${month}.${year}`
}

export default function FilamentPurchaseBatchModal({ prices, fixedCostItems, baselineDate, saving, onCancel, onSave }: {
  prices: FilamentTypePrice[]
  fixedCostItems: Array<{ id: string; label: string; costVnd: number; sortOrder: number }>
  baselineDate?: string | null
  saving: boolean
  onCancel: () => void
  onSave: (payload: FilamentPurchaseBatchPayload) => Promise<void>
}) {
  const [purchaseDate, setPurchaseDate] = useState(() => newBatchDate(prices, baselineDate))
  const [drafts, setDrafts] = useState(() => initialBatchDrafts(prices))
  const [error, setError] = useState('')
  const fixedCostPerSpool = fixedCostItems.reduce((sum, item) => sum + item.costVnd, 0)

  function updateDraft(key: string, patch: Partial<BatchDraft>) {
    setDrafts(current => ({ ...current, [key]: { ...current[key], ...patch } }))
  }

  function updateExtraCost(key: string, index: number, patch: Partial<{ label: string; costVnd: string }>) {
    const draft = drafts[key]
    updateDraft(key, { additionalCosts: draft.additionalCosts.map((item, row) => row === index ? { ...item, ...patch } : item) })
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const selected = prices.filter(price => drafts[price.materialTypeKey]?.included)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate) || !selected.length) {
      setError('Chọn ngày nhập và ít nhất một loại nhựa trong đợt này.')
      return
    }
    const entries: FilamentPurchaseBatchEntry[] = []
    for (const price of selected) {
      const draft = drafts[price.materialTypeKey]
      const spoolCount = Number(draft.spoolCount)
      const purchasePriceCny = Number(draft.purchasePriceCny)
      const exchangeRateVndPerCny = Number(draft.exchangeRate)
      const shippingCostVnd = Number(draft.shippingCostVnd)
      if (!Number.isSafeInteger(spoolCount) || spoolCount < 1 || spoolCount > 1_000_000 || !Number.isFinite(purchasePriceCny) || purchasePriceCny < 0 || !Number.isFinite(exchangeRateVndPerCny) || exchangeRateVndPerCny <= 0 || !Number.isSafeInteger(shippingCostVnd) || shippingCostVnd < 0) {
        setError(`Nhập đúng số cuộn, giá CNY, tỷ giá và phí vận chuyển cho ${filamentLabel(price.materialType)}.`)
        return
      }
      const extraCosts = draft.additionalCosts.filter(item => item.label.trim() || item.costVnd.trim())
      if (extraCosts.some(item => !item.label.trim() || !item.costVnd.trim() || !Number.isSafeInteger(Number(item.costVnd)) || Number(item.costVnd) < 0 || Number(item.costVnd) > 2_000_000_000)) {
        setError(`Kiểm tra tên và số tiền các khoản phí riêng của ${filamentLabel(price.materialType)}.`)
        return
      }
      const unitCost = Math.round(purchasePriceCny * exchangeRateVndPerCny) + shippingCostVnd + fixedCostPerSpool + extraCosts.reduce((sum, item) => sum + Number(item.costVnd), 0)
      if (!Number.isSafeInteger(unitCost) || unitCost > 2_000_000_000 || !Number.isSafeInteger(unitCost * spoolCount)) {
        setError(`Tổng giá vốn của ${filamentLabel(price.materialType)} vượt giới hạn hợp lệ.`)
        return
      }
      entries.push({ materialType: price.materialType, spoolCount, purchasePriceCny, exchangeRateVndPerCny, shippingCostVnd, additionalCostItems: extraCosts.map(item => ({ label: item.label.trim(), costVnd: Number(item.costVnd) })) })
    }
    try {
      await onSave({ purchaseDate, entries })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể lưu đợt nhập nhựa.')
    }
  }

  return <div className="admin-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onCancel() }}>
    <section className="admin-modal filament-batch-modal" role="dialog" aria-modal="true" aria-labelledby="filament-batch-title">
      <div className="admin-modal-heading"><div><p className="admin-kicker">SẢN PHẨM / NHỰA IN 3D</p><h2 id="filament-batch-title">Thêm đợt nhập nhựa</h2></div><button type="button" className="admin-modal-close" onClick={onCancel} disabled={saving}>×</button></div>
      <form className="filament-batch-form" onSubmit={event => void submit(event)}>
        <div className="filament-batch-intro"><label>Ngày nhập<input type="date" value={purchaseDate} onChange={event => setPurchaseDate(event.target.value)} required /></label><p>Thông số của lần nhập gần nhất được điền sẵn. Thay đổi trong đợt mới không làm sửa lịch sử cũ. Đợt đầu tiên lấy giá mua, tỷ giá và phí từ hồ sơ hiện tại; nhập số cuộn thực tế cho từng loại.</p></div>
        {fixedCostItems.length > 0 && <p className="filament-batch-fixed-note">Chi phí ghim tự cộng vào mọi cuộn: {fixedCostItems.map(item => `${item.label} ${money(item.costVnd)}`).join(' · ')}.</p>}
        <div className="filament-batch-type-list">{prices.map(price => {
          const draft = drafts[price.materialTypeKey]
          if (!draft) return null
          const purchaseVnd = Math.round((Number(draft.purchasePriceCny) || 0) * (Number(draft.exchangeRate) || 0))
          const extraCostVnd = draft.additionalCosts.reduce((sum, item) => sum + (Number(item.costVnd) || 0), 0)
          const unitCostVnd = purchaseVnd + (Number(draft.shippingCostVnd) || 0) + fixedCostPerSpool + extraCostVnd
          return <fieldset className={'filament-batch-type ' + (draft.included ? '' : 'is-excluded')} key={price.materialTypeKey}>
            <legend><label><input type="checkbox" checked={draft.included} onChange={event => updateDraft(price.materialTypeKey, { included: event.target.checked })} /><b>{filamentLabel(price.materialType)}</b></label></legend>
            {draft.included && <>
              <div className="filament-batch-fields">
                <label>Số cuộn<input type="number" min="1" step="1" value={draft.spoolCount} onChange={event => updateDraft(price.materialTypeKey, { spoolCount: event.target.value })} required /></label>
                <label>Giá mua (CNY/cuộn)<input type="number" min="0" step="0.01" value={draft.purchasePriceCny} onChange={event => updateDraft(price.materialTypeKey, { purchasePriceCny: event.target.value })} required /></label>
                <label>Tỷ giá lúc mua (VND/CNY)<input type="number" min="1" step="0.0001" value={draft.exchangeRate} onChange={event => updateDraft(price.materialTypeKey, { exchangeRate: event.target.value })} required /></label>
                <label>Vận chuyển (VND/cuộn)<input type="number" min="0" step="1" value={draft.shippingCostVnd} onChange={event => updateDraft(price.materialTypeKey, { shippingCostVnd: event.target.value })} required /></label>
              </div>
              <div className="filament-batch-fees"><b>Phí riêng/cuộn</b>{draft.additionalCosts.map((item, index) => <div className="filament-batch-fee-row" key={index}><input aria-label={`Tên phí ${index + 1} của ${price.materialType}`} value={item.label} onChange={event => updateExtraCost(price.materialTypeKey, index, { label: event.target.value })} placeholder="Tên khoản phí" /><input aria-label={`Chi phí ${index + 1} của ${price.materialType}`} type="number" min="0" step="1" value={item.costVnd} onChange={event => updateExtraCost(price.materialTypeKey, index, { costVnd: event.target.value })} placeholder="VND/cuộn" /><button type="button" className="button button-light" onClick={() => updateDraft(price.materialTypeKey, { additionalCosts: draft.additionalCosts.filter((_, row) => row !== index) })} disabled={saving}>Xóa</button></div>)}<button type="button" className="text-button" onClick={() => updateDraft(price.materialTypeKey, { additionalCosts: [...draft.additionalCosts, { label: '', costVnd: '' }] })} disabled={saving || draft.additionalCosts.length >= 20}>＋ Thêm khoản phí riêng</button></div>
              <div className="filament-batch-cost-preview">Giá CNY quy đổi: <b>{money(purchaseVnd)}</b><span>Giá vốn/cuộn dự kiến: <b>{money(unitCostVnd)}</b></span><span>Tổng giá vốn đợt: <b>{money(unitCostVnd * (Number(draft.spoolCount) || 0))}</b></span></div>
            </>}
          </fieldset>
        })}</div>
        {error && <p className="admin-error" role="alert">{error}</p>}
        <div className="admin-product-actions"><button type="button" className="button button-light" onClick={onCancel} disabled={saving}>Hủy</button><button type="submit" className="button button-dark" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu đợt nhập'}</button></div>
      </form>
    </section>
  </div>
}

export function FilamentPurchaseBatchDetails({ purchaseDate, items, onClose }: {
  purchaseDate: string
  items: FilamentPurchaseHistoryItem[]
  onClose: () => void
}) {
  return <div className="admin-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="admin-modal filament-batch-details-modal" role="dialog" aria-modal="true" aria-labelledby="filament-batch-details-title">
      <div className="admin-modal-heading"><div><p className="admin-kicker">LỊCH SỬ NHẬP NHỰA</p><h2 id="filament-batch-details-title">Đợt nhập ngày {formatBatchDate(purchaseDate)}</h2></div><button type="button" className="admin-modal-close" onClick={onClose}>×</button></div>
      <div className="filament-batch-details"><div className="filament-lot-table-scroll"><table className="filament-lot-table filament-batch-details-table"><thead><tr><th>Loại nhựa</th><th>Số cuộn</th><th>Giá CNY/cuộn</th><th>Tỷ giá</th><th>Phí/cuộn</th><th>Giá vốn/cuộn</th><th>Tổng giá vốn</th><th>Giá bán/cuộn</th><th>Khuyến mãi</th></tr></thead><tbody>{items.map(item => {
        const lot = item.lot
        const baseline = item.baseline
        const extraCosts = lot?.costItems ?? baseline?.additionalCostItems.map(cost => ({ ...cost, isFixed: false })).concat((baseline?.fixedCostItems ?? []).map(cost => ({ ...cost, isFixed: true }))) ?? []
        const shippingCostVnd = lot?.shippingCostVnd ?? baseline?.shippingCostVnd ?? 0
        const purchasePriceCny = lot?.purchasePriceCny ?? baseline?.purchasePriceCny ?? 0
        const exchangeRate = lot?.exchangeRateVndPerCny ?? baseline?.exchangeRateVndPerCny ?? 0
        const unitCostVnd = lot?.unitCostVnd ?? baseline?.unitCostVnd ?? 0
        const salePrice = baseline?.priceVnd
        const discountPercent = baseline?.discountPercent ?? 0
        const discountEndsOn = baseline?.discountEndsOn
        return <tr key={lot?.id ?? baseline?.id}><td><b>{filamentLabel(item.materialType)}</b>{baseline && <small>Thông số ban đầu</small>}{baseline?.purchaseUrl && <a href={baseline.purchaseUrl} target="_blank" rel="noreferrer">Link mua</a>}</td><td>{lot ? lot.spoolCount : 'Chưa ghi'}</td><td>{purchasePriceCny.toLocaleString('vi-VN')} CNY</td><td>{money(exchangeRate)}</td><td><details><summary>{money(shippingCostVnd + extraCosts.reduce((sum, cost) => sum + cost.costVnd, 0))}</summary><ul><li>Vận chuyển: {money(shippingCostVnd)}</li>{extraCosts.map((cost, index) => <li key={index}>{cost.label}{cost.isFixed ? ' · phí ghim' : ''}: {money(cost.costVnd)}</li>)}</ul></details></td><td><b>{money(unitCostVnd)}</b></td><td>{lot ? money(lot.totalCostVnd) : '—'}</td><td>{salePrice === undefined ? '—' : money(salePrice)}</td><td>{discountPercent ? `${discountPercent}%${discountEndsOn ? ` · tới ${discountEndsOn}` : ''}` : '—'}</td></tr>
      })}</tbody></table></div></div>
      <div className="admin-product-actions filament-batch-details-actions"><button type="button" className="button button-dark" onClick={onClose}>Đóng</button></div>
    </section>
  </div>
}
