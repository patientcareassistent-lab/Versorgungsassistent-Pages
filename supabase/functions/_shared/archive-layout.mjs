// Single canonical R2 object layout for *future* archive-service integrations.
// Existing deployed Edge Functions are intentionally not changed by this module.
// No patient payload or credentials belong in paths or object metadata.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH=/^[0-9a-f]{64}$/i;
function validUuid(id){
  if(typeof id!=='string'||!UUID.test(id)) throw new Error('invalid_archive_identifier');
  return id.toLowerCase();
}
export function archiveLayout(caseId, archiveId) {
  const root='care-cases/'+validUuid(caseId)+'/'+validUuid(archiveId)+'/';
  return Object.freeze({
    prefix:root,
    manifestKey:root+'versorgung.json.gz',
    fileKey(kind,filename){
      if(kind!=='repair'&&kind!=='labels') throw new Error('invalid_archive_file_kind');
      if(typeof filename!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,150}$/.test(filename)||filename.includes('..')) {
        throw new Error('invalid_archive_filename');
      }
      return root+'files/'+kind+'/'+filename;
    }
  });
}
export function validateArchiveManifest(manifest,index){
  if(!manifest||!index) throw new Error('missing_archive_metadata');
  const layout=archiveLayout(index.care_case_id,index.archive_id);
  if(manifest.manifest_version!==1||manifest.archive_id!==index.archive_id
    ||manifest.care_case?.id!==index.care_case_id
    ||manifest.care_case?.owner_user_id!==index.owner_user_id) throw new Error('archive_identity_mismatch');
  if(index.object_key!==layout.manifestKey) throw new Error('archive_manifest_key_mismatch');
  const files=manifest.files;
  if(!Array.isArray(files)||files.length>14||files.length!==Number(index.photo_count||0)) throw new Error('archive_file_count_mismatch');
  const keys=new Set();
  for(const file of files){
    if(!file||typeof file.target_key!=='string'||!file.target_key.startsWith(layout.prefix+'files/')) {
      throw new Error('archive_file_key_mismatch');
    }
    if(!/^care-cases\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/files\/(repair|labels)\/[a-zA-Z0-9][a-zA-Z0-9._-]*$/i.test(file.target_key)
      ||file.target_key.includes('..')) throw new Error('archive_file_path_invalid');
    if(!HASH.test(file.sha256||'')) throw new Error('archive_file_hash_invalid');
    if(keys.has(file.target_key)) throw new Error('archive_file_duplicate');
    keys.add(file.target_key);
  }
  return Object.freeze({manifestKey:layout.manifestKey,fileKeys:[...keys]});
}
