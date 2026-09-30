// Ghost Mode — send-push: отправляет push-уведомления (фокус, перерывы, напоминания).
// Supabase → Edge Functions → Deploy a new function → Via Editor → имя send-push → вставить этот код → Deploy.
// После деплоя: Details → выключить «Enforce JWT verification» (функцию вызывает расписание по секрету).
// Никаких внешних библиотек: шифрование Web Push (RFC 8291) и подпись VAPID (RFC 8292) на WebCrypto.

const SB_URL = "https://sveeyihjszzfqrqgasjq.supabase.co";
const SB_KEY = "sb_publishable_kFhKa-XQ2bSHWsnWUrPzJg_I6jXiSRn"; // публичный ключ
const CONTACT = "https://ghost-mode-7ezo.onrender.com";
const te = new TextEncoder();

const b64u = (buf: ArrayBuffer | Uint8Array) => {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = ""; for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const unb64u = (s: string) => {
  s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
};
const concat = (...a: Uint8Array[]) => {
  const out = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let o = 0;
  for (const x of a) { out.set(x, o); o += x.length; } return out;
};

async function rpc(fn: string, args: Record<string, unknown>) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SB_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(`${fn}: ${r.status} ${await r.text()}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
}

// ---------- ключи VAPID (создаются один раз и хранятся в базе) ----------
async function getVapid(secret: string) {
  let k = await rpc("push_keys", { p_secret: secret });
  if (!k || !k.vapid_public || !k.vapid_private) {
    const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const pub = b64u(await crypto.subtle.exportKey("raw", pair.publicKey));
    const priv = JSON.stringify(await crypto.subtle.exportKey("jwk", pair.privateKey));
    await rpc("push_set_keys", { p_secret: secret, p_public: pub, p_private: priv });
    k = await rpc("push_keys", { p_secret: secret });
  }
  const key = await crypto.subtle.importKey("jwk", JSON.parse(k.vapid_private), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  return { pub: k.vapid_public as string, key };
}

async function vapidHeader(endpoint: string, v: { pub: string; key: CryptoKey }) {
  const aud = new URL(endpoint).origin;
  const head = b64u(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64u(te.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: CONTACT })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, v.key, te.encode(`${head}.${body}`));
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${v.pub}`;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number) {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, len * 8));
}

// шифрование aes128gcm (RFC 8188 + RFC 8291)
export async function encrypt(payload: string, p256dh: string, authSecret: string) {
  const uaPub = unb64u(p256dh), auth = unb64u(authSecret);
  const eph = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", eph.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, eph.privateKey, 256));
  const ikm = await hkdf(auth, shared, concat(te.encode("WebPush: info\0"), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const plain = concat(te.encode(payload), new Uint8Array([2]));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, plain));
  const rs = new Uint8Array(4); new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}

async function send(sub: { endpoint: string; p256dh: string; auth: string }, payload: string, v: { pub: string; key: CryptoKey }) {
  const body = await encrypt(payload, sub.p256dh, sub.auth);
  const r = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidHeader(sub.endpoint, v),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "3600",
      Urgency: "high",
    },
    body,
  });
  return r.status;
}

Deno.serve(async (req) => {
  const secret = req.headers.get("x-gm-secret") || "";
  if (!secret) return new Response("forbidden", { status: 403 });
  try {
    const v = await getVapid(secret);
    const jobs = await rpc("push_claim", { p_secret: secret }) || [];
    let sent = 0;
    for (const j of jobs) {
      const payload = JSON.stringify({ title: j.title, body: j.body, tag: j.key, token: j.token, alarm: !j.last || j.key === "timer" });
      for (const s of j.subs || []) {
        try {
          const st = await send(s, payload, v);
          if (st === 404 || st === 410) await rpc("push_drop", { p_secret: secret, p_endpoint: s.endpoint });
          else if (st < 300) sent++;
        } catch (_) { /* одна подписка не должна ломать остальные */ }
      }
    }
    return new Response(JSON.stringify({ jobs: jobs.length, sent }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(String(e), { status: String(e).includes("forbidden") ? 403 : 500 });
  }
});
