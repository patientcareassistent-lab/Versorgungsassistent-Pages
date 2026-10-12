-- Records the temporary production MFA suspension applied on 2026-10-12.
-- Password authentication, non-anonymous sessions, active member allowlist and RLS remain mandatory.
-- Re-enable the AAL2 condition in a separate reviewed migration when MFA is reinstated.
create or replace function app_private.is_approved_member()
returns boolean
language sql stable security definer
set search_path to 'pg_catalog', 'app_private'
as $fn$
  select auth.uid() is not null
    and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
    and exists(select 1 from app_private.app_members m
               where m.user_id=auth.uid() and m.active=true);
$fn$;

alter policy app_members_self_read on app_private.app_members
using (user_id=(select auth.uid()) and active=true
  and coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false)=false);

alter policy care_cases_select_team_mfa on public.care_cases
using (app_private.is_approved_member());

alter policy care_cases_update_team_mfa on public.care_cases
using (app_private.is_approved_member())
with check (app_private.is_approved_member());

alter policy care_cases_insert_own_mfa on public.care_cases
with check (owner_user_id=(select auth.uid()) and app_private.is_approved_member());
