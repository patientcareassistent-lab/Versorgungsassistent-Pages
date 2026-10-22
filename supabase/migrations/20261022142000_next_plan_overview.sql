-- Versorgungsübersicht: datensparsame Informationen zum nächsten Arbeitsschritt.
-- Spalten nur am Ende ergänzen; bestehende API-Clients bleiben kompatibel.
-- SECURITY INVOKER bewahrt bestehende RLS-Freigaben.
CREATE OR REPLACE VIEW public.care_case_overview WITH (security_invoker=true) AS
SELECT c.id, c.created_at, c.updated_at, c.wizard_index, c.insurer,
       c.product_group, c.himi_id, c.himi, c.status, c.schema_version,
       c.payload->>'patientFirstName' AS patient_first_name,
       c.payload->>'patientLastName' AS patient_last_name,
       c.payload->>'patientName' AS patient_name,
       c.payload->>'caseNumber' AS case_number,
       c.payload->>'insuredNo' AS insured_no,
       c.payload->>'caseKind' AS case_kind,
       c.owner_user_id, c.last_modified_by,
       NULLIF(btrim(c.payload->>'assignedTechnician'), '') AS assigned_technician,
       c.payload->'nextPlan'->>'goal' AS next_plan_goal,
       c.payload->'nextPlan'->>'mode' AS next_plan_mode,
       c.payload->'nextPlan'->>'date' AS next_plan_date,
       c.payload->'nextPlan'->>'week' AS next_plan_week,
       c.payload->'nextPlan'->>'time' AS next_plan_time,
       c.payload->'nextPlan'->>'note' AS next_plan_note
FROM public.care_cases c;
REVOKE ALL ON public.care_case_overview FROM PUBLIC, anon;
GRANT SELECT ON public.care_case_overview TO authenticated;
