-- UX redesign Phase 1/3: additive role + focus preferences.
-- Keeps legacy active_persona/work_mode intact for compatibility.

alter table public.user_profiles
  add column if not exists role_code text,
  add column if not exists focus_areas text[] not null default '{}';

update public.user_profiles
set role_code = case
  when work_mode = 'seller' or active_persona = 'seller' then 'seller'
  when work_mode = 'professional' or active_persona = 'office' then 'employee'
  when active_persona = 'student' then 'student'
  when active_persona = 'creator' then 'freelancer'
  else role_code
end
where role_code is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_profiles_role_code_check'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint user_profiles_role_code_check
      check (
        role_code is null
        or role_code in ('employee', 'seller', 'student', 'freelancer')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_profiles_focus_areas_check'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint user_profiles_focus_areas_check
      check (
        focus_areas <@ array['work', 'daily_life', 'finance', 'health', 'study']::text[]
      );
  end if;
end
$$;

comment on column public.user_profiles.role_code is
  'UX role used for onboarding/personalization: employee, seller, student, or freelancer. Legacy work_mode remains a compatibility projection.';

comment on column public.user_profiles.focus_areas is
  'User-selected onboarding focus areas. These configure suggestions and defaults; they do not replace the existing domain enum.';

grant update (role_code, focus_areas) on public.user_profiles to authenticated;
