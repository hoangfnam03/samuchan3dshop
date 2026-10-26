# Phase 3 — D1 catalog và R2 media foundation

## Đã triển khai

- Versioned D1 schema tại worker/migrations/0001_initial.sql.
- Local seed tối thiểu tại worker/migrations/0001_seed.sql.
- Wrangler D1 binding tên DB và R2 binding tên MEDIA.
- Read-only catalog endpoint: GET /api/catalog/products.
- Media object endpoint: GET /media/:key.
- D1/R2 không được truy cập trực tiếp từ frontend; Worker là boundary.

Đã xác thực local: migration/seed chạy thành công, Worker nhận binding D1/R2 và `GET /api/catalog/products` trả dữ liệu seeded với HTTP 200.

## Chạy local

1. Áp dụng migration và seed:

~~~powershell
npm run worker:d1:migrate
npm run worker:d1:seed
~~~

2. Chạy Worker:

~~~powershell
npm run worker:dev
~~~

3. Kiểm tra catalog:

~~~powershell
Invoke-RestMethod http://localhost:8787/api/catalog/products
~~~

Nếu chưa chạy migration, endpoint trả lỗi D1 thay vì tự tạo schema. Đây là chủ ý để migration luôn versioned.

## Schema boundary

Product và ProductVariant là read model cho catalog. Các bảng order/admin/print job được tạo trong migration để giữ domain invariant, nhưng chưa có endpoint thực hiện ghi.

Ảnh catalog dùng image_key trong D1 và URL Worker /media/:key. R2 object phải được upload sau khi bucket local/remote được cấu hình; seed không giả vờ rằng ảnh đã tồn tại.

## Guardrails

- Chỉ trả product/variant có status active.
- Không trả tracking token, customer data hoặc internal password hash.
- Giá là integer VND; API chưa nhận giá từ browser.
- Không upload public tự do qua API; media route chỉ đọc key đã biết.
- Không thay mock frontend trong Phase 3 cho tới khi API local được kiểm tra ổn định.
