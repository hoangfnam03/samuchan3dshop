# Phase 5 — Admin và production workflow

## Đã triển khai

- Admin login bằng D1 admin record hoặc bootstrap credentials từ runtime secrets.
- Session token CSPRNG, chỉ lưu token hash trong D1, hết hạn sau 8 giờ.
- Dashboard metrics doanh thu/order status.
- Master data catalog: tạo/sửa sản phẩm, danh mục, trạng thái, giá; thêm/sửa variant, màu, size, SKU, giá và tồn kho. URL ảnh/video demo được lưu trong D1.
- Giá vốn sản phẩm: Admin nhập nhiều khoản cost theo từng sản phẩm; tổng được tính tự động và chỉ trả về qua endpoint đã xác thực. Đơn mới lưu snapshot giá vốn từng món để hỗ trợ thống kê lãi sau này; storefront và tracking không nhận các trường cost.
- Storefront lấy sản phẩm active từ Worker; checkout gửi variant ID để Worker tạo đơn trong D1, đơn hiển thị trong Admin.
- Danh sách đơn hỗ trợ tìm theo mã đơn/tên/số điện thoại và lọc trạng thái. Admin chuyển trạng thái theo quy trình; tracking page đọc status history và trạng thái print job từ D1, tự làm mới mỗi 30 giây.
- Cập nhật order status sẽ đồng bộ print job liên quan; cập nhật print job sang `printing`/`quality_check` sẽ tiến trạng thái order khi phù hợp (với nhiều mặt hàng, chờ tất cả print job tới QC).
- Order management: xem đơn authenticated và chuyển status theo transition hợp lệ.
- Tự tạo print jobs khi order chuyển sang preparing.
- Print job management: xem và cập nhật Waiting → Printing → Quality Check → Completed/Failed/Reprint.
- Không có customer account, không có printer automation.
- Admin frontend tại /admin, không có link/button admin trong storefront.
- Visual Editor tại /admin/visual-editor, chỉ mở sau khi phiên admin hợp lệ; nội dung trang tĩnh lưu localStorage còn tên/ảnh sản phẩm cập nhật vào D1.

## Cấu hình admin local

Sinh password hash, không commit password:

~~~powershell
npm run worker:admin:hash
~~~

Thiết lập runtime env trong file .dev.vars (file đã được gitignore):

~~~text
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD_HASH=pbkdf2-sha256$100000$...
~~~

Chạy migration và seed local rồi khởi động Worker:

~~~powershell
npm run worker:d1:migrate
npm run worker:d1:seed
npm run worker:dev
~~~

Trong `/admin` → **Sản phẩm**, tạo master data và variant. Sản phẩm cùng variant ở trạng thái `Đang bán` sẽ xuất hiện trên storefront. **Visual Editor** nạp catalog từ Worker để xem trước và tinh chỉnh tên/ảnh.

Khách có thể tra cứu bằng mã đơn tại `/tracking/:orderCode`; route cũ dùng private tracking token vẫn được hỗ trợ.

Ảnh/video có thể tham chiếu bằng URL hoặc upload từ admin; Worker lưu file vào R2 và lưu URL media trong D1. Giới hạn upload hiện tại: tối đa 12 file/lần, 25MB/file, chỉ image/video.

Login:

~~~powershell
$body = @{ email = 'admin@example.com'; password = 'your-password' } | ConvertTo-Json
Invoke-WebRequest -Method Post -Uri http://127.0.0.1:8787/api/admin/login -ContentType 'application/json' -Body $body
~~~

Cookie session được trả trong Set-Cookie. Không log, copy vào source hoặc commit cookie/token.

## Admin endpoints

- POST /api/admin/login
- POST /api/admin/logout
- GET /api/admin/me
- GET /api/admin/dashboard
- GET /api/admin/products
- POST /api/admin/products
- PATCH /api/admin/products/:id
- POST /api/admin/products/:id/variants
- PATCH /api/admin/variants/:id
- GET /api/admin/orders
- PATCH /api/admin/orders/:id/status
- GET /api/admin/print-jobs
- PATCH /api/admin/print-jobs/:id/status

Các endpoint trên đều yêu cầu session hợp lệ, trừ login.

## Status transitions

Order:

received → confirmed/cancelled → preparing → printing → quality_check → packing → shipping → completed

Print job:

waiting → printing → quality_check → completed

Print job có thể chuyển failed → reprint. Không cho browser tự đặt trạng thái tùy ý.

## Chưa triển khai

- Phân quyền nhiều role, reset password, email/Zalo notification.
- Payment, printer API/automation, rate limiting production.
- Pagination/filter nâng cao cho danh sách admin.

## Điều chỉnh phạm vi hiện tại

- Đã ẩn phần Print Job khỏi giao diện admin để quy trình hiện tại chỉ tập trung vào cập nhật đơn hàng thủ công.
- Bảng và endpoint Print Job vẫn được giữ trong Worker để không phá dữ liệu/migration cũ; chưa có kết nối hay tự động điều khiển máy in.
