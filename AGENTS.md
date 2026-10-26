# Hướng dẫn bắt buộc cho AI

Đọc đầy đủ `docs/AI_HANDOFF.md` trước khi phân tích hoặc sửa code.

Ưu tiên tuyệt đối:

1. Làm đúng phase hiện tại trong checklist; không tự triển khai phase sau.
2. Giữ UI prototype, flow và tiếng Việt trừ khi yêu cầu nói rõ khác đi.
3. Xem `legacy/samuchan_gift_custom.html` là nguồn đối chiếu; không xóa hoặc format lại toàn bộ file này.
4. Trước mỗi thay đổi: kiểm tra cấu trúc/dependencies hiện hữu; sau thay đổi: chạy kiểm tra phù hợp và báo các file đã sửa.
5. Không tự thêm domain backend, D1/R2 resources, customer auth, printer automation, marketplace, chat, microservice hay dependency UI lớn ngoài phase đã được duyệt. Phase 2 chỉ được có Worker foundation và contracts.

Tài liệu chính: `docs/AI_HANDOFF.md`. Quyết định đã chốt: `docs/DECISIONS.md`.
