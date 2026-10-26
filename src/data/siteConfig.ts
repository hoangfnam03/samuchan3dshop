import type { Product } from '../types'
import { products as defaultProducts } from './products'

export interface SiteConfig {
  heroTitle: string
  heroAccent: string
  heroDescription: string
  heroImage: string
  processHeading: string
  featuredHeading: string
  footerDescription: string
  footerProduct1: string
  footerProduct2: string
  footerProduct3: string
  footerZalo: string
  footerEmail: string
  footerAddress: string
  footerCopyright: string
  footerTagline: string
}

export const defaultSiteConfig: SiteConfig = {
  heroTitle: 'Đồ 3D',
  heroAccent: 'đúng gu bạn.',
  heroDescription: '',
  heroImage: '/brand/logo_samuchan.jpg',
  processHeading: 'Đơn giản từ lúc chọn đến khi nhận',
  featuredHeading: 'Sản phẩm nổi bật',
  footerDescription: 'Chuyên thiết kế, sản xuất quà tặng và đồ trang trí bằng công nghệ in 3D hiện đại. Độc bản – Tinh tế – Nhanh chóng.',
  footerProduct1: 'Quà tặng Custom',
  footerProduct2: 'Đồ trang trí',
  footerProduct3: 'Văn phòng phẩm',
  footerZalo: '0123 456 789',
  footerEmail: 'hello@samuchan.com',
  footerAddress: 'Quận 1, TP.HCM',
  footerCopyright: '© 2026 SAMUCHAN. All rights reserved.',
  footerTagline: 'Minimalist 3D Printing Studio',
}

function read<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) as T : fallback
  } catch { return fallback }
}

export function loadSiteConfig() {
  const savedValue = read<unknown>('samuchan_site_config', {})
  const saved = savedValue && typeof savedValue === 'object' && !Array.isArray(savedValue) ? savedValue as Partial<SiteConfig> : {}
  const config = { ...defaultSiteConfig, ...saved }
  const hasLegacyHero = saved.heroTitle === 'Quà tặng' && saved.heroAccent === 'từ trái tim.'

  return {
    ...config,
    ...(hasLegacyHero ? { heroTitle: defaultSiteConfig.heroTitle, heroAccent: defaultSiteConfig.heroAccent } : {}),
    ...(saved.heroDescription === 'Biến ý tưởng của bạn thành những món quà 3D độc bản. Từ tượng chibi, đồ decor đến phụ kiện cá nhân hóa.' ? { heroDescription: '' } : {}),
    ...(typeof saved.heroImage !== 'string' || !saved.heroImage.trim() ? { heroImage: defaultSiteConfig.heroImage } : {}),
  }
}

export function loadStorefrontProducts(): Product[] {
  return read('samuchan_storefront_products', defaultProducts)
}

export function saveSiteConfig(config: SiteConfig) {
  localStorage.setItem('samuchan_site_config', JSON.stringify(config))
}

export function saveStorefrontProducts(nextProducts: Product[]) {
  localStorage.setItem('samuchan_storefront_products', JSON.stringify(nextProducts))
}
