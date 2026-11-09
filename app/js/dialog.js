/* ================= HỘP THOẠI RIÊNG CỦA APP (thay confirm/alert mặc định của trình duyệt) =================
   gxDialog({title, msg, buttons:[{label, value, kind:"ghost"|"danger", keep, focus, onClick}]}) -> Promise
   - msg: tách đoạn bằng dòng trống; mỗi đoạn là một text node riêng nên i18n.js dịch được từng đoạn (thêm vào T trong i18n-data.js).
   - Bấm nút thường: đóng hộp thoại, Promise trả về b.value (mặc định true). Esc / bấm nền: trả về null.
   - Nút có keep:true không đóng hộp thoại, chỉ gọi onClick(nút) (vd nút "Tải dữ liệu"). */
function gxDialog(o){
  return new Promise(res=>{
    const prev=document.activeElement;
    const ov=document.createElement("div");ov.className="gxo";
    const bx=document.createElement("div");bx.className="card gxd";bx.setAttribute("role","dialog");bx.setAttribute("aria-modal","true");bx.setAttribute("aria-labelledby","gxdT");
    const h=document.createElement("h2");h.id="gxdT";h.textContent=o.title||"";bx.append(h);
    String(o.msg||"").split("\n\n").forEach(t=>{const p=document.createElement("p");p.textContent=t;bx.append(p)});
    const row=document.createElement("div");row.className="gxb";
    const done=v=>{ov.remove();document.removeEventListener("keydown",kd,true);try{prev&&prev.focus&&prev.focus()}catch(e){}res(v)};
    const bs=(o.buttons&&o.buttons.length?o.buttons:[{label:"OK",value:true}]).map(b=>{
      const e=document.createElement("button");e.type="button";e.className="btn"+(b.kind?" "+b.kind:"");e.textContent=b.label;
      e.onclick=()=>{if(b.keep){try{b.onClick&&b.onClick(e)}catch(x){}}else done(b.value===undefined?true:b.value)};
      row.append(e);return e});
    const kd=e=>{
      if(e.key==="Escape"){e.preventDefault();e.stopPropagation();done(null)}
      else if(e.key==="Tab"){ // giữ con trỏ trong hộp thoại
        const i=bs.indexOf(document.activeElement),n=bs.length;
        e.preventDefault();bs[(i+(e.shiftKey?-1:1)+n)%n].focus()}
    };
    document.addEventListener("keydown",kd,true);
    ov.onmousedown=e=>{if(e.target===ov)done(null)};
    bx.append(row);ov.append(bx);document.body.append(ov);
    const fi=(o.buttons||[]).findIndex(b=>b.focus);(bs[fi>=0?fi:bs.length-1]).focus();
  });
}
