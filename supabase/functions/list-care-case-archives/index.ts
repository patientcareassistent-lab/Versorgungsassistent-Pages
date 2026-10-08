import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response(null,{status:204,headers:cors});
  if(req.method!=="POST") return reply(405,{error:"method_not_allowed"});

  const auth=req.headers.get("authorization")||"";
  const token=auth.startsWith("Bearer ")?auth.slice(7):"";
  if(!token) return reply(401,{error:"missing_token"});
  const c=claims(token) as Record<string,unknown>;
  if(c.aal!=="aal2"||c.is_anonymous===true) return reply(403,{error:"mfa_required"});

  const url=Deno.env.get("SUPABASE_URL")||"";
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  if(!url||!service) return reply(500,{error:"server_configuration_missing"});
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});

  const u=await admin.auth.getUser(token);
  if(u.error||!u.data.user) return reply(401,{error:"invalid_user_session"});
  const user=u.data.user;

  // Only service_role can execute this RPC. It verifies active membership
  // inside Postgres without exposing the app_private schema through PostgREST.
  const result=await admin.rpc("archive_overview_for_service",{p_actor_id:user.id});
  if(result.error){
    if(result.error.code==="42501") return reply(403,{error:"user_not_allowed"});
    console.error("archive_overview_query_failed",result.error.code, result.error.message);
    return reply(500,{error:"archive_list_failed"});
  }
  if(!Array.isArray(result.data)) return reply(500,{error:"archive_list_invalid_result"});
  return reply(200,{ok:true,archives:result.data});
});