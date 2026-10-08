import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { validateArchiveManifest } from "../_shared/archive-layout.mjs";
import { S3Client, GetObjectCommand } from "npm:@aws-sdk/client-s3@3.1147.0";

const H={
  "content-type":"application/json; charset=utf-8",
  "cache-control":"no-store",
  "x-content-type-options":"nosniff",
  "referrer-policy":"no-referrer"
};
const DEFAULT_ALLOWED_ORIGINS=["https://patientcareassistent-lab.github.io"];

function allowedOrigins(){
  const configured=(Deno.env.get("ARCHIVE_ALLOWED_ORIGINS")||"")
    .split(",").map(x=>x.trim()).filter(Boolean);
  return new Set([...DEFAULT_ALLOWED_ORIGINS,...configured]);
}
function originAllowed(req:Request){
  const origin=req.headers.get("origin")||"";
  return !origin||allowedOrigins().has(origin);
}
function corsHeaders(req:Request){
  const origin=req.headers.get("origin")||"";
  if(!origin||!originAllowed(req)) return {};
  return {
    "access-control-allow-origin":origin,
    "access-control-allow-methods":"POST, OPTIONS",
    "access-control-allow-headers":"authorization, x-client-info, apikey, content-type",
    "access-control-max-age":"600",
    "vary":"Origin"
  };
}
function claims(token:string){
  try{
    const p=token.split(".")[1]||"";
    const n=p.replace(/-/g,"+").replace(/_/g,"/");
    return JSON.parse(atob(n+"=".repeat((4-n.length%4)%4)));
  }catch{return {}}
}
async function sha(bytes:Uint8Array){
  const d=await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function bodyBytes(body:any){
  if(!body) throw new Error("missing_object_body");
  if(typeof body.transformToByteArray==="function"){
    return new Uint8Array(await body.transformToByteArray());
  }
  return new Uint8Array(await new Response(body).arrayBuffer());
}

Deno.serve(async(req:Request)=>{
  if(!originAllowed(req)){
    return new Response(JSON.stringify({error:"origin_not_allowed"}),{status:403,headers:{...H,"vary":"Origin"}});
  }
  if(req.method==="OPTIONS"){
    return new Response(null,{status:204,headers:{...corsHeaders(req),"cache-control":"no-store"}});
  }
  const out=(status:number,body:Record<string,unknown>)=>
    new Response(JSON.stringify(body),{status,headers:{...H,...corsHeaders(req)}});

  if(req.method!=="POST") return out(405,{error:"method_not_allowed"});
  const length=Number(req.headers.get("content-length")||"0");
  if(Number.isFinite(length)&&length>8192) return out(413,{error:"request_too_large"});

  const authHeader=req.headers.get("authorization")||"";
  const token=authHeader.startsWith("Bearer ")?authHeader.slice(7):"";
  if(!token) return out(401,{error:"missing_token"});

  const url=Deno.env.get("SUPABASE_URL")||"";
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  const account=Deno.env.get("R2_ACCOUNT_ID")||"";
  const access=Deno.env.get("R2_ACCESS_KEY_ID")||"";
  const secret=Deno.env.get("R2_SECRET_ACCESS_KEY")||"";
  const bucket=Deno.env.get("R2_ARCHIVE_BUCKET")||"";
  if(!url||!service) return out(500,{error:"server_configuration_missing"});
  if(!account||!access||!secret||!bucket) return out(503,{error:"archive_backend_not_configured"});

  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const verifiedUser=await admin.auth.getUser(token);
  if(verifiedUser.error||!verifiedUser.data.user) return out(401,{error:"invalid_user_session"});
  const user=verifiedUser.data.user;

  const c=claims(token) as Record<string,unknown>;
  if(c.aal!=="aal2"||c.is_anonymous===true) return out(403,{error:"mfa_required"});

  let bodyText="";
  try{bodyText=await req.text()}catch{return out(400,{error:"invalid_body"})}
  if(bodyText.length>8192) return out(413,{error:"request_too_large"});
  let body:Record<string,unknown>;
  try{body=JSON.parse(bodyText)}catch{return out(400,{error:"invalid_json"})}
  const id=typeof body.care_case_id==="string"?body.care_case_id:"";
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)){
    return out(400,{error:"invalid_care_case_id"});
  }

  const ctx=await admin.rpc("archive_context_for_service",{
    p_actor_id:user.id,p_care_case_id:id,p_require_admin:false,p_include_history:false
  });
  if(ctx.error){
    if(ctx.error.code==="42501") return out(403,{error:"user_not_allowed"});
    return out(500,{error:"archive_index_read_failed"});
  }
  const idx={data:ctx.data?.archive||null};
  if(!idx.data) return out(404,{error:"archive_not_found"});
  if(idx.data.status!=="READY") return out(409,{error:"archive_not_ready"});
  if(!idx.data.object_key||!idx.data.archive_sha256) return out(409,{error:"archive_index_incomplete"});

  const s3=new S3Client({
    region:"auto",
    endpoint:`https://${account}.r2.cloudflarestorage.com`,
    credentials:{accessKeyId:access,secretAccessKey:secret},
    forcePathStyle:true
  });

  const fail=async(code:string,detail:unknown,status=409)=>{
    const message=String(detail instanceof Error?detail.message:detail||code).slice(0,1000);
    const updated=await admin.rpc("archive_mutation_for_service",{
      p_actor_id:user.id,p_care_case_id:id,p_action:"verify",
      p_data:{result:"FAILED",verification_error:message}
    });
    if(updated.error) return out(500,{error:"archive_verification_state_failed"});
    return out(status,{ok:false,error:code});
  };

  try{
    const main=await s3.send(new GetObjectCommand({Bucket:bucket,Key:idx.data.object_key}));
    const gz=await bodyBytes(main.Body);
    if(gz.byteLength>64*1024*1024) return await fail("archive_object_too_large","compressed archive exceeds 64 MiB");
    const checksum=await sha(gz);
    if(checksum!==idx.data.archive_sha256) return await fail("archive_checksum_mismatch","main archive checksum mismatch");

    const raw=new Uint8Array(await new Response(
      new Blob([gz]).stream().pipeThrough(new DecompressionStream("gzip"))
    ).arrayBuffer());
    if(raw.byteLength>128*1024*1024) return await fail("archive_manifest_too_large","manifest exceeds 128 MiB");

    let manifest:any;
    try{manifest=JSON.parse(new TextDecoder().decode(raw))}
    catch{return await fail("archive_manifest_invalid","manifest JSON is invalid")}

    try{validateArchiveManifest(manifest,idx.data);}
    catch(error){return await fail("archive_manifest_integrity_invalid",error);}

    const files=manifest.files;
    for(const file of files){
      const key=typeof file?.target_key==="string"?file.target_key:"";
      const expected=typeof file?.sha256==="string"?file.sha256:"";
      if(!key.startsWith(base)||!/^[0-9a-f]{64}$/.test(expected)){
        return await fail("invalid_file_manifest","file manifest entry invalid");
      }
      const object=await s3.send(new GetObjectCommand({Bucket:bucket,Key:key}));
      const bytes=await bodyBytes(object.Body);
      if(bytes.byteLength>3*1024*1024) return await fail("archive_file_too_large","archived file exceeds 3 MiB");
      if(await sha(bytes)!==expected) return await fail("archive_file_checksum_mismatch","archived file checksum mismatch");
    }

    const updated=await admin.rpc("archive_mutation_for_service",{
      p_actor_id:user.id,p_care_case_id:id,p_action:"verify",
      p_data:{result:"VERIFIED"}
    });
    if(updated.error) return out(500,{error:"archive_verification_state_failed"});

    return out(200,{
      ok:true,
      care_case_id:id,
      archive_id:idx.data.archive_id,
      archive_sha256:checksum,
      archive_bytes:gz.byteLength,
      photo_count:files.length,
      verification_status:"VERIFIED"
    });
  }catch(error){
    return await fail("archive_verification_failed",error,500);
  }
});