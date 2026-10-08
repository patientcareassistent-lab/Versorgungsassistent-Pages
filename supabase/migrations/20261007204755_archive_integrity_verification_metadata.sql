alter table app_private.care_case_archives
  add column if not exists verification_status text not null default 'UNVERIFIED',
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid,
  add column if not exists verification_error text;

alter table app_private.care_case_archives
  drop constraint if exists care_case_archives_verification_status_check,
  add constraint care_case_archives_verification_status_check
    check (verification_status in ('UNVERIFIED','VERIFIED','FAILED'));

alter table app_private.care_case_archives
  drop constraint if exists care_case_archives_verification_integrity_check,
  add constraint care_case_archives_verification_integrity_check
    check (
      (verification_status='VERIFIED' and verified_at is not null and verified_by is not null and verification_error is null)
      or (verification_status='FAILED' and verification_error is not null)
      or (verification_status='UNVERIFIED')
    );

create index if not exists care_case_archives_verification_idx
on app_private.care_case_archives (verification_status, archived_at desc);
