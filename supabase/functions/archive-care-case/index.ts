import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3@3";

const H={
  "content-type":"application/json; charset=utf-8",
  "cache-control":"no-store",
  "x-content-type-options":"nosniff",
  "referrer-policy":"no-referrer"
};
const out=(status:number,body:Record<string,unknown>)=>
  new Response(JSON.stringify(body),{status,headers:H});

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
function textValue(value:unknown){
  return typeof value==="string"?value.trim():"";
}
function archiveRefs(payload:Record<string,unknown>,owner:string,caseId:string){
  const result:Array<{path:string,kind:"repair"|"labels",name:string|null}>=[];
  const seen=new Set<string>();
  for(const [key,kind,max] of [["repairPhotos","repair",4],["repairLabelPhotos","labels",10]] as const){
    const items=Array.isArray(payload[key])?payload[key] as Array<Record<string,unknown>>:[];
    if(items.length>max) throw new Error("too_many_"+kind+"_photos");
    for(const item of items){
      const path=typeof item.path==="string"?item.path:"";
      if(!path) continue;
      const prefix=`${owner}/${caseId}/${kind}/`;
      if(!path.startsWith(prefix)) throw new Error("invalid_photo_path");
      if(seen.has(path)) continue;
      seen.add(path);
      result.push({path,kind,name:typeof item.name==="string"?item.name.slice(0,120):null});
    }
  }
  return result;
}
function completionProblems(row:Record<string,unknown>,payload:Record<string,unknown>){
  const missing:string[]=[];
  if(row.status!=="Abschluss offen") missing.push("status");
  if(!textValue(payload.deliveryDate)) missing.push("deliveryDate");
  if(payload.deliveryUsable!==true) missing.push("deliveryUsable");
  if(payload.deliveryInstruction!==true) missing.push("deliveryInstruction");
  if(payload.deliveryReceipt!==true) missing.push("deliveryReceipt");
  if(!textValue(payload.billingState)) missing.push("billingState");
  return missing;
}

Deno.serve(async(req:Request)=>{
  if(req.method!=="POST") return out(405,{error:"method_not_allowed"});

  const length=Number(req.headers.get("content-length")||"0");
  if(Number.isFinite(length)&&length>8192) return out(413,{error:"request_too_large"});

  const authHeader=req.headers.get("authorization")||"";
  const token=authHeader.startsWith("Bearer ")?authHeader.slice(7):"";
  if(!token) return out(401,{error:"missing_token"});

  const url=Deno.env.get("SUPABASE_URL")||"";
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  const publicKey=Deno.env.get("SUPABASE_ANON_KEY")||service;
  const account=Deno.env.get("R2_ACCOUNT_ID")||"";
  const access=Deno.env.get("R2_ACCESS_KEY_ID")||"";
  const secret=Deno.env.get("R2_SECRET_ACCESS_KEY")||"";
  const bucket=Deno.env.get("R2_ARCHIVE_BUCKET")||"";
  if(!url||!service||!publicKey) return out(500,{error:"server_configuration_missing"});
  if(!account||!access||!secret||!bucket) return out(503,{error:"archive_backend_not_configured"});

  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const verified=await admin.auth.getUser(token);
  if(verified.error||!verified.data.user) return out(401,{error:"invalid_user_session"});
  const user=verified.data.user;

  const c=claims(token) as Record<string,unknown>;
  if(c.aal!=="aal2"||c.is_anonymous===true) return out(403,{error:"mfa_required"});

  const member=await admin.schema("app_private").from("app_members")
    .select("user_id").eq("user_id",user.id).eq("active",true).maybeSingle();
  if(member.error||!member.data) return out(403,{error:"user_not_allowed"});

  let rawBody="";
  try{rawBody=await req.text()}catch{return out(400,{error:"invalid_body"})}
  if(rawBody.length>8192) return out(413,{error:"request_too_large"});
  let body:Record<string,unknown>;
  try{body=JSON.parse(rawBody)}catch{return out(400,{error:"invalid_json"})}

  const id=typeof body.care_case_id==="string"?body.care_case_id:"";
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)){
    return out(400,{error:"invalid_care_case_id"});
  }

  const row=await admin.from("care_cases").select("*").eq("id",id).maybeSingle();
  if(row.error) return out(500,{error:"care_case_read_failed"});
  if(!row.data) return out(404,{error:"care_case_not_found"});
  if(row.data.owner_user_id!==user.id) return out(403,{error:"only_owner_can_archive"});

  const caller=createClient(url,publicKey,{
    auth:{persistSession:false,autoRefreshToken:false},
    global:{headers:{Authorization:`Bearer ${token}`}}
  });

  const existing=await admin.schema("app_private").from("care_case_archives")
    .select("*").eq("care_case_id",id).maybeSingle();
  if(existing.error) return out(500,{error:"archive_index_read_failed"});

  if(existing.data?.status==="READY"){
    if(row.data.status!=="Abgeschlossen"){
      const mark=await caller.from("care_cases")
        .update({status:"Abgeschlossen"})
        .eq("id",id)
        .select("id")
        .maybeSingle();
      if(mark.error||!mark.data) return out(500,{error:"case_mark_archived_failed"});
    }
    return out(200,{
      ok:true,
      already_archived:true,
      care_case_id:id,
      archive_id:existing.data.archive_id,
      archive_sha256:existing.data.archive_sha256,
      archive_bytes:existing.data.archive_bytes,
      photo_count:existing.data.photo_count,
      revision_count:existing.data.revision_count
    });
  }

  const payload=(row.data.payload||{}) as Record<string,unknown>;
  const missing=completionProblems(row.data as Record<string,unknown>,payload);
  if(missing.length) return out(409,{error:"care_case_not_complete",missing});

  let refs:Array<{path:string,kind:"repair"|"labels",name:string|null}>;
  try{refs=archiveRefs(payload,row.data.owner_user_id,id)}
  catch(error){return out(409,{error:error instanceof Error?error.message:"invalid_photo_reference"})}

  const rev=await admin.schema("app_private").from("care_case_revisions")
    .select("*").eq("care_case_id",id).order("revision_no",{ascending:true});
  if(rev.error) return out(500,{error:"revision_read_failed"});
  if((rev.data||[]).length>10000) return out(409,{error:"too_many_revisions"});

  const aud=await admin.schema("app_private").from("care_case_audit")
    .select("*").eq("care_case_id",id).order("occurred_at",{ascending:true});
  if(aud.error) return out(500,{error:"audit_read_failed"});
  if((aud.data||[]).length>50000) return out(409,{error:"too_many_audit_events"});

  const archivedAt=existing.data?.archived_at||new Date().toISOString();
  const pendingPayload={
    care_case_id:id,
    archived_at:archivedAt,
    archived_by:user.id,
    owner_user_id:row.data.owner_user_id,
    case_number:payload.caseNumber||null,
    patient_first_name:payload.patientFirstName||null,
    patient_last_name:payload.patientLastName||null,
    insurer:row.data.insurer||null,
    product_group:row.data.product_group||null,
    himi:row.data.himi||null,
    storage_backend:"r2",
    status:"PENDING",
    error_message:null,
    manifest_version:1
  };

  let archiveRow;
  if(existing.data){
    const pending=await admin.schema("app_private").from("care_case_archives")
      .update(pendingPayload).eq("archive_id",existing.data.archive_id).select("*").single();
    if(pending.error||!pending.data) return out(500,{error:"archive_index_prepare_failed"});
    archiveRow=pending.data;
  }else{
    const pending=await admin.schema("app_private").from("care_case_archives")
      .insert(pendingPayload).select("*").single();
    if(pending.error||!pending.data) return out(500,{error:"archive_index_prepare_failed"});
    archiveRow=pending.data;
  }

  const archiveId=archiveRow.archive_id as string;
  const base=`care-cases/${id}/${archiveId}`;
  const s3=new S3Client({
    region:"auto",
    endpoint:`https://${account}.r2.cloudflarestorage.com`,
    credentials:{accessKeyId:access,secretAccessKey:secret},
    forcePathStyle:true
  });

  const fail=async(error:string,detail:unknown,status=500)=>{
    const message=String(detail instanceof Error?detail.message:detail||error).slice(0,1000);
    await admin.schema("app_private").from("care_case_archives")
      .update({status:"FAILED",error_message:message})
      .eq("archive_id",archiveId);
    return out(status,{error});
  };

  try{
    const files:Array<Record<string,unknown>>=[];
    let fileIndex=0;
    for(const ref of refs){
      const d=await admin.storage.from("repair-photos-private").download(ref.path);
      if(d.error||!d.data) return await fail("photo_download_failed",d.error?.message||"photo missing");
      const bytes=new Uint8Array(await d.data.arrayBuffer());
      if(bytes.byteLength>3*1024*1024) return await fail("photo_too_large","archived photo exceeds 3 MiB",409);
      const digest=await sha(bytes);
      const key=`${base}/files/${ref.kind}/${String(++fileIndex).padStart(2,"0")}-${digest}.jpg`;
      await s3.send(new PutObjectCommand({
        Bucket:bucket,
        Key:key,
        Body:bytes,
        ContentType:"image/jpeg",
        Metadata:{"sha256":digest,"care-case-id":id}
      }));
      files.push({
        source_bucket:"repair-photos-private",
        source_path:ref.path,
        target_key:key,
        bytes:bytes.byteLength,
        sha256:digest,
        content_type:"image/jpeg",
        name:ref.name
      });
    }

    const manifest={
      manifest_version:1,
      archive_id:archiveId,
      archived_at:archivedAt,
      archived_by:user.id,
      care_case:row.data,
      revisions:rev.data||[],
      audit:aud.data||[],
      files
    };
    const raw=new TextEncoder().encode(JSON.stringify(manifest));
    if(raw.byteLength>64*1024*1024) return await fail("archive_manifest_too_large","manifest exceeds 64 MiB",409);
    const gz=new Uint8Array(await new Response(
      new Blob([raw]).stream().pipeThrough(new CompressionStream("gzip"))
    ).arrayBuffer());
    const key=`${base}/versorgung.json.gz`;
    const checksum=await sha(gz);

    await s3.send(new PutObjectCommand({
      Bucket:bucket,
      Key:key,
      Body:gz,
      ContentType:"application/gzip",
      Metadata:{"care-case-id":id,"archive-id":archiveId,"sha256":checksum,"manifest-version":"1"}
    }));

    const total=gz.byteLength+files.reduce((n,x)=>n+Number(x.bytes||0),0);
    const ready=await admin.schema("app_private").from("care_case_archives").update({
      object_key:key,
      archive_sha256:checksum,
      archive_bytes:total,
      photo_count:files.length,
      revision_count:(rev.data||[]).length,
      status:"READY",
      error_message:null,
      manifest_version:1
    }).eq("archive_id",archiveId).select("archive_id").single();
    if(ready.error||!ready.data) return await fail("archive_index_write_failed",ready.error?.message||"archive index write failed");

    const mark=await caller.from("care_cases")
      .update({status:"Abgeschlossen"})
      .eq("id",id)
      .select("id")
      .maybeSingle();
    if(mark.error||!mark.data){
      return out(500,{error:"case_mark_archived_failed",archive_ready:true,archive_id:archiveId});
    }

    return out(200,{
      ok:true,
      care_case_id:id,
      archive_id:archiveId,
      archive_sha256:checksum,
      archive_bytes:total,
      photo_count:files.length,
      revision_count:(rev.data||[]).length,
      cleanup_pending:true
    });
  }catch(error){
    return await fail("archive_write_failed",error);
  }
});