export const ORDER_STATUS_LABELS: Record<string, string> = {
  received: 'Đã nhận đơn',
  confirmed: 'Đã xác nhận',
  preparing: 'Đang chuẩn bị',
  packing: 'Đóng gói',
  shipping: 'Đang giao hàng',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
}

export const ORDER_STATUS_FLOW: Record<string, string[]> = {
  received: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['packing', 'cancelled'],
  packing: ['shipping'],
  shipping: ['completed'],
  completed: [],
  cancelled: [],
}
