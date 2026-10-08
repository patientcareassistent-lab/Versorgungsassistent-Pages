-- Server-only, read-only archive context for authorized Edge Functions.
-- Deployed 2026-10-08 as migration archive_service_read_context_20261008.
-- The Edge Function MUST first verify the bearer token with auth.getUser
-- and verify the token's aal2 (MFA) and non-anonymous claims.
create or replace function public.archive_context_for_service(
  p_actor_id uuid,
  p_care_case_id uuid,
  p_require_admin boolean default false,
  p_include_history boolean default false
)
returns jsonb
language plpgsql stable security definer
set search_path = pg_catalog, app_private, public
as $archive_context$
declare
  v_role text;
  v_case jsonb;
  v_archive jsonb;
  v_revisions jsonb := '[]'::jsonb;
  v_audit jsonb := '[]'::jsonb;
begin
  if p_actor_id is null or p_care_case_id is null then
    raise exception 'archive_bad_identity' using errcode='22023';
  end if;
  select m.role into v_role
    from app_private.app_members m
   where m.user_id=p_actor_id and m.active is true;
  if not found then
    raise exception 'archive_actor_not_allowed' using errcode='42501';
  end if;
  if p_require_admin and v_role is distinct from 'admin' then
    raise exception 'archive_admin_required' using errcode='42501';
  end if;

  select to_jsonb(c) into v_case from public.care_cases c
    where c.id=p_care_case_id;
  select to_jsonb(a) into v_archive from app_private.care_case_archives a
    where a.care_case_id=p_care_case_id;

  if p_include_history then
    select coalesce(jsonb_agg(to_jsonb(r) order by r.revision_no),'[]'::jsonb)
      into v_revisions from app_private.care_case_revisions r
      where r.care_case_id=p_care_case_id;
    select coalesce(jsonb_agg(to_jsonb(a) order by a.occurred_at,a.id),'[]'::jsonb)
      into v_audit from app_private.care_case_audit a
      where a.care_case_id=p_care_case_id;
  end if;
  return jsonb_build_object(
    'member_role',v_role,
    'care_case',v_case,
    'archive',v_archive,
    'revisions',v_revisions,
    'audit',v_audit
  );
end
$archive_context$;

revoke all on function public.archive_context_for_service(uuid,uuid,boolean,boolean)
  from public, anon, authenticated;
grant execute on function public.archive_context_for_service(uuid,uuid,boolean,boolean)
  to service_role;
