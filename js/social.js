/* GM — Ghost Mode · друзья: Тандем (серия на двоих) и рейтинг
   Разработано Veraxis */
const safeAv = id => AVATARS.some(a => a.id === id) ? id : 'void';
const avImg = (id, cls) => `<img class="${cls}" src="${avatarURL(safeAv(id))}" alt="">`;
let duo = null, lbBy = 'score', lbRows = [], pushT = null, tdMsg = '', pTasks = null, albumRows = null, albumMode = 'mine';
data.settings ||= {}; if(data.settings.shareToday === undefined) data.settings.shareToday = true;
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
    const pt = await sb.rpc('duo_partner_tasks', { p_day: today() });
    pTasks = pt.error ? null : pt.data;
  } else pTasks = null;
  renderTandem();
  if(albumMode === 'duo' && $('view-album').classList.contains('on')) renderDuoAlbum();
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
      <div class="td-tasks">
        <div class="td-sub"><b>Дела ${pn} на сегодня</b>${pTasks && pTasks.shared && pTasks.tasks.length ? `<span>${pTasks.tasks.filter(x => x.done).length} из ${pTasks.tasks.length}</span>` : ''}</div>
        ${!pTasks ? '<p class="td-note">Загружаю…</p>'
          : !pTasks.shared ? `<p class="td-note">${pn} скрыл(а) свои дела.</p>`
          : !pTasks.tasks.length ? `<p class="td-note">На сегодня у ${pn} пока нет дел.</p>`
          : '<ul class="td-list">' + pTasks.tasks.map(x => `<li class="${x.done ? 'done' : ''}"><i></i><span>${esc(x.title)}</span>${x.prio ? '<em>важное</em>' : ''}</li>`).join('') + '</ul>'}
      </div>
      <label class="td-share"><input type="checkbox" id="tdShare" ${data.settings.shareToday !== false ? 'checked' : ''}><span>Показывать ${pn} мои дела на сегодня</span></label>
      <p class="td-note">${a.lost ? 'Серия прервалась: вчера кто-то из вас пропустил день. Начните заново сегодня. ' : ''}Серия растёт, когда вы оба закрыли хотя бы одно дело за день. Рекорд: ${Math.max(a.best, a.streak)}.</p>
      <button class="td-leave" id="tdLeave">Выйти из Тандема</button>`;
    $('tdLeave').onclick = () => openLeave(a, p.username);
    $('tdShare').onchange = e => { data.settings.shareToday = e.target.checked; Store.save(data); toast(e.target.checked ? 'Друг видит твои дела на сегодня' : 'Твои дела скрыты от друга'); };
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
  $('leaveText').textContent = `Общая серия (${a.streak} ${plural(a.streak, 'день', 'дня', 'дней')}) и общий альбом сотрутся у вас обоих, и ${name} увидит, что Тандем закончился. Вернуть это нельзя.`;
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

/* ---------- общий альбом ---------- */
const ALB_ERR = { no_duo: 'Общий альбом есть только в Тандеме', empty: 'Запись пустая', too_long: 'Слишком длинно — до 2000 символов', limit: 'Лимит: 30 записей в сутки', duplicate: 'Эта запись уже в общем альбоме' };
const albErr = e => ALB_ERR[(e && e.message) || ''] || 'Не получилось, попробуй ещё раз';
async function loadDuoAlbum(){
  const r = await sb.rpc('album_list');
  albumRows = r.error ? [] : (r.data || []);
  renderDuoAlbum();
}
function renderDuoAlbum(){
  const box = $('albumDuo');
  if(!duo){ box.innerHTML = '<p class="td-note">Загружаю…</p>'; return; }
  const a = duo.active;
  if(!a){
    box.innerHTML = `<div class="empty glass"><img src="${GM_IMG}" alt=""><div class="big">Общего альбома пока нет</div>Он появится, когда вы с другом начнёте Тандем.<br><button class="btn-w" id="goFriends" style="margin-top:14px">Перейти в «Друзья»</button></div>`;
    $('goFriends').onclick = () => document.querySelector('.tab[data-view="friends"]').click();
    return;
  }
  const pn = esc((a.partner || {}).username || '');
  let h = `<div class="glass duo-compose">
    <div class="td-sub"><b>Альбом на двоих</b><span>ты и ${pn}</span></div>
    <textarea id="duoText" maxlength="2000" placeholder="Мысль, итог дня, что-то важное — ${pn} увидит это…"></textarea>
    <div class="duo-row"><span class="td-msg" id="duoMsg"></span><button class="btn-w" id="duoPost">Добавить</button></div>
  </div>`;
  if(albumRows === null) h += '<p class="td-note">Загружаю…</p>';
  else if(!albumRows.length) h += `<div class="empty"><div class="big">Пока пусто</div>Напишите первую запись — или нажмите «В общий альбом» под своей записью в «Мои записи».</div>`;
  else h += albumRows.map((r, i) => `<article class="entry glass duo-entry${r.mine ? ' mine' : ''}" style="--i:${Math.min(i,10)}">
      <div class="entry-h"><div class="duo-author">${avImg(r.avatar, 'td-sm')}<div class="entry-date"><span>${esc(r.username)}${r.mine ? ' · ты' : ''}</span><b>${WD[parse(r.day).getDay()]}, ${human(r.day)}</b></div></div></div>
      <div class="entry-text">${esc(r.text)}</div>
      ${r.mine ? `<div class="entry-acts"><button data-del="${r.id}">Удалить</button></div>` : ''}</article>`).join('');
  box.innerHTML = h;
  $('duoPost').onclick = async () => {
    const t = $('duoText').value.trim(); if(!t) return;
    $('duoPost').disabled = true;
    const r = await sb.rpc('album_post', { p_text: t, p_day: today() });
    $('duoPost').disabled = false;
    if(r.error){ $('duoMsg').textContent = albErr(r.error); return; }
    data.counters.shared++; Store.save(data); checkAch();
    loadDuoAlbum();
  };
  box.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if(b.dataset.sure !== '1'){ b.dataset.sure = '1'; b.textContent = 'Точно удалить?'; setTimeout(() => { b.dataset.sure = ''; b.textContent = 'Удалить'; }, 3000); return; }
    await sb.rpc('album_delete', { p_id: b.dataset.del }); loadDuoAlbum();
  });
}
function setAlbumMode(m){
  albumMode = m;
  $('albumMode').querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.a === m));
  $('albumMine').hidden = m !== 'mine'; $('albumDuo').hidden = m !== 'duo';
  if(m === 'duo'){ renderDuoAlbum(); loadDuoAlbum(); if(!duo) refreshDuo(); }
}
$('albumMode').addEventListener('click', e => { const b = e.target.closest('button'); if(b) setAlbumMode(b.dataset.a); });
$('albumList').addEventListener('click', async e => {
  const b = e.target.closest('[data-duo]'); if(!b) return;
  if(!duo || !duo.active){ toast('Общий альбом появится, когда начнёшь Тандем с другом'); return; }
  const d = b.dataset.duo, text = (data.notes[d] || '').trim(); if(!text) return;
  b.disabled = true;
  const r = await sb.rpc('album_post', { p_text: text, p_day: d });
  b.disabled = false;
  if(r.error){ toast(albErr(r.error)); return; }
  data.counters.shared++; Store.save(data); checkAch();
  b.textContent = 'Добавлено ✓'; toast('Запись в общем альбоме');
  albumRows = null;
});

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
setInterval(() => {
  if(document.visibilityState !== 'visible') return;
  if(friendsOn()){ refreshDuo(); refreshLb(); }
  if(albumMode === 'duo' && $('view-album').classList.contains('on')) loadDuoAlbum();
}, 20000);
pushStats(); refreshDuo();
