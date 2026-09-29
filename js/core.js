/* GM — Ghost Mode · хранилище, даты, экран «День»
   Разработано Veraxis */

/* =========================================================
   Хранилище. Сейчас — localStorage. Позже этот объект
   заменим на Supabase (регистрация по почте), остальной код
   не поменяется.
   ========================================================= */
const Store = {
  KEY: window.GM_KEY || 'veraxis-todo-v1',
  load(){
    try{ const d = JSON.parse(localStorage.getItem(this.KEY)); if(d && Array.isArray(d.tasks)) return d; }catch(e){}
    return { tasks: [], notes: {}, focus: {} };
  },
  save(data){
    data._ts = Date.now();
    try{ localStorage.setItem(this.KEY, JSON.stringify(data)); }
    catch(e){ toast('Не удалось сохранить — память браузера недоступна'); }
    if(window.GMCloud) window.GMCloud.push(data);
  }
};

/* ---------- утилиты дат ---------- */
const pad = n => String(n).padStart(2,'0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parse = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate()+n); return ymd(d); };
const today = () => ymd(new Date());
const WD = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
const WDS = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const MON = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const MONS = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
const human = s => { const d = parse(s); return `${d.getDate()} ${MON[d.getMonth()]}`; };
const short = s => { const d = parse(s); return `${d.getDate()} ${MONS[d.getMonth()]}`; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const esc = s => s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function plural(n, a, b, c){ const m10=n%10, m100=n%100; return (m10===1&&m100!==11)?a:(m10>=2&&m10<=4&&(m100<10||m100>=20))?b:c; }

/* ---------- состояние ---------- */
let data = Store.load();
data.notes ||= {}; data.focus ||= {};
let cur = today();
let prio = false;
let range = 7;
let lastDeleted = null;
let popId = null;
const GM_IMG = 'assets/gm-icon.png';
const MOTTOS = [
  'Тихо делай своё. Пусть результат шумит.',
  'Невидим для отвлечений. Виден по результатам.',
  'Не жди настроения — включай режим.',
  'Меньше слов, больше галочек.',
  'Один день — один шаг. Без пропусков.',
  'Дисциплина сильнее мотивации.',
  'Сегодня в тени — завтра на свету.',
  'Маленькие дела каждый день складываются в большое.',
  'Сделал — вычеркнул. Следующее.',
  'Никто не видит работу. Все видят результат.'
];
const $ = id => document.getElementById(id);
const commit = () => { Store.save(data); render(); };

/* ---------- вкладки ---------- */
document.querySelectorAll('.tab').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x===b));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === 'view-'+b.dataset.view));
  if(b.dataset.view === 'stats'){ data.counters.statsOpened = 1; renderStats(); checkAch(); }
  if(b.dataset.view === 'album') renderAlbum();
  if(b.dataset.view === 'profile') renderProfile();
  window.scrollTo({top:0, behavior:'smooth'});
});

/* ---------- день ---------- */
function renderDay(){
  const t = today();
  const d = parse(cur);
  const diff = Math.round((parse(cur) - parse(t)) / 864e5);
  const h = new Date().getHours();
  const greet = h<5?'Доброй ночи':h<12?'Доброе утро':h<18?'Добрый день':'Добрый вечер';
  const rel = diff===0 ? 'Сегодня' : diff===-1 ? 'Вчера' : diff===1 ? 'Завтра' : '';
  $('kicker').textContent = [WD[d.getDay()], rel, diff===0 ? greet : ''].filter(Boolean).join(' · ');
  $('motto').textContent = '«' + MOTTOS[Math.abs(Math.floor(parse(cur).getTime()/864e5)) % MOTTOS.length] + '»';
  $('dayTitle').textContent = `${human(cur)}${d.getFullYear()!==new Date().getFullYear()?' '+d.getFullYear():''}`;
  $('toToday').hidden = diff===0;
  $('datePicker').value = cur;

  const list = data.tasks.filter(x => x.date === cur);
  const done = list.filter(x => x.done).length;
  const pct = list.length ? done/list.length : 0;
  $('ringFill').style.strokeDashoffset = 326.7 * (1 - pct);
  $('ringPct').textContent = Math.round(pct*100) + '%';
  $('ringSub').textContent = list.length ? `${done} из ${list.length}` : 'пока пусто';
  $('alldone').hidden = !(list.length && done === list.length);
  renderWeek();

  // несделанные из прошлого (ещё не перенесённые)
  const past = data.tasks.filter(x => !x.done && !x.carried && x.date < t);
  const showCarry = cur === t && past.length > 0;
  $('carry').hidden = !showCarry;
  if(showCarry) $('carryText').textContent = `Из прошлых дней осталось ${past.length} ${plural(past.length,'несделанное дело','несделанных дела','несделанных дел')}`;

  const isPast = cur < t, isFuture = cur > t;
  // прошедшие дни закрыты: смотреть можно, менять нельзя
  $('addForm').hidden = isPast;
  document.querySelector('.hint').hidden = isPast;
  $('lockNote').hidden = !isPast && !isFuture;
  $('lockNote').innerHTML = isPast
    ? '<b>День закрыт.</b> Прошедшие дни нельзя изменить — так серия и огоньки остаются честными. Несделанное можно перенести на сегодня.'
    : '<b>План на будущее.</b> Дела можно добавлять и менять, а отметить выполненными — только в свой день.';
  document.body.classList.toggle('day-past', isPast);
  document.body.classList.toggle('day-future', isFuture);
  const sortFn = (a,b) => (b.prio?1:0)-(a.prio?1:0) || a.created - b.created;
  const open = list.filter(x=>!x.done).sort(sortFn);
  const closed = list.filter(x=>x.done).sort((a,b)=>(a.doneAt||0)-(b.doneAt||0));

  let html = '';
  if(!list.length){
    html = `<div class="empty"><img src="${GM_IMG}" alt=""><div class="big">${isPast ? 'В этот день дел не было' : 'Дел пока нет'}</div>${isPast?'':'Запиши первое дело — нажми <kbd>/</kbd>'}</div>`;
  } else {
    let n = 0;
    if(open.length) html += `<div class="group-title">${isPast?'Не сделано':'В работе'} <b>${open.length}</b></div><ul class="tasks">${open.map(x=>item(x,isPast,n++)).join('')}</ul>`;
    if(closed.length) html += `<div class="group-title">Сделано <b>${closed.length}</b></div><ul class="tasks">${closed.map(x=>item(x,isPast,n++)).join('')}</ul>`;
  }
  $('lists').innerHTML = html;
  if(popId){ const el = $('lists').querySelector(`[data-id="${popId}"]`); if(el) el.classList.add('pop'); popId = null; }
  if(typeof renderSide === 'function') renderSide();
}

function renderWeek(){
  const t = today(), m = {};
  for(const x of data.tasks){ (m[x.date] ||= {d:0,n:0}); m[x.date].n++; if(x.done) m[x.date].d++; }
  const dow = (parse(cur).getDay()+6)%7, mon = addDays(cur, -dow);
  let h = '';
  for(let i=0;i<7;i++){
    const d = addDays(mon,i), v = m[d], p = v ? v.d/v.n : 0;
    h += `<button class="wd${d===cur?' sel':''}${d===t?' today':''}${v&&v.d===v.n?' full':''}" data-d="${d}"><small>${WDS[parse(d).getDay()]}</small><b>${parse(d).getDate()}</b><span class="mini"><i style="width:${v?Math.max(p*100,v.d?8:0):0}%"></i></span></button>`;
  }
  $('week').innerHTML = h;
}
$('week').addEventListener('click', e => { const b = e.target.closest('.wd'); if(b){ cur = b.dataset.d; renderDay(); } });

function item(x, isPast, i){
  const isFuture = x.date > today();
  const ic = {
    move:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    edit:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>',
    bell:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>',
    del:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/></svg>',
    lock:'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>'
  };
  let acts = '';
  if(isPast){
    if(!x.done && !x.carried) acts = `<button data-a="move" title="Перенести копию на сегодня">${ic.move}</button>`;
  } else {
    acts = `<button data-a="edit" title="Редактировать">${ic.edit}</button>`
      + (!x.done && !isFuture ? `<button data-a="remind" title="Напоминание">${ic.bell}</button>` : '')
      + (!x.done ? `<button data-a="move" title="Перенести на завтра">${ic.move}</button>` : '')
      + `<button data-a="del" class="del" title="Удалить">${ic.del}</button>`;
  }
  const badge = isPast && !x.done ? `<span class="missed">${x.carried ? 'перенесено' : 'не сделано'}</span>` : '';
  return `<li class="task ${x.done?'done':''} ${x.prio?'prio':''} ${isPast?'locked':''} ${isFuture?'future':''}" data-id="${x.id}" style="--i:${i}">
    <button class="check" data-a="toggle" ${isPast||isFuture?'disabled':''} aria-label="${x.done?'Отметить несделанным':'Отметить сделанным'}" title="${isPast?'Прошедший день закрыт':isFuture?'Отметить можно только в этот день':''}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#050506" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>
    ${x.prio?'<svg class="flag" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M5 21V4h11l-1.5 4L16 12H7v9z"/></svg>':''}
    <span class="title">${esc(x.title)}</span>
    ${x.remind && !x.done && !isPast ? `<span class="bell"><svg viewBox="0 0 24 24"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/></svg>${x.remind}</span>` : ''}
    ${badge}
    ${isPast ? `<span class="lock-ic" title="Прошедший день закрыт">${ic.lock}</span>` : ''}
    <span class="acts">${acts}</span>
  </li>`;
}

// можно ли менять дело: только сегодня и будущее
const editable = x => x.date >= today();

$('lists').addEventListener('click', e => {
  const btn = e.target.closest('[data-a]'); if(!btn) return;
  const li = btn.closest('.task'); const t = data.tasks.find(x => x.id === li.dataset.id); if(!t) return;
  const a = btn.dataset.a;
  if(!editable(t) && !(a==='move' && !t.done && !t.carried)){ toast('Прошедший день закрыт — его нельзя изменить'); return; }
  if(a==='toggle' && t.date !== today()){ toast('Отметить дело можно только в его день'); return; }
  if(a==='toggle'){
    t.done = !t.done; t.doneAt = t.done ? Date.now() : null;
    if(t.done){
      popId = t.id;
      // в достижения засчитывается каждое дело один раз и не больше 25 дел в день — чтобы нельзя было накрутить
      const c = data.counters, d = today(); c.dayCount[d] ||= 0;
      if(!t.counted && c.dayCount[d] < 25){
        t.counted = true; c.dayCount[d]++; c.completed++;
        if(t.prio) c.prioDone++;
        if(new Date().getHours() < 8) c.early++;
      }
    }
    commit();
  }
  if(a==='remind') openRemind(t);
  if(a==='del'){
    lastDeleted = {...t};
    data.tasks = data.tasks.filter(x => x !== t); commit();
    toast('Дело удалено', true);
  }
  if(a==='move'){
    if(t.date < today()){ carryTask(t); commit(); toast('Копия дела перенесена на сегодня'); }
    else { t.date = addDays(t.date, 1); delete t.remind; commit(); toast('Перенесено на следующий день'); }
  }
  if(a==='edit') startEdit(li, t);
});
$('lists').addEventListener('dblclick', e => {
  const li = e.target.closest('.task'); if(!li || e.target.closest('[data-a]')) return;
  const t = data.tasks.find(x => x.id === li.dataset.id); if(t && editable(t)) startEdit(li, t);
});
function startEdit(li, t){
  const el = li.querySelector('.title');
  el.contentEditable = 'true'; el.focus();
  const r = document.createRange(); r.selectNodeContents(el); r.collapse(false);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  const finish = save => {
    el.removeEventListener('blur', onBlur); el.removeEventListener('keydown', onKey);
    const v = el.textContent.trim();
    if(save && v) t.title = v.slice(0,200);
    commit();
  };
  const onBlur = () => finish(true);
  const onKey = e => { if(e.key==='Enter'){ e.preventDefault(); finish(true); } if(e.key==='Escape'){ finish(false); } };
  el.addEventListener('blur', onBlur); el.addEventListener('keydown', onKey);
}

$('addForm').onsubmit = e => {
  e.preventDefault();
  const v = $('addInput').value.trim(); if(!v) return;
  if(cur < today()){ toast('В прошедший день нельзя добавлять дела'); return; }
  data.tasks.push({ id: uid(), title: v, date: cur, done: false, doneAt: null, prio, created: Date.now() });
  data.counters.created++;
  $('addInput').value = ''; prio = false; $('prioBtn').classList.remove('on');
  commit();
};
$('prioBtn').onclick = () => { prio = !prio; $('prioBtn').classList.toggle('on', prio); $('addInput').focus(); };
$('carryBtn').onclick = () => {
  const t = today(); let n = 0;
  data.tasks.filter(x => !x.done && !x.carried && x.date < t).forEach(x => { carryTask(x); n++; });
  if(n) data.counters.carried++;
  commit(); toast(`Перенесено: ${n}`);
};
// перенос из прошлого: в прошлом дело остаётся «не сделано / перенесено», на сегодня создаётся копия
function carryTask(x){
  x.carried = true;
  data.tasks.push({ id: uid(), title: x.title, date: today(), done: false, doneAt: null, prio: x.prio, created: Date.now(), from: x.date });
}
$('prevDay').onclick = () => { cur = addDays(cur,-1); renderDay(); };
$('nextDay').onclick = () => { cur = addDays(cur, 1); renderDay(); };
$('toToday').onclick = () => { cur = today(); renderDay(); };
$('datePicker').onchange = e => { if(e.target.value){ cur = e.target.value; renderDay(); } };

document.addEventListener('keydown', e => {
  const typing = /INPUT|TEXTAREA/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
  if(typing) { if(e.key==='Escape') document.activeElement.blur(); return; }
  if(!$('view-today').classList.contains('on')) return;
  if(e.key==='/'){ e.preventDefault(); $('addInput').focus(); }
  if(e.key==='ArrowLeft'){ cur = addDays(cur,-1); renderDay(); }
  if(e.key==='ArrowRight'){ cur = addDays(cur, 1); renderDay(); }
});

/* ---------- тост ---------- */
let toastTimer;
function toast(text, undo){
  $('toastText').textContent = text;
  $('toastUndo').style.display = undo ? '' : 'none';
  $('toast').classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(()=>$('toast').classList.remove('show'), 4000);
}
$('toastUndo').onclick = () => {
  if(lastDeleted && editable(lastDeleted)){ data.tasks.push(lastDeleted); lastDeleted = null; commit(); }
  $('toast').classList.remove('show');
};

/* ---------- меню ---------- */
$('menuBtn').onclick = e => { e.stopPropagation(); $('menu').classList.toggle('open'); };
document.addEventListener('click', e => { if(!e.target.closest('#menu')) $('menu').classList.remove('open'); });
$('wipeBtn').onclick = () => {
  $('menu').classList.remove('open');
  if(confirm('Удалить все дела? Это нельзя отменить.')){ data = {...data, tasks:[], notes:{}, focus:{}, restored:[]}; commit(); }
};
