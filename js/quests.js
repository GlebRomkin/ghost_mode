/* GM — Ghost Mode · ежедневные квесты: 3 в день, +30 XP за каждый
   Разработано Veraxis */
const Q_XP = 30;
// g — группа: из одной группы в день выпадает не больше одного квеста
const QUESTS = [
  { id:'done3',    g:'done',  t:'Выполни 3 дела',                     goal:3, v:c => c.done },
  { id:'done5',    g:'done',  t:'Выполни 5 дел',                      goal:5, v:c => c.done },
  { id:'prio',     g:'prio',  t:'Выполни важное дело',                goal:1, v:c => c.prioDone },
  { id:'plan4',    g:'plan',  t:'Запланируй 4 дела на сегодня',       goal:4, v:c => c.total },
  { id:'focus1',   g:'focus', t:'Проведи сессию фокуса',              goal:1, v:c => c.focus },
  { id:'focus2',   g:'focus', t:'Проведи 2 сессии фокуса',            goal:2, v:c => c.focus },
  { id:'note',     g:'note',  t:'Напиши итог дня (от 20 символов)',   goal:1, v:c => c.note },
  { id:'early',    g:'time',  t:'Выполни дело до 12:00',              goal:1, v:c => c.early },
  { id:'tomorrow', g:'plan',  t:'Запланируй дело на завтра',          goal:1, v:c => c.tomorrow },
  { id:'allday',   g:'done',  t:'Закрой все дела дня (минимум 3)',    goal:1, v:c => c.all },
];
data.quests ||= { day:'', got:[] };
data.questXp ??= 0;

function hashStr(s){ let h = 2166136261; for(const ch of s){ h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function questsFor(day){
  let seed = hashStr(day + '|' + ((typeof me !== 'undefined' && me && me.id) || data.profile.username || 'gm'));
  const rnd = () => { seed = (Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x9e3779b9) >>> 0; return seed / 4294967296; };
  const pool = QUESTS.slice(), out = [], groups = new Set();
  while(out.length < 3 && pool.length){
    const q = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    if(groups.has(q.g)) continue;
    groups.add(q.g); out.push(q);
  }
  return out;
}
function questCtx(){
  const t = today(), list = data.tasks.filter(x => x.date === t), done = list.filter(x => x.done);
  return {
    total: list.length,
    done: done.length,
    prioDone: done.filter(x => x.prio).length,
    early: done.filter(x => x.doneAt && new Date(x.doneAt).getHours() < 12 && ymd(new Date(x.doneAt)) === t).length,
    tomorrow: data.tasks.filter(x => x.date === addDays(t, 1)).length,
    all: list.length >= 3 && done.length === list.length ? 1 : 0,
    focus: data.focus[t] || 0,
    note: (data.notes[t] || '').trim().length >= 20 ? 1 : 0
  };
}
function questLeft(){
  const n = new Date(), mid = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1);
  const m = Math.max(0, Math.ceil((mid - n) / 60000)), h = Math.floor(m / 60);
  return h ? `${h} ч ${m % 60} мин` : `${m} мин`;
}
function checkQuests(){
  const t = today();
  if(data.quests.day !== t) data.quests = { day:t, got:[] };
  const c = questCtx(); let won = [];
  for(const q of questsFor(t)){
    if(data.quests.got.includes(q.id)) continue;
    if(q.v(c) >= q.goal){ data.quests.got.push(q.id); data.questXp += Q_XP; won.push(q); }
  }
  if(won.length){
    _qSaving = true; Store.save(data); _qSaving = false;
    won.forEach((q, i) => setTimeout(() => toast(`✦ Квест выполнен: ${q.t} · +${Q_XP} XP`), i * 1600));
    if(typeof checkAch === 'function') checkAch();
  }
  renderQuests();
}
function renderQuests(){
  const t = today(), c = questCtx(), got = data.quests.day === t ? data.quests.got : [];
  const qs = questsFor(t);
  $('qLeft').textContent = got.length === 3 ? 'все выполнены' : `обновятся через ${questLeft()}`;
  $('qList').innerHTML = qs.map(q => {
    const ok = got.includes(q.id), v = Math.min(q.goal, q.v(c));
    return `<div class="q${ok ? ' ok' : ''}">
      <span class="q-ic">${ok ? '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : ''}</span>
      <span class="q-t"><b>${q.t}</b><span class="q-bar"><i style="width:${v / q.goal * 100}%"></i></span></span>
      <span class="q-xp">${ok ? 'готово' : q.goal > 1 ? `${v}/${q.goal}` : ''}<em>+${Q_XP} XP</em></span>
    </div>`;
  }).join('');
}
let _qSaving = false, _qT = null;
(() => {
  const prev = Store.save.bind(Store);
  Store.save = function(d){ prev(d); if(_qSaving) return; clearTimeout(_qT); _qT = setTimeout(checkQuests, 300); };
})();
setInterval(() => { if(document.visibilityState === 'visible') checkQuests(); }, 30000);
checkQuests();
