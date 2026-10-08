create table if not exists app_private.care_case_archive_delete_log (
  id bigint generated always as identity primary key,
  care_case_id uuid not null,
  archive_id uuid not null,
  executed_by uuid not null,
  executed_at timestamptz not null default now(),
  deleted_objects integer not null check (deleted_objects >= 1 and deleted_objects <= 15),
  note text not null check (char_length(btrim(note)) between 12 and 500)
);

alter table app_private.care_case_archive_delete_log enable row level security;

revoke all on table app_private.care_case_archive_delete_log from public, anon, authenticated;
grant all on table app_private.care_case_archive_delete_log to service_role;

drop policy if exists deny_all_frontend on app_private.care_case_archive_delete_log;
create policy deny_all_frontend
on app_private.care_case_archive_delete_log
for all
to public
using (false)
with check (false);

create index if not exists care_case_archive_delete_log_case_idx
on app_private.care_case_archive_delete_log(care_case_id, executed_at desc);
