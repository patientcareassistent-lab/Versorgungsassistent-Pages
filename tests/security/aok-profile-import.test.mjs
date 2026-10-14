import test from 'node:test'
import assert from 'node:assert/strict'
import worker from '../../workers/formular-vorlagen-gateway/index.mjs'

const expectedHash='becb2f40a35ba30804a78e41b3375a073325172844dc1270cf0b1e0bac5a4a09'
const storage={writes:[],async get(key){if(key==='catalog/massblaetter-2026-10-13.json')return {json:async()=>({schemaVersion:1,records:[{id:'aok-bw-pg24-anlage-4-profilerhebung',version:'2026-09-01',sha256:expectedHash,sizeBytes:1234561,objectKey:'formulare/aok-bw/pg24/2026-09-01/anlage-4_profilerhebungsbogen--becb2f40a35b.pdf',status:'staged'}]})};return null},async put(key){this.writes.push(key)}}
const env={SUPABASE_URL:'https://example.invalid',SUPABASE_PUBLIC_KEY:'test_key',FORMS_BUCKET:storage}
const address='https://example.invalid/v1/import/aok-bw-pg24-profile'
test('anonymous import rejected',async()=>{const r=await worker.fetch(new Request(address,{method:'POST'}),env);assert.equal(r.status,401)})
test('cross-origin import rejected',async()=>{const r=await worker.fetch(new Request(address,{method:'POST',headers:{Origin:'https://invalid.example'}}),env);assert.equal(r.status,403)})
test('invalid PDF cannot be imported',async()=>{
  const originalFetch=globalThis.fetch
  globalThis.fetch=async()=>new Response('[{"allowed":true}]',{status:200})
  try{
    const r=await worker.fetch(new Request(address,{method:'POST',headers:{Authorization:'Bearer testvalue','Content-Type':'application/pdf'},body:new Uint8Array(12)}),env)
    assert.equal(r.status,422)
    assert.equal(storage.writes.length,0)
  }finally{globalThis.fetch=originalFetch}
})
