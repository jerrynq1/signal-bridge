// Gexadecimal Trading Journal API – Cloudflare Worker + D1 (đăng nhập Discord, mỗi thành viên một journal riêng)
//
// Binding bắt buộc : DB (D1 database)
// Secret bắt buộc  : DISCORD_CLIENT_SECRET, SESSION_SECRET   (chỉ 2 cái này là bí mật thật, KHÔNG ghi vào code)
// Đã đặt sẵn trong code (là thông tin công khai, xem DEFAULTS bên dưới): DISCORD_CLIENT_ID, DISCORD_GUILD_ID, FRONTEND_URL
//   -> muốn đổi thì chỉ cần thêm biến cùng tên trên Cloudflare, giá trị trên Cloudflare sẽ ghi đè.
// Secret tuỳ chọn  : DISCORD_ROLE_ID   (chỉ cho role này vào; nhiều role cách nhau dấu phẩy)
//                    DISCORD_BOT_TOKEN (bot trong server, dùng kiểm tra lại thành viên mỗi 10 phút để đá người đã rời/bị kick)
//                    SESSION_DAYS      (thời hạn phiên đăng nhập, mặc định 7 ngày)
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
const TERMS_VERSION = "2026-10-20-2";

// Giá trị CÔNG KHAI nên để sẵn ở đây cho đỡ phải nhập trên Cloudflare
const DEFAULTS = {
  DISCORD_CLIENT_ID: "1562015837739683850",
  DISCORD_GUILD_ID: "1562048805522903062",
  FRONTEND_URL: "https://www.gexadecimal.dev",
};
const KEYS = ["DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "DISCORD_GUILD_ID", "DISCORD_ROLE_ID", "DISCORD_BOT_TOKEN", "SESSION_SECRET", "SESSION_DAYS", "FRONTEND_URL"];
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
async function readSession(env, req) {
  const h = req.headers.get("Authorization") || "";
  const [p, s] = (h.startsWith("Bearer ") ? h.slice(7) : "").split(".");
  if (!p || !s || !safeEq(s, await sign(env.SESSION_SECRET, p))) return null;
  try {
    const d = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")));
    return d && d.uid && d.exp > Date.now() ? d : null;
  } catch { return null; }
}

const rolesOk = (env, roles) => {
  const need = String(env.DISCORD_ROLE_ID || "").split(",").map((s) => s.trim()).filter(Boolean);
  return !need.length || (roles || []).some((r) => need.includes(r));
};
// true = còn trong server (đủ role) | false = không | null = Discord lỗi, không kiểm tra được
async function memberOk(env, uid) {
  const r = await fetch(`https://discord.com/api/v10/guilds/${env.DISCORD_GUILD_ID}/members/${uid}`, { headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` } });
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
  await db.prepare(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, name TEXT, avatar TEXT, ea_key TEXT UNIQUE, created INTEGER, last_login INTEGER, checked INTEGER)`).run();
  // thông tin tài khoản MT5 mới nhất của từng người (k = 'latest:<discord id>')
  await db.prepare("CREATE TABLE IF NOT EXISTS quote (k TEXT PRIMARY KEY, v TEXT, t INTEGER)").run();
  // lệnh đã đóng (1 dòng = 1 position MT5), thuộc về 1 user
  await db.prepare(`CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY, account TEXT, pos TEXT, symbol TEXT, side TEXT, volume REAL,
    open_time INTEGER, close_time INTEGER, open_price REAL, close_price REAL, sl REAL, tp REAL,
    profit REAL, commission REAL, swap REAL, fee REAL, magic INTEGER, comment TEXT, reason TEXT, updated INTEGER, user_id TEXT)`).run();
  try { await db.prepare("ALTER TABLE trades ADD COLUMN user_id TEXT").run(); } catch { /* bảng cũ đã có cột thì bỏ qua */ }
  // ghi nhận đồng ý điều khoản: phiên bản + thời điểm gần nhất trên users, lịch sử đầy đủ trong consents
  try { await db.prepare("ALTER TABLE users ADD COLUMN terms_version TEXT").run(); } catch { /* đã có cột */ }
  try { await db.prepare("ALTER TABLE users ADD COLUMN terms_at INTEGER").run(); } catch { /* đã có cột */ }
  await db.prepare("CREATE TABLE IF NOT EXISTS consents (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, version TEXT, accepted_at INTEGER)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_consents_user ON consents (user_id, accepted_at)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_trades_user ON trades (user_id, close_time)").run();
  ready = true;
}

const avatarUrl = (u) => u.avatar
  ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64`
  : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(u.id) >> 22n) % 6n)}.png`;

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

    const tr = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, client_secret: env.DISCORD_CLIENT_SECRET, grant_type: "authorization_code", code, redirect_uri: CB }),
    });
    if (!tr.ok) return fail("discord_error");
    const auth = { Authorization: `Bearer ${(await tr.json()).access_token}` };

    const [ur, mr] = await Promise.all([
      fetch("https://discord.com/api/v10/users/@me", { headers: auth }),
      fetch(`https://discord.com/api/v10/users/@me/guilds/${env.DISCORD_GUILD_ID}/member`, { headers: auth }),
    ]);
    if (mr.status === 404) return fail("not_in_server");           // không phải thành viên server
    if (!ur.ok || !mr.ok) return fail("discord_error");
    const du = await ur.json(), mem = await mr.json();
    if (!rolesOk(env, mem.roles)) return fail("missing_role");

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
      const h = { "Content-Type": "application/json", "Access-Control-Allow-Origin": corsOrigin(env, req), "Vary": "Origin" };
      if (e instanceof SyntaxError) return new Response(JSON.stringify({ error: "JSON không hợp lệ" }), { status: 400, headers: h });
      return new Response(JSON.stringify({ error: "lỗi máy chủ" }), { status: 500, headers: h });   // luôn có CORS để web đọc được lỗi
    }
  },
};
