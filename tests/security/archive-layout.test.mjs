import test from 'node:test';
import assert from 'node:assert/strict';
import {archiveLayout,validateArchiveManifest} from '../../supabase/functions/_shared/archive-layout.mjs';

const caseId='10000000-0000-4000-8000-000000000001';
const archiveId='20000000-0000-4000-8000-000000000002';
const ownerId='30000000-0000-4000-8000-000000000003';
const staffId='40000000-0000-4000-8000-000000000004';
const layout=archiveLayout(caseId,archiveId);
const index={
  care_case_id:caseId,archive_id:archiveId,owner_user_id:ownerId,
  object_key:layout.manifestKey,photo_count:1,verification_status:'VERIFIED'
};
const manifest={
  manifest_version:1,archive_id:archiveId,archived_by:staffId,
  care_case:{id:caseId,owner_user_id:ownerId},
  files:[{target_key:layout.fileKey('repair','photo-01.jpg'),sha256:'a'.repeat(64)}]
};
test('canonical R2 layout is case/archive-based, never operator-based',()=>{
  assert.equal(layout.prefix,'care-cases/'+caseId+'/'+archiveId+'/');
  assert.equal(layout.manifestKey,layout.prefix+'versorgung.json.gz');
  assert.ok(!layout.prefix.includes(staffId));
  assert.equal(validateArchiveManifest(manifest,index).fileKeys.length,1);
});
test('rejects archive-key mismatch from legacy owner/time layout',()=>{
  assert.throws(()=>validateArchiveManifest(manifest,{...index,object_key:'care-cases/'+staffId+'/'+caseId+'/2026-10-08/versorgung.json.gz'}),/archive_manifest_key_mismatch/);
});
test('rejects mismatched source case, archive ID and source owner',()=>{
  for(const change of [
    {...manifest,archive_id:staffId},
    {...manifest,care_case:{id:staffId,owner_user_id:ownerId}},
    {...manifest,care_case:{id:caseId,owner_user_id:staffId}}
  ]) assert.throws(()=>validateArchiveManifest(change,index),/archive_identity_mismatch/);
});
test('rejects file traversal, duplicate objects, invalid hashes and oversized list',()=>{
  assert.throws(()=>layout.fileKey('repair','../escape.jpg'),/invalid_archive_filename/);
  assert.throws(()=>layout.fileKey('docs','photo.jpg'),/invalid_archive_file_kind/);
  assert.throws(()=>validateArchiveManifest({...manifest,files:[{...manifest.files[0],sha256:'foo'}]},index),/archive_file_hash_invalid/);
  assert.throws(()=>validateArchiveManifest({...manifest,files:[manifest.files[0],manifest.files[0]]},{...index,photo_count:2}),/archive_file_duplicate/);
  assert.throws(()=>validateArchiveManifest({...manifest,files:Array(15).fill(manifest.files[0])},{...index,photo_count:15}),/archive_file_count_mismatch/);
});
