buildTfs();applyTfOpts();applyTz();clk();setTheme();setSide();{const hv=EMB?"":(location.hash||"").slice(1),v0=V.some(([k])=>k===hv)?hv:EMB&&QS.get("v")==="tpo"?"tpo":"chart";
  if(v0==="tpo"||v0==="tps"){show("chart");addEventListener("load",()=>show(v0))}   // tpo.js nạp sau init.js: mở tab TPO sau khi mọi file đã chạy
  else show(v0)}loadM1();
setInterval(poll,250);setInterval(clk,1000);
requestAnimationFrame(()=>requestAnimationFrame(()=>document.body.classList.remove("nt")));
