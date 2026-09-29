-- Ghost Mode — стартовая схема Supabase (тестовый сервер)
-- Вставь целиком в Supabase → SQL Editor → New query → Run

-- 1. Профили: только username и аватар (почта хранится в auth.users, наружу не отдаётся)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-zA-Z0-9_]{3,20}$'),
  avatar text default 'a1',
  created_at timestamptz not null default now()
);

-- 2. Данные пользователя (пока одним JSON — как в localStorage, потом разнесём по таблицам)
create table if not exists public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 3. Включаем защиту строк: каждый видит и меняет только своё
alter table public.profiles  enable row level security;
alter table public.user_data enable row level security;

drop policy if exists "profiles_select_all" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "data_select_own"     on public.user_data;
drop policy if exists "data_insert_own"     on public.user_data;
drop policy if exists "data_update_own"     on public.user_data;

-- username/аватар видны всем (нужно для поиска друзей по нику)
create policy "profiles_select_all" on public.profiles for select using (true);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

create policy "data_select_own" on public.user_data for select using (auth.uid() = user_id);
create policy "data_insert_own" on public.user_data for insert with check (auth.uid() = user_id);
create policy "data_update_own" on public.user_data for update using (auth.uid() = user_id);

-- 4. При регистрации автоматически создаём профиль и пустые данные
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)));
  insert into public.user_data (user_id) values (new.id);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5. Серверное время (чтобы нельзя было подделать «сегодня» сменой часов на телефоне)
create or replace function public.server_today()
returns date language sql stable as $$ select (now() at time zone 'Europe/Moscow')::date $$;

-- 6. Проверка свободного ника до регистрации
create or replace function public.username_free(n text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.profiles where lower(username) = lower(n))
$$;
grant execute on function public.server_today() to anon, authenticated;
grant execute on function public.username_free(text) to anon, authenticated;

-- 7. Права для API (нужны, если отключено "Automatically expose new tables")
grant usage on schema public to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update (username, avatar) on public.profiles to authenticated;
grant select, insert, update on public.user_data to authenticated;
