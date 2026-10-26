# Cloudflare Worker

Worker local phục vụ catalog, đặt hàng, tracking và workspace admin.

## Chạy local

~~~powershell
npm run worker:d1:migrate
npm run worker:d1:seed
npm run worker:dev
~~~

FE chạy ở terminal khác bằng `npm run dev`. Vite proxy `/api` và `/media` sang Worker tại `http://127.0.0.1:8787`.

- Health: `GET /api/health`
- Catalog: `GET /api/catalog/products`
- Đặt đơn ghi vào D1 local: `POST /api/orders`
- Admin catalog: `GET/POST /api/admin/products`, `PATCH /api/admin/products/:id`, `POST /api/admin/products/:id/variants`, `PATCH /api/admin/variants/:id`
- Admin orders: `GET /api/admin/orders`
- Tracking by order code: `GET /api/orders/track/code/:orderCode`
- Tracking by legacy private token: `GET /api/orders/track/:token`

Admin cho phép nhập URL hoặc chọn ảnh/video để Worker upload vào R2. Cấu hình admin local nằm trong `docs/PHASE_5_ADMIN.md`.

D1 schema và migration nằm trong `worker/migrations`; migration `0003_product_media.sql` thêm URL ảnh/video. Seed chỉ thêm dữ liệu mẫu.
