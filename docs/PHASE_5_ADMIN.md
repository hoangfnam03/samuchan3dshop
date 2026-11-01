# Phase 5 — Admin và production workflow

## Đã triển khai

- Cuộn nhựa in được quản lý trong tab Sản phẩm. Nút Thêm sản phẩm cho phép tạo sản phẩm thông thường theo form hiện tại hoặc thiết lập sản phẩm cuộn 1kg theo loại nhựa; hồ sơ nhựa lưu giá mua CNY, tỷ giá tại thời điểm mua, phí vận chuyển, các khoản phí khác, giá vốn tính tự động và giá bán. Màu thuộc loại nhựa đã thiết lập tiếp tục hiển thị thành từng mặt hàng màu trên storefront.
- Hồ sơ nhựa đang có được chụp vào card ngày 31.10, gồm thông số giá mua, tỷ giá, phí, giá vốn, giá bán và khuyến mãi. Các đợt nhập mới dùng chung một ngày, có thể chọn nhiều loại nhựa; form điền sẵn thông số mới nhất để chỉnh tiếp và không thay snapshot ban đầu hay các lô cũ. Bấm từng ngày để xem chi tiết. Card ban đầu chưa có số cuộn nên không tham gia bình quân; lô mới yêu cầu nhập số cuộn thực tế. Giá vốn/cuộn được tính bình quân gia quyền; đơn mới dùng bình quân hiện tại, đơn cũ giữ nguyên snapshot giá vốn.

- Admin login bằng D1 admin record hoặc bootstrap credentials từ runtime secrets.
- Session token CSPRNG, chỉ lưu token hash trong D1, hết hạn sau 8 giờ.
- Dashboard metrics doanh thu/order status.
- Master data catalog: tạo/sửa sản phẩm, danh mục, trạng thái, giá; thêm/sửa variant, màu, hãng nhựa (có gợi ý từ dữ liệu đã lưu), loại nhựa, size, SKU và giá. Trạng thái màu “Có sẵn / Chưa có sẵn” quyết định lời nhắc chờ hàng; không nhập số tồn. URL ảnh/video demo được lưu trong D1.
- Mục bán nhựa in lấy toàn bộ màu từ master data, bán theo cuộn 1kg và áp dụng giá theo loại nhựa do admin cấu hình. Mọi màu cùng loại nhựa dùng chung giá, không phụ thuộc hãng. Màu “Chưa có sẵn” vẫn đặt được và mang ghi chú chờ 7 ngày vào đơn; giá được Worker xác thực từ bảng giá loại nhựa.
- Trang chủ tự hiển thị thẻ cho các danh mục sản phẩm đang hoạt động; thêm danh mục trong Admin sẽ tạo thêm thẻ tương ứng. Danh mục “In 3D” liệt kê mỗi màu master data thành một mặt hàng riêng, nhóm theo loại nhựa.
- Mỗi variant có thể có một ảnh riêng; ảnh được lưu ở R2, xuất hiện trong gallery sản phẩm và tự được chọn khi khách chọn variant tương ứng.
- Mỗi sản phẩm chọn một hoặc nhiều loại nhựa để lọc màu trong preview tùy chỉnh; preview gộp màu master từ các nhóm đã chọn. Variant màu có sẵn không bị giới hạn theo lựa chọn này; giá variant vẫn tính theo kích thước.
- Mỗi sản phẩm có thể tải riêng ảnh preview nhúng màu; ảnh này không nằm trong gallery và được dùng làm ảnh nền cho trang tùy chỉnh màu.
- Trang tùy chỉnh màu ở storefront hiển thị ảnh mẫu và tên màu master chưa có trong sản phẩm; khách chọn màu sẽ phủ màu lên ảnh chính để xem trước và có thể thêm đúng màu đã chọn vào giỏ hàng.
- Giá vốn sản phẩm: Admin nhập nhiều khoản cost theo từng sản phẩm; tổng được tính tự động và chỉ trả về qua endpoint đã xác thực. Có thể ghim khoản phí làm mặc định cho các sản phẩm tạo sau; khoản ghim được lưu trong D1, có thể bỏ ghim hoặc xóa. Thay đổi mặc định không sửa giá vốn của sản phẩm đã lưu trước đó. Đơn mới lưu snapshot giá vốn từng món để hỗ trợ thống kê lãi sau này; storefront và tracking không nhận các trường cost.
- Storefront lấy sản phẩm active từ Worker; checkout gửi variant ID và mã màu custom (nếu có) để Worker tạo đơn trong D1, snapshot đơn hiển thị đúng màu trong Admin và tracking.
- Danh sách đơn hỗ trợ tìm theo mã đơn/tên/số điện thoại và lọc trạng thái. Admin chuyển trạng thái theo quy trình; tracking page đọc status history và trạng thái print job từ D1, tự làm mới mỗi 30 giây.
- Cập nhật order status sẽ đồng bộ print job liên quan; cập nhật print job sang `printing`/`quality_check` sẽ tiến trạng thái order khi phù hợp (với nhiều mặt hàng, chờ tất cả print job tới QC).
- Order management: xem đơn authenticated và chuyển status theo transition hợp lệ.
- Tự tạo print jobs khi order chuyển sang preparing.
- Print job management: xem và cập nhật Waiting → Printing → Quality Check → Completed/Failed/Reprint.
- Không có customer account, không có printer automation.
- Admin frontend tại /admin, không có link/button admin trong storefront.
- Visual Editor tại /admin/visual-editor, chỉ mở sau khi phiên admin hợp lệ; nội dung trang (bao gồm Zalo, email và địa chỉ) lưu dùng chung trong D1, còn tên/ảnh sản phẩm cập nhật vào D1.

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

Lệnh `worker:dev` tự build frontend và áp dụng các migration D1 local còn thiếu trước khi Wrangler phục vụ app và API.

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

- GET /api/admin/site-config
- PUT /api/admin/site-config
- PUT /api/admin/filament-type-prices
- POST /api/admin/filament-purchase-batches
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

Storefront đọc cấu hình dùng chung qua `GET /api/site-config`.
Catalog công khai trả toàn bộ màu master kèm giá cuộn theo loại nhựa qua `GET /api/catalog/products`.

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

## Trạng thái màu và thời gian chờ

- Màu “Có sẵn” có thể đặt bình thường.
- Màu “Chưa có sẵn” vẫn có thể chọn và đặt; storefront ghi “Màu này chưa có sẵn, vui lòng đợi 7 ngày để hàng về”.
- Không dùng số tồn variant để chặn đặt hàng, hiển thị hết hàng hoặc trừ/cộng khi đơn được tạo/hủy.


## Link mua và khuyến mãi sản phẩm

- Hồ sơ từng loại nhựa lưu link mua hàng riêng; link chỉ xuất hiện trong API quản trị đã xác thực, không đưa vào catalog công khai.
- Sản phẩm thường giảm theo phần trăm 0–99; sản phẩm nhựa in giảm theo giá cuộn của loại nhựa, áp dụng cho mọi màu thuộc loại đó.
- Ngày kết thúc có hiệu lực đến hết ngày theo giờ Việt Nam (UTC+7). Catalog và Worker tính lại giá tại thời điểm tạo đơn; đơn hàng lưu mức giá được áp dụng khi đặt.


## Chi phí ghim cho nhựa in

- Có thể ghim khoản phí bổ sung để áp dụng mặc định cho mọi hồ sơ loại nhựa; thay đổi được phản ánh ở tổng giá vốn của các loại nhựa và chi phí snapshot cho đơn tạo sau đó.
- Bỏ ghim giữ khoản phí ở loại nhựa đang sửa; xóa khoản đã ghim sẽ gỡ mặc định khỏi các loại nhựa khác.
