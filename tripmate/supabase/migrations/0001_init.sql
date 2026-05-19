-- TripMate · 旅程伴侣  initial schema
--
-- Conventions
--   - All tables are RLS-enabled.
--   - Membership is the unit of authorization: you can only see/write a row
--     if you are a member of the trip it belongs to.
--   - Money is always stored as INTEGER cents (avoids floating-point error).
--   - All timestamps are timestamptz.
--
-- Order of creation:
--   profiles → trips → trip_members → expenses → expense_shares
--   → albums → photos → photo_likes
--   → discoveries → discovery_candidates
--   → travelogues
--
begin;

-- =============================================================================
-- Helpers
-- =============================================================================
create extension if not exists "pgcrypto";

-- generate a 6-char invite code (uppercase letters + digits, ambiguous chars removed)
create or replace function gen_invite_code() returns text language plpgsql as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- removed I, L, O, 0, 1
  out text := '';
  i int;
begin
  for i in 1..6 loop
    out := out || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return out;
end;
$$;

-- =============================================================================
-- profiles  (mirrors auth.users; created on signup via trigger)
-- =============================================================================
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
    values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email))
    on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- trips
-- =============================================================================
create table public.trips (
  id           uuid primary key default gen_random_uuid(),
  created_by   uuid not null references public.profiles(id) on delete cascade,
  title        text not null,
  destination  text,
  start_date   date,
  end_date     date,
  cover_url    text,
  invite_code  text unique not null default gen_invite_code(),
  currency     text not null default 'CNY',
  created_at   timestamptz not null default now()
);

create index trips_created_by_idx on public.trips(created_by);

-- =============================================================================
-- trip_members  (membership = authorization unit)
-- =============================================================================
create table public.trip_members (
  trip_id    uuid not null references public.trips(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       text not null default 'member' check (role in ('owner','member')),
  weight     int  not null default 1 check (weight > 0),
  joined_at  timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create index trip_members_user_idx on public.trip_members(user_id);

-- helper used by RLS policies
create or replace function public.is_trip_member(_trip uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.trip_members
                 where trip_id = _trip and user_id = _user);
$$;

-- =============================================================================
-- expenses + expense_shares  (bookkeeping)
--
--  amount_cents is the total paid (positive integer cents)
--  split_mode = 'equal' | 'weighted'
--  expense_shares.share_cents is what each user OWES for this expense.
--  Sum of share_cents for a given expense MUST equal amount_cents (server-enforced).
-- =============================================================================
create table public.expenses (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips(id) on delete cascade,
  payer_id     uuid not null references public.profiles(id),
  amount_cents bigint not null check (amount_cents > 0),
  currency     text not null default 'CNY',
  description  text,
  category     text,
  spent_at     timestamptz not null default now(),
  split_mode   text not null default 'equal' check (split_mode in ('equal','weighted')),
  created_by   uuid not null references public.profiles(id),
  created_at   timestamptz not null default now()
);

create index expenses_trip_idx on public.expenses(trip_id, spent_at desc);

create table public.expense_shares (
  expense_id   uuid not null references public.expenses(id) on delete cascade,
  user_id      uuid not null references public.profiles(id),
  share_cents  bigint not null check (share_cents >= 0),
  primary key (expense_id, user_id)
);

-- =============================================================================
-- albums + photos + photo_likes
-- =============================================================================
create table public.albums (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  title       text not null default '行程相册',
  created_at  timestamptz not null default now(),
  unique (trip_id) -- one default album per trip; future: allow multiple
);

create table public.photos (
  id           uuid primary key default gen_random_uuid(),
  album_id     uuid not null references public.albums(id) on delete cascade,
  trip_id      uuid not null references public.trips(id) on delete cascade,
  uploader_id  uuid not null references public.profiles(id),
  storage_path text not null,
  taken_at     timestamptz,                -- EXIF date if available
  width        int,
  height       int,
  caption      text,
  created_at   timestamptz not null default now()
);

create index photos_trip_taken_idx on public.photos(trip_id, taken_at desc nulls last, created_at desc);

create table public.photo_likes (
  photo_id uuid not null references public.photos(id) on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (photo_id, user_id)
);

-- =============================================================================
-- discoveries (Wizard runs) + candidates
-- =============================================================================
create table public.discoveries (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid references public.trips(id) on delete set null,
  created_by  uuid not null references public.profiles(id),
  inputs      jsonb not null,             -- the 5-step wizard answers
  status      text not null default 'pending' check (status in ('pending','running','done','error')),
  error       text,
  created_at  timestamptz not null default now(),
  finished_at timestamptz
);

create table public.discovery_candidates (
  id            uuid primary key default gen_random_uuid(),
  discovery_id  uuid not null references public.discoveries(id) on delete cascade,
  rank          int  not null,
  name          text not null,
  region        text,
  niche_level   int  check (niche_level between 1 and 5),
  risk_level    int  check (risk_level between 1 and 5),
  pitch         text,
  local_tips    text[],
  sources       jsonb,                    -- [{title, url}]
  budget_hint   text,
  created_at    timestamptz not null default now()
);

create index discoveries_creator_idx on public.discoveries(created_by, created_at desc);
create index candidates_discovery_idx on public.discovery_candidates(discovery_id, rank);

-- =============================================================================
-- travelogues  (AI 游记)
-- =============================================================================
create table public.travelogues (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  created_by  uuid not null references public.profiles(id),
  status      text not null default 'pending' check (status in ('pending','running','done','error')),
  error       text,
  -- structured: { intro: string, days: [{date, title, body, photo_ids[]}], outro: string }
  content     jsonb,
  photo_ids   uuid[] default '{}',
  created_at  timestamptz not null default now(),
  finished_at timestamptz
);

create index travelogues_trip_idx on public.travelogues(trip_id, created_at desc);

commit;
