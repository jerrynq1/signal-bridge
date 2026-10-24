# Gexadecimal – Order Flow Platform + Trading Journal

Một web chạy thuần trên trình duyệt (GitHub Pages), gồm hai nửa dùng chung một app, một giao diện và một đăng nhập Discord:

- **Chart / Orderflow** (từ ctrader-of): chart, Footprint, Big Trade, Statistic, Volume Profile, TPO, indicator, nhiều chart. Dữ liệu lấy trực tiếp từ **cTrader Open API** qua WebSocket.
- **Journal** (từ signal-bridge): Journal, Analytic, Flex Card, đồng bộ lệnh đã đóng từ **MT5** qua EA + Cloudflare Worker (D1), Xuất/Nhập CSV, Kết nối, Tải xuống, Mời cà phê.

Luồng: `index.html` (trang chủ) -> `login.html` (Discord) -> `app/index.html`. Sidebar có đủ: Chart, TPO Chart, TPO Setting, Indicator, Chart Setting, Journal, Analytic, Flex Card, Kết nối, Tải xuống, Mời cà phê. Mở app mặc định ở **Chart**; link thẳng được bằng hash, ví dụ `app/index.html#jr`.

## Cấu trúc

```
index.html, login.html, register.html, terms.html, maintenance.html   Trang chủ, đăng nhập Discord, điều khoản, bảo trì
faq.html + faq-data.js            Trang FAQ (3 ngôn ngữ, có tìm kiếm). faq-data.js là nguồn nội dung duy nhất: trang chủ chỉ hiện các câu có `home: 1`
worker.js                         Cloudflare Worker (D1): đăng nhập Discord + API Journal (dữ liệu theo từng người dùng) + proxy WebSocket /ct tới cTrader (giữ secret)
SignalBridge Journal.mq5          EA MT5: chỉ gửi lệnh đã đóng + số dư, KHÔNG vào lệnh
app/
  index.html                      App (chart + journal). Thứ tự nạp <script> RẤT quan trọng
  css/style.css, multichart.css   style.css = giao diện chart + phần Journal nối ở cuối
  js/config.js                    GX_CONFIG (API_URL Worker, bảo trì, link EA). Không còn chứa secret cTrader
  js/auth.js                      Phiên Discord, chặn khi chưa đăng nhập, đăng xuất
  js/api.js, dialog.js            Gọi Worker (biến JC = {url, token}); hộp thoại gxDialog
  js/connection-ui.js             Tab Kết nối (cTrader + MT5), sidebar, theme, nền sao
  js/journal-flexcard-sync.js     Journal, Analytic, Flex Card, đồng bộ MT5 (một khối)
  js/i18n-data.js + i18n-data-journal.js + i18n.js   Dịch Việt / English / 中文 (bảng của Journal được gộp vào bảng của chart)
  js/ctrader.js, chart.js, ...    Phần chart / orderflow như cũ
  tests/                          node app/tests/*.test.js
```

## Những điểm đã đổi khi gộp

- **Tên biến trùng**: `C` vẫn là {mã, khung giờ} của chart; cấu hình API Journal đổi thành `JC`. `why()` (lỗi cTrader) giữ nguyên, lỗi Worker dùng `jwhy()`.
- **Tab Kết nối** có hai thẻ: cTrader (chỉ còn nút kiểm tra: `cSave`, `cMsg`; không còn ô nhập secret) và MT5/Journal (id đổi thành `mUrl`, `mTok`, `mCopyUrl`, `mCopyKey`, `mShow`, `mSave`, `mNew`, `mDel`, `mMsg`).
- **Phải đăng nhập Discord** mới vào được cả chart (trước đây chart mở thẳng). Chart phụ (iframe `?cid=`) dùng chung phiên, không gọi lại server.
- `config.js` chỉ còn `window.GX_CONFIG` (login.html, maintenance.html dùng chung). `CT_CONFIG` đã bỏ.
- Đã bỏ `trading-journal-discord.zip` (bản đóng gói cũ của signal-bridge, trùng nội dung).
- **FAQ**: mục FAQ nhỏ ở trang chủ (6 câu) + trang riêng `faq.html` (29 câu, chia 4 nhóm, tìm không dấu, mở/thu gọn tất cả). Sửa nội dung ở `faq-data.js`, mỗi câu gồm `q` và `a` dạng `[Việt, English, 中文]`.
- Sau mỗi lần sửa file JS/CSS, đổi `?v=39` thành số mới trong `app/index.html`.

> **Bảo mật:** Client ID / Secret / Access Token cTrader chỉ nằm ở **secret của Worker** (xem bảng bên dưới), không bao giờ xuống trình duyệt và không có trong repo.

## Chạy

### 1. Tạo ứng dụng Discord
1. Vào https://discord.com/developers/applications > **New Application**.
2. Mục **OAuth2**: copy **Client ID** và **Client Secret**; thêm **Redirect URI**: `https://<worker-của-bạn>/auth/discord/callback` (phải trùng từng ký tự).
3. Trong Discord bật *Developer Mode* (User Settings > Advanced), chuột phải vào server > **Copy Server ID** = `DISCORD_GUILD_ID`. Muốn chỉ cho một nhóm vào thì copy thêm **Role ID**.
4. *(Tuỳ chọn, khuyên dùng)* Mục **Bot**: tạo bot, copy token, mời bot vào server (không cần quyền gì). Có bot thì ai rời/bị kick khỏi server sẽ bị chặn trong vòng 10 phút, kể cả EA của họ.

### 2. Worker (Cloudflare)
Dán `worker.js` vào Worker, gắn D1 database tên `DB`, rồi đặt các secret sau (bắt buộc: `DISCORD_CLIENT_SECRET`, `SESSION_SECRET`, `CT_CLIENT_ID`, `CT_CLIENT_SECRET`, `CT_ACCESS_TOKEN`):

| Secret | Ý nghĩa |
| --- | --- |
| `DISCORD_CLIENT_SECRET` | Lấy ở Discord Developer Portal > OAuth2 (Reset Secret) |
| `SESSION_SECRET` | Chuỗi ngẫu nhiên dài (≥ 32 ký tự) để ký phiên đăng nhập |
| `CT_CLIENT_ID` | Client ID của app cTrader (connect.spotware.com/apps) |
| `CT_CLIENT_SECRET` | Client Secret của app cTrader |
| `CT_ACCESS_TOKEN` | Access Token scope **Accounts** (chỉ xem). Hết hạn sau ~30 ngày: tạo lại rồi cập nhật secret này |
| `CT_ACCOUNT_ID` | *(tuỳ chọn)* `ctidTraderAccountId`; bỏ trống = tự lấy tài khoản đầu tiên khớp `CT_ENV`. Nên dùng tài khoản **demo** vì giá giống live |
| `CT_ENV` | *(tuỳ chọn)* `live` (mặc định) hoặc `demo`, phải khớp loại tài khoản của token |
| `DISCORD_ROLE_ID` | *(tuỳ chọn)* chỉ role này được vào; nhiều role cách nhau dấu phẩy |
| `DISCORD_BOT_TOKEN` | *(tuỳ chọn)* bật kiểm tra lại thành viên định kỳ |
| `SESSION_DAYS` | *(tuỳ chọn)* thời hạn phiên, mặc định 7 ngày |

Client ID và Server ID là thông tin công khai nên đã đặt sẵn trong `DEFAULTS` ở đầu `worker.js`. **`FRONTEND_URL` (địa chỉ web, không có `/` cuối) PHẢI đặt trên Cloudflare** (Settings > Variables), ví dụ `https://<user>.github.io/<repo>` khi đang test; sau khi đăng nhập Discord, Worker chuyển về `<FRONTEND_URL>/app/index.html`. Khi có domain riêng thì đổi biến này và thêm file `CNAME`.

Secret `TOKEN` cũ không còn dùng, có thể xoá. Bảng `users` được Worker tự tạo; bảng `trades` tự thêm cột `user_id`.

### 3. Web
Sửa `app/js/config.js` (khối `GX_CONFIG`): đặt `API_URL` là URL Worker (không có `/` cuối). Đẩy lên GitHub Pages như cũ.

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
- `terms.html` gồm **Phần A: Điều khoản sử dụng** (mục s1–s11) và **Phần B: Chính sách quyền riêng tư** (mục `data`, b2–b9; `#data` nhảy tới phần dữ liệu thu thập). Khi thêm tính năng thu thập/lưu dữ liệu mới (dịch vụ bên thứ ba, khoá localStorage, cột D1), nhớ cập nhật B1, B2, B4 và câu FAQ "Dữ liệu của tôi được lưu ở đâu?".
\1 (link cố định `/terms.html`, có 3 ngôn ngữ vi/en/zh; `#data` nhảy tới phần dữ liệu). Cửa sổ điều khoản ở `login.html` chỉ nhúng trang này vào, nên không phải sửa hai chỗ. Trang này không nạp Google Fonts. Mục 4 và 5 của điều khoản ghi rõ việc lưu bản ghi đồng ý và các dịch vụ bên thứ ba (Discord, Cloudflare, GitHub Pages, Google Fonts gửi IP sang Google).
- Khi sửa điều khoản: sửa `terms.html`, rồi đổi `TERMS_VERSION` ở **cả** `worker.js` và `login.html` (cùng giá trị, chỉ gồm chữ số và dấu `-`, ví dụ `2026-10-24-1`); hiển thị phiên bản ở đầu `terms.html` cũng sửa theo. Người dùng cũ sẽ bị đưa về trang đăng nhập để tích đồng ý lại (`/auth/me` trả `terms_ok:false`).
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

---

# Chart / Orderflow (cTrader)

## Lấy thông tin cTrader Open API (chỉ chủ web làm, một lần)

1. Vào https://connect.spotware.com/apps, đăng nhập bằng cTID, **Add new app** (Redirect URI điền `http://localhost` là được). Đợi app ở trạng thái Active nếu cần.
2. Mở app > lấy **Client ID** và **Client Secret** > đặt vào secret Worker `CT_CLIENT_ID`, `CT_CLIENT_SECRET`.
3. Vào tab **Playground** của app > chọn scope **Accounts** > **Get Token** > đăng nhập cTID, chọn tài khoản (nên là tài khoản **demo**) > copy **Access Token** > đặt vào `CT_ACCESS_TOKEN`. Token hết hạn sau khoảng 30 ngày; hết hạn thì thành viên sẽ thấy lỗi "server không nối được tới cTrader", bạn tạo token mới rồi cập nhật secret.
4. Tuỳ chọn: `CT_ACCOUNT_ID`, `CT_ENV` (xem bảng secret ở trên).

### Cách hoạt động (proxy `/ct` trong `worker.js`)
- Trình duyệt mở `wss://<worker>/ct`, gửi phiên Discord (`payloadType 9001`). Worker kiểm tra phiên + còn trong server, rồi tự đăng nhập cTrader bằng secret của chủ và trả `9002 {accountId}`. Sau đó giao thức giống trước đây.
- Worker **chỉ chuyển tiếp lệnh lấy dữ liệu thị trường** (`CT_UP_OK`: heartbeat, version, symbols, spots, trendbar, tick), luôn ép `ctidTraderAccountId` về tài khoản của chủ, và **không chuyển xuống** các sự kiện riêng của tài khoản (execution, margin, số dư...). Người dùng không đọc được tài khoản/lệnh của chủ và không đặt lệnh được.
- Chống lạm dụng: mỗi người tối đa 8 kết nối đồng thời (tính trong 1 isolate), tối đa 6 request lịch sử/giây/kết nối, phiên hết hạn hoặc bị đá khỏi server thì bị ngắt (kiểm 5 phút/lần).
- Mọi người dùng chung 1 app + 1 token của chủ, nên hạn mức của cTrader (vd 5 request lịch sử/giây/kết nối, số kết nối/app) là của chung.

## Cấu trúc phần chart

```
index.html                       Khung trang + danh sách file nạp (thứ tự nạp RẤT quan trọng)
css/style.css                    Giao diện
js/
  config.js                      API_URL Worker, bảo trì, link EA (không còn secret cTrader)
  core.js                        Tiện ích dùng chung ($, ld, sv, khung giờ) + dịch thông báo lỗi cTrader (why)
  timezone.js                    Múi giờ. cTrader trả UTC, app quy ra "giờ server New York close" (UTC+2/+3) để D1/W1 cắt đúng 17:00 NY
  ctrader.js                     TOÀN BỘ phần kết nối cTrader: WebSocket JSON, đăng nhập, nến M1, giá live, tick -> footprint
  chart.js                       Chart nến, tải M1, gộp khung giờ (kể cả khung tuỳ chọn + khung giây dựng từ tick), cập nhật live (poll() 250ms)
  candle-style.js                Màu nến, đường Bid/Ask
  indicators-defs.js             Kho indicator
  indicators-engine.js           Dựng pane, hộp cài đặt
  connection-ui.js               Tab Kết nối, sidebar, theme, nền sao
  init.js                        Khởi động app
  drawings-*.js, volume-profile.js, orderflow-*.js, mobile.js, i18n*.js   như cũ
```

## Dữ liệu lấy như thế nào

- **Nến M1**: `ProtoOAGetTrendbarsReq`, tải THEO NHU CẦU: mở chart chỉ tải ~1 ngày gần nhất, kéo chart sang trái tới đâu thì tự tải thêm nến cũ tới đó (không còn ô "số ngày"). Nến live: `ProtoOASubscribeLiveTrendbarReq` (nếu server không gửi thì app tự dựng nến từ bid).
- **Giá Bid/Ask live**: `ProtoOASubscribeSpotsReq`.
- **Footprint / Big Trade / Statistic**: `ProtoOAGetTickDataReq` (tick bid + ask). cTrader (forex/CFD) không có tape giao dịch thật nên đây là **ước lượng** từ chuỗi báo giá, theo quy tắc cố định, dùng chung cho lịch sử và live (xem comment đầu phần footprint trong `ctrader.js`):
  1. Mỗi lần bid hoặc ask đổi = 1 đơn vị khối lượng (tick volume). Báo giá không đổi hoặc lỗi (ask < bid) bị bỏ.
  2. Hướng: ask/bid cùng tăng (hoặc một bên tăng) = **mua**; cùng giảm = **bán**. Spread nở/co thì xét hướng dịch của giá giữa (mid); mid không đổi thì giữ hướng cũ.
  3. Giá đặt: **mua ở Ask, bán ở Bid**.
  4. Các sự kiện cùng mili-giây gộp làm 1 (lấy bid/ask cuối).
  5. Mỗi cửa sổ lịch sử nạp thêm 5 phút phía trước để có sẵn trạng thái bid/ask/hướng (không mất tick đầu cửa sổ), phần đó không được cộng vào số liệu.
  6. Gộp hàng giá bằng số nguyên (đơn vị 1/100000): hàng q phủ `[q×bước, (q+1)×bước)`, không sai số số thực ở biên hàng (`fpQ` trong `orderflow-footprint.js`).
  7. POC hòa thì lấy hàng gần giữa nến; Value Area theo phương pháp CME (so tổng 2 hàng trên với 2 hàng dưới); Imbalance chéo kèm lọc volume tối thiểu và Stacked imbalance.
  Nếu broker không lưu đủ tick lịch sử, góc chart sẽ báo % số phút có dữ liệu.
- **Volume Profile**: tổng volume mỗi phút lấy từ tick volume của nến M1. Phân bổ vào từng mức giá: (1) theo footprint thật từ tick nếu phút đó đã được tải (bật Footprint / Big Trade / Statistic), giá mua quy về hệ Bid bằng spread trung bình của phút; (2) nếu không có tick thì theo đường đi của giá trong nến (tăng O→L→H→C, giảm O→H→L→C), đoạn lên là Ask, đoạn xuống là Bid. Hàng giá tính bằng số nguyên, POC hòa thì lấy hàng gần giữa, Value Area theo CME. Góc profile ghi nguồn dữ liệu (Tick xx% / M1).
- Giới hạn của cTrader: 5 request lịch sử / giây (app tự giãn nhịp; nến M1 và tick có làn riêng nên tick không chặn nến), lịch sử tick chỉ có trong một số ngày gần đây tuỳ broker. Tick footprint cũng tải theo vùng đang xem (kéo chart tới đâu tải tới đó), có trần an toàn 3 ngày gần nhất (`FP_MAXD` trong `orderflow-footprint.js`) vì tick rất nặng.
- Không còn lưu trữ D1/R2: mỗi lần mở trang sẽ tải lại từ cTrader.

## Khi sửa file về sau

- Sau mỗi lần sửa, đổi `?v=` (hiện là 39) sang số mới trong `app/index.html` để trình duyệt tải lại file mới.
- **Không đổi thứ tự** các dòng `<script>` (các file dùng chung biến toàn cục).
- Tránh đặt tên biến trùng với tên đã có ở file khác (hai file khai báo cùng một `const` sẽ làm file sau không chạy).

## Kiểm thử logic footprint

`node app/tests/footprint.test.js` chạy các kiểm tra không cần mạng (phân loại hướng, phân trang tick, lịch sử = live, gộp hàng, POC/VA/Imbalance).

## Khi lỗi

Bấm **F12 > Console**. Thanh trạng thái trên chart hiện lý do (phiên hết hạn, server không nối được cTrader do token của chủ hết hạn, sai tên mã, mạng chặn `wss://live.ctraderapi.com:5036`...).

## Chống đơ giá (v15)

- Statistic cache số liệu theo từng nến, mỗi tick live chỉ tính lại nến cuối (trước: tính lại toàn bộ lịch sử mỗi 250ms).
- Nến M1 và tick footprint đi hai làn riêng (chung giới hạn 5 req/s), tick tải nặng không còn chặn việc đổi mã / khung / tải nến.
- Watchdog (`ctWatch` trong `ctrader.js`): im > 20s thì thăm dò, không trả lời thì tự nối lại; có kết nối mà > 60s không có giá thì đăng ký lại spot. Tab hiện lại / có mạng lại cũng kiểm tra ngay.
- Chạy kiểm tra: `node app/tests/footprint.test.js && node app/tests/connection.test.js && node app/tests/tpo.test.js`
- Nến live (v16): mỗi tick bid kéo high/low/close của nến phút hiện tại, không phụ thuộc server có gửi trendbar hay không. Chỉ báo cập nhật tối đa ~3 lần/giây.
- Chart đứng thì mở Console (F12) gõ `ctDiag()` để xem đang kẹt ở đâu.
- v17: tự bù nến M1 bị thiếu khi tab ẩn / máy ngủ / mạng chập (`catchUp` trong `chart.js`); cache số liệu của nến đã đóng kiểm tra thêm chữ ký dữ liệu (`fpSigOk`) nên không giữ số liệu cũ khi phút cuối được chốt muộn.

## Thêm nhiều chart (v18)

- Nút **Thêm chart** nằm ngay dưới chart chính. Mỗi lần bấm thêm 1 chart phụ (mặc định cùng mã, khung giờ lớn hơn 1 bậc để xem đa khung). Tối đa 4 chart phụ trên máy tính, 3 trên điện thoại (mỗi chart mở thêm 1 kết nối + luồng dữ liệu riêng).
- Mỗi chart phụ là **bản đầy đủ của app** (footprint, big trade, statistic, volume profile, indicator, công cụ vẽ) chạy trong iframe cùng origin: `index.html?cid=<id>&sym=..&tf=..` (xem `app/js/multichart.js`, `app/js/embed.js`).
- Mã, khung giờ, indicator, hình vẽ của từng chart lưu riêng (hậu tố `_<cid>` trong localStorage, xem `PERCH` trong `core.js`). Theme, múi giờ, màu nến, ngôn ngữ, thông tin kết nối dùng chung và đồng bộ ngay giữa các chart qua sự kiện `storage`.
- Thẻ chart phụ có: đổi thứ tự (↑ ↓), toàn màn hình (Esc để thoát), xoá (bấm 2 lần), kéo thanh dưới thẻ để đổi chiều cao. Nút 1 cột / 2 cột chỉ hiện trên màn hình rộng.
- Trên điện thoại: chạm vào vùng chart là thao tác chart (không cuộn trang), muốn cuộn trang thì vuốt ở thanh tiêu đề thẻ hoặc khoảng trống giữa các thẻ.

## Khung giờ tuỳ chọn (v25)

- Cạnh các nút M1…W1 có nút **+**: nhập số + đơn vị (**Giây / Phút / Giờ / Ngày / Tuần**) rồi bấm *Dùng khung này*. Ví dụ 7 phút, 90 phút, 2 giờ, 3 ngày, 15 giây. Khung mới được lưu thành nút riêng (có dấu **×** để xoá), tối đa 8 khung tuỳ chọn, tối đa 4 tuần.
- Danh sách khung tuỳ chọn lưu ở `localStorage` key `tp_ctf` và **dùng chung cho mọi chart** (chart chính + chart phụ, đồng bộ ngay qua sự kiện `storage`); khung đang chọn của từng chart vẫn lưu riêng (`tp_tf` / `tp_tf_<id>`). Chart phụ cũng có nút **+** riêng trên thanh khung giờ của nó.
- **Từ 60 giây trở lên (bội số của 60s):** dựng từ nến M1 như các khung thường. Nến gom theo mốc epoch (giờ server): 7 phút, 90 phút, 3 ngày... Tuần và bội số của tuần neo vào thứ Hai như W1.
- **Dưới 60 giây (1–59 giây):** cTrader không có nến nhỏ hơn M1 nên app dựng từ **tick bid** (`ctTicks` + báo giá live trong `ctSpot` -> `sbLive`, xem cuối `app/js/chart.js`). Volume = số lần bid đổi giá. Tick tải theo nhu cầu: lần đầu 30 phút gần nhất, kéo chart sang trái thì tải thêm, tối đa 24 giờ lịch sử.
- Giới hạn khung giây: Footprint / Big Trade / Statistic cần dữ liệu theo phút nên **không chạy** trên khung < M1 (app báo ở thanh trạng thái). Indicator thường, công cụ vẽ, Bid/Ask line vẫn dùng bình thường. Đổi từ khung giây về khung phút thì app tự tải lại nến M1.
- Test: `node app/tests/customtf.test.js`.

## Chọn / dời hình vẽ trên cảm ứng (v26)

- Trên điện thoại, **chạm xuống không còn chọn hay kéo hình**: kéo / zoom chart mà lỡ chạm vào hình (nhất là Volume Profile) thì hình đứng yên.
- **Chọn hình:** chạm nhẹ (nhấc tay nhanh, không di chuyển, không có ngón thứ 2) lên hình. Volume Profile chỉ chọn khi chạm đúng phần hiển thị, không chọn cả khung.
- **Dời cả hình:** chọn hình trước, rồi giữ yên ngón tay trên hình ~0,3 giây (máy rung nhẹ) rồi kéo. Nút tròn (điểm neo) của hình đang chọn vẫn kéo được ngay.
- **Bỏ chọn:** chạm nhẹ vào chỗ trống. Kéo / zoom chart không làm mất chọn.
- Chuột trên máy tính giữ nguyên như cũ. Code: `tpStart` / `cancelTp` trong `app/js/drawings-interact.js`.

## Toàn màn hình chart (v27)

- Sửa lỗi "hình mờ": khi toàn màn hình, thanh công cụ (mã, khung giờ, Indicator, Bid/Ask) và chart phụ phía sau lộ ra mờ mờ và vẫn bấm được vì nền thẻ chart bị `style.css` làm trong suốt. Giờ nền đặc và các phần phía sau bị ẩn hẳn khi đang toàn màn hình (CSS trong `app/js/mobile.js`, các rule `body.cfs ...`).
- **Máy tính:** có nút toàn màn hình ở góc trên bên phải chart (cạnh trục giá). Bấm vào sẽ vào toàn màn hình thật của trình duyệt (Fullscreen API). Thoát bằng nút **X** ở thanh trên, phím **Esc**, hoặc nút Back. Khung giờ đổi được ngay trên thanh trên khi toàn màn hình.
- Điện thoại: giữ nguyên cụm nút nổi (có nút toàn màn hình) như cũ.

## Chống đứng chart (v19)

Lỗi cũ: Bid/Ask vẫn nhảy nhưng nến + footprint đứng im. Nguyên nhân: `poll()` ghi Bid/Ask ra màn hình rồi mới cập nhật nến, nên chỉ cần 1 bước phía sau ném lỗi (vẽ đường Bid/Ask, `cs.update` lệch thời gian, tính chỉ báo...) hoặc cờ `loading` bị kẹt thì phần còn lại dừng hẳn.

- `poll()` tách từng bước có `try/catch` riêng; lỗi chỉ ghi log (`CHW.err`), không chặn bước sau. `applyLive` tự dựng lại chart khi `cs.update` lỗi, `render()` lớp phủ lỗi sẽ tự thử lại.
- `chartWatch()` phát hiện "có giá bid mới nhưng nến > 6s không được cập nhật" và khôi phục theo cấp: dựng lại (6s) -> bù nến M1 (15s) -> tải lại (30s). Cờ `loading` kẹt quá 90s cũng tự tải lại. Thanh trạng thái báo "Chart chậm cập nhật…" khi đang khôi phục.
- Nến live của phút đang chạy kế thừa open/high/low/volume thật từ lịch sử (trước đó có thể bị thay bằng nến chỉ có 1 giá sau khi tải lại).
- Gõ `ctDiag()` trong Console khi chart đứng: có thêm `chartChoApDung_s`, `loiGanNhat`, `capHoiPhuc`.


## TPO Daily / Weekly / Session và nhiều TPO chart (v39)

- **Loại profile** chọn nhanh trên thanh công cụ tab TPO Chart (ô chọn cạnh nút Live) hoặc ở tab **TPO Setting > Dữ liệu > Loại profile**:
  - **Daily**: mỗi ngày server (cắt 17:00 New York) một profile, như cũ.
  - **Weekly**: mỗi tuần một profile (thứ Hai – thứ Sáu theo giờ server, tuần bắt đầu như W1), không có Initial Balance. Chu kỳ mỗi ô mặc định 240 phút, số tuần hiển thị 1–8.
  - **Session**: mỗi ngày chia **3 phiên Asia / London / New York**, mỗi phiên một profile riêng (POC, Value Area, Single Print, Delta... tính riêng). 3 phiên của cùng một ngày được vẽ **trong một khung** có nhãn ngày, tên phiên nằm dưới từng profile. Giờ bắt đầu phiên tính theo giờ server: Asia từ 00:00, London từ **9** (≈ 07:00 UTC), New York từ **15** (≈ 13:00 UTC), chỉnh được ở TPO Setting (London phải nhỏ hơn New York, sai thì tự về 9 / 15). Chu kỳ mỗi ô mặc định 30 phút, Initial Balance = giờ đầu của phiên.
- Kích thước hàng giá tự động tính theo loại (≈ 70 hàng cho ngày, 120 cho tuần, 40 cho một phiên); đặt tay ở "Kích thước hàng giá" nếu muốn.
- **Thêm TPO chart**: nút nằm dưới chart ở tab TPO Chart, làm giống "Thêm chart": tối đa 4 TPO phụ (3 trên điện thoại), mỗi cái là một iframe `index.html?cid=<id>&v=tpo` có **mã và cài đặt TPO riêng** (lưu `tp_tpo_<id>`, khởi đầu bằng cài đặt TPO của chart chính), nên có thể xem Daily, Weekly và Session cạnh nhau. Ô chọn mã nằm ngay trên thanh công cụ của từng TPO phụ; danh sách lưu ở `tp_mct`. Đổi thứ tự, toàn màn hình, xoá (bấm 2 lần), kéo đổi chiều cao như chart phụ.
- Code: `tpoGroup` / `tpoNorm` (gom nến theo loại) và khung ngày ở `tpoPaint` trong `js/tpo.js`; `js/multichart.js` chạy hai lần (`mcInit`) cho chart và TPO. Test: `node app/tests/tpo.test.js`.


---

# Bản quyền & DMCA

- Mã nguồn **độc quyền, All rights reserved** (xem `LICENSE`). Mỗi file JS/CSS/worker/EA có dòng bản quyền ở đầu, chân trang web có dòng © và chỗ gắn huy hiệu DMCA.
- Nhớ điền email liên hệ trong `LICENSE` và đổi tên chủ sở hữu "Gexadecimal" thành tên pháp lý của bạn nếu khác.
- Điều khoản sử dụng (`terms.html`) chưa có điều khoản sở hữu trí tuệ riêng. Nếu thêm, phải đổi `TERMS_VERSION` ở cả `worker.js` và `login.html` (mọi người sẽ phải đồng ý lại).

## Đăng ký DMCA.com và gắn huy hiệu
1. Vào https://www.dmca.com, đăng ký tài khoản (gói **Free** có huy hiệu).
2. Thêm website: nhập địa chỉ web của bạn (địa chỉ Pages / domain chính thức).
3. Chọn kiểu huy hiệu, DMCA.com sẽ cho một **đoạn mã HTML** (có ID riêng của bạn).
4. Dán đoạn mã đó vào `index.html` và `login.html`, ngay chỗ có comment `DMCA_BADGE` trong `<footer>`. Nếu muốn có ở cả trong app thì dán thêm vào `app/index.html`.
5. Deploy lại, mở web kiểm tra huy hiệu hiện ra và bấm vào thấy trang trạng thái của DMCA.com.
6. Khi phát hiện bị chép: gom bằng chứng (link bản chép, ảnh chụp, lịch sử commit của bạn), tìm nhà cung cấp hosting/GitHub của bên kia và gửi DMCA takedown notice.
