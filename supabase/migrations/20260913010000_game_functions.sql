-- ═══════════════════════════════════════════════════════════════════════════
-- Life RPG — game engine: shop catalog + atomic game functions
-- All progression math lives here (and only here). The API layer merely calls
-- these functions; the client can never dictate XP, gold, or prices.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────── shop_items catalog ────
create table if not exists public.shop_items (
  key          text primary key,
  name         text not null,
  kind         text not null check (kind in ('theme','title','relic')),
  price        integer not null check (price >= 0),
  description  text not null default '',
  icon         text not null default '✨'
);

alter table public.shop_items enable row level security;

drop policy if exists "shop_items_public_read" on public.shop_items;
create policy "shop_items_public_read" on public.shop_items
  for select using (true);

insert into public.shop_items (key, name, kind, price, description, icon) values
  ('theme-crimson',  'Crimson Oath',            'theme', 120, 'Blood-pact crimson accents for a war-forged soul.', '🗡️'),
  ('theme-verdant',  'Verdant Whispers',        'theme', 120, 'Druid-green glow, the color of growing things.',    '🌿'),
  ('theme-arcane',   'Arcane Depths',           'theme', 200, 'Void-purple sorcery for those who bend reality.',   '🔮'),
  ('theme-dawn',     'Dawnbringer',             'theme', 200, 'Radiant gold and white, light made tangible.',      '🌅'),
  ('title-nightowl', 'Title: "The Night Owl"',  'title',  80, 'For quests completed when sane people sleep.',      '🦉'),
  ('title-unbroken', 'Title: "The Unbroken"',   'title', 150, 'Wear it when your streak refuses to die.',          '🛡️'),
  ('title-ironbound','Title: "Ironbound"',      'title', 150, 'Forged in discipline, quenched in sweat.',          '⚙️'),
  ('relic-compass',  "Wayfinder's Compass",     'relic',  90, 'It always points at your next quest.',              '🧭'),
  ('relic-tome',     'Endless Tome',            'relic', 140, 'A book that grows one page per day you show up.',   '📖'),
  ('relic-flask',    'Everfull Flask',          'relic', 140, 'Bottomless stamina in a bottle.',                   '⚗️'),
  ('relic-crown',    'Crown of Small Wins',     'relic', 300, 'The rarest treasure: proof you kept going.',        '👑')
on conflict (key) do nothing;

-- ─────────────────────────────────────────────── shared helper functions ───

create or replace function public._difficulty_xp (p_difficulty text)
returns integer language sql immutable as $$
  select case p_difficulty
    when 'rare' then 25
    when 'epic' then 50
    when 'legendary' then 100
    else 10
  end;
$$;

create or replace function public._difficulty_gold (p_difficulty text)
returns integer language sql immutable as $$
  select case p_difficulty
    when 'rare' then 12
    when 'epic' then 25
    when 'legendary' then 50
    else 5
  end;
$$;

-- XP needed to advance FROM a level to the next (must match src/lib/progression.ts)
create or replace function public._xp_for_level (p_level integer)
returns integer language sql immutable as $$
  select round(100 * power(p_level, 1.5))::integer;
$$;

-- Attribute-level curve (must match src/lib/progression.ts)
create or replace function public._attr_xp_for_level (p_level integer)
returns integer language sql immutable as $$
  select round(40 * power(p_level, 1.35))::integer;
$$;

create or replace function public._title_for_level (p_level integer)
returns text language sql immutable as $$
  select case
    when p_level >= 40 then 'Mythic Sovereign'
    when p_level >= 30 then 'Dragonkin'
    when p_level >= 25 then 'Archmage'
    when p_level >= 20 then 'Champion'
    when p_level >= 15 then 'Warlord'
    when p_level >= 10 then 'Knight-Captain'
    when p_level >= 7  then 'Adept'
    when p_level >= 4  then 'Squire'
    else 'Wanderer'
  end;
$$;

-- ═══════════════════════════════ complete_quest ═════════════════════════════
-- Atomically: mark quest done, award XP (with streak bonus), award gold,
-- advance the matching attribute, update the streak, log a transaction.
-- Returns a JSON payload for the UI (level-up flags included).

create or replace function public.complete_quest (p_quest_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user        uuid := auth.uid ();
  v_quest       public.quests%rowtype;
  v_profile     public.profiles%rowtype;
  v_streak      public.streaks%rowtype;
  v_attr        public.attributes%rowtype;
  v_today       date := (current_timestamp at time zone 'utc')::date;
  v_base_xp     integer;
  v_bonus_xp    integer;
  v_gold        integer;
  v_total_xp    integer;
  v_levels_from integer;
  v_levels_to   integer;
  v_attr_before integer;
  v_streak_kind text;
  v_result      json;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  -- Lock the quest row; ensure ownership + not already completed.
  select * into v_quest
  from public.quests
  where id = p_quest_id and user_id = v_user
  for update;

  if not found then
    raise exception 'QUEST_NOT_FOUND';
  end if;
  if v_quest.completed then
    raise exception 'ALREADY_COMPLETED';
  end if;

  -- Lock profile + streak + attribute rows for the whole computation.
  select * into v_profile from public.profiles where id = v_user for update;
  select * into v_streak  from public.streaks  where user_id = v_user for update;

  select * into v_attr
  from public.attributes
  where user_id = v_user and key = v_quest.category
  for update;

  if not found then
    insert into public.attributes (user_id, key) values (v_user, v_quest.category)
    returning * into v_attr;
  end if;

  -- ── Rewards ────────────────────────────────────────────────────────────
  v_base_xp  := public._difficulty_xp (v_quest.difficulty);
  v_bonus_xp := least (50, v_streak.current * 2);           -- +2%/day, cap 50%
  v_total_xp := v_base_xp + round (v_base_xp * v_bonus_xp / 100.0)::integer;
  v_gold     := public._difficulty_gold (v_quest.difficulty);

  -- ── Streak ─────────────────────────────────────────────────────────────
  v_streak_kind := 'already-counted';
  if v_streak.last_active_date is null then
    v_streak.current := 1;
    v_streak.best    := greatest (v_streak.best, 1);
    v_streak_kind    := 'started';
  elsif v_streak.last_active_date = v_today then
    null; -- already counted today
  elsif v_streak.last_active_date = v_today - 1 then
    v_streak.current := v_streak.current + 1;
    v_streak.best    := greatest (v_streak.best, v_streak.current);
    v_streak_kind    := 'continued';
  else
    v_streak.current := 1; -- gap: reset
    v_streak.best    := greatest (v_streak.best, 1);
    v_streak_kind    := 'started';
  end if;
  v_streak.last_active_date := v_today;

  update public.streaks
  set current = v_streak.current,
      best = v_streak.best,
      last_active_date = v_streak.last_active_date
  where user_id = v_user;

  -- ── Character level (non-linear curve, carry overflow) ─────────────────
  v_levels_from := v_profile.level;
  v_total_xp    := v_profile.total_xp + v_total_xp;

  declare
    v_level integer := v_profile.level;
    v_xp    integer := v_profile.xp + v_total_xp - v_profile.total_xp; -- gained
  begin
    while v_level < 60 and v_xp >= public._xp_for_level (v_level) loop
      v_xp := v_xp - public._xp_for_level (v_level);
      v_level := v_level + 1;
    end loop;
    if v_level >= 60 then
      v_level := 60;
      v_xp := least (v_xp, public._xp_for_level (60));
    end if;
    v_levels_to := v_level;

    update public.profiles
    set level = v_level,
        xp = v_xp,
        total_xp = v_total_xp,
        gold = v_profile.gold + v_gold,
        title = public._title_for_level (v_level)
    where id = v_user
    returning * into v_profile;
  end;

  -- ── Attribute progression ──────────────────────────────────────────────
  v_attr_before := v_attr.level;
  declare
    v_level integer := v_attr.level;
    v_xp    integer := v_attr.xp + v_base_xp; -- attributes gain the base xp
  begin
    while v_xp >= public._attr_xp_for_level (v_level) loop
      v_xp := v_xp - public._attr_xp_for_level (v_level);
      v_level := v_level + 1;
    end loop;

    update public.attributes
    set level = v_level, xp = v_xp
    where user_id = v_user and key = v_quest.category
    returning level into v_attr.level;
  end;

  -- ── Quest + ledger ─────────────────────────────────────────────────────
  update public.quests
  set completed = true, completed_at = now()
  where id = p_quest_id
  returning * into v_quest;

  insert into public.transactions (user_id, kind, amount, reason)
  values (v_user, 'earn', v_gold,
          format ('Completed "%s" (%s)', v_quest.title, v_quest.difficulty));

  v_result := json_build_object (
    'quest', to_jsonb (v_quest),
    'profile', to_jsonb (v_profile),
    'xp_gained', v_base_xp + round (v_base_xp * v_bonus_xp / 100.0)::integer,
    'gold_gained', v_gold,
    'leveled_up', v_levels_to > v_levels_from,
    'levels_gained', v_levels_to - v_levels_from,
    'new_level', v_levels_to,
    'streak', to_jsonb (v_streak) || json_build_object ('kind', v_streak_kind),
    'attribute', json_build_object (
      'key', v_quest.category,
      'level', v_attr.level,
      'leveled_up', v_attr.level > v_attr_before
    )
  );

  return v_result;
end;
$$;

-- ═══════════════════════════════ purchase_item ══════════════════════════════
-- Atomically: verify price + funds, deduct gold, insert inventory row,
-- log a transaction. Idempotent against duplicate ownership via unique key.

create or replace function public.purchase_item (p_item_key text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid := auth.uid ();
  v_item   public.shop_items%rowtype;
  v_profile public.profiles%rowtype;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into v_item from public.shop_items where key = p_item_key;
  if not found then
    raise exception 'ITEM_NOT_FOUND';
  end if;

  if exists (
    select 1 from public.inventory
    where user_id = v_user and item_key = p_item_key
  ) then
    raise exception 'ALREADY_OWNED';
  end if;

  select * into v_profile from public.profiles where id = v_user for update;

  if v_profile.gold < v_item.price then
    raise exception 'INSUFFICIENT_GOLD';
  end if;

  update public.profiles
  set gold = gold - v_item.price
  where id = v_user
  returning * into v_profile;

  insert into public.inventory (user_id, item_key, equipped)
  values (v_user, p_item_key, false);

  insert into public.transactions (user_id, kind, amount, reason)
  values (v_user, 'spend', -v_item.price, format ('Purchased %s', v_item.name));

  return json_build_object (
    'profile', to_jsonb (v_profile),
    'item_key', p_item_key,
    'equipped', false
  );
end;
$$;

-- ═══════════════════════════════ equip_item ═════════════════════════════════
-- Equip a theme/title: exclusive within its kind. Relics are always "shown".

create or replace function public.equip_item (p_item_key text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid := auth.uid ();
  v_item   public.shop_items%rowtype;
  v_profile public.profiles%rowtype;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into v_item from public.shop_items where key = p_item_key;
  if not found then
    raise exception 'ITEM_NOT_FOUND';
  end if;

  if not exists (
    select 1 from public.inventory
    where user_id = v_user and item_key = p_item_key
  ) then
    raise exception 'NOT_OWNED';
  end if;

  if v_item.kind in ('theme', 'title') then
    -- Unequip everything of the same kind, then equip the chosen one.
    update public.inventory i
    set equipped = false
    where user_id = v_user
      and equipped = true
      and item_key in (select key from public.shop_items s where s.kind = v_item.kind);
  end if;

  update public.inventory
  set equipped = true
  where user_id = v_user and item_key = p_item_key;

  if v_item.kind = 'theme' then
    update public.profiles set avatar_theme = p_item_key where id = v_user;
  elsif v_item.kind = 'title' then
    update public.profiles set title = v_item.name where id = v_user;
  end if;

  select * into v_profile from public.profiles where id = v_user;

  return json_build_object ('profile', to_jsonb (v_profile), 'item_key', p_item_key);
end;
$$;

grant execute on function public.complete_quest (uuid)       to authenticated;
grant execute on function public.purchase_item (text)        to authenticated;
grant execute on function public.equip_item (text)           to authenticated;
