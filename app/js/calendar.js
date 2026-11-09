/* ================= ECONOMIC CALENDAR =================
   Trình duyệt chỉ gọi GET /api/calendar của Worker (kèm phiên Discord). Worker giữ địa chỉ + key của nguồn và cache trên R2;
   nguồn nào dùng do biến CAL_PROVIDER trong Worker quyết định ("fc" = financecalendar.com, "bq" = biquote.io), Worker trả kèm trường provider.
   Mọi nguồn được chuẩn hoá về {id,ts,date,country,ccy,title,impact,actual,forecast,previous,unit,url}. Cache localStorage 5 phút.
   Bộ lọc ngày: Hôm nay / Tuần này / Tuần sau / tuỳ chọn (một ngày hoặc một khoảng) qua hộp chọn ngày tự vẽ (#calPop, gắn vào <body>). */
window.CAL=(function(){
let PROV="fc";
const SRCS={fc:{n:"financecalendar.com",u:"https://www.financecalendar.com"},bq:{n:"biquote.io",u:"https://biquote.io"}};
const CCY={US:"USD",EU:"EUR",DE:"EUR",GB:"GBP",JP:"JPY",CA:"CAD",AU:"AUD",CN:"CNY",CH:"CHF",NZ:"NZD",NO:"NOK",SE:"SEK",IN:"INR",HK:"HKD"};
const ORD=["USD","EUR","GBP","JPY","AUD","CAD","CHF","NZD","CNY"],IMP=["high","medium","low"],IMPL={high:"Cao",medium:"Trung bình",low:"Thấp"};
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pad=n=>String(n).padStart(2,"0"),ymd=d=>d.toISOString().slice(0,10);
const tz=()=>typeof TZ==="string"?TZ:undefined;
const lang=()=>{try{if(window.I18N)return I18N.get()}catch{}try{return localStorage.getItem("gx-lang")||"vi"}catch{return"vi"}};
const loc=()=>({vi:"vi-VN",en:"en-GB",zh:"zh-CN"}[lang()]||"vi-VN");
const K=(vi,en,zh)=>({vi,en,zh}[lang()]||vi);   // chuỗi phụ thuộc ngữ cảnh (vd "Giờ" = Time, không phải Hours): tự chọn theo ngôn ngữ, không qua bảng i18n chung

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
/* S.rng: "today" | "week" | "next" | "custom" (khi custom: S.d1..S.d2 là YYYY-MM-DD, d1<=d2) */
let EV=[],ERR="",BUSY=false,LAST=0,S={rng:"week",imp:["high","medium"],ccy:[],d1:"",d2:""},root=null;
try{const x=JSON.parse(localStorage.getItem("gx_cal_f"));if(x)S=Object.assign(S,x)}catch{}
if(!["today","week","next"].includes(S.rng)){S.rng="week"}   // ngày tuỳ chọn không nhớ qua lần mở sau: luôn mở lại ở "Tuần này"
if(!Array.isArray(S.imp)||!S.imp.length)S.imp=["high","medium"];if(!Array.isArray(S.ccy))S.ccy=[];
const save=()=>{try{localStorage.setItem("gx_cal_f",JSON.stringify({rng:S.rng==="custom"?"week":S.rng,imp:S.imp,ccy:S.ccy}))}catch{}};
const dk=(ts,date)=>ts==null?date:new Intl.DateTimeFormat("en-CA",{timeZone:tz()}).format(ts);   // YYYY-MM-DD theo múi giờ người dùng
const U=k=>{const[y,m,d]=k.split("-").map(Number);return Date.UTC(y,m-1,d)};   // "YYYY-MM-DD" -> mili giây UTC lúc 00:00
const addD=(k,n)=>ymd(new Date(U(k)+n*864e5));
function wk(o){const[y,m,d]=dk(Date.now()).split("-").map(Number),t=Date.UTC(y,m-1,d),a=t-((new Date(t).getUTCDay()+6)%7)*864e5+o*7*864e5;return[ymd(new Date(a)),ymd(new Date(a+6*864e5))]}
function rng(){const k=dk(Date.now());return S.rng==="today"?[k,k]:S.rng==="next"?wk(1):S.rng==="custom"?[S.d1,S.d2<S.d1?S.d1:S.d2]:wk(0)}
const okF=e=>S.imp.includes(e.impact)&&(!S.ccy.length||S.ccy.includes(e.ccy));
function rows(){const[a,b]=rng();return EV.filter(e=>{const k=dk(e.ts,e.date);return k>=a&&k<=b&&okF(e)}).sort((x,y)=>dk(x.ts,x.date)<dk(y.ts,y.date)?-1:dk(x.ts,x.date)>dk(y.ts,y.date)?1:(x.ts==null?-1:x.ts)-(y.ts==null?-1:y.ts))}
function cover(){let a="",b="";EV.forEach(e=>{const k=dk(e.ts,e.date);if(!k)return;if(!a||k<a)a=k;if(k>b)b=k});return[a,b]}   // khoảng ngày mà nguồn dữ liệu đang có
function symCcy(){const s=String(typeof C!=="undefined"&&C.sym||"").toUpperCase(),o=new Set();
  new Set(Object.values(CCY)).forEach(c=>{if(s.includes(c))o.add(c)});if(/XAU|XAG|XTI|XBR|BTC|ETH|US30|US500|NAS|USTEC|DXY/.test(s))o.add("USD");return[...o]}

/* ---------- hiển thị ---------- */
const fmtT=ts=>new Intl.DateTimeFormat("en-GB",{timeZone:tz(),hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(ts);
const fmtD=(k)=>{const[y,m,d]=k.split("-").map(Number);return new Intl.DateTimeFormat(loc(),{timeZone:"UTC",weekday:"long",day:"2-digit",month:"2-digit"}).format(Date.UTC(y,m-1,d))};
const fmtS=k=>{const cy=+dk(Date.now()).slice(0,4);return new Intl.DateTimeFormat(loc(),Object.assign({timeZone:"UTC",day:"2-digit",month:"2-digit"},+k.slice(0,4)!==cy?{year:"numeric"}:{})).format(U(k))};   // ngắn: dd/mm (thêm năm nếu khác năm nay)
const fmtF=k=>new Intl.DateTimeFormat(loc(),{timeZone:"UTC",weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(U(k));
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
const fmtM=(y,m)=>cap(new Intl.DateTimeFormat(loc(),{timeZone:"UTC",month:"long",year:"numeric"}).format(Date.UTC(y,m,1)));
function cd(ms){const s=Math.max(0,Math.floor(ms/1000)),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);return(d?d+K("n","d","天")+" ":"")+pad(h)+":"+pad(m)+":"+pad(s%60)}
const val=(v,u)=>v==null||v===""?"—":esc(v)+(u&&!/[%KMBT]$/i.test(String(v))?" "+esc(u):"");
const bars=i=>`<span class="cal-imp ${i}" title="${IMPL[i]}"><i></i><i></i><i></i></span>`;
function rowHtml(e,now){
  const past=e.ts!=null&&e.ts<=now,soon=e.ts!=null&&e.ts>now&&e.ts-now<864e5;
  const t=/^https?:\/\//i.test(e.url)?`<a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">${esc(e.title)}</a>`:esc(e.title);
  return`<tr class="cal-r${past?" past":""}"><td class="cal-tm">${e.ts==null?"—":fmtT(e.ts)}</td><td><b>${esc(e.ccy)}</b></td><td>${bars(e.impact)}</td><td class="cal-ev">${t}</td>`+
    `<td class="cal-n cal-a">${val(e.actual,e.unit)}</td><td class="cal-n">${val(e.forecast,e.unit)}</td><td class="cal-n">${val(e.previous,e.unit)}</td>`+
    `<td class="cal-n">${soon?`<span class="cal-cd" data-ts="${e.ts}">${cd(e.ts-now)}</span>`:""}</td></tr>`}
const ICO='<svg class="cal-ic" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>';
function bar(){
  const cs=[...new Set(EV.map(e=>e.ccy).filter(Boolean))].sort((a,b)=>(ORD.indexOf(a)<0?99:ORD.indexOf(a))-(ORD.indexOf(b)<0?99:ORD.indexOf(b))||a.localeCompare(b)),sc=symCcy();
  const ch=(on,act,v,l)=>`<button type="button" class="cal-chip${on?" on":""}" data-act="${act}" data-v="${esc(v)}">${l}</button>`;
  const[a,b]=rng(),n=Math.round((U(b)-U(a))/864e5)+1,cu=S.rng==="custom",
    lbl=cu?(S.d1===S.d2?fmtS(S.d1):fmtS(S.d1)+" – "+fmtS(S.d2)):"Chọn ngày",
    pv=n===1?"Ngày trước":"Khoảng trước",nx=n===1?"Ngày sau":"Khoảng sau";
  return`<div class="cal-grp">${[["today","Hôm nay"],["week","Tuần này"],["next","Tuần sau"]].map(([k,l])=>ch(S.rng===k,"rng",k,l)).join("")}</div>`+
    `<div class="cal-grp cal-dp"><button type="button" class="cal-chip cal-ar" data-act="step" data-v="-1" title="${pv}" aria-label="${pv}">‹</button>`+
    `<button type="button" class="cal-chip cal-dpb${cu?" on":""}${PK.open?" open":""}" data-act="pk-open" aria-haspopup="dialog" aria-expanded="${PK.open}" title="Chọn ngày">${ICO}<span>${lbl}</span></button>`+
    `<button type="button" class="cal-chip cal-ar" data-act="step" data-v="1" title="${nx}" aria-label="${nx}">›</button></div>`+
    `<div class="cal-grp">${IMP.map(k=>ch(S.imp.includes(k),"imp",k,`<span class="cal-imp ${k}"><i></i><i></i><i></i></span> ${IMPL[k]}`)).join("")}</div>`+
    `<div class="cal-grp">${ch(!S.ccy.length,"ccyall","","Tất cả")}${cs.map(c=>ch(S.ccy.includes(c),"ccy",c,esc(c))).join("")}${sc.length?ch(false,"ccychart",sc.join(","),"Theo chart ("+esc(sc.join("/"))+")"):""}</div>`}
function render(){
  if(!root)return;const now=Date.now(),L=rows();let h="",last="";
  L.forEach(e=>{const k=dk(e.ts,e.date);if(k!==last){last=k;h+=`<tr class="cal-d"><td colspan="8">${esc(fmtD(k))}</td></tr>`}h+=rowHtml(e,now)});
  const q=root.querySelector("#calBody"),b=root.querySelector("#calBar"),sr=SRCS[PROV]||SRCS.fc;b.innerHTML=bar();
  root.querySelector("#calThT").textContent=K("Giờ","Time","时间");
  root.querySelector("#calSrc").innerHTML=`<span>Dữ liệu:</span> <a href="${sr.u}" target="_blank" rel="noopener">${sr.n}</a>.${PROV==="fc"?` <span>Nguồn này chưa có số Dự báo (consensus).</span>`:""}`;
  let emp="Không có sự kiện nào khớp bộ lọc";
  if(!h&&EV.length){const[ca,cb]=cover(),[ra,rb]=rng();if(ca&&(rb<ca||ra>cb))emp=`Không có dữ liệu cho khoảng ngày đã chọn. Nguồn hiện có dữ liệu từ ${fmtS(ca)} đến ${fmtS(cb)}.`}
  q.innerHTML=BUSY&&!EV.length?`<tr><td colspan="8" class="cal-empty">Đang tải lịch…</td></tr>`:ERR&&!EV.length?`<tr><td colspan="8" class="cal-empty">${esc(ERR)} <button type="button" class="cal-chip" data-act="retry">Thử lại</button></td></tr>`:
    h||`<tr><td colspan="8" class="cal-empty">${esc(emp)}</td></tr>`;
  renderPop();tick()}
function tick(){
  if(!root)return;const now=Date.now(),nx=EV.filter(e=>e.ts!=null&&e.ts>now&&okF(e)).sort((a,b)=>a.ts-b.ts)[0],el=root.querySelector("#calNext");
  el.innerHTML=nx?`<div class="msg">Sự kiện tiếp theo</div><div class="cal-cdb">${cd(nx.ts-now)}</div><div class="cal-nt">${bars(nx.impact)} <b>${esc(nx.ccy)}</b> ${esc(nx.title)} · ${fmtT(nx.ts)}</div>`:`<div class="msg">Sự kiện tiếp theo</div><div class="cal-cdb">—</div>`;
  root.querySelectorAll(".cal-cd").forEach(x=>{const d=+x.dataset.ts-now;x.textContent=d>0?cd(d):"vừa ra"});}
async function refresh(force){
  if(BUSY)return;BUSY=true;if(!EV.length)render();
  try{const o=await load();EV=o.ev;PROV=o.prov;ERR="";LAST=Date.now()}
  catch(e){LAST=Date.now();ERR="Không tải được lịch ("+(typeof jwhy==="function"?jwhy(e):e.message)+")"}
  BUSY=false;render()}

/* ---------- hộp chọn ngày (tự vẽ, gắn vào <body> để không bị backdrop-filter của thẻ làm lệch vị trí) ---------- */
/* PK.view: "d" = lưới ngày, "m" = lưới tháng của năm PK.y. PK.anch: ngày đầu của khoảng đang chọn dở. PK.foc: ngày đang giữ focus bàn phím. */
const PK={open:false,view:"d",y:0,m:0,anch:null,foc:"",fx:false};let pop=null,bd=null;
function mkPop(){
  if(pop)return;
  pop=document.createElement("div");pop.id="calPop";pop.className="cal-pp";pop.setAttribute("role","dialog");pop.setAttribute("aria-label","Chọn ngày hoặc khoảng ngày");pop.hidden=true;
  bd=document.createElement("div");bd.className="cal-bd";bd.hidden=true;
  document.body.append(bd,pop);
  pop.addEventListener("click",ev=>{ev.stopPropagation();click(ev)});   // stopPropagation: nội dung hộp bị vẽ lại ngay khi bấm, nên không để document tưởng là bấm ra ngoài
  bd.addEventListener("click",()=>closePop(false));
  pop.addEventListener("keydown",ev=>{
    if(ev.key==="Escape"){ev.stopPropagation();closePop(true);return}
    const b=ev.target.closest&&ev.target.closest('[data-act="pk-pick"]');if(!b||PK.view!=="d")return;
    const d={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[ev.key];
    if(d!=null){ev.preventDefault();goto(addD(b.dataset.v,d))}
    else if(ev.key==="PageUp"||ev.key==="PageDown"){ev.preventDefault();
      const[y,m,dd]=b.dataset.v.split("-").map(Number),t=new Date(Date.UTC(y,m-1+(ev.key==="PageUp"?-1:1),1)),
        last=new Date(Date.UTC(t.getUTCFullYear(),t.getUTCMonth()+1,0)).getUTCDate();
      goto(ymd(new Date(Date.UTC(t.getUTCFullYear(),t.getUTCMonth(),Math.min(dd,last)))))}});
  document.addEventListener("click",ev=>{if(PK.open&&!ev.target.closest("#calPop,[data-act=pk-open]"))closePop(false)});
  document.addEventListener("keydown",ev=>{if(PK.open&&ev.key==="Escape")closePop(true)});
  addEventListener("resize",()=>{if(PK.open)place()});
  addEventListener("scroll",()=>{if(PK.open)place()},true);
}
function goto(k){PK.foc=k;PK.y=+k.slice(0,4);PK.m=+k.slice(5,7)-1;PK.fx=true;renderPop()}
function openPop(){mkPop();const k=rng()[0];PK.open=true;PK.view="d";PK.anch=null;PK.y=+k.slice(0,4);PK.m=+k.slice(5,7)-1;PK.foc=k;PK.fx=true;render()}
function closePop(refocus){PK.open=false;PK.anch=null;render();if(refocus&&root){const b=root.querySelector('[data-act="pk-open"]');if(b)b.focus()}}
function popHtml(){
  const[a,b]=rng(),td=dk(Date.now()),cnt={},cy=+td.slice(0,4),cm=+td.slice(5,7)-1,Fm=o=>new Intl.DateTimeFormat(loc(),Object.assign({timeZone:"UTC"},o));
  EV.forEach(e=>{if(okF(e)){const k=dk(e.ts,e.date);if(k)cnt[k]=(cnt[k]||0)+1}});   // chấm nhỏ ở ngày có sự kiện (theo bộ lọc hiện tại)
  const dayV=PK.view==="d",
    head=`<div class="cal-ph"><button type="button" class="cal-pn" data-act="pk-nav" data-v="-1" title="${dayV?"Tháng trước":"Năm trước"}" aria-label="${dayV?"Tháng trước":"Năm trước"}">‹</button>`+
      `<button type="button" class="cal-pt" data-act="pk-view" title="Chọn tháng và năm" aria-label="Chọn tháng và năm" aria-live="polite">${dayV?esc(fmtM(PK.y,PK.m)):PK.y}<i class="cal-cv"></i></button>`+
      `<button type="button" class="cal-pn" data-act="pk-nav" data-v="1" title="${dayV?"Tháng sau":"Năm sau"}" aria-label="${dayV?"Tháng sau":"Năm sau"}">›</button></div>`;
  let body;
  if(dayV){
    const f=(new Date(Date.UTC(PK.y,PK.m,1)).getUTCDay()+6)%7,s0=Date.UTC(PK.y,PK.m,1)-f*864e5,wd=Fm({weekday:"short"});
    let g="";
    for(let i=0;i<42;i++){
      const t=s0+i*864e5,d=new Date(t),k=ymd(d),inr=k>=a&&k<=b,n=cnt[k]||0;
      const c=["cal-dy",d.getUTCMonth()!==PK.m?"out":"",k===td?"td":"",inr?"in":"",k===a?"rs":"",k===b?"re":"",n?"has":""].filter(Boolean).join(" ");
      g+=`<button type="button" class="${c}" data-act="pk-pick" data-v="${k}" tabindex="${k===PK.foc?0:-1}" aria-label="${esc(fmtF(k))}" aria-pressed="${inr}"${n?` title="${n} sự kiện"`:""}><span>${d.getUTCDate()}</span></button>`}
    body=`<div class="cal-wd">${Array.from({length:7},(_,i)=>`<span>${esc(wd.format(Date.UTC(2024,0,1+i)))}</span>`).join("")}</div><div class="cal-dg">${g}</div>`}
  else{
    const mn=Fm({month:"short"});
    body=`<div class="cal-mg">${Array.from({length:12},(_,i)=>`<button type="button" class="cal-mo${i===PK.m?" on":""}${PK.y===cy&&i===cm?" td":""}" data-act="pk-month" data-v="${i}">${esc(cap(mn.format(Date.UTC(2024,i,1))))}</button>`).join("")}</div>`}
  return head+body+
    `<div class="cal-pq">${[[-1,"Hôm qua"],[0,"Hôm nay"],[1,"Ngày mai"]].map(([o,l])=>`<button type="button" class="cal-chip" data-act="pk-qd" data-v="${o}">${l}</button>`).join("")}</div>`+
    `<div class="msg cal-ph2">${PK.anch?"Bấm ngày kết thúc, hoặc bấm lại đúng ngày này để chỉ xem một ngày.":"Bấm một ngày để xem, bấm thêm một ngày nữa để chọn cả khoảng."}</div>`+
    `<div class="cal-pf"><span class="cal-lg"><i class="cal-dot"></i><span>Ngày có sự kiện</span></span><span class="cal-sp"></span>`+
    `<button type="button" class="cal-chip" data-act="pk-reset">Về tuần này</button><button type="button" class="cal-chip on" data-act="pk-close">Xong</button></div>`}
function renderPop(){
  if(!pop)return;
  if(!PK.open){pop.hidden=true;bd.hidden=true;return}
  const ae=document.activeElement,keep=PK.fx?{act:"pk-pick",v:PK.foc}:pop.contains(ae)&&ae.dataset&&ae.dataset.act?{act:ae.dataset.act,v:ae.dataset.v}:null;   // giữ focus sau khi vẽ lại
  PK.fx=false;pop.innerHTML=popHtml();pop.hidden=false;bd.hidden=false;place();
  if(keep){const sel=a=>`[data-act="${a}"]`+(keep.v!=null&&a===keep.act?`[data-v="${keep.v}"]`:"");
    const t=pop.querySelector(sel(keep.act))||(keep.act==="pk-pick"?pop.querySelector(`[data-act="pk-pick"][data-v="${PK.foc}"]`):pop.querySelector(`[data-act="${keep.act}"]`));
    if(t)t.focus({preventScroll:true})}}
function place(){   // máy tính: neo dưới nút, hết chỗ thì mở lên trên; điện thoại: CSS biến thành bottom sheet
  if(!pop||pop.hidden)return;
  if(innerWidth<=560){pop.style.left=pop.style.top="";return}
  const btn=root&&root.querySelector('[data-act="pk-open"]');if(!btn)return;
  const r=btn.getBoundingClientRect(),w=pop.offsetWidth,h=pop.offsetHeight;
  let t=r.bottom+6;if(t+h>innerHeight-8&&r.top-h-6>8)t=r.top-h-6;
  pop.style.left=Math.max(8,Math.min(r.left,innerWidth-w-8))+"px";pop.style.top=Math.max(8,t)+"px"}

/* ---------- sự kiện ---------- */
function click(ev){
  const b=ev.target.closest("[data-act]");if(!b)return;const a=b.dataset.act,v=b.dataset.v;
  if(a==="rng"){S.rng=v;PK.anch=null}
  else if(a==="imp"){S.imp=S.imp.includes(v)?S.imp.filter(x=>x!==v):[...S.imp,v];if(!S.imp.length)S.imp=[v]}   // luôn giữ ít nhất một mức
  else if(a==="ccy")S.ccy=S.ccy.includes(v)?S.ccy.filter(x=>x!==v):[...S.ccy,v];
  else if(a==="ccyall")S.ccy=[];
  else if(a==="ccychart")S.ccy=v.split(",");
  else if(a==="retry")return refresh(true);
  else if(a==="step"){const[x,y]=rng(),n=Math.round((U(y)-U(x))/864e5)+1;S.rng="custom";S.d1=addD(x,+v*n);S.d2=addD(y,+v*n);PK.anch=null;   // dịch cả khoảng đang xem tới/lui đúng bằng độ dài của nó
    if(PK.open){PK.y=+S.d1.slice(0,4);PK.m=+S.d1.slice(5,7)-1;PK.foc=S.d1}}
  else if(a==="pk-open"){if(PK.open)return closePop(false);return openPop()}
  else if(a==="pk-close")return closePop(true);
  else if(a==="pk-reset"){S.rng="week";save();return closePop(true)}
  else if(a==="pk-nav"){if(PK.view==="d"){const t=new Date(Date.UTC(PK.y,PK.m+ +v,1));PK.y=t.getUTCFullYear();PK.m=t.getUTCMonth()}else PK.y+=+v;
    PK.foc=PK.y+"-"+pad(PK.m+1)+"-01";return renderPop()}
  else if(a==="pk-view"){PK.view=PK.view==="d"?"m":"d";return renderPop()}
  else if(a==="pk-month"){PK.m=+v;PK.view="d";PK.foc=PK.y+"-"+pad(PK.m+1)+"-01";PK.fx=true;return renderPop()}
  else if(a==="pk-qd"){const k=addD(dk(Date.now()),+v);S.rng="custom";S.d1=S.d2=k;save();return closePop(true)}
  else if(a==="pk-pick"){
    if(PK.anch==null){S.rng="custom";S.d1=S.d2=v;PK.anch=v;PK.foc=v;PK.y=+v.slice(0,4);PK.m=+v.slice(5,7)-1}   // bấm lần 1: xem ngay ngày đó, chờ ngày thứ hai để mở rộng thành khoảng
    else{const x=PK.anch<=v?[PK.anch,v]:[v,PK.anch];S.rng="custom";S.d1=x[0];S.d2=x[1];save();return closePop(true)}}
  save();render()}
function show(){
  root=document.getElementById("v-cal");if(!root)return;mkPop();
  if(!root.dataset.ok){root.dataset.ok="1";
    root.innerHTML=`<div class="card cal"><div class="cal-top"><div><h2>Economic Calendar</h2><div class="msg">Giờ hiển thị theo múi giờ bạn chọn trong app</div></div><div class="cal-next" id="calNext"></div></div>`+
      `<div class="cal-bar" id="calBar"></div><div class="cal-wrap"><table class="cal-t"><thead><tr><th id="calThT" data-no-i18n>Giờ</th><th>Tiền tệ</th><th>Tác động</th><th>Sự kiện</th><th class="cal-n">Thực tế</th><th class="cal-n">Dự báo</th><th class="cal-n">Trước đó</th><th class="cal-n">Đếm ngược</th></tr></thead><tbody id="calBody"></tbody></table></div>`+
      `<div class="msg cal-cr"><span id="calSrc"></span> <span>Chỉ mang tính tham khảo, không phải lời khuyên đầu tư.</span></div></div>`;
    root.addEventListener("click",click);
    document.addEventListener("gx-lang",()=>{if(root&&root.dataset.ok)render()});   // đổi ngôn ngữ: vẽ lại để ngày/tháng/đơn vị theo ngôn ngữ mới
    setInterval(()=>{if(typeof cur!=="undefined"&&cur==="cal"){tick();if(Date.now()-LAST>3e5)refresh(false)}else if(PK.open){PK.open=false;renderPop()}},1000)}
  render();refresh(false)}
return{show,_N:N,_rows:rows,_cd:cd,_rng:rng,_S:()=>S};
})();
