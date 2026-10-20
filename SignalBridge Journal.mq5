//+------------------------------------------------------------------+
//| SignalBridgeJournal.mq5                                          |
//| Bản rút gọn chỉ phục vụ NHẬT KÝ GIAO DỊCH (Trading Journal):     |
//|  - gửi lệnh ĐÃ ĐÓNG lên Cloudflare API để web đồng bộ vào Journal |
//|  - gửi số dư / equity để Journal khớp vốn với MT5                |
//| EA KHÔNG nhận tín hiệu, KHÔNG vào lệnh, KHÔNG sửa/đóng lệnh.     |
//| Bản đầy đủ (đẩy lệnh, chart, footprint...): archive/app-full/    |
//+------------------------------------------------------------------+
#property copyright "Signal Bridge"
#property version   "2.00"

input string InpApiUrl  = "https://signal-bridge.nguyenhuy5a10.workers.dev"; // API base URL (không có / ở cuối)
input string InpToken   = "";                                              // EA key của bạn (web > Kết nối > EA key)
input int    InpSyncSec = 30;                                              // Quét lệnh đã đóng và gửi lên API mỗi N giây
input int    InpAcctSec = 60;                                              // Gửi số dư / equity mỗi N giây (0 = không gửi)
input int    InpBackfillDays = 30;                                         // Lần chạy đầu: lấy lại lịch sử bao nhiêu ngày

string   g_apiUrl;
datetime g_lastErrLog = 0;
ulong    g_sentPid[];            // position đã gửi lên API (khỏi gửi lại mỗi lần quét)
int      g_sentN = 0;
datetime g_lastAcct = 0;

//------------------------------------------------------------------
// Tiện ích
//------------------------------------------------------------------
string JsonEsc(string s)
{
   StringReplace(s, "\\", "\\\\");
   StringReplace(s, "\"", "'");
   StringReplace(s, "\n", " ");
   return s;
}

string Trim(string s) { StringTrimLeft(s); StringTrimRight(s); return s; }

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
   int code = WebRequest(method, g_apiUrl + path, headers, 5000, data, result, rh);
   resp = (code == -1) ? "" : CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   if(code == -1 && TimeCurrent() - g_lastErrLog > 30)
   {
      g_lastErrLog = TimeCurrent();
      int e = GetLastError();
      PrintFormat("SignalBridge: WebRequest lỗi %d. %s", e,
                  e == 4014 ? "Chưa thêm URL vào Tools > Options > Expert Advisors > Allow WebRequest." : "Kiểm tra mạng và API URL.");
   }
   return code;
}

//------------------------------------------------------------------
// Đồng bộ lệnh ĐÃ ĐÓNG lên API (cho web nhật ký giao dịch)
// 1 position = 1 dòng. Gửi lại nhiều lần không sao vì server ghi đè theo khóa.
//------------------------------------------------------------------
datetime g_lastSync = 0;

bool IsSent(const ulong pid)
{
   for(int i = g_sentN - 1; i >= 0; i--) if(g_sentPid[i] == pid) return true;
   return false;
}
void MarkSent(const ulong pid)
{
   if(g_sentN >= 500)
   {
      for(int i = 1; i < g_sentN; i++) g_sentPid[i - 1] = g_sentPid[i];
      g_sentN--;
   }
   ArrayResize(g_sentPid, g_sentN + 1);
   g_sentPid[g_sentN++] = pid;
}
bool     g_syncNow  = false;   // đặt true khi có lệnh vừa đóng, OnTimer sẽ gửi ngay

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

// Gộp mọi deal của 1 position thành 1 object JSON. Trả "" nếu position còn mở hoặc thiếu dữ liệu.
string BuildTrade(ulong pid)
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
      long   en = HistoryDealGetInteger(d, DEAL_ENTRY);
      double v  = HistoryDealGetDouble(d, DEAL_VOLUME);
      double p  = HistoryDealGetDouble(d, DEAL_PRICE);
      datetime t = (datetime)HistoryDealGetInteger(d, DEAL_TIME);
      profit += HistoryDealGetDouble(d, DEAL_PROFIT);
      comm   += HistoryDealGetDouble(d, DEAL_COMMISSION);
      swap   += HistoryDealGetDouble(d, DEAL_SWAP);
      fee    += HistoryDealGetDouble(d, DEAL_FEE);
      if(en == DEAL_ENTRY_IN)
      {
         pin = (vin * pin + v * p) / (vin + v);
         vin += v;
         if(tIn == 0 || t < tIn)
         {
            tIn = t;
            sym = HistoryDealGetString(d, DEAL_SYMBOL);
            cmt = HistoryDealGetString(d, DEAL_COMMENT);
            side = (type == DEAL_TYPE_BUY) ? "buy" : "sell";
            magic = HistoryDealGetInteger(d, DEAL_MAGIC);
            sl = HistoryDealGetDouble(d, DEAL_SL);
            tp = HistoryDealGetDouble(d, DEAL_TP);
         }
      }
      else if(en == DEAL_ENTRY_OUT || en == DEAL_ENTRY_OUT_BY)
      {
         pout = (vout * pout + v * p) / (vout + v);
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

void SyncDeals()
{
   const string gv = "SB_SYNC_T";                    // mốc đã đồng bộ xong (lưu bền trong terminal)
   datetime now = TimeCurrent();
   datetime from = GlobalVariableCheck(gv) ? (datetime)(long)GlobalVariableGet(gv) - 3600       // chồng 1 giờ cho chắc
                                           : now - (datetime)InpBackfillDays * 86400;
   if(!HistorySelect(from, now + 60)) return;

   ulong pids[];
   int total = HistoryDealsTotal();
   for(int i = 0; i < total; i++)
   {
      ulong d = HistoryDealGetTicket(i);
      if(d == 0) continue;
      long en = HistoryDealGetInteger(d, DEAL_ENTRY);
      if(en != DEAL_ENTRY_OUT && en != DEAL_ENTRY_OUT_BY) continue;
      ulong pid = (ulong)HistoryDealGetInteger(d, DEAL_POSITION_ID);
      if(pid == 0) continue;
      bool dup = false;
      for(int k = ArraySize(pids) - 1; k >= 0; k--) if(pids[k] == pid) { dup = true; break; }
      if(!dup && !IsSent(pid)) { int s = ArraySize(pids); ArrayResize(pids, s + 1); pids[s] = pid; }
   }

   int np = ArraySize(pids);
   long off = (long)MathRound((double)(TimeTradeServer() - TimeGMT()) / 900.0) * 900;   // lệch giờ server so với UTC (giây)
   string acct = (string)AccountInfoInteger(ACCOUNT_LOGIN);
   string items = "", resp;
   int cnt = 0, sent = 0;
   bool allOk = true;
   ulong chunk[];
   for(int k = 0; k < np; k++)
   {
      string t = BuildTrade(pids[k]);                // đổi vùng history đang chọn, nên danh sách pids đã lấy xong ở trên
      if(t != "") { items += (items == "" ? "" : ",") + t; cnt++; ArrayResize(chunk, cnt); chunk[cnt - 1] = pids[k]; }
      if(cnt > 0 && (cnt >= 20 || k == np - 1))
      {
         string body = "{\"account\":\"" + acct + "\",\"tzOffset\":" + (string)off + ",\"trades\":[" + items + "]}";
         if(Http("POST", "/api/ea/deals", body, resp) != 200) { allOk = false; break; }
         for(int q = 0; q < cnt; q++) MarkSent(chunk[q]);
         sent += cnt; cnt = 0; items = "";
      }
   }
   if(allOk) GlobalVariableSet(gv, (double)now);
   if(sent > 0) PrintFormat("SignalBridge: đã đồng bộ %d lệnh đã đóng lên API", sent);
}

// Khi có deal ĐÓNG vị thế (SL/TP/đóng tay/EA đóng) thì gửi ngay, không đợi nhịp 30 giây.
// Lệnh chờ Limit/Stop chưa khớp hoặc bị hủy không tạo deal nên không bao giờ được gửi.
void OnTradeTransaction(const MqlTradeTransaction &trans, const MqlTradeRequest &req, const MqlTradeResult &res)
{
   if(trans.type != TRADE_TRANSACTION_DEAL_ADD) return;
   if(!HistoryDealSelect(trans.deal)) return;
   long en = HistoryDealGetInteger(trans.deal, DEAL_ENTRY);
   if(en == DEAL_ENTRY_OUT || en == DEAL_ENTRY_OUT_BY) g_syncNow = true;
}

//------------------------------------------------------------------
// Gửi thông tin tài khoản (số dư, equity) để Journal khớp "Vốn" với MT5
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
// Khởi động / vòng lặp
//------------------------------------------------------------------
int OnInit()
{
   g_apiUrl = Trim(InpApiUrl);
   while(StringLen(g_apiUrl) > 0 && StringGetCharacter(g_apiUrl, StringLen(g_apiUrl) - 1) == '/')
      g_apiUrl = StringSubstr(g_apiUrl, 0, StringLen(g_apiUrl) - 1);
   if(StringFind(g_apiUrl, "https://") != 0 || InpToken == "")
   {
      Alert("SignalBridge Journal: cần nhập API URL (bắt đầu bằng https://) và EA key.");
      return INIT_PARAMETERS_INCORRECT;
   }
   EventSetTimer(1);
   PrintFormat("SignalBridge Journal chạy. Nhớ thêm %s vào danh sách WebRequest cho phép (Tools > Options > Expert Advisors).", g_apiUrl);
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EventKillTimer();
}

void OnTimer()
{
   if(g_syncNow || (InpSyncSec > 0 && TimeLocal() - g_lastSync >= InpSyncSec))   // đóng lệnh là gửi ngay; ngoài ra quét định kỳ cho chắc
   {
      g_syncNow = false;
      g_lastSync = TimeLocal();
      SyncDeals();
   }
   if(InpAcctSec > 0 && TimeLocal() - g_lastAcct >= InpAcctSec)
   {
      g_lastAcct = TimeLocal();
      SyncAccount();
   }
}

void OnTick() { }
