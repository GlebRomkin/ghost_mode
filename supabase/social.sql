-- Ghost Mode — рейтинг и «Тандем» (совместная серия с одним другом)
-- Запускать в Supabase → SQL Editor → New query → Run (после schema.sql)

-- ---------- таблицы ----------
create table if not exists public.activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  done int not null default 0,
  primary key (user_id, day)
);

create table if not exists public.public_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  score int not null default 0,
  streak int not null default 0,
  best int not null default 0,
  completed int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.duos (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,   -- кто пригласил
  user_b uuid not null references auth.users(id) on delete cascade,   -- кого пригласили
  status text not null default 'pending' check (status in ('pending','active')),
  started_on date,
  best int not null default 0,
  created_at timestamptz not null default now(),
  check (user_a <> user_b)
);
create index if not exists duos_a on public.duos(user_a);
create index if not exists duos_b on public.duos(user_b);

alter table public.activity     enable row level security;
alter table public.public_stats enable row level security;
alter table public.duos         enable row level security;

drop policy if exists "activity_own"   on public.activity;
drop policy if exists "stats_read"     on public.public_stats;
drop policy if exists "duos_own"       on public.duos;
create policy "activity_own" on public.activity     for select using (auth.uid() = user_id);
create policy "stats_read"   on public.public_stats for select using (auth.uid() is not null);
create policy "duos_own"     on public.duos         for select using (auth.uid() in (user_a, user_b));

-- писать в эти таблицы можно только через функции ниже
grant select on public.activity, public.public_stats, public.duos to authenticated;

-- ---------- статистика (вызывает сайт после изменений) ----------
create or replace function public.push_stats(p_done int, p_score int, p_streak int, p_best int, p_completed int)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'auth'; end if;
  p_done      := least(greatest(coalesce(p_done,0),0), 500);
  p_score     := least(greatest(coalesce(p_score,0),0), 100000);
  p_streak    := least(greatest(coalesce(p_streak,0),0), 3650);
  p_best      := least(greatest(coalesce(p_best,0),0), 3650);
  p_completed := least(greatest(coalesce(p_completed,0),0), 1000000);
  -- день определяет СЕРВЕР, а не часы телефона
  insert into activity(user_id, day, done) values (uid, server_today(), p_done)
    on conflict (user_id, day) do update set done = excluded.done;
  insert into public_stats(user_id, score, streak, best, completed, updated_at)
    values (uid, p_score, p_streak, greatest(p_best, p_streak), p_completed, now())
    on conflict (user_id) do update
      set score = excluded.score, streak = excluded.streak,
          best = greatest(excluded.best, excluded.streak),
          completed = excluded.completed, updated_at = now();
end $$;

-- ---------- рейтинг ----------
create or replace function public.leaderboard(p_by text default 'score')
returns table(rank bigint, username text, avatar text, score int, streak int, best int, completed int, me boolean)
language sql stable security definer set search_path = public as $$
  with r as (
    select row_number() over (
             order by (case when p_by = 'streak' then s.streak else s.score end) desc,
                      s.score desc, p.username) as rank,
           p.id, p.username, p.avatar, s.score, s.streak, s.best, s.completed
    from public_stats s join profiles p on p.id = s.user_id
  )
  select r.rank, r.username, r.avatar, r.score, r.streak, r.best, r.completed, (r.id = auth.uid()) as me
  from r where r.rank <= 50 or r.id = auth.uid()
  order by r.rank
$$;

-- ---------- Тандем ----------
create or replace function public.duo_invite(uname text)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); tgt uuid; rev uuid;
begin
  if me is null then raise exception 'auth'; end if;
  select id into tgt from profiles where lower(username) = lower(trim(uname));
  if tgt is null then raise exception 'user_not_found'; end if;
  if tgt = me then raise exception 'self'; end if;
  if exists (select 1 from duos where status = 'active' and (user_a in (me,tgt) or user_b in (me,tgt))) then
    raise exception 'busy';
  end if;
  -- встречное приглашение уже есть — сразу принимаем
  select id into rev from duos where status = 'pending' and user_a = tgt and user_b = me;
  if rev is not null then perform public.duo_accept(rev); return; end if;
  if exists (select 1 from duos where status = 'pending' and user_a = me) then raise exception 'has_outgoing'; end if;
  insert into duos(user_a, user_b) values (me, tgt);
end $$;

create or replace function public.duo_accept(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); d duos;
begin
  select * into d from duos where id = p_id and status = 'pending' and user_b = me;
  if not found then raise exception 'not_found'; end if;
  if exists (select 1 from duos where status = 'active' and (user_a in (d.user_a, d.user_b) or user_b in (d.user_a, d.user_b))) then
    raise exception 'busy';
  end if;
  update duos set status = 'active', started_on = server_today() where id = p_id;
  delete from duos where status = 'pending' and id <> p_id
    and (user_a in (d.user_a, d.user_b) or user_b in (d.user_a, d.user_b));
end $$;

create or replace function public.duo_decline(p_id uuid)
returns void language sql security definer set search_path = public as $$
  delete from duos where id = p_id and status = 'pending' and auth.uid() in (user_a, user_b)
$$;

create or replace function public.duo_leave()
returns void language sql security definer set search_path = public as $$
  delete from duos where status = 'active' and auth.uid() in (user_a, user_b)
$$;

create or replace function public.duo_state()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid(); d duos; pid uuid; t date := server_today(); s date; streak int := 0;
  res jsonb := jsonb_build_object('active', null, 'outgoing', null, 'incoming', '[]'::jsonb);
  me_today boolean; pa_today boolean; lost boolean := false; days jsonb;
begin
  if me is null then raise exception 'auth'; end if;

  select * into d from duos where status = 'active' and me in (user_a, user_b) limit 1;
  if found then
    pid := case when d.user_a = me then d.user_b else d.user_a end;
    me_today := exists (select 1 from activity where user_id = me  and day = t and done > 0);
    pa_today := exists (select 1 from activity where user_id = pid and day = t and done > 0);
    s := case when me_today and pa_today then t else t - 1 end;
    while s >= d.started_on
      and exists (select 1 from activity where user_id = me  and day = s and done > 0)
      and exists (select 1 from activity where user_id = pid and day = s and done > 0) loop
      streak := streak + 1; s := s - 1;
    end loop;
    lost := (t - 1 >= d.started_on) and streak = 0 and not (me_today and pa_today);
    if streak > d.best then update duos set best = streak where id = d.id; d.best := streak; end if;
    select jsonb_agg(jsonb_build_object(
             'day', g.day,
             'me', exists (select 1 from activity where user_id = me  and day = g.day and done > 0),
             'partner', exists (select 1 from activity where user_id = pid and day = g.day and done > 0),
             'live', g.day >= d.started_on) order by g.day)
      into days from generate_series(t - 13, t, interval '1 day') as g(day);
    res := jsonb_set(res, '{active}', jsonb_build_object(
      'id', d.id, 'started_on', d.started_on, 'streak', streak, 'best', d.best,
      'me_today', me_today, 'partner_today', pa_today, 'lost', lost, 'days', coalesce(days,'[]'::jsonb),
      'partner', (select jsonb_build_object('username', username, 'avatar', avatar) from profiles where id = pid)));
  end if;

  select * into d from duos where status = 'pending' and user_a = me limit 1;
  if found then
    res := jsonb_set(res, '{outgoing}', jsonb_build_object('id', d.id,
      'username', (select username from profiles where id = d.user_b)));
  end if;

  res := jsonb_set(res, '{incoming}', coalesce((
    select jsonb_agg(jsonb_build_object('id', x.id, 'username', p.username, 'avatar', p.avatar) order by x.created_at)
    from duos x join profiles p on p.id = x.user_a
    where x.status = 'pending' and x.user_b = me), '[]'::jsonb));
  return res;
end $$;

grant execute on function
  public.push_stats(int,int,int,int,int), public.leaderboard(text),
  public.duo_invite(text), public.duo_accept(uuid), public.duo_decline(uuid),
  public.duo_leave(), public.duo_state()
to authenticated;

-- аватар по умолчанию — «void» (как на сайте)
alter table public.profiles alter column avatar set default 'void';
update public.profiles set avatar = 'void' where avatar = 'a1';
