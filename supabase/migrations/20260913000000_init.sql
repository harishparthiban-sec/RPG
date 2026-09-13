-- ═══════════════════════════════════════════════════════════════════════════
-- Life RPG — initial schema + Row Level Security
-- Run in the Supabase SQL Editor (or `supabase db push`).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────── profiles ──
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      text not null default 'Adventurer',
  level         integer not null default 1,
  xp            integer not null default 0,   -- xp within current level
  gold          integer not null default 50,
  total_xp      bigint not null default 0,
  title         text not null default 'Wanderer',
  avatar_theme  text not null default 'default',
  created_at    timestamptz not null default now()
);

-- ───────────────────────────────────────────────────────────────── quests ──
create table if not exists public.quests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  title         text not null,
  description   text,
  category      text not null default 'intellect'
                check (category in ('strength','intellect','vitality','creativity','focus')),
  difficulty    text not null default 'common'
                check (difficulty in ('common','rare','epic','legendary')),
  xp_reward     integer not null default 10,
  gold_reward   integer not null default 5,
  completed     boolean not null default false,
  completed_at  timestamptz,
  due_date      date,
  created_at    timestamptz not null default now()
);

create index if not exists quests_user_id_idx   on public.quests (user_id, created_at desc);
create index if not exists quests_completed_idx on public.quests (user_id, completed);

-- ───────────────────────────────────────────────────── character attributes ─
create table if not exists public.attributes (
  user_id       uuid not null references auth.users (id) on delete cascade,
  key           text not null
                check (key in ('strength','intellect','vitality','creativity','focus')),
  xp            integer not null default 0,
  level         integer not null default 0,
  primary key (user_id, key)
);

-- ───────────────────────────────────────────────────────────────── streaks ─
create table if not exists public.streaks (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  current            integer not null default 0,
  best               integer not null default 0,
  last_active_date   date
);

-- ─────────────────────────────────────────────────────── inventory / items ─
create table if not exists public.inventory (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  item_key      text not null,
  equipped      boolean not null default false,
  acquired_at   timestamptz not null default now(),
  unique (user_id, item_key)
);

-- ─────────────────────────────────────────────────────────── transactions ──
create table if not exists public.transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  kind          text not null check (kind in ('earn','spend','bonus')),
  amount        integer not null,
  reason        text not null,
  created_at    timestamptz not null default now()
);

create index if not exists transactions_user_idx on public.transactions (user_id, created_at desc);

-- ═══════════════════════════════ Row Level Security ════════════════════════
-- Every table is fully user-isolated: a user can only touch their own rows.

alter table public.profiles     enable row level security;
alter table public.quests       enable row level security;
alter table public.attributes   enable row level security;
alter table public.streaks      enable row level security;
alter table public.inventory    enable row level security;
alter table public.transactions enable row level security;

-- profiles: users may read/update their own; inserts happen via trigger.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid () = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid () = id) with check (auth.uid () = id);

-- quests
drop policy if exists "quests_all_own" on public.quests;
create policy "quests_all_own" on public.quests
  for all using (auth.uid () = user_id) with check (auth.uid () = user_id);

-- attributes
drop policy if exists "attributes_all_own" on public.attributes;
create policy "attributes_all_own" on public.attributes
  for all using (auth.uid () = user_id) with check (auth.uid () = user_id);

-- streaks
drop policy if exists "streaks_all_own" on public.streaks;
create policy "streaks_all_own" on public.streaks
  for all using (auth.uid () = user_id) with check (auth.uid () = user_id);

-- inventory
drop policy if exists "inventory_all_own" on public.inventory;
create policy "inventory_all_own" on public.inventory
  for all using (auth.uid () = user_id) with check (auth.uid () = user_id);

-- transactions
drop policy if exists "transactions_all_own" on public.transactions;
create policy "transactions_all_own" on public.transactions
  for all using (auth.uid () = user_id) with check (auth.uid () = user_id);

-- ═════════════════════════════ Auto-create profile + starter rows ══════════
-- New auth users get a profile, five attributes at 0, and a zeroed streak.

create or replace function public.handle_new_user ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce (
      new.raw_user_meta_data ->> 'username',
      split_part (new.email, '@', 1),
      'Adventurer'
    )
  )
  on conflict (id) do nothing;

  insert into public.attributes (user_id, key)
  select new.id, k
  from unnest (array ['strength','intellect','vitality','creativity','focus']) as k
  on conflict (user_id, key) do nothing;

  insert into public.streaks (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user ();
