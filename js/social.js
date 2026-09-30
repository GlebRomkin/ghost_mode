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
  busy: 'Этот друг уже в другом Тандеме',
  you_busy: 'Чтобы завести новый Тандем, сначала выйди из текущего',
  not_friends: 'Тандем можно завести только с другом — сначала добавь его в друзья',
  has_outgoing: 'Сначала отмени прошлое приглашение',
  not_found: 'Это приглашение уже недоступно'
};
const duoErr = e => DUO_ERR[(e && e.message) || ''] || 'Не получилось, попробуй ещё раз';

async function refreshDuo(){
  if(typeof sb === 'undefined' || !sb || !me) return;
  const r = await sb.rpc('duo_state');
  if(r.error){ $('tandem').innerHTML = '<p class="td-note">Нет связи с сервером.</p>'; return; }
  duo = r.data;
  if(fr) $('frDot').hidden = !fr.incoming.length && !duo.incoming.length;
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
  }
  html += `<p class="td-note">Серия растёт, только если вы оба выполнили хотя бы одно дело за день. Тандем — только с другом и только один.</p>`;
  const free = fr ? fr.friends : null;
  if(!free) html += '<p class="td-note">Загружаю друзей…</p>';
  else if(!free.length) html += `<div class="td-empty">Сначала добавь друга — найди его по нику в блоке «Друзья» ниже. Когда он примет заявку, здесь можно будет позвать его в Тандем.</div>`;
  else {
    html += `<div class="td-sub"><b>Выбери друга для Тандема</b></div><div class="td-pick">` + free.map(f => `
      <div class="td-inv"><div>${avImg(f.avatar, 'td-sm')}<span><b>@${esc(f.username)}</b>${f.busy ? '<small>уже в другом Тандеме</small>' : ''}</span></div>
      <div class="td-btns"><button class="t-ok" data-duo-with="${esc(f.username)}" ${f.busy || (duo.outgoing && duo.outgoing.username === f.username) ? 'disabled' : ''}>${duo.outgoing && duo.outgoing.username === f.username ? 'Приглашён' : 'Позвать'}</button></div></div>`).join('') + '</div>';
  }
  html += `<div class="td-msg" id="tdMsg">${esc(tdMsg)}</div>`;
  box.innerHTML = html;
  box.querySelectorAll('[data-duo-with]').forEach(b => b.onclick = () => startTandem(b.dataset.duoWith));
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
  tdMsg = ''; await refreshDuo(); refreshFriends();
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

/* ---------- общий диалог «Точно?» ---------- */
function ask(title, text, okText, danger){
  return new Promise(res => {
    $('askTitle').textContent = title; $('askText').textContent = text;
    $('askYes').textContent = okText || 'Да'; $('askYes').classList.toggle('danger', !!danger);
    $('askModal').hidden = false;
    const done = v => { $('askModal').hidden = true; $('askYes').onclick = $('askNo').onclick = $('askModal').onclick = null; res(v); };
    $('askYes').onclick = () => done(true); $('askNo').onclick = () => done(false);
    $('askModal').onclick = e => { if(e.target === $('askModal')) done(false); };
  });
}

/* ---------- друзья ---------- */
let fr = null, frFound = null, frQ = '', frMsg = '';
const FR_ERR = {
  user_not_found: 'Пользователя с таким ником нет', self: 'Это ты :)', already_friends: 'Вы уже друзья',
  already_sent: 'Заявка уже отправлена', too_many: 'Слишком много неотвеченных заявок', friends_limit: 'Достигнут лимит друзей', not_found: 'Заявка уже недоступна'
};
const frErr = e => FR_ERR[(e && e.message) || ''] || 'Не получилось, попробуй ещё раз';
const FLAME = '<svg viewBox="0 0 24 24"><path d="M12 22c4.4 0 7-2.9 7-6.6 0-3.4-2.2-5.6-3.6-7.4-.4 1.7-1.3 2.9-2.4 3.4.3-3.2-1-6.5-4-8.4.2 3.6-1.8 5.6-3.3 7.6C4.6 12.1 5 13.4 5 15.4 5 19.1 7.6 22 12 22z"/></svg>';

async function refreshFriends(){
  if(typeof sb === 'undefined' || !sb || !me) return;
  const r = await sb.rpc('friends_state');
  if(r.error){ if(!fr) $('frList').innerHTML = '<p class="td-note">Нет связи с сервером.</p>'; return; }
  fr = r.data;
  $('frDot').hidden = !fr.incoming.length && !(duo && duo.incoming && duo.incoming.length);
  $('pFriends').textContent = fr.friends.length;
  $('pfCount').textContent = fr.friends.length || '';
  $('frCountTxt').textContent = fr.friends.length ? `${fr.friends.length} ${plural(fr.friends.length, 'друг', 'друга', 'друзей')}` : '';
  renderFriends();
  if(!$('pFriendsBox').hidden) renderProfileFriends();
  if(duo && !duo.active && friendsOn()) renderTandem();
}
function frRow(f, right){
  return `<div class="fr-row">${avImg(f.avatar, 'td-sm')}<span class="fr-name"><b>@${esc(f.username)}</b>${f.sub ? `<small>${f.sub}</small>` : ''}</span><span class="fr-act">${right}</span></div>`;
}
function renderFriends(){
  if(!fr) return;
  // результаты поиска
  let h = '';
  if(frFound){
    h += `<div class="td-sub"><b>Поиск «${esc(frQ)}»</b><button class="linkbtn" id="frClear">скрыть</button></div>`;
    h += !frFound.length ? '<p class="td-note">Никого не нашли. Проверь ник — ищем по началу ника.</p>'
      : frFound.map(u => frRow(u, u.rel === 'friend' ? '<span class="fr-tag">друг</span>'
          : u.rel === 'outgoing' ? '<span class="fr-tag">заявка отправлена</span>'
          : u.rel === 'incoming' ? `<button class="t-ok" data-add="${esc(u.username)}">Принять заявку</button>`
          : `<button class="t-ok" data-add="${esc(u.username)}">Добавить</button>`)).join('');
  }
  if(frMsg) h += `<div class="td-msg">${esc(frMsg)}</div>`;
  $('frResults').innerHTML = h;
  // заявки
  let q = '';
  if(fr.incoming.length) q += `<div class="td-sub"><b>Заявки в друзья</b><span>${fr.incoming.length}</span></div>` + fr.incoming.map(f => frRow(f,
    `<button class="t-def" data-fdec="${f.id}">Отклонить</button><button class="t-ok" data-facc="${f.id}">Принять</button>`)).join('');
  if(fr.outgoing.length) q += `<div class="td-sub"><b>Твои заявки</b><span>ждут ответа</span></div>` + fr.outgoing.map(f => frRow(f,
    `<button class="t-def" data-fdec="${f.id}">Отменить</button>`)).join('');
  $('frRequests').innerHTML = q;
  // список друзей
  $('frList').innerHTML = !fr.friends.length ? '<p class="td-note">Пока нет друзей. Найди друга по нику — он получит заявку.</p>'
    : `<div class="td-sub"><b>Твои друзья</b></div>` + fr.friends.map(f => frRow({ ...f, sub: `${LEVELS[levelOf(f.score)][1]} · серия ${f.streak}` },
      `<span class="fr-fire${f.tandem ? ' on' : ''}" title="${f.tandem ? 'Ваш Тандем' : 'Нет Тандема'}">${FLAME}</span><button class="t-def fr-x" data-frm="${f.id}" data-name="${esc(f.username)}" data-tandem="${f.tandem ? 1 : ''}" title="Удалить из друзей">✕</button>`)).join('');
  bindFriendButtons($('frCard'));
}
function bindFriendButtons(root){
  root.querySelectorAll('[data-add]').forEach(b => b.onclick = async () => {
    b.disabled = true;
    const r = await sb.rpc('friend_request', { uname: b.dataset.add });
    frMsg = r.error ? frErr(r.error) : r.data === 'accepted' ? `Теперь вы с @${b.dataset.add} друзья` : `Заявка отправлена @${b.dataset.add}`;
    if(frFound) frFound = (await sb.rpc('search_users', { q: frQ })).data || [];
    refreshFriends();
  });
  root.querySelectorAll('[data-facc]').forEach(b => b.onclick = async () => { b.disabled = true; const r = await sb.rpc('friend_accept', { p_id: b.dataset.facc }); frMsg = r.error ? frErr(r.error) : ''; refreshFriends(); });
  root.querySelectorAll('[data-fdec]').forEach(b => b.onclick = async () => { b.disabled = true; await sb.rpc('friend_decline', { p_id: b.dataset.fdec }); refreshFriends(); });
  root.querySelectorAll('[data-frm]').forEach(b => b.onclick = async () => {
    const n = b.dataset.name;
    const ok = await ask('Удалить из друзей?', b.dataset.tandem ? `@${n} пропадёт из друзей, а ваш Тандем, общая серия и общий альбом сотрутся у обоих.` : `@${n} пропадёт из твоих друзей. Добавить снова можно через поиск.`, 'Удалить', true);
    if(!ok) return;
    await sb.rpc('friend_remove', { p_id: b.dataset.frm });
    toast(`@${n} удалён из друзей`); await refreshFriends(); refreshDuo();
  });
  root.querySelectorAll('[data-tandem-with]').forEach(b => b.onclick = () => startTandem(b.dataset.tandemWith, true));
}
$('frSearchForm').onsubmit = async e => {
  e.preventDefault();
  frQ = $('frSearch').value.trim().replace(/^@/, ''); frMsg = '';
  if(frQ.length < 2){ frFound = null; frMsg = 'Введи хотя бы 2 символа ника'; renderFriends(); return; }
  const r = await sb.rpc('search_users', { q: frQ });
  frFound = r.error ? [] : r.data; renderFriends();
};
document.addEventListener('click', e => { if(e.target.id === 'frClear'){ frFound = null; frMsg = ''; $('frSearch').value = ''; renderFriends(); } });

// «Завести Тандем» — из профиля или из вкладки «Друзья»
async function startTandem(name, fromProfile){
  if(fromProfile) document.querySelector('.tab[data-view="friends"]').click();
  await refreshDuo();
  const card = $('tandem');
  setTimeout(() => card.scrollIntoView({ behavior:'smooth', block:'start' }), 80);
  if(duo && duo.active){
    tdMsg = '';
    card.querySelector('.td-hint')?.remove();
    card.insertAdjacentHTML('afterbegin', `<div class="td-hint">Чтобы завести новый Тандем с @${esc(name)}, сначала удалите текущий — кнопка «Выйти из Тандема» внизу карточки.</div>`);
    card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash');
    return;
  }
  const ok = await ask('Завести Тандем?', `Вы точно хотите завести Тандем с @${name}? Друг получит приглашение, а серия начнётся, когда он его примет.`, 'Завести');
  if(!ok) return;
  const r = await sb.rpc('duo_invite', { uname: name });
  tdMsg = r.error ? duoErr(r.error) : `Приглашение отправлено @${name}`;
  await refreshDuo(); refreshFriends();
}

// раздел «Друзья» в профиле
function renderProfileFriends(){
  const box = $('pFriendsBox');
  if(!fr){ box.innerHTML = '<div class="glass card"><p class="td-note">Загружаю…</p></div>'; return; }
  box.innerHTML = `<div class="glass card pf-card">
    <div class="card-h"><h3>Друзья · ${fr.friends.length}</h3><button class="btn-w" id="pfFind">Найти друзей</button></div>
    ${fr.incoming.length ? `<button class="pf-req" id="pfReq">${fr.incoming.length} ${plural(fr.incoming.length, 'заявка', 'заявки', 'заявок')} в друзья — открыть</button>` : ''}
    ${!fr.friends.length ? '<p class="td-note">Пока нет друзей. Найди друга по нику во вкладке «Друзья».</p>'
      : fr.friends.map(f => `<div class="fr-row">${avImg(f.avatar, 'td-sm')}<span class="fr-name"><b>@${esc(f.username)}</b><small>${LEVELS[levelOf(f.score)][1]} · ${f.score} XP</small></span>
        <span class="fr-act"><span class="fr-fire${f.tandem ? ' on' : ''}" title="${f.tandem ? 'Ваш Тандем' : 'Нет Тандема'}">${FLAME}</span>
        ${f.tandem ? '<span class="fr-tag">ваш Тандем</span>' : `<button class="t-ok" data-tandem-with="${esc(f.username)}">Завести Тандем</button>`}</span></div>`).join('')}
  </div>`;
  const go = () => { document.querySelector('.tab[data-view="friends"]').click(); setTimeout(() => { $('frCard').scrollIntoView({ behavior:'smooth', block:'start' }); $('frSearch').focus({ preventScroll:true }); }, 120); };
  $('pfFind').onclick = go; if($('pfReq')) $('pfReq').onclick = go;
  bindFriendButtons(box);
}

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
document.querySelector('.tab[data-view="friends"]').addEventListener('click', () => { pushStats(); refreshFriends(); refreshDuo(); refreshLb(); });
setInterval(() => {
  if(document.visibilityState !== 'visible') return;
  refreshFriends();
  if(friendsOn()){ refreshDuo(); refreshLb(); }
  if(albumMode === 'duo' && $('view-album').classList.contains('on')) loadDuoAlbum();
}, 20000);
pushStats(); refreshFriends().then(refreshDuo);
