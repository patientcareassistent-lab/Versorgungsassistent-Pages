// Worker module: anonymous/public access is forbidden.
// R2 contains blank, versioned contract forms only – never completed documents.
const TRUSTED_ORIGIN='https://patientcareassistent-lab.github.io';
const CATALOG_KEY='catalog/massblaetter-2026-10-13.json';
const ENTRIES_AVAILABLE=new Set(['uploaded','verified','active']);
const PROFILE_IMPORT={
  id:'aok-bw-pg24-anlage-4-profilerhebung',
  version:'2026-09-01',
  sha256:'becb2f40a35ba30804a78e41b3375a073325172844dc1270cf0b1e0bac5a4a09',
  sizeBytes:1234561,
  key:'formulare/aok-bw/pg24/2026-09-01/anlage-4_profilerhebungsbogen--becb2f40a35b.pdf'
};

function headersFor(origin){
  const h={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
  if(origin===TRUSTED_ORIGIN){
    h['Access-Control-Allow-Origin']=TRUSTED_ORIGIN;
    h['Access-Control-Allow-Headers']='authorization,content-type';
    h['Access-Control-Allow-Methods']='GET,OPTIONS';
    h['Access-Control-Max-Age']='600';
  }
  return h;
}
function fail(status,message,h){return new Response(JSON.stringify({error:message}),{status,headers:{...h,'Content-Type':'application/json'}})}
async function accessAllowed(request,env){
  const auth=request.headers.get('Authorization')||'';
  if(!/^Bearer\s+[-._~+/=a-zA-Z0-9]+$/.test(auth)) return false;
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),6000);
  try{
    const response=await fetch(env.SUPABASE_URL+'/rest/v1/rpc/current_access',{
      method:'POST',
      headers:{Authorization:auth,apikey:env.SUPABASE_PUBLIC_KEY,'Content-Type':'application/json'},
      body:'{}',
      signal:controller.signal,
      cache:'no-store'
    });
    if(!response.ok) return false;
    const result=await response.json();
    return (Array.isArray(result)?result[0]:result)?.allowed===true;
  }catch{ return false; }
  finally{clearTimeout(timeout);}
}
async function availableCatalog(env){
  const catalogObject=await env.FORMS_BUCKET.get(CATALOG_KEY);
  if(!catalogObject) return null;
  const catalog=await catalogObject.json();
  if(catalog?.schemaVersion!==1 || !Array.isArray(catalog.records)) return null;
  return catalog;
}
export default {
  async fetch(request,env){
    const origin=request.headers.get('Origin');
    const common=headersFor(origin);
    if(origin && origin!==TRUSTED_ORIGIN) return fail(403,'Origin nicht erlaubt',common);
    if(request.method==='OPTIONS') return new Response(null,{status:204,headers:common});
    const url=new URL(request.url);
    if(url.pathname==='/health' && request.method==='GET') return new Response(JSON.stringify({service:'formular-vorlagen-gateway',ready:true}),{headers:{...common,'Content-Type':'application/json'}});
    if(!(await accessAllowed(request,env))) return fail(401,'Autorisierung erforderlich',common);
    const catalog=await availableCatalog(env);
    if(!catalog) return fail(503,'Formularkatalog noch nicht verfügbar',common);
    // One-time import of the exact unchanged AOK contract PDF. No arbitrary uploads,
    // no patient documents, no object keys or expected digests from the caller.
    if(request.method==='POST' && url.pathname==='/v1/import/aok-bw-pg24-profile'){
      const expected=PROFILE_IMPORT;
      const entry=catalog.records.find(r=>r.id===expected.id && r.version===expected.version);
      if(!entry || entry.objectKey!==expected.key || entry.sha256!==expected.sha256 ||
         entry.sizeBytes!==expected.sizeBytes) return fail(409,'Katalog und vertragliche Quelle stimmen nicht überein',common);
      if(request.headers.get('content-type')?.split(';')[0].toLowerCase()!=='application/pdf')
        return fail(415,'Nur die originale PDF-Datei erlaubt',common);
      const declaredSize=Number(request.headers.get('content-length'));
      if(declaredSize > expected.sizeBytes) return fail(413,'Datei zu groß',common);
      const bytes=await request.arrayBuffer();
      if(bytes.byteLength!==expected.sizeBytes) return fail(422,'Unpassende Originaldatei',common);
      const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))]
        .map(x=>x.toString(16).padStart(2,'0')).join('');
      if(hash!==expected.sha256) return fail(422,'Dateiprüfsumme stimmt nicht mit dem Vertragsoriginal überein',common);
      await env.FORMS_BUCKET.put(expected.key,bytes,{httpMetadata:{contentType:'application/pdf'}});
      // The gateway catalog is the serving gate; only mark this exact verified file.
      entry.status='uploaded';
      await env.FORMS_BUCKET.put(CATALOG_KEY,JSON.stringify(catalog),{httpMetadata:{contentType:'application/json'}});
      return new Response(JSON.stringify({ok:true,id:expected.id,version:expected.version,verifiedSha256:hash}),{
        headers:{...common,'Content-Type':'application/json'}
      });
    }
    if(request.method!=='GET') return fail(405,'Nur GET erlaubt',common);
    if(url.pathname==='/v1/forms'){
      const forms=catalog.records.filter(r=>ENTRIES_AVAILABLE.has(r.status))
        .map(r=>({id:r.id,version:r.version,status:r.status,format:r.objectKey.endsWith('.docx')?'docx':'pdf'}));
      return new Response(JSON.stringify({forms}),{headers:{...common,'Content-Type':'application/json'}});
    }
    const match=url.pathname.match(/^\/v1\/templates\/([a-z0-9-]+)\/([a-z0-9-]+)$/);
    if(!match) return fail(404,'Unbekannte Route',common);
    const entry=catalog.records.find(r=>r.id===match[1] && r.version===match[2] && ENTRIES_AVAILABLE.has(r.status));
    if(!entry) return fail(404,'Vorlage nicht freigegeben',common);
    if(!/^(?:massblaetter|formulare)\/[a-z0-9/._-]+\.(?:pdf|docx)$/.test(entry.objectKey) || entry.objectKey.includes('..') ||
       !/^[a-f0-9]{64}$/.test(entry.sha256)) return fail(422,'Ungültige Katalogzuordnung',common);
    const file=await env.FORMS_BUCKET.get(entry.objectKey);
    if(!file || file.size!==entry.sizeBytes) return fail(503,'Vorlage fehlt oder Prüfumfang abweichend',common);
    const isPdf=entry.objectKey.endsWith('.pdf');
    return new Response(file.body,{headers:{
      ...common,'Content-Type':isPdf?'application/pdf':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition':isPdf?'inline; filename="massblatt.pdf"':'attachment; filename="massblatt.docx"',
      'X-Template-Id':entry.id,'X-Template-Version':entry.version
    }});
  }
};
