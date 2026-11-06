-- Upgrade projects that already had the early LessonHarbour tables.
alter table public.tutor_profiles add column if not exists bio_en text;
alter table public.tutor_profiles add column if not exists bio_zh text;
alter table public.tutor_profiles add column if not exists profile_photo_url text;
alter table public.tutor_profiles add column if not exists languages jsonb not null default '[]'::jsonb;
alter table public.tutor_profiles add column if not exists calendar_feed_token text;
alter table public.tutor_profiles add column if not exists is_published boolean not null default false;

alter table public.bookings add column if not exists cancelled_by text references public.users(id) on delete set null;
alter table public.bookings add column if not exists cancellation_reason text;
alter table public.bookings add column if not exists cancelled_at timestamptz;

create unique index if not exists tutor_profiles_calendar_feed_token_unique
  on public.tutor_profiles(calendar_feed_token)
  where calendar_feed_token is not null;
