/* GM — Ghost Mode · статистика и диаграммы
   Разработано Veraxis */

/* =========================================================
   Статистика
   ========================================================= */
const C = { done:'#e6e6ea', undone:'url(#hatch)', undoneCss:'repeating-linear-gradient(135deg,#3a3a42 0 2px,#1c1c20 2px 5px)', grid:'#1c1c20', seq:['#26262b','#48484f','#75757d','#aeaeb5','#f2f2f4'], empty:'#121214' };
const NS = 'http://www.w3.org/2000/svg';
// цвета берутся из текущей темы
const K = {};
function themeColors(){
  const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim();
  Object.assign(K, { hi:v('--hi'), fg:v('--fg'), bg:v('--bg'), surface:v('--surface'), mid:v('--mid'), line:v('--line'), line2:v('--line-2'), done:v('--done') });
  C.done = K.done; C.grid = K.line; C.undoneCss = v('--hatch');
}

function byDay(){
  const m = {};
  for(const x of data.tasks){ (m[x.date] ||= {done:0,total:0}); m[x.date].total++; if(x.done) m[x.date].done++; }
  return m;
}

$('range').addEventListener('click', e => {
  const b = e.target.closest('button'); if(!b) return;
  range = +b.dataset.d;
  $('range').querySelectorAll('button').forEach(x => x.classList.toggle('on', x===b));
  renderStats();
});
$('tableToggle').onclick = () => {
  const open = $('tableBox').classList.toggle('open');
  $('tableToggle').textContent = open ? 'Скрыть таблицу' : 'Показать таблицей';
};

function renderStats(){
  themeColors();
  const m = byDay(), t = today();
  const days = []; for(let i=range-1;i>=0;i--) days.push(addDays(t,-i));
  let done=0,total=0;
  const rows = days.map(d => { const v = m[d]||{done:0,total:0}; done+=v.done; total+=v.total; return {d, done:v.done, miss:v.total-v.done, total:v.total}; });

  // серия: дни подряд, где сделано хотя бы одно дело (сегодня можно ещё не закончить)
  const {streak, best} = streakInfo(m);

  $('kDone').textContent = done;
  $('kDoneS').textContent = `${plural(done,'дело','дела','дел')} за ${range} ${plural(range,'день','дня','дней')}`;
  $('kRate').textContent = total ? Math.round(done/total*100)+'%' : '—';
  $('kRateS').textContent = total ? `${done} из ${total}` : 'нет дел за период';
  $('kStreak').textContent = streak;
  $('kStreakCard').classList.toggle('hot', streak >= 3);
  $('kStreakS').textContent = `${plural(streak,'день','дня','дней')} подряд · рекорд ${best}`;
  $('kMiss').textContent = total - done;

  drawLine(rows);
  drawBars(rows);
  drawHeat(m);
  drawWeek(m);
  $('tableBox').innerHTML = `<table class="data"><thead><tr><th>Дата</th><th>Сделано</th><th>Не сделано</th><th>%</th></tr></thead><tbody>${
    rows.slice().reverse().map(r=>`<tr><td>${WDS[parse(r.d).getDay()]}, ${short(r.d)}</td><td>${r.done}</td><td>${r.miss}</td><td>${r.total?Math.round(r.done/r.total*100)+'%':'—'}</td></tr>`).join('')
  }</tbody></table>`;
}

function el(tag, attrs, parent){ const e = document.createElementNS(NS, tag); for(const k in attrs) e.setAttribute(k, attrs[k]); if(parent) parent.appendChild(e); return e; }
// столбик со скруглённым верхом
function topRounded(x,y,w,h,r){ r=Math.min(r,w/2,h); return `M${x},${y+h}V${y+r}Q${x},${y} ${x+r},${y}H${x+w-r}Q${x+w},${y} ${x+w},${y+r}V${y+h}Z`; }
function niceMax(v){ if(v<=4) return 4; const p = Math.pow(10, Math.floor(Math.log10(v))); for(const k of [1,2,2.5,5,10]) if(k*p>=v) return k*p; return v; }

const tip = $('tip');
function showTip(e, html){ tip.innerHTML = html; tip.style.opacity = 1; moveTip(e); }
function moveTip(e){ const w = tip.offsetWidth; let x = e.clientX + 14; if(x + w > innerWidth - 8) x = e.clientX - w - 14; tip.style.left = x+'px'; tip.style.top = (e.clientY + 14)+'px'; }
function hideTip(){ tip.style.opacity = 0; }

function drawBars(rows){
  const box = $('chartDays'); box.innerHTML='';
  const W=Math.max(300, Math.round(box.clientWidth)||680), H=W<500?190:220, L=26, R=6, T=10, B=26, pw=W-L-R, ph=H-T-B;
  const svg = el('svg',{viewBox:`0 0 ${W} ${H}`, role:'img', 'aria-label':'Сделано и не сделано по дням'}, box);
  svg.insertAdjacentHTML('afterbegin',`<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="${K.line}"/><rect width="2.2" height="6" fill="${K.line2}"/></pattern></defs>`);
  const top = Math.max(1,...rows.map(r=>r.total));
  const step = [1,2,5,10,20,50,100].find(k => top/k <= 4) || 100;
  const ticks = Math.ceil(top/step), max = step*ticks;
  for(let i=0;i<=ticks;i++){
    const v = step*i, y = T+ph - v/max*ph;
    el('line',{x1:L,x2:W-R,y1:y,y2:y,stroke:C.grid,'stroke-width':1, 'stroke-dasharray': i? '2 4':''},svg);
    const tx = el('text',{x:L-8,y:y+4,'text-anchor':'end'},svg); tx.textContent = v;
  }
  const n = rows.length, slot = pw/n, gap = n>40?1.5:n>20?3:8, bw = Math.max(2, slot-gap);
  const labelEvery = n<=7?1:n<=30?(W<500?7:5):(W<500?30:15);
  rows.forEach((r,i)=>{
    const x = L + i*slot + (slot-bw)/2;
    const hDone = r.done/max*ph, hMiss = r.miss/max*ph;
    const base = T+ph;
    if(r.done){ el('path',{d: r.miss ? `M${x},${base}V${base-hDone}H${x+bw}V${base}Z` : topRounded(x, base-hDone, bw, hDone, 4), fill:C.done},svg); }
    if(r.miss){ const y0 = base - hDone - (r.done?2:0); el('path',{d: topRounded(x, y0-hMiss, bw, Math.max(0,hMiss), 4), fill:C.undone, stroke:'#4a4a53', 'stroke-width':1},svg); }
    if(!r.total){ el('rect',{x, y:base-2, width:bw, height:2, rx:1, fill:C.grid},svg); }
    if(i % labelEvery === (n-1) % labelEvery){
      const tx = el('text',{x:x+bw/2, y:H-8,'text-anchor':'middle'},svg);
      tx.textContent = n<=7 ? WDS[parse(r.d).getDay()] : short(r.d);
    }
    const hit = el('rect',{class:'hit',x:L+i*slot,y:T,width:slot,height:ph},svg);
    const html = `<div class="t">${WD[parse(r.d).getDay()]}, ${human(r.d)}</div>` + (r.total ?
      `<div class="r"><i style="background:${C.done}"></i>Сделано: <b>${r.done}</b></div><div class="r"><i style="background:${C.undoneCss}"></i>Не сделано: <b>${r.miss}</b></div>` : 'Дел не было');
    hit.addEventListener('mouseenter', e=>showTip(e,html)); hit.addEventListener('mousemove', moveTip); hit.addEventListener('mouseleave', hideTip);
  });
}

const HEAT = [
  {c:'#16161a', l:'нет дел', stroke:'#2a2a30'},
  {c:'#2f4c8f', l:'0%'},
  {c:'#2f86d6', l:'1–49%'},
  {c:'#b56ce6', l:'50–79%'},
  {c:'#f58a4b', l:'80–99%'},
  {c:'#ffd166', l:'100%'}
];
function heatLevel(v){ if(!v || !v.total) return 0; const r = v.done/v.total; return r===1?5:r>=.8?4:r>=.5?3:r>0?2:1; }
$('heatLegend').innerHTML = HEAT.map(h=>`<span><i style="background:${h.c};${h.stroke?`box-shadow:inset 0 0 0 1px ${h.stroke}`:''}"></i>${h.l}</span>`).join('');

function drawHeat(m){
  const box = $('chartHeat'); box.innerHTML='';
  const bw = box.clientWidth || 700;
  const weeks = bw < 480 ? 15 : 26, L = 26, T = 18;
  const cell = Math.max(12, Math.min(22, Math.floor((bw - L) / weeks) - 4)), g = 4;
  const W = L + weeks*(cell+g), H = T + 7*(cell+g);
  const svg = el('svg',{viewBox:`0 0 ${W} ${H}`, width:W, role:'img','aria-label':'Активность по дням'}, box);
  svg.insertAdjacentHTML('afterbegin','<defs><filter id="hglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5"/></filter></defs>');
  const t = today(); const td = parse(t);
  const dow = (td.getDay()+6)%7;
  const start = addDays(t, -(weeks-1)*7 - dow);
  ['Пн','','Ср','','Пт','','Вс'].forEach((s,i)=>{ if(s){ const tx=el('text',{x:0,y:T+i*(cell+g)+cell*0.72},svg); tx.textContent=s; }});
  let lastMonth = -1, lastX = -99;
  for(let w=0; w<weeks; w++){
    for(let d=0; d<7; d++){
      const day = addDays(start, w*7+d);
      if(day > t) continue;
      const v = m[day], lv = heatLevel(v), h = HEAT[lv];
      const x = L + w*(cell+g), y = T + d*(cell+g);
      if(lv===5) el('rect',{x,y,width:cell,height:cell,rx:4,fill:h.c,filter:'url(#hglow)',opacity:.6},svg);
      const rc = el('rect',{x,y,width:cell,height:cell,rx:4,fill:h.c,stroke:day===t?K.hi:(h.stroke||'none'),'stroke-width':day===t?1.5:1},svg);
      rc.style.cursor='pointer';
      const html = `<div class="t">${WD[parse(day).getDay()]}, ${human(day)}</div>` + (v&&v.total ? `<div class="r"><i style="background:${h.c}"></i>Сделано ${v.done} из ${v.total} · <b>${Math.round(v.done/v.total*100)}%</b></div>` : 'Дел не было');
      rc.addEventListener('mouseenter', e=>showTip(e,html)); rc.addEventListener('mousemove', moveTip); rc.addEventListener('mouseleave', hideTip);
      rc.addEventListener('click', ()=>{ hideTip(); cur = day; document.querySelector('.tab[data-view="today"]').click(); render(); });
      if(d===0){ const mo = parse(day).getMonth(); if(mo!==lastMonth){ lastMonth=mo; if(x-lastX>=34){ lastX=x; const tx=el('text',{x,y:11},svg); tx.textContent=MONS[mo]; } } }
    }
  }
}

function drawWeek(m){
  const box = $('chartWeek'); box.innerHTML='';
  const agg = Array.from({length:7},()=>({done:0,total:0}));
  const t = today();
  for(const d in m){ if(d>t) continue; const i=(parse(d).getDay()+6)%7; agg[i].done+=m[d].done; agg[i].total+=m[d].total; }
  const NAMES = ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'];
  const SH = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  const W = Math.max(320, Math.round(box.clientWidth)||700), small = W < 520;
  const H = small ? 240 : 290, T = 34, B = 48, L = 34, R = 8, pw = W-L-R, ph = H-T-B, slot = pw/7, bw = Math.min(64, slot*0.58);
  const svg = el('svg',{viewBox:`0 0 ${W} ${H}`, role:'img','aria-label':'Процент выполнения по дням недели'}, box);
  svg.insertAdjacentHTML('afterbegin',`<defs>
    <linearGradient id="wkg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${K.hi}"/><stop offset="1" stop-color="${K.mid}"/></linearGradient>
    <linearGradient id="wkt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(${K.fg},.06)"/><stop offset="1" stop-color="rgba(${K.fg},.015)"/></linearGradient>
    <filter id="wkglow" x="-50%" y="-20%" width="200%" height="140%"><feGaussianBlur stdDeviation="8"/></filter></defs>`);
  [0,25,50,75,100].forEach(v=>{ const y = T+ph - v/100*ph; el('line',{x1:L,x2:W-R,y1:y,y2:y,stroke:C.grid,'stroke-dasharray':v?'2 5':''},svg); const tx=el('text',{x:L-8,y:y+4,'text-anchor':'end'},svg); tx.textContent=v+'%'; });
  const pcts = agg.map(a => a.total ? a.done/a.total : -1);
  const bestI = pcts.indexOf(Math.max(...pcts));
  SH.forEach((s,i)=>{
    const a = agg[i], p = a.total ? a.done/a.total : 0;
    const x = L + i*slot + (slot-bw)/2, h = Math.max(p*ph, a.total?3:0);
    el('path',{d:topRounded(x, T, bw, ph, 10), fill:'url(#wkt)'},svg);
    if(a.total){
      if(i===bestI) el('path',{d:topRounded(x, T+ph-h, bw, h, 10), fill:K.hi, opacity:.35, filter:'url(#wkglow)'},svg);
      el('path',{d:topRounded(x, T+ph-h, bw, h, 10), fill: i===bestI ? 'url(#wkg)' : '#cfcfd4', opacity: i===bestI?1:.85},svg);
    }
    const vx = el('text',{x:x+bw/2,y:T+ph-h-10,'text-anchor':'middle'},svg); vx.textContent = a.total ? Math.round(p*100)+'%' : '—';
    vx.style.cssText = `fill:${a.total?'var(--hi)':'var(--ink-3)'};font-size:${small?12:15}px;font-weight:700`;
    const lx = el('text',{x:x+bw/2,y:H-B+20,'text-anchor':'middle'},svg); lx.textContent = s; lx.style.cssText='fill:var(--ink);font-size:13px;font-weight:600';
    const cx = el('text',{x:x+bw/2,y:H-B+38,'text-anchor':'middle'},svg); cx.textContent = a.total ? `${a.done} из ${a.total}` : 'нет дел';
    cx.style.cssText = `fill:var(--ink-3);font-size:${small?10:12}px`;
    const hit = el('rect',{class:'hit',x:L+i*slot,y:0,width:slot,height:H},svg);
    const html = `<div class="t">${NAMES[i]}</div>` + (a.total?`Сделано ${a.done} из ${a.total} · <b>${Math.round(p*100)}%</b>`:'Дел не было');
    hit.addEventListener('mouseenter', e=>showTip(e,html)); hit.addEventListener('mousemove', moveTip); hit.addEventListener('mouseleave', hideTip);
  });
  $('weekTable').innerHTML = `<table class="wk-table"><thead><tr><th>День</th><th>Сделано</th><th>Всего дел</th><th>Не сделано</th><th>%</th><th></th></tr></thead><tbody>${
    agg.map((a,i)=>{ const p = a.total ? Math.round(a.done/a.total*100) : null;
      return `<tr class="${i===bestI&&a.total?'best':''}"><td>${NAMES[i]}</td><td>${a.done}</td><td>${a.total}</td><td>${a.total-a.done}</td><td><b>${p===null?'—':p+'%'}</b></td><td><span class="bar"><i style="width:${p||0}%"></i></span></td></tr>`; }).join('')
  }</tbody></table>`;
}

/* ---------- линейная диаграмма динамики ---------- */
function smoothPath(pts){
  if(pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for(let i=0;i<pts.length-1;i++){
    const p0 = pts[i-1]||pts[i], p1 = pts[i], p2 = pts[i+1], p3 = pts[i+2]||p2, k = 0.18;
    const lo = Math.min(p1[1],p2[1]), hi = Math.max(p1[1],p2[1]), cl = v => Math.max(lo, Math.min(hi, v));
    const c1 = [p1[0]+(p2[0]-p0[0])*k, cl(p1[1]+(p2[1]-p0[1])*k)], c2 = [p2[0]-(p3[0]-p1[0])*k, cl(p2[1]-(p3[1]-p1[1])*k)];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}
function drawLine(rows){
  const box = $('chartLine'); box.innerHTML='';
  const W = Math.max(300, Math.round(box.clientWidth)||680), H = W<500?200:250, L=38, R=12, T=16, B=28, pw=W-L-R, ph=H-T-B;
  const svg = el('svg',{viewBox:`0 0 ${W} ${H}`, role:'img','aria-label':'Динамика процента выполнения'}, box);
  svg.insertAdjacentHTML('afterbegin',`<defs>
    <linearGradient id="lnArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(${K.fg},.22)"/><stop offset="1" stop-color="rgba(${K.fg},0)"/></linearGradient>
    <linearGradient id="lnStroke" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${K.mid}"/><stop offset="1" stop-color="${K.hi}"/></linearGradient>
    <filter id="lnGlow" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="5"/></filter></defs>`);
  [0,25,50,75,100].forEach(v=>{ const y=T+ph-v/100*ph; el('line',{x1:L,x2:W-R,y1:y,y2:y,stroke:C.grid,'stroke-dasharray':v?'2 5':''},svg); const tx=el('text',{x:L-8,y:y+4,'text-anchor':'end'},svg); tx.textContent=v+'%'; });
  const n = rows.length, xAt = i => L + (n===1 ? pw/2 : i*pw/(n-1));
  const pts = []; rows.forEach((r,i)=>{ if(r.total) pts.push([xAt(i), T+ph - (r.done/r.total)*ph, i]); });
  const labelEvery = n<=7?1:n<=30?(W<500?7:5):(W<500?30:15);
  rows.forEach((r,i)=>{ if(i % labelEvery === (n-1) % labelEvery){ const tx=el('text',{x:xAt(i),y:H-8,'text-anchor':'middle'},svg); tx.textContent = n<=7 ? WDS[parse(r.d).getDay()] : short(r.d); } });
  if(!pts.length){ const tx=el('text',{x:W/2,y:T+ph/2,'text-anchor':'middle'},svg); tx.textContent='Пока нет данных — отмечай дела, и линия появится'; return; }
  const avg = pts.reduce((s,p)=>s+(T+ph-p[1])/ph,0)/pts.length, ay = T+ph-avg*ph;
  el('line',{x1:L,x2:W-R,y1:ay,y2:ay,stroke:`rgba(${K.fg},.28)`,'stroke-dasharray':'6 6'},svg);
  const at = el('text',{x:W-R,y:ay-6,'text-anchor':'end'},svg); at.textContent = `среднее ${Math.round(avg*100)}%`; at.style.fill='var(--ink-2)';
  const d = smoothPath(pts.map(p=>[p[0],p[1]]));
  el('path',{d:`${d} L${pts[pts.length-1][0]},${T+ph} L${pts[0][0]},${T+ph} Z`, fill:'url(#lnArea)'},svg);
  el('path',{d, fill:'none', stroke:K.hi,'stroke-width':4, opacity:.35, filter:'url(#lnGlow)'},svg);
  const line = el('path',{d, fill:'none', stroke:'url(#lnStroke)','stroke-width':2.5,'stroke-linecap':'round','stroke-linejoin':'round'},svg);
  try{ const len = line.getTotalLength(); line.style.strokeDasharray = len; line.style.strokeDashoffset = len; line.getBoundingClientRect(); line.style.transition = 'stroke-dashoffset 1.1s cubic-bezier(.3,.7,.2,1)'; line.style.strokeDashoffset = 0; }catch(e){}
  if(pts.length <= 31) pts.forEach(p => el('circle',{cx:p[0],cy:p[1],r:3.5,fill:K.surface,stroke:K.hi,'stroke-width':2},svg));
  const last = pts[pts.length-1]; el('circle',{cx:last[0],cy:last[1],r:9,fill:K.hi,opacity:.18},svg); el('circle',{cx:last[0],cy:last[1],r:4.5,fill:K.hi},svg);
  const cross = el('line',{x1:0,x2:0,y1:T,y2:T+ph,stroke:`rgba(${K.fg},.35)`,'stroke-dasharray':'3 3',opacity:0},svg);
  const dot = el('circle',{r:6,fill:K.hi,stroke:K.bg,'stroke-width':2,opacity:0},svg);
  const hit = el('rect',{x:L,y:T,width:pw,height:ph,fill:'transparent'},svg);
  hit.addEventListener('mousemove', e=>{
    const r = svg.getBoundingClientRect(), mx = (e.clientX - r.left) * W / r.width;
    let best = pts[0]; for(const p of pts) if(Math.abs(p[0]-mx) < Math.abs(best[0]-mx)) best = p;
    const row = rows[best[2]];
    cross.setAttribute('x1',best[0]); cross.setAttribute('x2',best[0]); cross.setAttribute('opacity',1);
    dot.setAttribute('cx',best[0]); dot.setAttribute('cy',best[1]); dot.setAttribute('opacity',1);
    showTip(e, `<div class="t">${WD[parse(row.d).getDay()]}, ${human(row.d)}</div><b>${Math.round(row.done/row.total*100)}%</b> · сделано ${row.done} из ${row.total}`);
  });
  hit.addEventListener('mouseleave', ()=>{ cross.setAttribute('opacity',0); dot.setAttribute('opacity',0); hideTip(); });
}
