/* GM — Ghost Mode · друзья: Тандем (серия на двоих) и рейтинг
   Разработано Veraxis */
const safeAv = id => AVATARS.some(a => a.id === id) ? id : 'void';
const avImg = (id, cls) => `<img class="${cls}" src="${avatarURL(safeAv(id))}" alt="">`;
let duo = null, lbBy = 'score', lbRows = [], pushT = null, tdMsg = '';
const friendsOn = () => $('view-friends').classList.contains('on');

/* ---------- отправка статистики (день определяет сервер) ---------- */
function pushStats(){
  if(typeof sb === 'undefined' || !sb || !me) return;
  const m = dayMap(), t = today(), {streak, best} = streakInfo(m);
  sb.rpc('push_stats', { p_done: (m[t] && m[t].done) || 0, p_score: xpTotal(), p_streak: streak, p_best: best, p_completed: data.counters.completed || 0 })
    .then(r => { if(!r.error && friendsOn()){ refreshDuo(); refreshLb(); } });
}
const _save = Store.save.bind(Store);
Store.save = function(d){ _save(d); clearTimeout(pushT); pushT = setTimeout(pushStats, 1500); };

/* ---------- Тандем ---------- */
const DUO_ERR = {
  user_not_found: 'Пользователя с таким ником нет',
  self: 'Нельзя пригласить самого себя',
  busy: 'Ты или этот человек уже в Тандеме',
  has_outgoing: 'Сначала отмени прошлое приглашение',
  not_found: 'Это приглашение уже недоступно'
};
const duoErr = e => DUO_ERR[(e && e.message) || ''] || 'Не получилось, попробуй ещё раз';

async function refreshDuo(){
  if(typeof sb === 'undefined' || !sb || !me) return;
  const r = await sb.rpc('duo_state');
  if(r.error){ $('tandem').innerHTML = '<p class="td-note">Нет связи с сервером.</p>'; return; }
  duo = r.data;
  const a = duo.active;
  if(a){
    const b = Math.max(a.best || 0, a.streak || 0);
    if(b > (data.counters.duoBest || 0)){ data.counters.duoBest = b; Store.save(data); checkAch(); }
  }
  renderTandem();
}

function renderTandem(){
  const box = $('tandem'); if(!duo){ box.innerHTML = '<p class="td-note">Загружаю…</p>'; return; }
  const a = duo.active;
  if(a){
    const p = a.partner || {}, pn = esc(p.username || '?');
    const dots = a.days.map(d => {
      const both = d.me && d.partner;
      return `<span class="td-col${both ? ' both' : ''}${d.live ? '' : ' pre'}" title="${short(d.day)}"><i class="${d.me ? 'on' : ''}"></i><i class="${d.partner ? 'on' : ''}"></i></span>`;
    }).join('');
    box.innerHTML = `
      <div class="td-head"><b>Тандем</b><span>с ${short(a.started_on)}</span></div>
      <div class="td-main">
        <div class="td-who">${avImg(data.profile.avatar, 'td-av')}<span>Ты</span></div>
        <div class="td-flame"><b>${a.streak}</b><span>${plural(a.streak, 'день', 'дня', 'дней')} вдвоём</span></div>
        <div class="td-who">${avImg(p.avatar, 'td-av')}<span>${pn}</span></div>
      </div>
      <div class="td-status">
        <span class="${a.me_today ? 'ok' : ''}">Ты: ${a.me_today ? 'сегодня готово' : 'ещё не сделал дело'}</span>
        <span class="${a.partner_today ? 'ok' : ''}">${pn}: ${a.partner_today ? 'сегодня готово' : 'ещё не сделал(а) дело'}</span>
      </div>
      <div class="td-dots">${dots}</div>
      <p class="td-note">${a.lost ? 'Серия прервалась: вчера кто-то из вас пропустил день. Начните заново сегодня. ' : ''}Серия растёт, когда вы оба закрыли хотя бы одно дело за день. Рекорд: ${Math.max(a.best, a.streak)}.</p>
      <button class="td-leave" id="tdLeave">Выйти из Тандема</button>`;
    $('tdLeave').onclick = () => openLeave(a, p.username);
    return;
  }
  let html = '<div class="td-head"><b>Тандем</b><span>серия на двоих</span></div>';
  if(duo.incoming.length){
    html += duo.incoming.map(i => `<div class="td-inv"><div>${avImg(i.avatar, 'td-sm')}<span><b>${esc(i.username)}</b> зовёт тебя в Тандем</span></div>
      <div class="td-btns"><button class="t-def" data-dec="${i.id}">Отклонить</button><button class="t-ok" data-acc="${i.id}">Принять</button></div></div>`).join('');
  }
  if(duo.outgoing){
    html += `<div class="td-inv"><div><span>Ждём ответа от <b>${esc(duo.outgoing.username)}</b></span></div>
      <div class="td-btns"><button class="t-def" data-dec="${duo.outgoing.id}">Отменить</button></div></div>`;
  } else {
    html += `<p class="td-note">Серия растёт, только если вы оба выполнили хотя бы одно дело за день. Один друг за раз. Введи его ник, и он получит приглашение.</p>
      <form class="td-form" id="tdForm"><input id="tdName" placeholder="Ник друга" maxlength="20" autocomplete="off" autocapitalize="off"><button class="btn-w" type="submit">Пригласить</button></form>`;
  }
  html += `<div class="td-msg" id="tdMsg">${esc(tdMsg)}</div>`;
  box.innerHTML = html;
  const f = $('tdForm');
  if(f) f.onsubmit = async e => {
    e.preventDefault(); const n = $('tdName').value.trim().replace(/^@/, ''); if(!n) return;
    const r = await sb.rpc('duo_invite', { uname: n });
    tdMsg = r.error ? duoErr(r.error) : 'Приглашение отправлено';
    await refreshDuo();
  };
  box.querySelectorAll('[data-acc]').forEach(b => b.onclick = async () => { const r = await sb.rpc('duo_accept', { p_id: b.dataset.acc }); tdMsg = r.error ? duoErr(r.error) : ''; await refreshDuo(); refreshLb(); });
  box.querySelectorAll('[data-dec]').forEach(b => b.onclick = async () => { await sb.rpc('duo_decline', { p_id: b.dataset.dec }); tdMsg = ''; await refreshDuo(); });
}

function openLeave(a, name){
  $('leaveText').textContent = `Общая серия (${a.streak} ${plural(a.streak, 'день', 'дня', 'дней')}) сотрётся у вас обоих, и ${name} увидит, что Тандем закончился. Вернуть его нельзя.`;
  $('leaveModal').hidden = false;
}
$('leaveNo').onclick = () => { $('leaveModal').hidden = true; };
$('leaveModal').addEventListener('click', e => { if(e.target === $('leaveModal')) $('leaveModal').hidden = true; });
$('leaveYes').onclick = async () => {
  $('leaveYes').disabled = true;
  const r = await sb.rpc('duo_leave');
  $('leaveYes').disabled = false; $('leaveModal').hidden = true;
  toast(r.error ? 'Не получилось выйти, попробуй ещё раз' : 'Ты вышел из Тандема');
  tdMsg = ''; await refreshDuo();
};

/* ---------- рейтинг ---------- */
async function refreshLb(){
  if(typeof sb === 'undefined' || !sb || !me) return;
  const r = await sb.rpc('leaderboard', { p_by: lbBy });
  if(r.error){ $('lbList').innerHTML = '<p class="td-note">Нет связи с сервером.</p>'; return; }
  lbRows = r.data || []; renderLb();
}
function renderLb(){
  if(!lbRows.length){ $('lbList').innerHTML = '<p class="td-note">Пока никого. Выполни дело, и ты появишься в рейтинге.</p>'; return; }
  let prev = 0;
  $('lbList').innerHTML = lbRows.map(r => {
    const gap = prev && r.rank - prev > 1 ? '<div class="lb-gap">···</div>' : ''; prev = r.rank;
    const val = lbBy === 'streak' ? `${r.streak} ${plural(r.streak, 'день', 'дня', 'дней')}` : `${r.score} XP`;
    return `${gap}<div class="lb-row${r.me ? ' me' : ''}${r.rank <= 3 ? ' top' : ''}"><span class="lb-n">${r.rank}</span>${avImg(r.avatar, 'td-sm')}
      <span class="lb-name"><b>${esc(r.username)}</b>${r.me ? '<em>ты</em>' : ''}<small>${LEVELS[levelOf(r.score)][1]}</small></span><span class="lb-v">${val}</span></div>`;
  }).join('');
}
$('lbSeg').addEventListener('click', e => {
  const b = e.target.closest('button'); if(!b) return;
  lbBy = b.dataset.by; $('lbSeg').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); refreshLb();
});

/* ---------- запуск ---------- */
document.querySelector('.tab[data-view="friends"]').addEventListener('click', () => { pushStats(); refreshDuo(); refreshLb(); });
setInterval(() => { if(friendsOn() && document.visibilityState === 'visible'){ refreshDuo(); refreshLb(); } }, 20000);
pushStats(); refreshDuo();
