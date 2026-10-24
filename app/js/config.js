/* Cấu hình chung (cả login.html và app dùng): địa chỉ Cloudflare Worker, không có dấu / ở cuối. */
window.GX_CONFIG = {
  API_URL: "https://signal-bridge.nguyenhuy5a10.workers.dev",
  /* Link tải EA (trang chủ + mục Tải xuống trong app). Để trống thì hiện "Link tải sẽ được cập nhật sớm". */
  DOWNLOAD_URL: "https://cdn.discordapp.com/attachments/1562048806546047042/1563512546202493038/SignalBridge_Journal.mq5?ex=6adde607&is=6adc9487&hm=81ca7d6993b4c4a2b57cd8e969183e07876258417c127d28f02faddb946443d5&",
  /* BẢO TRÌ: true = sau khi đăng nhập sẽ bị chuyển sang maintenance.html thay vì vào app.
     Muốn mở app cho mọi người: đổi true thành false (xem README). */
  MAINTENANCE: true,
  MAINTENANCE_ALLOW: ["889713051631239189"],
  MAINTENANCE_KEY: "jerrynq1"
};


