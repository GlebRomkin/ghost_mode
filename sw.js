/* Ghost Mode — service worker: push-уведомления, даже когда сайт закрыт */
const SB_URL = 'https://sveeyihjszzfqrqgasjq.supabase.co';
const SB_KEY = 'sb_publishable_kFhKa-XQ2bSHWsnWUrPzJg_I6jXiSRn';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let d = {};
  try{ d = e.data ? e.data.json() : {}; }catch(_){ d = { title: 'Ghost Mode', body: e.data ? e.data.text() : '' }; }
  const alarm = !!d.alarm;
  e.waitUntil(self.registration.showNotification(d.title || 'Ghost Mode', {
    body: d.body || '',
    icon: 'assets/icon-192.png',
    badge: 'assets/icon-192.png',
    tag: d.tag || 'gm',
    renotify: true,
    requireInteraction: alarm,          // «будильник»: не пропадает сам
    vibrate: alarm ? [400, 200, 400, 200, 400] : [200],
    data: { token: d.token || null },
    actions: alarm ? [{ action: 'stop', title: 'Выключить' }] : []
  }));
});

async function ack(token){
  if(!token) return;
  try{
    await fetch(`${SB_URL}/rest/v1/rpc/push_ack`, {
      method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: token })
    });
  }catch(_){}
}
// смахнул уведомление — значит «выключил будильник»
self.addEventListener('notificationclose', e => { const d = e.notification.data; e.waitUntil(ack(d && d.token)); });

self.addEventListener('notificationclick', e => {
  const n = e.notification, token = n.data && n.data.token;
  n.close();
  e.waitUntil((async () => {
    await ack(token);
    if(e.action === 'stop') return;
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for(const c of list){ if('focus' in c) return c.focus(); }
    return self.clients.openWindow('./');
  })());
});
