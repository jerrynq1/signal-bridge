/* Khởi động app: mở thẳng Journal (hoặc mục trong #hash nếu có) */
setTheme();setSide();
{const h=(location.hash||"").slice(1);show(V.some(([k])=>k===h)?h:"jr")}
requestAnimationFrame(()=>requestAnimationFrame(()=>document.body.classList.remove("nt")));
