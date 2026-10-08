revoke all on sequence app_private.care_case_archive_delete_log_id_seq
from public, anon, authenticated;

grant usage, select
on sequence app_private.care_case_archive_delete_log_id_seq
to service_role;
