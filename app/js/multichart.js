/* ================= THÊM NHIỀU CHART (nút "Thêm chart") và NHIỀU TPO (nút "Thêm TPO chart") =================
   mcInit(cfg) dựng một bộ chart phụ; gọi hai lần: chart (tab Chart, key tp_mc) và TPO (tab TPO Chart, key tp_mct, iframe có &v=tpo).
   Mỗi chart phụ là một bản đầy đủ của app (footprint, indicator, công cụ vẽ... như chart chính) chạy trong iframe cùng origin,
   xem embed.js để biết cách chúng dùng chung theme / múi giờ / kết nối và lưu riêng mã, khung giờ, indicator.
   Danh sách chart phụ lưu ở localStorage "tp_mc" = {l:[{id,h}], c:số cột}. Thứ tự đổi bằng CSS order (không dựng lại iframe nên chart không bị tải lại). */
function mcInit(cfg){
"use strict";
const root=$(cfg.root),grid=$(cfg.grid);
if(!root||!grid)return;
const TPO=cfg.kind==="tpo",KEY=cfg.key,MQ="(max-width:760px)",narrow=()=>matchMedia(MQ).matches;
const mlbl=x=>x==="week"?"Weekly":x==="session"?"Session":"Daily",modeOf=id=>{try{return mlbl((JSON.parse(ld0("tp_tpo_"+id)||"{}")||{}).mode)}catch{return"Daily"}};
const maxN=()=>narrow()?3:4;                       // mỗi chart phụ mở thêm 1 kết nối + luồng dữ liệu riêng nên có trần
let S={l:[],c:2};
try{const o=JSON.parse(ld(KEY,"{}"))||{};if(Array.isArray(o.l))S.l=o.l.filter(x=>x&&/^[\w-]+$/.test(x.id)).slice(0,4).map(x=>({id:x.id,h:+x.h||0}));if(o.c===1)S.c=1}catch{}
const save=()=>sv(KEY,JSON.stringify(S));
const info={};                                    // id -> {sym,tf,bid} do iframe báo về
const I={
  up:'<path d="M5 12l5-5 5 5"/>',dn:'<path d="M5 8l5 5 5-5"/>',
  fs:'<path d="M4 8V4h4M16 8V4h-4M4 12v4h4M16 12v4h-4"/>',fx:'<path d="M8 4v4H4M12 4v4h4M8 16v-4H4M12 16v-4h4"/>',
  x:'<path d="M5 5l10 10M15 5L5 15"/>',plus:'<path d="M10 4v12M4 10h12"/>'};
const ic=k=>`<svg viewBox="0 0 20 20" aria-hidden="true">${I[k]}</svg>`;
if(!TPO)window.MC={list:()=>S.l.map(x=>{const i=info[x.id]||{};return{id:x.id,sym:i.sym||ld0("tp_sym_"+x.id,""),tf:i.tf?tfName(+i.tf):tfName(+ld0("tp_tf_"+x.id,0))}})};
const defH=()=>narrow()?Math.max(420,Math.min(680,Math.round(innerHeight*.8))):560;
const uid=()=>"c"+Date.now().toString(36)+Math.random().toString(36).slice(2,5);

function src(id,sym,tf){
  const base=location.href.split(/[?#]/)[0];
  return base+"?cid="+encodeURIComponent(id)+"&sym="+encodeURIComponent(sym)+"&tf="+tf+(TPO?"&v=tpo":"");
}
function mk(it,fresh){
  const el=document.createElement("div");el.className="mcc";el.dataset.id=it.id;
  el.innerHTML=`<div class="mch"><span class="mct" data-no-i18n><b></b> <i></i></span><span class="mcp" data-no-i18n></span>
    <span class="mca">
      <button type="button" data-a="up" title="Chuyển lên" aria-label="Chuyển lên">${ic("up")}</button>
      <button type="button" data-a="dn" title="Chuyển xuống" aria-label="Chuyển xuống">${ic("dn")}</button>
      <button type="button" data-a="fs" title="Toàn màn hình" aria-label="Toàn màn hình">${ic("fs")}</button>
      <button type="button" data-a="rm" class="mcx" title="Xoá chart này" aria-label="Xoá chart này">${ic("x")}</button>
    </span></div>
    <div class="mcf"></div>
    <div class="mcz" data-a="rz" role="separator" aria-orientation="horizontal" title="Kéo để đổi chiều cao" aria-label="Kéo để đổi chiều cao"></div>`;
  const f=document.createElement("iframe");
  f.title=TPO?"TPO phụ":"Chart phụ";f.setAttribute("allow","fullscreen");f.loading="lazy";
  f.src=src(it.id,fresh.sym,fresh.tf);
  el.querySelector(".mcf").appendChild(f);
  grid.appendChild(el);head(el,fresh.sym,TPO?modeOf(it.id):fresh.tf,"");
  return el;
}
function head(el,sym,tf,bid){
  el.querySelector(".mct b").textContent=sym||"";el.querySelector(".mct i").textContent=TPO?"TPO "+(tf||""):(tf?tfName(+tf):"");
  el.querySelector(".mcp").textContent=bid&&bid!=="–"?bid:"";
}
function layout(){
  const n=S.l.length;
  grid.classList.toggle("c1",S.c===1);
  S.l.forEach((it,i)=>{
    const el=grid.querySelector(`[data-id="${it.id}"]`);if(!el)return;
    el.style.order=i;el.style.setProperty("--mh",(it.h||defH())+"px");
    el.classList.toggle("wide",S.c!==1&&n%2===1&&i===n-1);
    el.querySelector('[data-a="up"]').disabled=i===0;el.querySelector('[data-a="dn"]').disabled=i===n-1;
  });
  const b=$(cfg.add),full=n>=maxN();
  b.disabled=full;b.title=full?"Đã đạt số chart phụ tối đa":(TPO?"Thêm TPO chart":"Thêm chart");
  $(cfg.n).textContent=n?n+"/"+maxN():"";
  root.classList.toggle("has",n>0);
  if(!TPO&&document.body.dataset.v==="ind"&&typeof buildInd==="function")buildInd();   // danh sách "chart đích" ở tab Indicator
  document.querySelectorAll("#"+cfg.cols+" [data-c]").forEach(x=>x.classList.toggle("on",+x.dataset.c===(S.c===1?1:2)));
}
function add(){
  if(S.l.length>=maxN())return;
  const prev=S.l.length?info[S.l[S.l.length-1].id]:null;
  const tf0=prev?+prev.tf:C.tf,L=allTfs().map(t=>t[1]),tf=TPO?(C.tf>=60?C.tf:900):L.find(s=>s>tf0)||L[L.length-1];   // chart: cùng mã, khung giờ lớn hơn 1 bậc (xem đa khung); TPO không dùng khung giờ
  const it={id:uid(),h:defH()};S.l.push(it);save();
  if(TPO){try{const v=ld0("tp_tpo","");if(v)localStorage.setItem("tp_tpo_"+it.id,v)}catch(e){}}   // TPO phụ khởi đầu bằng cài đặt TPO của chart chính, sau đó chỉnh riêng
  const el=mk(it,{sym:C.sym,tf});layout();
  requestAnimationFrame(()=>el.scrollIntoView({behavior:"smooth",block:"nearest"}));
}
function remove(id){
  if(fsId===id)setFs(id);                          // thoát toàn màn hình trước khi xoá
  const el=grid.querySelector(`[data-id="${id}"]`);
  if(el){const f=el.querySelector("iframe");if(f){try{f.src="about:blank"}catch(e){}}el.remove()}   // gỡ iframe -> dừng kết nối + timer của chart đó ngay
  S.l=S.l.filter(x=>x.id!==id);save();
  delete info[id];
  try{                                            // dọn dữ liệu riêng của chart đã xoá (tp_sym_<id>, tp_tf_<id>, tp_ind_<id>, tp_dw_<mã>_<id>...)
    const dead=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.endsWith("_"+id))dead.push(k)}
    dead.forEach(k=>localStorage.removeItem(k));
  }catch(e){}
  layout();
}
function move(id,d){
  const i=S.l.findIndex(x=>x.id===id),j=i+d;if(i<0||j<0||j>=S.l.length)return;
  [S.l[i],S.l[j]]=[S.l[j],S.l[i]];save();layout();
}
let fsId=null;
function setFs(id){
  fsId=fsId===id?null:id;
  grid.querySelectorAll(".mcc").forEach(el=>{
    const on=el.dataset.id===fsId;el.classList.toggle("fs",on);
    const b=el.querySelector('[data-a="fs"]');b.innerHTML=ic(on?"fx":"fs");
    const t=on?"Thoát toàn màn hình":"Toàn màn hình";b.title=t;b.setAttribute("aria-label",t);
  });
  document.body.classList.toggle("mcfs",!!fsId);
}
addEventListener("keydown",e=>{if(e.key==="Escape"&&fsId&&!document.querySelector(".mdl"))setFs(fsId)});

/* xoá cần bấm 2 lần (tránh lỡ tay trên điện thoại) */
let arm=null,armT=0;
function disarm(){if(arm){arm.classList.remove("arm");arm.title=arm.dataset.t;arm.setAttribute("aria-label",arm.dataset.t);arm=null}clearTimeout(armT)}
grid.addEventListener("click",e=>{
  const b=e.target.closest("button[data-a]");if(!b)return;
  const el=b.closest(".mcc"),id=el.dataset.id,a=b.dataset.a;
  if(a==="rm"){
    if(arm===b){disarm();remove(id);return}
    disarm();arm=b;b.dataset.t=b.title;b.classList.add("arm");
    b.title="Bấm lần nữa để xoá";b.setAttribute("aria-label","Bấm lần nữa để xoá");armT=setTimeout(disarm,3000);return;
  }
  disarm();
  if(a==="up")move(id,-1);else if(a==="dn")move(id,1);else if(a==="fs")setFs(id);
});
document.addEventListener("click",e=>{if(arm&&!e.target.closest(".mcx"))disarm()});

/* kéo thanh dưới thẻ để đổi chiều cao (chuột + cảm ứng) */
let rz=null;
grid.addEventListener("pointerdown",e=>{
  const g=e.target.closest(".mcz");if(!g||fsId)return;
  const el=g.closest(".mcc");rz={el,id:el.dataset.id,y:e.clientY,h:el.getBoundingClientRect().height,pid:e.pointerId};
  try{g.setPointerCapture(e.pointerId)}catch(x){}
  g.classList.add("on");el.classList.add("rz");e.preventDefault();
});
grid.addEventListener("pointermove",e=>{
  if(!rz||e.pointerId!==rz.pid)return;
  const h=Math.round(Math.max(280,Math.min(1400,rz.h+e.clientY-rz.y)));
  rz.el.style.setProperty("--mh",h+"px");rz.nh=h;
});
const rzEnd=e=>{
  if(!rz||e.pointerId!==rz.pid)return;
  const it=S.l.find(x=>x.id===rz.id);if(it&&rz.nh){it.h=rz.nh;save()}
  rz.el.classList.remove("rz");rz.el.querySelector(".mcz").classList.remove("on");rz=null;
};
grid.addEventListener("pointerup",rzEnd);grid.addEventListener("pointercancel",rzEnd);

/* thông tin từ iframe */
addEventListener("message",e=>{
  const m=e.data;if(!m||m.gx!==1||e.origin!==location.origin&&location.origin!=="null")return;
  const el=grid.querySelector(`[data-id="${m.cid}"]`);if(!el)return;
  const ch=!info[m.cid]||info[m.cid].sym!==m.sym||info[m.cid].tf!==m.tf;info[m.cid]={sym:m.sym,tf:m.tf,bid:m.bid};head(el,m.sym,TPO?mlbl(m.mode):m.tf,m.bid);
  if(!TPO&&ch&&document.body.dataset.v==="ind"&&typeof buildInd==="function")buildInd();
});

$(cfg.add).onclick=add;
$(cfg.cols).onclick=e=>{const b=e.target.closest("[data-c]");if(!b)return;S.c=+b.dataset.c===1?1:2;save();layout()};
matchMedia(MQ).addEventListener("change",layout);

S.l.forEach(it=>mk(it,{sym:ld0("tp_sym_"+it.id,C.sym),tf:+ld0("tp_tf_"+it.id,C.tf)}));    // sym/tf chỉ là mặc định; chart đã có thì dùng giá trị riêng đã lưu (tp_sym_<id>, tp_tf_<id>)
layout();
}
if(!EMB){
  mcInit({kind:"chart",root:"mc",grid:"mcGrid",add:"mcAdd",n:"mcN",cols:"mcCols",key:"tp_mc"});
  mcInit({kind:"tpo",root:"mt",grid:"mtGrid",add:"mtAdd",n:"mtN",cols:"mtCols",key:"tp_mct"});
}
