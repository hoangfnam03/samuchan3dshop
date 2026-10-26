# SAMUCHAN – Project Context

## 1. Project overview

SAMUCHAN – Gift & Custom là website bán các sản phẩm quà tặng/custom, chủ yếu được sản xuất bằng công nghệ in 3D.

Đây là shop mới, lượng truy cập dự kiến thấp. Mục tiêu kỹ thuật:

- Website nhẹ.
- Kiến trúc đơn giản.
- Dễ phát triển và maintain bởi một người.
- Dễ deploy.
- Ưu tiên sử dụng free tier lâu dài.
- Không xây dựng hệ thống phức tạp như Shopee.
- Không sử dụng microservices hoặc server backend truyền thống nếu không cần thiết.
- Tránh overengineering.

UI/UX đã được thiết kế trước và hiện tại đã có HTML/CSS dựng khung giao diện. Hãy ưu tiên tái sử dụng giao diện hiện tại thay vì redesign toàn bộ.

---

# 2. User flow

Khách hàng KHÔNG cần đăng ký hoặc đăng nhập.

Flow chính:

Website
→ Xem danh sách sản phẩm
→ Xem chi tiết sản phẩm
→ Chọn variant
→ Chọn màu
→ Chọn kích thước
→ Chọn số lượng
→ Thêm vào giỏ / Đặt hàng
→ Nhập thông tin khách
→ Tạo Order

Thông tin khách hàng cơ bản:

- Họ tên.
- Số điện thoại.
- Địa chỉ nếu cần giao hàng.
- Ghi chú optional.

Sau khi đặt hàng:

- Hệ thống sinh Order Code.
- Shop nhận được đơn hàng.
- Shop chủ động liên hệ khách qua Zalo/số điện thoại để xác nhận.
- Shop gửi tracking link cho khách.

Không xây customer account ở MVP.

---

# 3. Order tracking

Khách không cần login để tracking.

Có thể tracking thông qua secure tracking token/link.

Ví dụ:

/track/{trackingToken}

Trang tracking hiển thị tiến độ:

Order Received
→ Confirmed
→ Preparing
→ Printing
→ Quality Check
→ Packing
→ Shipping
→ Completed

Tracking token phải đủ khó đoán và không sử dụng sequential database ID làm public identifier.

---

# 4. Admin

Chỉ Admin cần authentication.

Admin có thể:

- Login.
- Xem Dashboard.
- Quản lý sản phẩm.
- Quản lý variants.
- Quản lý đơn hàng.
- Xem thông tin khách đặt hàng.
- Update trạng thái order.
- Quản lý quá trình sản xuất.
- Xem thống kê doanh thu cơ bản.

Dashboard có thể hiển thị:

- Tổng doanh thu.
- Đơn hàng mới.
- Đơn đang xử lý.
- Đơn đang sản xuất.
- Đơn hoàn thành.
- Doanh thu theo thời gian.

Không cần hệ thống phân quyền phức tạp trong MVP vì hiện tại chỉ có một loại user nội bộ là Admin.

---

# 5. 3D Production

Điểm đặc biệt của SAMUCHAN so với ecommerce thông thường là quá trình sản xuất bằng máy in 3D.

Order Item phải lưu chính xác variant khách đã đặt:

- Product.
- Size.
- Color.
- Quantity.
- Các option cần thiết.

Từ Order có thể tạo Production/Print Job.

Print Job cần thể hiện rõ:

- Order code.
- Product.
- Product image.
- Size.
- Color.
- Quantity.
- Production status.

Production status cơ bản:

Waiting
→ Printing
→ QualityCheck
→ Completed

Có thể có:

Failed
→ Reprint

Mục tiêu quan trọng là giảm khả năng shop in nhầm size, màu hoặc variant.

Automation với máy in 3D/Bambu printer CHƯA nằm trong MVP.

---

# 6. Technology stack

Ưu tiên serverless architecture và Cloudflare free tier.

Frontend:
- React.
- TypeScript.

Backend:
- Cloudflare Workers.
- TypeScript.

Database:
- Cloudflare D1.

Storage:
- Cloudflare R2 cho product images/files cần lưu trên cloud.

Hosting:
- Cloudflare.

Source control:
- GitHub.

Deployment target:

GitHub
→ Cloudflare
→ Website/API

Không sử dụng:

- ASP.NET Core.
- SQL Server.
- Dedicated VPS.
- Docker cho production ở giai đoạn này.
- Redis.
- RabbitMQ/Kafka.
- Kubernetes.
- Microservices.

Architecture mong muốn:

Browser
   ↓
React Frontend
   ↓
Cloudflare Worker/API
   ↓
Cloudflare D1

Product images/files
   ↓
Cloudflare R2

Backend business logic được viết bằng TypeScript trong Cloudflare Workers.

---

# 7. Suggested data model

Không cần thiết kế database quá phức tạp.

Các entity/table chính dự kiến:

Product

ProductVariant

Order

OrderItem

OrderStatusHistory

PrintJob

Admin

Có thể bổ sung Category nếu UI hiện tại cần phân loại sản phẩm.

Không tự ý thêm nhiều entity hoặc abstraction nếu chưa thực sự cần.

---

# 8. Important development principles

Khi implement:

1. Ưu tiên giải pháp đơn giản nhất có thể.
2. Không overengineering.
3. Không tạo abstraction chỉ vì "best practice".
4. Không thêm dependency nếu JavaScript/TypeScript hoặc platform đã giải quyết được.
5. Không tạo microservice.
6. Không xây customer authentication.
7. Không xây chat system.
8. Không xây marketplace/seller system.
9. Không implement printer automation trong MVP.
10. Giữ Cloudflare free-tier compatibility.
11. Tận dụng HTML/CSS/UI hiện tại.
12. Responsive cho desktop/mobile.
13. Tách UI, business logic và data access đủ rõ để maintain nhưng không tạo architecture quá phức tạp.

Nếu có nhiều cách implement một tính năng, ưu tiên theo thứ tự:

Simple
→ Maintainable
→ Free/cheap deployment
→ Performance

Không tối ưu cho lượng traffic lớn khi chưa cần.

---

# 9. Current project state

Hiện tại:

- UI design đã được tạo.
- Đã có HTML/CSS dựng khung giao diện.
- Chưa cần redesign UI.
- Bước tiếp theo là chuyển giao diện hiện tại thành application thực tế.
- Sau đó implement từng feature và kết nối Cloudflare Worker + D1 + R2.

Không generate lại toàn bộ project một lần.

Hãy triển khai theo từng bước nhỏ, kiểm tra project hiện tại trước khi sửa code.

Trước khi bắt đầu implementation:
1. Analyze cấu trúc source code hiện tại.
2. Xác định framework/dependencies đang có.
3. Xác định các HTML/CSS component/page hiện có.
4. Đề xuất migration plan ngắn gọn sang React + TypeScript nếu project hiện tại chưa sử dụng React.
5. Không thay đổi giao diện hiện tại nếu không cần thiết.
6. Sau khi phân tích xong mới bắt đầu implement.