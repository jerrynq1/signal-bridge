//+------------------------------------------------------------------+
//| SignalBridge Journal.mq5   (v3.00 - viết lại hoàn toàn)           |
//|                                                                  |
//| Chỉ phục vụ NHẬT KÝ GIAO DỊCH:                                    |
//|  1) Lần đầu gắn EA vào tài khoản: gửi TOÀN BỘ lịch sử giao dịch   |
//|     của tài khoản (không giới hạn số ngày) lên API.               |
//|  2) Sau đó: tự gửi lệnh vừa đóng, và bù các lệnh đóng lúc EA tắt. |
//|  3) Gửi số dư / equity để Journal khớp vốn.                       |
//| EA KHÔNG nhận tín hiệu, KHÔNG vào lệnh, KHÔNG sửa/đóng lệnh.      |
//+------------------------------------------------------------------+
#property copyright "Signal Bridge"
#property version   "3.00"

input string InpApiUrl     = "https://signal-bridge.nguyenhuy5a10.workers.dev"; // API base URL (không có / ở cuối)
input string InpToken      = "";     // EA key của bạn (web > Kết nối > EA key)
input int    InpSyncSec    = 30;     // Quét lệnh mới đóng mỗi N giây (sau khi đã gửi xong lịch sử)
input int    InpAcctSec    = 60;     // Gửi số dư / equity mỗi N giây (0 = không gửi)
input int    InpBatch      = 100;    // Số lệnh mỗi request (1..200, server giới hạn 200)
input bool   InpFullResync = false;  // true = gửi lại TOÀN BỘ lịch sử khi EA khởi động (xong thì đặt lại false)

#define OVERLAP_SEC  21600   // khi quét định kỳ, lùi 6 giờ cho chắc (server ghi đè theo khóa nên gửi lại không sao)
#define RECENT_MAX   2000    // nhớ tối đa N position vừa gửi để khỏi gửi lại mỗi lần quét
#define BUDGET_MS    4000    // mỗi nhịp timer chỉ làm tối đa ~4 giây rồi nghỉ

// phase: -1 = chờ kết nối tài khoản, 0 = chờ terminal tải lịch sử, 1 = đang gửi toàn bộ lịch sử, 2 = chạy định kỳ
int      g_phase      = -1;
long     g_login      = 0;
string   g_apiUrl;
string   g_gvWM;                 // tên GlobalVariable lưu mốc đồng bộ (bền qua lần tắt/mở terminal)
datetime g_wm         = 0;       // mốc: mọi lệnh đóng trước thời điểm này đã được gửi
datetime g_buildTime  = 0;

bool     g_syncNow    = false;   // có lệnh vừa đóng -> quét ngay
ulong    g_nextSync   = 0;
ulong    g_nextAcct   = 0;
ulong    g_retryAt    = 0;       // lỗi mạng/API -> chờ đến mốc này mới thử lại
int      g_fails      = 0;
datetime g_lastErrLog = 0;

int      g_loadTries  = 0;
int      g_lastTotal  = -1;
ulong    g_queue[];              // danh sách position cần gửi trong đợt gửi toàn bộ lịch sử
int      g_qPos       = 0;
int      g_sentTotal  = 0;

ulong    g_recent[];
int      g_recentHead = 0;
int      g_recentCnt  = 0;

//------------------------------------------------------------------
// Tiện ích
//------------------------------------------------------------------
string JsonEsc(string s)
{
   StringReplace(s, "\\", "\\\\");
   StringReplace(s, "\"", "'");
   StringReplace(s, "\r", " ");
   StringReplace(s, "\n", " ");
   StringReplace(s, "\t", " ");
   return s;
}

string TrimStr(string s) { StringTrimLeft(s); StringTrimRight(s); return s; }

void Status(const string s) { Comment("SignalBridge Journal v3\n" + s); }

void LogErr(const string msg)
{
   if(TimeLocal() - g_lastErrLog > 30)
   {
      g_lastErrLog = TimeLocal();
      Print("SignalBridge: ", msg);
   }
}

void MarkRecent(const ulong pid)
{
   if(ArraySize(g_recent) < RECENT_MAX) ArrayResize(g_recent, RECENT_MAX);
   g_recent[g_recentHead] = pid;
   g_recentHead = (g_recentHead + 1) % RECENT_MAX;
   if(g_recentCnt < RECENT_MAX) g_recentCnt++;
}

bool IsRecent(const ulong pid)
{
   for(int i = 0; i < g_recentCnt; i++) if(g_recent[i] == pid) return true;
   return false;
}

void OnFail()
{
   g_fails++;
   int wait = MathMin(60, 5 * g_fails);
   g_retryAt = GetTickCount64() + (ulong)wait * 1000;
}

//------------------------------------------------------------------
// HTTP
//------------------------------------------------------------------
int Http(const string method, const string path, const string body, string &resp)
{
   char data[], result[];
   string rh;
   string headers = "Content-Type: application/json\r\nX-Token: " + InpToken + "\r\n";
   if(body != "")
   {
      int n = StringToCharArray(body, data, 0, WHOLE_ARRAY, CP_UTF8);
      ArrayResize(data, n - 1);
   }
   ResetLastError();
   int code = WebRequest(method, g_apiUrl + path, headers, 8000, data, result, rh);
   resp = (code == -1) ? "" : CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   if(code == -1)
   {
      int e = GetLastError();
      LogErr(StringFormat("WebRequest lỗi %d. %s", e,
             e == 4014 ? "Chưa thêm URL vào Tools > Options > Expert Advisors > Allow WebRequest." : "Kiểm tra mạng và API URL."));
   }
   else if(code != 200)
   {
      LogErr(StringFormat("API trả về HTTP %d. %s %s", code,
             (code == 401 || code == 403) ? "EA key sai hoặc tài khoản không còn quyền." : "",
             StringSubstr(resp, 0, 120)));
   }
   return code;
}

//------------------------------------------------------------------
// Gộp mọi deal của 1 position thành 1 object JSON.
// Trả "" nếu position còn mở hoặc thiếu dữ liệu (lệnh chờ chưa khớp/bị hủy không có deal nên không bao giờ gửi).
//------------------------------------------------------------------
string ReasonName(long r)
{
   switch((int)r)
   {
      case DEAL_REASON_SL:     return "sl";
      case DEAL_REASON_TP:     return "tp";
      case DEAL_REASON_SO:     return "stopout";
      case DEAL_REASON_CLIENT:
      case DEAL_REASON_MOBILE:
      case DEAL_REASON_WEB:    return "manual";
      case DEAL_REASON_EXPERT: return "expert";
   }
   return "other";
}

string BuildTrade(const ulong pid)
{
   if(PositionSelectByTicket(pid)) return "";   // còn mở (kể cả đã chốt một phần) thì chờ đóng hẳn
   if(!HistorySelectByPosition(pid)) return "";
   int n = HistoryDealsTotal();
   double vin = 0, pin = 0, vout = 0, pout = 0, profit = 0, comm = 0, swap = 0, fee = 0, sl = 0, tp = 0;
   datetime tIn = 0, tOut = 0;
   string sym = "", cmt = "", side = "buy";
   long magic = 0, reason = 0;
   for(int i = 0; i < n; i++)
   {
      ulong d = HistoryDealGetTicket(i);
      if(d == 0) continue;
      long type = HistoryDealGetInteger(d, DEAL_TYPE);
      if(type != DEAL_TYPE_BUY && type != DEAL_TYPE_SELL) continue;   // bỏ deal nạp/rút, balance...
      long     en = HistoryDealGetInteger(d, DEAL_ENTRY);
      double   v  = HistoryDealGetDouble(d, DEAL_VOLUME);
      double   p  = HistoryDealGetDouble(d, DEAL_PRICE);
      datetime t  = (datetime)HistoryDealGetInteger(d, DEAL_TIME);
      profit += HistoryDealGetDouble(d, DEAL_PROFIT);
      comm   += HistoryDealGetDouble(d, DEAL_COMMISSION);
      swap   += HistoryDealGetDouble(d, DEAL_SWAP);
      fee    += HistoryDealGetDouble(d, DEAL_FEE);
      if(en == DEAL_ENTRY_IN)
      {
         if(vin + v > 0) pin = (vin * pin + v * p) / (vin + v);
         vin += v;
         if(tIn == 0 || t < tIn)
         {
            tIn   = t;
            sym   = HistoryDealGetString(d, DEAL_SYMBOL);
            cmt   = HistoryDealGetString(d, DEAL_COMMENT);
            side  = (type == DEAL_TYPE_BUY) ? "buy" : "sell";
            magic = HistoryDealGetInteger(d, DEAL_MAGIC);
            sl    = HistoryDealGetDouble(d, DEAL_SL);
            tp    = HistoryDealGetDouble(d, DEAL_TP);
         }
      }
      else if(en == DEAL_ENTRY_OUT || en == DEAL_ENTRY_OUT_BY)
      {
         if(vout + v > 0) pout = (vout * pout + v * p) / (vout + v);
         vout += v;
         if(t >= tOut) { tOut = t; reason = HistoryDealGetInteger(d, DEAL_REASON); }
      }
   }
   if(vin <= 0 || vout <= 0) return "";
   return "{\"pos\":\"" + (string)pid + "\",\"symbol\":\"" + JsonEsc(sym) + "\",\"side\":\"" + side +
          "\",\"volume\":" + DoubleToString(vin, 4) +
          ",\"openTime\":" + (string)(long)tIn + ",\"closeTime\":" + (string)(long)tOut +
          ",\"openPrice\":" + DoubleToString(pin, 8) + ",\"closePrice\":" + DoubleToString(pout, 8) +
          ",\"sl\":" + DoubleToString(sl, 8) + ",\"tp\":" + DoubleToString(tp, 8) +
          ",\"profit\":" + DoubleToString(profit, 2) + ",\"commission\":" + DoubleToString(comm, 2) +
          ",\"swap\":" + DoubleToString(swap, 2) + ",\"fee\":" + DoubleToString(fee, 2) +
          ",\"magic\":" + (string)magic + ",\"comment\":\"" + JsonEsc(cmt) + "\",\"reason\":\"" + ReasonName(reason) + "\"}";
}

// Lệch giờ server MT5 so với UTC (giây), làm tròn 15 phút
long TzOffset()
{
   return (long)MathRound((double)(TimeTradeServer() - TimeGMT()) / 900.0) * 900;
}

// Build + gửi pids[from .. to-1] thành 1 request. true = OK (kể cả khi không có gì để gửi).
bool SendRange(const ulong &pids[], const int from, const int to, int &sent)
{
   string items = "";
   int cnt = 0;
   ulong chunk[];
   ArrayResize(chunk, to - from);
   for(int k = from; k < to; k++)
   {
      string t = BuildTrade(pids[k]);   // đổi vùng history đang chọn, nên danh sách pids phải lấy xong từ trước
      if(t == "") continue;
      items += (cnt > 0 ? "," : "") + t;
      chunk[cnt] = pids[k];
      cnt++;
   }
   if(cnt == 0) return true;
   string body = "{\"account\":\"" + (string)AccountInfoInteger(ACCOUNT_LOGIN) + "\",\"tzOffset\":" + (string)TzOffset() +
                 ",\"trades\":[" + items + "]}";
   string resp;
   if(Http("POST", "/api/ea/deals", body, resp) != 200) return false;
   for(int q = 0; q < cnt; q++) MarkRecent(chunk[q]);
   sent += cnt;
   return true;
}

//------------------------------------------------------------------
// Lấy danh sách position đã có deal ĐÓNG trong vùng history đang chọn (không trùng, sort tăng dần)
//------------------------------------------------------------------
int CollectPids(ulong &res[], const bool skipRecent)
{
   ArrayResize(res, 0);
   int total = HistoryDealsTotal();
   int n = 0;
   for(int i = 0; i < total; i++)
   {
      ulong d = HistoryDealGetTicket(i);
      if(d == 0) continue;
      long en = HistoryDealGetInteger(d, DEAL_ENTRY);
      if(en != DEAL_ENTRY_OUT && en != DEAL_ENTRY_OUT_BY) continue;
      ulong pid = (ulong)HistoryDealGetInteger(d, DEAL_POSITION_ID);
      if(pid == 0) continue;
      if(skipRecent && IsRecent(pid)) continue;
      ArrayResize(res, n + 1, total);
      res[n] = pid;
      n++;
   }
   if(n == 0) return 0;
   ArraySort(res);
   int m = 1;
   for(int i = 1; i < n; i++)
      if(res[i] != res[m - 1]) { res[m] = res[i]; m++; }
   ArrayResize(res, m);
   return m;
}

//------------------------------------------------------------------
// PHASE 0: chờ terminal tải xong lịch sử từ server broker.
// HistorySelect(0, ...) yêu cầu TOÀN BỘ lịch sử; terminal có thể cần vài giây để tải,
// nên đợi đến khi số deal ổn định giữa 2 nhịp liên tiếp rồi mới lập danh sách.
//------------------------------------------------------------------
void StepLoad()
{
   g_loadTries++;
   if(!HistorySelect(0, TimeCurrent() + 86400)) return;
   int total = HistoryDealsTotal();
   Status(StringFormat("Đang tải lịch sử từ broker... (%d deal)", total));
   if((total > 0 && total == g_lastTotal) || g_loadTries >= 10)
   {
      g_buildTime = TimeCurrent();
      int m = CollectPids(g_queue, false);
      g_qPos = 0;
      g_sentTotal = 0;
      g_phase = 1;
      PrintFormat("SignalBridge: tìm thấy %d deal, %d lệnh đã đóng trong toàn bộ lịch sử. Bắt đầu gửi lên API.", total, m);
      return;
   }
   g_lastTotal = total;
}

//------------------------------------------------------------------
// PHASE 1: gửi toàn bộ lịch sử theo lô. Lỗi thì giữ nguyên vị trí, thử lại sau.
//------------------------------------------------------------------
void StepBackfill()
{
   int batch = MathMax(1, MathMin(200, InpBatch));
   int total = ArraySize(g_queue);
   ulong t0 = GetTickCount64();
   while(g_qPos < total && GetTickCount64() - t0 < BUDGET_MS)
   {
      int to = MathMin(total, g_qPos + batch);
      if(!SendRange(g_queue, g_qPos, to, g_sentTotal)) { OnFail(); return; }
      g_fails = 0;
      g_qPos = to;
   }
   Status(StringFormat("Đang gửi toàn bộ lịch sử: %d / %d vị thế (đã lên API: %d lệnh)", g_qPos, total, g_sentTotal));
   if(g_qPos >= total)
   {
      g_wm = g_buildTime;
      GlobalVariableSet(g_gvWM, (double)g_wm);
      g_phase = 2;
      g_nextSync = 0;
      ArrayFree(g_queue);
      PrintFormat("SignalBridge: HOÀN TẤT đồng bộ toàn bộ lịch sử: %d lệnh. Trên web bấm 'Tải lại từ đầu' để kéo về journal.", g_sentTotal);
      Status(StringFormat("Đã đồng bộ toàn bộ lịch sử (%d lệnh). Đang theo dõi lệnh mới.", g_sentTotal));
   }
}

//------------------------------------------------------------------
// PHASE 2: định kỳ gửi lệnh mới đóng, và bù lệnh đóng lúc EA tắt (mốc g_wm lưu bền)
//------------------------------------------------------------------
void SyncRecent()
{
   datetime now  = TimeCurrent();
   datetime from = (g_wm > OVERLAP_SEC) ? g_wm - OVERLAP_SEC : 0;
   if(!HistorySelect(from, now + 86400)) return;

   ulong pids[];
   int n = CollectPids(pids, true);
   int batch = MathMax(1, MathMin(200, InpBatch));
   int sent = 0;
   ulong t0 = GetTickCount64();
   for(int k = 0; k < n; k += batch)
   {
      if(GetTickCount64() - t0 >= BUDGET_MS) { g_syncNow = true; break; }   // còn nhiều (EA tắt lâu) -> nhịp sau làm tiếp
      int to = MathMin(n, k + batch);
      if(!SendRange(pids, k, to, sent)) { OnFail(); return; }
      g_fails = 0;
      if(to >= n) { g_wm = now; GlobalVariableSet(g_gvWM, (double)g_wm); }
   }
   if(n == 0) { g_wm = now; GlobalVariableSet(g_gvWM, (double)g_wm); }
   if(sent > 0) PrintFormat("SignalBridge: đã đồng bộ %d lệnh vừa đóng lên API", sent);
}

// Có deal mới (đóng lệnh bằng SL/TP/tay/EA khác...) -> quét ngay, không đợi nhịp định kỳ
void OnTradeTransaction(const MqlTradeTransaction &trans, const MqlTradeRequest &req, const MqlTradeResult &res)
{
   if(trans.type == TRADE_TRANSACTION_DEAL_ADD) g_syncNow = true;
}

//------------------------------------------------------------------
// Gửi thông tin tài khoản (số dư, equity)
//------------------------------------------------------------------
void SyncAccount()
{
   string body = "{\"account\":{\"login\":" + (string)AccountInfoInteger(ACCOUNT_LOGIN) +
                 ",\"balance\":" + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2) +
                 ",\"equity\":" + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2) +
                 ",\"ccy\":\"" + AccountInfoString(ACCOUNT_CURRENCY) + "\",\"open\":" + (string)PositionsTotal() +
                 "},\"serverTime\":" + (string)(long)TimeCurrent() + "}";
   string resp;
   Http("POST", "/api/ea/quote", body, resp);
}

//------------------------------------------------------------------
// Xác định trạng thái khi có tài khoản: đã từng gửi toàn bộ lịch sử chưa?
//------------------------------------------------------------------
bool ResolveState()
{
   long login = AccountInfoInteger(ACCOUNT_LOGIN);
   if(login <= 0 || !TerminalInfoInteger(TERMINAL_CONNECTED)) { Status("Đang chờ kết nối tài khoản..."); return false; }
   g_login = login;
   g_gvWM  = "SB3_WM_" + (string)login;
   if(InpFullResync && GlobalVariableCheck(g_gvWM)) GlobalVariableDel(g_gvWM);
   g_recentCnt = 0; g_recentHead = 0;
   g_fails = 0; g_retryAt = 0;
   g_loadTries = 0; g_lastTotal = -1;
   if(GlobalVariableCheck(g_gvWM))
   {
      g_wm = (datetime)(long)GlobalVariableGet(g_gvWM);
      g_phase = 2;
      g_nextSync = 0;
      PrintFormat("SignalBridge: tài khoản %I64d đã đồng bộ toàn bộ lịch sử trước đó. Tiếp tục từ %s.", login, TimeToString(g_wm));
      Status("Đã đồng bộ toàn bộ lịch sử. Đang theo dõi lệnh mới.");
   }
   else
   {
      g_phase = 0;
      PrintFormat("SignalBridge: tài khoản %I64d chưa đồng bộ lịch sử -> sẽ gửi TOÀN BỘ lịch sử.", login);
   }
   return true;
}

//------------------------------------------------------------------
// Khởi động / vòng lặp
//------------------------------------------------------------------
int OnInit()
{
   g_apiUrl = TrimStr(InpApiUrl);
   while(StringLen(g_apiUrl) > 0 && StringGetCharacter(g_apiUrl, StringLen(g_apiUrl) - 1) == '/')
      g_apiUrl = StringSubstr(g_apiUrl, 0, StringLen(g_apiUrl) - 1);
   if(StringFind(g_apiUrl, "https://") != 0 || TrimStr(InpToken) == "")
   {
      Alert("SignalBridge Journal: cần nhập API URL (bắt đầu bằng https://) và EA key.");
      return INIT_PARAMETERS_INCORRECT;
   }
   g_phase = -1;
   g_nextAcct = 0;
   EventSetTimer(1);
   PrintFormat("SignalBridge Journal v3 chạy. Nhớ thêm %s vào danh sách WebRequest cho phép (Tools > Options > Expert Advisors).", g_apiUrl);
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EventKillTimer();
   Comment("");
}

void OnTimer()
{
   ulong now = GetTickCount64();

   // đổi tài khoản trong cùng terminal -> xác định lại trạng thái cho tài khoản mới
   if(g_phase >= 0 && AccountInfoInteger(ACCOUNT_LOGIN) != g_login) g_phase = -1;
   if(g_phase == -1 && !ResolveState()) return;

   if(now >= g_retryAt)
   {
      if(g_phase == 0)      StepLoad();
      else if(g_phase == 1) StepBackfill();
      else if(g_syncNow || (InpSyncSec > 0 && now >= g_nextSync))
      {
         g_syncNow  = false;
         g_nextSync = now + (ulong)MathMax(1, InpSyncSec) * 1000;
         SyncRecent();
      }
   }

   if(InpAcctSec > 0 && now >= g_nextAcct)
   {
      g_nextAcct = now + (ulong)InpAcctSec * 1000;
      SyncAccount();
   }
}

void OnTick() { }
