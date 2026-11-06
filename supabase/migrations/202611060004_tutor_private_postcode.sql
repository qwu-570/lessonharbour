alter table public.tutor_profiles
  add column if not exists postcode text;

comment on column public.tutor_profiles.postcode is
  'Private UK postcode used for server-side distance matching; never returned by public tutor APIs.';
