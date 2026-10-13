import test from 'node:test';
import assert from 'node:assert/strict';
import gateway from '../../workers/formular-vorlagen-gateway/index.mjs';

const sha='b'.repeat(64);
const entry={id:'massblatt-aok-bw-pg24-anlage-5b',version:'2026-09-01',
  objectKey:'massblaetter/aok-bw/pg24/2026-09-01/anlage-5b--abc123.pdf',
  sha256:sha,sizeBytes:4,status:'staged'};
const R2={
  async get(key){
    if(key==='catalog/massblaetter-2026-10-13.json'){
      return {json:async()=>({schemaVersion:1,records:[entry]})};
    }
    return {size:4,body:new Response('%PDF').body};
  }
};
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLIC_KEY:'sb_publishable_test',FORMS_BUCKET:R2};
const base='https://forms.example.workers.dev';
const originalFetch=globalThis.fetch;

test('gateway rejects anonymous clients and unsafe origin',async()=>{
  const noAuth=await gateway.fetch(new Request(base+'/v1/forms'),env);
  assert.equal(noAuth.status,401);
  const foreign=await gateway.fetch(new Request(base+'/v1/forms',{headers:{Origin:'https://evil.example',Authorization:'Bearer abc'}}),env);
  assert.equal(foreign.status,403);
});
test('gateway allows only GET/OPTIONS and never offers staged templates',async()=>{
  globalThis.fetch=async()=>new Response('[{"allowed":true}]',{status:200});
  try {
    const forbidden=await gateway.fetch(new Request(base+'/v1/forms',{method:'POST',headers:{Authorization:'Bearer abc'}}),env);
    assert.equal(forbidden.status,405);
    const out=await gateway.fetch(new Request(base+'/v1/forms',{headers:{Authorization:'Bearer abc'}}),env);
    assert.equal(out.status,200);
    assert.deepEqual((await out.json()).forms,[]);
    const file=await gateway.fetch(new Request(base+'/v1/templates/'+entry.id+'/'+entry.version,{headers:{Authorization:'Bearer abc'}}),env);
    assert.equal(file.status,404);
  } finally {globalThis.fetch=originalFetch}
});
test('verified upload can be fetched only after membership succeeds',async()=>{
  globalThis.fetch=async()=>new Response('[{"allowed":true}]',{status:200});
  entry.status='uploaded';
  try {
    const file=await gateway.fetch(new Request(base+'/v1/templates/'+entry.id+'/'+entry.version,{headers:{Authorization:'Bearer abc',Origin:'https://patientcareassistent-lab.github.io'}}),env);
    assert.equal(file.status,200);
    assert.equal(file.headers.get('content-type'),'application/pdf');
    assert.equal(file.headers.get('access-control-allow-origin'),'https://patientcareassistent-lab.github.io');
    assert.equal(await file.text(),'%PDF');
  } finally {entry.status='staged';globalThis.fetch=originalFetch}
});
