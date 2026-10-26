# SAMUCHAN Gift & Custom 3D

MVP bán quà tặng/sản phẩm custom in 3D. Xem [AI handoff](docs/AI_HANDOFF.md) trước mọi thay đổi.

## Trạng thái

Đã có storefront React + TypeScript, Worker API local, D1 catalog/orders và workspace admin tại `/admin`. Checkout gửi đơn đến Worker khi hai tiến trình local đang chạy. Ảnh/video sản phẩm hiện nhập bằng URL; upload file trực tiếp vào R2 chưa có.

## Chạy local

Mở hai terminal tại thư mục dự án.

Terminal 1 — khởi tạo D1 local và chạy Worker:

```powershell
npm run worker:d1:migrate
npm run worker:d1:seed
npm run worker:dev
```

Terminal 2 — chạy storefront:

```powershell
npm run dev
```

Mở `http://localhost:5173`; admin tại `http://localhost:5173/admin`. Cấu hình admin local theo `docs/PHASE_5_ADMIN.md`.

## Cấu trúc

- `src/`: storefront, checkout và admin React.
- `worker/`: Cloudflare Worker API, migrations và D1 seed.
- `public/brand/`: tài sản thương hiệu có thể phục vụ trực tiếp.
- `legacy/`: prototype nguyên gốc, chỉ dùng đối chiếu khi migrate.
- `docs/`: tài liệu vận hành và quyết định kỹ thuật.

## Deploy production

Worker được cấu hình để deploy cả API và frontend build trong một domain. `npm run deploy` sẽ build Vite rồi chạy `wrangler deploy`; D1 migrations production chạy riêng bằng `npm run worker:d1:migrate:remote`. Không chạy seed production nếu chưa muốn tạo dữ liệu mẫu.

Trước lần deploy đầu tiên:

1. Tạo D1 database `samuchan-catalog` và R2 bucket `samuchan-media` trong tài khoản Cloudflare, sau đó điền `database_id` production vào `wrangler.jsonc`.
2. Thiết lập secret production: `wrangler secret put ADMIN_EMAIL` và `wrangler secret put ADMIN_PASSWORD_HASH`.
3. Chạy `npm run deploy`, rồi `npm run worker:d1:migrate:remote`.
4. Kiểm tra `/api/health`, `/api/catalog/products`, đăng nhập `/admin`, tạo đơn thử và tracking.

Upload media trong admin gửi file qua Worker vào R2; D1 chỉ lưu URL/object key. Giới hạn hiện tại là tối đa 12 file mỗi lần và 25MB mỗi file, chỉ nhận image/video.

Backup thủ công trước khi thay đổi dữ liệu production:

```powershell
npx wrangler d1 export samuchan-catalog --remote --output=backups/samuchan-catalog.sql --config wrangler.jsonc
```

Thư mục `backups/` đã được gitignore để không commit dữ liệu khách hàng.
