alter table public.tutor_profiles
  add column if not exists subjects jsonb not null default '[]'::jsonb;

update public.tutor_profiles
set subjects = jsonb_build_array(subject)
where subjects = '[]'::jsonb and subject is not null and subject <> '';

create index if not exists tutor_profiles_subjects_gin_idx
  on public.tutor_profiles using gin(subjects);
