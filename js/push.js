/* GM — Ghost Mode · push-уведомления через сервер (приходят, даже когда сайт закрыт)
   Разработано Veraxis */
const GMPush = {
  reg: null, sub: null, ready: false,
  supported: () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
  isIOS: () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  standalone: () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
  async init(){
    if(!('serviceWorker' in navigator)) return;
    try{ this.reg = await navigator.serviceWorker.register('sw.js'); }catch(e){ return; }
    if(!this.supported()) return;
    try{ this.sub = await this.reg.pushManager.getSubscription(); }catch(e){}
    if(this.sub && Notification.permission === 'granted'){ await this.save(this.sub); this.ready = true; }
    else if(Notification.permission === 'granted') await this.subscribe(true);
    if(typeof renderNotifBtn === 'function') renderNotifBtn();
    this.syncReminders();
  },
  b64ToBytes(s){ s = s.replace(/-/g,'+').replace(/_/g,'/'); while(s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); },
  async save(sub){
    const j = sub.toJSON();
    const r = await sb.rpc('push_subscribe', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
    return !r.error;
  },
  async subscribe(silent){
    if(!this.reg || !this.supported()) return false;
    const k = await sb.rpc('push_public_key');
    if(k.error || !k.data){ if(!silent) toast('Сервер уведомлений ещё настраивается — попробуй через минуту'); return false; }
    try{
      this.sub = await this.reg.pushManager.getSubscription() || await this.reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: this.b64ToBytes(k.data) });
      this.ready = await this.save(this.sub);
      return this.ready;
    }catch(e){ if(!silent) toast('Не удалось включить push-уведомления'); return false; }
  },
  // включить по кнопке (нужно нажатие пользователя)
  async enable(){
    if(this.isIOS() && !this.standalone()){
      toast('На iPhone уведомления работают, только если Ghost Mode добавлен на экран «Домой»'); return false;
    }
    if(!('Notification' in window)){ toast('Этот браузер не поддерживает уведомления'); return false; }
    let p = Notification.permission;
    if(p === 'default'){ try{ p = await Notification.requestPermission(); }catch(e){} }
    if(p !== 'granted'){ toast('Уведомления запрещены — разреши их в настройках браузера'); return false; }
    const ok = await this.subscribe(false);
    if(ok) this.syncReminders(true);
    return ok;
  },
  async disable(){
    try{ if(this.sub){ await sb.rpc('push_unsubscribe', { p_endpoint: this.sub.endpoint }); await this.sub.unsubscribe(); } }catch(e){}
    this.sub = null; this.ready = false;
  },
  schedule(key, at, title, body, repeat){
    if(!this.ready || typeof sb === 'undefined' || !sb) return;
    sb.rpc('push_schedule', { p_key: key, p_at: new Date(at).toISOString(), p_title: title, p_body: body || '', p_repeat: repeat || 0 }).then(()=>{});
  },
  cancel(key){
    if(typeof sb === 'undefined' || !sb || !me) return;
    sb.rpc('push_cancel', { p_key: key }).then(()=>{});
  },
  // напоминания о делах → серверные задания
  syncReminders(force){
    if(!this.ready || typeof data === 'undefined') return;
    data.remPushed ||= {};
    const want = {}, now = Date.now();
    for(const x of data.tasks){
      if(!x.remind || x.done || x.date < today()) continue;
      const at = new Date(`${x.date}T${x.remind}:00`).getTime();
      if(!(at > now - 30000)) continue;
      want[x.id] = `${x.date} ${x.remind}|${x.title}`;
    }
    let changed = false;
    for(const id in want){
      if(!force && data.remPushed[id] === want[id]) continue;
      const x = data.tasks.find(t => t.id === id), [dt] = want[id].split('|');
      this.schedule('task:' + id, new Date(`${x.date}T${x.remind}:00`), 'Напоминание · Ghost Mode', x.title, 1);
      data.remPushed[id] = want[id]; changed = true;
    }
    for(const id in data.remPushed){
      if(want[id]) continue;
      this.cancel('task:' + id); delete data.remPushed[id]; changed = true;
    }
    if(changed) _gmSaveRaw(data);
  }
};
// сохранить без повторного запуска синхронизации
function _gmSaveRaw(d){ try{ localStorage.setItem(Store.KEY, JSON.stringify(d)); }catch(e){} if(window.GMCloud) window.GMCloud.push(d); }
(() => {
  const prev = Store.save.bind(Store); let t = null;
  Store.save = function(d){ prev(d); clearTimeout(t); t = setTimeout(() => GMPush.syncReminders(), 1200); };
})();
GMPush.init();
