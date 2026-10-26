import { loadSiteConfig } from '../data/siteConfig'
import type { SiteConfig } from '../data/siteConfig'

interface FooterProps {
  siteConfig?: SiteConfig
  onEditField?: (field: keyof SiteConfig) => void
}

export function Footer({ siteConfig = loadSiteConfig(), onEditField }: FooterProps = {}) {
  const edit = (field: keyof SiteConfig) => onEditField && <button className="inline-edit label-edit" type="button" onClick={() => onEditField(field)} aria-label="Chỉnh nội dung">✎</button>
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div className="footer-brand">
          <img className="brand-logo brand-logo-footer" src="/brand/logo_samuchan.jpg" alt="SAMUCHAN Gift & Custom" />
          <p>{siteConfig.footerDescription}{edit('footerDescription')}</p>
        </div>
        <div>
          <h2>Sản phẩm</h2>
          <ul><li>{siteConfig.footerProduct1}{edit('footerProduct1')}</li><li>{siteConfig.footerProduct2}{edit('footerProduct2')}</li><li>{siteConfig.footerProduct3}{edit('footerProduct3')}</li></ul>
        </div>
        <div>
          <h2>Liên hệ</h2>
          <ul><li>Zalo: {siteConfig.footerZalo}{edit('footerZalo')}</li><li>Email: {siteConfig.footerEmail}{edit('footerEmail')}</li><li>{siteConfig.footerAddress}{edit('footerAddress')}</li></ul>
        </div>
      </div>
      <div className="shell footer-bottom">{siteConfig.footerCopyright}{edit('footerCopyright')}<span>{siteConfig.footerTagline}{edit('footerTagline')}</span></div>
    </footer>
  )
}
