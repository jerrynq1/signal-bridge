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
  const go=await gxDialog({
    title:"Tạo EA key mới",
    msg:"Tạo key mới sẽ xoá các lệnh MT5 đã đồng bộ (trên server và trình duyệt này), và key cũ ngừng hoạt động ngay. Bạn phải dán key mới vào EA trên MT5.\n\nXoá sẽ mất dữ liệu cũ, bạn có muốn tải dữ liệu xuống không?",
    buttons:[
      {label:"Tải dữ liệu (CSV)",kind:"ghost",keep:true,onClick:b=>{const n=window.JR&&JR.exportCSV?JR.exportCSV():0;b.textContent=n?"Đã tải xuống ✓":"Chưa có dữ liệu để tải"}},
      {label:"Huỷ",kind:"ghost",value:false,focus:true},
      {label:"Xoá & tạo key mới",kind:"danger",value:true}]
  });
  if(!go){cMsg("Đã huỷ. Key hiện tại vẫn dùng được.");return} // Huỷ / Esc / bấm nền: không đổi gì cả
  cMsg("Đang tạo key mới...");
  try{
    const r=await api("POST","/auth/regen-key",{wipe:true}); // server đổi key và xoá lệnh trong cùng một batch
    GX.me.ea_key=r.ea_key;fillConn();
    if(window.JR&&JR.wipeMT5)JR.wipeMT5(); // chỉ xoá phía trình duyệt SAU KHI server đã xác nhận
    cMsg("Đã xoá dữ liệu cũ và tạo key mới. Nhớ cập nhật key vào EA.");
  }catch(e){cMsg("Lỗi: "+why(e))}
};
$("cDel").onclick=async()=>{
  // Bước 1: cảnh báo + cho tải dữ liệu về trước
  const s1=await gxDialog({
    title:"Xoá tài khoản",
    msg:"Thao tác này xoá vĩnh viễn tài khoản của bạn và TOÀN BỘ dữ liệu: lệnh MT5 đã đồng bộ, số dư, EA key (trên server), cùng Journal lưu trong trình duyệt này, kể cả lệnh nhập tay.\n\nSau khi xoá, EA trên MT5 sẽ ngừng đồng bộ ngay và không thể khôi phục. Bạn có muốn tải dữ liệu xuống (CSV) trước không?",
    buttons:[
      {label:"Tải dữ liệu (CSV)",kind:"ghost",keep:true,onClick:b=>{const n=window.JR&&JR.exportCSV?JR.exportCSV():0;b.textContent=n?"Đã tải xuống ✓":"Chưa có dữ liệu để tải"}},
      {label:"Huỷ",kind:"ghost",value:false,focus:true},
      {label:"Tiếp tục",kind:"danger",value:true}]
  });
  if(!s1){cMsg("Đã huỷ. Tài khoản vẫn nguyên vẹn.");return}
  // Bước 2: xác nhận lần cuối
  const s2=await gxDialog({
    title:"Xác nhận xoá vĩnh viễn",
    msg:"Bạn chắc chắn muốn xoá tài khoản? Sau bước này không còn cách lấy lại dữ liệu.\n\nLưu ý: nếu vẫn ở trong server Discord, đăng nhập lại sẽ tạo một tài khoản mới hoàn toàn trống với EA key mới. Muốn mất quyền truy cập hẳn, hãy rời server hoặc nhờ admin gỡ role.",
    buttons:[
      {label:"Huỷ",kind:"ghost",value:false,focus:true},
      {label:"Xoá vĩnh viễn",kind:"danger",value:true}]
  });
  if(!s2){cMsg("Đã huỷ. Tài khoản vẫn nguyên vẹn.");return}
  cMsg("Đang xoá tài khoản...");
  $("cDel").disabled=true;
  try{
    await api("POST","/auth/delete-account",{confirm:true}); // server xoá user + lệnh + số dư trong cùng một batch
    // chỉ xoá phía trình duyệt SAU KHI server đã xác nhận
    try{["tjp_data","tjp_sync"].forEach(k=>localStorage.removeItem(GX.key(k)))}catch(e){}
    GX.logout(); // xoá phiên và về trang đăng nhập
  }catch(e){$("cDel").disabled=false;cMsg("Lỗi, chưa xoá gì: "+why(e))}
};
$("lo").onclick=()=>GX.logout();

/* ================= TẢI XUỐNG (link đặt ở config.js > DOWNLOAD_URL) ================= */
function fillDl(){
  const u=((window.GX_CONFIG&&GX_CONFIG.DOWNLOAD_URL)||"").trim(),b=$("dlBtn");
  if(u){b.href=u;b.hidden=false;$("dlSoon").hidden=true}else{b.hidden=true;$("dlSoon").hidden=false}
}
$("dlGo").onclick=()=>show("conn");

/* ================= BUY ME A COFFEE ================= */
$("cfCopy").onclick=async()=>{
  try{await navigator.clipboard.writeText("https://paypal.me/jerryforex");$("cfMsg").textContent="Đã sao chép."}
  catch(e){$("cfMsg").textContent="Không sao chép được, hãy tự bôi đen và copy."}
};

/* ================= GIAO DIỆN: sidebar, theme, bầu trời sao ================= */
const IC={conn:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3v5M15 3v5M6 8h12v4a6 6 0 0 1-12 0z"/><path d="M12 18v3"/></svg>'};
IC.jr='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>';
IC.an='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18"/><path d="M6 20v-7M12 20V5M18 20v-10"/></svg>';
IC.dl='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></svg>';
IC.cf='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 10h2a2.5 2.5 0 0 1 0 5h-2M8 3v3M12 3v3"/></svg>';
IC.card='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M6.5 15h4"/></svg>';
const V=[["jr","Journal"],["an","Analytic"],["card","Flex Card"],["dl","Tải xuống"],["conn","Kết nối"],["cf","Mời cà phê"]];
let cur="jr";
function show(v){
  cur=v;V.forEach(([k])=>$("v-"+k).classList.toggle("on",k===v));
  $("nav").innerHTML=V.map(([k,n])=>`<button class="sb${k===v?" on":""}" data-v="${k}" title="${n}"><span class="ic">${IC[k]}</span><span class="lb">${n}</span></button>`).join("");
  if(window.JR&&["jr","an","card"].includes(v))JR.show(v);
  if(v==="conn")fillConn();
  if(v==="dl")fillDl();
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
