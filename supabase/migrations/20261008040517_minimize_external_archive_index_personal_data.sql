alter table app_private.care_case_archives
  drop column if exists case_number,
  drop column if exists patient_first_name,
  drop column if exists patient_last_name,
  drop column if exists insurer,
  drop column if exists product_group,
  drop column if exists himi;
