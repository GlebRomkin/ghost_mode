/* GM — Ghost Mode · вход, регистрация и облачная синхронизация (Supabase)
   Разработано Veraxis */
const GM_SB_URL = 'https://sveeyihjszzfqrqgasjq.supabase.co';
const GM_SB_KEY = 'sb_publishable_kFhKa-XQ2bSHWsnWUrPzJg_I6jXiSRn'; // публичный ключ, его можно держать в коде
const LEGACY_KEY = 'veraxis-todo-v1';
const APP_SCRIPTS = ['js/core.js','js/stats.js','js/profile.js','js/main.js','js/social.js'];

const $a = id => document.getElementById(id);
let sb = null, me = null;

/* ---------- облако ---------- */
window.GMCloud = {
  timer: null, pending: false, lastProfile: '',
  setState(t, err){ const e = $a('syncState'); if(e){ e.textContent = t; e.classList.toggle('err', !!err); } },
  push(d){
    if(!sb || !me) return;
    this.pending = true; this.setState('сохраняю…');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(d), 700);
  },
  async flush(d){
    if(!sb || !me || !this.pending) return;
    d = d || JSON.parse(localStorage.getItem(window.GM_KEY) || 'null'); if(!d) return;
    this.pending = false;
    const r = await sb.from('user_data').upsert({ user_id: me.id, data: d, updated_at: new Date().toISOString() });
    if(r.error){ this.pending = true; this.setState('нет связи с сервером', true); return; }
    const p = d.profile || {}, sig = (p.username||'') + '|' + (p.avatar||'');
    if(sig !== this.lastProfile && p.username && /^[a-zA-Z0-9_]{3,20}$/.test(p.username)){
      const pr = await sb.from('profiles').update({ username: p.username, avatar: p.avatar }).eq('id', me.id);
      if(pr.error){ this.setState(pr.error.code === '23505' ? 'этот ник уже занят' : 'ошибка профиля', true); return; }
      this.lastProfile = sig;
    }
    this.setState('синхронизировано');
  },
  async pull(){
    if(!sb || !me || this.pending) return;
    const r = await sb.from('user_data').select('data').eq('user_id', me.id).maybeSingle();
    const rd = r.data && r.data.data, ld = JSON.parse(localStorage.getItem(window.GM_KEY) || 'null');
    if(rd && rd._ts && (!ld || rd._ts > (ld._ts || 0))){ localStorage.setItem(window.GM_KEY, JSON.stringify(rd)); location.reload(); }
  }
};
addEventListener('pagehide', () => { if(window.GMCloud.pending) window.GMCloud.flush(); });
document.addEventListener('visibilitychange', () => {
  if(document.visibilityState === 'hidden') window.GMCloud.flush();
  else window.GMCloud.pull();
});

/* ---------- запуск приложения ---------- */
function loadScript(src){ return new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.body.appendChild(s); }); }

async function enter(session){
  me = session.user;
  window.GM_KEY = 'gm-data-' + me.id;
  const [ud, pr] = await Promise.all([
    sb.from('user_data').select('data').eq('user_id', me.id).maybeSingle(),
    sb.from('profiles').select('username,avatar').eq('id', me.id).maybeSingle()
  ]);
  let remote = ud.data && ud.data.data && ud.data.data.tasks ? ud.data.data : null;
  let local = null; try{ local = JSON.parse(localStorage.getItem(window.GM_KEY)); }catch(e){}
  let d = remote, migrate = false;
  if(local && local.tasks && (!remote || (local._ts||0) > (remote._ts||0))) d = local;
  if(!d){
    // первый вход: забираем то, что было в браузере до регистрации
    try{ const old = JSON.parse(localStorage.getItem(LEGACY_KEY)); if(old && Array.isArray(old.tasks) && old.tasks.length){ d = old; migrate = true; } }catch(e){}
  }
  if(!d) d = { tasks: [], notes: {}, focus: {} };
  d.profile ||= { username: '', avatar: 'void' };
  if(pr.data){ if(pr.data.username) d.profile.username = pr.data.username; if(pr.data.avatar && !d.profile.avatar) d.profile.avatar = pr.data.avatar; }
  window.GMCloud.lastProfile = (pr.data ? pr.data.username : '') + '|' + (pr.data ? pr.data.avatar : '');
  d._ts = d._ts || Date.now();
  localStorage.setItem(window.GM_KEY, JSON.stringify(d));
  if(migrate || !remote || d === local) { window.GMCloud.pending = true; }
  $a('authScreen').hidden = true;
  document.body.classList.remove('noapp');
  for(const s of APP_SCRIPTS) await loadScript(s);
  $a('acctLine').textContent = d.profile.username || me.email;
  if(window.GMCloud.pending) window.GMCloud.flush(d); else window.GMCloud.setState('синхронизировано');
  $a('logoutBtn').onclick = async () => {
    await window.GMCloud.flush();
    await sb.auth.signOut();
    try{ localStorage.removeItem(window.GM_KEY); }catch(e){}
    location.reload();
  };
}

/* ---------- экран входа ---------- */
let mode = 'in';
function setMode(m){
  mode = m;
  $a('authTabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
  $a('fUser').hidden = m !== 'up';
  $a('fPass2').hidden = m !== 'up';
  $a('authGo').textContent = m === 'in' ? 'Войти' : 'Создать аккаунт';
  $a('fPass').autocomplete = m === 'in' ? 'current-password' : 'new-password';
  authMsg('');
}
function authMsg(t, ok){ const e = $a('authMsg'); e.textContent = t; e.classList.toggle('ok', !!ok); }
function humanErr(m){
  m = (m || '').toLowerCase();
  if(m.includes('invalid login')) return 'Неверная почта или пароль';
  if(m.includes('already registered') || m.includes('already been registered')) return 'Эта почта уже зарегистрирована';
  if(m.includes('password should')) return 'Пароль должен быть не короче 8 символов';
  if(m.includes('rate limit') || m.includes('too many')) return 'Слишком много попыток, подожди немного';
  if(m.includes('valid email') || m.includes('invalid email')) return 'Проверь адрес почты';
  if(m.includes('confirm')) return 'Подтверди почту по письму и войди снова';
  if(m.includes('fetch') || m.includes('network')) return 'Нет связи с сервером';
  return 'Ошибка: ' + m;
}
async function submit(e){
  e.preventDefault();
  const email = $a('fEmail').value.trim(), pass = $a('fPass').value, user = $a('fUser').value.trim();
  if(!email || !pass) return authMsg('Введи почту и пароль');
  const btn = $a('authGo'); btn.disabled = true; authMsg('');
  try{
    if(mode === 'up'){
      if(!/^[a-zA-Z0-9_]{3,20}$/.test(user)) throw { message: 'Ник: 3–20 символов, латиница, цифры и _' , raw: true };
      if(pass.length < 8) throw { message: 'Пароль должен быть не короче 8 символов', raw: true };
      if(pass !== $a('fPass2').value) throw { message: 'Пароли не совпадают', raw: true };
      const free = await sb.rpc('username_free', { n: user });
      if(free.data === false) throw { message: 'Этот ник уже занят', raw: true };
      const r = await sb.auth.signUp({ email, password: pass, options: { data: { username: user } } });
      if(r.error) throw r.error;
      if(!r.data.session){ authMsg('Почти готово: подтверди почту по письму и войди.', true); setMode('in'); authMsg('Почти готово: подтверди почту по письму и войди.', true); return; }
      await enter(r.data.session);
    } else {
      const r = await sb.auth.signInWithPassword({ email, password: pass });
      if(r.error) throw r.error;
      await enter(r.data.session);
    }
  }catch(err){ authMsg(err.raw ? err.message : humanErr(err.message)); }
  finally{ btn.disabled = false; }
}

(async function boot(){
  if(!window.supabase){ authMsg('Не удалось загрузить модуль входа. Обнови страницу.'); return; }
  sb = window.supabase.createClient(GM_SB_URL, GM_SB_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  $a('authTabs').addEventListener('click', e => { const b = e.target.closest('button'); if(b) setMode(b.dataset.m); });
  $a('authForm').addEventListener('submit', submit);
  setMode('in');
  const { data: { session } } = await sb.auth.getSession();
  if(session){ try{ await enter(session); }catch(e){ authMsg('Не удалось загрузить данные. Обнови страницу.'); $a('authScreen').hidden = false; } }
  else { $a('authScreen').hidden = false; }
})();
