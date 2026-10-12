import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const GATEWAY="https://versorgungsassistent-archive-gateway.patientcare-assistent-archive.workers.dev";
const SOURCE_BUCKET="repair-photos-private";

const cors={
  "access-control-allow-origin":"*",
  "access-control-allow-headers":"authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods":"POST, OPTIONS"
};
const headers={...cors,"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer"};
const reply=(status:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{status,headers});

function claims(token:string){
  try{
    const p=token.split(".")[1]||"";
    const n=p.replace(/-/g,"+").replace(/_/g,"/");
    return JSON.parse(atob(n+"=".repeat((4-n.length%4)%4)));
  }catch{return {}}
}

async function sha256Hex(bytes:Uint8Array){
  const d=await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,"0")).join("");
}

async function gatewayGet(token:string,apiKey:string,key:string){
  const response=await fetch(GATEWAY+"/object?key="+encodeURIComponent(key),{
    headers:{"authorization":"Bearer "+token,"apikey":apiKey}
  });
  if(!response.ok){
    const detail=await response.text().catch(()=>"");
    throw new Error("Archivobjekt konnte nicht geladen werden: "+response.status+" "+detail.slice(0,200));
  }
  const bytes=new Uint8Array(await response.arrayBuffer());
  return {bytes,contentType:response.headers.get("content-type")||"application/octet-stream",sha:response.headers.get("x-archive-sha256")||""};
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response(null,{status:204,headers:cors});
  if(req.method!=="POST") return reply(405,{error:"method_not_allowed"});

  const auth=req.headers.get("authorization")||"";
  const apiKey=req.headers.get("apikey")||Deno.env.get("SUPABASE_ANON_KEY")||"";
  const token=auth.startsWith("Bearer ")?auth.slice(7):"";
  if(!token||!apiKey) return reply(401,{error:"missing_credentials"});
  const c=claims(token) as Record<string,unknown>;
  if(c.is_anonymous===true) return reply(403,{error:"anonymous_not_allowed"});

  let body:Record<string,unknown>;
  try{body=await req.json()}catch{return reply(400,{error:"invalid_json"})}
  const careCaseId=typeof body.care_case_id==="string"?body.care_case_id:"";
  if(!careCaseId) return reply(400,{error:"care_case_id_required"});

  const url=Deno.env.get("SUPABASE_URL")||"";
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  if(!url||!service) return reply(500,{error:"server_configuration_missing"});
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});

  const u=await admin.auth.getUser(token);
  if(u.error||!u.data.user) return reply(401,{error:"invalid_user_session"});
  const user=u.data.user;
  const member=await admin.schema("app_private").from("app_members")
    .select("user_id").eq("user_id",user.id).eq("active",true).maybeSingle();
  if(member.error||!member.data) return reply(403,{error:"user_not_allowed"});

  const archive=await admin.schema("app_private").from("care_case_archives")
    .select("*").eq("care_case_id",careCaseId).maybeSingle();
  if(archive.error) return reply(500,{error:"archive_index_read_failed",detail:archive.error.message});
  if(!archive.data||!["READY","RESTORED"].includes(archive.data.status)) return reply(404,{error:"archive_not_found"});
  if(archive.data.owner_user_id!==user.id) return reply(403,{error:"only_owner_can_restore"});
  if(archive.data.verification_status!=="VERIFIED") return reply(409,{error:"archive_not_verified"});

  const existing=await admin.from("care_cases").select("id").eq("id",careCaseId).maybeSingle();
  if(existing.error) return reply(500,{error:"care_case_check_failed",detail:existing.error.message});
  if(existing.data) return reply(200,{ok:true,already_restored:true,care_case_id:careCaseId});

  const manifestObject=await gatewayGet(token,apiKey,archive.data.object_key);
  const manifestSha=await sha256Hex(manifestObject.bytes);
  if(manifestSha!==archive.data.archive_sha256) return reply(409,{error:"archive_checksum_mismatch"});
  if(manifestObject.sha&&manifestObject.sha!==manifestSha) return reply(409,{error:"gateway_checksum_mismatch"});

  let manifest:any;
  try{
    const raw=await new Response(
      new Blob([manifestObject.bytes]).stream().pipeThrough(new DecompressionStream("gzip"))
    ).text();
    manifest=JSON.parse(raw);
  }catch(err){
    return reply(500,{error:"archive_manifest_invalid",detail:err instanceof Error?err.message:String(err)});
  }

  if(manifest?.manifest_version!==1||manifest?.care_case?.id!==careCaseId) return reply(409,{error:"archive_manifest_identity_mismatch"});
  if(manifest?.care_case?.owner_user_id!==user.id) return reply(403,{error:"archive_owner_mismatch"});

  const restoredPaths:string[]=[];
  for(const file of Array.isArray(manifest.files)?manifest.files:[]){
    if(!file?.target_key||!file?.source_path) continue;
    const object=await gatewayGet(token,apiKey,String(file.target_key));
    const hash=await sha256Hex(object.bytes);
    if(file.sha256&&hash!==file.sha256) return reply(409,{error:"archive_file_checksum_mismatch",path:file.source_path});
    const upload=await admin.storage.from(SOURCE_BUCKET).upload(String(file.source_path),object.bytes,{
      upsert:true,
      contentType:String(file.content_type||object.contentType||"application/octet-stream")
    });
    if(upload.error) return reply(500,{error:"restore_file_failed",path:file.source_path,detail:upload.error.message});
    restoredPaths.push(String(file.source_path));
  }

  const original=manifest.care_case;
  const restoredRow={
    id:original.id,
    owner_user_id:original.owner_user_id,
    created_at:original.created_at,
    updated_at:new Date().toISOString(),
    wizard_index:original.wizard_index,
    insurer:original.insurer,
    product_group:original.product_group,
    himi_id:original.himi_id,
    himi:original.himi,
    status:original.status==="Abgeschlossen"?"Abschluss offen":(original.status||"Laufend"),
    payload:{...(original.payload||{}),archiveRestoredAt:new Date().toISOString()},
    schema_version:original.schema_version||1,
    completed_at:null,
    retention_until:original.retention_until,
    retention_basis:original.retention_basis,
    legal_hold:!!original.legal_hold,
    erasure_requested_at:original.erasure_requested_at,
    last_modified_by:user.id
  };

  const inserted=await admin.from("care_cases").insert(restoredRow);
  if(inserted.error) return reply(500,{error:"restore_case_failed",detail:inserted.error.message});

  await admin.schema("app_private").from("care_case_revisions").delete().eq("care_case_id",careCaseId);
  await admin.schema("app_private").from("care_case_audit").delete().eq("care_case_id",careCaseId);

  const revisions=(Array.isArray(manifest.revisions)?manifest.revisions:[]).map((r:any)=>({
    care_case_id:careCaseId,
    revision_no:r.revision_no,
    captured_at:r.captured_at,
    actor_user_id:r.actor_user_id,
    status:r.status,
    wizard_index:r.wizard_index,
    payload:r.payload||{},
    row_snapshot:r.row_snapshot
  }));
  if(revisions.length){
    const restoredRevisions=await admin.schema("app_private").from("care_case_revisions").insert(revisions);
    if(restoredRevisions.error) return reply(500,{error:"restore_revisions_failed",detail:restoredRevisions.error.message});
  }

  const audits=(Array.isArray(manifest.audit)?manifest.audit:[]).map((a:any)=>({
    care_case_id:careCaseId,
    occurred_at:a.occurred_at,
    actor_user_id:a.actor_user_id,
    action:a.action,
    status_before:a.status_before,
    status_after:a.status_after,
    changed_fields:Array.isArray(a.changed_fields)?a.changed_fields:[]
  }));
  if(audits.length){
    const restoredAudit=await admin.schema("app_private").from("care_case_audit").insert(audits);
    if(restoredAudit.error) return reply(500,{error:"restore_audit_failed",detail:restoredAudit.error.message});
  }

  await admin.schema("app_private").from("care_case_audit").insert({
    care_case_id:careCaseId,
    occurred_at:new Date().toISOString(),
    actor_user_id:user.id,
    action:"RESTORE_FROM_R2",
    status_before:"ARCHIVED",
    status_after:restoredRow.status,
    changed_fields:["archive_restore"]
  });

  const restoredAt=new Date().toISOString();
  const update=await admin.schema("app_private").from("care_case_archives").update({
    status:"RESTORED",
    restored_at:restoredAt,
    restored_by:user.id,
    cleanup_error:null
  }).eq("care_case_id",careCaseId);
  if(update.error) return reply(500,{error:"archive_restore_index_failed",detail:update.error.message});

  return reply(200,{ok:true,care_case_id:careCaseId,restored_at:restoredAt,restored_files:restoredPaths.length});
});