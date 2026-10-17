-- Read-only team attribution for the Versorgung overview.
-- No email address, patient data or additional activity history is exposed.
-- The case overview keeps security_invoker=true and returns only the assigned
-- technician already saved in the protected case payload.
create or replace view public.care_case_overview with (security_invoker=true) as
select
  c.id, c.created_at, c.updated_at, c.wizard_index, c.insurer,
  c.product_group, c.himi_id, c.himi, c.status, c.schema_version,
  c.payload->>'patientFirstName' as patient_first_name,
  c.payload->>'patientLastName' as patient_last_name,
  c.payload->>'patientName' as patient_name,
  c.payload->>'caseNumber' as case_number,
  c.payload->>'insuredNo' as insured_no,
  c.payload->>'caseKind' as case_kind,
  c.owner_user_id, c.last_modified_by,
  nullif(btrim(c.payload->>'assignedTechnician'),'') as assigned_technician
from public.care_cases c;

-- Existing Supabase Auth login aliases are the team's display labels:
-- mitarbeiter1 -> Mitarbeiter 1, etc. Other login names are never revealed.
-- Only approved active team members may read the staff-to-id mapping.
create or replace function public.care_team_labels()
returns table (user_id uuid, display_name text)
language sql stable security definer
set search_path = ''
as $function$
  select m.user_id,
    case when split_part(lower(u.email),'@',1) ~ '^mitarbeiter[0-9]{1,2}$'
      then 'Mitarbeiter ' || substring(split_part(lower(u.email),'@',1) from '[0-9]{1,2}$')
      else 'Teammitglied'
    end::text as display_name
  from app_private.app_members as m
  join auth.users as u on u.id=m.user_id
  where exists (
    select 1 from app_private.app_members as caller
    where caller.user_id=auth.uid() and caller.active=true
  );
$function$;

revoke all on function public.care_team_labels() from public;
revoke all on function public.care_team_labels() from anon;
grant execute on function public.care_team_labels() to authenticated;

comment on function public.care_team_labels() is
  'Team-interne Anzeigenamen ohne E-Mail: ausschließlich für freigegebene, angemeldete Teammitglieder.';
