-- Applied to production as grant_authenticated_care_case_dml_mfa_rls_20261008.
-- RLS still requires MFA AAL2 and an active member in app_private.app_members.
grant select, insert, update on table public.care_cases to authenticated;
revoke delete, truncate, references, trigger on table public.care_cases from authenticated, anon;
revoke all on table public.care_cases from anon;
