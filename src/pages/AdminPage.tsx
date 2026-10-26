import { FormEvent, useEffect, useState } from 'react'

interface Dashboard {
  totalOrders: number
  activeOrders: number
  completedOrders: number
  completedRevenueVnd: number
}
interface AdminProduct {
  id: string
  name: string
  status: string
  basePriceVnd: number
  variants: Array<{ id: string; sku: string; color: string; size: string; stockQuantity: number; status: string }>
}
interface AdminOrder {
  id: string
  order_code: string
  customer_name: string
  customer_phone: string
  status: string
  total_vnd: number
  created_at: string
}
interface PrintJob {
  id: string
  order_code: string
  product_name_snapshot: string
  color_snapshot: string
  size_snapshot: string
  quantity: number
  status: string
}

const money = (value: number) => new Intl.NumberFormat('vi-VN').format(value) + 'đ'
const orderStatuses = ['received', 'confirmed', 'preparing', 'printing', 'quality_check', 'packing', 'shipping', 'completed', 'cancelled']
const printStatuses = ['waiting', 'printing', 'quality_check', 'completed', 'failed', 'reprint']

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, credentials: 'include', headers: { 'content-type': 'application/json', ...init?.headers } })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.message || payload.error || 'Request thất bại')
  return payload
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [email, setEmail] = useState('admin@example.com')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [jobs, setJobs] = useState<PrintJob[]>([])
  const [loading, setLoading] = useState(true)

  async function loadAdminData() {
    const [dash, productData, orderData, jobData] = await Promise.all([
      api<{ data: Dashboard }>('/api/admin/dashboard'),
      api<{ data: AdminProduct[] }>('/api/admin/products'),
      api<{ data: AdminOrder[] }>('/api/admin/orders'),
      api<{ data: PrintJob[] }>('/api/admin/print-jobs'),
    ])
    setDashboard(dash.data)
    setProducts(productData.data)
    setOrders(orderData.data)
    setJobs(jobData.data)
  }

  useEffect(() => {
    api('/api/admin/me').then(() => {
      setAuthenticated(true)
      return loadAdminData()
    }).catch(() => undefined).finally(() => setLoading(false))
  }, [])

  async function login(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ email, password }) })
      setAuthenticated(true)
      await loadAdminData()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Đăng nhập thất bại')
    }
  }

  async function updateOrder(id: string, status: string) {
    try {
      await api('/api/admin/orders/' + encodeURIComponent(id) + '/status', { method: 'PATCH', body: JSON.stringify({ status }) })
      await loadAdminData()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể cập nhật đơn') }
  }

  async function updateJob(id: string, status: string) {
    try {
      await api('/api/admin/print-jobs/' + encodeURIComponent(id) + '/status', { method: 'PATCH', body: JSON.stringify({ status }) })
      await loadAdminData()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể cập nhật print job') }
  }

  async function logout() {
    await api('/api/admin/logout', { method: 'POST' }).catch(() => undefined)
    setAuthenticated(false)
  }

  if (loading) return <main className="admin-shell"><p>Đang kiểm tra phiên admin…</p></main>
  if (!authenticated) return <main className="admin-login"><form onSubmit={login}><p className="admin-kicker">SAMUCHAN / ADMIN</p><h1>Đăng nhập quản trị</h1><p>Trang này chỉ dành cho tài khoản nội bộ.</p><label>Email<input type="text" value={email} onChange={event => setEmail(event.target.value)} required /></label><label>Mật khẩu<input type="password" value={password} onChange={event => setPassword(event.target.value)} required /></label>{error && <p className="admin-error">{error}</p>}<button className="button button-dark" type="submit">Đăng nhập</button><a href="/">← Về cửa hàng</a></form></main>

  return <main className="admin-shell"><header className="admin-header"><div><p className="admin-kicker">SAMUCHAN / ADMIN</p><h1>Quản trị cửa hàng</h1></div><div><a href="/">Cửa hàng</a><button onClick={logout}>Đăng xuất</button></div></header>{error && <p className="admin-error">{error}</p>}<section className="admin-metrics">{dashboard && <><article><span>Tổng đơn</span><b>{dashboard.totalOrders}</b></article><article><span>Đang xử lý</span><b>{dashboard.activeOrders}</b></article><article><span>Hoàn thành</span><b>{dashboard.completedOrders}</b></article><article><span>Doanh thu hoàn thành</span><b>{money(dashboard.completedRevenueVnd)}</b></article></>}</section><section className="admin-panel"><div className="admin-panel-heading"><h2>Đơn hàng</h2><button onClick={() => loadAdminData()}>Làm mới</button></div><div className="admin-table-wrap"><table><thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Tổng</th><th>Trạng thái</th></tr></thead><tbody>{orders.map(order => <tr key={order.id}><td>{order.order_code}</td><td>{order.customer_name}<small>{order.customer_phone}</small></td><td>{money(order.total_vnd)}</td><td><select value={order.status} onChange={event => updateOrder(order.id, event.target.value)}>{orderStatuses.map(status => <option key={status}>{status}</option>)}</select></td></tr>)}</tbody></table>{!orders.length && <p className="admin-empty">Chưa có đơn hàng.</p>}</div></section><section className="admin-panel"><div className="admin-panel-heading"><h2>Sản phẩm & tồn kho</h2></div><div className="admin-table-wrap"><table><thead><tr><th>Sản phẩm</th><th>SKU</th><th>Variant</th><th>Tồn kho</th></tr></thead><tbody>{products.flatMap(product => product.variants.map(variant => <tr key={variant.id}><td>{product.name}</td><td>{variant.sku}</td><td>{variant.color} · {variant.size}</td><td>{variant.stockQuantity}</td></tr>))}</tbody></table></div></section><section className="admin-panel"><div className="admin-panel-heading"><h2>Print jobs</h2></div><div className="admin-table-wrap"><table><thead><tr><th>Đơn</th><th>Sản phẩm</th><th>Số lượng</th><th>Trạng thái</th></tr></thead><tbody>{jobs.map(job => <tr key={job.id}><td>{job.order_code}</td><td>{job.product_name_snapshot}<small>{job.color_snapshot} · {job.size_snapshot}</small></td><td>{job.quantity}</td><td><select value={job.status} onChange={event => updateJob(job.id, event.target.value)}>{printStatuses.map(status => <option key={status}>{status}</option>)}</select></td></tr>)}</tbody></table>{!jobs.length && <p className="admin-empty">Print job sẽ xuất hiện khi đơn chuyển sang preparing.</p>}</div></section></main>
}

