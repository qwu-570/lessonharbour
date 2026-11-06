-- LessonHarbour Supabase schema. The application accesses these tables only
-- from its authenticated server routes with a secret server key.

create table if not exists public.users (
  id text primary key,
  email text not null,
  display_name text not null,
  role text not null check (role in ('student', 'tutor')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tutor_profiles (
  user_id text primary key references public.users(id) on delete cascade,
  subject text not null,
  subjects jsonb not null default '[]'::jsonb,
  bio text not null,
  bio_en text,
  bio_zh text,
  hourly_price integer not null check (hourly_price >= 0),
  lesson_format text not null check (lesson_format in ('online', 'in_person', 'both')),
  general_location text,
  postcode text,
  profile_photo_url text,
  languages jsonb not null default '[]'::jsonb,
  calendar_feed_token text unique,
  is_published boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.student_profiles (
  user_id text primary key references public.users(id) on delete cascade,
  student_name text not null,
  postcode text not null,
  subjects jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id text primary key,
  student_id text not null references public.users(id) on delete cascade,
  tutor_id text not null references public.users(id) on delete cascade,
  sender_id text not null references public.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists messages_student_tutor_created_idx
  on public.messages(student_id, tutor_id, created_at);

create table if not exists public.availability_slots (
  id text primary key,
  tutor_id text not null references public.users(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint availability_time_order check (ends_at > starts_at),
  constraint slots_tutor_start_unique unique (tutor_id, starts_at)
);

create table if not exists public.bookings (
  id text primary key,
  slot_id text not null unique references public.availability_slots(id) on delete restrict,
  student_id text not null references public.users(id) on delete cascade,
  tutor_id text not null references public.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  cancelled_by text references public.users(id) on delete set null,
  cancellation_reason text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bookings_student_idx on public.bookings(student_id);
create index if not exists bookings_tutor_idx on public.bookings(tutor_id);

create table if not exists public.rate_limits (
  key text not null,
  window_start bigint not null,
  count integer not null default 1,
  primary key (key, window_start)
);

-- Public/anonymous API keys receive no table access. Server-side secret keys
-- bypass these policies, while RLS remains enabled as a defence in depth.
alter table public.users enable row level security;
alter table public.tutor_profiles enable row level security;
alter table public.student_profiles enable row level security;
alter table public.messages enable row level security;
alter table public.availability_slots enable row level security;
alter table public.bookings enable row level security;
alter table public.rate_limits enable row level security;

revoke all on all tables in schema public from anon, authenticated;

create or replace function public.increment_rate_limit(
  p_key text,
  p_window_start bigint
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare new_count integer;
begin
  insert into public.rate_limits(key, window_start, count)
  values (p_key, p_window_start, 1)
  on conflict (key, window_start)
  do update set count = public.rate_limits.count + 1
  returning count into new_count;
  return new_count;
end;
$$;

revoke all on function public.increment_rate_limit(text, bigint) from public, anon, authenticated;
grant execute on function public.increment_rate_limit(text, bigint) to service_role;
