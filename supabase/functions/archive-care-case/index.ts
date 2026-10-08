import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const GATEWAY = "https://versorgungsassistent-archive-gateway.patientcare-assistent-archive.workers.dev";
const SOURCE_BUCKET = "repair-photos-private";

const BASE_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer"
};
const DEFAULT_ALLOWED_ORIGINS = ["https://patientcareassistent-lab.github.io"];

function allowedOrigins() {
  const configured = (Deno.env.get("ARCHIVE_ALLOWED_ORIGINS") || "")
    .split(",").map(x => x.trim()).filter(Boolean);
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured]);
}
function originAllowed(req:Request) {
  const origin = req.headers.get("origin") || "";
  return !origin || allowedOrigins().has(origin);
}
function corsHeaders(req:Request) {
  const origin = req.headers.get("origin") || "";
  if (!origin || !originAllowed(req)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-max-age": "600",
    "vary": "Origin"
  };
}

function jwtClaims(token:string) {
  try {
    const p = token.split(".")[1] || "";
    const n = p.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(n + "=".repeat((4 - n.length % 4) % 4)));
  } catch {
    return {};
  }
}

async function sha256Hex(bytes:Uint8Array) {
  const d = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function textValue(value:unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function collectPhotoPaths(payload:Record<string,unknown>, owner:string, careCaseId:string) {
  const result:Array<{path:string,kind:string,name:string|null}> = [];
  const seen = new Set<string>();
  for (const [key, kind, max] of [["repairPhotos","repair",4],["repairLabelPhotos","labels",10]] as const) {
    const items = Array.isArray(payload[key]) ? payload[key] as Array<Record<string,unknown>> : [];
    if (items.length > max) throw new Error("too_many_" + kind + "_photos");
    for (const item of items) {
      const path = typeof item.path === "string" ? item.path : "";
      if (!path) continue;
      const prefix = owner + "/" + careCaseId + "/" + kind + "/";
      if (!path.startsWith(prefix)) throw new Error("invalid_photo_path");
      if (seen.has(path)) continue;
      seen.add(path);
      result.push({
        path,
        kind,
        name: typeof item.name === "string" ? item.name.slice(0,120) : null
      });
    }
  }
  return result;
}

function completionProblems(row:Record<string,unknown>, payload:Record<string,unknown>) {
  const missing:string[] = [];
  const insurer = textValue(row.insurer);
  const pg = textValue(row.product_group);
  const himi = textValue(row.himi_id) || textValue(row.himi);
  const caseKind = textValue(payload.caseKind);
  const isRepair = caseKind === "Reparatur";

  if (row.status !== "Abschluss offen") missing.push("status");
  if (Number(row.wizard_index) < 9) missing.push("wizardIndex");
  if (!insurer) missing.push("insurer");
  if (!pg) missing.push("productGroup");
  if (!himi) missing.push("himi");
  if (!textValue(payload.patientFirstName)) missing.push("patientFirstName");
  if (!textValue(payload.patientLastName)) missing.push("patientLastName");
  if (!["Neuversorgung","Reparatur"].includes(caseKind)) missing.push("caseKind");
  if (!textValue(payload.supplyType)) missing.push("supplyType");

  if (!textValue(payload.rxPresent)) missing.push("rxPresent");
  if (payload.rxPresent === "Ja") {
    if (payload.rxFileCaptured !== true) missing.push("rxFileCaptured");
    if (!textValue(payload.rxText)) missing.push("rxText");
  } else if (payload.rxPresent === "Nein" && !isRepair && !textValue(payload.rxNeededText)) {
    missing.push("rxNeededText");
  }

  if (isRepair) {
    for (const key of [
      "repairSicHimiId","repairDate","repairTechnician","repairPreperformed",
      "repairComplaint","repairWork","repairFunctionTest","repairUsable","repairCompleted"
    ]) {
      const value = payload[key];
      if (value === undefined || value === null || value === false || !String(value).trim()) missing.push(key);
    }
  } else {
    if (!textValue(payload.planGoal)) missing.push("planGoal");
    if (!textValue(payload.planShaft) && !textValue(payload.planParts)) missing.push("planConcept");
  }

  if (!textValue(payload.quotePositions)) missing.push("quotePositions");
  if (!textValue(payload.approvalState)) missing.push("approvalState");

  if (!textValue(payload.deliveryDate)) missing.push("deliveryDate");
  if (payload.deliveryUsable !== true) missing.push("deliveryUsable");
  if (payload.deliveryInstruction !== true) missing.push("deliveryInstruction");
  if (payload.deliveryReceipt !== true) missing.push("deliveryReceipt");

  return [...new Set(missing)];
}

async function gatewayRequest(token:string, apiKey:string, path:string, init:RequestInit = {}) {
  const requestHeaders = new Headers(init.headers || {});
  requestHeaders.set("authorization", "Bearer " + token);
  requestHeaders.set("apikey", apiKey);
  const response = await fetch(GATEWAY + path, { ...init, headers:requestHeaders });
  return response;
}

async function verifiedPut(token:string, apiKey:string, key:string, bytes:Uint8Array, contentType:string, kind:string, sourcePath:string) {
  const hash = await sha256Hex(bytes);
  const upload = await gatewayRequest(token, apiKey, "/object?key=" + encodeURIComponent(key), {
    method:"PUT",
    headers:{
      "content-type":contentType || "application/octet-stream",
      "x-archive-sha256":hash,
      "x-archive-kind":kind,
      "x-source-path":sourcePath || ""
    },
    body:bytes
  });
  const uploadData = await upload.json().catch(() => ({}));
  if (!upload.ok || !uploadData?.ok) {
    throw new Error("R2 upload failed: " + (uploadData?.error || upload.status));
  }

  const verify = await gatewayRequest(token, apiKey, "/meta?key=" + encodeURIComponent(key));
  const verifyData = await verify.json().catch(() => ({}));
  if (!verify.ok || !verifyData?.ok) {
    throw new Error("R2 verification failed: " + (verifyData?.error || verify.status));
  }
  if (Number(verifyData.size) !== bytes.byteLength) throw new Error("R2 size mismatch for " + key);
  if (verifyData?.customMetadata?.sha256 !== hash) throw new Error("R2 checksum mismatch for " + key);

  return { hash, size:bytes.byteLength };
}

Deno.serve(async (req:Request) => {
  if (!originAllowed(req)) {
    return new Response(JSON.stringify({ error:"origin_not_allowed" }), {
      status:403,
      headers:{...BASE_HEADERS,"vary":"Origin"}
    });
  }
  if (req.method === "OPTIONS") {
    return new Response(null, { status:204, headers:{...corsHeaders(req),"cache-control":"no-store"} });
  }
  const reply = (status:number, body:Record<string,unknown>) =>
    new Response(JSON.stringify(body), { status, headers:{...BASE_HEADERS,...corsHeaders(req)} });
  if (req.method !== "POST") return reply(405, { error:"method_not_allowed" });

  const contentLength = Number(req.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > 8192) return reply(413, { error:"request_too_large" });

  const authHeader = req.headers.get("authorization") || "";
  const apiKey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token || !apiKey) return reply(401, { error:"missing_credentials" });

  const claims = jwtClaims(token) as Record<string,unknown>;
  if (claims.aal !== "aal2" || claims.is_anonymous === true) return reply(403, { error:"mfa_required" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) return reply(500, { error:"server_configuration_missing" });

  let rawBody = "";
  try { rawBody = await req.text(); } catch { return reply(400, { error:"invalid_body" }); }
  if (rawBody.length > 8192) return reply(413, { error:"request_too_large" });
  let body:Record<string,unknown>;
  try { body = JSON.parse(rawBody); } catch { return reply(400, { error:"invalid_json" }); }
  const careCaseId = typeof body.care_case_id === "string" ? body.care_case_id : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(careCaseId)) {
    return reply(400, { error:"invalid_care_case_id" });
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth:{persistSession:false,autoRefreshToken:false} });
  const authUser = await admin.auth.getUser(token);
  if (authUser.error || !authUser.data.user) return reply(401, { error:"invalid_user_session" });
  const user = authUser.data.user;

  const context=await admin.rpc("archive_context_for_service",{
    p_actor_id:user.id,p_care_case_id:careCaseId,
    p_require_admin:false,p_include_history:true
  });
  if(context.error){
    if(context.error.code==="42501") return reply(403,{error:"user_not_allowed"});
    return reply(500,{error:"archive_context_read_failed"});
  }
  const existing={data:context.data?.archive||null};
  const caseResult={data:context.data?.care_case||null};
  if(!caseResult.data){
    if(existing.data?.status==="READY" && existing.data?.verification_status==="VERIFIED"){
      return reply(200,{ok:true,already_archived:true,
        care_case_id:careCaseId,object_key:existing.data.object_key,
        archive_sha256:existing.data.archive_sha256,
        archive_bytes:existing.data.archive_bytes,
        cleanup_complete:!!existing.data.source_purged_at});
    }
    return reply(404,{error:"care_case_not_found"});
  }
  if(existing.data?.status==="READY") return reply(409,{error:"archive_already_ready"});

  const payload = (caseResult.data.payload || {}) as Record<string,unknown>;
  const missing = completionProblems(caseResult.data as Record<string,unknown>, payload);
  if (missing.length) return reply(409, { error:"care_case_not_complete", missing });

  let photoRefs:Array<{path:string,kind:string,name:string|null}>;
  try {
    photoRefs = collectPhotoPaths(payload, caseResult.data.owner_user_id, careCaseId);
  } catch (error) {
    return reply(409, { error:error instanceof Error ? error.message : "invalid_photo_reference" });
  }

  const reserved=await admin.rpc("archive_mutation_for_service",{
    p_actor_id:user.id,p_care_case_id:careCaseId,
    p_action:"reserve",p_data:{}
  });
  if(reserved.error) return reply(409,{error:"archive_reservation_failed",code:reserved.error.code});
  const archiveId=String(reserved.data?.archive_id||"");
  const expectedUpdatedAt=String(reserved.data?.expected_updated_at||"");
  if(!archiveId || !expectedUpdatedAt) return reply(500,{error:"archive_reservation_invalid"});

  let objectKey:string|null=null;
  let manifestHash:string|null=null;
  let totalBytes=0;
  let photoCount=0;
  let revisionCount=0;
  {
    const revisions={data:context.data?.revisions||[]};
    const audit={data:context.data?.audit||[]};

    const archivedAt = new Date().toISOString();
    const base="care-cases/"+careCaseId+"/"+archiveId;
    const files:Array<Record<string,unknown>> = [];
    totalBytes = 0;

    for (const ref of photoRefs) {
      const downloaded = await admin.storage.from(SOURCE_BUCKET).download(ref.path);
      if (downloaded.error || !downloaded.data) {
        return reply(500, { error:"photo_download_failed", path:ref.path, detail:downloaded.error?.message });
      }
      const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
      if (bytes.byteLength > 3 * 1024 * 1024) return reply(409, { error:"photo_too_large" });
      const filename = ref.path.split("/").pop() || crypto.randomUUID();
      const targetKey = base + "/files/" + ref.kind + "/" + filename;
      const contentType = downloaded.data.type || "image/jpeg";
      const verified = await verifiedPut(token, apiKey, targetKey, bytes, contentType, ref.kind, ref.path);
      totalBytes += verified.size;
      files.push({
        source_bucket:SOURCE_BUCKET,
        source_path:ref.path,
        target_key:targetKey,
        bytes:verified.size,
        sha256:verified.hash,
        content_type:contentType,
        name:ref.name
      });
    }

    const manifest = {
      manifest_version:1,
      archive_id:archiveId,
      archived_at:archivedAt,
      archived_by:user.id,
      care_case:caseResult.data,
      revisions:revisions.data || [],
      audit:audit.data || [],
      files
    };

    const raw = new TextEncoder().encode(JSON.stringify(manifest));
    if (raw.byteLength > 64 * 1024 * 1024) return reply(409, { error:"archive_manifest_too_large" });
    const gz = new Uint8Array(await new Response(
      new Blob([raw]).stream().pipeThrough(new CompressionStream("gzip"))
    ).arrayBuffer());

    objectKey = base + "/versorgung.json.gz";
    const manifestVerified = await verifiedPut(token, apiKey, objectKey, gz, "application/gzip", "manifest", "");
    manifestHash = manifestVerified.hash;
    totalBytes += manifestVerified.size;
    photoCount = files.length;
    revisionCount = (revisions.data || []).length;

    const finalized=await admin.rpc("archive_mutation_for_service",{
      p_actor_id:user.id,p_care_case_id:careCaseId,p_action:"complete",
      p_data:{expected_updated_at:expectedUpdatedAt,object_key:objectKey,
        archive_sha256:manifestHash,archive_bytes:totalBytes,
        photo_count:photoCount,revision_count:revisionCount,
        object_readback_verified:true}
    });
    if(finalized.error) return reply(409,{
      error:"archive_commit_blocked",code:finalized.error.code,
      detail:"Active case was preserved; reconcile uncommitted R2 objects."
    });
  }

  let storageError:string|null = null;
  if (photoRefs.length) {
    const removed = await admin.storage.from(SOURCE_BUCKET).remove(photoRefs.map(p => p.path));
    if (removed.error) storageError = removed.error.message;
  }

  const cleanup=await admin.rpc("archive_mutation_for_service",{
    p_actor_id:user.id,p_care_case_id:careCaseId,p_action:"cleanup",
    p_data:{cleanup_error:storageError}
  });
  if(cleanup.error) return reply(500,{error:"archive_cleanup_index_failed",archived:true});
  const cleanupComplete=!storageError;
  return reply(200, {
    ok:true,
    archived:true,
    care_case_id:careCaseId,
    object_key:objectKey,
    archive_sha256:manifestHash,
    archive_bytes:totalBytes,
    photo_count:photoCount,
    revision_count:revisionCount,
    cleanup_complete:cleanupComplete,
    ...(storageError?{cleanup_warning:storageError}:{})
  });
});
