-- Service-only RPC for archive overview. Do not expose app_private in the REST API.
-- The Edge Function authenticates the actor and enforces MFA (aal2).
create or replace function public.archive_overview_for_service(p_actor_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, app_private
as $body$
declare
  result jsonb;
begin
  if p_actor_id is null or not exists (
    select 1 from app_private.app_members m
    where m.user_id = p_actor_id and m.active is true
  ) then
    raise exception 'archive_actor_not_allowed' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.archived_at desc), '[]'::jsonb)
  into result
  from (
    select
      a.care_case_id, a.archived_at, a.archived_by, a.owner_user_id,
      a.case_number, a.patient_first_name, a.patient_last_name,
      a.insurer, a.product_group, a.himi, a.archive_bytes,
      a.photo_count, a.revision_count, a.status, a.retention_until,
      a.legal_hold, a.verification_status, a.source_purged_at,
      a.cleanup_error, a.restored_at
    from app_private.care_case_archives a
    where a.status in ('READY','RESTORED')
    order by a.archived_at desc
    limit 250
  ) r;
  return result;
end
$body$;

revoke all on function public.archive_overview_for_service(uuid)
  from public, anon, authenticated;
grant execute on function public.archive_overview_for_service(uuid)
  to service_role;
