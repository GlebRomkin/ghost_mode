/* GM — Ghost Mode · профиль: подразделы, настройки, темы; закреплённая панель вкладок
   Разработано Veraxis */
const THEMES = [
  { id:'night',    name:'Ночь',     sub:'по умолчанию', c:['#050506','#151518','#f2f2f4'] },
  { id:'graphite', name:'Графит',   sub:'мягкий тёмный', c:['#121316','#232429','#eeeef1'] },
  { id:'midnight', name:'Полночь',  sub:'тёмно-синяя',  c:['#060a14','#131c30','#e8eeff'] },
  { id:'light',    name:'Светлая',  sub:'дневная',      c:['#f3f3f5','#ffffff','#141417'] },
  { id:'sand',     name:'Песок',    sub:'тёплая светлая', c:['#f1ebe0','#fbf7f0','#2a241b'] },
];
data.settings ||= {};
function applyTheme(id, save){
  if(!THEMES.some(t => t.id === id)) id = 'night';
  if(id === 'night') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = id;
  try{ localStorage.setItem('gm-theme', id); }catch(e){}
  const meta = document.querySelector('meta[name="theme-color"]'); if(meta) meta.content = THEMES.find(t => t.id === id).c[0];
  if(save){ data.settings.theme = id; Store.save(data); }
  if($('view-stats').classList.contains('on')) renderStats();
}
applyTheme(data.settings.theme || 'night');

/* ---------- подразделы профиля ---------- */
let profPart = 'main';
function setProfPart(p){
  profPart = p;
  $('profTabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.p === p));
  $('pMain').hidden = p !== 'main'; $('pFriendsBox').hidden = p !== 'friends'; $('pSettings').hidden = p !== 'settings';
  if(p === 'friends'){ renderProfileFriends(); refreshFriends(); }
  if(p === 'settings') renderSettings();
}
$('profTabs').addEventListener('click', e => { const b = e.target.closest('button'); if(b) setProfPart(b.dataset.p); });
$('pFriendsStat').onclick = () => setProfPart('friends');

/* ---------- настройки ---------- */
function renderSettings(){
  const box = $('pSettings'), th = data.settings.theme || 'night';
  const pushOn = GMPush.ready, perm = 'Notification' in window ? Notification.permission : 'unsupported';
  const iosHint = GMPush.isIOS() && !GMPush.standalone();
  box.innerHTML = `
  <div class="glass card set-card">
    <div class="card-h"><h3>Тема</h3><span class="sub">иконка Ghost Mode не меняется</span></div>
    <div class="theme-grid">${THEMES.map(t => `<button class="theme${t.id === th ? ' on' : ''}" data-theme-id="${t.id}">
      <span class="th-prev" style="background:${t.c[0]}"><i style="background:${t.c[1]}"></i><i style="background:${t.c[2]}"></i></span>
      <b>${t.name}</b><small>${t.sub}</small></button>`).join('')}</div>
  </div>

  <div class="glass card set-card">
    <div class="card-h"><h3>Профиль</h3></div>
    <div class="set-row"><span><b>Ник</b><small>меняется прямо в карточке профиля — нажми на @ник</small></span><button class="t-def" id="setNick">Изменить</button></div>
    <div class="set-row"><span><b>Почта</b><small>${esc(me.email || '')}</small></span></div>
    <div class="set-row"><span><b>Пароль</b><small>смени пароль для входа</small></span><button class="t-def" id="setPassBtn">Сменить</button></div>
    <form class="set-pass" id="setPass" hidden><input type="password" id="np1" placeholder="Новый пароль (от 8 символов)" autocomplete="new-password"><input type="password" id="np2" placeholder="Повтори пароль" autocomplete="new-password"><button class="t-ok" type="submit">Сохранить</button><span class="td-msg" id="npMsg"></span></form>
  </div>

  <div class="glass card set-card">
    <div class="card-h"><h3>Уведомления</h3></div>
    <div class="set-row"><span><b>Push-уведомления</b><small id="setNotif">${pushOn ? 'Включены на этом устройстве — придут, даже когда сайт закрыт' : perm === 'denied' ? 'Запрещены в браузере — разреши их в настройках сайта' : iosHint ? 'На iPhone сначала добавь Ghost Mode на экран «Домой»: Поделиться → На экран «Домой»' : 'Выключены'}</small></span>
      <button class="${pushOn ? 't-def' : 't-ok'}" id="setPush">${pushOn ? 'Выключить' : 'Включить'}</button></div>
    <p class="td-note">Конец фокуса и перерыва звучит как будильник: уведомление повторяется каждую минуту (до 5 раз), пока не нажмёшь «Выключить» или не откроешь Ghost Mode.</p>
  </div>

  <div class="glass card set-card">
    <div class="card-h"><h3>Приватность</h3></div>
    <label class="set-row"><span><b>Показывать мои дела другу в Тандеме</b><small>друг видит список твоих дел на сегодня</small></span><input type="checkbox" class="switch" id="setShare" ${data.settings.shareToday !== false ? 'checked' : ''}></label>
  </div>

  <div class="glass card set-card">
    <div class="card-h"><h3>Помощь</h3></div>
    <div class="set-row"><span><b>Обучение</b><small>быстрый показ, что где находится</small></span><button class="t-ok" id="setTour">Пройти заново</button></div>
  </div>

  <div class="glass card set-card">
    <div class="set-row"><span><b>Аккаунт</b><small>${esc(data.profile.username ? '@' + data.profile.username : me.email)}</small></span><button class="t-def danger-t" id="setLogout">Выйти из аккаунта</button></div>
  </div>`;
  box.querySelectorAll('[data-theme-id]').forEach(b => b.onclick = () => { applyTheme(b.dataset.themeId, true); renderSettings(); });
  $('setNick').onclick = () => { setProfPart('main'); setTimeout(() => { $('uname').focus(); $('uname').select(); }, 50); };
  $('setPassBtn').onclick = () => { $('setPass').hidden = !$('setPass').hidden; };
  $('setPass').onsubmit = async e => {
    e.preventDefault();
    const a = $('np1').value, b = $('np2').value, m = $('npMsg');
    if(a.length < 8){ m.textContent = 'Пароль должен быть не короче 8 символов'; return; }
    if(a !== b){ m.textContent = 'Пароли не совпадают'; return; }
    const r = await sb.auth.updateUser({ password: a });
    m.textContent = r.error ? 'Не получилось: ' + r.error.message : 'Пароль изменён';
    if(!r.error){ $('np1').value = $('np2').value = ''; }
  };
  $('setPush').onclick = async () => {
    if(GMPush.ready){ await GMPush.disable(); toast('Push-уведомления выключены на этом устройстве'); }
    else if(await GMPush.enable()) toast('Push-уведомления включены');
    renderNotifBtn(); renderSettings();
  };
  $('setShare').onchange = e => { data.settings.shareToday = e.target.checked; Store.save(data); toast(e.target.checked ? 'Друг видит твои дела на сегодня' : 'Твои дела скрыты от друга'); };
  $('setTour').onclick = () => startTour(true);
  $('setLogout').onclick = () => $('logoutBtn').click();
}

/* ---------- панель вкладок на телефоне: всегда на месте ---------- */
const navEl = document.querySelector('.tabs'), mq = matchMedia('(max-width:640px)');
function placeTabs(){
  if(mq.matches){ if(navEl.parentElement !== document.body) document.body.appendChild(navEl); }
  else if(navEl.parentElement === document.body) document.querySelector('header .bar').insertBefore(navEl, $('menuBtn'));
}
(mq.addEventListener ? mq.addEventListener('change', placeTabs) : mq.addListener(placeTabs));
placeTabs();
// пока открыта клавиатура — прячем панель, чтобы она не прыгала над клавиатурой
document.addEventListener('focusin', e => { if(mq.matches && e.target.matches('input:not([type=checkbox]):not([type=file]),textarea,[contenteditable="true"]')) document.body.classList.add('kb'); });
document.addEventListener('focusout', () => setTimeout(() => { const a = document.activeElement; if(!a || !a.matches('input,textarea,[contenteditable="true"]')) document.body.classList.remove('kb'); }, 50));
