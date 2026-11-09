/* ===== Journal (tích hợp) ===== */
(function(){

const $=s=>document.querySelector(s);
let S={trades:[],setups:['Breakout','Pullback','Reversal','Range'],balance:10000};
try{const r=localStorage.getItem(GX.key('tjp_data'));if(r)S=Object.assign(S,JSON.parse(r))}catch(e){}
if(!Array.isArray(S.accounts))S.accounts=[];if(!Array.isArray(S.trades))S.trades=[];if(!Array.isArray(S.setups))S.setups=[];
S.accounts=S.accounts.filter(a=>a&&a.id!=null).map(a=>({...a,id:String(a.id),name:String(a.name||a.id),balance:+a.balance||0,type:a.type||'Live',dl:+a.dl>0?+a.dl:null,md:+a.md>0?+a.md:null}));
if(!S.accounts.length)S.accounts=[{id:'a1',name:'Tài khoản 1',balance:+S.balance||0,type:'Live',dl:null,md:null}];
S.trades.forEach(t=>{if(!S.accounts.some(a=>a.id===t.acc))t.acc=S.accounts[0].id});
if(S.cur!=='all'&&!S.accounts.some(a=>a.id===S.cur))S.cur=S.accounts[0].id;
const save=()=>{try{localStorage.setItem(GX.key('tjp_data'),JSON.stringify(S))}catch(e){}};
const TR=()=>S.cur==='all'?S.trades:S.trades.filter(t=>t.acc===S.cur);
const BAL=()=>S.cur==='all'?S.accounts.reduce((a,x)=>a+x.balance,0):(S.accounts.find(x=>x.id===S.cur)||{balance:0}).balance;
const A0=()=>S.cur==='all'?S.accounts[0].id:S.cur;
const uid=()=>{let i;do{i='a'+Date.now().toString(36)+Math.random().toString(36).slice(2,5)}while(S.accounts.some(a=>a.id===i));return i};
const dupName=(n,id)=>S.accounts.some(a=>a.id!==id&&a.name.trim().toLowerCase()===n.trim().toLowerCase());
let P={lang:'vi',theme:''};
try{Object.assign(P,JSON.parse(localStorage.getItem('tjp_prefs')||'{}'))}catch(e){}
if(!P.theme)P.theme=matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';
const savP=()=>{try{localStorage.setItem('tjp_prefs',JSON.stringify(P))}catch(e){}};
const EN={'Nhật ký giao dịch':'Trading Journal','Nhật ký lệnh':'Trade Log','Thêm lệnh':'Add trade','Ngày':'Date','Mã':'Symbol','Hướng':'Side','Lãi/lỗ ($)':'P/L ($)','R (tuỳ chọn)':'R (optional)','Ghi chú':'Notes','Lưu lệnh':'Save trade','Setup giao dịch':'Trading setups','Tên setup mới':'New setup name','Thêm setup':'Add setup','Tài khoản':'Account','Vốn ban đầu ($)':'Starting balance ($)','Lưu':'Save','Nạp dữ liệu mẫu':'Load sample data','Xoá toàn bộ lệnh':'Delete all trades','Xoá toàn bộ lệnh?':'Delete all trades?','VD: Opening range':'e.g. Opening range',
'Chưa có dữ liệu':'No data yet','Cần ít nhất 2 lệnh để vẽ đường vốn':'Add at least 2 trades to draw the equity curve','Lệnh':'Trade',
'Chưa có lệnh nào. Vào tab "Nhật ký lệnh" để thêm lệnh đầu tiên, hoặc nạp dữ liệu mẫu ở tab "Setup".':'No trades yet. Open the "Trade Log" tab to add your first trade, or load sample data in the "Setup" tab.',
'Lãi/lỗ ròng':'Net P/L','Tỷ lệ thắng':'Win rate','R trung bình':'Avg R','Số lệnh':'Trades','Vốn hiện tại':'Balance',
'Đường vốn':'Equity curve','Lãi/lỗ theo mã':'P/L by symbol','Thắng / thua':'Wins / losses','Lãi/lỗ theo setup':'P/L by setup','Số lệnh theo thị trường':'Trades by market',
'Thắng':'Win','Thua':'Loss','Hoà':'Breakeven','Chỉ số':'Indices','Kim loại':'Metals','Khác':'Other','Lãi/lỗ':'P/L',
'Chưa có lệnh nào.':'No trades yet.','Chưa có setup nào.':'No setups yet.','Xoá lệnh':'Delete trade','Xoá setup':'Delete setup','Sáng':'Light','Tối':'Dark','Vốn ban đầu':'Starting balance','Lãi/lỗ trong ngày':'Day P/L','Lệnh này':'This trade','Vốn':'Equity'};
Object.assign(EN,{'Loại':'Type','Giới hạn lỗ ngày ($)':'Daily loss limit ($)','Quy tắc rủi ro':'Risk rules','Lỗ trong ngày':'Daily loss','Drawdown từ đỉnh vốn':'Drawdown from peak','Đã chạm giới hạn':'Limit hit','Gần chạm giới hạn':'Near limit','Sửa lệnh':'Edit trade','Cập nhật lệnh':'Update trade','Huỷ sửa':'Cancel edit','Sao lưu dữ liệu':'Backup data','Phạm vi':'Scope','Xuất JSON':'Export JSON','Xuất CSV':'Export CSV','Nhập file':'Import file','Đã nhập':'Imported','File không hợp lệ':'Invalid file','Max drawdown ($)':'Max drawdown ($)','Tên tài khoản':'Account name','VD: Prop firm 50K':'e.g. Prop firm 50K','Thêm tài khoản':'Add account','Xoá tài khoản':'Delete account','Tất cả tài khoản':'All accounts','lệnh':'trades','Phân tích':'Analytics','Giá vào':'Entry','Giá ra':'Exit','Stop loss':'Stop loss','Phí ($)':'Fee ($)','Giờ vào lệnh':'Entry time','Cảm xúc':'Emotion','Lỗi mắc phải':'Mistake','R (trống = tự tính)':'R (blank = auto)','Lãi/lỗ trước phí ($)':'P/L before fees ($)','Expectancy / lệnh':'Expectancy / trade','TB lệnh thắng':'Avg win','TB lệnh thua':'Avg loss','Chuỗi thắng dài nhất':'Longest win streak','Chuỗi thua dài nhất':'Longest loss streak','Lệnh tốt nhất':'Best trade','Lệnh tệ nhất':'Worst trade','Tổng phí':'Total fees','Lãi/lỗ theo thứ':'P/L by weekday','Lãi/lỗ theo giờ':'P/L by hour','Lãi/lỗ theo tháng':'P/L by month','Lãi/lỗ theo cảm xúc':'P/L by emotion','Lãi/lỗ theo lỗi mắc phải':'P/L by mistake','Lịch lãi/lỗ':'P/L calendar','T2':'Mon','T3':'Tue','T4':'Wed','T5':'Thu','T6':'Fri','T7':'Sat','CN':'Sun','Bình tĩnh':'Calm','Tự tin':'Confident','Sợ hãi':'Fearful','Tham':'Greedy','Nóng vội':'Impatient','Chán nản':'Discouraged','Vào sớm':'Early','Vào muộn':'Late','Dời SL':'Moved SL','Lệch plan':'Off-plan'});
Object.assign(EN,{'RR (tự tính)':'RR (auto)','VD: 100':'e.g. 100','RR':'RR','Risk':'Risk'});
Object.assign(EN,{'Thẻ flex':'Flex card','Từ ngày':'From','Đến ngày':'To','Hiển thị':'Display','Tên hiển thị':'Display name','Tải ảnh PNG':'Download PNG','Chọn phiên bản':'Choose a style','Số tiền ($)':'Amount ($)','% trên vốn':'% of balance','Tổng R':'Total R'});
const tr=s=>P.lang==='en'&&EN[s]!==undefined?EN[s]:s;
const L=(vi,en)=>P.lang==='en'?en:vi;
function dlg(msg,ask){return new Promise(res=>{const o=document.createElement('div');o.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(0,0,10,.6);display:flex;align-items:center;justify-content:center;padding:16px';
 const b=document.createElement('div');b.className='card';b.style.cssText='max-width:420px;width:100%;background:var(--hole);color:var(--ink)';
 const p=document.createElement('p');p.style.cssText='margin:0 0 16px;line-height:1.5;white-space:pre-line';p.textContent=msg;
 const r=document.createElement('div');r.className='row';r.style.justifyContent='flex-end';
 const done=v=>{o.remove();document.removeEventListener('keydown',kd,true);res(v)};
 const kd=e=>{if(e.key==='Escape'){e.preventDefault();done(false)}};document.addEventListener('keydown',kd,true);
 if(ask){const c=document.createElement('button');c.className='btn ghost';c.type='button';c.textContent=L('Huỷ','Cancel');c.onclick=()=>done(false);r.append(c)}
 const k=document.createElement('button');k.className='btn';k.type='button';k.textContent=ask?L('Xác nhận','Confirm'):'OK';k.onclick=()=>done(true);r.append(k);
 b.append(p,r);o.append(b);o.onclick=e=>{if(e.target===o)done(false)};document.body.append(o);k.focus()})}
const ask=m=>dlg(m,true),note=m=>{dlg(m,false)};
function applyStatic(){}
const hdr=()=>{};const refresh=()=>{if(offline()){if(['jr','an','card'].includes(cur))jshow(cur);return}if(cur==='jr'||cur==='an')show(cur);else if(cur==='card')card()};
const money=n=>(n<0?'-':'')+'$'+Math.abs(n).toLocaleString('en-US',{maximumFractionDigits:2});
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const IDX=['NQ','ES','YM','RTY','NAS100','US30','SPX500'],MET=['GC','SI','HG','PL','XAUUSD','XAGUSD'];
// Broker hay thêm hậu tố (XAUUSD+, XAUUSD.a, XAUUSDm, XAUUSD_i...) -> bỏ hậu tố trước khi phân loại
const IDX_P=['NAS100','US100','USTEC','US30','DJ30','US500','SPX500','GER40','DE40','DAX','UK100','JP225','HK50','AUS200','FRA40','EU50'];
const MET_P=['XAU','XAG','XPT','XPD','GOLD','SILVER'];
const baseSym=s=>String(s).toUpperCase().split(/[^A-Z0-9]/)[0];
const market=s=>{const b=baseSym(s);
 if(IDX.includes(b)||IDX_P.some(p=>b.startsWith(p)))return 'Chỉ số';
 if(MET.includes(b)||MET_P.some(p=>b.startsWith(p)))return 'Kim loại';
 return /^[A-Z]{6}/.test(b)?'Forex':'Khác'};
const cls=n=>n>0?'win':n<0?'loss':'';
const PAL=['var(--c1)','var(--c2)','var(--c3)','var(--c4)','var(--c5)'];

function sum(map){const m=new Map();map.forEach(([k,v])=>m.set(k,(m.get(k)||0)+v));return [...m]}

function bar(data){
 if(!data.length)return '<div class="empty">'+tr('Chưa có dữ liệu')+'</div>';
 const W=400,H=200,top=18,bot=26,h=H-top-bot,vs=data.map(d=>d[1]);
 const mx=Math.max(0,...vs),mn=Math.min(0,...vs),rg=(mx-mn)||1,y=v=>top+(mx-v)/rg*h;
 const bw=Math.min(44,W/data.length*0.6),st=W/data.length;
 let o=`<svg viewBox="0 0 ${W} ${H}"><line x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}" stroke="var(--line)"/>`;
 data.forEach(([l,v],i)=>{const x=st*i+(st-bw)/2,y0=y(0),y1=y(v),yy=Math.min(y0,y1);
  o+=`<rect x="${x}" y="${yy}" width="${bw}" height="${Math.max(Math.abs(y1-y0),1)}" rx="3" class="grow" style="transform-origin:center ${v>=0?'bottom':'top'};transform-box:fill-box;animation-delay:${i*70}ms" fill="var(${v>=0?'--win':'--loss'})"/>`;
  o+=`<text class="v" x="${x+bw/2}" y="${v>=0?yy-4:yy+Math.abs(y1-y0)+11}" text-anchor="middle">${Math.round(v)}</text>`;
  o+=`<text class="t" x="${x+bw/2}" y="${H-8}" text-anchor="middle">${esc(l.slice(0,9))}</text>`});
 return o+'</svg>';
}

function pie(items){
 items=items.filter(i=>i.v>0);const T=items.reduce((a,b)=>a+b.v,0);
 if(!T)return '<div class="empty">'+tr('Chưa có dữ liệu')+'</div>';
 const r=70,c=75;let a=-Math.PI/2,p='';
 items.forEach(it=>{const f=it.v/T;
  if(f>=0.9999){p+=`<circle cx="${c}" cy="${c}" r="${r}" fill="${it.c}"/>`;return}
  const b=a+f*2*Math.PI,x1=c+r*Math.cos(a),y1=c+r*Math.sin(a),x2=c+r*Math.cos(b),y2=c+r*Math.sin(b);
  p+=`<path d="M${c} ${c}L${x1} ${y1}A${r} ${r} 0 ${f>0.5?1:0} 1 ${x2} ${y2}Z" fill="${it.c}"/>`;a=b});
 return `<div class="pie"><svg viewBox="0 0 150 150">${p}<circle cx="${c}" cy="${c}" r="38" fill="var(--hole)"/><text x="${c}" y="${c+5}" text-anchor="middle" class="v" style="font-size:14px">${T}</text></svg><div class="legend" style="flex-direction:column">${items.map(i=>`<span><i style="background:${i.c}"></i>${esc(i.l)}: ${i.v} (${Math.round(i.v/T*100)}%)</span>`).join('')}</div></div>`;
}

let EQ=null;
function line(pts,ts){
 if(pts.length<2){EQ=null;return '<div class="empty">'+tr('Cần ít nhất 2 lệnh để vẽ đường vốn')+'</div>'}
 const M=mob(),W=M?420:800,H=M?250:230,p=M?42:34,n=pts.length-1,mn=Math.min(...pts),mx=Math.max(...pts),rg=(mx-mn)||1;
 const X=i=>p+i/n*(W-p-12),Y=v=>12+(mx-v)/rg*(H-44),B=H-32;
 EQ={X,Y,pts,ts,W,n,p};
 const d=pts.map((v,i)=>`${i?'L':'M'}${X(i)} ${Y(v)}`).join('');
 const fd=q=>q.slice(8)+'/'+q.slice(5,7);
 const k=Math.min(n,M?5:7),idx=[...new Set(Array.from({length:k},(_,j)=>Math.round(1+j*(n-1)/Math.max(k-1,1))))];
 const lab=idx.map(i=>`<line x1="${X(i)}" x2="${X(i)}" y1="${B}" y2="${B+4}" stroke="var(--line)"/><text class="t" x="${X(i)}" y="${H-12}" text-anchor="middle">${fd(ts[i-1].date)}</text>`).join('');
 return `<div class="eqw"><svg viewBox="0 0 ${W} ${H}"><line x1="${p}" x2="${W-12}" y1="${Y(pts[0])}" y2="${Y(pts[0])}" stroke="var(--line)" stroke-dasharray="4 4"/><path d="${d}L${X(n)} ${B}L${X(0)} ${B}Z" class="fade" fill="var(--acc)" opacity=".15"/><path d="${d}" class="draw" pathLength="1" fill="none" stroke="var(--acc)" stroke-width="2.5" stroke-linejoin="round"/><text class="t" x="0" y="${Y(mx)+4}">${Math.round(mx)}</text><text class="t" x="0" y="${Y(mn)+4}">${Math.round(mn)}</text>${lab}<g class="hv" style="display:none"><line y1="12" y2="${B}" stroke="var(--mut)" stroke-dasharray="3 3"/><circle r="${M?4:5}" fill="var(--acc)" stroke="#fff" stroke-width="${M?1.8:2}"/></g></svg><div class="tip"></div></div>`;
}
function hover(){
 const w=$('.eqw');if(!w||!EQ)return;
 const sv=w.querySelector('svg'),tip=w.querySelector('.tip'),g=w.querySelector('.hv'),ln=g.children[0],ci=g.children[1];
 const lf=q=>q.split('-').reverse().join('/');
 const mv=e=>{const r=sv.getBoundingClientRect(),rel=(e.clientX-r.left)/r.width*EQ.W;
  const i=Math.max(0,Math.min(EQ.n,Math.round((rel-EQ.p)/(EQ.W-EQ.p-12)*EQ.n)));
  const x=EQ.X(i),y=EQ.Y(EQ.pts[i]);
  ln.setAttribute('x1',x);ln.setAttribute('x2',x);ci.setAttribute('cx',x);ci.setAttribute('cy',y);g.style.display='block';
  let h;const M=mob();
  if(M){const sg=(v,tx)=>`<b class="${cls(v)}">${tx}</b>`;
   if(!i)h=`<div class="tl"><b>${tr('Vốn ban đầu')}</b><span>${money(EQ.pts[0])}</span></div>`;
   else{const t=EQ.ts[i-1],day=EQ.ts.filter(q=>q.date===t.date),dn=day.reduce((a,q)=>a+q.pnl,0),dw=day.filter(q=>q.pnl>0).length,dl=day.filter(q=>q.pnl<0).length;
    h=`<div class="tl"><b>${lf(t.date)}</b><span>${tr('Lãi/lỗ trong ngày')}: ${sg(dn,money(dn))}</span><span>${day.length} trade${day.length>1?'s':''} (${dw}W/${dl}L)</span></div><div class="tl"><span>${esc(t.symbol)} ${t.side} · ${esc(t.setup)}</span>${sg(t.pnl,money(t.pnl)+(t.r===null||isNaN(t.r)?'':' ('+t.r+'R)'))}<span>${tr('Vốn')}: ${money(EQ.pts[i])}</span></div>`}
   tip.innerHTML=h;tip.style.display='block';tip.style.left='';return}
  if(!i)h=`<b>${tr('Vốn ban đầu')}</b><br>${money(EQ.pts[0])}`;
  else{const t=EQ.ts[i-1],day=EQ.ts.filter(q=>q.date===t.date),dn=day.reduce((a,q)=>a+q.pnl,0),dw=day.filter(q=>q.pnl>0).length,dl=day.filter(q=>q.pnl<0).length;
   h=`<b>${lf(t.date)}</b><br>${tr('Lãi/lỗ trong ngày')}: <b class="${cls(dn)}">${money(dn)}</b><br>${tr('Số lệnh')}: ${day.length} (${dw} ${tr('Thắng')} / ${dl} ${tr('Thua')})<hr>${tr('Lệnh này')}: ${esc(t.symbol)} ${t.side} · ${esc(t.setup)}<br><b class="${cls(t.pnl)}">${money(t.pnl)}</b>${t.r===null||isNaN(t.r)?'':' ('+t.r+'R)'}<br>${tr('Vốn')}: ${money(EQ.pts[i])}`}
  tip.innerHTML=h;tip.style.display='block';
  const hw=tip.offsetWidth/2;tip.style.left=Math.max(hw,Math.min(r.width-hw,x/EQ.W*r.width))+'px'};
 sv.onpointermove=mv;sv.onpointerdown=mv;
 if(mob()){tip.innerHTML='<span class="hint">'+L('Chạm hoặc kéo ngang trên biểu đồ để xem từng ngày','Tap or drag across the chart to see each day')+'</span>';tip.style.display='block'}
 sv.onpointerleave=()=>{if(mob())return;g.style.display='none';tip.style.display='none'};
}

function stats(ts){
 const w=ts.filter(t=>t.pnl>0),l=ts.filter(t=>t.pnl<0),net=ts.reduce((a,t)=>a+t.pnl,0);
 const gw=w.reduce((a,t)=>a+t.pnl,0),gl=Math.abs(l.reduce((a,t)=>a+t.pnl,0));
 const rs=ts.filter(t=>t.r!==null&&!isNaN(t.r));
 return{n:ts.length,w:w.length,l:l.length,be:ts.length-w.length-l.length,net,wr:ts.length?w.length/ts.length*100:0,pf:gl?gw/gl:(gw?Infinity:0),avgR:rs.length?rs.reduce((a,t)=>a+t.r,0)/rs.length:null};
}

function dash(){
 const ts=[...TR()].sort((a,b)=>a.date.localeCompare(b.date)),s=stats(ts);
 if(!ts.length){$('#v-dash').innerHTML='<div class="card empty">'+'Chưa có lệnh nào được đồng bộ. Lệnh sẽ tự xuất hiện ngay sau khi đóng lệnh trên MT5.'+'</div>';return}
 let eq=BAL();const pts=[eq];ts.forEach(t=>{eq+=t.pnl;pts.push(eq)});
 const k=(a,b,c)=>`<div class="card kpi"><span>${tr(a)}</span><b class="${c||''}">${b}</b></div>`;
 $('#v-dash').innerHTML=`${rules()}<div class="grid kpis">
 ${k('Lãi/lỗ ròng',money(s.net),cls(s.net))}${k('Tỷ lệ thắng',s.wr.toFixed(1)+'%')}
 ${k('Profit factor',s.pf===Infinity?'∞':s.pf.toFixed(2))}${k('R trung bình',s.avgR===null?'–':s.avgR.toFixed(2)+'R')}
 ${k('Số lệnh',s.n)}${k('Vốn hiện tại',money(BAL()+s.net))}</div>
 <div class="card"><h2>${tr('Đường vốn')}</h2>${line(pts,ts)}</div>
 <div class="grid two">
 <div class="card"><h2>${tr('Lãi/lỗ theo mã')}</h2>${bar(sum(ts.map(t=>[t.symbol,t.pnl])))}</div>
 <div class="card"><h2>${tr('Thắng / thua')}</h2>${pie([{l:tr('Thắng'),v:s.w,c:'var(--win)'},{l:tr('Thua'),v:s.l,c:'var(--loss)'},{l:tr('Hoà'),v:s.be,c:'var(--be)'}])}</div>
 <div class="card"><h2>${tr('Lãi/lỗ theo setup')}</h2>${bar(sum(ts.map(t=>[t.setup,t.pnl])))}</div>
 <div class="card"><h2>${tr('Số lệnh theo thị trường')}</h2>${pie(sum(ts.map(t=>[market(t.symbol),1])).map((m,i)=>({l:tr(m[0]),v:m[1],c:PAL[i%5]})))}</div>
 </div>`;
}

function log(){
 const ts=[...TR()].sort((a,b)=>(b.date+(b.time||'')).localeCompare(a.date+(a.time||'')));
 $('#tbl').innerHTML=ts.length?`<table><thead><tr>${['Ngày','Giờ vào','Mã','Hướng','Giá vào','SL','TP','Giá ra','Lãi/lỗ','R'].map(x=>`<th>${x}</th>`).join('')}<th></th></tr></thead><tbody>${ts.map(t=>`<tr><td>${t.date}</td><td>${t.time||'–'}</td><td>${esc(t.symbol)}</td><td>${t.side}</td><td>${t.en==null?'–':t.en}</td><td>${t.sl>0?t.sl:'–'}</td><td>${t.tp>0?t.tp:'–'}</td><td>${t.ex==null?'–':t.ex}</td><td class="${cls(t.pnl)}">${money(t.pnl)}</td><td>${t.sl>0&&t.r!=null&&!isNaN(t.r)?t.r+'R':'–'}</td><td><button class="x" data-sh="${t.id}" title="Share Flex Card">↗ Share</button></td></tr>`).join('')}</tbody></table>`:'<div class="empty">Chưa có lệnh nào được đồng bộ.</div>';
}


const EM=['Bình tĩnh','Tự tin','Sợ hãi','Tham','Nóng vội','Chán nản'],MS=['','FOMO','Vào sớm','Vào muộn','Dời SL','Lệch plan','Overtrade'];
const opt=a=>['',...a].filter((x,i,r)=>r.indexOf(x)===i).map(x=>`<option value="${x}">${x?tr(x):'–'}</option>`).join('');
let CAL=new Date();CAL.setDate(1);
function an(){
 const ts=[...TR()].sort((a,b)=>a.date.localeCompare(b.date));
 if(!ts.length){$('#v-an').innerHTML='<div class="card empty">'+tr('Chưa có dữ liệu')+'</div>';return}
 const s=stats(ts),W=ts.filter(t=>t.pnl>0),L=ts.filter(t=>t.pnl<0),av=a=>a.length?a.reduce((x,t)=>x+t.pnl,0)/a.length:0;
 let eq=BAL(),pk=eq,dd=0,ddp=0,cw=0,cl=0,bw=0,bl=0;
 ts.forEach(t=>{eq+=t.pnl;pk=Math.max(pk,eq);const d=pk-eq;if(d>dd){dd=d;ddp=pk>0?d/pk*100:0}
  if(t.pnl>0){cw++;cl=0}else if(t.pnl<0){cl++;cw=0}else cw=cl=0;bw=Math.max(bw,cw);bl=Math.max(bl,cl)});
 const ps=ts.map(t=>t.pnl),k=(a,b,c)=>`<div class="card kpi"><span>${tr(a)}</span><b class="${c||''}">${b}</b></div>`;
 const wd=['CN','T2','T3','T4','T5','T6','T7'],m=sum(ts.map(t=>[new Date(t.date+'T00:00').getDay(),t.pnl]));
 const byWd=[1,2,3,4,5,6,0].filter(i=>m.some(x=>x[0]===i)).map(i=>[tr(wd[i]),m.find(x=>x[0]===i)[1]]);
 const byMo=sum(ts.map(t=>[t.date.slice(0,7),t.pnl]));
 const cy=CAL.getFullYear(),cm=CAL.getMonth(),dm=new Date(cy,cm+1,0).getDate(),off=(new Date(cy,cm,1).getDay()+6)%7,pre=cy+'-'+String(cm+1).padStart(2,'0');
 const day={},cnt={};ts.forEach(t=>{day[t.date]=(day[t.date]||0)+t.pnl;cnt[t.date]=(cnt[t.date]||0)+1});
 const cmx=Math.max(1,...Object.values(day).map(Math.abs)),mt=Object.entries(day).filter(([d])=>d.startsWith(pre)).reduce((a,[,v])=>a+v,0);
 let cal=['T2','T3','T4','T5','T6','T7','CN'].map(x=>`<span style="color:var(--mut);font-size:11px">${tr(x)}</span>`).join('');
 for(let i=0;i<off;i++)cal+='<div></div>';
 for(let d=1;d<=dm;d++){const v=day[pre+'-'+String(d).padStart(2,'0')];
  cal+=`<div style="background:${v===undefined?'var(--inp)':`color-mix(in srgb,var(${v>=0?'--win':'--loss'}) ${Math.round(15+Math.abs(v)/cmx*55)}%,transparent)`}"><span>${d}</span>${v===undefined?'':`<b>${Math.round(v)}</b><small>${cnt[pre+'-'+String(d).padStart(2,'0')]} trade${cnt[pre+'-'+String(d).padStart(2,'0')]>1?'s':''}</small>`}</div>`}
 $('#v-an').innerHTML=`<div class="grid kpis">
 ${k('Max drawdown',money(-dd)+' ('+ddp.toFixed(1)+'%)','loss')}${k('Expectancy / lệnh',money(s.net/s.n),cls(s.net))}
 ${k('TB lệnh thắng',money(av(W)),'win')}${k('TB lệnh thua',money(av(L)),'loss')}
 ${k('Chuỗi thắng dài nhất',bw)}${k('Chuỗi thua dài nhất',bl)}
 ${k('Lệnh tốt nhất',money(Math.max(...ps)),'win')}${k('Lệnh tệ nhất',money(Math.min(...ps)),'loss')}${k('Tổng phí',money(ts.reduce((a,t)=>a+(t.fee||0),0)))}</div>
 <div class="card"><div class="row" style="justify-content:space-between;align-items:center"><h2>${tr('Lịch lãi/lỗ')} · ${cm+1}/${cy} (<span class="${cls(mt)}">${money(mt)}</span>)</h2><span><button class="x" data-m="-1">◀</button> <button class="x" data-m="1">▶</button></span></div><div class="cal">${cal}</div></div>
 <div class="grid two">
 <div class="card"><h2>${tr('Lãi/lỗ theo thứ')}</h2>${bar(byWd)}</div>
  <div class="card"><h2>${tr('Lãi/lỗ theo tháng')}</h2>${bar(byMo)}</div>
  </div>`;
}
function rules(){
 return (S.cur==='all'?S.accounts:S.accounts.filter(a=>a.id===S.cur)).filter(a=>a.dl||a.md).map(a=>{
  const ts=S.trades.filter(t=>t.acc===a.id).sort((x,y)=>x.date.localeCompare(y.date)),t0=td();
  const dayL=Math.max(0,-ts.filter(t=>t.date===t0).reduce((q,t)=>q+t.pnl,0));
  let eq=a.balance,pk=eq;ts.forEach(t=>{eq+=t.pnl;pk=Math.max(pk,eq)});
  const b=(lab,u,lim)=>{if(!lim)return '';const q=u/lim*100,c=q>=100?'--loss':q>=80?'--c2':'--win';
   return `<div style="margin-top:8px"><div class="row" style="justify-content:space-between"><span>${tr(lab)}</span><span class="${q>=100?'loss':''}">${money(u)} / ${money(lim)} (${Math.round(q)}%)${q>=100?' ⚠ '+tr('Đã chạm giới hạn'):q>=80?' ⚠ '+tr('Gần chạm giới hạn'):''}</span></div><div style="height:6px;border-radius:4px;background:var(--inp);margin-top:4px"><div style="width:${Math.min(100,q)}%;height:100%;border-radius:4px;background:var(${c})"></div></div></div>`};
  return `<div class="card" style="margin-bottom:14px"><h2>${esc(a.name)} · ${tr('Quy tắc rủi ro')}</h2>${b('Lỗ trong ngày',dayL,a.dl)}${b('Drawdown từ đỉnh vốn',pk-eq,a.md)}</div>`}).join('');
}
const mq=matchMedia('(max-width:760px)'),mob=()=>mq.matches;
mq.addEventListener('change',()=>{if(cur==='jr')show('jr')});
const go=v=>show(v==='log'||v==='dash'?'jr':v);
const offline=()=>!(JC.url&&JC.token);
const notice=()=>'<div class="card empty"><b>Chưa kết nối API</b><br>Vào mục <a href="#" data-goconn style="color:var(--acc);font-weight:700">Kết nối</a> để nhập API URL và Secret token. Sau khi kết nối, Journal sẽ tự đồng bộ lệnh từ MT5 mỗi khi lệnh đóng.</div>';
document.addEventListener('click',e=>{if(e.target.closest('[data-goconn]')){e.preventDefault();show('conn')}});
function jshow(v){
 const jr=v==='jr';
 if(jr){$('#tbl').style.display=$('#jh').style.display=$('#sybar').style.display=offline()?'none':''}
 if(offline()){if(jr)$('#v-dash').innerHTML=notice();else $('#v-'+v).innerHTML=notice();return}
 if(jr){dash();hover();log()}if(v==='an')an();if(v==='card'){if(!CD.keep)CD.tid=null;CD.keep=0;card()}}
window.JR={show:jshow,sync:()=>syncMT5(false),
 // xoá các lệnh lấy từ MT5 (giữ lệnh nhập tay) rồi đặt lại mốc đồng bộ -- dùng khi tạo key mới + chọn xoá journal cũ
 wipeMT5:()=>{S.trades=S.trades.filter(t=>!String(t.id).startsWith('mt5-'));SY.since=0;SY.map={};saveSY();save();refresh()}};

const td=()=>new Date(Date.now()-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,10);
$('#v-an').onclick=e=>{const m=e.target.dataset.m;if(m){CAL.setMonth(CAL.getMonth()+ +m);an()}};
$('#tbl').onclick=e=>{const sh=e.target.dataset.sh;if(sh){CD.tid=sh;CD.keep=1;show('card')}};
const saveBlob=(b,n)=>{const u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=n;a.style.display='none';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),6e4)};
/* ===== Flex card ===== */
const FMT={land:[1200,756],sq:[1200,1200],p45:[1200,1500],st:[1080,1920]};
let CF=FMT[P.cfm]?P.cfm:'land',CW=FMT[CF][0],CH=FMT[CF][1];
const isLS=()=>CF==='land',sx=v=>v*CW/1200,sy=v=>v*CH/756;
const LYP={sq:{F:150,af:38,sl:24,sv:60,pit:128,nf:28,lf:28,tf:38,rf:26,hy:88,bp:64},p45:{F:180,af:44,sl:28,sv:72,pit:150,nf:30,lf:30,tf:40,rf:28,hy:96,bp:72},st:{F:170,af:48,sl:30,sv:78,pit:166,nf:34,lf:34,tf:44,rf:30,hy:270,bp:300}};
function LY(){const p=LYP[CF]||LYP.sq,pb=p.lf+12+Math.round(p.F*.72),ab=pb+Math.round(p.af*1.65),dv=ab+Math.round(p.af*1.1),sl0=Math.round(p.sl*2.3),sv0=Math.round(p.sv*1.05),nb=dv+sl0+sv0+p.pit+Math.round(p.nf*2.8),y0=CH-p.bp-nb;
 return Object.assign({pb,ab,dv,sl0,sv0,nb,y0,cy:Math.round((p.hy+p.rf*2+y0-20)/2)},p)}
const fp=(ox,oy)=>isLS()?[ox,oy]:[CW/2,LY().cy];
const mkRng=s=>()=>(s=(s*1664525+1013904223)%4294967296)/4294967296;
const stars=(c,r,n,col,mx)=>{for(let i=0;i<n;i++){const z=r()*r();c.globalAlpha=.25+.75*z;c.fillStyle=col;c.beginPath();c.arc(r()*CW,r()*CH,z*mx+.4,0,6.283);c.fill()}c.globalAlpha=1};
const blob=(c,x,y,R,rgb,a)=>{const g=c.createRadialGradient(x,y,0,x,y,R);g.addColorStop(0,`rgba(${rgb},${a})`);g.addColorStop(.5,`rgba(${rgb},${a*.35})`);g.addColorStop(1,`rgba(${rgb},0)`);c.fillStyle=g;c.fillRect(x-R,y-R,R*2,R*2)};
const rr=(c,x,y,w,h,r)=>{c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()};
function planetIco(c,x,y,R,lt){c.save();c.translate(x,y);
 const ring=(a,b)=>{c.beginPath();c.ellipse(0,0,R*1.9,R*.5,-.38,a,b);c.stroke()},rc=lt?'rgba(200,120,10,.95)':'rgba(255,200,87,.9)';
 c.lineWidth=Math.max(2,R*.16);c.strokeStyle=rc;ring(Math.PI,Math.PI*2);
 const g=c.createRadialGradient(-R*.35,-R*.35,R*.1,0,0,R);g.addColorStop(0,lt?'#b9aaff':'#d6d0ff');g.addColorStop(.55,'#6a55e8');g.addColorStop(1,'#251a6e');
 c.shadowColor='rgba(139,124,255,.8)';c.shadowBlur=R*.9;c.fillStyle=g;c.beginPath();c.arc(0,0,R,0,6.283);c.fill();c.shadowBlur=0;
 c.strokeStyle=rc;ring(0,Math.PI);c.restore()}

const BGF={
hole(c,r){const [X,Y]=fp(830,372),HR=84;
 c.fillStyle='#02030a';c.fillRect(0,0,CW,CH);
 blob(c,X,Y,640,'70,50,190',.38);blob(c,sx(180),sy(700),520,'20,100,210',.2);blob(c,X,Y,340,'255,140,40',.26);
 stars(c,r,280,'#fff',1.7);
 const disk=(a,b,k0)=>{c.save();c.translate(X,Y);c.rotate(-.3);c.globalCompositeOperation='lighter';
  for(let k=0;k<44;k++){const rx=HR+30+k*5.4;c.strokeStyle=`hsla(${46-k*.75},100%,${80-k*1.2}%,${Math.max(.04,(.55-k*.011)*k0)})`;c.lineWidth=2.6;c.beginPath();c.ellipse(0,0,rx,rx*.2,0,a,b);c.stroke()}c.restore()};
 disk(Math.PI,Math.PI*2,.9);
 c.save();c.globalCompositeOperation='lighter';
 for(let k=0;k<14;k++){c.strokeStyle=`hsla(${40-k},100%,${72-k*2}%,${.5-k*.032})`;c.lineWidth=2.2;c.beginPath();c.arc(X,Y,HR+8+k*3.6,0,6.283);c.stroke()}c.restore();
 c.fillStyle='#000';c.shadowColor='rgba(255,170,70,.9)';c.shadowBlur=36;c.beginPath();c.arc(X,Y,HR,0,6.283);c.fill();c.shadowBlur=0;
 c.strokeStyle='rgba(255,226,170,.85)';c.lineWidth=2;c.beginPath();c.arc(X,Y,HR,0,6.283);c.stroke();
 disk(0,Math.PI,1.25)},
nebula(c,r){c.fillStyle='#06041a';c.fillRect(0,0,CW,CH);
 const cols=['139,124,255','61,245,192','92,200,255','255,92,138'];
 c.globalCompositeOperation='lighter';
 for(let i=0;i<24;i++)blob(c,r()*CW,r()*CH,150+r()*260,cols[i%4],.1+r()*.18);
 for(let k=0;k<6;k++){c.strokeStyle=`rgba(190,170,255,${.05+k*.012})`;c.lineWidth=46-k*7;c.lineCap='round';c.beginPath();c.moveTo(sx(380),CH+40);c.bezierCurveTo(sx(620),sy(520),sx(700),sy(160),CW+40,sy(70)+k*6);c.stroke()}
 c.globalCompositeOperation='source-over';
 stars(c,r,340,'#fff',1.8);
 for(let i=0;i<7;i++){const x=sx(480+r()*680),y=sy(40+r()*680),L=14+r()*20;c.strokeStyle='rgba(255,255,255,.7)';c.lineWidth=1.2;c.beginPath();c.moveTo(x-L,y);c.lineTo(x+L,y);c.moveTo(x,y-L);c.lineTo(x,y+L);c.stroke();blob(c,x,y,28,'255,255,255',.8)}},
pulsar(c,r){const [X,Y]=fp(900,250);c.fillStyle='#010610';c.fillRect(0,0,CW,CH);
 blob(c,X,Y,580,'0,120,200',.28);blob(c,sx(160),sy(720),440,'80,40,200',.2);stars(c,r,260,'#cfefff',1.5);
 c.globalCompositeOperation='lighter';
 for(const s of[1,-1]){c.save();c.translate(X,Y);c.rotate(-.9);const g=c.createLinearGradient(0,0,0,s*760);g.addColorStop(0,'rgba(130,235,255,.8)');g.addColorStop(1,'rgba(130,235,255,0)');c.fillStyle=g;c.beginPath();c.moveTo(-9,0);c.lineTo(9,0);c.lineTo(100,s*760);c.lineTo(-100,s*760);c.closePath();c.fill();c.restore()}
 for(let k=1;k<=10;k++){c.strokeStyle=`rgba(120,230,255,${Math.max(.04,.34-k*.028)})`;c.lineWidth=1.4;c.setLineDash(k%2?[]:[3,9]);c.beginPath();c.arc(X,Y,44+k*44,0,6.283);c.stroke()}
 c.setLineDash([]);blob(c,X,Y,120,'200,250,255',.95);c.globalCompositeOperation='source-over';
 c.fillStyle='#fff';c.shadowColor='#7ee8ff';c.shadowBlur=30;c.beginPath();c.arc(X,Y,9,0,6.283);c.fill();c.shadowBlur=0},
worm(c,r){const [X,Y]=fp(860,378);c.fillStyle='#04010d';c.fillRect(0,0,CW,CH);
 blob(c,X,Y,600,'120,60,255',.32);blob(c,X,Y,280,'255,60,170',.26);stars(c,r,220,'#fff',1.5);
 c.globalCompositeOperation='lighter';
 for(let i=0;i<48;i++){const rad=9+Math.pow(i,1.6)*.95,q=(48-i)/48;
  c.strokeStyle=`hsla(${300-i*1.4},95%,${72-i*.6}%,${Math.min(.8,.12+q*.7)})`;c.lineWidth=1+q*3;
  c.setLineDash([rad*1.15,rad*.4]);c.lineDashOffset=i*24;c.beginPath();c.arc(X,Y,rad,0,6.283);c.stroke()}
 c.setLineDash([]);c.globalCompositeOperation='source-over';
 c.fillStyle='#000';c.shadowColor='#ff7be0';c.shadowBlur=32;c.beginPath();c.arc(X,Y,17,0,6.283);c.fill();c.shadowBlur=0;
 c.strokeStyle='rgba(255,255,255,.9)';c.lineWidth=2;c.stroke()},
gal(c,r){const [X,Y]=fp(860,380);c.fillStyle='#03030c';c.fillRect(0,0,CW,CH);
 blob(c,X,Y,540,'60,60,200',.22);stars(c,r,220,'#fff',1.4);
 const gs=()=>(r()+r()+r()+r()-2)/2;
 c.save();c.translate(X,Y);c.rotate(-.45);c.scale(1,.5);c.globalCompositeOperation='lighter';
 for(let i=0;i<7000;i++){const t=Math.pow(r(),.7),arm=Math.floor(r()*3),ang=arm*Math.PI*2/3+t*6.2+gs()*.35*(1.2-t),rad=t*430,
   x=Math.cos(ang)*rad+gs()*18,y=Math.sin(ang)*rad+gs()*18,h=t<.25?40:t<.6?280-t*60:200;
  c.fillStyle=`hsla(${h},90%,${75-t*25}%,${.18+r()*.35})`;c.fillRect(x,y,1.6+r()*1.4,1.6+r()*1.4)}
 blob(c,0,0,130,'255,210,150',.95);c.restore()},
nova(c,r){const [X,Y]=fp(840,370);c.fillStyle='#080105';c.fillRect(0,0,CW,CH);
 blob(c,X,Y,660,'200,30,60',.3);blob(c,X,Y,330,'255,120,30',.3);
 c.globalCompositeOperation='lighter';
 for(let i=0;i<220;i++){const a=r()*6.283,l=130+r()*430,co=Math.cos(a),si=Math.sin(a),g=c.createLinearGradient(X+co*50,Y+si*50,X+co*l,Y+si*l);
  g.addColorStop(0,`rgba(255,${130+(r()*100|0)},70,${.15+r()*.45})`);g.addColorStop(1,'rgba(255,90,40,0)');
  c.strokeStyle=g;c.lineWidth=.6+r()*2;c.beginPath();c.moveTo(X+co*50,Y+si*50);c.lineTo(X+co*l,Y+si*l);c.stroke()}
 for(let k=0;k<4;k++){c.strokeStyle=`rgba(255,160,90,${.3-k*.06})`;c.lineWidth=3;c.setLineDash([14,10]);c.beginPath();c.arc(X,Y,150+k*72,0,6.283);c.stroke()}
 c.setLineDash([]);blob(c,X,Y,150,'255,240,200',1);c.globalCompositeOperation='source-over';stars(c,r,160,'#ffd9c0',1.3)},
eclipse(c,r){const g=c.createLinearGradient(0,0,CW,CH);g.addColorStop(0,'#e4e8ff');g.addColorStop(.55,'#f5efff');g.addColorStop(1,'#dff2ff');c.fillStyle=g;c.fillRect(0,0,CW,CH);
 const [X,Y]=fp(860,372);
 blob(c,X,Y,540,'140,120,255',.3);blob(c,sx(200),sy(710),420,'80,200,255',.24);blob(c,sx(1120),sy(90),320,'255,140,200',.2);
 stars(c,r,170,'#5a46d8',1.4);
 c.save();c.translate(X,Y);c.rotate(-.35);c.strokeStyle='rgba(91,71,224,.2)';c.lineWidth=1.3;
 for(let k=1;k<=5;k++){c.beginPath();c.ellipse(0,0,230+k*62,70+k*20,0,0,6.283);c.stroke()}c.restore();
 const ring=(a,b)=>{c.save();c.translate(X,Y);c.rotate(-.35);const gg=c.createLinearGradient(-280,0,280,0);gg.addColorStop(0,'rgba(224,150,15,.2)');gg.addColorStop(.5,'rgba(224,150,15,.95)');gg.addColorStop(1,'rgba(224,150,15,.25)');c.strokeStyle=gg;
  for(let k=0;k<5;k++){c.lineWidth=5-k*.6;c.beginPath();c.ellipse(0,0,230+k*11,56+k*3,0,a,b);c.stroke()}c.restore()};
 ring(Math.PI,Math.PI*2);
 const p=c.createRadialGradient(X-50,Y-55,10,X,Y,140);p.addColorStop(0,'#cfc6ff');p.addColorStop(.5,'#6a55e8');p.addColorStop(1,'#241a6a');
 c.shadowColor='rgba(91,71,224,.55)';c.shadowBlur=50;c.fillStyle=p;c.beginPath();c.arc(X,Y,132,0,6.283);c.fill();c.shadowBlur=0;
 ring(0,Math.PI);
 const m=c.createRadialGradient(X+215,Y+184,2,X+220,Y+188,26);m.addColorStop(0,'#fff');m.addColorStop(1,'#9a8cff');c.fillStyle=m;c.beginPath();c.arc(X+220,Y+188,24,0,6.283);c.fill()}
};
const CV=[['hole','Event Horizon'],['nebula','Nebula Aurora'],['pulsar','Pulsar'],['worm','Wormhole'],['gal','Spiral Galaxy'],['nova','Supernova'],['eclipse','Eclipse (Light)']];
const BG={};
function bgOf(v,sc){const k=v+CF+sc;if(sc<=1&&BG[k])return BG[k];
 const cv=document.createElement('canvas');cv.width=Math.round(CW*sc);cv.height=Math.round(CH*sc);const c=cv.getContext('2d');c.scale(sc,sc);
 BGF[v](c,mkRng(v.length*7919+v.charCodeAt(0)*31));
 return sc<=1?(BG[k]=cv):cv}
Object.assign(EN,{'Khung hình':'Aspect ratio','Ngang (mặc định)':'Landscape (default)','Vuông 1:1':'Square 1:1','Dọc 4:5':'Portrait 4:5','Story 9:16':'Story 9:16','Nội dung trên thẻ':'Show on card','Logo & tiêu đề':'Logo & title','Khoảng ngày':'Date range','Số lệnh':'Trades','Tên trader':'Trader name'});
const COPT=[['pnl','Net P&L'],['wr','Win rate'],['pf','Profit factor'],['avgR','Average R']];
// Brand cleanup: account scope follows the existing journal selector; never show account names on share cards.
const OPT=Object.assign({pnl:1,wr:1,pf:1,avgR:1},P.copt||{},{logo:1,range:1,n:1,name:1,acc:0});
const CD={from:'',to:'',accs:null,mode:'usd',v:P.cv&&BGF[P.cv]?P.cv:'hole',name:P.cname||'',sc:null};
const selAccs=()=>{const ids=S.accounts.map(a=>a.id),a=(CD.accs||[]).filter(x=>ids.includes(x));return a.length?a:ids};
function cData(){
 const ids=selAccs(),sa=S.accounts.filter(a=>ids.includes(a.id)),all=S.trades.filter(t=>ids.includes(t.acc)),ds=all.map(t=>t.date).sort(),mn=ds[0]||td(),mx=ds[ds.length-1]||td(),F=CD.from||mn,T=CD.to||mx,f=F<=T?F:T,t=F<=T?T:F;
 const one=CD.tid?S.trades.find(x=>String(x.id)===String(CD.tid)):null,ts=one?[one]:all.filter(x=>x.date>=f&&x.date<=t),s=stats(ts);
 const oa=one?(S.accounts.find(a=>a.id===one.acc)||{}):null;
 return{f:one?one.date:f,t:one?one.date:t,one,s,sc:'',bal:one?(oa.balance||0):sa.reduce((q,a)=>q+a.balance,0),rsum:ts.filter(x=>x.r!==null&&!isNaN(x.r)).reduce((q,x)=>q+x.r,0)}}
function pnlTxt(d){const s=d.s,sg=v=>v>=0?'+':'-';
 if(CD.mode==='pct')return d.bal>0?sg(s.net)+Math.abs(s.net/d.bal*100).toFixed(2)+'%':'—';
 if(CD.mode==='r')return sg(d.rsum)+Math.abs(d.rsum).toFixed(2)+'R';
 return sg(s.net)+'$'+Math.abs(Math.round(s.net)).toLocaleString('en-US')}
function statItems(d){const s=d.s,o=d.one;
 if(o){const n=v=>v==null?'–':v;return [['wr','SYMBOL',o.symbol],['pf','R',o.r==null||isNaN(o.r)?'–':o.r+'R'],['n','ENTRY',String(n(o.en))],['avgR','EXIT',String(n(o.ex))]].filter(x=>OPT[x[0]])}
 return [['wr','WIN RATE',s.wr.toFixed(1)+'%'],['pf','PROFIT FACTOR',s.pf===Infinity?'∞':s.pf.toFixed(2)],['n','TRADES',String(s.n)],['avgR','AVERAGE R',s.avgR===null?'–':s.avgR.toFixed(2)+'R']].filter(x=>OPT[x[0]])}
const BRAND_LOGO=new Image();
let brandLogoReady=false;
const brandLogoPromise=new Promise(resolve=>{
 BRAND_LOGO.onload=()=>{brandLogoReady=true;resolve(true)};
 BRAND_LOGO.onerror=()=>resolve(false);
 BRAND_LOGO.src='img/logo.png';
 if(BRAND_LOGO.complete&&BRAND_LOGO.naturalWidth){brandLogoReady=true;resolve(true)}
});
function drawBrand(c,PL,lt,vertical,p){
 const x=64, y=vertical?Math.max(30,p.hy-p.tf*1.05):42;
 const h=vertical?Math.min(48,Math.max(36,p.tf*1.05)):36, w=h*101/128;
 if(brandLogoReady){c.save();c.shadowColor=lt?'rgba(176,116,26,.22)':'rgba(255,190,60,.42)';c.shadowBlur=vertical?15:12;c.drawImage(BRAND_LOGO,x,y,w,h);c.restore()}
 const tx=x+w+14, base=vertical?p.hy:68, fs=vertical?Math.min(p.tf,46):30;
 c.save();c.shadowColor=lt?'rgba(176,116,26,.18)':'rgba(120,95,255,.22)';c.shadowBlur=vertical?8:6;
 c.font=`800 ${fs}px Orbitron, "Space Grotesk", sans-serif`;c.fillStyle=PL.ink;c.textAlign='left';c.letterSpacing=vertical?'1.5px':'1.1px';c.fillText('GEXADECIMAL',tx,base);
 c.shadowBlur=0;c.font=`600 ${vertical?Math.max(12,Math.round(p.rf*.48)):12}px "Space Grotesk", sans-serif`;c.fillStyle=PL.mut;c.letterSpacing=vertical?'3px':'2.6px';c.fillText('TRADING JOURNAL',tx,base+(vertical?Math.max(19,p.rf*.68):20));c.restore();
}
function drawCard(c,v,d,sc){
 c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,c.canvas.width,c.canvas.height);c.save();c.scale(sc,sc);
 const lt=v==='eclipse',PL=lt?{ink:'#1a1f45',mut:'#5d6597',win:'#08987a',loss:'#d6336c',ln:'rgba(80,70,200,.25)'}:{ink:'#f2f4ff',mut:'rgba(196,204,255,.75)',win:'#3df5c0',loss:'#ff5c8a',ln:'rgba(180,190,255,.22)'};
 rr(c,0,0,CW,CH,44);c.save();c.clip();
 c.drawImage(bgOf(v,sc),0,0,CW,CH);
 if(!lt){let g;if(isLS()){g=c.createLinearGradient(0,0,CW,0);g.addColorStop(0,'rgba(2,3,12,.66)');g.addColorStop(.62,'rgba(2,3,12,.12)');g.addColorStop(1,'rgba(2,3,12,0)');c.fillStyle=g;c.fillRect(0,0,CW,CH)}else{g=c.createLinearGradient(0,Math.max(CH*.3,LY().y0-170),0,CH);g.addColorStop(0,'rgba(2,3,12,0)');g.addColorStop(1,'rgba(2,3,12,.82)');c.fillStyle=g;c.fillRect(0,0,CW,CH);g=c.createLinearGradient(0,0,0,CH*.12);g.addColorStop(0,'rgba(2,3,12,.5)');g.addColorStop(1,'rgba(2,3,12,0)');c.fillStyle=g;c.fillRect(0,0,CW,CH)}
 
  g=c.createLinearGradient(0,CH*.6,0,CH);g.addColorStop(0,'rgba(2,3,12,0)');g.addColorStop(1,'rgba(2,3,12,.5)');c.fillStyle=g;c.fillRect(0,0,CW,CH)}
 const sh=c.createLinearGradient(0,0,CW,CH);sh.addColorStop(0,'rgba(255,255,255,.12)');sh.addColorStop(.35,'rgba(255,255,255,0)');sh.addColorStop(1,'rgba(255,255,255,.04)');c.fillStyle=sh;c.fillRect(0,0,CW,CH);
 c.restore();
 c.strokeStyle=lt?'rgba(80,70,200,.3)':'rgba(190,200,255,.28)';c.lineWidth=1.5;rr(c,12,12,CW-24,CH-24,34);c.stroke();
 const s=d.s,SG='"Space Grotesk",system-ui,sans-serif',OR='Orbitron,"Space Grotesk",sans-serif';
 const f=(font,col,al,x,y,t,ls)=>{c.font=font;c.fillStyle=col;c.textAlign=al;c.letterSpacing=ls||'0px';c.fillText(t,x,y)};
 if(!isLS()){const p=LY(),y0=p.y0;
  if(OPT.logo)drawBrand(c,PL,lt,true,p);
  if(OPT.range)f(`500 ${p.rf}px ${SG}`,PL.mut,'left',96+Math.round(p.tf*1.25),p.hy+Math.round(p.rf*1.7),(d.one?d.f:d.f+' → '+d.t));
  const bigAcc=!OPT.pnl;
  if(OPT.pnl){
   f(`600 ${p.lf}px ${SG}`,PL.mut,'left',64,y0,'NET P&L','6px');
   const txt=pnlTxt(d),pos=(CD.mode==='pct'?s.net:CD.mode==='r'?d.rsum:s.net)>=0,col=pos?PL.win:PL.loss,mx=CW-128;
   let fs=p.F;c.font=`800 ${fs}px ${OR}`;c.letterSpacing='0px';const w=c.measureText(txt).width;if(w>mx)fs=Math.floor(fs*mx/w);
   c.shadowColor=col;c.shadowBlur=lt?0:34;f(`800 ${fs}px ${OR}`,col,'left',60,y0+p.pb,txt);c.shadowBlur=0}
  const SJ=statItems(d).filter(x=>OPT[x[0]]);
  if(SJ.length){c.strokeStyle=PL.ln;c.lineWidth=1.5;c.beginPath();c.moveTo(64,y0+p.dv);c.lineTo(CW-64,y0+p.dv);c.stroke();
   SJ.forEach(([k,l,val],i)=>{const x=64+(i%2)*((CW-128)/2),yl=y0+p.dv+p.sl0+(i>>1)*p.pit;f(`600 ${p.sl}px ${SG}`,PL.mut,'left',x,yl,l,'3px');f(`700 ${p.sv}px ${SG}`,PL.ink,'left',x,yl+p.sv0,val)})}
  if(OPT.name)f(`600 ${p.nf}px ${SG}`,PL.ink,'left',64,y0+p.nb,(CD.name||'TRADER').toUpperCase(),'5px');
  c.letterSpacing='0px';c.restore();return}
 if(OPT.logo)drawBrand(c,PL,lt,false,{hy:68,tf:30,rf:24});
 if(OPT.range)f(`500 22px ${SG}`,PL.mut,'right',CW-64,84,(d.one?d.f:d.f+' → '+d.t));
 const LS=isLS(),dy=CH-756;
 if(OPT.pnl){
  f(`600 20px ${SG}`,PL.mut,'left',64,236+dy,'NET P&L','5px');
  const txt=pnlTxt(d),pos=(CD.mode==='pct'?s.net:CD.mode==='r'?d.rsum:s.net)>=0,col=pos?PL.win:PL.loss,mx=LS?720:CW-128;
  let fs=LS?132:168;c.font=`800 ${fs}px ${OR}`;c.letterSpacing='0px';const w=c.measureText(txt).width;if(w>mx)fs=Math.floor(fs*mx/w);
  c.shadowColor=col;c.shadowBlur=lt?0:34;f(`800 ${fs}px ${OR}`,col,'left',60,372+dy,txt);c.shadowBlur=0}
 const SI=statItems(d).filter(x=>OPT[x[0]]),sp=Math.min(272,(CW-128)/4);
 if(SI.length){c.strokeStyle=PL.ln;c.lineWidth=1.5;c.beginPath();c.moveTo(64,520+dy);c.lineTo(CW-64,520+dy);c.stroke();
  SI.forEach(([k,l,val],i)=>{f(`600 17px ${SG}`,PL.mut,'left',64+i*sp,566+dy,l,'3px');f(`700 46px ${SG}`,PL.ink,'left',64+i*sp,622+dy,val)})}
 if(OPT.name)f(`600 22px ${SG}`,PL.ink,'left',64,694+dy,(CD.name||'TRADER').toUpperCase(),'4px');
 c.letterSpacing='0px';c.restore()}
function paintAll(){const m=$('#cmain');if(!m)return;const d=cData();drawCard(m.getContext('2d'),CD.v,d,1);
 document.querySelectorAll('.cth').forEach(b=>drawCard(b.firstChild.getContext('2d'),b.dataset.cv,d,.5))}
const loadFonts=()=>{if(!(document.fonts&&document.fonts.load))return Promise.resolve();
 const sm=(CD.name+' GEXADECIMAL TRADING JOURNAL TRADER WIN RATE PROFIT FACTOR AVERAGE ĂÂĐÊÔƠƯ ÁÀẢÃẠ').toUpperCase();
 return Promise.all([['800 40px Orbitron','GEXADECIMAL TRADING JOURNAL +$0123456789.,%R-'],['500 20px "Space Grotesk"',sm],['600 20px "Space Grotesk"',sm],['700 40px "Space Grotesk"',sm+'0123456789.%R∞']].map(([f,t])=>document.fonts.load(f,t))).then(()=>document.fonts.ready).catch(()=>{})};
function showPrev(b,n){const u=URL.createObjectURL(b),o=document.createElement('div');
 o.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(0,0,10,.72);display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto';
 const k=document.createElement('div');k.className='card';k.style.cssText='max-width:760px;width:100%;max-height:100%;overflow:auto;background:var(--hole);color:var(--ink)';
 const p=document.createElement('p');p.style.cssText='margin:0 0 12px;line-height:1.5';
 p.textContent=L('Ảnh đã được tải xuống. Nếu Windows báo không có ứng dụng để mở file .png, bạn vẫn xem/lưu ảnh ngay tại đây: dùng các nút bên dưới hoặc chuột phải vào ảnh → Lưu ảnh thành…','The image has been downloaded. If your system has no app to open .png files, you can still view/save it right here: use the buttons below or right-click the image → Save image as…');
 const im=new Image();im.src=u;im.alt=n;im.style.cssText='width:100%;height:auto;display:block;border-radius:14px;margin-bottom:14px';
 const r=document.createElement('div');r.className='row';r.style.justifyContent='flex-end';
 const kd=ev=>{if(ev.key==='Escape'){ev.preventDefault();done()}};
 const done=()=>{o.remove();document.removeEventListener('keydown',kd,true);setTimeout(()=>URL.revokeObjectURL(u),6e4)};
 document.addEventListener('keydown',kd,true);
 const mk=(t,fn,g)=>{const x=document.createElement('button');x.type='button';x.className='btn'+(g?' ghost':'');x.textContent=t;x.onclick=fn;r.append(x);return x};
 mk(L('Mở trong tab mới','Open in new tab'),()=>window.open(u,'_blank','noopener'),1);
 if(navigator.clipboard&&window.ClipboardItem)mk(L('Sao chép ảnh','Copy image'),async ev=>{const t=ev.currentTarget;try{await navigator.clipboard.write([new ClipboardItem({'image/png':b})]);t.textContent=L('Đã sao chép ✓','Copied ✓')}catch(x){t.textContent=L('Không sao chép được','Copy failed')}},1);
 try{const fl=new File([b],n,{type:'image/png'});if(navigator.canShare&&navigator.canShare({files:[fl]}))mk(L('Chia sẻ','Share'),()=>navigator.share({files:[fl],title:n}).catch(()=>{}),1)}catch(x){}
 mk(L('Tải lại','Download again'),()=>saveBlob(b,n),1);
 const c=mk(L('Đóng','Close'),done);
 k.append(p,im,r);o.append(k);o.onclick=ev=>{if(ev.target===o)done()};document.body.append(o);c.focus()}
function card(){
 if(CD.tid&&!S.trades.some(x=>String(x.id)===String(CD.tid)))CD.tid=null;
 if(CD.sc!==S.cur){CD.sc=S.cur;CD.from=CD.to='';CD.accs=S.cur==='all'?S.accounts.map(a=>a.id):[S.cur]}
 const d=cData(),mo=[['usd','Số tiền ($)'],['pct','% trên vốn'],['r','Tổng R']];
 $('#v-card').innerHTML=`<div class="card"><h2>${tr('Thẻ flex')}</h2>${CD.tid?`<div class="row" style="margin-bottom:12px;align-items:center"><span style="color:var(--mut)">Thẻ của một lệnh: ${esc(d.one?d.one.symbol+' '+d.one.side+' · '+d.one.date:'')}</span><button class="btn ghost" id="cbk" type="button">Xem thẻ tổng hợp</button></div>`:''}
 <div class="row" id="cctl"><label>${tr('Từ ngày')}<input type="date" id="cfr" value="${d.f}"></label><label>${tr('Đến ngày')}<input type="date" id="cto" value="${d.t}"></label><label>${tr('Hiển thị')}<select id="cmo">${mo.map(([k,n])=>`<option value="${k}"${k===CD.mode?' selected':''}>${tr(n)}</option>`).join('')}</select></label><label>${tr('Khung hình')}<select id="cfm">${[['land','Ngang (mặc định)'],['sq','Vuông 1:1'],['p45','Dọc 4:5'],['st','Story 9:16']].map(([k,n])=>`<option value="${k}"${k===CF?' selected':''}>${tr(n)}</option>`).join('')}</select></label><label style="flex:1;min-width:160px">${tr('Tên hiển thị')}<input id="cnm" maxlength="24" value="${esc(CD.name)}" placeholder="TRADER"></label><button class="btn" id="cdl" type="button">${tr('Tải ảnh PNG')}</button></div>
 <div class="cpick"><label>${tr('Nội dung trên thẻ')}</label><div class="chks" id="copt">${COPT.map(([k,n])=>`<label class="chk${OPT[k]?' on':''}"><input type="checkbox" data-o="${k}"${OPT[k]?' checked':''}>${CD.tid&&{wr:'Symbol',pf:'R',avgR:'Giá ra'}[k]||tr(n)}</label>`).join('')}</div></div>
 <div class="cwrap${isLS()?'':' tall'}"><canvas id="cmain" width="${CW}" height="${CH}"></canvas></div></div>
 <div class="card" style="margin-top:14px"><h2>${tr('Chọn phiên bản')}</h2><div class="cgal${isLS()?'':' tall'}">${CV.map(([k,n])=>`<button type="button" class="cth${k===CD.v?' on':''}" data-cv="${k}"><canvas width="${CW/2}" height="${CH/2}"></canvas><span>${n}</span></button>`).join('')}</div></div>`;
 if($('#cbk'))$('#cbk').onclick=()=>{CD.tid=null;card()};
 $('#cfr').onchange=e=>{CD.from=e.target.value;paintAll()};
 $('#cto').onchange=e=>{CD.to=e.target.value;paintAll()};
 $('#cmo').onchange=e=>{CD.mode=e.target.value;paintAll()};
 $('#cfm').onchange=e=>{CF=e.target.value;[CW,CH]=FMT[CF];P.cfm=CF;savP();card()};
 $('#copt').onchange=e=>{const i=e.target;OPT[i.dataset.o]=i.checked?1:0;P.copt=OPT;savP();i.closest('.chk').classList.toggle('on',i.checked);paintAll()};
 $('#cnm').oninput=e=>{CD.name=e.target.value;P.cname=CD.name;savP();paintAll()};
 document.querySelector('.cgal').onclick=e=>{const b=e.target.closest('[data-cv]');if(!b)return;CD.v=b.dataset.cv;P.cv=CD.v;savP();document.querySelectorAll('.cth').forEach(x=>x.classList.toggle('on',x===b));paintAll()};
 $('#cdl').onclick=async e=>{const bt=e.currentTarget;if(bt.disabled)return;bt.disabled=true;
  try{await Promise.all([loadFonts(),brandLogoPromise]);const cv=document.createElement('canvas');cv.width=CW*2;cv.height=CH*2;drawCard(cv.getContext('2d'),CD.v,cData(),2);
   const b=await new Promise(r=>cv.toBlob(r,'image/png'));if(!b)throw new Error('toBlob');
   const n='flex-card-'+CD.v+'-'+CF+'-'+td()+'.png';saveBlob(b,n);showPrev(b,n)}
  catch(x){note(L('Không tạo được ảnh. Hãy thử lại.','Could not create the image. Please try again.'))}
  bt.disabled=false};
 paintAll();
 Promise.all([loadFonts(),brandLogoPromise]).then(paintAll)}
/* ===== Đồng bộ từ MT5 ===== */
let SY={url:'',token:'',def:'',map:{},since:0,autoBal:true};
try{Object.assign(SY,JSON.parse(localStorage.getItem(GX.key('tjp_sync'))||'{}'))}catch(e){}
const saveSY=()=>{try{localStorage.setItem(GX.key('tjp_sync'),JSON.stringify(SY))}catch(e){}};
const ld=ms=>new Date(ms-new Date(ms).getTimezoneOffset()*6e4).toISOString(); // giờ máy bạn
const syDef=()=>S.accounts.some(a=>a.id===SY.def)?SY.def:S.accounts[0].id;
const inForm=()=>false; // đang gõ dở form thêm lệnh thì không vẽ lại
let syBusy=false,syDirty=false,syBalAt=0;
// Vốn ban đầu = số dư MT5 hiện tại - tổng PnL các lệnh của tài khoản trong journal, để "Vốn hiện tại" luôn khớp số dư MT5
async function syncBal(url){
 const r=await fetch(url+'/api/quote',{headers:{'Authorization':'Bearer '+JC.token}});
 if(r.status===401)GX.expired();
 if(!r.ok)return false;
 const ac=(await r.json()).account;
 if(!ac||!(+ac.balance>=0))return false;
 const keys=Object.keys(SY.map),login=ac.login!=null?String(ac.login):(keys.length===1?keys[0]:null);
 const id=login&&SY.map[login],a=id&&S.accounts.find(x=>x.id===id);
 if(!a)return false;
 const sum=S.trades.filter(t=>t.acc===a.id).reduce((q,t)=>q+t.pnl,0),nb=+(+ac.balance-sum).toFixed(2);
 if(nb<0||nb===a.balance)return false;
 a.balance=nb;return true;
}
async function syncMT5(silent,days){
 if(syBusy)return;
 const url=JC.url.replace(/\/$/,''),say=t=>{$('#syMsg').textContent=t};
 if(!url||!JC.token){if(!silent)say('Nhập API URL và token trước.');return}
 syBusy=true;if(!silent)say('Đang đồng bộ...');
 try{
  let since=Math.max(0,(SY.since||0)-(days||7)*864e5),rows=[];const lim=500; // lùi vài ngày để không sót lệnh EA gửi muộn
  for(let i=0;i<20;i++){
   const r=await fetch(`${url}/api/trades?since=${since}&limit=${lim}`,{headers:{'Authorization':'Bearer '+JC.token}});
   if(r.status===401)GX.expired();
   if(!r.ok)throw new Error('HTTP '+r.status);
   const b=await r.json();rows.push(...b);
   if(b.length<lim)break;
   const nx=b[b.length-1].close_time;if(nx<=since)break;since=nx;
  }
  const have=new Map(S.trades.map(t=>[String(t.id),t]));let add=0,chg=0;
  rows.forEach(x=>{
   const k='mt5-'+x.id,sym=baseSym(x.symbol)||String(x.symbol).toUpperCase();
   const o={date:ld(x.close_time).slice(0,10),symbol:sym,side:x.side==='buy'?'Long':'Short',
    pnl:+x.net.toFixed(2),fee:+(-(x.commission+x.fee)).toFixed(2),en:x.open_price,ex:x.close_price,
    sl:x.sl>0?x.sl:null,tp:x.tp>0?x.tp:null,time:ld(x.open_time).slice(11,16)};
   const rv=x.r==null||!(x.sl>0)?null:+x.r.toFixed(2),old=have.get(k);
   if(old){ // chỉ cập nhật số liệu từ MT5, GIỮ nguyên setup / risk / cảm xúc / lỗi / ghi chú bạn đã nhập
    const before=JSON.stringify(old);Object.assign(old,o);if(old.risk==null)old.r=rv;
    if(JSON.stringify(old)!==before)chg++;
   }else{
    let acc=SY.map[x.account];
    if(!acc||!S.accounts.some(a=>a.id===acc)){acc=syDef();SY.map[x.account]=acc}
    S.trades.push({id:k,acc,...o,setup:'MT5',risk:null,rv:null,rm:null,r:rv,emo:'',mis:'',
     note:'MT5 · '+(x.reason||'')});add++;
   }
  });
  if(add&&!S.setups.includes('MT5'))S.setups.push('MT5');
  if(rows.length)SY.since=Math.max(SY.since||0,rows[rows.length-1].close_time);
  let bal=false;
  if(SY.autoBal!==false&&(add||chg||Date.now()-syBalAt>300000)){try{bal=await syncBal(url);syBalAt=Date.now()}catch(e){}} // chỉ hỏi số dư khi có lệnh mới/đổi, hoặc 5 phút một lần
  saveSY();
  if(add||chg||bal){save();if(inForm())syDirty=true;else refresh()}
  say(`Đã đồng bộ lúc ${new Date().toLocaleTimeString('vi-VN')}: ${add} lệnh mới, ${chg} lệnh cập nhật${bal?', đã cập nhật vốn ban đầu':''}.`);
 }catch(e){say('Đồng bộ thất bại ('+e.message+'). Kiểm tra URL, token và EA.')}
 syBusy=false;
}
$('#syb').onclick=()=>syncMT5(false);
$('#syr').onclick=()=>{SY.since=0;saveSY();syncMT5(false)};
S.trades.forEach(t=>{if(String(t.id).startsWith('mt5-')&&!(t.sl>0)&&t.risk==null)t.r=null});
if(S.trades.some(t=>String(t.id).startsWith('mt5-')&&!('tp' in t))){SY.since=0;saveSY()} // dữ liệu cũ chưa có TP: tải lại một lần
if(JC.url&&JC.token)syncMT5(true); // tự đồng bộ khi mở journal
// tự cập nhật mỗi 15 giây khi tab đang mở (EA đẩy lệnh lên ngay khi đóng, web chỉ việc kéo về)
setInterval(()=>{
 if(document.hidden||!JC.url||!JC.token)return;
 if(syDirty&&!inForm()){syDirty=false;refresh()}
 syncMT5(true,2);
},15000);

/* ===== Xuất / Nhập CSV ===== */
const CSV_H=['id','account','account_id','date','time','symbol','side','pnl','fee','entry','exit','sl','tp','r','risk','rv','rm','setup','emotion','mistake','note'];
const csvTxt=v=>{v=v==null?'':String(v);return /^[=+\-@\t\r]/.test(v)?"'"+v:v}; // chống CSV injection khi mở bằng Excel
const csvNum=v=>v==null||v===''||!isFinite(v)?'':String(v);
const csvCell=v=>{v=String(v);return /[",;\r\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
const syMsg=t=>{$('#syMsg').textContent=t};
function exportCSV(){ // tất cả tài khoản; trả về số lệnh đã xuất (0 = không có gì để xuất)
 if(!S.trades.length)return 0;
 const an=id=>(S.accounts.find(a=>a.id===id)||{}).name||id;
 const rows=[...S.trades].sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));
 const out=[CSV_H.join(',')];
 rows.forEach(t=>out.push([csvTxt(t.id),csvTxt(an(t.acc)),csvTxt(t.acc),t.date,t.time||'',csvTxt(t.symbol),t.side,csvNum(t.pnl),csvNum(t.fee),csvNum(t.en),csvNum(t.ex),csvNum(t.sl),csvNum(t.tp),csvNum(t.r),csvNum(t.risk),csvNum(t.rv),csvTxt(t.rm),csvTxt(t.setup),csvTxt(t.emo),csvTxt(t.mis),csvTxt(t.note)].map(csvCell).join(',')));
 saveBlob(new Blob(['\ufeff'+out.join('\r\n')],{type:'text/csv;charset=utf-8'}),'gexadecimal-journal-'+td()+'.csv');
 return rows.length;
}
function parseCSV(text){ // tự nhận dấu phân cách , ; hoặc tab; hỗ trợ ô có ngoặc kép, xuống dòng trong ô
 text=text.replace(/^\ufeff/,'');
 const first=text.split(/\r?\n/,1)[0],d=[',',';','\t'].map(c=>[c,first.split(c).length]).sort((a,b)=>b[1]-a[1])[0][0];
 const rows=[];let row=[],cur='',q=false;
 const push=()=>{row.push(cur);cur='';if(row.length>1||row[0]!=='')rows.push(row);row=[]};
 for(let i=0;i<text.length;i++){const c=text[i];
  if(q){if(c==='"'){if(text[i+1]==='"'){cur+='"';i++}else q=false}else cur+=c}
  else if(c==='"')q=true;
  else if(c===d){row.push(cur);cur=''}
  else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;push()}
  else cur+=c}
 if(cur!==''||row.length)push();
 return rows;
}
async function importCSV(file){
 const T='Nhập CSV',okb=[{label:'OK',value:true}],say=m=>gxDialog({title:T,msg:m,buttons:okb});
 if(file.size>5*1024*1024)return say('File quá lớn (tối đa 5 MB).');
 let rows=[];try{rows=parseCSV(await file.text())}catch(e){}
 if(rows.length<2)return say('File CSV trống hoặc không đọc được.');
 if(rows.length>20001)return say('File có quá nhiều dòng (tối đa 20.000).');
 const hd=rows[0].map(h=>h.trim().toLowerCase().replace(/^\ufeff/,''));
 if(['date','symbol','side','pnl'].some(c=>!hd.includes(c)))return say('File không đúng định dạng. Cần các cột date, symbol, side, pnl (dùng file do nút Xuất CSV tạo ra).');
 const g=(r,n)=>{const i=hd.indexOf(n);return i<0?'':String(r[i]==null?'':r[i]).trim()};
 const txt=(v,n)=>v.replace(/^'(?=[=+\-@\t\r])/,'').slice(0,n||500);
 const num=v=>{if(v==='')return null;if(/^-?\d+,\d+$/.test(v))v=v.replace(',','.');const x=Number(v);return isFinite(x)?x:NaN};
 const have=new Set(S.trades.map(t=>String(t.id))),add=[];let dup=0,bad=0,n=0;
 const tag=Date.now().toString(36);
 for(const r of rows.slice(1)){
  const date=g(r,'date'),symbol=txt(g(r,'symbol'),30).toUpperCase(),sv=g(r,'side').toLowerCase(),pnl=num(g(r,'pnl'));
  const side=/^(l|buy)/.test(sv)?'Long':/^(s|sell)/.test(sv)?'Short':'';
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||isNaN(new Date(date+'T00:00').getTime())||!symbol||!side||pnl==null||isNaN(pnl)){bad++;continue}
  const id=txt(g(r,'id'),120)||'imp-'+tag+'-'+(n++);
  if(have.has(id)){dup++;continue}
  have.add(id);
  const an=g(r,'account'),ai=g(r,'account_id'),acc=(S.accounts.find(a=>ai&&a.id===ai)||S.accounts.find(a=>an&&a.name.toLowerCase()===an.toLowerCase())||{id:A0()}).id;
  const nn=k=>{const x=num(g(r,k));return x==null||isNaN(x)?null:x},pos=k=>{const x=nn(k);return x>0?x:null};
  add.push({id,acc,date,time:/^\d{2}:\d{2}$/.test(g(r,'time'))?g(r,'time'):'',symbol,side,pnl,fee:nn('fee')||0,en:nn('entry'),ex:nn('exit'),sl:pos('sl'),tp:pos('tp'),
   setup:txt(g(r,'setup'),60)||'CSV',risk:nn('risk'),rv:nn('rv'),rm:txt(g(r,'rm'),20)||null,r:nn('r'),emo:txt(g(r,'emotion'),60),mis:txt(g(r,'mistake'),60),note:txt(g(r,'note'))});
 }
 if(!add.length)return say(`Không có lệnh hợp lệ để nhập (${dup} trùng, ${bad} dòng lỗi).`);
 const go=await gxDialog({title:T,msg:`Sẽ nhập ${add.length} lệnh mới (bỏ qua ${dup} lệnh trùng, ${bad} dòng lỗi). Tiếp tục?`,
  buttons:[{label:'Huỷ',kind:'ghost',value:false,focus:true},{label:'Nhập',value:true}]});
 if(!go)return;
 S.trades.push(...add);
 add.forEach(t=>{if(t.setup&&!S.setups.includes(t.setup))S.setups.push(t.setup)});
 save();refresh();
 syMsg(`Đã nhập ${add.length} lệnh từ CSV.`);
}
$('#sye').onclick=()=>{const n=exportCSV();syMsg(n?`Đã xuất ${n} lệnh ra file CSV.`:'Chưa có dữ liệu để xuất.')};
$('#syi').onclick=()=>$('#syf').click();
$('#syf').onchange=e=>{const f=e.target.files[0];e.target.value='';if(f)importCSV(f)};
Object.assign(window.JR,{exportCSV});

})();
