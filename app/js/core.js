const $=id=>document.getElementById(id);
const ld=(k,d)=>{try{return localStorage.getItem(k)??d}catch{return d}};
const sv=(k,v)=>{try{localStorage.setItem(k,v)}catch{}};
/* C: API (Cloudflare Worker) + phiên đăng nhập, dùng để đồng bộ lệnh từ MT5 vào Journal */
let C={url:GX.api,token:GX.token}; // API cố định (config.js) + phiên đăng nhập Discord
let P={theme:ld("gx-theme","")||ld("tp_theme","")||(matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light"),sc:ld("tp_sc","")==="1"};
