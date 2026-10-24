/* ================= GỌI API (Cloudflare Worker) =================
   JC: địa chỉ Worker + phiên Discord, dùng cho Journal / đồng bộ MT5 (tách khỏi C của chart: C = mã + khung giờ). */
let JC={url:GX.api,token:GX.token};
function normUrl(u){u=(u||"").trim().replace(/\/+$/,"");return u&&!/^https?:\/\//i.test(u)?"https://"+u:u}
JC.url=normUrl(JC.url);
const jwhy=e=>e.message==="NET"?"không gọi được tới server: sai URL, bị CORS, hoặc trang đang mở trong khung xem trước bị chặn mạng (hãy tải file về và mở bằng trình duyệt)":e.message==="HTTP 401"?"phiên đăng nhập đã hết hạn, hãy đăng nhập lại":e.message;
async function api(method,path,body){
  let r;
  try{r=await fetch(JC.url+path,{method,headers:{"Content-Type":"application/json","Authorization":"Bearer "+JC.token},body:body?JSON.stringify(body):undefined})}
  catch(e){throw new Error("NET")}
  if(!r.ok){
    let m="HTTP "+r.status,j=null;
    try{j=await r.json()}catch{}
    if(r.status===401){GX.expired(j&&j.error);throw new Error(m)} // hết phiên hoặc không còn trong server -> về trang đăng nhập
    if(j&&j.error)m+=": "+j.error;
    throw new Error(m);
  }
  return r.status===204?null:r.json();
}
