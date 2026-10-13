/**
 * Universelles Formularregister für alle Kostenträger und Produktgruppen.
 * Keine Patienten- oder Versorgungsdaten in diesem Katalog speichern.
 * Vertragsformulare sind nur aktiv, wenn Quelle, Version und Feldmatrix geprüft wurden.
 */
const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const approved = item => item?.status === 'verified' && Boolean(item?.sha256) && /^[a-f0-9]{64}$/i.test(item.sha256) && item?.source?.kind === 'r2' && Boolean(item?.source?.objectKey);
const within = (item, when) => (!item.validFrom || when >= item.validFrom) && (!item.validUntil || when <= item.validUntil);

export function validateCatalog(catalog) {
  if (catalog?.schemaVersion !== 1 || !Array.isArray(catalog.forms)) throw new Error('Ungültiger Formularkatalog');
  const ids=new Set();
  for (const form of catalog.forms) {
    if (!form.id || !form.version || !Array.isArray(form.pg) || !form.payer || !form.formType) throw new Error('Unvollständiger Katalogeintrag');
    const id=form.id+'@'+form.version;
    if(ids.has(id)) throw new Error('Doppelte Formularversion: '+id);
    ids.add(id);
    if (form.status === 'verified' && !approved(form)) throw new Error('Aktive Formularversion ohne verifizierte R2-Quelle: '+id);
  }
  return catalog;
}

export function findForms(catalog, {payer, pg, formType, when=new Date().toISOString().slice(0,10), contractId, productArea}={}) {
  validateCatalog(catalog);
  return catalog.forms.filter(item =>
    approved(item) && within(item,when) &&
    (item.pg.includes('*') || item.pg.includes(String(pg))) &&
    (normalize(item.payer)==='*' || normalize(item.payer)===normalize(payer)) &&
    (!formType || item.formType===formType) &&
    (!item.contractId || item.contractId===contractId) &&
    (!item.productAreas?.length || item.productAreas.includes('*') || item.productAreas.includes(productArea))
  ).sort((a,b) => Number(normalize(b.payer)!=='*')-Number(normalize(a.payer)!=='*') || b.validFrom?.localeCompare(a.validFrom||'') || b.version.localeCompare(a.version));
}

/** No guessing: OCR or transcription may only target verified semantic mappings. */
export function mapTranscriptToFields(form, transcriptFields) {
  if(!approved(form)) return {accepted:{},rejected:Object.keys(transcriptFields||{})};
  const accepted={},rejected=[];
  for(const [key,value] of Object.entries(transcriptFields||{})){
    const field=form.fields?.find(f=>f.semanticKey===key && f.mappingStatus==='verified' && f.pdfFieldId);
    if(!field) rejected.push(key);
    else accepted[field.pdfFieldId]=value;
  }
  return {accepted,rejected};
}

/** A URL is returned by a protected gateway, not assembled from patient data. */
export async function fetchTemplate(gatewayBase, form, bearerToken) {
  if(!approved(form)) throw new Error('PDF-Vorlage ist nicht freigegeben');
  if(!bearerToken) throw new Error('Authentifizierung erforderlich');
  const base=new URL(gatewayBase);
  if(base.protocol!=='https:') throw new Error('HTTPS erforderlich');
  const url=new URL('/templates/'+encodeURIComponent(form.id)+'/'+encodeURIComponent(form.version),base);
  const response=await fetch(url,{headers:{Authorization:'Bearer '+bearerToken},cache:'no-store'});
  if(!response.ok) throw new Error('PDF nicht verfügbar ('+response.status+')');
  if(!/^application\/pdf(?:;|$)/i.test(response.headers.get('Content-Type')||'')) throw new Error('Antwort ist keine PDF');
  return response.arrayBuffer();
}
