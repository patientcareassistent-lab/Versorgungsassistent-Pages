create or replace function app_private.is_pre_mfa_member()
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'app_private'
as $function$
  select
    auth.uid() is not null
    and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
    and exists (
      select 1
      from app_private.app_members m
      where m.user_id=auth.uid()
        and m.active=true
    );
$function$;

revoke all on function app_private.is_pre_mfa_member() from public, anon;
grant execute on function app_private.is_pre_mfa_member() to authenticated;

create or replace function public.mfa_enrollment_access()
returns boolean
language sql
stable
set search_path to 'pg_catalog', 'app_private'
as $function$
  select app_private.is_pre_mfa_member();
$function$;

revoke all on function public.mfa_enrollment_access() from public, anon;
grant execute on function public.mfa_enrollment_access() to authenticated;
