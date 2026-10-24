/* Kiểm tra thuật toán TPO (tpoDay): POC, Value Area (CME), Single Print / đuôi, Poor High/Low, Initial Balance, cơ sở khối lượng, hình dạng profile.
   Chạy: node tests/tpo.test.js  — không cần mạng, không cần trình duyệt. */
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const el=()=>new Proxy(function(){},{get:(t,k)=>k==='classList'?{add(){},remove(){},contains:()=>true}:k==='getContext'?()=>new Proxy({},{get:()=>()=>({width:5})}):k==='getBoundingClientRect'?()=>({width:100,height:100}):el(),set:()=>true,apply:()=>el()});
const ctx={console,Math,JSON,Date,Map,Set,Object,String,Number,Array,Float64Array,Promise,parseInt,isFinite,
  ld:(k,d)=>d,sv(){},$:()=>el(),getComputedStyle:()=>({getPropertyValue:()=>'#fff'}),document:{documentElement:{},hidden:true,addEventListener(){},querySelector(){return null}},
  ResizeObserver:class{observe(){}},setInterval(){},setTimeout(){},clearTimeout(){},requestAnimationFrame(){return 1},devicePixelRatio:1,matchMedia:()=>({matches:false}),addEventListener(){},
  pd:()=>2,m1:[],SUB:()=>false,loading:false,C:{sym:'T',tf:60},tfName:()=>'',show(){},window:{},FPM:new Map(),BA:null,m1NoMore:false,fillBusy:false,fillRetry:0,m1Old:0,m1Span:1,gen:0};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','tpo.js'),'utf8').replace(/\bconst (\w+)=/g,'var $1=').replace(/^let /gm,'var ').replace(/\bconst (\w+),/g,'var $1,'),ctx);
const day=(B,o,tk)=>{ctx.B=B;ctx.O=o||{};ctx.TK=tk||1;return vm.runInContext('tpoDay(0,B,TK,1800,.7,false,O)',ctx)};
let n=0;const ok=x=>{console.log('ok  ',x);n++};
const PER=1800;
// các nến M1: [thời điểm, open, high, low, close, volume]; mỗi chu kỳ 30 phút = 1 nến TPO
const A=[0,10,14,10,14,10],B1=[PER,12,16,12,16,10],C=[2*PER,12,13,12,13,10];
{ const T=day([A,B1,C]);
  assert.strictEqual(JSON.stringify(Array.from(T.cnt)),JSON.stringify([1,1,3,3,2,1,1]));ok('đếm TPO theo hàng');
  assert.strictEqual(T.poc,3);ok('POC: hoà 2 hàng -> hàng gần tâm profile');
  assert.strictEqual(T.vl,1);assert.strictEqual(T.vh,5);ok('Value Area 70% theo CME (so 2 hàng trên / 2 hàng dưới)');
  assert.strictEqual(JSON.stringify(T.sp.map(x=>x.join())),JSON.stringify(['0,1,L','5,6,H']));ok('Single Print: đuôi mua (đáy) + đuôi bán (đỉnh)');
  assert.strictEqual(T.poorH,false);assert.strictEqual(T.poorL,false);ok('không Poor High/Low khi đỉnh/đáy chỉ có 1 TPO');
  assert.strictEqual(T.ibh,16);assert.strictEqual(T.ibl,10);ok('Initial Balance = cao/thấp của 2 chu kỳ đầu (60 phút)');
}
{ const T=day([A,B1,C],{spMin:3});assert.strictEqual(T.sp.length,0);ok('spMin=3: dãy 2 hàng không còn là Single Print');}
{ // IB không lấy chu kỳ sau giờ đầu; đỉnh/đáy phẳng 2 TPO -> Poor
  const T=day([[0,10,11,10,11,5],[3*PER,30,31,30,31,5],[3*PER+60,10,11,10,11,5]]);
  assert.strictEqual(T.ibh,11);assert.strictEqual(T.ibl,10);ok('IB bỏ qua nến ngoài giờ đầu');
}
{ const T=day([[0,10,12,10,12,5],[PER,10,12,10,12,5],[2*PER,10,12,10,12,5]]);
  assert.strictEqual(T.poorH,true);assert.strictEqual(T.poorL,true);assert.strictEqual(T.sp.length,0);ok('đỉnh/đáy phẳng nhiều TPO = Poor High / Poor Low');
}
{ // cơ sở khối lượng: POC theo volume, khác POC theo TPO
  const T0=day([A,B1,C]),T1=day([[0,10,14,10,14,1],[PER,12,16,12,16,1],[2*PER,12,13,12,13,1],[3*PER,16,16,16,16,5000]],{vol:true});
  assert.strictEqual(T0.byV,false);assert.strictEqual(T1.byV,true);assert.strictEqual(T1.poc,T1.n-1);ok('cơ sở Khối lượng: POC theo volume');
}
{ // hình dạng
  const mk=(c)=>{const bars=[];c.forEach((k,i)=>{for(let p=0;p<k;p++)bars.push([p*PER,10+i,10+i,10+i,10+i,1])});return bars};
  assert.strictEqual(day(mk([1,2,3,4,5,6,7,8,9,10,9])).shape,'P');ok('hình dạng P (dày phía trên)');
  assert.strictEqual(day(mk([10,9,8,7,6,5,4,3,2,1,1])).shape,'b');ok('hình dạng b (dày phía dưới)');
  assert.strictEqual(day(mk([2,4,7,10,7,3,1,1,3,7,10,7,4,2])).shape,'B');ok('hình dạng B (double distribution)');
  assert.strictEqual(day(mk([2,4,6,8,10,8,6,4,2])).shape,'D');ok('hình dạng D (chuẩn)');
}
console.log('\n'+n+' kiểm tra đạt');
// vẽ thử (canvas giả): không được ném lỗi khi bật mọi lớp mới (IB, nhãn cấu trúc, chữ cái, delta)
{ const g=new Proxy({},{get:(t,k)=>k==='measureText'?(x=>({width:String(x).length*5})):()=>{},set:()=>true});
  ctx.G=g;ctx.B=[A,B1,C];
  vm.runInContext(`(()=>{const s=Object.assign(tpS(),{cell:16,asp:1,showIB:true,showStruct:true,lt:true}),T=tpoDay(0,B,1,1800,.7,false,{}),{L}=tpoLayout([{d:0,T}],s);
    tpoPaint(G,600,300,66,26,L,{cw:16,rh:16,sx:-8,cp:13,u:T.bp},s,tpoCol(),13,null)})()`,ctx);
  ok('vẽ đầy đủ các lớp TPO không lỗi');
}
console.log(n+' kiểm tra đạt (gồm vẽ)');

/* ---- Loại profile: Daily / Weekly / Session ---- */
{
  const D0=20451;                                         // 20451 = thứ Hai (ngày epoch; thứ Hai khi (ngày+3)%7===0)
  const mkBars=(days,step)=>{const o=[];for(const d of days)for(let t=0;t<86400;t+=step)o.push([d*86400+t,100,101,99,100,1]);return o};
  const grp=(bars,s)=>{ctx.GB=bars;ctx.GS=s;return vm.runInContext('(()=>{const r=tpoGroup(GB,GS);return {keys:r.keys,have:r.have,need:r.need,mode:r.mo.mode,sL:r.mo.sL,sN:r.mo.sN}})()',ctx)};
  const two=[D0,D0+1,D0+2,D0+3,D0+4,D0+7,D0+8];            // T2..T6 + T2, T3 tuần sau
  let r=grp(mkBars(two,600),{mode:'day',days:3});
  assert.deepStrictEqual(Array.from(r.keys),[D0+4,D0+7,D0+8]);assert.strictEqual(r.need,4);ok('day: lấy N ngày cuối');
  r=grp(mkBars(two,600),{mode:'week',weeks:2});
  assert.deepStrictEqual(Array.from(r.keys),[Math.floor((D0+3)/7),Math.floor((D0+10)/7)]);assert.strictEqual(r.have,2);ok('week: thứ Hai..thứ Sáu cùng một tuần, tuần sau tách riêng');
  assert.strictEqual(Math.floor((D0+4+3)/7),Math.floor((D0+3)/7));ok('thứ Sáu vẫn thuộc tuần của thứ Hai');
  r=grp(mkBars([D0],3600),{mode:'session',days:1,sL:9,sN:15});
  assert.deepStrictEqual(Array.from(r.keys),[D0*4,D0*4+1,D0*4+2]);ok('session: 1 ngày -> 3 phiên (Asia / London / New York)');
  // ranh giới phiên: 08:59 -> Asia, 09:00 -> London, 14:59 -> London, 15:00 -> New York
  const at=(h,m)=>[D0*86400+h*3600+m*60,1,1,1,1,1];
  r=grp([at(8,59),at(9,0),at(14,59),at(15,0),at(23,59)],{mode:'session',days:1,sL:9,sN:15});
  assert.deepStrictEqual(Array.from(r.keys),[D0*4,D0*4+1,D0*4+2]);
  ctx.GB=[at(8,59),at(9,0),at(14,59),at(15,0)];
  const cnt=vm.runInContext('(()=>{const r=tpoGroup(GB,{mode:"session",days:1,sL:9,sN:15});return r.keys.map(k=>r.g.get(k).length)})()',ctx);
  assert.deepStrictEqual(Array.from(cnt),[1,2,1]);ok('ranh giới phiên đúng (09:00 -> London, 15:00 -> New York)');
  r=grp(mkBars(two,3600),{mode:'session',days:2,sL:9,sN:15});
  assert.strictEqual(r.keys.length,6);assert.strictEqual(r.have,7);assert.strictEqual(r.need,3);ok('session: N ngày = 3N profile; have = số ngày');
  r=grp([at(1,0)],{mode:'session',days:1,sL:20,sN:15});
  assert.strictEqual(r.sL,9);assert.strictEqual(r.sN,15);ok('giờ phiên sai (London >= New York) -> về mặc định 9 / 15');
  r=grp([at(1,0)],{mode:'bậy',days:1});assert.strictEqual(r.mode,'day');ok('loại profile lạ -> day');
  // IB tắt cho profile tuần; có cho ngày/phiên
  const Bw=[[0,10,12,10,12,5],[PER,10,12,10,12,5]];
  assert.strictEqual(day(Bw,{ib:0}).ibh,null);assert.strictEqual(day(Bw,{}).ibh,12);ok('o.ib=0 tắt Initial Balance (weekly)');
  // a0 tuỳ chỉnh: chu kỳ tính từ đầu phiên, không từ đầu ngày
  const base=9*3600,Bs=[[base,10,11,10,11,5],[base+PER,10,12,10,12,5]];
  ctx.B=Bs;ctx.O={a0:base};const Ts=vm.runInContext('tpoDay(0,B,1,1800,.7,false,O)',ctx);
  assert.strictEqual(Math.max(...Array.from(Ts.per).flatMap(a=>Array.from(a))),1);ok('a0: chu kỳ đầu tiên của phiên là A (chỉ số 0)');
  // vẽ session: khung ngày + 3 phiên không lỗi
  const g=new Proxy({},{get:(t,k)=>k==='measureText'?(x=>({width:String(x).length*5})):()=>{},set:()=>true});
  ctx.G=g;ctx.B3=[[0,A],[1,B1],[2,C]];
  vm.runInContext(`(()=>{const s=Object.assign(tpS(),{mode:"session",cell:16,asp:1}),mk=(i,bars)=>({d:i,g:7,lab:"10-21 Wed",nm:["Asia","London","New York"][i],T:tpoDay(0,bars,1,1800,.7,false,{})}),
      {L}=tpoLayout([mk(0,[${JSON.stringify(A)},${JSON.stringify(B1)}]),mk(1,[${JSON.stringify(B1)},${JSON.stringify(C)}]),mk(2,[${JSON.stringify(A)},${JSON.stringify(C)}])],s);
    if(L[1].u<=L[0].u)throw new Error("layout");tpoPaint(G,900,300,66,26,L,{cw:12,rh:12,sx:-8,cp:13,u:1},s,tpoCol(),13,null)})()`,ctx);
  ok('vẽ khung ngày + 3 phiên không lỗi');
}
console.log(n+' kiểm tra đạt (gồm Daily/Weekly/Session)');
