import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { validateArchiveManifest } from "../_shared/archive-layout.mjs";

const GATEWAY="https://versorgungsassistent-archive-gateway.patientcare-assistent-archive.workers.dev";
const SOURCE_BUCKET="repair-photos-private";

const ALLOWED_ORIGINS=new Set(["https://patientcareassistent-lab.github.io"]);
function corsHeaders(req:Request):Record<string,string>{
  const origin=req.headers.get("origin")||"";
  return origin && ALLOWED_ORIGINS.has(origin)
    ? {"access-control-allow-origin":origin,"vary":"Origin",
       "access-control-allow-headers":"authorization, x-client-info, apikey, content-type",
       "access-control-allow-methods":"POST, OPTIONS"} : {};
}
const BASE_HEADERS={"content-type":"application/json; charset=utf-8",
  "cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer"};

function claims(token:string){
  try{
    const p=token.split(".")[1]||"";
    const n=p.replace(/-/g,"+").replace(/_/g,"/");
    return JSON.parse(atob(n+"=".repeat((4-n.length%4)%4)));
  }catch{return {}}
}

async function sha256Hex(bytes:Uint8Array){
  const d=await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
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
  const origin=req.headers.get("origin")||"";
  if(origin && !ALLOWED_ORIGINS.has(origin)) return new Response(
    JSON.stringify({error:"origin_not_allowed"}),{status:403,headers:BASE_HEADERS});
  const headers={...BASE_HEADERS,...corsHeaders(req)};
  const reply=(status:number,body:Record<string,unknown>)=>
    new Response(JSON.stringify(body),{status,headers});
  if(req.method==="OPTIONS") return new Response(null,{status:204,headers:corsHeaders(req)});
  if(req.method!=="POST") return reply(405,{error:"method_not_allowed"});

  const auth=req.headers.get("authorization")||"";
  const apiKey=req.headers.get("apikey")||Deno.env.get("SUPABASE_ANON_KEY")||"";
  const token=auth.startsWith("Bearer ")?auth.slice(7):"";
  if(!token||!apiKey) return reply(401,{error:"missing_credentials"});
  const c=claims(token) as Record<string,unknown>;
  if(c.aal!=="aal2"||c.is_anonymous===true) return reply(403,{error:"mfa_required"});

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
  const context=await admin.rpc("archive_context_for_service",{
    p_actor_id:user.id,p_care_case_id:careCaseId,
    p_require_admin:false,p_include_history:false
  });
  if(context.error){
    if(context.error.code==="42501") return reply(403,{error:"user_not_allowed"});
    return reply(500,{error:"archive_index_read_failed"});
  }
  const archive={data:context.data?.archive||null};
  if(!archive.data||!["READY","RESTORED"].includes(archive.data.status))
    return reply(404,{error:"archive_not_found"});
  if(archive.data.verification_status!=="VERIFIED") return reply(409,{error:"archive_not_verified"});
  if(context.data?.care_case){
    if(archive.data.status==="RESTORED") return reply(200,{ok:true,already_restored:true,care_case_id:careCaseId});
    return reply(409,{error:"archive_case_conflict"});
  }
  if(archive.data.status!=="READY") return reply(409,{error:"archive_not_ready"});
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

  try{
    validateArchiveManifest(manifest,archive.data);
  }catch{
    return reply(409,{error:"archive_manifest_identity_or_path_mismatch"});
  }
  const restoredPaths:string[]=[];
  for(const file of manifest.files){
    const kind=String(file.target_key).includes("/files/repair/")?"repair":"labels";
    const sourcePath=String(file.source_path||"");
    const prefix=archive.data.owner_user_id+"/"+careCaseId+"/"+kind+"/";
    if(!sourcePath.startsWith(prefix)||sourcePath.includes(".."))
      return reply(409,{error:"restore_invalid_source_path"});
    const object=await gatewayGet(token,apiKey,String(file.target_key));
    const hash=await sha256Hex(object.bytes);
    if(hash!==file.sha256) return reply(409,{error:"archive_file_checksum_mismatch",path:file.source_path});
    if(object.bytes.byteLength>3*1024*1024) return reply(409,{error:"restore_file_too_large"});
    const upload=await admin.storage.from(SOURCE_BUCKET).upload(String(file.source_path),object.bytes,{
      upsert:true,
      contentType:String(file.content_type||object.contentType||"application/octet-stream")
    });
    if(upload.error) return reply(500,{error:"restore_file_failed",path:file.source_path,detail:upload.error.message});
    restoredPaths.push(String(file.source_path));
  }

  const restored=await admin.rpc("archive_restore_for_service",{
    p_actor_id:user.id,p_care_case_id:careCaseId,p_manifest:manifest
  });
  if(restored.error){
    return reply(409,{error:"restore_database_commit_failed",code:restored.error.code,
      warning:"Verified archive remains intact. Restored file staging may require reconciliation."});
  }
  return reply(200,{ok:true,care_case_id:careCaseId,
    restored_at:restored.data?.restored_at,restored_files:restoredPaths.length});
});
