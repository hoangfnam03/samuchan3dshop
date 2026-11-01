# Quyết định kiến trúc (ADR rút gọn)

## 2026-10-31 — Giá vốn nhựa in bình quân theo lô mua

- Mỗi lần nhập nhựa được lưu thành một lô riêng với ngày mua, số cuộn, giá CNY/cuộn, tỷ giá tại ngày mua, phí/cuộn và snapshot các khoản phí ghim.
- Giá vốn/cuộn hiện tại là bình quân gia quyền theo số cuộn: tổng giá trị các lô đã ghi nhận chia tổng số cuộn của những lô đó. Giá bán và khuyến mãi vẫn nằm riêng theo loại nhựa.
- Khi mở loại nhựa để nhập lô mới, giá CNY, tỷ giá, vận chuyển và phí riêng được điền từ lô gần nhất; ngày mua mặc định là hôm nay theo giờ Việt Nam. Lưu lô mới không sửa các lô cũ.
- Một đợt nhập có chung ngày và có thể gồm nhiều loại nhựa; màn hình lịch sử gom các dòng lô theo ngày, bấm ngày để xem mọi loại nhựa cùng chi phí của đợt. Tạo đợt mới sao chép thông số gần nhất cho từng loại để chỉnh tiếp.
- Hồ sơ nhựa hiện tại được chụp thành card ban đầu ngày 2026-10-31, gồm giá mua, tỷ giá, phí, giá vốn, giá bán và khuyến mãi. Snapshot này bất biến để lần nhập mới không ghi đè.
- Card ban đầu chưa có số cuộn nên không tham gia bình quân. Số cuộn của lô mới phải do quản trị nhập thực tế; không tự suy đoán hay chuyển hồ sơ cũ thành lô có số lượng giả.
- Hồ sơ cũ chưa có số cuộn không được tự chuyển thành lô giả. Bình quân bắt đầu từ các lô được ghi nhận; trước lô đầu tiên, giá vốn cũ tiếp tục được dùng cho đơn mới. Đơn đã tạo giữ nguyên snapshot giá vốn.

Lý do: lưu được chênh lệch tỷ giá và chi phí theo từng lần mua, đồng thời tính giá vốn theo đúng tỷ trọng số cuộn mà không suy đoán số lượng của dữ liệu cũ.

## 2026-10-31 — Khoản giá vốn mặc định cho sản phẩm mới

- Admin có thể ghim từng khoản giá vốn vào danh sách mặc định lưu trong D1; sản phẩm tạo sau tự nhận các khoản đang ghim và có thể chỉnh riêng trước khi lưu.
- Thay đổi danh sách mặc định chỉ áp dụng cho sản phẩm tạo sau; không cập nhật lại các sản phẩm cũ hay snapshot giá vốn của đơn đã tạo.
- Bỏ ghim/xóa khoản sẽ gỡ khoản khỏi mặc định; sản phẩm đã lưu giữ nguyên khoản giá vốn riêng.

Lý do: giảm nhập lặp lại các khoản phí chung mà vẫn giữ được giá vốn riêng và lịch sử đơn chính xác.

## 2026-10-31 — Nhóm nhựa và phân khúc giá sản phẩm

- Sản phẩm có thể chọn một hoặc nhiều loại nhựa để lọc màu master data trong preview màu tùy chỉnh; preview gộp màu từ các nhóm đã chọn, còn variant màu có sẵn không bị lọc theo lựa chọn này.
- Giá phụ thuộc kích thước, không phụ thuộc loại nhựa của màu. Mỗi kích thước dùng giá từ variant được tạo đầu tiên của sản phẩm; Worker áp dụng cùng mức giá khi tạo đơn.

Lý do: preview chỉ gợi ý các màu custom thuộc nhóm nhựa đã chọn; variant có sẵn vẫn giữ lựa chọn riêng của sản phẩm và giá theo kích thước.

## 2026-10-31 — Màu custom được lưu cùng đơn hàng

- Khi khách thêm màu custom vào giỏ, frontend gửi ID master color cùng variant cùng kích thước làm cơ sở tính giá.
- Worker xác thực màu còn trong master data, kể cả màu “Chưa có sẵn”; lưu tên và ghi chú chờ hàng từ trạng thái màu trong snapshot, không trừ tồn kho.
- Khi hủy đơn custom, không cộng trả tồn kho cho variant giá tham chiếu.

Lý do: màu custom chưa có tồn kho variant riêng; snapshot phải giữ chính xác màu khách đã chọn để shop xác nhận trước sản xuất.

## 2026-10-31 — Trạng thái màu thay cho tồn kho

- Không nhập số lượng tồn cho variant. Trạng thái màu master “Có sẵn / Chưa có sẵn” quyết định lời nhắc giao hàng.
- Màu “Chưa có sẵn” vẫn đặt được; khách thấy ghi chú chờ 7 ngày ở trang màu, giỏ hàng, thanh toán và theo dõi đơn.
- Worker không chặn, trừ hoặc hoàn lại tồn kho số lượng.

Lý do: cửa hàng xác định khả năng cung ứng theo màu master, không cần theo dõi số lượng từng variant.

## 2026-10-31 — Bán nhựa in theo cuộn và loại nhựa

- Bán mọi màu có trong master data theo cuộn 1kg, không lọc theo trạng thái có sẵn.
- Giá bán cuộn 1kg được quản lý theo loại nhựa; tất cả màu cùng loại nhựa dùng chung giá, không phụ thuộc hãng.
- Màu “Chưa có sẵn” vẫn đặt được và đơn hàng lưu snapshot màu, hãng, loại nhựa cùng ghi chú chờ 7 ngày.

Lý do: khách có thể mua nhựa in độc lập với sản phẩm custom, còn giá không cần nhập lặp lại trên từng màu.

## 2026-10-06 — Tra cứu tracking bằng mã đơn

- Cho phép khách tra cứu trạng thái bằng mã đơn ngẫu nhiên dạng `SAMU-` + 10 ký tự hex qua `/tracking/:orderCode`.
- API tracking không trả dữ liệu liên hệ khách; tracking token hiện hữu tiếp tục được hỗ trợ.
- Đồng bộ order status với trạng thái production khi admin cập nhật order/print job; chỉ tiến order tới QC sau khi các print job đã tới QC.

Lý do: khách có thể dùng mã được hiển thị sau checkout; admin và khách cần thấy tiến độ sản xuất nhất quán.

## 2026-10-04 — Khởi tạo project

- Chọn React + TypeScript + Vite cho frontend.
- Chuẩn bị thư mục `worker/` cho Cloudflare Workers, nhưng **chưa** tạo API hoặc cấu hình Cloudflare.
- Giữ HTML prototype nguyên trạng trong `legacy/` để đối chiếu khi migrate từng màn hình.
- Đặt logo tại `public/brand/` để frontend tham chiếu bằng `/brand/...`.
- Không tạo monorepo, backend truyền thống, database, auth, dependency UI hoặc abstraction chưa cần thiết.

Lý do: phù hợp MVP ít traffic, dễ maintain bởi một người và có đường triển khai Cloudflare free tier khi cần.

## 2026-10-04 — Phase 1 storefront

- Chuyển storefront bằng React components, TypeScript types và CSS thuần; không đưa Tailwind CDN của prototype vào production.
- Dùng state nội bộ thay cho router và API ở Phase 1 để giữ đúng flow mock hiện có, không phát sinh dependency hoặc backend sớm.
- Migrate storefront đầy đủ; `AdminPanel` và visual editor được để lại trong prototype cho phase admin.

Lý do: giữ fidelity của giao diện trong khi tối giản dependency và không trộn yêu cầu storefront với admin/backend.

## 2026-10-06 — Tra cứu tracking bằng mã đơn

- Cho phép khách tra cứu trạng thái bằng mã đơn ngẫu nhiên dạng `SAMU-` + 10 ký tự hex qua `/tracking/:orderCode`.
- API tracking không trả dữ liệu liên hệ khách; tracking token hiện hữu tiếp tục được hỗ trợ.
- Đồng bộ order status với trạng thái production khi admin cập nhật order/print job; chỉ tiến order tới QC sau khi các print job đã tới QC.

Lý do: khách có thể dùng mã được hiển thị sau checkout; admin và khách cần thấy tiến độ sản xuất nhất quán.

## 2026-10-04 — Khởi tạo project

- Chọn React + TypeScript + Vite cho frontend.
- Chuẩn bị thư mục `worker/` cho Cloudflare Workers, nhưng **chưa** tạo API hoặc cấu hình Cloudflare.
- Giữ HTML prototype nguyên trạng trong `legacy/` để đối chiếu khi migrate từng màn hình.
- Đặt logo tại `public/brand/` để frontend tham chiếu bằng `/brand/...`.
- Không tạo monorepo, backend truyền thống, database, auth, dependency UI hoặc abstraction chưa cần thiết.

Lý do: phù hợp MVP ít traffic, dễ maintain bởi một người và có đường triển khai Cloudflare free tier khi cần.

## 2026-10-04 — Phase 1 storefront

- Chuyển storefront bằng React components, TypeScript types và CSS thuần; không đưa Tailwind CDN của prototype vào production.
- Dùng state nội bộ thay cho router và API ở Phase 1 để giữ đúng flow mock hiện có, không phát sinh dependency hoặc backend sớm.
- Migrate storefront đầy đủ; `AdminPanel` và visual editor được để lại trong prototype cho phase admin.

Lý do: giữ fidelity của giao diện trong khi tối giản dependency và không trộn yêu cầu storefront với admin/backend.
## 2026-10-31 — Trạng thái màu thay cho tồn kho

- Không nhập số lượng tồn cho variant. Trạng thái màu master “Có sẵn / Chưa có sẵn” quyết định lời nhắc giao hàng.
- Màu “Chưa có sẵn” vẫn đặt được; khách thấy ghi chú chờ 7 ngày ở trang màu, giỏ hàng, thanh toán và theo dõi đơn.
- Worker không chặn, trừ hoặc hoàn lại tồn kho số lượng.

Lý do: cửa hàng xác định khả năng cung ứng theo màu master, không cần theo dõi số lượng từng variant.


## 2026-10-31 — Link mua và giá khuyến mãi

- Link nhà cung cấp được lưu riêng cho từng loại nhựa và chỉ trả về trong API admin có xác thực.
- Khuyến mãi là phần trăm nguyên từ 0 đến 99. Với sản phẩm nhựa in, mức giảm áp dụng theo giá của loại nhựa và dùng chung cho các màu thuộc loại đó.
- Ngày hết hạn tính đến cuối ngày theo múi giờ Việt Nam (UTC+7); Worker tự ngừng giảm giá khi tạo đơn sau thời điểm này và lưu giá thực tế vào đơn hàng.


## 2026-10-31 — Chi phí mặc định cho các loại nhựa in

- Chi phí nhựa in được ghim riêng khỏi chi phí sản phẩm thường và tự cộng vào giá vốn mọi loại nhựa.
- Bỏ ghim chỉ giữ khoản đó ở loại nhựa đang sửa; xóa khoản ghim gỡ khoản mặc định khỏi các loại nhựa khác. Đơn mới dùng giá vốn theo các khoản mặc định hiện tại.
