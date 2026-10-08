const { createClient } = window.supabase;

const prescriberClient = createClient(
  'https://pypljdyqjpdkismbwuag.supabase.co',
  'sb_publishable_dyiVrJQX8HYWKrWxJzqLmw_RmFAWJRI',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: window.sessionStorage
    }
  }
);

const byId = id => document.getElementById(id);

function setCaseInput(id,value){
  const el=byId(id);
  if(!el || !value) return;
  el.value=String(value);
  el.dispatchEvent(new Event('input',{bubbles:true}));
  el.dispatchEvent(new Event('change',{bubbles:true}));
}

function displayName(item){
  return [item.title,item.first_name,item.last_name].filter(Boolean).join(' ').replace(/\s+/g,' ').trim() || 'Verordner';
}

function displayAddress(item){
  return [item.street,[item.postal_code,item.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

function applyPrescriber(item,source='manuell'){
  if(!item) return;
  setCaseInput('rxDoctor',displayName(item));
  setCaseInput('rxPracticeAddress',displayAddress(item));
  setCaseInput('rxBsnr',item.bsnr||'');
  setCaseInput('rxLanr',item.lanr||'');
  const state=byId('prescriberDirectoryState');
  if(state){
    state.className='status-card ready prescriber-directory-state';
    state.textContent='Verordner aus Verzeichnis übernommen ('+source+'). BSNR und LANR bitte am Rezept gegenprüfen.';
  }
  const results=byId('prescriberDirectoryResults');
  if(results) results.replaceChildren();
}

function resultButton(item){
  const button=document.createElement('button');
  button.type='button';
  button.className='prescriber-result';
  const name=document.createElement('strong');
  name.textContent=displayName(item);
  const meta=document.createElement('small');
  const parts=[];
  const address=displayAddress(item);
  if(address) parts.push(address);
  if(item.bsnr) parts.push('BSNR '+item.bsnr);
  if(item.lanr) parts.push('LANR '+item.lanr);
  meta.textContent=parts.join(' · ');
  button.append(name,meta);
  button.addEventListener('click',()=>applyPrescriber(item,'Auswahl'));
  return button;
}

async function searchPrescribers(query){
  const results=byId('prescriberDirectoryResults');
  const state=byId('prescriberDirectoryState');
  if(!results || !state) return;
  results.replaceChildren();
  const q=String(query||'').trim();
  if(q.length<2){
    state.className='status-card open prescriber-directory-state';
    state.textContent='Suche ab 2 Zeichen; BSNR/LANR werden bevorzugt exakt gematcht.';
    return;
  }
  state.className='status-card open prescriber-directory-state';
  state.textContent='Verordner werden gesucht …';
  const {data,error}=await prescriberClient.rpc('prescriber_search',{p_query:q,p_limit:20});
  if(error){
    state.className='status-card open prescriber-directory-state';
    state.textContent='Verordnerverzeichnis derzeit nicht erreichbar.';
    return;
  }
  const list=Array.isArray(data)?data:[];
  state.className=list.length?'status-card ready prescriber-directory-state':'status-card open prescriber-directory-state';
  state.textContent=list.length?list.length+' Treffer im Verordnerverzeichnis.':'Keine passenden Verordner gefunden.';
  list.forEach(item=>results.append(resultButton(item)));
}

async function lookupPrescriptionPrescriber(source='OCR'){
  const lanr=(byId('rxLanr')?.value||'').replace(/\D/g,'');
  const bsnr=(byId('rxBsnr')?.value||'').replace(/\D/g,'');
  if(lanr.length<5 && bsnr.length<5) return;
  const state=byId('prescriberDirectoryState');
  const {data,error}=await prescriberClient.rpc('prescriber_lookup',{
    p_lanr:lanr||null,
    p_bsnr:bsnr||null
  });
  if(error) return;
  const list=Array.isArray(data)?data:[];
  if(!list.length){
    if(state){
      state.className='status-card open prescriber-directory-state';
      state.textContent='BSNR/LANR erkannt, aber kein Verordner im Verzeichnis gefunden. Bitte manuell prüfen.';
    }
    return;
  }
  const top=list[0];
  const next=list[1];
  const uniqueBest=!next || Number(top.score)>Number(next.score);
  if(uniqueBest){
    applyPrescriber(top,source+'-Matching');
    return;
  }
  const results=byId('prescriberDirectoryResults');
  if(results){
    results.replaceChildren();
    list.slice(0,10).forEach(item=>results.append(resultButton(item)));
  }
  if(state){
    state.className='status-card open prescriber-directory-state';
    state.textContent='Mehrere Verordner passen zur erkannten BSNR. Bitte passenden Eintrag auswählen.';
  }
}

function installDirectoryUi(){
  const rxYesPanel=byId('rxYesPanel');
  if(!rxYesPanel || byId('prescriberDirectorySearch')) return;

  const section=document.createElement('div');
  section.className='step-section prescriber-directory';
  const title=document.createElement('h4');
  title.textContent='Verordnerverzeichnis';
  const lead=document.createElement('p');
  lead.className='muted';
  lead.textContent='Suche nach Name, Ort, PLZ, BSNR oder LANR. Bei OCR werden LANR und BSNR automatisch gegen das Verzeichnis geprüft.';

  const row=document.createElement('div');
  row.className='prescriber-search-row';
  const input=document.createElement('input');
  input.id='prescriberDirectorySearch';
  input.type='search';
  input.autocomplete='off';
  input.placeholder='Name, Ort, BSNR oder LANR …';
  input.setAttribute('aria-label','Verordner suchen');

  const count=document.createElement('span');
  count.id='prescriberDirectoryCount';
  count.className='pill';
  count.textContent='Verzeichnis';

  row.append(input,count);

  const state=document.createElement('div');
  state.id='prescriberDirectoryState';
  state.className='status-card open prescriber-directory-state';
  state.textContent='Suche ab 2 Zeichen; BSNR/LANR werden bevorzugt exakt gematcht.';

  const results=document.createElement('div');
  results.id='prescriberDirectoryResults';
  results.className='prescriber-results';

  section.append(title,lead,row,state,results);

  const dataSection=rxYesPanel.querySelector('.step-section:nth-of-type(2)');
  if(dataSection) rxYesPanel.insertBefore(section,dataSection);
  else rxYesPanel.append(section);

  let timer=null;
  input.addEventListener('input',()=>{
    clearTimeout(timer);
    timer=setTimeout(()=>searchPrescribers(input.value),220);
  });

  ['rxBsnr','rxLanr'].forEach(id=>{
    const el=byId(id);
    if(el) el.addEventListener('change',()=>lookupPrescriptionPrescriber('Nummern'));
  });

  const ocrStatus=byId('ocrStatus');
  if(ocrStatus){
    let last='';
    const observer=new MutationObserver(()=>{
      const text=ocrStatus.textContent||'';
      if(text===last) return;
      last=text;
      if(/OCR abgeschlossen/i.test(text)) setTimeout(()=>lookupPrescriptionPrescriber('OCR'),50);
    });
    observer.observe(ocrStatus,{childList:true,subtree:true,characterData:true});
  }

  prescriberClient.rpc('prescriber_directory_count').then(({data,error})=>{
    if(!error && Number.isFinite(Number(data))) count.textContent=Number(data).toLocaleString('de-DE')+' Verordner';
  });
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',installDirectoryUi);
else installDirectoryUi();
