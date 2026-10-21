/* Cấu hình chung (cả login.html và app dùng): địa chỉ Cloudflare Worker, không có dấu / ở cuối. */
window.GX_CONFIG = {
  API_URL: "https://signal-bridge.nguyenhuy5a10.workers.dev",
  /* Link tải EA (trang chủ + mục Tải xuống trong app). Để trống thì hiện "Link tải sẽ được cập nhật sớm". */
  DOWNLOAD_URL: "",
  /* BẢO TRÌ: true = sau khi đăng nhập sẽ bị chuyển sang maintenance.html thay vì vào app.
     Muốn mở app cho mọi người: đổi true thành false (xem README). */
  MAINTENANCE: true,
  /* Discord ID của những người vẫn được vào app khi đang bảo trì (ví dụ chính bạn để test), dạng chuỗi: ["123456789012345678"] */
  MAINTENANCE_ALLOW: ["889713051631239189"]
};
