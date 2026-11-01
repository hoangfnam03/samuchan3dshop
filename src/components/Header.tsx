import type { View } from '../types'

interface HeaderProps {
  cartCount: number
  setView: (view: View) => void
  showFilamentShop?: boolean
  onShop?: () => void
}

export function Header({ cartCount, setView, showFilamentShop = false, onShop }: HeaderProps) {
  return (
    <header className="site-header">
      <div className="shell nav-inner">
        <button className="brand-button" onClick={() => setView('home')} aria-label="Về trang chủ SAMUCHAN">
          <img className="brand-logo brand-logo-header" src="/brand/logo_samuchan.jpg" alt="SAMUCHAN Gift & Custom" />
        </button>
        <nav className="desktop-nav" aria-label="Điều hướng chính">
          <button onClick={() => setView('home')}>Trang chủ</button>
          <button onClick={() => onShop ? onShop() : setView('shop')}>Sản phẩm</button>
          {showFilamentShop && <button onClick={() => setView('filament-shop')}>Nhựa in</button>}
          <button onClick={() => setView('tracking-login')}>Tra cứu đơn</button>
          <button onClick={() => setView('warranty')}>Trung tâm bảo hành</button>
        </nav>
        <button className="cart-button" onClick={() => setView('cart')} aria-label={`Giỏ hàng, ${cartCount} sản phẩm`}>
          <svg className="cart-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M3 4h2l2.2 10.1a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H6" />
            <circle cx="10" cy="20" r="1.25" />
            <circle cx="18" cy="20" r="1.25" />
          </svg>
          {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
        </button>
      </div>
    </header>
  )
}
