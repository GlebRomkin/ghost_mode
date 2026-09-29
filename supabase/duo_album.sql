-- Ghost Mode — общий альбом Тандема и дела друга на сегодня
-- Запускать в Supabase → SQL Editor → New query → Run (после social.sql)

create table if not exists public.duo_album (
  id uuid primary key default gen_random_uuid(),
  duo_id uuid not null references public.duos(id) on delete cascade,
  author uuid not null references auth.users(id) on delete cascade,
  day date not null,
  text text not null check (char_length(text) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists duo_album_duo on public.duo_album(duo_id, created_at desc);
alter table public.duo_album enable row level security;
drop policy if exists "duo_album_read" on public.duo_album;
create policy "duo_album_read" on public.duo_album for select using (
  exists (select 1 from public.duos d where d.id = duo_id and d.status = 'active' and auth.uid() in (d.user_a, d.user_b))
);
grant select on public.duo_album to authenticated;

-- id активного Тандема текущего пользователя
create or replace function public.my_duo()
returns uuid language sql stable security definer set search_path = public as $$
  select id from duos where status = 'active' and auth.uid() in (user_a, user_b) limit 1
$$;

-- добавить запись в общий альбом
create or replace function public.album_post(p_text text, p_day date default null)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); did uuid := public.my_duo(); d date := coalesce(p_day, server_today());
begin
  if me is null then raise exception 'auth'; end if;
  if did is null then raise exception 'no_duo'; end if;
  p_text := trim(coalesce(p_text, ''));
  if p_text = '' then raise exception 'empty'; end if;
  if char_length(p_text) > 2000 then raise exception 'too_long'; end if;
  if d > server_today() then d := server_today(); end if;
  if (select count(*) from duo_album where author = me and created_at > now() - interval '1 day') >= 30 then
    raise exception 'limit';
  end if;
  if exists (select 1 from duo_album where duo_id = did and author = me and day = d and text = p_text) then
    raise exception 'duplicate';
  end if;
  insert into duo_album(duo_id, author, day, text) values (did, me, d, p_text);
end $$;

-- удалить свою запись
create or replace function public.album_delete(p_id uuid)
returns void language sql security definer set search_path = public as $$
  delete from duo_album where id = p_id and author = auth.uid()
$$;

-- лента общего альбома
create or replace function public.album_list()
returns table(id uuid, day date, text text, created_at timestamptz, username text, avatar text, mine boolean)
language sql stable security definer set search_path = public as $$
  select a.id, a.day, a.text, a.created_at, p.username, p.avatar, a.author = auth.uid()
  from duo_album a join profiles p on p.id = a.author
  where a.duo_id = public.my_duo()
  order by a.day desc, a.created_at desc
  limit 300
$$;

-- дела друга на выбранный день (только сегодня ± 1 день, чтобы учесть часовые пояса)
create or replace function public.duo_partner_tasks(p_day date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); d duos; pid uuid; ud jsonb; t date := server_today();
begin
  if me is null then raise exception 'auth'; end if;
  select * into d from duos where status = 'active' and me in (user_a, user_b) limit 1;
  if not found then return jsonb_build_object('shared', false, 'tasks', '[]'::jsonb); end if;
  pid := case when d.user_a = me then d.user_b else d.user_a end;
  if p_day is null or p_day < t - 1 or p_day > t + 1 then p_day := t; end if;
  select data into ud from user_data where user_id = pid;
  if ud is null or coalesce((ud->'settings'->>'shareToday')::boolean, true) = false then
    return jsonb_build_object('shared', false, 'tasks', '[]'::jsonb);
  end if;
  return jsonb_build_object('shared', true, 'tasks', coalesce((
    select jsonb_agg(jsonb_build_object(
             'title', left(x->>'title', 200),
             'done', coalesce((x->>'done')::boolean, false),
             'prio', coalesce((x->>'prio')::boolean, false))
           order by coalesce((x->>'done')::boolean, false), coalesce((x->>'created')::bigint, 0))
    from jsonb_array_elements(coalesce(ud->'tasks', '[]'::jsonb)) x
    where x->>'date' = p_day::text
  ), '[]'::jsonb));
end $$;

grant execute on function public.my_duo(), public.album_post(text, date), public.album_delete(uuid),
  public.album_list(), public.duo_partner_tasks(date) to authenticated;
