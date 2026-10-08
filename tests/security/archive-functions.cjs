const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8')
}

const archive = read('supabase/functions/archive-care-case/index.ts')
const verify = read('supabase/functions/verify-care-case-archive/index.ts')
const remove = read('supabase/functions/delete-care-case-archive/index.ts')
const archiveList = read('supabase/functions/list-care-case-archives/index.ts')
const archiveListMigration = read('supabase/migrations/20261008151700_archive_overview_service_rpc.sql')

for (const [name, source] of [['archive', archive], ['verify', verify], ['delete', remove]]) {
  assert.match(source, /npm:@supabase\/supabase-js@2\.57\.4/, name + ': Supabase client must be pinned')
  assert.match(source, /aal[^\n]{0,80}aal2|aal2[^\n]{0,80}aal/, name + ': MFA/AAL2 gate missing')
  assert.match(source, /app_members/, name + ': active-member gate missing')
  assert.match(source, /origin_not_allowed/, name + ': origin gate missing')
  assert.match(source, /patientcareassistent-lab\.github\.io/, name + ': production origin missing')
  assert.doesNotMatch(source, /console\.(log|debug)\(/, name + ': debug logging is not allowed')
}

assert.match(archive, /versorgungsassistent-archive-gateway\.patientcare-assistent-archive\.workers\.dev/, 'archive: fixed archive gateway missing')
assert.doesNotMatch(archive, /access-control-allow-origin": "\*"/, 'archive: wildcard CORS is not allowed')
assert.match(archive, /only_owner_can_archive/, 'archive: owner-only gate missing')
assert.match(archive, /care_case_not_complete/, 'archive: completion gate missing')
assert.match(archive, /invalid_photo_path/, 'archive: photo path validation missing')
assert.match(archive, /verification_status:"VERIFIED"/, 'archive: verified gateway upload state missing')
assert.match(archive, /archive_sha256/, 'archive: checksum persistence missing')
assert.match(archive, /wizardIndex/, 'archive: final wizard position gate missing')
assert.match(archive, /patientFirstName/, 'archive: patient core-data gate missing')
assert.match(archive, /repairSicHimiId/, 'archive: repair completion gate missing')
assert.match(archive, /quotePositions/, 'archive: quote completion gate missing')
assert.doesNotMatch(archive, /missing\("billingState"\)|missing\("billingPosition"\)|missing\("billingVwkz"\)/, 'archive: v0.9 must not require hidden billing fields')
assert.match(archive, /Number\(row\.wizard_index\) < 9/, 'archive: v0.9 completion must use the last visible wizard step')
assert.doesNotMatch(archive, /patient_first_name|patient_last_name|case_number:/, 'archive: personal metadata must not be duplicated into the archive index')

assert.match(verify, /npm:@aws-sdk\/client-s3@3\.1147\.0/, 'verify: AWS SDK must be pinned')
assert.match(verify, /only_owner_can_verify/, 'verify: owner-only gate missing')
assert.match(verify, /archive_checksum_mismatch/, 'verify: main checksum gate missing')
assert.match(verify, /archive_file_checksum_mismatch/, 'verify: file checksum gate missing')
assert.match(verify, /verification_status:"VERIFIED"/, 'verify: verified state missing')

assert.match(remove, /npm:@aws-sdk\/client-s3@3\.1147\.0/, 'delete: AWS SDK must be pinned')
assert.match(remove, /admin_required/, 'delete: admin role gate missing')
assert.match(remove, /legal_hold_active/, 'delete: legal-hold gate missing')
assert.match(remove, /retention_not_due/, 'delete: retention gate missing')
assert.match(remove, /archive_not_verified/, 'delete: verified-archive gate missing')
assert.match(remove, /care_case_archive_delete_log/, 'delete: deletion audit log missing')


const preMfaMigration = read('supabase/migrations/20261007204438_move_pre_mfa_membership_privilege_to_private_helper.sql')
const verifyMigration = read('supabase/migrations/20261007204755_archive_integrity_verification_metadata.sql')
const deleteAuditMigration = read('supabase/migrations/20261007205226_archive_delete_audit_log.sql')
const sequenceGrantMigration = read('supabase/migrations/20261008040003_grant_archive_delete_log_identity_sequence_to_service_role.sql')

assert.match(preMfaMigration, /app_private\.is_pre_mfa_member/, 'migration: private pre-MFA helper missing')
assert.match(preMfaMigration, /security definer/i, 'migration: private pre-MFA helper must be security definer')
assert.match(preMfaMigration, /revoke all on function public\.mfa_enrollment_access\(\) from public, anon/i, 'migration: public pre-MFA RPC must deny anonymous execution')
assert.match(preMfaMigration, /grant execute on function public\.mfa_enrollment_access\(\) to authenticated/i, 'migration: authenticated pre-MFA RPC grant missing')

assert.match(verifyMigration, /UNVERIFIED.*VERIFIED.*FAILED/s, 'migration: verification states missing')
assert.match(verifyMigration, /verification_integrity_check/, 'migration: verification integrity constraint missing')

assert.match(deleteAuditMigration, /enable row level security/i, 'migration: archive delete audit RLS missing')
assert.match(deleteAuditMigration, /revoke all on table app_private\.care_case_archive_delete_log from public, anon, authenticated/i, 'migration: archive delete audit frontend revocation missing')
assert.match(deleteAuditMigration, /grant all on table app_private\.care_case_archive_delete_log to service_role/i, 'migration: archive delete audit service-role grant missing')

assert.match(sequenceGrantMigration, /revoke all on sequence app_private\.care_case_archive_delete_log_id_seq[\s\S]*public, anon, authenticated/i, 'migration: identity sequence frontend revocation missing')
assert.match(sequenceGrantMigration, /grant usage, select[\s\S]*to service_role/i, 'migration: service-role identity sequence grant missing')

// Regression: PostgREST must never require exposing app_private to list archives.
assert.ok(archiveList.includes('archive_overview_for_service'), 'archive list must use service-only RPC')
assert.ok(!archiveList.includes('admin.schema("app_private")'), 'archive list may not query private schema through PostgREST')
assert.ok(archiveList.includes('aal2'), 'archive list must keep MFA gate')
assert.ok(archiveList.includes('admin.auth.getUser(token)'), 'archive list must verify authenticated actor')
const archiveGrantSQL = archiveListMigration.replace(/\s+/g, ' ').toLowerCase()
assert.ok(archiveGrantSQL.includes('security definer'), 'archive RPC requires controlled definer rights')
assert.ok(archiveGrantSQL.includes('revoke all on function public.archive_overview_for_service(uuid) from public, anon, authenticated'), 'archive RPC must deny frontend roles')
assert.ok(archiveGrantSQL.includes('grant execute on function public.archive_overview_for_service(uuid) to service_role'), 'archive RPC must only allow service role')
console.log('Archive function security invariants passed.')
