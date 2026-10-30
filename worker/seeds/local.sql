INSERT OR IGNORE INTO order_statuses (code, name, description, sort_order, is_terminal, is_active) VALUES
  ('received', 'Mới nhận', 'Đơn vừa được tạo.', 10, 0, 1),
  ('confirmed', 'Đã xác nhận', 'Shop đã xác nhận đơn.', 20, 0, 1),
  ('preparing', 'Đang chuẩn bị', 'Đang chuẩn bị sản phẩm.', 30, 0, 1),
  ('packing', 'Đang đóng gói', 'Đơn đang được đóng gói.', 40, 0, 1),
  ('shipping', 'Đang giao', 'Đơn đã bàn giao vận chuyển.', 50, 0, 1),
  ('completed', 'Hoàn thành', 'Đơn đã hoàn tất.', 60, 1, 1),
  ('cancelled', 'Đã hủy', 'Đơn đã bị hủy.', 70, 1, 1);

INSERT OR IGNORE INTO order_status_transitions (from_status, to_status) VALUES
  ('received', 'confirmed'), ('received', 'cancelled'),
  ('confirmed', 'preparing'), ('confirmed', 'cancelled'),
  ('preparing', 'packing'), ('preparing', 'cancelled'),
  ('packing', 'shipping'), ('shipping', 'completed');

INSERT OR IGNORE INTO colors (id, code, name, display_name, hex, sort_order, created_at, updated_at) VALUES
  ('color_white', 'white', '__color_color_white', 'Trắng', '#FFFFFF', 10, '2026-10-04T00:00:00.000Z', '2026-10-04T00:00:00.000Z'),
  ('color_black', 'black', '__color_color_black', 'Đen', '#111111', 20, '2026-10-04T00:00:00.000Z', '2026-10-04T00:00:00.000Z'),
  ('color_warm_white', 'warm-white', '__color_color_warm_white', 'Trắng ấm', '#FFF4D6', 30, '2026-10-04T00:00:00.000Z', '2026-10-04T00:00:00.000Z'),
  ('color_black_white', 'black-white', '__color_color_black_white', 'Đen/Trắng', '#555555', 40, '2026-10-04T00:00:00.000Z', '2026-10-04T00:00:00.000Z'),
  ('color_matte_black', 'matte-black', '__color_color_matte_black', 'Đen nhám', '#292929', 50, '2026-10-04T00:00:00.000Z', '2026-10-04T00:00:00.000Z');

INSERT OR IGNORE INTO sizes (id, code, name, sort_order, created_at, updated_at) VALUES
  ('size_small_5', 'small-5cm', 'Nhỏ (5cm)', 10, '2026-10-04T00:00:00.000Z', '2026-10-04T00:00:00.000Z'),
  ('size_medium_10', 'medium-10cm', 'Vừa (10cm)', 20, '2026-10-04T00:00:00.000Z', '2026-10-04T00:00:00.000Z'),
  ('size_diameter_10', 'diameter-10cm', 'Đường kính 10cm', 30, '2026-10-04T00:00:00.000Z', '2026-10-04T00:00:00.000Z'),
  ('size_standard', 'standard', 'Tiêu chuẩn', 40, '2026-10-04T00:00:00.000Z', '2026-10-04T00:00:00.000Z');

INSERT OR IGNORE INTO product_categories (id, code, name, sort_order, created_at, updated_at) VALUES
  ('category_custom', 'custom', 'Custom', 10, '2026-10-04T00:00:00.000Z', '2026-10-04T00:00:00.000Z'),
  ('category_gift', 'gift', 'Quà tặng', 20, '2026-10-04T00:00:00.000Z', '2026-10-04T00:00:00.000Z'),
  ('category_decor', 'decor', 'Trang trí', 30, '2026-10-04T00:00:00.000Z', '2026-10-04T00:00:00.000Z');

INSERT OR IGNORE INTO products (id, slug, name, description, category, status, base_price_vnd, image_key, created_at, updated_at) VALUES
  ('prod_chibi_custom', 'tuong-chibi-custom-theo-anh', 'Tượng Chibi Custom theo ảnh', 'Tượng chibi in 3D theo ảnh bạn cung cấp.', 'Custom', 'active', 350000, 'products/chibi-custom.jpg', '2026-10-04T00:00:00.000Z', '2026-10-04T00:00:00.000Z'),
  ('prod_moon_lamp', 'den-ngu-3d-mat-trang', 'Đèn ngủ 3D Mặt Trăng', 'Đèn ngủ 3D tạo ánh sáng ấm áp cho không gian.', 'Quà tặng', 'active', 250000, 'products/moon-lamp.jpg', '2026-10-04T00:00:00.000Z', '2026-10-04T00:00:00.000Z'),
  ('prod_keychain', 'moc-khoa-logo-doanh-nghiep', 'Móc khóa Logo Doanh Nghiệp in nổi', 'Móc khóa custom theo logo thương hiệu.', 'Custom', 'active', 45000, 'products/keychain.jpg', '2026-10-04T00:00:00.000Z', '2026-10-04T00:00:00.000Z'),
  ('prod_phone_stand', 'gia-do-dien-thoai-minimal', 'Giá đỡ điện thoại Minimal', 'Giá đỡ điện thoại gọn gàng, tối giản.', 'Trang trí', 'active', 85000, 'products/phone-stand.jpg', '2026-10-04T00:00:00.000Z', '2026-10-04T00:00:00.000Z');

INSERT OR IGNORE INTO product_variants (id, product_id, color_id, size_id, sku, price_vnd, stock_quantity, status, created_at, updated_at) VALUES
  ('var_chibi_white_5', 'prod_chibi_custom', 'color_white', 'size_small_5', 'CHIBI-WHITE-5', NULL, 100, 'active', '2026-10-04T00:00:00.000Z', '2026-10-04T00:00:00.000Z'),
  ('var_chibi_black_10', 'prod_chibi_custom', 'color_black', 'size_medium_10', 'CHIBI-BLACK-10', NULL, 100, 'active', '2026-10-04T00:00:00.000Z', '2026-10-04T00:00:00.000Z'),
  ('var_moon_warm_10', 'prod_moon_lamp', 'color_warm_white', 'size_diameter_10', 'MOON-WARM-10', NULL, 50, 'active', '2026-10-04T00:00:00.000Z', '2026-10-04T00:00:00.000Z'),
  ('var_keychain_black', 'prod_keychain', 'color_black_white', 'size_standard', 'KEYCHAIN-BLACK-STANDARD', NULL, 200, 'active', '2026-10-04T00:00:00.000Z', '2026-10-04T00:00:00.000Z'),
  ('var_phone_stand_black', 'prod_phone_stand', 'color_matte_black', 'size_standard', 'PHONE-STAND-BLACK-STANDARD', NULL, 0, 'active', '2026-10-04T00:00:00.000Z', '2026-10-04T00:00:00.000Z');

INSERT OR IGNORE INTO product_media (id, product_id, media_type, url, sort_order, created_at) VALUES
  ('media_gun1_1', 'prod_chibi_custom', 'image', '/img/gun1/g1.1.jpg', 0, '2026-10-11T00:00:00.000Z'),
  ('media_gun1_2', 'prod_chibi_custom', 'image', '/img/gun1/g1.2.jpg', 1, '2026-10-11T00:00:00.000Z'),
  ('media_gun1_3', 'prod_chibi_custom', 'image', '/img/gun1/g1.3.jpg', 2, '2026-10-11T00:00:00.000Z'),
  ('media_gun1_4', 'prod_chibi_custom', 'image', '/img/gun1/g1.4.jpg', 3, '2026-10-11T00:00:00.000Z'),
  ('media_gun2_1', 'prod_moon_lamp', 'image', '/img/gun2/g2.1.jpg', 0, '2026-10-11T00:00:00.000Z'),
  ('media_gun2_2', 'prod_moon_lamp', 'image', '/img/gun2/g2.2.jpg', 1, '2026-10-11T00:00:00.000Z'),
  ('media_gun2_3', 'prod_moon_lamp', 'image', '/img/gun2/g2.3.jpg', 2, '2026-10-11T00:00:00.000Z'),
  ('media_gun3_1', 'prod_keychain', 'image', '/img/gun3/g3.1.jpg', 0, '2026-10-11T00:00:00.000Z'),
  ('media_gun3_2', 'prod_keychain', 'image', '/img/gun3/g3.2.jpg', 1, '2026-10-11T00:00:00.000Z'),
  ('media_gun3_3', 'prod_keychain', 'image', '/img/gun3/g3.3.jpg', 2, '2026-10-11T00:00:00.000Z'),
  ('media_gun3_4', 'prod_keychain', 'image', '/img/gun3/g3.4.jpg', 3, '2026-10-11T00:00:00.000Z');
