# Phase 4 — Order creation và secure tracking

## Đã triển khai

- POST /api/orders với validation payload và giới hạn kích thước.
- Server tự lấy giá, product, variant và trạng thái sẵn có của màu từ D1; không quản lý số lượng tồn kho.
- Không tin giá hoặc tổng tiền từ browser; trạng thái màu luôn xác thực từ D1.
- Gộp duplicate variant trong cùng request.
- Tạo order code bằng random bytes, không dùng sequential ID.
- Tạo tracking token 32 bytes CSPRNG và chỉ lưu SHA-256 hash.
- Ghi orders, order_items và order_status_history trong một D1 batch.
- GET /api/orders/track/:token và GET /api/orders/track/code/:orderCode chỉ trả dữ liệu tracking cần thiết, không trả tên khách, số điện thoại, địa chỉ, token hash hoặc secret.
- Từ chối variant inactive/không tồn tại. Variant màu “Chưa có sẵn” vẫn đặt được và hiển thị ghi chú chờ 7 ngày; không kiểm tra, trừ hoặc cộng tồn kho.
- Màu custom dùng ID màu master thuộc một trong các loại nhựa được chọn cho preview sản phẩm, kể cả màu “Chưa có sẵn”; Worker lấy tên và trạng thái từ D1, dùng variant cùng kích thước để tính giá và lưu ghi chú chờ 7 ngày vào snapshot đơn khi cần. Variant màu có sẵn không bị giới hạn theo loại nhựa preview.

## Create order

Request mẫu:

~~~json
{
  "customerName": "Nguyễn Văn A",
  "customerPhone": "0901234567",
  "shippingAddress": "Quận 1, TP.HCM",
  "note": "Gói quà giúp mình",
  "items": [
    {
      "variantId": "var_chibi_white_5",
      "quantity": 2,
      "option": { "giftWrap": true }
    }
  ]
}
~~~

Response 201 trả orderCode ngẫu nhiên dạng `SAMU-` + 10 ký tự hex, trackingToken một lần, trackingUrl và totals server-calculated. Storefront có thể mở route `/tracking/:orderCode`; token vẫn được hỗ trợ cho các link cũ.

## Tracking

Tra cứu nhận order code ngẫu nhiên hoặc token hex 64 ký tự. Worker vẫn hash token trước khi lookup. Mã đơn không phải database ID tuần tự.

Tracking response chỉ gồm trạng thái, lịch sử và thông tin sản phẩm/giá trị đơn cần thiết; không trả thông tin khách hàng. Mỗi sản phẩm kèm trạng thái print job nếu đã tạo.

Tracking response gồm:

- orderCode/status/timestamps/totals;
- item snapshots và trạng thái sản xuất cần để khách nhận diện/theo dõi đơn;
- status history.

## Chưa triển khai

- Thanh toán và thông báo/Zalo.
- Rate limiting/abuse protection và retention policy production.

## Kiểm tra local

~~~powershell
npm run worker:d1:migrate
npm run worker:dev
~~~

Trước khi bỏ quản lý tồn kho, đã kiểm tra local: create order 201, tracking 200, out-of-stock 409 và token sai 404; kiểm tra đó không còn áp dụng cho tồn kho hiện tại.
