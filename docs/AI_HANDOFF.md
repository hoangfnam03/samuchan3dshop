# SAMUCHAN — AI project handoff

> **Mục đích:** đây là tài liệu nguồn sự thật cho mọi AI/người mới mở project. Đọc từ đầu đến cuối trước khi tạo, sửa hoặc xóa code. Nếu yêu cầu mới mâu thuẫn với tài liệu này, dừng lại, chỉ ra mâu thuẫn và xin xác nhận phạm vi thay đổi.

## 1. Tóm tắt sản phẩm và ranh giới MVP

SAMUCHAN là shop quà tặng và sản phẩm custom, trọng tâm là sản xuất bằng in 3D. Khách không cần tạo tài khoản: duyệt sản phẩm → chọn variant/màu/kích thước/số lượng → giỏ → cung cấp thông tin → tạo đơn → shop xác nhận qua Zalo/điện thoại. Tracking dùng mã đơn ngẫu nhiên `SAMU-` + 10 ký tự hex hoặc tracking token riêng; không dùng database ID tuần tự công khai.

Admin là vai trò nội bộ duy nhất trong MVP: quản lý sản phẩm/variant/đơn, cập nhật trạng thái và theo dõi print job. Máy in 3D không được tự động hoá trong MVP.

### Không nằm trong MVP

- Customer login/account, phân quyền nhiều cấp, seller/marketplace, chat.
- Microservice, VPS, Docker production, Redis, Kafka/RabbitMQ, Kubernetes.
- Tối ưu cho traffic lớn, abstraction chỉ vì “best practice”.
- Tạo database/API/UI mới khi phase tương ứng chưa bắt đầu.

Thứ tự ưu tiên khi có nhiều giải pháp: **đơn giản → dễ bảo trì → free/chi phí thấp → hiệu năng**.

## 2. Trạng thái chính xác tại thời điểm khởi tạo

Ngày khởi tạo: 2026-10-04.

- Đã tạo Vite + React + TypeScript tối thiểu; màn hình hiện tại chỉ là placeholder có logo, không phải UI đã chuyển đổi.
- Đã chạy `npm install`; `package-lock.json` là lockfile cần được giữ và cập nhật cùng dependency. `npm run typecheck` và `npm run build` đã pass ở khung ban đầu.
- Chưa có Cloudflare account config, `wrangler.jsonc`, Worker runtime, D1, R2, schema, migration, API, authentication hay deployment.
- `legacy/samuchan_gift_custom.html` là prototype một-file: React 18 UMD + Babel + Tailwind CDN, state mock trong browser. Nó không phải nền tảng production.
- `public/brand/logo_samuchan.jpg` là logo được cung cấp. Không tự tạo logo khác.
- Text tiếng Việt trong prototype phải được đọc/ghi UTF-8; nếu terminal hiển thị ký tự lỗi, không được “sửa” nội dung chỉ dựa vào output terminal.

## 3. Cấu trúc thư mục và ownership

```
src/                  # React application (chỉ thêm code khi migrate UI)
  styles/             # global tokens và CSS chung
public/brand/         # logo / asset thương hiệu tĩnh
legacy/               # nguồn prototype bất biến để đối chiếu
worker/               # chỉ dùng khi phase Cloudflare backend được duyệt
docs/                 # nguồn sự thật về quy trình và quyết định
```

Quy tắc: `legacy/` không phải nơi chạy app; `src/` không import trực tiếp script Babel/CDN của legacy; các ảnh placeholder từ legacy không được coi là asset production.

## 4. Bản đồ prototype cần được bảo toàn khi convert

Tệp nguồn: `legacy/samuchan_gift_custom.html`.

| Nhóm | Nội dung hiện có | Khi convert |
| --- | --- | --- |
| Khung chung | `Header`, `Footer`, nav, badge giỏ | Tách shared components, giữ layout/nhãn hiện hữu |
| Storefront | `Home`, `Shop`, `ProductCard`, `ProductDetail` | Convert trước, dùng mock data typed cục bộ |
| Checkout | `Cart`, `Checkout`, `OrderSuccess` | Chỉ giữ local state/mock cho đến phase order API |
| Tracking | `TrackingLogin`, `OrderTracking` | Giữ UI demo; chưa gọi API thật |
| Admin demo | `AdminPanel`, visual editor | Chỉ migrate khi phase storefront đã ổn định; chưa bảo mật giả |
| Data mock | `MOCK_PRODUCTS`, site config, cart state | Chuyển sang TypeScript types + mock module, không coi là data model cuối |

Views hiện tại: `home`, `shop`, product detail, `cart`, `checkout`, `success`, `tracking_login`, `tracking_demo`, `admin`. Prototype dùng `setView`; khi migrate, chọn routing tối thiểu và ghi rõ mapping trước khi thay navigation. Không thay đổi flow hay copy chỉ vì dễ code.

## 5. Công nghệ đã chọn và các quy ước

- Frontend: React + TypeScript + Vite.
- Backend tương lai: TypeScript Cloudflare Workers.
- Lưu trữ tương lai: Cloudflare D1 (data) và R2 (ảnh/file), ưu tiên free tier.
- Deploy sau này: GitHub → Cloudflare.
- CSS: ở phase convert, ưu tiên tái sử dụng gần sát utility/style của prototype; chỉ chốt Tailwind hay CSS strategy sau khi phân tích yêu cầu chuyển đổi, không cài library UI theo mặc định.

Không đổi package manager, dependency hoặc project architecture nếu không cần cho task được giao. Mọi package mới phải có lý do, tác động bundle và lựa chọn đơn giản hơn nếu có.

## 6. Quy trình bắt buộc cho MỖI yêu cầu

1. Đọc `AGENTS.md`, tài liệu này, `docs/DECISIONS.md`, sau đó xem `git status` và các file có liên quan.
2. Xác định phase/checklist mà yêu cầu thuộc về. Nếu nó vượt phase hiện tại, đề xuất phần nhỏ nhất và xin xác nhận.
3. Nêu ngắn gọn file sẽ sửa, phần UI/flow bị ảnh hưởng và điều gì cố ý chưa làm.
4. Sửa phạm vi nhỏ nhất. Không rewrite toàn project, không xóa source legacy, không nâng cấp dependency hàng loạt.
5. Chạy kiểm tra phù hợp: tối thiểu `npm run typecheck` và `npm run build` khi dependencies đã được cài; kiểm tra giao diện desktop + mobile khi có UI thay đổi.
6. Báo cáo: file thay đổi, hành vi đã xong, kiểm tra đã chạy/kết quả, và bước kế tiếp đúng checklist. Cập nhật phần “nhật ký” bên dưới nếu đã hoàn thành một phase.

## 7. Roadmap theo phase — không nhảy bước

### Phase 0 — Khởi tạo (đã xong)

- [x] Kiểm kê HTML/logo và xác nhận chưa có framework project.
- [x] Khởi tạo React + TypeScript + Vite tối thiểu.
- [x] Tách asset thương hiệu và prototype vào nơi rõ ownership.
- [x] Viết tài liệu AI handoff, ràng buộc MVP và roadmap.
- [x] Chạy `npm install`, `npm run typecheck`, `npm run build`; đã sinh `package-lock.json` (phần xác thực môi trường).

### Phase 1 — Convert storefront UI (đã xong)

Mục tiêu: chuyển giao diện khách hàng từ prototype sang React + TypeScript nhưng không kết nối backend và không redesign.

Thứ tự làm:

1. Phân tích toàn bộ prototype: component, CSS/Tailwind utility, asset/placeholder, state, event và viewport behavior. Viết migration note ngắn trước patch.
2. Chốt cách xử lý CSS tối giản dựa trên prototype. Chỉ cài Tailwind nếu thực sự cần để giữ fidelity; nếu có, cấu hình build-time, không dùng CDN production.
3. Tạo types tối thiểu (`Product`, selected options, cart item) và mock data UTF-8 có chủ đích. Không tạo schema D1.
4. Migrate `Header`, `Footer`, home và danh sách product trước. So sánh trực quan với legacy ở desktop/mobile.
5. Migrate product detail (variant, color, size, quantity) và local cart.
6. Migrate cart, checkout mock, success và tracking mock. Form chỉ validate ở client; không lưu dữ liệu thật.
7. Chỉ sau storefront ổn định mới đề xuất migration admin demo.

Tiêu chí hoàn thành: app build/typecheck; navigation/giỏ local hoạt động; responsive; người dùng nhận ra UI gần prototype; không có request đến API giả, không mất flow hiện có.

Kết quả: storefront đã được chuyển sang `src/components/`, `src/pages/Storefront.tsx`, `src/data/products.ts` và CSS thuần. Đã bao gồm catalog/filter, chi tiết/variant/màu/size, giỏ local, checkout mock, success và tracking mock. Admin/visual editor chưa được migrate; chưa có request API.

### Phase 2 — Data contracts và Worker foundation (đã xong)

Thiết kế tối thiểu các entity: Product, ProductVariant, Order, OrderItem, OrderStatusHistory, PrintJob, Admin; chỉ thêm Category nếu UI thật cần. Sau đó mới tạo Worker, `wrangler` config và local binding. Business logic ở Worker, UI không truy cập D1/R2 trực tiếp.

Kết quả: contracts tại `worker/contracts.ts`, Worker foundation tại `worker/index.ts`, local config tại `wrangler.jsonc`, health endpoint `GET /api/health`. Chưa có D1/R2 resources, schema/migration, catalog/order API, authentication hoặc deployment. Chi tiết: `docs/PHASE_2_CONTRACTS.md`.

### Phase 3 — Catalog và media (đã xong)

Đã thêm migration/schema versioned, local seed, catalog read API và media read route. Chi tiết tại `docs/PHASE_3_CATALOG.md`. Frontend mock vẫn chưa thay bằng API cho đến khi read path được kiểm tra trong môi trường local.

### Phase 4 — Đơn hàng và tracking an toàn (đã xong)

Đã thêm create-order validation server-side, order code random, order item snapshot (product/variant/size/color/quantity/option), lịch sử status và tracking token CSPRNG chỉ lưu hash. Không public sequential ID. Chi tiết: docs/PHASE_4_ORDERS.md.

### Phase 5 — Admin và production workflow (đã xong)

Đã thêm admin authentication/session, catalog/order management, status transitions, print jobs (Waiting → Printing → Quality Check → Completed; Failed → Reprint), quản lý lô mua nhựa với giá vốn bình quân gia quyền và giao diện admin truy cập trực tiếp tại `/admin`. Không thêm customer auth hay printer automation. Chi tiết: docs/PHASE_5_ADMIN.md.

### Phase 6 — Deploy và vận hành

Thiết lập GitHub/Cloudflare, bindings khác nhau cho dev/prod, secret qua dashboard/CLI (không commit), logging tối thiểu, backup/export D1 và kiểm tra production flow. Chỉ deploy khi user yêu cầu.

## 8. Guardrails dữ liệu, bảo mật và domain

- Không log hoặc commit số điện thoại, địa chỉ, token tracking, secret, `.env` thật hoặc dữ liệu đơn hàng thật.
- Public tracking bằng mã đơn/token chỉ trả trạng thái, lịch sử và item snapshots; không trả tên/số điện thoại/địa chỉ khách hàng. Mã đơn phải tiếp tục là ngẫu nhiên, không tuần tự; tracking token tạo bằng CSPRNG và chỉ lưu hash.
- Mọi giá/stock/variant/order total phải được Worker kiểm tra lại; không tin giá hoặc trạng thái từ browser.
- OrderItem là snapshot tại lúc đặt, không chỉ reference product hiện hành; đây là điều kiện tránh in nhầm sản phẩm/size/màu.
- Status transition phải do server kiểm soát khi backend bắt đầu.

## 9. Nhật ký thực hiện

| Ngày | Phase | Việc đã hoàn thành | Ghi chú |
| --- | --- | --- | --- |
| 2026-10-04 | 0 | Khởi tạo cấu trúc, Vite/React/TS, di chuyển source reference/logo, viết handoff, cài và kiểm tra build | `typecheck` và production build pass; chưa convert UI |
| 2026-10-04 | 1 | Chuyển storefront React/TypeScript/CSS: catalog, detail, local cart, checkout, success, tracking mock | `typecheck` và production build pass; không có API/backend; admin chưa migrate |
| 2026-10-04 | 2 | Chốt domain contracts, tạo Worker foundation, Wrangler local config và health endpoint | `worker:typecheck`, root `typecheck`, frontend build pass; health local trả 200; chưa có D1/R2 |
| 2026-10-04 | 3 | Tạo D1 schema/seed, binding D1/R2, catalog read API và media read route | Migration local, worker/frontend typecheck, catalog 200 và production build pass; chưa có write API hoặc deploy |
| 2026-10-04 | 4 | Thêm create order, server-side price/stock validation, OrderItem snapshot và secure token tracking | Create 201, tracking 200, out-of-stock 409, token invalid 404; chưa có payment/auth/deploy |
| 2026-10-04 | 5 | Thêm admin session auth, dashboard, catalog/order management, print job transitions và UI `/admin` | D1 migration 0002, login/session/dashboard/products local pass; frontend build pass; chưa deploy |
| 2026-10-31 | 5 | Thêm khoản giá vốn ghim làm mặc định cho sản phẩm tạo sau | Migration D1 local 0016, frontend/Worker typecheck và build pass; cập nhật quyết định không hồi tố giá vốn sản phẩm cũ |
| 2026-10-31 | 5 | Thêm lịch sử lô mua nhựa và bình quân gia quyền theo số cuộn | Migration D1 local 0023; root/Worker typecheck, build pass; không tự gán số lượng cho dữ liệu cũ; đơn mới dùng giá vốn bình quân, đơn cũ giữ snapshot |

Khi hoàn thành một bước, thêm đúng một dòng: ngày, phase, phạm vi, kiểm tra đã chạy và các quyết định mới (nếu có, cập nhật `DECISIONS.md`).

| 2026-10-31 | 6 | Deploy Worker `shop` và static assets; áp dụng D1 migrations 0018–0021 trên production | Build pass; migrations thành công; `/api/health` trả `ok`, catalog công khai trả 1 sản phẩm và 37 màu; không lộ link mua hàng trong catalog |
