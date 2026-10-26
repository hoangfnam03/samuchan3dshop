# Phase 1 — Migration note

## Phạm vi đã duyệt

Chuyển storefront từ `legacy/samuchan_gift_custom.html` sang React + TypeScript:

- Header/footer, home, quy trình 4 bước, sản phẩm nổi bật và catalog lọc theo category.
- Chi tiết sản phẩm: màu, size, số lượng và trạng thái hết hàng.
- Giỏ local, checkout client-side, màn thành công, tra cứu/tracking demo.
- Responsive desktop/mobile.

## Mapping từ prototype

| Prototype | Bản React |
| --- | --- |
| `setView` string/object | union `View` trong `App.tsx` |
| `MOCK_PRODUCTS` | `src/data/products.ts` + type rõ ràng |
| `cart` state | `CartItem[]` trong `App.tsx`, merge theo product/màu/size |
| `ProductCard` | `src/components/ProductCard.tsx` |
| page components | `src/pages/Storefront.tsx` |
| Tailwind CDN | CSS thuần tại `src/styles/global.css` |

## Các quyết định cố ý chưa làm

- Không cài Tailwind hay UI library vì CSS hiện tại đủ nhỏ và chuyển utility sang CSS giữ project nhẹ.
- Không dùng router dependency: 9 view mock chưa cần URL routing; state nội bộ tương ứng prototype. Routing/secure token sẽ được thiết kế khi API tracking thật bắt đầu.
- Không port `AdminPanel` hoặc visual editor vì chúng thuộc phase admin; không tạo API, database, D1/R2, auth, endpoint hoặc dữ liệu thật.
- Placeholder images vẫn chỉ là mock, cần thay bằng R2/media thật ở Phase 3.

