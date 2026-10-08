-- Effective in production as team_care_cases_and_repair_photos_mfa_20261008.
-- MFA-approved staff have full shared edit rights for the same care cases.
-- Keep original creator; app_private.care_case_stamp enforces owner immutability.
drop policy if exists care_cases_update_own_mfa on public.care_cases;
drop policy if exists care_cases_update_team_mfa on public.care_cases;
create policy care_cases_update_team_mfa on public.care_cases
for update to authenticated
using (
  coalesce((select auth.jwt())->>'aal','aal1')='aal2'
  and coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false)=false
  and exists (
    select 1 from app_private.app_members m
    where m.user_id=(select auth.uid()) and m.active=true
  )
)
with check (
  coalesce((select auth.jwt())->>'aal','aal1')='aal2'
  and coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false)=false
  and exists (
    select 1 from app_private.app_members m
    where m.user_id=(select auth.uid()) and m.active=true
  )
);

drop policy if exists repair_photos_insert_own on storage.objects;
drop policy if exists repair_photos_delete_own on storage.objects;
drop policy if exists repair_photos_insert_team on storage.objects;
drop policy if exists repair_photos_delete_team on storage.objects;

create policy repair_photos_insert_team on storage.objects
for insert to authenticated
with check (
  bucket_id='repair-photos-private'
  and coalesce((select auth.jwt())->>'aal','aal1')='aal2'
  and coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false)=false
  and exists (select 1 from app_private.app_members m
              where m.user_id=(select auth.uid()) and m.active=true)
  and exists (select 1 from public.care_cases c
              where c.id::text=(storage.foldername(name))[2]
                and c.owner_user_id::text=(storage.foldername(name))[1])
);
create policy repair_photos_delete_team on storage.objects
for delete to authenticated
using (
  bucket_id='repair-photos-private'
  and coalesce((select auth.jwt())->>'aal','aal1')='aal2'
  and coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false)=false
  and exists (select 1 from app_private.app_members m
              where m.user_id=(select auth.uid()) and m.active=true)
  and exists (select 1 from public.care_cases c
              where c.id::text=(storage.foldername(name))[2]
                and c.owner_user_id::text=(storage.foldername(name))[1])
);
