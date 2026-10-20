/* ================= KẾT NỐI (mỗi tài khoản Discord có EA key riêng) ================= */
const cMsg=t=>{$("cMsg").textContent=t};
const fillConn=()=>{$("cUrl").value=C.url;$("cTok").value=(GX.me&&GX.me.ea_key)||""};
GX.onMe(fillConn);
const copyTxt=async v=>{try{await navigator.clipboard.writeText(v);cMsg("Đã sao chép.")}catch(e){cMsg("Không sao chép được, hãy tự bôi đen và copy.")}};
$("cCopyUrl").onclick=()=>copyTxt($("cUrl").value);
$("cCopyKey").onclick=()=>copyTxt($("cTok").value);
$("cShow").onclick=()=>{const i=$("cTok"),h=i.type==="password";i.type=h?"text":"password";$("cShow").textContent=h?"Ẩn":"Hiện"};
$("cSave").onclick=async()=>{
  cMsg("Đang kiểm tra...");
  try{await api("GET","/api/health");cMsg("Kết nối được. Journal sẽ đồng bộ lệnh từ MT5.");if(window.JR)JR.sync()}
  catch(e){cMsg("Không kết nối được: "+why(e))}
};
$("cNew").onclick=async()=>{
  if(!confirm("Tạo EA key mới? Key cũ sẽ ngừng hoạt động và bạn phải dán key mới vào EA trên MT5."))return;
  try{const r=await api("POST","/auth/regen-key");GX.me.ea_key=r.ea_key;fillConn();cMsg("Đã tạo key mới. Nhớ cập nhật vào EA.")}
  catch(e){cMsg("Lỗi: "+why(e))}
};
$("lo").onclick=()=>GX.logout();

/* ================= GIAO DIỆN: sidebar, theme, bầu trời sao ================= */
const IC={conn:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3v5M15 3v5M6 8h12v4a6 6 0 0 1-12 0z"/><path d="M12 18v3"/></svg>'};
IC.jr='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>';
IC.an='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18"/><path d="M6 20v-7M12 20V5M18 20v-10"/></svg>';
IC.card='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M6.5 15h4"/></svg>';
const V=[["jr","Journal"],["an","Analytic"],["card","Flex Card"],["conn","Kết nối"]];
let cur="jr";
function show(v){
  cur=v;V.forEach(([k])=>$("v-"+k).classList.toggle("on",k===v));
  $("nav").innerHTML=V.map(([k,n])=>`<button class="sb${k===v?" on":""}" data-v="${k}" title="${n}"><span class="ic">${IC[k]}</span><span class="lb">${n}</span></button>`).join("");
  if(window.JR&&["jr","an","card"].includes(v))JR.show(v);
  if(v==="conn")fillConn();
  document.body.classList.remove("so");
  try{history.replaceState(null,"","#"+v)}catch(e){}
}
$("nav").onclick=e=>{const b=e.target.closest("[data-v]");if(b)show(b.dataset.v)};
const mob=()=>matchMedia("(max-width:760px)").matches;
function setSide(){document.body.classList.toggle("sc",!mob()&&P.sc)}
const tgl=()=>{if(mob())document.body.classList.toggle("so");else{P.sc=!P.sc;sv("tp_sc",P.sc?"1":"0");setSide()}};
$("tg").onclick=tgl;$("tg2").onclick=tgl;$("scrim").onclick=()=>document.body.classList.remove("so");
function setTheme(){
  document.documentElement.dataset.theme=P.theme;sv("tp_theme",P.theme);sv("gx-theme",P.theme);
  $("th").innerHTML=P.theme==="dark"?'<span class="ic">☀</span><span class="lb">Sáng</span>':'<span class="ic">🌙</span><span class="lb">Tối</span>';
}
$("th").onclick=()=>{P.theme=P.theme==="dark"?"light":"dark";setTheme()};

(function(){
  const cv=$("sky"),x=cv.getContext("2d"),rm=matchMedia("(prefers-reduced-motion:reduce)").matches;
  let W,H,st=[],col="255,255,255",f=0;
  function size(){const d=devicePixelRatio||1;W=innerWidth;H=innerHeight;cv.width=W*d;cv.height=H*d;x.setTransform(d,0,0,d,0,0);
    st=Array.from({length:Math.round(W*H/5000)},()=>({x:Math.random()*W,y:Math.random()*H,z:Math.random()*.9+.1,p:Math.random()*6.28,s:Math.random()*.004+.001}))}
  function frame(t){
    if(f++%30===0)col=getComputedStyle(document.documentElement).getPropertyValue("--star").trim()||"255,255,255";
    x.clearRect(0,0,W,H);
    st.forEach(s=>{const a=.3+.7*Math.abs(Math.sin(s.p+t*s.s));x.fillStyle=`rgba(${col},${a*s.z})`;x.beginPath();x.arc(s.x,(s.y+(rm?0:t*.006*s.z))%H,s.z*1.4+.2,0,6.283);x.fill()});
    if(!rm)requestAnimationFrame(frame)
  }
  size();addEventListener("resize",()=>{size();setSide();if(rm)frame(0)});requestAnimationFrame(frame);
})();
