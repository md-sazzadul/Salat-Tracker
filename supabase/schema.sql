-- Run this once in the Supabase SQL Editor for your project.
-- Each signed-in user can read and change only their own prayer records.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  date_of_birth date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.prayer_completions (
  user_id uuid not null references auth.users (id) on delete cascade,
  prayer_date date not null,
  prayer_name text not null check (prayer_name in ('fajr', 'dhuhr', 'asr', 'maghrib', 'isha')),
  created_at timestamptz not null default now(),
  primary key (user_id, prayer_date, prayer_name)
);

alter table public.profiles enable row level security;
alter table public.prayer_completions enable row level security;

-- Profiles are insert-only for the owner. There is deliberately no UPDATE policy,
-- so a birth date cannot be changed through the app after it has been saved.
drop policy if exists "Read own profile" on public.profiles;
create policy "Read own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Create own profile once" on public.profiles;
create policy "Create own profile once"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Read own prayer completions" on public.prayer_completions;
create policy "Read own prayer completions"
  on public.prayer_completions for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Add own prayer completions" on public.prayer_completions;
create policy "Add own prayer completions"
  on public.prayer_completions for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and prayer_completions.prayer_date >= profiles.date_of_birth
    )
  );

drop policy if exists "Remove own prayer completions" on public.prayer_completions;
create policy "Remove own prayer completions"
  on public.prayer_completions for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert on public.profiles to authenticated;
grant select, insert, delete on public.prayer_completions to authenticated;

