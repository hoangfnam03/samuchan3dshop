# Quyết định kiến trúc (ADR rút gọn)

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
