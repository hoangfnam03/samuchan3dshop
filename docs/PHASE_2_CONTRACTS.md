# Phase 2 — Data contracts và Worker foundation

## Mục tiêu

Đặt ranh giới ổn định giữa frontend và domain tương lai, đồng thời xác nhận Worker chạy độc lập ở local. Phase này chưa kết nối database, chưa phục vụ catalog/order thật và chưa deploy.

## Contracts đã chốt

Các type nằm ở worker/contracts.ts:

- ProductRecord: sản phẩm và trạng thái publish.
- ProductVariantRecord: SKU, màu, size, giá override và tồn kho.
- OrderRecord: thông tin khách, tiền, trạng thái; trackingTokenHash là dữ liệu nội bộ, không trả public.
- OrderItemRecord: snapshot product/variant/màu/size/giá tại thời điểm đặt để tránh in nhầm sau khi catalog đổi.
- OrderStatusHistoryRecord: audit trail chuyển trạng thái.
- PrintJobRecord: trạng thái sản xuất gắn với order item.
- AdminRecord: admin nội bộ; authentication chưa triển khai.
- Env: khai báo binding D1/R2 dạng optional để foundation compile trước khi resources tồn tại.

## Quy ước domain

- ID nội bộ là opaque string; không suy ra public identifier tuần tự.
- Tiền dùng số nguyên VND, không dùng float hoặc decimal tiền tệ.
- Thời gian dùng ISO 8601 string ở boundary.
- Product/variant có lifecycle draft → active → archived.
- Order item bắt buộc lưu snapshot.
- Public tracking sau này nhận token/link; chỉ hash token trong storage.
- Worker là nơi kiểm tra giá, stock, total và chuyển trạng thái; browser không được tin là nguồn sự thật.

## Worker foundation

worker/index.ts hiện chỉ có:

- GET /api/health trả trạng thái foundation.
- OPTIONS để kiểm tra CORS trong local tooling.
- JSON 404 cho endpoint chưa thuộc Phase 2.

Không mở rộng health endpoint thành catalog/order endpoint trong Phase 2. Cấu hình local nằm tại wrangler.jsonc; chưa có d1_databases, r2_buckets, secret hoặc production route.

## Local verification

~~~powershell
npm run worker:typecheck
npm run worker:dev
~~~

Trong terminal khác:

~~~powershell
Invoke-RestMethod http://localhost:8787/api/health
~~~

Expected:

~~~json
{
  "service": "samuchan-api",
  "status": "ok",
  "phase": "foundation"
}
~~~

## Phase 3 handoff

Phase tiếp theo mới được:

1. Chốt schema SQL và migration version đầu tiên.
2. Tạo D1 database/binding local.
3. Tạo R2 binding khi catalog cần media.
4. Implement read-only catalog API trước khi thay mock frontend.

Không commit ID database, token, secret hoặc dữ liệu khách hàng.

