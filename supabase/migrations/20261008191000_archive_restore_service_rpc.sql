-- Staged restore. This migration is NOT deployed without full synthetic R2 E2E.
-- A second BEFORE INSERT trigger runs alphabetically after trg_care_case_stamp.
-- It restores immutable provenance and retention metadata, only for a service
-- role restore transaction that originated in archive_restore_for_service.
create or replace function app_private.zz_archive_restore_preserve_metadata()
returns trigger language plpgsql
set search_path=pg_catalog,public,app_private
as $restore_trigger$
declare v jsonb;
begin
  if tg_op<>'INSERT'
     or (select auth.role()) is distinct from 'service_role'
     or nullif(current_setting('va.archive_restore_case_id',true),'') is distinct from new.id::text
  then
    return new;
  end if;
  v:=current_setting('va.archive_restore_meta',true)::jsonb;
  if v->>'owner_user_id' is distinct from new.owner_user_id::text then
    raise exception 'restore_owner_mismatch' using errcode='23514';
  end if;
  new.created_at:=(v->>'created_at')::timestamptz;
  new.owner_user_id:=(v->>'owner_user_id')::uuid;
  new.retention_basis:=v->>'retention_basis';
  new.retention_until:=(v->>'retention_until')::date;
  new.legal_hold:=coalesce((v->>'legal_hold')::boolean,false);
  new.completed_at:=(v->>'completed_at')::timestamptz;
  new.erasure_requested_at:=(v->>'erasure_requested_at')::timestamptz;
  return new;
end
$restore_trigger$;
drop trigger if exists zz_archive_restore_preserve_metadata on public.care_cases;
create trigger zz_archive_restore_preserve_metadata
before insert on public.care_cases
for each row execute function app_private.zz_archive_restore_preserve_metadata();

create or replace function public.archive_restore_for_service(
 p_actor_id uuid,p_care_case_id uuid,p_manifest jsonb
) returns jsonb
language plpgsql security definer
set search_path=pg_catalog,public,app_private
as $restore$
declare
  v_archive app_private.care_case_archives%rowtype;
  v_original public.care_cases%rowtype;
  v_meta jsonb;
  v_item jsonb;
  v_revisions jsonb;
  v_audits jsonb;
  v_now timestamptz:=clock_timestamp();
  v_count integer:=0;
begin
  if p_actor_id is null or p_care_case_id is null or p_manifest is null then
    raise exception 'restore_invalid_request' using errcode='22023';
  end if;
  if not exists(select 1 from app_private.app_members
                where user_id=p_actor_id and active=true) then
    raise exception 'restore_actor_not_allowed' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_care_case_id::text,712431));
  select * into v_archive from app_private.care_case_archives
    where care_case_id=p_care_case_id for update;
  if not found or v_archive.status <> 'READY'
    or v_archive.verification_status <> 'VERIFIED' then
    raise exception 'restore_archive_not_verified' using errcode='23514';
  end if;
  if exists(select 1 from public.care_cases where id=p_care_case_id) then
    raise exception 'restore_case_already_active' using errcode='23514';
  end if;
  if p_manifest->>'manifest_version' <> '1'
    or p_manifest->>'archive_id' is distinct from v_archive.archive_id::text
    or p_manifest #>> '{care_case,id}' is distinct from p_care_case_id::text
    or p_manifest #>> '{care_case,owner_user_id}' is distinct from v_archive.owner_user_id::text
    then raise exception 'restore_manifest_identity_mismatch' using errcode='23514';
  end if;
  if jsonb_typeof(p_manifest->'revisions') <> 'array'
    or jsonb_typeof(p_manifest->'audit') <> 'array'
    or jsonb_typeof(p_manifest->'files') <> 'array' then
    raise exception 'restore_manifest_arrays_required' using errcode='23514';
  end if;
  v_revisions:=p_manifest->'revisions';
  v_audits:=p_manifest->'audit';
  if jsonb_array_length(v_revisions)>3000 or jsonb_array_length(v_audits)>15000
    or jsonb_array_length(p_manifest->'files')>14 then
    raise exception 'restore_manifest_too_large' using errcode='23514';
  end if;
  v_original := jsonb_populate_record(null::public.care_cases,p_manifest->'care_case');
  if v_original.id is distinct from p_care_case_id
     or v_original.owner_user_id is distinct from v_archive.owner_user_id then
    raise exception 'restore_case_identity_mismatch' using errcode='23514';
  end if;
  v_meta:=jsonb_build_object(
    'owner_user_id',v_original.owner_user_id,
    'created_at',v_original.created_at,
    'retention_basis',v_original.retention_basis,
    'retention_until',v_archive.retention_until,
    'legal_hold',v_archive.legal_hold,
    'completed_at',v_archive.completed_at,
    'erasure_requested_at',v_original.erasure_requested_at
  );
  perform set_config('va.archive_restore_case_id',p_care_case_id::text,true);
  perform set_config('va.archive_restore_meta',v_meta::text,true);

  insert into public.care_cases(
    id,owner_user_id,created_at,wizard_index,insurer,product_group,
    himi_id,himi,status,payload,schema_version,last_modified_by
  ) values (
    p_care_case_id,v_original.owner_user_id,v_original.created_at,
    v_original.wizard_index,v_original.insurer,v_original.product_group,
    v_original.himi_id,v_original.himi,
    case when v_original.status='Abgeschlossen' then 'Abschluss offen' else v_original.status end,
    coalesce(v_original.payload,'{}'::jsonb)
      || jsonb_build_object('archiveRestoredAt',v_now),
    v_original.schema_version,p_actor_id
  );
  -- INSERT triggers create a temporary restore entry; replace with the original
  -- signed revision/audit history and explicitly record the restoration.
  delete from app_private.care_case_revisions where care_case_id=p_care_case_id;
  delete from app_private.care_case_audit where care_case_id=p_care_case_id;
  for v_item in select value from jsonb_array_elements(v_revisions) as t(value) loop
    if v_item->>'care_case_id' is distinct from p_care_case_id::text then
      raise exception 'restore_revision_identity_mismatch' using errcode='23514';
    end if;
    insert into app_private.care_case_revisions(
      care_case_id,revision_no,captured_at,actor_user_id,status,
      wizard_index,payload,row_snapshot
    ) values (
      p_care_case_id,(v_item->>'revision_no')::integer,
      (v_item->>'captured_at')::timestamptz,
      (v_item->>'actor_user_id')::uuid,v_item->>'status',
      (v_item->>'wizard_index')::integer,
      coalesce(v_item->'payload','{}'::jsonb),
      v_item->'row_snapshot'
    );
    v_count:=v_count+1;
  end loop;
  for v_item in select value from jsonb_array_elements(v_audits) as t(value) loop
    if v_item->>'care_case_id' is distinct from p_care_case_id::text then
      raise exception 'restore_audit_identity_mismatch' using errcode='23514';
    end if;
    insert into app_private.care_case_audit(
      care_case_id,occurred_at,actor_user_id,action,
      status_before,status_after,changed_fields
    ) values (
      p_care_case_id,(v_item->>'occurred_at')::timestamptz,
      (v_item->>'actor_user_id')::uuid,v_item->>'action',
      v_item->>'status_before',v_item->>'status_after',
      array(select jsonb_array_elements_text(coalesce(v_item->'changed_fields','[]'::jsonb)))
    );
  end loop;
  insert into app_private.care_case_audit(
    care_case_id,occurred_at,actor_user_id,action,status_before,status_after,changed_fields
  ) values (
    p_care_case_id,v_now,p_actor_id,'INSERT','ARCHIVED',
    case when v_original.status='Abgeschlossen' then 'Abschluss offen' else v_original.status end,
    array['archive_restore']
  );
  update app_private.care_case_archives set
    status='RESTORED',restored_at=v_now,restored_by=p_actor_id,
    cleanup_error=null
  where archive_id=v_archive.archive_id;
  return jsonb_build_object('ok',true,'care_case_id',p_care_case_id,
    'archive_id',v_archive.archive_id,'restored_at',v_now,'revision_count',v_count);
end
$restore$;
revoke all on function public.archive_restore_for_service(uuid,uuid,jsonb)
 from public,anon,authenticated;
grant execute on function public.archive_restore_for_service(uuid,uuid,jsonb)
 to service_role;
