/* ================= ECONOMIC CALENDAR =================
   Trình duyệt chỉ gọi GET /api/calendar của Worker (kèm phiên Discord). Worker giữ địa chỉ + key của nguồn và cache trên R2;
   nguồn nào dùng do biến CAL_PROVIDER trong Worker quyết định ("fc" = financecalendar.com, "bq" = biquote.io), Worker trả kèm trường provider.
   Mọi nguồn được chuẩn hoá về {id,ts,date,country,ccy,title,impact,actual,forecast,previous,unit,url}. Cache localStorage 5 phút. */
window.CAL=(function(){
let PROV="fc";
const SRCS={fc:{n:"financecalendar.com",u:"https://www.financecalendar.com"},bq:{n:"biquote.io",u:"https://biquote.io"}};
const CCY={US:"USD",EU:"EUR",DE:"EUR",GB:"GBP",JP:"JPY",CA:"CAD",AU:"AUD",CN:"CNY",CH:"CHF",NZ:"NZD",NO:"NOK",SE:"SEK",IN:"INR",HK:"HKD"};
const ORD=["USD","EUR","GBP","JPY","AUD","CAD","CHF","NZD","CNY"],IMP=["high","medium","low"],IMPL={high:"Cao",medium:"Trung bình",low:"Thấp"};
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pad=n=>String(n).padStart(2,"0"),ymd=d=>d.toISOString().slice(0,10);
const tz=()=>typeof TZ==="string"?TZ:undefined;
const loc=()=>({vi:"vi-VN",en:"en-GB",zh:"zh-CN"}[(()=>{try{return localStorage.getItem("gx-lang")}catch{return""}})()]||"vi-VN");

/* ---------- chuẩn hoá ---------- */
const N={
  fc:j=>((j&&j.events)||[]).filter(e=>e.category!=="crypto"&&e.category!=="market-holidays").map(e=>{
    const t=Date.parse(e.release_at_utc||e.time_utc||"");   // thiếu giờ -> chỉ có ngày, KHÔNG coi là 00:00
    return{id:e.id,ts:isNaN(t)?null:t,date:e.date,country:e.country||"",ccy:CCY[e.country]||e.country||"",title:e.name||e.title||"",
      impact:IMP.includes(e.impact)?e.impact:"low",   // impact null -> coi là thấp
      actual:e.actual,forecast:e.consensus,previous:e.prior,unit:e.unit||"",url:e.source_url||e.url||""}}),
  bq:a=>(Array.isArray(a)?a:[]).filter(e=>e.type!=="holiday").map(e=>{
    const t=Date.parse(e.time||""),sf={thousands:"K",millions:"M",billions:"B",trillions:"T"}[e.multiplier]||"",f=v=>v==null?null:String(v)+sf;
    return{id:e.eventId,ts:isNaN(t)||e.timeMode!=="exact"?null:t,date:String(e.time||"").slice(0,10),country:e.countryCode||"",
      ccy:e.currency||CCY[e.countryCode]||"",title:e.name||"",impact:IMP.includes(e.importance)?e.importance:"low",
      actual:f(e.actual),forecast:f(e.forecast),previous:f(e.revisedPrevious!=null?e.revisedPrevious:e.previous),unit:"",url:""}})
};
async function load(){
  const key="gx_cal_v2";let old=null;
  try{old=JSON.parse(localStorage.getItem(key))}catch{}
  if(old&&Date.now()-old.at<3e5)return old;
  try{
    const j=await api("GET","/api/calendar");   // api() ở api.js: tự gắn phiên Discord, hết phiên thì về trang đăng nhập
    if(!j||!N[j.provider])throw new Error("nguồn lịch không được hỗ trợ");
    const o={at:Date.now(),prov:j.provider,ev:N[j.provider](j.data)};
    try{localStorage.setItem(key,JSON.stringify(o))}catch{}
    return o;
  }catch(e){if(old)return old;throw e}   // lỗi: dùng bản cache cũ nếu có
}

/* ---------- trạng thái + bộ lọc ---------- */
let EV=[],ERR="",BUSY=false,LAST=0,S={rng:"week",imp:["high","medium"],ccy:[]},root=null;
try{const x=JSON.parse(localStorage.getItem("gx_cal_f"));if(x)S=Object.assign(S,x)}catch{}
const save=()=>{try{localStorage.setItem("gx_cal_f",JSON.stringify(S))}catch{}};
const dk=(ts,date)=>ts==null?date:new Intl.DateTimeFormat("en-CA",{timeZone:tz()}).format(ts);   // YYYY-MM-DD theo múi giờ người dùng
function wk(o){const[y,m,d]=dk(Date.now()).split("-").map(Number),t=Date.UTC(y,m-1,d),a=t-((new Date(t).getUTCDay()+6)%7)*864e5+o*7*864e5;return[ymd(new Date(a)),ymd(new Date(a+6*864e5))]}
function rng(){const k=dk(Date.now());return S.rng==="today"?[k,k]:S.rng==="next"?wk(1):wk(0)}
const okF=e=>S.imp.includes(e.impact)&&(!S.ccy.length||S.ccy.includes(e.ccy));
function rows(){const[a,b]=rng();return EV.filter(e=>{const k=dk(e.ts,e.date);return k>=a&&k<=b&&okF(e)}).sort((x,y)=>dk(x.ts,x.date)<dk(y.ts,y.date)?-1:dk(x.ts,x.date)>dk(y.ts,y.date)?1:(x.ts==null?-1:x.ts)-(y.ts==null?-1:y.ts))}
function symCcy(){const s=String(typeof C!=="undefined"&&C.sym||"").toUpperCase(),o=new Set();
  new Set(Object.values(CCY)).forEach(c=>{if(s.includes(c))o.add(c)});if(/XAU|XAG|XTI|XBR|BTC|ETH|US30|US500|NAS|USTEC|DXY/.test(s))o.add("USD");return[...o]}

/* ---------- hiển thị ---------- */
const fmtT=ts=>new Intl.DateTimeFormat("en-GB",{timeZone:tz(),hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(ts);
const fmtD=(k)=>{const[y,m,d]=k.split("-").map(Number);return new Intl.DateTimeFormat(loc(),{timeZone:"UTC",weekday:"long",day:"2-digit",month:"2-digit"}).format(Date.UTC(y,m-1,d))};
function cd(ms){const s=Math.max(0,Math.floor(ms/1000)),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);return(d?d+"n ":"")+pad(h)+":"+pad(m)+":"+pad(s%60)}
const val=(v,u)=>v==null||v===""?"—":esc(v)+(u&&!/[%KMBT]$/i.test(String(v))?" "+esc(u):"");
const bars=i=>`<span class="cal-imp ${i}" title="${IMPL[i]}"><i></i><i></i><i></i></span>`;
function rowHtml(e,now){
  const past=e.ts!=null&&e.ts<=now,soon=e.ts!=null&&e.ts>now&&e.ts-now<864e5;
  const t=/^https?:\/\//i.test(e.url)?`<a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">${esc(e.title)}</a>`:esc(e.title);
  return`<tr class="cal-r${past?" past":""}"><td class="cal-tm">${e.ts==null?"—":fmtT(e.ts)}</td><td><b>${esc(e.ccy)}</b></td><td>${bars(e.impact)}</td><td class="cal-ev">${t}</td>`+
    `<td class="cal-n cal-a">${val(e.actual,e.unit)}</td><td class="cal-n">${val(e.forecast,e.unit)}</td><td class="cal-n">${val(e.previous,e.unit)}</td>`+
    `<td class="cal-n">${soon?`<span class="cal-cd" data-ts="${e.ts}">${cd(e.ts-now)}</span>`:""}</td></tr>`}
function bar(){
  const cs=[...new Set(EV.map(e=>e.ccy).filter(Boolean))].sort((a,b)=>(ORD.indexOf(a)<0?99:ORD.indexOf(a))-(ORD.indexOf(b)<0?99:ORD.indexOf(b))||a.localeCompare(b)),sc=symCcy();
  const ch=(on,act,v,l)=>`<button type="button" class="cal-chip${on?" on":""}" data-act="${act}" data-v="${esc(v)}">${l}</button>`;
  return`<div class="cal-grp">${[["today","Hôm nay"],["week","Tuần này"],["next","Tuần sau"]].map(([k,l])=>ch(S.rng===k,"rng",k,l)).join("")}</div>`+
    `<div class="cal-grp">${IMP.map(k=>ch(S.imp.includes(k),"imp",k,`<span class="cal-imp ${k}"><i></i><i></i><i></i></span> ${IMPL[k]}`)).join("")}</div>`+
    `<div class="cal-grp">${ch(!S.ccy.length,"ccyall","","Tất cả")}${cs.map(c=>ch(S.ccy.includes(c),"ccy",c,esc(c))).join("")}${sc.length?ch(false,"ccychart",sc.join(","),"Theo chart ("+esc(sc.join("/"))+")"):""}</div>`}
function render(){
  if(!root)return;const now=Date.now(),L=rows();let h="",last="";
  L.forEach(e=>{const k=dk(e.ts,e.date);if(k!==last){last=k;h+=`<tr class="cal-d"><td colspan="8">${esc(fmtD(k))}</td></tr>`}h+=rowHtml(e,now)});
  const q=root.querySelector("#calBody"),b=root.querySelector("#calBar"),sr=SRCS[PROV]||SRCS.fc;b.innerHTML=bar();
  root.querySelector("#calSrc").innerHTML=`Dữ liệu: <a href="${sr.u}" target="_blank" rel="noopener">${sr.n}</a>.${PROV==="fc"?" Nguồn này chưa có số Dự báo (consensus).":""}`;
  q.innerHTML=BUSY&&!EV.length?`<tr><td colspan="8" class="cal-empty">Đang tải lịch…</td></tr>`:ERR&&!EV.length?`<tr><td colspan="8" class="cal-empty">${esc(ERR)} <button type="button" class="cal-chip" data-act="retry">Thử lại</button></td></tr>`:
    h||`<tr><td colspan="8" class="cal-empty">Không có sự kiện nào khớp bộ lọc</td></tr>`;
  tick()}
function tick(){
  if(!root)return;const now=Date.now(),nx=EV.filter(e=>e.ts!=null&&e.ts>now&&okF(e)).sort((a,b)=>a.ts-b.ts)[0],el=root.querySelector("#calNext");
  el.innerHTML=nx?`<div class="msg">Sự kiện tiếp theo</div><div class="cal-cdb">${cd(nx.ts-now)}</div><div class="cal-nt">${bars(nx.impact)} <b>${esc(nx.ccy)}</b> ${esc(nx.title)} · ${fmtT(nx.ts)}</div>`:`<div class="msg">Sự kiện tiếp theo</div><div class="cal-cdb">—</div>`;
  root.querySelectorAll(".cal-cd").forEach(x=>{const d=+x.dataset.ts-now;x.textContent=d>0?cd(d):"vừa ra"});}
async function refresh(force){
  if(BUSY)return;BUSY=true;if(!EV.length)render();
  try{const o=await load();EV=o.ev;PROV=o.prov;ERR="";LAST=Date.now()}
  catch(e){LAST=Date.now();ERR="Không tải được lịch ("+(typeof jwhy==="function"?jwhy(e):e.message)+")"}
  BUSY=false;render()}
function click(ev){
  const b=ev.target.closest("[data-act]");if(!b)return;const a=b.dataset.act,v=b.dataset.v;
  if(a==="rng")S.rng=v;
  else if(a==="imp"){S.imp=S.imp.includes(v)?S.imp.filter(x=>x!==v):[...S.imp,v];if(!S.imp.length)S.imp=[v]}   // luôn giữ ít nhất một mức
  else if(a==="ccy")S.ccy=S.ccy.includes(v)?S.ccy.filter(x=>x!==v):[...S.ccy,v];
  else if(a==="ccyall")S.ccy=[];
  else if(a==="ccychart")S.ccy=v.split(",");
  else if(a==="retry")return refresh(true);
  save();render()}
function show(){
  root=document.getElementById("v-cal");if(!root)return;
  if(!root.dataset.ok){root.dataset.ok="1";
    root.innerHTML=`<div class="card cal"><div class="cal-top"><div><h2>Economic Calendar</h2><div class="msg">Giờ hiển thị theo múi giờ bạn chọn trong app</div></div><div class="cal-next" id="calNext"></div></div>`+
      `<div class="cal-bar" id="calBar"></div><div class="cal-wrap"><table class="cal-t"><thead><tr><th>Giờ</th><th>Tiền tệ</th><th>Tác động</th><th>Sự kiện</th><th class="cal-n">Thực tế</th><th class="cal-n">Dự báo</th><th class="cal-n">Trước đó</th><th class="cal-n">Đếm ngược</th></tr></thead><tbody id="calBody"></tbody></table></div>`+
      `<div class="msg cal-cr"><span id="calSrc"></span> Chỉ mang tính tham khảo, không phải lời khuyên đầu tư.</div></div>`;
    root.addEventListener("click",click);
    setInterval(()=>{if(typeof cur!=="undefined"&&cur==="cal"){tick();if(Date.now()-LAST>3e5)refresh(false)}},1000)}
  render();refresh(false)}
return{show,_N:N,_rows:rows,_cd:cd};
})();
