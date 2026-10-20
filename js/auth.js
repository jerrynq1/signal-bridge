/* ================= ĐĂNG NHẬP DISCORD: giữ phiên, chặn khi chưa đăng nhập, đăng xuất =================
   Nạp SAU config.js và TRƯỚC core.js.
   - Sau khi Discord xác nhận, Worker chuyển về app/index.html#token=<phiên>; file này lưu phiên vào localStorage.
   - Mọi lời gọi API gửi "Authorization: Bearer <phiên>"; Worker mới là nơi chặn thật sự (người ngoài server không có phiên).
   - Dữ liệu Journal lưu theo từng tài khoản Discord (GX.key) nên dùng chung 1 trình duyệt vẫn không lẫn dữ liệu. */
const GX=(function(){
  const KEY="gx_session",LOGIN="../login.html";
  const rd=()=>{try{return localStorage.getItem(KEY)||""}catch(e){return""}};
  const wr=t=>{try{t?localStorage.setItem(KEY,t):localStorage.removeItem(KEY)}catch(e){}};
  const m=/[#&]token=([^&]+)/.exec(location.hash);
  if(m){wr(decodeURIComponent(m[1]));history.replaceState(null,"",location.pathname+location.search)}
  const tok=rd();
  let d=null;
  try{d=JSON.parse(atob(tok.split(".")[0].replace(/-/g,"+").replace(/_/g,"/")))}catch(e){}
  const valid=!!(d&&d.uid&&d.exp>Date.now());
  const uid=valid?String(d.uid):"anon";
  const api=((window.GX_CONFIG&&window.GX_CONFIG.API_URL)||"").trim().replace(/\/+$/,"");
  const g={uid,token:valid?tok:"",api,me:null,cbs:[],
    key:k=>k+":"+uid,
    onMe(f){g.me?f(g.me):g.cbs.push(f)},
    expired(err){wr("");location.replace(LOGIN+(err?"?error="+encodeURIComponent(err):""))},
    logout(){wr("");location.replace(LOGIN)}
  };
  if(!valid){document.documentElement.style.visibility="hidden";g.expired(tok?"expired":"");return g} // chưa đăng nhập: về trang login (chỉ báo "hết hạn" nếu từng có phiên)

  // lần đầu sau khi nâng cấp: chuyển dữ liệu local cũ (chưa gắn tài khoản) về tài khoản này, rồi xoá khoá cũ
  try{
    if(!localStorage.getItem("gx_legacy_done")){
      ["tjp_data","tjp_sync"].forEach(k=>{const v=localStorage.getItem(k);if(v===null)return;
        if(localStorage.getItem(k+":"+uid)===null)localStorage.setItem(k+":"+uid,v);localStorage.removeItem(k)});
      localStorage.setItem("gx_legacy_done","1");
    }
    localStorage.removeItem("tp_tok");localStorage.removeItem("tp_url"); // token chung cũ không còn dùng
  }catch(e){}

  // xác nhận phiên với server + lấy tên, avatar, EA key
  fetch(api+"/auth/me",{headers:{Authorization:"Bearer "+tok}}).then(async r=>{
    if(r.status===401){let e="expired";try{e=(await r.json()).error||e}catch(_){}g.expired(e);return}
    if(!r.ok)return;
    g.me=await r.json();
    const box=document.getElementById("usr");
    if(box){document.getElementById("usrImg").src=g.me.avatar_url;document.getElementById("usrName").textContent=g.me.name;box.hidden=false}
    g.cbs.splice(0).forEach(f=>f(g.me));
  }).catch(()=>{}); // mất mạng thì giữ nguyên, không đá ra
  return g;
})();
