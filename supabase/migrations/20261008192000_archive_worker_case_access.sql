-- Staged R2 Worker authorization. The Worker forwards the user's verified
-- bearer JWT and publishable key to this controlled PostgREST RPC.
-- Direct R2 DELETE is intentionally forbidden in the Worker.
create or replace function public.archive_worker_access(
  p_care_case_id uuid,p_archive_id uuid,p_action text
) returns boolean
language plpgsql stable security definer
set search_path=pg_catalog,app_private,public
as $worker_access$
declare
  v_actor uuid:=(select auth.uid());
  v_idx app_private.care_case_archives%rowtype;
begin
  if v_actor is null or p_care_case_id is null or p_archive_id is null
      or p_action not in ('read','write') then return false; end if;
  if coalesce((select auth.jwt())->>'aal','aal1') <> 'aal2'
    or coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false)
    then return false;
  end if;
  if not exists(select 1 from app_private.app_members m
    where m.user_id=v_actor and m.active=true) then return false; end if;
  select * into v_idx from app_private.care_case_archives a
    where a.care_case_id=p_care_case_id and a.archive_id=p_archive_id;
  if not found then return false; end if;
  if p_action='read' then
    return v_idx.status in ('READY','RESTORED')
      or (v_idx.status='PENDING' and v_idx.archived_by=v_actor);
  end if;
  -- Only the authorized archivist may upload to their PENDING reservation.
  -- READY, RESTORED and FAILED archives are immutable.
  return v_idx.status='PENDING'
    and v_idx.archived_by=v_actor
    and exists(select 1 from public.care_cases c where c.id=p_care_case_id);
end
$worker_access$;

revoke all on function public.archive_worker_access(uuid,uuid,text)
 from public,anon,authenticated;
grant execute on function public.archive_worker_access(uuid,uuid,text)
 to authenticated;
