-- Staged for review; not deployed by merely merging into GitHub.
-- Edge Functions must independently validate JWT with auth.getUser, AAL2,
-- is_anonymous=false and trusted origin before calling this service-only RPC.
-- The atomic completion deletes the active copy ONLY once the archive manifest
-- has been uploaded and read back with matching SHA-256 and size.
create or replace function public.archive_mutation_for_service(
  p_actor_id uuid, p_care_case_id uuid, p_action text,
  p_data jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, app_private
as $archive_mutation$
declare
  v_role text;
  v_case public.care_cases%rowtype;
  v_idx app_private.care_case_archives%rowtype;
  v_key text;
  v_hash text;
  v_bytes bigint;
  v_photos integer;
  v_revisions integer;
  v_now timestamptz := clock_timestamp();
  v_updated timestamptz;
  v_error text;
begin
  if p_actor_id is null or p_care_case_id is null then
    raise exception 'missing_archive_actor_or_case' using errcode='22023';
  end if;
  if p_action not in ('reserve','complete','cleanup','verify','delete_begin','delete_finalize','delete_fail') then
    raise exception 'unsupported_archive_action' using errcode='22023';
  end if;
  select m.role into v_role
    from app_private.app_members m
   where m.user_id=p_actor_id and m.active=true;
  if not found then
    raise exception 'archive_actor_not_allowed' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_care_case_id::text, 712431));

  select * into v_idx from app_private.care_case_archives
    where care_case_id=p_care_case_id for update;
  if p_action='reserve' then
    select * into v_case from public.care_cases
      where id=p_care_case_id for update;
    if not found then
      raise exception 'archive_care_case_not_found' using errcode='P0002';
    end if;
    if v_case.status is distinct from 'Abschluss offen'
       or v_case.wizard_index < 9 then
      raise exception 'archive_case_incomplete' using errcode='23514';
    end if;
    if v_idx.archive_id is null then
      insert into app_private.care_case_archives(
        care_case_id,archived_by,owner_user_id,archived_at,
        status,verification_status,retention_until,legal_hold,completed_at
      ) values (
        p_care_case_id,p_actor_id,v_case.owner_user_id,v_now,
        'PENDING','UNVERIFIED',v_case.retention_until,v_case.legal_hold,v_case.completed_at
      ) returning * into v_idx;
    elsif v_idx.status <> 'PENDING' then
      raise exception 'archive_reservation_not_pending' using errcode='23514';
    end if;
    return jsonb_build_object(
      'archive_id',v_idx.archive_id,
      'care_case_id',p_care_case_id,
      'owner_user_id',v_case.owner_user_id,
      'expected_updated_at',v_case.updated_at,
      'object_key','care-cases/'||p_care_case_id||'/'||v_idx.archive_id||'/versorgung.json.gz',
      'status',v_idx.status
    );
  end if;

  if v_idx.archive_id is null then
    raise exception 'archive_reservation_missing' using errcode='P0002';
  end if;
  if p_action in ('delete_begin','delete_finalize','delete_fail') then
    if v_role is distinct from 'admin' then
      raise exception 'archive_admin_required' using errcode='42501';
    end if;
    if v_idx.status<>'READY' then
      raise exception 'archive_not_ready' using errcode='23514';
    end if;
    if v_idx.verification_status<>'VERIFIED' and p_action<>'delete_fail' then
      raise exception 'archive_not_verified' using errcode='23514';
    end if;
    if v_idx.legal_hold or v_idx.retention_until is null
      or v_idx.retention_until>=current_date then
      raise exception 'archive_retention_or_legal_hold_blocks_deletion' using errcode='42501';
    end if;
    if exists(select 1 from public.care_cases c where c.id=p_care_case_id) then
      raise exception 'active_case_requires_separate_purge' using errcode='42501';
    end if;
    if p_action='delete_begin' then
      v_error:=nullif(btrim(coalesce(p_data->>'note','')),'');
      if length(coalesce(v_error,'')) not between 12 and 500 then
        raise exception 'deletion_documentation_required' using errcode='22023';
      end if;
      insert into app_private.care_case_archive_delete_log(
        care_case_id,archive_id,executed_by,deleted_objects,note
      ) values(p_care_case_id,v_idx.archive_id,p_actor_id,0,'INTENT: '||v_error);
      return jsonb_build_object('ok',true,'archive_id',v_idx.archive_id,
        'care_case_id',p_care_case_id,'delete_prepared',true);
    end if;
    if not exists (
      select 1 from app_private.care_case_archive_delete_log d
      where d.care_case_id=p_care_case_id
        and d.archive_id=v_idx.archive_id
        and d.executed_by=p_actor_id
        and d.note like 'INTENT:%'
        and d.executed_at>now()-interval '1 hour'
    ) then
      raise exception 'recent_deletion_intent_required' using errcode='23514';
    end if;
    if p_action='delete_fail' then
      v_error:=left(coalesce(p_data->>'error','archive_object_delete_failed'),500);
      update app_private.care_case_archive_delete_log d
      set note='FAILED: '||v_error
      where d.id=(
        select max(d2.id) from app_private.care_case_archive_delete_log d2
        where d2.care_case_id=p_care_case_id and d2.archive_id=v_idx.archive_id
          and d2.executed_by=p_actor_id and d2.note like 'INTENT:%'
      );
      if coalesce((p_data->>'external_objects_deleted')::boolean,false) then
        update app_private.care_case_archives set
          verification_status='FAILED',verification_error='Deletion partially completed; administrator reconciliation required.',
          verified_at=null,verified_by=null
        where archive_id=v_idx.archive_id;
      end if;
      return jsonb_build_object('ok',true,'archive_id',v_idx.archive_id,'delete_failed',true);
    end if;
    v_photos:=(p_data->>'deleted_objects')::integer;
    if v_photos is null or v_photos not between 1 and 15 then
      raise exception 'invalid_deleted_object_count' using errcode='22023';
    end if;
    update app_private.care_case_archive_delete_log d
    set deleted_objects=v_photos,note='COMPLETED: '||substring(d.note from 9)
    where d.id=(
      select max(d2.id) from app_private.care_case_archive_delete_log d2
      where d2.care_case_id=p_care_case_id and d2.archive_id=v_idx.archive_id
        and d2.executed_by=p_actor_id and d2.note like 'INTENT:%'
    );
    delete from app_private.care_case_archives where archive_id=v_idx.archive_id;
    return jsonb_build_object('ok',true,'archive_id',v_idx.archive_id,
      'care_case_id',p_care_case_id,'deleted_objects',v_photos);
  end if;

  if p_action='complete' then
    if v_idx.status<>'PENDING' then
      raise exception 'archive_not_pending' using errcode='23514';
    end if;
    select * into v_case from public.care_cases
      where id=p_care_case_id for update;
    if not found then
      raise exception 'active_case_missing_before_archive_commit' using errcode='23514';
    end if;
    if nullif(p_data->>'expected_updated_at','') is null then
      raise exception 'expected_updated_at_required' using errcode='22023';
    end if;
    v_updated := (p_data->>'expected_updated_at')::timestamptz;
    if v_case.updated_at is distinct from v_updated then
      raise exception 'active_case_modified_during_archive' using errcode='40001';
    end if;
    if v_case.status is distinct from 'Abschluss offen'
       or v_case.wizard_index < 9 then
      raise exception 'archive_case_incomplete' using errcode='23514';
    end if;
    v_key := p_data->>'object_key';
    if v_key is distinct from
       ('care-cases/'||p_care_case_id||'/'||v_idx.archive_id||'/versorgung.json.gz') then
      raise exception 'archive_object_key_mismatch' using errcode='23514';
    end if;
    v_hash := lower(coalesce(p_data->>'archive_sha256',''));
    if v_hash !~ '^[0-9a-f]{64}$' then
      raise exception 'archive_sha256_invalid' using errcode='22023';
    end if;
    v_bytes := (p_data->>'archive_bytes')::bigint;
    v_photos := (p_data->>'photo_count')::integer;
    v_revisions := (p_data->>'revision_count')::integer;
    if v_bytes<1 or v_bytes>67108864 or v_photos not between 0 and 14
       or v_revisions<0 then
      raise exception 'archive_size_or_counts_invalid' using errcode='23514';
    end if;
    if nullif(coalesce(p_data->>'object_readback_verified',''),'') is distinct from 'true' then
      raise exception 'archive_r2_readback_required' using errcode='23514';
    end if;
    update app_private.care_case_archives
      set archived_by=p_actor_id,
          owner_user_id=v_case.owner_user_id,
          status='READY', archived_at=v_now,
          object_key=v_key, archive_sha256=v_hash, archive_bytes=v_bytes,
          photo_count=v_photos, revision_count=v_revisions,
          verification_status='VERIFIED',verified_at=v_now,verified_by=p_actor_id,
          verification_error=null,error_message=null,
          retention_until=v_case.retention_until,
          legal_hold=v_case.legal_hold,completed_at=v_case.completed_at
      where archive_id=v_idx.archive_id;
    -- The active data and private history are removed in one DB transaction,
    -- after R2 objects were externally verified. Failure rolls everything back.
    delete from public.care_cases where id=p_care_case_id;
    delete from app_private.care_case_revisions where care_case_id=p_care_case_id;
    delete from app_private.care_case_audit where care_case_id=p_care_case_id;
    return jsonb_build_object('ok',true,'archive_id',v_idx.archive_id,
      'care_case_id',p_care_case_id,'status','READY');
  elsif p_action='cleanup' then
    if v_idx.status<>'READY' then
      raise exception 'archive_not_ready' using errcode='23514';
    end if;
    if exists (select 1 from public.care_cases where id=p_care_case_id) then
      raise exception 'active_case_not_purged' using errcode='23514';
    end if;
    v_error:=nullif(left(coalesce(p_data->>'cleanup_error',''),2000),'');
    update app_private.care_case_archives set
       source_purged_at=case when v_error is null then v_now else source_purged_at end,
       cleanup_error=v_error
     where archive_id=v_idx.archive_id;
    return jsonb_build_object('ok',v_error is null,'cleanup_complete',v_error is null);
  else
    if v_idx.status<>'READY' then
      raise exception 'archive_not_ready' using errcode='23514';
    end if;
    if p_data->>'result' not in ('VERIFIED','FAILED') then
      raise exception 'archive_verification_result_invalid' using errcode='22023';
    end if;
    v_error:=nullif(left(coalesce(p_data->>'verification_error',''),1000),'');
    if p_data->>'result'='FAILED' and v_error is null then
      raise exception 'archive_failure_reason_required' using errcode='22023';
    end if;
    update app_private.care_case_archives
      set verification_status=p_data->>'result',
          verified_at=case when p_data->>'result'='VERIFIED' then v_now else null end,
          verified_by=case when p_data->>'result'='VERIFIED' then p_actor_id else null end,
          verification_error=case when p_data->>'result'='FAILED' then v_error else null end
      where archive_id=v_idx.archive_id;
    return jsonb_build_object('ok',true,'verification_status',p_data->>'result');
  end if;
end
$archive_mutation$;
revoke all on function public.archive_mutation_for_service(uuid,uuid,text,jsonb)
from public, anon, authenticated;
grant execute on function public.archive_mutation_for_service(uuid,uuid,text,jsonb)
to service_role;
