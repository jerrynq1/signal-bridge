# Gexadecimal – Trading Journal

Web nhật ký giao dịch chạy thuần trên trình duyệt (GitHub Pages), đồng bộ lệnh từ MT5. Không cần build.

Mở web lên là vào **trang chủ** (`index.html`). Đăng nhập bằng Discord xong sẽ chuyển sang **app** (`app/index.html`), mặc định mở ở **Journal**.

## Cấu trúc

```
index.html, login.html, register.html, terms.html   Trang chủ giới thiệu Trading Journal + đăng nhập Discord (register.html chỉ chuyển về login)
app/
  index.html                            App: Journal, Analytic, Flex Card, Kết nối
  css/style.css
  js/config.js                          Cấu hình API_URL (dùng cho cả login.html)
  js/auth.js                            Phiên đăng nhập Discord, chặn khi chưa đăng nhập, đăng xuất
  js/core.js                            Tiện ích, trạng thái kết nối
  js/api.js                             Gọi API Cloudflare Worker (kèm phiên đăng nhập)
  js/dialog.js                          Hộp thoại riêng của app (gxDialog) thay confirm/alert của trình duyệt
  js/connection-ui.js                   Sidebar, theme, trang Kết nối, nền sao
  js/journal-flexcard-sync.js           Journal, Analytic, Flex Card, đồng bộ MT5 (một khối)
  js/init.js                            Khởi động, mở Journal mặc định
  js/i18n-data.js, js/i18n.js           Dịch Việt / English / 中文
worker.js                               Cloudflare Worker (D1) – đăng nhập Discord + API cho Journal, dữ liệu theo từng người dùng
SignalBridge Journal.mq5                EA MT5 – chỉ gửi lệnh đã đóng + số dư, KHÔNG vào lệnh
archive/                                Bản ĐẦY ĐỦ cũ (chart, indicator, EA Setting, đặt lệnh...) để dùng lại sau
```

Thứ tự nạp `<script>` trong `app/index.html` quan trọng (các file dùng chung biến toàn cục).

## Chạy

### 1. Tạo ứng dụng Discord
1. Vào https://discord.com/developers/applications > **New Application**.
2. Mục **OAuth2**: copy **Client ID** và **Client Secret**; thêm **Redirect URI**: `https://<worker-của-bạn>/auth/discord/callback` (phải trùng từng ký tự).
3. Trong Discord bật *Developer Mode* (User Settings > Advanced), chuột phải vào server > **Copy Server ID** = `DISCORD_GUILD_ID`. Muốn chỉ cho một nhóm vào thì copy thêm **Role ID**.
4. *(Tuỳ chọn, khuyên dùng)* Mục **Bot**: tạo bot, copy token, mời bot vào server (không cần quyền gì). Có bot thì ai rời/bị kick khỏi server sẽ bị chặn trong vòng 10 phút, kể cả EA của họ.

### 2. Worker (Cloudflare)
Dán `worker.js` vào Worker, gắn D1 database tên `DB`, rồi đặt **2 secret**:

| Secret | Ý nghĩa |
| --- | --- |
| `DISCORD_CLIENT_SECRET` | Lấy ở Discord Developer Portal > OAuth2 (Reset Secret) |
| `SESSION_SECRET` | Chuỗi ngẫu nhiên dài (≥ 32 ký tự) để ký phiên đăng nhập |
| `DISCORD_ROLE_ID` | *(tuỳ chọn)* chỉ role này được vào; nhiều role cách nhau dấu phẩy |
| `DISCORD_BOT_TOKEN` | *(tuỳ chọn)* bật kiểm tra lại thành viên định kỳ |
| `SESSION_DAYS` | *(tuỳ chọn)* thời hạn phiên, mặc định 7 ngày |

Client ID, Server ID và địa chỉ web là thông tin công khai nên đã đặt sẵn trong `DEFAULTS` ở đầu `worker.js` (muốn đổi thì sửa ở đó hoặc thêm biến `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`, `FRONTEND_URL` trên Cloudflare).

Secret `TOKEN` cũ không còn dùng, có thể xoá. Bảng `users` được Worker tự tạo; bảng `trades` tự thêm cột `user_id`.

### 3. Web
Sửa `app/js/config.js`: đặt `API_URL` là URL Worker (không có `/` cuối). Đẩy lên GitHub Pages như cũ.

### 4. Mỗi thành viên
1. Vào web > **Đăng nhập bằng Discord** (phải ở trong server).
2. Vào mục **Kết nối**, copy **API URL** và **EA key** của riêng mình.
3. Biên dịch `SignalBridge Journal.mq5`, thêm URL Worker vào *Tools > Options > Expert Advisors > Allow WebRequest*, nhập `InpApiUrl` và `InpToken` (= EA key). Journal tự đồng bộ lệnh đã đóng mỗi 15 giây.

EA key là bí mật của từng người; lộ key thì bấm **Tạo key mới** ở mục Kết nối. Hộp thoại sẽ hỏi có muốn tải dữ liệu cũ xuống (CSV) không:
- **Xoá & tạo key mới**: key cũ ngừng hoạt động ngay, đồng thời xoá các lệnh MT5 đã đồng bộ (trên server và trình duyệt này). Đổi key và xoá chạy chung một batch D1 nên không bị nửa vời.
- **Huỷ** (hoặc Esc / bấm ra ngoài): không làm gì, key cũ vẫn dùng được.

### Xoá tài khoản
Mục **Kết nối** có nút **Xoá tài khoản** (cuối thẻ). Bấm vào sẽ hiện hai bước xác nhận, bước đầu có nút tải CSV để giữ lại dữ liệu:
- Worker `POST /auth/delete-account` (bắt buộc body `{"confirm":true}`) xoá `trades`, `quote` và `users` của chính người đó trong **một batch D1**, nên không bị xoá nửa vời. EA key và phiên cũ vô hiệu ngay.
- Chỉ sau khi server xác nhận, trình duyệt mới xoá `tjp_data`, `tjp_sync` của tài khoản này rồi đăng xuất.
- Lưu ý: nếu người đó vẫn ở trong server Discord, đăng nhập lại sẽ tạo tài khoản mới trống với EA key mới. Muốn chặn hẳn thì admin gỡ role hoặc kick khỏi server. Sau khi xoá, cần gỡ EA khỏi MT5 hoặc đổi lại key để không gửi lỗi 401 liên tục.
- Cần deploy lại `worker.js`; không cần đổi schema D1.

### Ghi nhận đồng ý Điều khoản
- `login.html` gửi phiên bản điều khoản đã tích đồng ý lên Worker (`/auth/discord/login?terms=<phiên bản>`); Worker từ chối nếu không khớp `TERMS_VERSION`, rồi ghi `terms_version` + `terms_at` vào bảng `users` và một dòng vào bảng `consents` (lịch sử mỗi lần đồng ý phiên bản mới). Bảng/cột tự tạo khi Worker chạy.
- Nội dung điều khoản nằm ở **một nơi duy nhất**: `terms.html` (link cố định `/terms.html`, có 3 ngôn ngữ vi/en/zh; `#data` nhảy tới phần dữ liệu). Cửa sổ điều khoản ở `login.html` chỉ nhúng trang này vào, nên không phải sửa hai chỗ. Trang này không nạp Google Fonts. Mục 4 và 5 của điều khoản ghi rõ việc lưu bản ghi đồng ý và các dịch vụ bên thứ ba (Discord, Cloudflare, GitHub Pages, Google Fonts gửi IP sang Google).
- Khi sửa điều khoản: sửa `terms.html`, rồi đổi `TERMS_VERSION` ở **cả** `worker.js` và `login.html` (cùng giá trị, chỉ gồm chữ số và dấu `-`, ví dụ `2026-10-20-2`); hiển thị phiên bản ở đầu `terms.html` cũng sửa theo. Người dùng cũ sẽ bị đưa về trang đăng nhập để tích đồng ý lại (`/auth/me` trả `terms_ok:false`).
- Tài khoản tạo trước khi có tính năng này chưa có `terms_version`, nên lần mở app tiếp theo sẽ phải đồng ý một lần.
- Xoá tài khoản cũng xoá luôn các dòng `consents` của người đó.
- Xem ai đã đồng ý bản nào: `SELECT user_id, version, datetime(accepted_at/1000,'unixepoch') FROM consents ORDER BY accepted_at DESC;`

### Xuất / Nhập CSV
Ở trang Journal: **Xuất CSV** tải toàn bộ lệnh (mọi tài khoản) ra file UTF-8 mở được bằng Excel; **Nhập CSV** đọc lại file đó (tự nhận dấu `,` `;` hoặc tab). Cột bắt buộc: `date` (YYYY-MM-DD), `symbol`, `side` (Long/Short/Buy/Sell), `pnl`. Lệnh trùng `id` bị bỏ qua, dòng sai định dạng bị bỏ qua và được báo lại; tối đa 5 MB / 20.000 dòng. Có bước xem trước và xác nhận trước khi nhập.

### API của Worker
- Đăng nhập: `GET /auth/discord/login`, `GET /auth/discord/callback`, `GET /auth/me`, `POST /auth/regen-key`
- Journal (header `Authorization: Bearer <phiên>`): `GET /api/health`, `GET /api/trades`, `GET /api/quote`
- EA (header `X-Token: <EA key>`): `POST /api/ea/deals`, `POST /api/ea/quote`

## Chế độ bảo trì (chưa công bố app)

`maintenance.html` là trang "Đang bảo trì". Bật/tắt trong `app/js/config.js`:

```js
MAINTENANCE: true,        // true = sau đăng nhập bị chuyển sang maintenance.html; false = vào app bình thường
MAINTENANCE_ALLOW: []     // Discord ID được vào app dù đang bảo trì, ví dụ ["123456789012345678"]
```

**Tháo bảo trì:** đổi `MAINTENANCE: true` thành `MAINTENANCE: false`, đẩy `config.js` lên GitHub Pages rồi Ctrl+F5. Ai mở `maintenance.html` lúc đó cũng được đưa thẳng vào app. Không cần xoá file nào.

Lưu ý: đây là chuyển hướng ở phía trình duyệt. Dữ liệu vẫn được Worker bảo vệ bằng phiên đăng nhập, nhưng muốn chặn thật việc đăng nhập thì đặt `DISCORD_ROLE_ID` trên Worker.

## Đăng nhập

Chỉ đăng nhập bằng Discord, và chỉ thành viên server (và role nếu có đặt `DISCORD_ROLE_ID`) mới vào được. Mỗi tài khoản Discord có journal, số dư và EA key riêng: Worker lưu lệnh theo `user_id`, web lưu dữ liệu local theo từng tài khoản (`tjp_data:<discord id>`).

`app/js/auth.js` giữ phiên (localStorage `gx_session`) và đưa về `login.html` khi chưa đăng nhập. Phần bảo vệ thật nằm ở Worker: không có phiên hợp lệ thì không đọc được lệnh nào. `register.html` chỉ còn là trang chuyển hướng về `login.html`.

### Chuyển dữ liệu cũ (nếu trước đó đã có lệnh trong D1)
Các lệnh cũ chưa thuộc ai (`user_id` rỗng) nên sẽ không hiện. Gán cho chủ cũ (thay `<discord id>` bằng ID Discord của người đó, sau khi người đó đã đăng nhập một lần):
```sql
UPDATE trades SET id = '<discord id>-' || id, user_id = '<discord id>' WHERE user_id IS NULL;
```
Dữ liệu journal lưu local trong trình duyệt tự được chuyển sang tài khoản đăng nhập đầu tiên trên trình duyệt đó.

## Khôi phục bản đầy đủ

Xem `archive/README.md`.
