/* GM — Ghost Mode · боковые панели, таймер фокуса, запуск
   Разработано Veraxis */

/* ---------- старт ---------- */
// в установленном приложении — просто «Ghost Mode», во вкладке браузера — «GM — Ghost Mode»
const APP_T = matchMedia('(display-mode: standalone)').matches || navigator.standalone ? 'Ghost Mode' : 'GM — Ghost Mode';
document.title = APP_T;
function render(){ renderDay(); renderSide(); if($('view-stats').classList.contains('on')) renderStats(); if($('view-album').classList.contains('on')) renderAlbum(); if($('view-profile').classList.contains('on')) renderProfile(); if(typeof checkAch==='function') checkAch(); }

/* =========================================================
   Боковые панели
   ========================================================= */
let calOff = 0, lastCur = null;
function dayMap(){ const m = {}; for(const x of data.tasks){ (m[x.date] ||= {done:0,total:0}); m[x.date].total++; if(x.done) m[x.date].done++; } return m; }
function isActive(m, d){ return (m[d] && m[d].done > 0) || (data.restored || []).includes(d); }
function streakInfo(m){
  const t = today(); let streak=0, s=t;
  if(!isActive(m, s)) s = addDays(s,-1);
  while(isActive(m, s)){ streak++; s = addDays(s,-1); }
  let best=0, run=0; const all = Object.keys(m).concat(data.restored || []).sort();
  if(all.length){ let d=all[0]; while(d<=t){ if(isActive(m,d)){run++; best=Math.max(best,run);} else run=0; d=addDays(d,1);} }
  return {streak, best};
}
function renderSide(){
  const m = dayMap(), t = today(), {streak, best} = streakInfo(m);
  $('sStreak').textContent = streak;
  $('sStreakW').textContent = `${plural(streak,'день','дня','дней')} подряд`;
  $('sBest').textContent = `рекорд ${best}`;
  let dots = '';
  for(let i=13;i>=0;i--){ const d = addDays(t,-i), v = m[d]; dots += `<i class="${isActive(m,d)?'on':v&&v.total?'miss':''}" title="${short(d)}${v?` · ${v.done}/${v.total}`:''}"></i>`; }
  $('sDots').innerHTML = dots;

  // календарь
  if(cur !== lastCur){ calOff = 0; lastCur = cur; }
  const base = parse(cur); const first = new Date(base.getFullYear(), base.getMonth()+calOff, 1);
  const MN = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  $('calTitle').textContent = `${MN[first.getMonth()]} ${first.getFullYear()}`;
  let h = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(x=>`<span class="h">${x}</span>`).join('');
  const startD = ymd(first), lead = (first.getDay()+6)%7;
  for(let i=0;i<42;i++){
    const d = addDays(startD, i - lead), dd = parse(d), v = m[d];
    if(i>=35 && dd.getMonth()!==first.getMonth()) break;
    const lv = heatLevel(v), hc = HEAT[lv];
    const st = lv ? `background:${hc.c};color:${lv>=4?'#1a1206':'#fff'};font-weight:600` : '';
    h += `<button class="${dd.getMonth()!==first.getMonth()?'out ':''}${d===cur?' sel':''}${d===t?' today':''}" style="${st}" data-d="${d}" title="${v?`${v.done} из ${v.total} · ${Math.round(v.done/v.total*100)}%`:'Дел нет'}">${dd.getDate()}</button>`;
  }
  $('cal').innerHTML = h;

  // заметки
  if(document.activeElement !== $('note')) $('note').value = data.notes[cur] || '';
  $('note').readOnly = cur !== t;
  $('note').placeholder = cur === t ? 'Мысли, идеи, итоги дня…' : cur < t ? `За ${human(cur)} записи нет. Прошедший день закрыт.` : 'Итог дня можно написать только в этот день.';
  $('tCount').textContent = data.focus[t] || 0;
}
$('calPrev').onclick = () => { calOff--; renderSide(); };
$('calNext').onclick = () => { calOff++; renderSide(); };
$('cal').addEventListener('click', e => {
  const b = e.target.closest('button[data-d]'); if(!b) return;
  cur = b.dataset.d; data.counters.calUsed = 1; document.querySelector('.tab[data-view="today"]').click(); render();
});
let noteT;
$('note').addEventListener('input', () => {
  if(cur !== today()) return;
  const v = $('note').value; if(v.trim()) data.notes[cur] = v; else delete data.notes[cur];
  clearTimeout(noteT); noteT = setTimeout(() => { Store.save(data); $('noteSaved').textContent = 'сохранено'; $('noteSaved').classList.add('show'); setTimeout(()=>$('noteSaved').classList.remove('show'), 1200); }, 400);
});

/* ---------- таймер фокуса ---------- */
const DEF_MIN = { focus:25, short:5, long:15 };
data.settings ||= {}; data.settings.timer ||= {...DEF_MIN};
const MODES = { focus:{label:'фокус', name:'Фокус'}, short:{label:'перерыв', name:'Перерыв'}, long:{label:'отдых', name:'Отдых'} };
const minOf = m => data.settings.timer[m] || DEF_MIN[m];
function tLabels(){ document.querySelectorAll('.t-modes button').forEach(b => b.textContent = `${MODES[b.dataset.m].name} ${minOf(b.dataset.m)}`); }
const T = { mode:'focus', total:1500, left:1500, endAt:null };
const fmt = s => `${pad(Math.floor(s/60))}:${pad(s%60)}`;
function tDraw(){
  $('tTime').textContent = fmt(Math.ceil(T.left));
  $('tMode').textContent = MODES[T.mode].label;
  $('tFill').style.strokeDashoffset = 339.3 * (1 - T.left / T.total);
  $('tStart').textContent = T.endAt ? 'Пауза' : (T.left < T.total ? 'Продолжить' : 'Старт');
  document.querySelector('.timer').classList.toggle('run', !!T.endAt);
  document.title = T.endAt ? `${fmt(Math.ceil(T.left))} · ${APP_T}` : APP_T;
}
function tSet(mode){ T.mode = mode; T.total = T.left = minOf(mode)*60; T.endAt = null;
  document.querySelectorAll('.t-modes button').forEach(b => b.classList.toggle('on', b.dataset.m === mode)); tSave(); tDraw(); }
function beep(){ try{ const a = new (window.AudioContext||window.webkitAudioContext)(); [0,.25,.5].forEach(t0=>{ const o=a.createOscillator(), g=a.createGain(); o.frequency.value=880; o.connect(g); g.connect(a.destination); g.gain.setValueAtTime(.0001,a.currentTime+t0); g.gain.exponentialRampToValueAtTime(.25,a.currentTime+t0+.02); g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+t0+.2); o.start(a.currentTime+t0); o.stop(a.currentTime+t0+.22); }); }catch(e){} }
/* состояние таймера переживает закрытие сайта */
const T_KEY = 'gm-timer';
function tSave(){ try{ localStorage.setItem(T_KEY, JSON.stringify({ mode:T.mode, total:T.total, left:T.left, endAt:T.endAt })); }catch(e){} }
function tEndText(mode){
  if(mode === 'focus'){
    const nextLong = ((data.counters.focusRun||0) + 1) % 4 === 0;
    return ['Фокус завершён', nextLong ? `Это 4-я сессия — время длинного отдыха (${minOf('long')} мин).` : `Перерыв ${minOf('short')} мин. Встань, попей воды.`];
  }
  return [`${MODES[mode].name} окончен`, 'Возвращайся в режим призрака — следующая сессия фокуса ждёт.'];
}
function tSchedulePush(){
  if(!T.endAt) return;
  const [ti, bo] = tEndText(T.mode);
  GMPush.schedule('timer', T.endAt, ti, bo, 4);   // повтор каждую минуту, пока не выключишь (до 5 раз)
}
$('tStart').onclick = () => {
  if(T.endAt){ T.left = Math.max(0,(T.endAt - Date.now())/1000); T.endAt = null; GMPush.cancel('timer'); }
  else {
    if(T.left >= T.total) notify(`${MODES[T.mode].name} начался`, `${minOf(T.mode)} мин. ${T.mode==='focus'?'Убери телефон и входи в режим призрака.':'Отдохни и разомнись.'}`);
    T.endAt = Date.now() + T.left*1000;
    tSchedulePush();
    if(!GMPush.ready && !data.settings.pushHint){ data.settings.pushHint = 1; Store.save(data); setTimeout(() => toast('Включи уведомления внизу таймера — тогда конец сессии придёт даже при закрытом сайте'), 600); }
  }
  tSave(); tDraw();
};
$('tReset').onclick = () => { if(T.endAt) GMPush.cancel('timer'); tSet(T.mode); };
const setIds = { focus:'setFocus', short:'setShort', long:'setLong' };
const clampMin = v => Math.min(180, Math.max(1, Math.round(+v || 1)));
function fillSet(src){ for(const k in setIds) $(setIds[k]).value = src[k]; }
$('tGear').onclick = () => {
  const box = $('tSetBox'), open = box.hidden;
  box.hidden = !open; $('tGear').classList.toggle('on', open);
  if(open) fillSet({focus:minOf('focus'), short:minOf('short'), long:minOf('long')});
  tAdvice();
};
$('tSetBox').addEventListener('click', e => {
  const b = e.target.closest('button[data-k]'); if(!b) return;
  const inp = $(setIds[b.dataset.k]); inp.value = clampMin(+inp.value + +b.dataset.s); tAdvice();
});
$('tSetBox').addEventListener('input', tAdvice);
function tAdvice(){
  const box = $('tSetBox'), open = !box.hidden;
  const f = open ? clampMin($('setFocus').value) : minOf('focus'), sh = open ? clampMin($('setShort').value) : minOf('short'), lg = open ? clampMin($('setLong').value) : minOf('long');
  const tips = [];
  if(sh >= f) tips.push(`Перерыв (${sh} мин) не короче фокуса (${f} мин). Лучше наоборот: работать дольше, чем отдыхать, например <b>${Math.max(f, sh)} / ${Math.max(3, Math.round(Math.min(f, sh)/5))}</b>.`);
  if(lg >= f * 2) tips.push(`Отдых (${lg} мин) заметно длиннее фокуса. Долгий отдых раз в 4 сессии — хорошо, но не больше 15–30 мин.`);
  if(sh > lg) tips.push('Короткий перерыв длиннее отдыха — обычно отдых делают длиннее перерыва.');
  if(f > 90) tips.push('Фокус дольше 90 минут снижает концентрацию. Попробуй 50 мин + перерыв 10.');
  if(f < 10) tips.push('Слишком короткий фокус — сложно войти в поток. Попробуй хотя бы 20–25 минут.');
  $('tWarn').innerHTML = tips.length ? '⚠ ' + tips.join('<br>') : '';
  $('tWarn').hidden = !tips.length;
}
$('tDefault').onclick = () => fillSet(DEF_MIN);
$('tSave').onclick = () => {
  for(const k in setIds) data.settings.timer[k] = clampMin($(setIds[k]).value);
  data.counters.timerCustom = 1;
  Store.save(data); tLabels(); tAdvice(); checkAch();
  if(!T.endAt) tSet(T.mode);
  $('tSetBox').hidden = true; $('tGear').classList.remove('on');
  toast('Время таймера сохранено');
};
$('tSetBox').addEventListener('keydown', e => { if(e.key==='Enter'){ e.preventDefault(); $('tSave').click(); } });
document.querySelector('.t-modes').addEventListener('click', e => { const b = e.target.closest('button'); if(!b) return; if(T.endAt) GMPush.cancel('timer'); tSet(b.dataset.m); });
setInterval(() => {
  const n = new Date(); $('clock').textContent = `${pad(n.getHours())}:${pad(n.getMinutes())}`;
  if(!T.endAt) return;
  T.left = Math.max(0, (T.endAt - Date.now())/1000);
  if(T.left <= 0){
    tFinish(document.visibilityState === 'visible');
    return;
  }
  tDraw();
}, 250);
function tFinish(live, late){
    const away = !live || late;
    T.endAt = null; if(live) beep();
    // сайт открыт — будильник с сервера не нужен
    if(live) GMPush.cancel('timer'); else window._tAck = true;
    const say = (ti, bo) => { if(!(away && GMPush.ready)) notify(ti, bo); };
    if(T.mode === 'focus'){
      const t = today(); data.focus[t] = (data.focus[t]||0) + 1;
      if(minOf('focus') >= 50) data.counters.longFocus++;
      data.counters.focusRun = (data.counters.focusRun||0) + 1;
      Store.save(data); renderSide(); checkAch();
      const nextLong = data.counters.focusRun % 4 === 0;
      if(!late) say('Фокус завершён', nextLong ? `Отличная работа! Это 4-я сессия — время длинного отдыха (${minOf('long')} мин).` : `Перерыв ${minOf('short')} мин. Встань, попей воды.`);
      toast(late ? 'Сессия фокуса завершилась, пока тебя не было — засчитана.' : nextLong ? 'Четыре сессии подряд — время длинного отдыха!' : 'Сессия фокуса завершена. Перерыв!');
      tSet(nextLong ? 'long' : 'short');
    } else {
      if(!late) say(`${MODES[T.mode].name} окончен`, 'Возвращайся в режим призрака — следующая сессия фокуса ждёт.');
      toast(late ? 'Перерыв закончился, пока тебя не было. Снова в режим?' : 'Перерыв окончен. Снова в режим.'); tSet('focus');
    }
}
tLabels();
(() => {   // восстановить таймер после закрытия/перезагрузки
  let st = null; try{ st = JSON.parse(localStorage.getItem(T_KEY)); }catch(e){}
  if(!st || !MODES[st.mode]){ tSet('focus'); return; }
  T.mode = st.mode; T.total = st.total || minOf(st.mode)*60; T.left = Math.min(st.left ?? T.total, T.total); T.endAt = st.endAt || null;
  document.querySelectorAll('.t-modes button').forEach(b => b.classList.toggle('on', b.dataset.m === T.mode));
  if(T.endAt && T.endAt <= Date.now()){ GMPush.cancel('timer'); tFinish(false, true); }
  else tDraw();
})();
document.addEventListener('visibilitychange', () => {
  if(document.visibilityState !== 'visible') return;
  if(window._tAck){ window._tAck = false; GMPush.cancel('timer'); }
  if(T.endAt && T.endAt <= Date.now()){ GMPush.cancel('timer'); tFinish(false, true); }
});
// если сайт открыт после полуночи — переключиться на новый день
setInterval(()=>{ const t=today(); if(window._t && window._t!==t && cur===window._t){ cur=t; render(); } window._t=t; }, 60000);
window._t = today();
document.addEventListener('pointermove', e => {
  const g = e.target.closest && e.target.closest('.glass'); if(!g) return;
  const r = g.getBoundingClientRect();
  g.style.setProperty('--mx', (e.clientX - r.left) + 'px'); g.style.setProperty('--my', (e.clientY - r.top) + 'px');
});
let rz; addEventListener('resize', ()=>{ clearTimeout(rz); rz=setTimeout(()=>{ if($('view-stats').classList.contains('on')) renderStats(); },150); });
checkAch(true); render(); tAdvice(); renderNotifBtn(); renderTabAv();
