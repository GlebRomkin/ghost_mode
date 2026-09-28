/* GM — Ghost Mode · профиль, аватары, достижения, альбом, уведомления
   Разработано Veraxis */

/* =========================================================
   Профиль, счётчики, аватары, достижения, альбом,
   уведомления и напоминания
   ========================================================= */
data.counters ||= {};
(() => {
  const c = data.counters, done = data.tasks.filter(x => x.done);
  c.created ??= data.tasks.length;
  c.completed ??= done.length;
  c.prioDone ??= done.filter(x => x.prio).length;
  c.early ??= done.filter(x => x.doneAt && new Date(x.doneAt).getHours() < 8).length;
  c.night ??= done.filter(x => x.doneAt && new Date(x.doneAt).getHours() >= 23).length;
  for(const k of ['carried','restoresUsed','shared','calUsed','statsOpened','reminderSet','timerCustom','avatarChanged','longFocus','focusRun']) c[k] ??= 0;
})();
data.profile ||= { username:'', avatar:'void' };
data.ach ||= {};
data.restores ??= 0;
data.restored ||= [];
data.notified ||= {};

/* ---------- аватары ---------- */
const GH = 'M28,74 V44 A22,22 0 0 1 72,44 V74 q-7.33,6.2 -14.67,0 q-7.33,6.2 -14.67,0 q-7.33,6.2 -14.67,0Z';
const AVATARS = [
  {id:'void',    name:'Void',        body:'dark',  eyes:'slits'},
  {id:'classic', name:'Классика',    body:'white', eyes:'round'},
  {id:'sleepy',  name:'Соня',        body:'dark',  eyes:'sleepy'},
  {id:'wink',    name:'Подмигивает', body:'white', eyes:'wink'},
  {id:'hood',    name:'Капюшон',     body:'dark',  eyes:'slits', acc:'hood'},
  {id:'music',   name:'Меломан',     body:'white', eyes:'round', acc:'phones'},
  {id:'cap',     name:'Кепка',       body:'dark',  eyes:'round', acc:'cap'},
  {id:'nerd',    name:'Очкарик',     body:'white', eyes:'glasses'},
  {id:'cat',     name:'Кот',         body:'dark',  eyes:'round', acc:'ears'},
  {id:'ninja',   name:'Ниндзя',      body:'dark',  eyes:'ninja'},
  // эксклюзивные — за достижения
  {id:'chrome',  name:'Хром',        body:'chrome',eyes:'slits',  ex:1},
  {id:'king',    name:'Король',      body:'dark',  eyes:'slits',  acc:'crown', ex:1},
  {id:'demon',   name:'Демон',       body:'dark',  eyes:'red',    acc:'horns', ex:1},
  {id:'angel',   name:'Ангел',       body:'white', eyes:'round',  acc:'halo', ex:1},
  {id:'diamond', name:'Бриллиант',   body:'dark',  eyes:'diamond',ex:1},
  {id:'flame',   name:'Пламя',       body:'dark',  eyes:'slits',  acc:'flame', ex:1},
  {id:'neon',    name:'Неон',        body:'neon',  eyes:'neon',   ex:1},
  {id:'astro',   name:'Космонавт',   body:'white', eyes:'round',  acc:'helmet', ex:1},
  {id:'sage',    name:'Мудрец',      body:'dark',  eyes:'monocle',ex:1},
  {id:'legend',  name:'Легенда',     body:'gold',  eyes:'slits',  acc:'crown', stars:1, ex:1},
];
let avSeq = 0;
function avatarSVG(id){
  const a = AVATARS.find(x => x.id === id) || AVATARS[0], u = 'a' + (avSeq++);
  const light = a.body === 'white' || a.body === 'chrome' || a.body === 'gold';
  const eyeC = light ? '#050506' : '#fff';
  let defs = `<radialGradient id="${u}bg" cx=".5" cy=".35" r=".75"><stop offset="0" stop-color="${a.ex ? '#2a2a31' : '#1b1b1f'}"/><stop offset="1" stop-color="#050506"/></radialGradient>
    <linearGradient id="${u}rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".7" stop-color="#8d8d95"/><stop offset="1" stop-color="#2f2f35"/></linearGradient>
    <linearGradient id="${u}wh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#b9b9c0"/></linearGradient>
    <linearGradient id="${u}ch" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#c7cad1"/><stop offset=".55" stop-color="#6f737c"/><stop offset="1" stop-color="#eceef2"/></linearGradient>
    <linearGradient id="${u}au" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset=".5" stop-color="#d9a93f"/><stop offset="1" stop-color="#f7dc8a"/></linearGradient>
    <linearGradient id="${u}fl" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff5a1f"/><stop offset="1" stop-color="#ffd166"/></linearGradient>
    <filter id="${u}gl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2"/></filter>`;
  const gold = `url(#${u}au)`;
  let back = '', body = '', eyes = '', front = '';
  // тело
  if(a.body === 'dark') body = `<path d="${GH}" fill="none" stroke="url(#${u}rim)" stroke-width="3" filter="url(#${u}gl)" opacity=".7"/><path d="${GH}" fill="#050506" stroke="url(#${u}rim)" stroke-width="1.8"/>`;
  if(a.body === 'white') body = `<path d="${GH}" fill="url(#${u}wh)"/>`;
  if(a.body === 'chrome') body = `<path d="${GH}" fill="url(#${u}ch)"/>`;
  if(a.body === 'gold') body = `<path d="${GH}" fill="#ffd166" filter="url(#${u}gl)" opacity=".6"/><path d="${GH}" fill="${gold}"/>`;
  if(a.body === 'neon') body = `<path d="${GH}" fill="none" stroke="#b48cff" stroke-width="5" filter="url(#${u}gl)"/><path d="${GH}" fill="#0a0612" stroke="#d6c2ff" stroke-width="1.8"/>`;
  // глаза
  const slits = c => `<path d="M35.5,42.5 L46,45 L46,48.8 L35.5,46.6Z M64.5,42.5 L54,45 L54,48.8 L64.5,46.6Z" fill="${c}"/>`;
  const round = c => `<ellipse cx="42" cy="46" rx="3.4" ry="4.6" fill="${c}"/><ellipse cx="58" cy="46" rx="3.4" ry="4.6" fill="${c}"/>`;
  if(a.eyes === 'slits') eyes = slits(eyeC);
  if(a.eyes === 'round') eyes = round(eyeC);
  if(a.eyes === 'sleepy') eyes = `<path d="M37.5,46 q4.5,3.6 9,0 M53.5,46 q4.5,3.6 9,0" stroke="${eyeC}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  if(a.eyes === 'wink') eyes = `<ellipse cx="42" cy="46" rx="3.4" ry="4.6" fill="${eyeC}"/><path d="M54,47 q4,-3.4 8,0" stroke="${eyeC}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  if(a.eyes === 'glasses') eyes = `<circle cx="41.5" cy="46" r="6" fill="none" stroke="${eyeC}" stroke-width="2"/><circle cx="58.5" cy="46" r="6" fill="none" stroke="${eyeC}" stroke-width="2"/><path d="M47.5,45.5 h5" stroke="${eyeC}" stroke-width="2"/><circle cx="41.5" cy="46.5" r="2" fill="${eyeC}"/><circle cx="58.5" cy="46.5" r="2" fill="${eyeC}"/>`;
  if(a.eyes === 'ninja') eyes = `<path d="M27.5,40 H72.5 V52 H27.5Z" fill="#26262c"/><path d="M72,42 l9,-4 l-3,6 l4,3 l-10,1Z" fill="#26262c"/>` + slits('#fff');
  if(a.eyes === 'red') eyes = `<g filter="url(#${u}gl)">${slits('#ff2b3a')}</g>` + slits('#ff5563');
  if(a.eyes === 'diamond') eyes = `<g filter="url(#${u}gl)"><path d="M42,40.5 l4,5 l-4,5 l-4,-5Z M58,40.5 l4,5 l-4,5 l-4,-5Z" fill="#9fd8ff"/></g><path d="M42,40.5 l4,5 l-4,5 l-4,-5Z M58,40.5 l4,5 l-4,5 l-4,-5Z" fill="#e8f7ff"/>`;
  if(a.eyes === 'neon') eyes = `<g filter="url(#${u}gl)">${slits('#c9a8ff')}</g>` + slits('#f1e8ff');
  if(a.eyes === 'monocle') eyes = `<ellipse cx="42" cy="46" rx="3.2" ry="4.4" fill="#fff"/><ellipse cx="58" cy="46" rx="3.2" ry="4.4" fill="#fff"/><circle cx="58" cy="46" r="7" fill="none" stroke="${gold}" stroke-width="2"/><path d="M65,48 q4,10 -2,20" fill="none" stroke="${gold}" stroke-width="1.2"/>`;
  // аксессуары
  if(a.acc === 'hood') back = `<path d="M21,78 V44 A29,29 0 0 1 79,44 V78Z" fill="#141418" stroke="#3a3a42" stroke-width="1.5"/>`;
  if(a.acc === 'phones') front = `<path d="M24,46 A26,26 0 0 1 76,46" fill="none" stroke="#e6e6ea" stroke-width="3.2" stroke-linecap="round"/><rect x="20" y="40" width="8" height="15" rx="3.5" fill="#2a2a30" stroke="#e6e6ea" stroke-width="1.8"/><rect x="72" y="40" width="8" height="15" rx="3.5" fill="#2a2a30" stroke="#e6e6ea" stroke-width="1.8"/>`;
  if(a.acc === 'cap') front = `<path d="M29.5,36 A20.5,20.5 0 0 1 70.5,36Z" fill="#e8e8ec"/><path d="M58,36 h22 q-2,5 -9,5 h-13Z" fill="#c9c9cf"/><circle cx="50" cy="16" r="2" fill="#bdbdc4"/>`;
  if(a.acc === 'ears') back = `<path d="M31,32 L29,13 L44,24Z M69,32 L71,13 L56,24Z" fill="#050506" stroke="url(#${u}rim)" stroke-width="1.8" stroke-linejoin="round"/>`;
  if(a.acc === 'crown') front = `<path d="M36,23 L37.5,10 L44,17 L50,7 L56,17 L62.5,10 L64,23Z" fill="${gold}" stroke="#8a6414" stroke-width=".8"/><circle cx="50" cy="15.5" r="1.8" fill="#fff"/>`;
  if(a.acc === 'horns') back = `<path d="M34,31 C26,25 26,15 30,8 C31,16 36,21 41,25Z M66,31 C74,25 74,15 70,8 C69,16 64,21 59,25Z" fill="#c21f2e" stroke="#ff5a66" stroke-width=".8"/>`;
  if(a.acc === 'halo') back = `<ellipse cx="50" cy="13" rx="15" ry="4.2" fill="none" stroke="#ffe08a" stroke-width="5" filter="url(#${u}gl)" opacity=".7"/><ellipse cx="50" cy="13" rx="15" ry="4.2" fill="none" stroke="#fff3c4" stroke-width="2.2"/>`;
  if(a.acc === 'flame') back = `<path d="M50,2 C60,12 66,17 60,27 C63,21 58,17 56,15 C56,21 47,23 46,30 C39,23 41,11 50,2Z" fill="url(#${u}fl)" filter="url(#${u}gl)" opacity=".8"/><path d="M50,2 C60,12 66,17 60,27 C63,21 58,17 56,15 C56,21 47,23 46,30 C39,23 41,11 50,2Z" fill="url(#${u}fl)"/>`;
  if(a.acc === 'helmet') front = `<circle cx="50" cy="45" r="30" fill="rgba(170,200,255,.08)" stroke="#d7dce6" stroke-width="2.4"/><path d="M31,32 A23,23 0 0 1 52,20" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>`;
  if(a.stars) front += `<path d="M20,22 l1.6,4 l4,1.6 l-4,1.6 l-1.6,4 l-1.6,-4 l-4,-1.6 l4,-1.6Z M80,58 l1.3,3.2 l3.2,1.3 l-3.2,1.3 l-1.3,3.2 l-1.3,-3.2 l-3.2,-1.3 l3.2,-1.3Z M77,20 l1,2.5 l2.5,1 l-2.5,1 l-1,2.5 l-1,-2.5 l-2.5,-1 l2.5,-1Z" fill="#ffe08a"/>`;
  const ring = a.ex ? `<circle cx="50" cy="50" r="48.5" fill="none" stroke="${a.id==='legend'||a.id==='king'?'#e7c35a':'rgba(255,255,255,.35)'}" stroke-width="1.5"/>` : '';
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs>${defs}</defs><circle cx="50" cy="50" r="50" fill="url(#${u}bg)"/>${ring}<g transform="translate(50 54) scale(1.15) translate(-50 -48)">${back}${body}${eyes}${front}</g></svg>`;
}
const avatarURL = id => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(avatarSVG(id));
function renderTabAv(){ $('tabAv').src = avatarURL(data.profile.avatar); }

/* ---------- иконки категорий ---------- */
const ICONS = {
  task:  '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  day:   '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  streak:'<path d="M12 2c3 4 6 6.5 6 11a6 6 0 0 1-12 0c0-3 1.5-5 3-6.5 0 2.5 1.5 4 3 4-1-3 0-6.5 0-8.5z"/>',
  focus: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
  album: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z"/><path d="M4 19a2 2 0 0 1 2-2h13"/>',
  user:  '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  star:  '<path d="M12 2l3 6.5 7 .8-5.2 4.8 1.4 7L12 17.8 5.8 21l1.4-7L2 9.3l7-.8z"/>',
  friend:'<path d="M3 20v-9a5 5 0 0 1 10 0v9l-2.5-2-2.5 2-2.5-2z"/><path d="M13 9.5a5 5 0 0 1 8 4V20l-2.5-2-2.5 2"/>',
  file:  '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/>',
};
const ico = k => `<svg viewBox="0 0 24 24">${ICONS[k]}</svg>`;

/* ---------- метрики ---------- */
function metrics(){
  const m = dayMap(), days = Object.keys(m).sort(), c = data.counters, t = today();
  let maxDoneDay = 0, perfect = 0, perfRun = 0, perfBest = 0, active = 0, prev = null;
  for(const d of days){
    const v = m[d]; if(d > t) continue;
    maxDoneDay = Math.max(maxDoneDay, v.done);
    if(v.done > 0) active++;
    const isPerf = v.total >= 3 && v.done === v.total;
    if(isPerf){ perfect++; perfRun = (prev && addDays(prev,1) === d) ? perfRun + 1 : 1; perfBest = Math.max(perfBest, perfRun); prev = d; }
  }
  // суббота + воскресенье одной недели
  let weekend = 0;
  for(const d of days){ if(parse(d).getDay() === 6 && m[d].done && m[addDays(d,1)] && m[addDays(d,1)].done){ weekend = 1; break; } }
  const fdays = Object.keys(data.focus).filter(d => data.focus[d] > 0).sort();
  let fRun = 0, fBest = 0, fPrev = null;
  for(const d of fdays){ fRun = (fPrev && addDays(fPrev,1) === d) ? fRun + 1 : 1; fBest = Math.max(fBest, fRun); fPrev = d; }
  const notes = Object.keys(data.notes).filter(d => (data.notes[d]||'').trim()).sort();
  let nRun = 0, nBest = 0, nPrev = null;
  for(const d of notes){ nRun = (nPrev && addDays(nPrev,1) === d) ? nRun + 1 : 1; nBest = Math.max(nBest, nRun); nPrev = d; }
  return {
    created: c.created, completed: c.completed, maxDoneDay, perfect, perfBest, active,
    prioDone: c.prioDone, early: c.early, night: c.night, weekend, carried: c.carried,
    best: streakInfo(m).best, restoresUsed: c.restoresUsed,
    focusTotal: Object.values(data.focus).reduce((a,b)=>a+b,0), focusMaxDay: Math.max(0, ...Object.values(data.focus)),
    longFocus: c.longFocus, focusStreak: fBest,
    notes: notes.length, notesStreak: nBest, longNote: notes.some(d => data.notes[d].length >= 500) ? 1 : 0, shared: c.shared,
    username: data.profile.username ? 1 : 0, avatarChanged: c.avatarChanged, calUsed: c.calUsed, statsOpened: c.statsOpened,
    reminderSet: c.reminderSet, timerCustom: c.timerCustom,
    achCount: Object.keys(data.ach).length, soon: 0
  };
}

/* ---------- 50 достижений ---------- */
// r: награда — {x: опыт, rest: возвраты серии, av: эксклюзивный аватар}
const ACH = [
  // дела
  ['first_task','Первый шаг','Создай первое дело','task','created',1,{x:10,rest:1}],
  ['first_done','Сделано!','Выполни первое дело','task','completed',1,{x:10}],
  ['done10','Разгон','Выполни 10 дел','task','completed',10,{x:20}],
  ['done50','Полсотни','Выполни 50 дел','task','completed',50,{x:40,rest:1}],
  ['done100','Сотня','Выполни 100 дел','task','completed',100,{x:60,av:'chrome'}],
  ['done500','Машина','Выполни 500 дел','task','completed',500,{x:150,av:'diamond'}],
  ['done1000','Тысячник','Выполни 1000 дел','task','completed',1000,{x:300,rest:3}],
  ['created25','Планировщик','Создай 25 дел','task','created',25,{x:20}],
  ['created100','Архитектор дня','Создай 100 дел','task','created',100,{x:50}],
  ['prio10','Важное — первым','Выполни 10 важных дел (с флажком)','task','prioDone',10,{x:30}],
  // день
  ['day5','Продуктивный день','Выполни 5 дел за один день','day','maxDoneDay',5,{x:20}],
  ['day10','Десятка','Выполни 10 дел за один день','day','maxDoneDay',10,{x:50,rest:1}],
  ['day20','Монстр продуктивности','Выполни 20 дел за один день','day','maxDoneDay',20,{x:100,av:'demon'}],
  ['perfect1','Чистый лист','Закрой все дела дня (минимум 3)','day','perfect',1,{x:20}],
  ['perfect7','Идеальная неделя','7 идеальных дней подряд','day','perfBest',7,{x:100,rest:2}],
  ['perfect30','Перфекционист','30 идеальных дней всего','day','perfect',30,{x:150,av:'angel'}],
  ['early','Жаворонок','Выполни дело до 8:00','day','early',1,{x:20}],
  ['night','Ночная тень','Выполни дело после 23:00','day','night',1,{x:20}],
  ['weekend','Без выходных','Выполняй дела в субботу и воскресенье одной недели','day','weekend',1,{x:30}],
  ['carry','Долги закрыты','Перенеси несделанные дела на сегодня','day','carried',1,{x:10}],
  // серия
  ['streak3','Разогрев','Серия 3 дня подряд','streak','best',3,{x:20}],
  ['streak7','Неделя в режиме','Серия 7 дней подряд','streak','best',7,{x:50,rest:1}],
  ['streak14','Две недели','Серия 14 дней подряд','streak','best',14,{x:80,rest:1}],
  ['streak30','Месяц призрака','Серия 30 дней подряд','streak','best',30,{x:150,av:'flame'}],
  ['streak100','Сто дней тени','Серия 100 дней подряд','streak','best',100,{x:400,av:'king'}],
  ['restore1','Второй шанс','Используй возврат серии','streak','restoresUsed',1,{x:10}],
  ['active50','Постоянство','50 активных дней всего','streak','active',50,{x:100,rest:1}],
  // фокус
  ['focus1','Первый фокус','Заверши сессию фокуса','focus','focusTotal',1,{x:10}],
  ['focus5day','В потоке','5 сессий фокуса за один день','focus','focusMaxDay',5,{x:40,rest:1}],
  ['focus25','Глубокая работа','25 сессий фокуса всего','focus','focusTotal',25,{x:50}],
  ['focus100','Мастер фокуса','100 сессий фокуса всего','focus','focusTotal',100,{x:150,av:'astro'}],
  ['focuslong','Марафон','Заверши фокус длиной 50+ минут','focus','longFocus',1,{x:30}],
  ['focusweek','Фокус-неделя','Сессии фокуса 7 дней подряд','focus','focusStreak',7,{x:80,av:'neon'}],
  // альбом
  ['note1','Первая мысль','Напиши первый итог дня','album','notes',1,{x:10}],
  ['note7','Дневник','Заполняй альбом 7 дней подряд','album','notesStreak',7,{x:50,rest:1}],
  ['note30','Летописец','30 записей в альбоме','album','notes',30,{x:100,av:'sage'}],
  ['notelong','Философ','Запись длиннее 500 символов','album','longNote',1,{x:20}],
  ['share1','Поделился','Поделись записью из альбома','album','shared',1,{x:10}],
  // профиль и изучение
  ['uname','Новое имя','Выбери username','user','username',1,{x:10}],
  ['avatar','Новый облик','Смени аватар','user','avatarChanged',1,{x:10}],
  ['calendar','Навигатор','Открой день через календарь','user','calUsed',1,{x:10}],
  ['stats','Аналитик','Загляни в статистику','user','statsOpened',1,{x:10}],
  ['remind','Будильник','Поставь напоминание делу','user','reminderSet',1,{x:10}],
  ['timer','Настройщик','Настрой своё время таймера','user','timerCustom',1,{x:10}],
  ['ach25','Коллекционер','Открой 25 достижений','star','achCount',25,{x:100,rest:2}],
  ['ach40','Легенда Ghost Mode','Открой 40 достижений','star','achCount',40,{x:500,av:'legend'}],
  // скоро — с сервером
  ['fire1','Огонёк','Заведи первый огонёк с другом','friend','soon',1,{x:30,rest:1},1],
  ['fire7','Неделя вдвоём','Продли огонёк на 7 дней','friend','soon',1,{x:60,rest:1},1],
  ['fire30','Месяц вдвоём','Продли огонёк на 30 дней','friend','soon',1,{x:150,rest:2},1],
  ['import','Импорт','Импортируй расписание из .txt','file','soon',1,{x:20},1],
].map(([id,title,desc,icon,metric,target,r,soon]) => ({id,title,desc,icon,metric,target,r,soon}));

const LEVELS = [[0,'Новичок'],[100,'Тень'],[300,'Призрак'],[700,'Фантом'],[1500,'Дух'],[3000,'Легенда']];
const xpTotal = () => ACH.filter(a => data.ach[a.id]).reduce((s,a) => s + a.r.x, 0);
function levelOf(xp){ let i = 0; while(i < LEVELS.length-1 && xp >= LEVELS[i+1][0]) i++; return i; }
const avUnlocked = id => { const a = AVATARS.find(x => x.id === id); if(!a || !a.ex) return true; return ACH.some(x => x.r.av === id && data.ach[x.id]); };
const rewardText = r => [r.rest ? `+${r.rest} ${plural(r.rest,'возврат','возврата','возвратов')}` : '', r.av ? `аватар «${AVATARS.find(a=>a.id===r.av).name}»` : '', `${r.x} XP`].filter(Boolean).join(' · ');

let popQ = [], popBusy = false;
function checkAch(silent){
  let changed = false;
  for(let pass = 0; pass < 2; pass++){          // второй проход — для «открой N достижений»
    const M = metrics();
    for(const a of ACH){
      if(a.soon || data.ach[a.id]) continue;
      if((M[a.metric] || 0) >= a.target){
        data.ach[a.id] = Date.now(); changed = true;
        if(a.r.rest) data.restores += a.r.rest;
        if(!silent) popQ.push(a);
      }
    }
  }
  if(changed){ Store.save(data); if($('view-profile').classList.contains('on')) renderProfile(); }
  runPop();
}
function runPop(){
  if(popBusy || !popQ.length) return;
  popBusy = true; const a = popQ.shift(), p = $('achPop');
  p.innerHTML = `<div class="ic">${ico(a.icon)}</div><div><small>Достижение открыто</small><b>${a.title}</b><span>${rewardText(a.r)}</span></div>`;
  p.classList.add('show'); beepSoft();
  setTimeout(() => { p.classList.remove('show'); setTimeout(() => { popBusy = false; runPop(); }, 400); }, 3200);
}
function beepSoft(){ try{ const ac = new (window.AudioContext||window.webkitAudioContext)(); [0,.12].forEach((t0,i)=>{ const o=ac.createOscillator(), g=ac.createGain(); o.frequency.value = i ? 1320 : 990; o.connect(g); g.connect(ac.destination); g.gain.setValueAtTime(.0001,ac.currentTime+t0); g.gain.exponentialRampToValueAtTime(.12,ac.currentTime+t0+.02); g.gain.exponentialRampToValueAtTime(.0001,ac.currentTime+t0+.25); o.start(ac.currentTime+t0); o.stop(ac.currentTime+t0+.27); }); }catch(e){} }

/* ---------- профиль ---------- */
let achFilter = 'all';
function restoreTarget(){
  const m = dayMap(), t = today();
  let d = isActive(m, t) ? addDays(t,-1) : addDays(t,-1);
  // идём назад, пока дни активны; первый неактивный — кандидат
  while(isActive(m, d)) d = addDays(d,-1);
  const before = addDays(d,-1);
  const daysAgo = Math.round((parse(t) - parse(d)) / 864e5);
  if(daysAgo > 7 || !isActive(m, before)) return null;   // спасаем только свежую серию
  return d;
}
function renderProfile(){
  const p = data.profile;
  $('profAv').innerHTML = avatarSVG(p.avatar);
  if(document.activeElement !== $('uname')) $('uname').value = p.username;
  const xp = xpTotal(), li = levelOf(xp), next = LEVELS[li+1];
  $('lvlName').textContent = LEVELS[li][1];
  $('lvlXp').textContent = next ? `${xp} / ${next[0]} XP до уровня «${next[1]}»` : `${xp} XP · максимальный уровень`;
  $('xpFill').style.width = next ? ((xp - LEVELS[li][0]) / (next[0] - LEVELS[li][0]) * 100) + '%' : '100%';
  const opened = Object.keys(data.ach).length;
  $('pAch').textContent = opened; $('pRest').textContent = data.restores; $('pDone').textContent = data.counters.completed;
  $('achSub').textContent = `${opened} из ${ACH.length}`;
  // возврат серии
  const rt = restoreTarget();
  $('restoreBtn').disabled = !(rt && data.restores > 0);
  $('restoreText').textContent = !rt ? 'Серия не прерывалась — возврат не нужен. Держи режим!'
    : data.restores > 0 ? `Пропущен день: ${WD[parse(rt).getDay()].toLowerCase()}, ${human(rt)}. Потрать 1 возврат (у тебя ${data.restores}), и серия не прервётся.`
    : `Пропущен ${human(rt)}, но возвратов нет. Их дают за достижения.`;
  // аватары
  const avHTML = list => list.map(a => { const lock = !avUnlocked(a.id), by = ACH.find(x => x.r.av === a.id);
    return `<button class="av${a.id===p.avatar?' sel':''}${lock?' lock':''}" data-av="${a.id}" title="${a.name}${lock&&by?` — открывается за «${by.title}»: ${by.desc.toLowerCase()}`:''}">${avatarSVG(a.id)}</button>`; }).join('');
  $('avBase').innerHTML = avHTML(AVATARS.filter(a => !a.ex));
  $('avEx').innerHTML = avHTML(AVATARS.filter(a => a.ex));
  // достижения
  const M = metrics();
  const list = ACH.filter(a => achFilter === 'all' || (achFilter === 'open' ? data.ach[a.id] : !data.ach[a.id]))
    .sort((a,b) => (data.ach[b.id]?1:0) - (data.ach[a.id]?1:0));
  $('achGrid').innerHTML = list.map(a => {
    const open = !!data.ach[a.id], v = a.soon ? 0 : Math.min(a.target, M[a.metric] || 0);
    return `<div class="ach${open?' open':''}${a.soon?' soon':''}"><div class="ic">${ico(a.icon)}</div><div style="flex:1;min-width:0">
      <b>${a.title}</b><p>${a.desc}</p>
      <div class="pr"><i style="width:${open?100:v/a.target*100}%"></i></div>
      <div class="rw"><span>${a.soon ? 'появится с сервером' : open ? 'открыто ' + short(ymd(new Date(data.ach[a.id]))) : `${v} / ${a.target}`}</span><span>${rewardText(a.r)}</span></div>
    </div></div>`;
  }).join('');
}
$('uname').addEventListener('input', () => {
  const v = $('uname').value.trim(), ok = /^[a-zA-Z0-9_]{3,20}$/.test(v);
  $('unameHint').textContent = !v ? '3–20 символов: латиница, цифры, _' : ok ? 'Сохранено' : 'Только латиница, цифры и _ , от 3 до 20 символов';
  $('unameHint').classList.toggle('err', !!v && !ok);
  if(ok){ data.profile.username = v; Store.save(data); checkAch(); }
});
$('avBase').parentElement.addEventListener('click', e => {
  const b = e.target.closest('.av'); if(!b) return;
  if(b.classList.contains('lock')){ toast('Этот аватар откроется за достижение — наведи, чтобы узнать какое'); return; }
  if(data.profile.avatar !== b.dataset.av){ data.profile.avatar = b.dataset.av; data.counters.avatarChanged = 1; Store.save(data); renderTabAv(); renderProfile(); checkAch(); }
});
$('achFilter').addEventListener('click', e => { const b = e.target.closest('button'); if(!b) return; achFilter = b.dataset.f; $('achFilter').querySelectorAll('button').forEach(x => x.classList.toggle('on', x===b)); renderProfile(); });
$('restoreBtn').onclick = () => {
  const d = restoreTarget(); if(!d || data.restores < 1) return;
  data.restores--; data.restored.push(d); data.counters.restoresUsed++;
  commit(); renderProfile(); toast(`Серия спасена: ${human(d)} засчитан`);
};

/* ---------- альбом ---------- */
let albumMonth = 'all';
function renderAlbum(){
  const q = $('albumSearch').value.trim().toLowerCase(), m = dayMap();
  const days = Object.keys(data.notes).filter(d => (data.notes[d]||'').trim()).sort().reverse();
  const months = [...new Set(days.map(d => d.slice(0,7)))];
  const MN = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  if(albumMonth !== 'all' && !months.includes(albumMonth)) albumMonth = 'all';
  $('albumMonths').innerHTML = `<button data-m="all" class="${albumMonth==='all'?'on':''}">Все</button>` + months.map(k => `<button data-m="${k}" class="${albumMonth===k?'on':''}">${MN[+k.slice(5)-1]} ${k.slice(0,4)}</button>`).join('');
  $('albumMonths').style.display = months.length > 1 ? '' : 'none';
  const list = days.filter(d => (albumMonth === 'all' || d.startsWith(albumMonth)) && (!q || data.notes[d].toLowerCase().includes(q)));
  if(!days.length){ $('albumList').innerHTML = `<div class="empty"><img src="${GM_IMG}" alt=""><div class="big">Альбом пока пуст</div>Пиши мысли и итоги дня в панели справа — они появятся здесь.</div>`; return; }
  if(!list.length){ $('albumList').innerHTML = `<div class="empty"><div class="big">Ничего не найдено</div></div>`; return; }
  const hl = txt => { const e = esc(txt); if(!q) return e; const i = e.toLowerCase().indexOf(esc(q)); return i < 0 ? e : e.slice(0,i) + '<mark>' + e.slice(i, i+esc(q).length) + '</mark>' + e.slice(i+esc(q).length); };
  $('albumList').innerHTML = list.map((d,i) => { const v = m[d];
    return `<article class="entry glass" style="--i:${Math.min(i,10)}"><div class="entry-h">
      <div class="entry-date"><span>${WD[parse(d).getDay()]}</span><b>${human(d)} ${parse(d).getFullYear()}</b></div>
      ${v ? `<div class="entry-meta">✓ ${v.done} из ${v.total} дел</div>` : ''}
    </div><div class="entry-text">${hl(data.notes[d])}</div>
    <div class="entry-acts"><button data-open="${d}">Открыть день</button><button data-share="${d}">Поделиться</button></div></article>`; }).join('');
}
$('albumSearch').addEventListener('input', renderAlbum);
$('albumMonths').addEventListener('click', e => { const b = e.target.closest('button'); if(b){ albumMonth = b.dataset.m; renderAlbum(); } });
$('albumList').addEventListener('click', async e => {
  const o = e.target.closest('[data-open]'), sh = e.target.closest('[data-share]');
  if(o){ cur = o.dataset.open; document.querySelector('.tab[data-view="today"]').click(); render(); }
  if(sh){
    const d = sh.dataset.share, v = dayMap()[d];
    const text = `Ghost Mode · ${human(d)} ${parse(d).getFullYear()}${v ? ` · ${v.done}/${v.total} дел` : ''}\n\n${data.notes[d]}`;
    try{
      if(navigator.share) await navigator.share({ title:'Ghost Mode — итог дня', text });
      else { await navigator.clipboard.writeText(text); toast('Запись скопирована — вставь её другу'); }
      data.counters.shared++; Store.save(data); checkAch();
    }catch(err){ if(err && err.name !== 'AbortError') toast('Не удалось поделиться'); }
  }
});
$('albumWrite').onclick = () => { cur = today(); document.querySelector('.tab[data-view="today"]').click(); render(); setTimeout(() => { $('note').focus(); $('note').scrollIntoView({behavior:'smooth', block:'center'}); }, 150); };
$('note').addEventListener('blur', () => checkAch());

/* ---------- уведомления ---------- */
const canNotify = () => 'Notification' in window;
function renderNotifBtn(){
  const b = $('notifBtn');
  if(!canNotify()){ b.style.display = 'none'; return; }
  const p = Notification.permission;
  b.classList.toggle('on', p === 'granted');
  $('notifText').textContent = p === 'granted' ? 'Уведомления включены' : p === 'denied' ? 'Уведомления запрещены в браузере' : 'Включить уведомления';
}
$('notifBtn').onclick = async () => {
  if(!canNotify()) return;
  try{ await Notification.requestPermission(); }catch(e){}
  renderNotifBtn();
  if(Notification.permission === 'granted') notify('Уведомления включены', 'Ghost Mode напомнит о фокусе, перерывах и делах.');
  else toast('Браузер не дал разрешение — напоминания будут внутри сайта');
};
function notify(title, body){
  if(canNotify() && Notification.permission === 'granted'){
    try{ const n = new Notification(title, { body, icon: GM_IMG, silent:false }); n.onclick = () => { window.focus(); n.close(); }; return; }catch(e){}
  }
}

/* ---------- напоминания о делах ---------- */
let remFor = null;
function openRemind(t){
  remFor = t; $('remTask').textContent = t.title;
  const n = new Date(); n.setMinutes(n.getMinutes() + 30);
  $('remTime').value = t.remind || `${pad(n.getHours())}:${pad(Math.floor(n.getMinutes()/5)*5)}`;
  $('remModal').hidden = false; setTimeout(() => $('remTime').focus(), 50);
}
const closeRem = () => { $('remModal').hidden = true; remFor = null; };
$('remModal').addEventListener('click', e => { if(e.target === $('remModal')) closeRem(); });
$('remSave').onclick = () => {
  if(!remFor || !$('remTime').value) return;
  remFor.remind = $('remTime').value; delete data.notified[remFor.id];
  data.counters.reminderSet++;
  if(canNotify() && Notification.permission === 'default') Notification.requestPermission().then(renderNotifBtn);
  closeRem(); commit(); toast(`Напомню в ${$('remTime').value}`);
};
$('remClear').onclick = () => { if(remFor){ delete remFor.remind; closeRem(); commit(); } };
$('remTime').addEventListener('keydown', e => { if(e.key === 'Enter') $('remSave').click(); if(e.key === 'Escape') closeRem(); });
setInterval(() => {
  const n = new Date(), t = today(), hm = `${pad(n.getHours())}:${pad(n.getMinutes())}`;
  for(const x of data.tasks){
    if(x.date !== t || x.done || !x.remind || data.notified[x.id] === t) continue;
    if(x.remind <= hm){
      data.notified[x.id] = t; Store.save(data);
      notify('Напоминание · Ghost Mode', x.title);
      toast(`⏰ ${x.title}`); beep();
    }
  }
}, 15000);
