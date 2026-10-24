// © 2026 Gexadecimal. All rights reserved. Mã nguồn độc quyền, xem file LICENSE. Không được sao chép, sửa đổi hay phân phối lại khi chưa có sự cho phép bằng văn bản.
// Gexadecimal Trading Journal API – Cloudflare Worker + D1 (đăng nhập Discord, mỗi thành viên một journal riêng)
//
// Binding bắt buộc : DB (D1 database)
// Secret bắt buộc  : DISCORD_CLIENT_SECRET, SESSION_SECRET   (chỉ 2 cái này là bí mật thật, KHÔNG ghi vào code)
// Đã đặt sẵn trong code (là thông tin công khai, xem DEFAULTS bên dưới): DISCORD_CLIENT_ID, DISCORD_GUILD_ID, FRONTEND_URL
//   -> muốn đổi thì chỉ cần thêm biến cùng tên trên Cloudflare, giá trị trên Cloudflare sẽ ghi đè.
// Secret tuỳ chọn  : DISCORD_ROLE_ID   (chỉ cho role này vào; nhiều role cách nhau dấu phẩy)
//                    DISCORD_BOT_TOKEN (bot trong server, dùng kiểm tra lại thành viên mỗi 10 phút để đá người đã rời/bị kick)
//                    SESSION_DAYS      (thời hạn phiên đăng nhập, mặc định 7 ngày)
//                    MAINTENANCE, MAINTENANCE_ALLOW (bảo trì phía server)
// Dữ liệu giá cTrader (Worker giữ secret, trình duyệt KHÔNG bao giờ thấy):
//   Secret bắt buộc : CT_CLIENT_ID, CT_CLIENT_SECRET, CT_ACCESS_TOKEN   (app + token của chủ; token chỉ cần scope Accounts)
//   Tuỳ chọn        : CT_ACCOUNT_ID (ctidTraderAccountId; bỏ trống = tự lấy tài khoản đầu tiên khớp CT_ENV), CT_ENV ("live" mặc định hoặc "demo")
//   GET /ct (WebSocket) proxy tới cTrader Open API: client gửi payloadType 9001 {token:<phiên Discord>} rồi chỉ được gửi các lệnh lấy dữ liệu thị trường
//
// Đăng nhập (web):
//   GET  /auth/discord/login?terms=<phiên bản>   chuyển sang Discord (bắt buộc đúng TERMS_VERSION, nếu không báo lỗi "terms")
//   GET  /auth/discord/callback   Discord gọi về; kiểm tra có trong server không, rồi chuyển về web kèm phiên
//   GET  /auth/me                 thông tin tài khoản + EA key của chính mình       (Authorization: Bearer <phiên>)
//   POST /auth/regen-key          tạo EA key mới (key cũ ngừng hoạt động); body {"wipe":true} = xoá luôn journal cũ trên server (Authorization: Bearer <phiên>)
//   POST /auth/delete-account    xoá HẲN tài khoản + toàn bộ dữ liệu trên server; body {"confirm":true} bắt buộc (Authorization: Bearer <phiên>)
// Journal (web, cần phiên):
//   GET  /api/health | /api/trades?since=<ms>&limit=500 | /api/quote
// EA MT5 (dùng EA key riêng của từng người trong header X-Token):
//   POST /api/ea/deals | /api/ea/quote

const enc = new TextEncoder();
const CHECK_MS = 10 * 60 * 1000;
// Phiên bản Điều khoản hiện hành. Khi sửa nội dung điều khoản: đổi giá trị này VÀ TERMS_VERSION trong login.html
// -> mọi người dùng cũ sẽ bị yêu cầu đăng nhập lại và tích đồng ý lần nữa.
const TERMS_VERSION = "2026-10-24-1";   // phải trùng login.html và terms.html

// Giá trị CÔNG KHAI nên để sẵn ở đây cho đỡ phải nhập trên Cloudflare
const DEFAULTS = {
  DISCORD_CLIENT_ID: "1562015837739683850",
  DISCORD_GUILD_ID: "1562048805522903062",
  FRONTEND_URL: "https://www.gexadecimal.dev",
};
const KEYS = ["DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "DISCORD_GUILD_ID", "DISCORD_ROLE_ID", "DISCORD_BOT_TOKEN", "SESSION_SECRET", "SESSION_DAYS", "FRONTEND_URL", "MAINTENANCE", "MAINTENANCE_ALLOW", "CT_CLIENT_ID", "CT_CLIENT_SECRET", "CT_ACCESS_TOKEN", "CT_ACCOUNT_ID", "CT_ENV"];
const cfg = (raw) => { const e = { DB: raw.DB }; for (const k of KEYS) e[k] = raw[k] || DEFAULTS[k]; return e; };
// Cho phép cả gexadecimal.dev lẫn www.gexadecimal.dev gọi API
const corsOrigin = (env, req) => {
  const o = new URL(env.FRONTEND_URL).origin;
  const alt = new URL(o).hostname.startsWith("www.") ? o.replace("//www.", "//") : o.replace("//", "//www.");
  const r = req.headers.get("Origin");
  return r === o || r === alt ? r : o;
};

const hex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");
const b64u = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// So sánh chuỗi không lộ độ dài khớp (chống dò theo thời gian phản hồi)
const safeEq = (a, b) => {
  a = String(a ?? ""); b = String(b ?? "");
  let d = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
};

async function sign(secret, data) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data))));
}
async function makeSession(env, uid) {
  const days = Number(env.SESSION_DAYS) || 7;
  const p = b64u(enc.encode(JSON.stringify({ uid, exp: Date.now() + days * 864e5 })));
  return p + "." + (await sign(env.SESSION_SECRET, p));
}
async function readToken(env, tok) {
  const [p, s] = String(tok || "").split(".");
  if (!p || !s || !safeEq(s, await sign(env.SESSION_SECRET, p))) return null;
  try {
    const d = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")));
    return d && d.uid && d.exp > Date.now() ? d : null;
  } catch { return null; }
}
async function readSession(env, req) {
  const h = req.headers.get("Authorization") || "";
  return readToken(env, h.startsWith("Bearer ") ? h.slice(7) : "");
}

const rolesOk = (env, roles) => {
  const need = String(env.DISCORD_ROLE_ID || "").split(",").map((s) => s.trim()).filter(Boolean);
  return !need.length || (roles || []).some((r) => need.includes(r));
};
// Gọi Discord có giới hạn thời gian (8 giây) để không treo cả lượt đăng nhập; GET được thử lại 1 lần khi Discord báo 429/5xx hoặc quá hạn
async function dfetch(url, opts = {}, retries = 0) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(8000) });
      if ((r.status === 429 || r.status >= 500) && i < retries) {
        const w = Math.min(Number(r.headers.get("Retry-After")) || 0.5, 2);
        await new Promise((res) => setTimeout(res, w * 1000));
        continue;
      }
      return r;
    } catch (e) { if (i >= retries) throw e; }
  }
}
// Bảo trì phía server (biến Cloudflare): MAINTENANCE = 1 -> chỉ Discord ID trong MAINTENANCE_ALLOW (cách nhau dấu phẩy) mới đăng nhập/dùng được web.
// Khác với cờ trong config.js (chỉ là màn chắn ở trình duyệt), cái này chặn thật: người ngoài không nhận được phiên và các API web đều từ chối.
const maintBlocked = (env, uid) =>
  ["1", "true", "on", "yes"].includes(String(env.MAINTENANCE || "").trim().toLowerCase()) &&
  !String(env.MAINTENANCE_ALLOW || "").split(",").map((x) => x.trim()).filter(Boolean).includes(String(uid));
// true = còn trong server (đủ role) | false = không | null = Discord lỗi, không kiểm tra được
async function memberOk(env, uid) {
  let r;
  try { r = await dfetch(`https://discord.com/api/v10/guilds/${env.DISCORD_GUILD_ID}/members/${uid}`, { headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` } }, 1); }
  catch { return null; }
  if (r.status === 404) return false;
  if (!r.ok) return null;
  return rolesOk(env, (await r.json()).roles);
}
// Cho qua nếu user tồn tại; nếu có bot thì kiểm tra lại thành viên server (tối đa 10 phút/lần)
async function gate(env, db, u) {
  if (!u) return { err: "expired" };
  if (env.DISCORD_BOT_TOKEN && Date.now() - (u.checked || 0) > CHECK_MS) {
    const ok = await memberOk(env, u.id);
    if (ok === false) return { err: "not_in_server" };
    if (ok === true) await db.prepare("UPDATE users SET checked=? WHERE id=?").bind(Date.now(), u.id).run();
  }
  return { user: u };
}

let ready = false;
async function init(db) {
  if (ready) return;
  // 1 lượt: tạo các bảng chưa có (users, quote, trades, consents)
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT, avatar TEXT, ea_key TEXT UNIQUE, created INTEGER, last_login INTEGER, checked INTEGER)`),
    // thông tin tài khoản MT5 mới nhất của từng người (k = 'latest:<discord id>')
    db.prepare("CREATE TABLE IF NOT EXISTS quote (k TEXT PRIMARY KEY, v TEXT, t INTEGER)"),
    // lệnh đã đóng (1 dòng = 1 position MT5), thuộc về 1 user
    db.prepare(`CREATE TABLE IF NOT EXISTS trades (
      id TEXT PRIMARY KEY, account TEXT, pos TEXT, symbol TEXT, side TEXT, volume REAL,
      open_time INTEGER, close_time INTEGER, open_price REAL, close_price REAL, sl REAL, tp REAL,
      profit REAL, commission REAL, swap REAL, fee REAL, magic INTEGER, comment TEXT, reason TEXT, updated INTEGER, user_id TEXT)`),
    // ghi nhận đồng ý điều khoản: lịch sử đầy đủ trong consents
    db.prepare("CREATE TABLE IF NOT EXISTS consents (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, version TEXT, accepted_at INTEGER)"),
  ]);
  // 1 lượt: xem bảng đã có cột nào, chỉ ALTER khi thiếu (bảng cũ) thay vì lần nào cũng thử
  const cols = async (t) => new Set(((await db.prepare(`PRAGMA table_info(${t})`).all()).results || []).map((c) => c.name));
  const [tc, uc] = await Promise.all([cols("trades"), cols("users")]);
  const add = async (t, c, type) => { try { await db.prepare(`ALTER TABLE ${t} ADD COLUMN ${c} ${type}`).run(); } catch { /* chạy song song đã thêm rồi thì bỏ qua */ } };
  if (!tc.has("user_id")) await add("trades", "user_id", "TEXT");
  if (!uc.has("terms_version")) await add("users", "terms_version", "TEXT");
  if (!uc.has("terms_at")) await add("users", "terms_at", "INTEGER");
  await db.batch([
    db.prepare("CREATE INDEX IF NOT EXISTS idx_consents_user ON consents (user_id, accepted_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_trades_user ON trades (user_id, close_time)"),
  ]);
  ready = true;
}

const avatarUrl = (u) => u.avatar
  ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64`
  : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(u.id) >> 22n) % 6n)}.png`;

// ================= cTrader Open API proxy (WebSocket) =================
// Secret cTrader nằm ở Worker. Trình duyệt chỉ nói chuyện với /ct bằng phiên Discord; Worker tự đăng nhập ApplicationAuth + AccountAuth
// bằng secret của chủ, rồi chuyển tiếp CÓ LỌC: client chỉ được gửi các lệnh lấy dữ liệu thị trường (không đọc được tài khoản / lệnh / số dư
// của chủ, không đặt lệnh được), và sự kiện riêng của tài khoản (execution, margin...) không bao giờ được chuyển xuống client.
const CT_PORT = 5036;
const CT_UP_OK = new Set([51, 2104, 2114, 2116, 2127, 2135, 2137, 2145]);   // client -> cTrader: heartbeat, version, symbols, spots, live trendbar, trendbars, ticks
const CT_DOWN_EVT = new Set([51, 2131]);                                       // cTrader -> client (không phải trả lời): heartbeat, spot
const CT_DEAD_EVT = new Set([2147, 2164]);                                     // token / tài khoản bị thu hồi
const CT_MAX_PER_USER = 8;                                                     // số kết nối đồng thời / người (tính trong 1 isolate, mang tính hạn chế chứ không tuyệt đối)
const ctConns = new Map();
// Không JSON.parse tin từ cTrader (tick có thể rất lớn, tốn CPU): chỉ nhìn đầu + cuối chuỗi, vì payloadType / clientMsgId luôn nằm ở mép ngoài, không nằm trong payload
const ctEdge = (s) => s.length <= 360 ? s : s.slice(0, 180) + "\n" + s.slice(-180);
const ctPT = (e) => { const m = /"payloadType":\s*(\d+)/.exec(e); return m ? +m[1] : 0; };
const ctMid = (e) => { const m = /"clientMsgId":\s*"([^"]*)"/.exec(e); return m ? m[1] : ""; };
const ctHist = new Set([2137, 2145]);

function ctSession(server, env, db) {
  const hist = [];
  let up = null, uid = "", closed = false, ready = false, authing = false, acc = 0, exp = 0, chk = null, authT = null;
  const wait = new Map();
  const put = (o) => { try { server.send(JSON.stringify(o)); } catch { /* socket đã đóng */ } };
  const fin = (code, why) => {
    if (closed) return; closed = true;
    clearInterval(chk); clearTimeout(authT);
    if (uid) { const n = (ctConns.get(uid) || 1) - 1; n > 0 ? ctConns.set(uid, n) : ctConns.delete(uid); }
    try { server.close(code, why); } catch {}
    try { up && up.close(1000, "bye"); } catch {}
    for (const [, w] of wait) { clearTimeout(w.t); w.rej(new Error("closed")); } wait.clear();
  };
  const fail = (id, code, desc) => { put({ clientMsgId: id, payloadType: 50, payload: { errorCode: code, description: desc } }); fin(1008, code); };
  const call = (type, payload) => new Promise((res, rej) => {
    const id = "gx" + hex(4), t = setTimeout(() => { wait.delete(id); rej(new Error("timeout")); }, 12000);
    wait.set(id, { res, rej, t });
    up.send(JSON.stringify({ clientMsgId: id, payloadType: type, payload }));
  });

  authT = setTimeout(() => { if (!ready) fin(1008, "auth timeout"); }, 10000);
  {
    server.addEventListener("close", () => fin(1000, "client closed"));
    server.addEventListener("error", () => fin(1011, "client error"));
    server.addEventListener("message", async (ev) => {
      if (closed) return;
      const raw = ev.data;
      if (typeof raw !== "string" || raw.length > 4096) return fin(1009, "bad message");
      let m; try { m = JSON.parse(raw); } catch { return fin(1003, "bad json"); }
      const type = Number(m && m.payloadType), id = m && typeof m.clientMsgId === "string" ? m.clientMsgId.slice(0, 40) : undefined;

      if (!ready) {   // tin đầu tiên bắt buộc là đăng nhập bằng phiên Discord
        if (authing || type !== 9001) return fin(1008, "auth required");
        authing = true;
        try {
          const miss = ["CT_CLIENT_ID", "CT_CLIENT_SECRET", "CT_ACCESS_TOKEN", "SESSION_SECRET"].filter((k) => !env[k]);
          if (miss.length) return fail(id, "GX_NOCONF", "Worker chưa cài secret cTrader");
          const s = await readToken(env, m.payload && m.payload.token);
          const g = s && await gate(env, db, await db.prepare("SELECT * FROM users WHERE id=?").bind(s.uid).first());
          if (s && maintBlocked(env, s.uid)) return fail(id, "GX_MAINT", "maintenance");
          if (!g || !g.user) return fail(id, "GX_SESSION", (g && g.err) || "expired");
          uid = String(s.uid); exp = s.exp;
          const n = (ctConns.get(uid) || 0) + 1;
          if (n > CT_MAX_PER_USER) { uid = ""; return fail(id, "GX_LIMIT", "quá nhiều kết nối cTrader đồng thời"); }
          ctConns.set(uid, n);
          const host = env.CT_ENV === "demo" ? "demo" : "live";
          const r = await fetch(`https://${host}.ctraderapi.com:${CT_PORT}`, { headers: { Upgrade: "websocket" } });
          up = r.webSocket; if (!up) throw new Error("no upstream");
          up.accept();
          up.addEventListener("message", (e) => {
            const d = e.data; if (typeof d !== "string") return;
            const e2 = ctEdge(d), t = ctPT(e2), cid = ctMid(e2);
            if (cid) {
              const w = wait.get(cid);
              if (w) { wait.delete(cid); clearTimeout(w.t); const p = JSON.parse(d); (t === 2142 || t === 50) ? w.rej(new Error(p.payload && p.payload.errorCode || "ERROR")) : w.res(p.payload || {}); return; }
              if (ready) server.send(d);                       // trả lời cho request mà client được phép gửi
            } else if (ready && CT_DOWN_EVT.has(t)) server.send(d);
            else if (CT_DEAD_EVT.has(t)) { put({ payloadType: 2147, payload: {} }); fin(1011, "upstream revoked"); }
            // mọi sự kiện khác (execution, margin, trader...) bị bỏ: đó là dữ liệu tài khoản riêng của chủ
          });
          up.addEventListener("close", () => fin(1011, "upstream closed"));
          up.addEventListener("error", () => fin(1011, "upstream error"));
          await call(2100, { clientId: env.CT_CLIENT_ID, clientSecret: env.CT_CLIENT_SECRET });
          acc = Math.round(Number(env.CT_ACCOUNT_ID)) || 0;
          if (!acc) {
            const L = (await call(2149, { accessToken: env.CT_ACCESS_TOKEN })).ctidTraderAccount || [];
            const x = L.find((a) => !!a.isLive === (host === "live")) || L[0];
            if (!x) return fail(id, "GX_UPSTREAM", "tài khoản cTrader của chủ không khả dụng");
            acc = +x.ctidTraderAccountId;
          }
          await call(2102, { ctidTraderAccountId: acc, accessToken: env.CT_ACCESS_TOKEN });
          ready = true; clearTimeout(authT);
          // phiên hết hạn / bị đá khỏi server thì cắt luôn, không chờ client tự rời
          chk = setInterval(async () => {
            try {
              if (Date.now() > exp) return fin(1008, "session expired");
              const g2 = await gate(env, db, await db.prepare("SELECT * FROM users WHERE id=?").bind(uid).first());
              if (!g2.user || maintBlocked(env, uid)) fin(1008, "revoked");
            } catch { /* lỗi tạm thời: lần sau kiểm lại */ }
          }, 5 * 60 * 1000);
          put({ clientMsgId: id, payloadType: 9002, payload: { accountId: acc, env: host } });
        } catch (e) {
          console.log("ct auth lỗi", e && e.message);
          if (!closed) fail(id, "GX_UPSTREAM", "không nối được cTrader");
        }
        return;
      }

      if (!CT_UP_OK.has(type)) return fin(1008, "not allowed");        // chặn mọi lệnh ngoài danh sách (đọc tài khoản, đặt lệnh, đổi token...)
      const p = m.payload && typeof m.payload === "object" ? m.payload : {};
      if (type !== 51 && type !== 2104) p.ctidTraderAccountId = acc;   // luôn ép đúng tài khoản của chủ, client không chọn được tài khoản khác
      if (ctHist.has(type)) {   // chặn 1 kết nối dội request lịch sử làm cạn hạn mức của app (client bình thường chỉ ~4 req/s và tự thử lại khi gặp FREQUENCY)
        const now = Date.now(); while (hist.length && now - hist[0] > 1000) hist.shift();
        if (hist.length >= 6) return put({ clientMsgId: id, payloadType: 50, payload: { errorCode: "FREQUENCY", description: "quá nhiều request lịch sử" } });
        hist.push(now);
      }
      try { up.send(JSON.stringify({ clientMsgId: id, payloadType: type, payload: p })); } catch { fin(1011, "upstream send"); }
    });
  }
}

function ctProxy(req, env) {
  if ((req.headers.get("Upgrade") || "").toLowerCase() !== "websocket") return null;
  const o = req.headers.get("Origin");
  if (o && env.FRONTEND_URL) {   // trình duyệt luôn gửi Origin: chỉ nhận từ web của mình (không phải rào cản tuyệt đối, phiên Discord mới là khoá thật)
    const ok = new URL(env.FRONTEND_URL).origin, www = ok.replace("//www.", "//"), alt = ok.replace("//", "//www.");
    if (o !== ok && o !== www && o !== alt) return new Response("forbidden", { status: 403 });
  }
  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);
  server.accept();
  ctSession(server, env, env.DB);
  return new Response(null, { status: 101, webSocket: client });
}

async function handle(req, env) {
  const need = ["DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "DISCORD_GUILD_ID", "SESSION_SECRET", "FRONTEND_URL"].filter((k) => !env[k]);
  const front = String(env.FRONTEND_URL || "").replace(/\/+$/, "");
  const CORS = {
    "Access-Control-Allow-Origin": corsOrigin(env, req),
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Token",
    "Vary": "Origin",
  };
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...CORS } });
  const redirect = (to, cookie) => new Response(null, { status: 302, headers: { Location: to, "Cache-Control": "no-store", ...(cookie ? { "Set-Cookie": cookie } : {}) } });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (need.length) return json({ error: "Worker chưa cài secret: " + need.join(", ") }, 500);   // thiếu cấu hình thì từ chối hết, tránh mở toang

  const db = env.DB;
  const url = new URL(req.url);
  const path = url.pathname;
  const m = req.method;
  await init(db);

  if (path === "/ct") return ctProxy(req, env) || json({ error: "cần WebSocket" }, 426);

  // ================= ĐĂNG NHẬP DISCORD =================
  const CB = `${url.origin}/auth/discord/callback`;
  const CLEAR = "gx_state=; Max-Age=0; Path=/auth; HttpOnly; Secure; SameSite=Lax";
  const fail = (code) => redirect(`${front}/login.html?error=${code}`, CLEAR);

  if (path === "/auth/discord/login" && m === "GET") {
    // trình duyệt phải báo đã đồng ý đúng phiên bản điều khoản hiện hành (checkbox ở login.html); phiên bản đi cùng state để callback ghi lại
    const terms = url.searchParams.get("terms") || "";
    if (terms !== TERMS_VERSION) return redirect(`${front}/login.html?error=terms`, CLEAR);
    const state = hex(16) + "_" + terms;
    const q = new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID, redirect_uri: CB, response_type: "code",
      scope: "identify guilds.members.read", state,
    });
    if (url.searchParams.get("prompt") !== "consent") q.set("prompt", "none");   // đã từng cho phép thì vào luôn, không hỏi lại
    return redirect(`https://discord.com/oauth2/authorize?${q}`, `gx_state=${state}; Max-Age=600; Path=/auth; HttpOnly; Secure; SameSite=Lax`);
  }

  if (path === "/auth/discord/callback" && m === "GET") {
    const err = url.searchParams.get("error");
    if (err) {
      // lần đầu chưa cấp quyền: thử lại có màn hình xác nhận
      if (["consent_required", "interaction_required", "login_required"].includes(err)) {
        const c0 = (req.headers.get("Cookie") || "").match(/(?:^|;\s*)gx_state=[a-f0-9]+_([0-9-]+)/);
        return redirect(`${url.origin}/auth/discord/login?prompt=consent&terms=${encodeURIComponent(c0 ? c0[1] : "")}`, CLEAR);
      }
      return fail(err === "access_denied" ? "denied" : "discord_error");
    }
    const cookie = (req.headers.get("Cookie") || "").match(/(?:^|;\s*)gx_state=([a-f0-9]+_[0-9-]+)/);
    const code = url.searchParams.get("code");
    if (!code || !cookie || !safeEq(cookie[1], url.searchParams.get("state"))) return fail("state");
    const terms = cookie[1].split("_")[1];
    if (terms !== TERMS_VERSION) return fail("terms");   // điều khoản vừa đổi giữa chừng

    const tr = await dfetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, client_secret: env.DISCORD_CLIENT_SECRET, grant_type: "authorization_code", code, redirect_uri: CB }),
    });
    if (!tr.ok) return fail("discord_error");
    const auth = { Authorization: `Bearer ${(await tr.json()).access_token}` };

    const [ur, mr] = await Promise.all([
      dfetch("https://discord.com/api/v10/users/@me", { headers: auth }, 1),
      dfetch(`https://discord.com/api/v10/users/@me/guilds/${env.DISCORD_GUILD_ID}/member`, { headers: auth }, 1),
    ]);
    if (mr.status === 404) return fail("not_in_server");           // không phải thành viên server
    if (!ur.ok || !mr.ok) return fail("discord_error");
    const du = await ur.json(), mem = await mr.json();
    if (!rolesOk(env, mem.roles)) return fail("missing_role");
    if (maintBlocked(env, du.id)) return redirect(`${front}/maintenance.html?s=1`, CLEAR);   // đang bảo trì: không tạo tài khoản, không cấp phiên

    const now = Date.now();
    const prev = await db.prepare("SELECT terms_version FROM users WHERE id=?").bind(du.id).first();
    const st = [db.prepare(`INSERT INTO users (id,name,avatar,ea_key,created,last_login,checked) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, avatar=excluded.avatar, last_login=excluded.last_login, checked=excluded.checked`)
      .bind(du.id, mem.nick || du.global_name || du.username, du.avatar || "", "gx_" + hex(24), now, now, now)];
    if (!prev || prev.terms_version !== terms) {   // lần đầu, hoặc điều khoản đã đổi phiên bản: ghi lại thời điểm đồng ý
      st.push(db.prepare("UPDATE users SET terms_version=?, terms_at=? WHERE id=?").bind(terms, now, du.id));
      st.push(db.prepare("INSERT INTO consents (user_id,version,accepted_at) VALUES (?,?,?)").bind(du.id, terms, now));
    }
    await db.batch(st);
    // phiên đi theo URL fragment (#token) nên không bị gửi lên server hay lộ qua Referer
    return redirect(`${front}/app/index.html#token=${await makeSession(env, du.id)}`, CLEAR);
  }

  // ================= TÀI KHOẢN =================
  const webUser = async () => {
    const s = await readSession(env, req);
    if (!s) return { err: "expired" };
    if (maintBlocked(env, s.uid)) return { err: "maintenance" };   // phiên cũ của người không được phép cũng bị từ chối
    return gate(env, db, await db.prepare("SELECT * FROM users WHERE id=?").bind(s.uid).first());
  };

  if (path === "/auth/me" && m === "GET") {
    const a = await webUser();
    if (!a.user) return json({ error: a.err }, 401);
    const u = a.user;
    return json({ id: u.id, name: u.name, avatar_url: avatarUrl(u), ea_key: u.ea_key, terms_ok: u.terms_version === TERMS_VERSION, terms_version: u.terms_version || null, terms_at: u.terms_at || null });
  }

  if (path === "/auth/regen-key" && m === "POST") {
    const a = await webUser();
    if (!a.user) return json({ error: a.err }, 401);
    let wipe = false;
    try { wipe = (await req.json()).wipe === true; } catch { /* không có body = chỉ đổi key */ }
    const key = "gx_" + hex(24);
    const uid = a.user.id;
    const st = [db.prepare("UPDATE users SET ea_key=? WHERE id=?").bind(key, uid)];
    if (wipe) {   // xoá lệnh + số dư đã lưu của CHÍNH người này; chung 1 batch với việc đổi key nên hoặc cả hai cùng xong, hoặc không gì thay đổi
      st.push(db.prepare("DELETE FROM trades WHERE user_id=?").bind(uid));
      st.push(db.prepare("DELETE FROM quote WHERE k=?").bind("latest:" + uid));
    }
    await db.batch(st);
    return json({ ea_key: key, wiped: wipe });
  }

  if (path === "/auth/delete-account" && m === "POST") {
    const a = await webUser();
    if (!a.user) return json({ error: a.err }, 401);
    let ok = false;
    try { ok = (await req.json()).confirm === true; } catch { /* không có body hợp lệ = không xoá */ }
    if (!ok) return json({ error: "thiếu xác nhận xoá" }, 400);   // chặn gọi nhầm: bắt buộc {"confirm":true}
    const uid = a.user.id;
    // một batch D1: hoặc xoá hết, hoặc không xoá gì. Xoá user cuối cùng nên EA key và phiên cũ vô hiệu ngay (webUser không tìm thấy user nữa)
    await db.batch([
      db.prepare("DELETE FROM trades WHERE user_id=?").bind(uid),
      db.prepare("DELETE FROM quote WHERE k=?").bind("latest:" + uid),
      db.prepare("DELETE FROM consents WHERE user_id=?").bind(uid),
      db.prepare("DELETE FROM users WHERE id=?").bind(uid),
    ]);
    return json({ ok: true, deleted: true });
  }

  // ================= EA MT5 (EA key riêng của từng người) =================
  if (path.startsWith("/api/ea/") && m === "POST") {
    const k = req.headers.get("X-Token") || "";
    const a = k ? await gate(env, db, await db.prepare("SELECT * FROM users WHERE ea_key=?").bind(k).first()) : { err: "unauthorized" };
    if (!a.user) return json({ error: a.err === "expired" ? "unauthorized" : a.err }, 401);
    const uid = a.user.id;

    if (path === "/api/ea/quote") {
      const b = await req.json(); // { account:{login,balance,equity,ccy,open}, serverTime }
      if (!b || typeof b.account !== "object" || b.account === null) return json({ error: "thiếu account" }, 400);
      if (JSON.stringify(b).length > 20000) return json({ error: "dữ liệu không hợp lệ" }, 413);
      await db.prepare("INSERT INTO quote (k,v,t) VALUES (?,?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v, t=excluded.t")
        .bind("latest:" + uid, JSON.stringify({ account: b.account, serverTime: b.serverTime ?? null }), Date.now()).run();
      return json({ ok: true });
    }

    if (path === "/api/ea/deals") {
      const b = await req.json(); // { account, tzOffset, trades:[{pos,symbol,side,volume,openTime,closeTime,...}] }
      if (!b || !Array.isArray(b.trades)) return json({ error: "thiếu trades" }, 400);
      if (b.trades.length > 200) return json({ error: "dữ liệu không hợp lệ" }, 413);
      const off = Number(b.tzOffset) || 0;
      const ms = (t) => (Number(t) - off) * 1000; // giờ server MT5 -> UTC (ms)
      const n = (x) => Number(x) || 0;
      const now = Date.now();
      const stmts = b.trades.filter((t) => t && t.pos).map((t) =>
        db.prepare(`INSERT INTO trades
          (id,account,pos,symbol,side,volume,open_time,close_time,open_price,close_price,sl,tp,profit,commission,swap,fee,magic,comment,reason,updated,user_id)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET
            volume=excluded.volume, open_time=excluded.open_time, close_time=excluded.close_time,
            open_price=excluded.open_price, close_price=excluded.close_price, sl=excluded.sl, tp=excluded.tp,
            profit=excluded.profit, commission=excluded.commission, swap=excluded.swap, fee=excluded.fee,
            comment=excluded.comment, reason=excluded.reason, updated=excluded.updated`)
          .bind(`${uid}-${b.account || 0}-${t.pos}`, String(b.account || ""), String(t.pos), String(t.symbol || ""),
            t.side === "sell" ? "sell" : "buy", n(t.volume), ms(t.openTime), ms(t.closeTime),
            n(t.openPrice), n(t.closePrice), n(t.sl), n(t.tp), n(t.profit), n(t.commission), n(t.swap), n(t.fee),
            n(t.magic), String(t.comment || ""), String(t.reason || ""), now, uid));
      if (stmts.length) await db.batch(stmts);
      return json({ ok: true, saved: stmts.length });
    }
  }

  // ================= JOURNAL (web, cần phiên Discord) =================
  if (path.startsWith("/api/") && m === "GET") {
    const a = await webUser();
    if (!a.user) return json({ error: a.err }, 401);
    const uid = a.user.id;

    if (path === "/api/health") return json({ ok: true });

    if (path === "/api/quote") {
      const r = await db.prepare("SELECT v, t FROM quote WHERE k=?").bind("latest:" + uid).first();
      if (!r) return json({ account: null, receivedAt: 0 });
      const q = JSON.parse(r.v);
      q.receivedAt = r.t; // giờ server Cloudflare lúc nhận
      return json(q);
    }

    // since tính theo close_time, bao gồm cả mốc (journal tự dedupe theo id)
    if (path === "/api/trades") {
      const since = Number(url.searchParams.get("since")) || 0;
      const limit = Math.min(Number(url.searchParams.get("limit")) || 500, 1000);
      const { results } = await db.prepare(
        "SELECT * FROM trades WHERE user_id=? AND close_time >= ? ORDER BY close_time ASC LIMIT ?").bind(uid, since, limit).all();
      for (const t of results) {
        const risk = Math.abs(t.open_price - t.sl);
        t.r = t.sl > 0 && risk > 0 ? ((t.side === "buy" ? 1 : -1) * (t.close_price - t.open_price)) / risk : null; // R thực tế
        t.net = t.profit + t.commission + t.swap + t.fee;
      }
      return json(results);
    }
  }

  return json({ error: "not found" }, 404);
}

export default {
  async fetch(req, rawEnv) {
    const env = cfg(rawEnv);
    try {
      return await handle(req, env);
    } catch (e) {
      console.log("lỗi xử lý", req.method, new URL(req.url).pathname, e && e.message);
      if (new URL(req.url).pathname.startsWith("/auth/discord/")) {
        return new Response(null, { status: 302, headers: { Location: `${String(env.FRONTEND_URL).replace(/\/+$/, "")}/login.html?error=other`, "Cache-Control": "no-store" } });
      }
      const h = { "Content-Type": "application/json", "Access-Control-Allow-Origin": corsOrigin(env, req), "Vary": "Origin" };
      if (e instanceof SyntaxError) return new Response(JSON.stringify({ error: "JSON không hợp lệ" }), { status: 400, headers: h });
      return new Response(JSON.stringify({ error: "lỗi máy chủ" }), { status: 500, headers: h });   // luôn có CORS để web đọc được lỗi
    }
  },
};
