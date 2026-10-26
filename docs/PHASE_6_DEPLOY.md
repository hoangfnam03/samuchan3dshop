# Phase 6 — Deploy và vận hành

## Mục tiêu

- Deploy Worker API và Vite `dist` trên cùng một Worker/domain.
- Dùng D1/R2 remote cho production.
- Không commit secret hoặc dữ liệu đơn hàng thật.

## Thiết lập một lần

1. Đăng nhập: `npx wrangler login`.
2. Tạo D1 và R2 trong đúng Cloudflare account.
3. Điền `database_id` production vào `wrangler.jsonc`; giữ tên binding là `DB` và `MEDIA`.
4. Tạo password hash bằng `npm run worker:admin:hash`.
5. Lưu secret production:

```powershell
npx wrangler secret put ADMIN_EMAIL --config wrangler.jsonc
npx wrangler secret put ADMIN_PASSWORD_HASH --config wrangler.jsonc
```

## Deploy

```powershell
npm run deploy
npm run worker:d1:migrate:remote
```

Chỉ chạy seed remote khi database mới và muốn có sản phẩm mẫu:

```powershell
npm run worker:d1:seed:remote
```

## Kiểm tra sau deploy

- `/` tải được storefront.
- `/api/health` trả `status: ok`.
- `/api/catalog/products` trả catalog.
- `/admin` đăng nhập được.
- Admin tạo/sửa sản phẩm và upload ảnh/video được.
- Tạo một đơn thử, kiểm tra dashboard, cập nhật trạng thái và tracking.
- Kiểm tra mobile trước khi đưa domain chính vào sử dụng.

## Backup

```powershell
npx wrangler d1 export samuchan-catalog --remote --output=backups/samuchan-catalog.sql --config wrangler.jsonc
```

Không commit file backup vì có thể chứa thông tin khách hàng.
