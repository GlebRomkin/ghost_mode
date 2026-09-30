-- Ghost Mode — друзья (заявки, поиск), Тандем только с друзьями, push-уведомления
-- Запускать в Supabase → SQL Editor → New query → Run (после duo_album.sql)

-- =========================================================
-- 1. ДРУЗЬЯ
-- =========================================================
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null references auth.users(id) on delete cascade,
  addressee uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  check (requester <> addressee)
);
create unique index if not exists friendships_pair on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index if not exists friendships_req on public.friendships(requester);
create index if not exists friendships_adr on public.friendships(addressee);
alter table public.friendships enable row level security;
drop policy if exists "friendships_own" on public.friendships;
create policy "friendships_own" on public.friendships for select using (auth.uid() in (requester, addressee));
grant select on public.friendships to authenticated;

-- кто уже в Тандеме — автоматически становятся друзьями
insert into public.friendships(requester, addressee, status)
select user_a, user_b, 'accepted' from public.duos where status = 'active'
on conflict do nothing;

create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from friendships where status = 'accepted'
    and least(requester, addressee) = least(a, b) and greatest(requester, addressee) = greatest(a, b))
$$;

-- поиск по нику (от 2 символов, максимум 10 результатов)
create or replace function public.search_users(q text)
returns table(username text, avatar text, rel text)
language sql stable security definer set search_path = public as $$
  select p.username, p.avatar,
    coalesce((select case when f.status = 'accepted' then 'friend'
                          when f.requester = auth.uid() then 'outgoing' else 'incoming' end
              from friendships f
              where least(f.requester, f.addressee) = least(p.id, auth.uid())
                and greatest(f.requester, f.addressee) = greatest(p.id, auth.uid())), 'none')
  from profiles p
  where auth.uid() is not null
    and char_length(trim(q)) >= 2
    and p.id <> auth.uid()
    and lower(p.username) like replace(replace(replace(lower(trim(both '@ ' from q)), '\', '\\'), '%', '\%'), '_', '\_') || '%'
  order by (lower(p.username) = lower(trim(both '@ ' from q))) desc, char_length(p.username), p.username
  limit 10
$$;

create or replace function public.friend_request(uname text)
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); tgt uuid; f friendships;
begin
  if me is null then raise exception 'auth'; end if;
  select id into tgt from profiles where lower(username) = lower(trim(both '@ ' from uname));
  if tgt is null then raise exception 'user_not_found'; end if;
  if tgt = me then raise exception 'self'; end if;
  select * into f from friendships
    where least(requester, addressee) = least(me, tgt) and greatest(requester, addressee) = greatest(me, tgt);
  if found then
    if f.status = 'accepted' then raise exception 'already_friends'; end if;
    if f.requester = me then raise exception 'already_sent'; end if;
    update friendships set status = 'accepted' where id = f.id;   -- встречная заявка — сразу друзья
    return 'accepted';
  end if;
  if (select count(*) from friendships where requester = me and status = 'pending') >= 30 then
    raise exception 'too_many';
  end if;
  if (select count(*) from friendships where me in (requester, addressee) and status = 'accepted') >= 200 then
    raise exception 'friends_limit';
  end if;
  insert into friendships(requester, addressee) values (me, tgt);
  return 'sent';
end $$;

create or replace function public.friend_accept(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update friendships set status = 'accepted'
    where id = p_id and status = 'pending' and addressee = auth.uid();
  if not found then raise exception 'not_found'; end if;
end $$;

-- отклонить входящую или отменить свою заявку
create or replace function public.friend_decline(p_id uuid)
returns void language sql security definer set search_path = public as $$
  delete from friendships where id = p_id and status = 'pending' and auth.uid() in (requester, addressee)
$$;

-- удалить из друзей (если с ним был Тандем — он тоже заканчивается)
create or replace function public.friend_remove(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare f friendships; me uuid := auth.uid(); other uuid;
begin
  select * into f from friendships where id = p_id and me in (requester, addressee);
  if not found then return; end if;
  other := case when f.requester = me then f.addressee else f.requester end;
  delete from duos where (user_a = me and user_b = other) or (user_a = other and user_b = me);
  delete from friendships where id = p_id;
end $$;

create or replace function public.friends_state()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); partner uuid;
begin
  if me is null then raise exception 'auth'; end if;
  select case when user_a = me then user_b else user_a end into partner
    from duos where status = 'active' and me in (user_a, user_b) limit 1;
  return jsonb_build_object(
    'friends', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'username', p.username, 'avatar', p.avatar,
               'tandem', p.id = partner,
               'busy', exists (select 1 from duos d where d.status = 'active' and p.id in (d.user_a, d.user_b)),
               'score', coalesce(s.score, 0), 'streak', coalesce(s.streak, 0)) order by (p.id = partner) desc, lower(p.username))
      from friendships f
      join profiles p on p.id = case when f.requester = me then f.addressee else f.requester end
      left join public_stats s on s.user_id = p.id
      where f.status = 'accepted' and me in (f.requester, f.addressee)), '[]'::jsonb),
    'incoming', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'username', p.username, 'avatar', p.avatar) order by f.created_at desc)
      from friendships f join profiles p on p.id = f.requester
      where f.status = 'pending' and f.addressee = me), '[]'::jsonb),
    'outgoing', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'username', p.username, 'avatar', p.avatar) order by f.created_at desc)
      from friendships f join profiles p on p.id = f.addressee
      where f.status = 'pending' and f.requester = me), '[]'::jsonb),
    'has_tandem', partner is not null
  );
end $$;

-- Тандем теперь только с другом
create or replace function public.duo_invite(uname text)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); tgt uuid; rev uuid;
begin
  if me is null then raise exception 'auth'; end if;
  select id into tgt from profiles where lower(username) = lower(trim(both '@ ' from uname));
  if tgt is null then raise exception 'user_not_found'; end if;
  if tgt = me then raise exception 'self'; end if;
  if not public.are_friends(me, tgt) then raise exception 'not_friends'; end if;
  if exists (select 1 from duos where status = 'active' and me in (user_a, user_b)) then raise exception 'you_busy'; end if;
  if exists (select 1 from duos where status = 'active' and tgt in (user_a, user_b)) then raise exception 'busy'; end if;
  select id into rev from duos where status = 'pending' and user_a = tgt and user_b = me;
  if rev is not null then perform public.duo_accept(rev); return; end if;
  delete from duos where status = 'pending' and user_a = me;   -- новое приглашение заменяет старое
  insert into duos(user_a, user_b) values (me, tgt);
end $$;

grant execute on function public.search_users(text), public.friend_request(text), public.friend_accept(uuid),
  public.friend_decline(uuid), public.friend_remove(uuid), public.friends_state(), public.duo_invite(text)
to authenticated;
revoke execute on function public.are_friends(uuid, uuid) from anon, authenticated, public;

-- =========================================================
-- 2. PUSH-УВЕДОМЛЕНИЯ (приходят, даже когда сайт закрыт)
-- =========================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- секреты сервера: никто снаружи их не видит
create table if not exists public.app_secrets (name text primary key, value text not null);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated, public;
insert into public.app_secrets(name, value)
values ('cron', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (name) do nothing;

create table if not exists public.push_subs (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_user on public.push_subs(user_id);
alter table public.push_subs enable row level security;

create table if not exists public.push_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  fire_at timestamptz not null,
  title text not null,
  body text not null default '',
  repeat_left int not null default 0,
  token uuid not null default gen_random_uuid(),
  unique (user_id, key)
);
create index if not exists push_jobs_due on public.push_jobs(fire_at);
alter table public.push_jobs enable row level security;

-- ---- вызывает сайт ----
create or replace function public.push_public_key()
returns text language sql stable security definer set search_path = public as $$
  select value from app_secrets where name = 'vapid_public'
$$;

create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'auth'; end if;
  if p_endpoint !~ '^https://' or char_length(p_endpoint) > 1000 or char_length(p_p256dh) > 200 or char_length(p_auth) > 100 then
    raise exception 'bad_sub';
  end if;
  if (select count(*) from push_subs where user_id = auth.uid()) >= 10 then
    delete from push_subs where endpoint = (select endpoint from push_subs where user_id = auth.uid() order by created_at limit 1);
  end if;
  insert into push_subs(endpoint, user_id, p256dh, auth) values (p_endpoint, auth.uid(), p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
end $$;

create or replace function public.push_unsubscribe(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from push_subs where endpoint = p_endpoint and user_id = auth.uid()
$$;

create or replace function public.push_schedule(p_key text, p_at timestamptz, p_title text, p_body text, p_repeat int default 0)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'auth'; end if;
  if p_key is null or char_length(p_key) > 80 then raise exception 'bad_key'; end if;
  if p_at < now() - interval '1 minute' or p_at > now() + interval '400 days' then raise exception 'bad_time'; end if;
  if (select count(*) from push_jobs where user_id = auth.uid()) >= 300
     and not exists (select 1 from push_jobs where user_id = auth.uid() and key = p_key) then
    raise exception 'too_many';
  end if;
  insert into push_jobs(user_id, key, fire_at, title, body, repeat_left)
  values (auth.uid(), p_key, p_at, left(coalesce(p_title, 'Ghost Mode'), 120), left(coalesce(p_body, ''), 300),
          least(greatest(coalesce(p_repeat, 0), 0), 5))
  on conflict (user_id, key) do update
    set fire_at = excluded.fire_at, title = excluded.title, body = excluded.body,
        repeat_left = excluded.repeat_left, token = gen_random_uuid();
end $$;

create or replace function public.push_cancel(p_key text)
returns void language sql security definer set search_path = public as $$
  delete from push_jobs where user_id = auth.uid() and (key = p_key or (right(p_key, 1) = '*' and key like left(p_key, -1) || '%'))
$$;

-- «Выключить» в уведомлении (работает без входа — по одноразовому токену)
create or replace function public.push_ack(p_token uuid)
returns void language sql security definer set search_path = public as $$
  delete from push_jobs where token = p_token
$$;

grant execute on function public.push_public_key(), public.push_ack(uuid) to anon, authenticated;
grant execute on function public.push_subscribe(text, text, text), public.push_unsubscribe(text),
  public.push_schedule(text, timestamptz, text, text, int), public.push_cancel(text) to authenticated;

-- ---- вызывает только серверная функция send-push (по секрету) ----
create or replace function public.push_secret_ok(p_secret text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_secrets where name = 'cron' and value = p_secret)
$$;

create or replace function public.push_keys(p_secret text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.push_secret_ok(p_secret) then raise exception 'forbidden'; end if;
  return (select jsonb_object_agg(name, value) from app_secrets where name in ('vapid_public', 'vapid_private'));
end $$;

create or replace function public.push_set_keys(p_secret text, p_public text, p_private text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.push_secret_ok(p_secret) then raise exception 'forbidden'; end if;
  insert into app_secrets(name, value) values ('vapid_public', p_public), ('vapid_private', p_private)
  on conflict (name) do nothing;
end $$;

-- забрать задания, срок которых пришёл (повторяющиеся — переносятся на минуту вперёд)
create or replace function public.push_claim(p_secret text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare res jsonb;
begin
  if not public.push_secret_ok(p_secret) then raise exception 'forbidden'; end if;
  with due as (
    select * from push_jobs where fire_at <= now() + interval '2 seconds' order by fire_at limit 300 for update skip locked
  ), upd as (
    update push_jobs j set fire_at = now() + interval '60 seconds', repeat_left = j.repeat_left - 1
    from due where j.id = due.id and due.repeat_left > 0 returning j.id
  ), del as (
    delete from push_jobs j using due where j.id = due.id and due.repeat_left <= 0 returning j.id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'title', due.title, 'body', due.body, 'key', due.key, 'token', due.token, 'last', due.repeat_left <= 0,
      'subs', (select coalesce(jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)), '[]'::jsonb)
               from push_subs s where s.user_id = due.user_id))), '[]'::jsonb)
    into res from due;
  return res;
end $$;

create or replace function public.push_drop(p_secret text, p_endpoint text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.push_secret_ok(p_secret) then raise exception 'forbidden'; end if;
  delete from push_subs where endpoint = p_endpoint;
end $$;

grant execute on function public.push_keys(text), public.push_set_keys(text, text, text),
  public.push_claim(text), public.push_drop(text, text) to anon, authenticated;
revoke execute on function public.push_secret_ok(text) from anon, authenticated, public;

-- ---- расписание: каждые 10 секунд будим функцию send-push, если есть что отправить ----
do $$ begin perform cron.unschedule('gm-push'); exception when others then null; end $$;
select cron.schedule('gm-push', '10 seconds', $cron$
  select net.http_post(
    url := 'https://sveeyihjszzfqrqgasjq.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-gm-secret', (select value from public.app_secrets where name = 'cron')),
    body := '{}'::jsonb,
    timeout_milliseconds := 8000)
  where exists (select 1 from public.push_jobs where fire_at <= now() + interval '2 seconds')
     or not exists (select 1 from public.app_secrets where name = 'vapid_public');
$cron$);
