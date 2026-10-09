import { versorgungsziele } from './versorgungsziele.js'
    const { createClient } = window.supabase

    try{
      for(let i=localStorage.length-1;i>=0;i--){
        const key=localStorage.key(i)||''
        if(key==='sb-pypljdyqjpdkismbwuag-auth-token' || key.startsWith('sb-pypljdyqjpdkismbwuag-auth-token.')){
          localStorage.removeItem(key)
        }
      }
    }catch(_){}

    const supabase = createClient(
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
    )

    const $ = (id) => document.getElementById(id)

    const runtimeStyleCache = new Map()
    const runtimeStyleSlots = new WeakMap()
    const runtimeStyleAllowedProperties = new Set(['left','top','width','height','font-size'])
    const runtimeStyleValuePattern = /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:px|%)$/
    let runtimeStyleSeq = 0

    function applyRuntimeStyle(el,slot,declarations){
      if(!el) return
      const entries=Object.entries(declarations||{})
        .filter(([,value])=>value!==null && value!==undefined && value!=='')
        .map(([property,value])=>[String(property),String(value)])
        .sort(([a],[b])=>a.localeCompare(b))
      for(const [property,value] of entries){
        if(!runtimeStyleAllowedProperties.has(property)) throw new Error('Nicht erlaubte Laufzeit-CSS-Eigenschaft: '+property)
        if(!runtimeStyleValuePattern.test(value)) throw new Error('Ungültiger Laufzeit-CSS-Wert: '+value)
      }
      const key=entries.map(([property,value])=>property+':'+value).join(';')
      let assignments=runtimeStyleSlots.get(el)
      if(!assignments){
        assignments=new Map()
        runtimeStyleSlots.set(el,assignments)
      }
      const previous=assignments.get(slot)
      if(!key){
        if(previous) el.classList.remove(previous)
        assignments.delete(slot)
        return
      }
      let className=runtimeStyleCache.get(key)
      if(!className){
        className='runtime-style-'+(++runtimeStyleSeq)
        const sheet=$('appStyles')?.sheet
        if(!sheet) throw new Error('Stylesheet für Laufzeitpositionierung ist nicht verfügbar.')
        const body=entries.map(([property,value])=>property+':'+value).join(';')
        sheet.insertRule('.'+className+'{'+body+'}',sheet.cssRules.length)
        runtimeStyleCache.set(key,className)
      }
      if(previous && previous!==className) el.classList.remove(previous)
      if(previous!==className) el.classList.add(className)
      assignments.set(slot,className)
    }
    const V09_ANAMNESIS_SCOPE=true
    const ACTIVE_PRODUCT_GROUPS=new Set(['23','24'])
    const isActiveProductGroup=(pg)=>ACTIVE_PRODUCT_GROUPS.has(String(pg||'').padStart(2,'0'))
    const views = ['overview','care','supplyOverview','forms','contractQuestions','sources']
    const titles = {overview:'Wissensbasis',care:'Versorgung',supplyOverview:'Auftragsübersicht',forms:'Formularregeln',contractQuestions:'Vertragsfragen',sources:'Quellen'}
    const data = {kassen:[],produktgruppen:[],formulare:[],formularfelder:[],quellen:[],pg26:[],kalk:[],himilogik:[],massfelder:[],himiformularregeln:[],contractQuestions:[],contractKnowledge:[],approvedKnowledge:[]}
    const dataCounts = {sources:0,forms:0}
    const optionalDataLoaded = {pg26:false,contractQuestions:false,sources:false,forms:false}
    const optionalDataPromises = {}
    const loadedFormPgs = new Set()
    const formPgPromises = {}
    const loadedFormFieldPgs = new Set()
    const formFieldPgPromises = {}
    const loadedMeasureProfiles = new Set()
    const measureProfilePromises = {}
    const loadedHimiRuleIds = new Set()
    const himiRulePromises = {}
    const loadedHimiLogicPgs = new Set()
    const himiLogicPgPromises = {}
    const values = {}
    let activeSupplyId = null
    let draftSaveTimer = null
    let supplyDraftCache = []
    let archiveCache = []
    let autosaveInFlight = Promise.resolve()
    let lastPersistedSupplyFingerprint = ''

    function legacySupplyStorageKey(){
      const uid=currentSession?.user?.id || 'anonymous'
      return 'versorgungsassistent:drafts:'+uid
    }

    function readSupplyDrafts(){
      return supplyDraftCache
    }

    function mapCareCaseRow(row){
      const values=row.payload||{
        patientFirstName:row.patient_first_name||'',
        patientLastName:row.patient_last_name||'',
        patientName:row.patient_name||'',
        caseNumber:row.case_number||'',
        insuredNo:row.insured_no||'',
        caseKind:row.case_kind||''
      }
      return {
        id:row.id,
        ownerUserId:row.owner_user_id||'',
        lastModifiedBy:row.last_modified_by||'',
        createdAt:row.created_at,
        updatedAt:row.updated_at,
        wizardIndex:row.wizard_index,
        kasse:row.insurer||'',
        pg:row.product_group||'',
        himiId:row.himi_id||'',
        himi:row.himi||'',
        status:row.status||'Laufend',
        values
      }
    }

    async function loadSupplyDrafts(){
      const pageSize=250
      const rows=[]
      for(let from=0;;from+=pageSize){
        const response=await supabase
          .from('care_case_overview')
          .select('id,created_at,updated_at,wizard_index,insurer,product_group,himi_id,himi,status,schema_version,patient_first_name,patient_last_name,patient_name,case_number,insured_no,case_kind,owner_user_id,last_modified_by')
          .neq('status','Abgeschlossen')
          .order('updated_at',{ascending:false})
          .range(from,from+pageSize-1)
        if(response.error){
          showError('appError','Versorgungsdaten konnten nicht geladen werden: '+response.error.message)
          supplyDraftCache=[]
          return false
        }
        const batch=response.data||[]
        rows.push(...batch)
        if(batch.length<pageSize) break
      }
      supplyDraftCache=rows.map(mapCareCaseRow)
      renderSupplyOverview()
      return true
    }

    function normalizedLegacyId(id){
      const s=String(id||'')
      if(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) return s
      return crypto.randomUUID()
    }

    async function migrateLegacySupplyDrafts(){
      let legacy=[]
      try{
        const raw=localStorage.getItem(legacySupplyStorageKey())
        const parsed=raw?JSON.parse(raw):[]
        legacy=Array.isArray(parsed)?parsed:[]
      }catch(_){ legacy=[] }
      if(!legacy.length) return true

      const rows=legacy.slice(0,250).map(item=>({
        id:normalizedLegacyId(item.id),
        wizard_index:Number(item.wizardIndex)||0,
        insurer:item.kasse||'',
        product_group:String(item.pg||''),
        himi_id:item.himiId||'',
        himi:item.himi||'',
        status:item.status||'Laufend',
        payload:item.values||{},
        schema_version:1
      }))
      const response=await supabase.from('care_cases').upsert(rows,{onConflict:'id'})
      if(response.error){
        showError('appError','Lokale Alt-Entwürfe konnten noch nicht sicher übernommen werden: '+response.error.message)
        return false
      }
      try{ localStorage.removeItem(legacySupplyStorageKey()) }catch(_){}
      return true
    }

    function currentSupplyStatus(snapshotValues=values,stepIndex=wizardIndex){
      if(snapshotValues.approvalState==='Rückfrage' || snapshotValues.approvalState==='Abgelehnt') return 'Rückfrage / offen'
      if(snapshotValues.approvalState==='Eingereicht') return 'Warten / Genehmigung'
      if(snapshotValues.deliveryDate || stepIndex>=9) return 'Abschluss offen'
      return 'Laufend'
    }

    function ensureActiveSupplyId(){
      if(activeSupplyId) return activeSupplyId
      activeSupplyId=crypto.randomUUID()
      return activeSupplyId
    }

    function supplyPersistenceFingerprint(item){
      return JSON.stringify({
        id:item.id,
        wizardIndex:Number(item.wizardIndex)||0,
        kasse:item.kasse||'',
        pg:String(item.pg||''),
        himiId:item.himiId||'',
        himi:item.himi||'',
        status:item.status||'Laufend',
        values:item.values||{}
      })
    }

    async function autosaveSupplyDraft(force=false){
      const hasContent=Object.keys(values).some(k=>{
        const v=values[k]
        return typeof v==='boolean'?v:String(v??'').trim()!==''
      }) || !!$('careKasse')?.value || !!$('carePg')?.value || !!$('careHimi')?.value
      if((!hasContent && !force) || !currentSession) return

      if(!activeSupplyId) return
      if(!supplyHasEditableContext()) return true
      const id=activeSupplyId
      const existing=supplyDraftCache.find(x=>x.id===id)
      const semanticItem={
        id,
        wizardIndex,
        kasse:$('careKasse')?.value||'',
        pg:$('carePg')?.value||'',
        himiId:$('careHimi')?.value||values.himiId||'',
        himi:selectedHimi()||'',
        status:currentSupplyStatus(values,wizardIndex),
        values:{...values}
      }
      const fingerprint=supplyPersistenceFingerprint(semanticItem)
      if(fingerprint===lastPersistedSupplyFingerprint) return true

      const now=new Date().toISOString()
      const item={
        ...semanticItem,
        ownerUserId:existing?.ownerUserId||currentSession.user.id,
        lastModifiedBy:currentSession.user.id,
        createdAt:existing?.createdAt||now,
        updatedAt:now
      }

      const response=await supabase.from('care_cases').upsert({
        id:item.id,
        wizard_index:item.wizardIndex,
        insurer:item.kasse,
        product_group:String(item.pg||''),
        himi_id:item.himiId,
        himi:item.himi,
        status:item.status,
        payload:item.values,
        schema_version:1
      },{onConflict:'id'})
      if(response.error){
        showError('appError','Autosave fehlgeschlagen: '+response.error.message)
        return false
      }
      lastPersistedSupplyFingerprint=fingerprint
      supplyDraftCache=[item,...supplyDraftCache.filter(x=>x.id!==id)].slice(0,250)
      renderSupplyOverview()
      return true
    }

    function queueAutosaveSupply(){
      if(!supplyHasEditableContext()) return
      clearTimeout(draftSaveTimer)
      draftSaveTimer=setTimeout(()=>{
        autosaveInFlight=autosaveInFlight
          .then(()=>autosaveSupplyDraft())
          .catch(err=>showError('appError','Autosave fehlgeschlagen: '+(err?.message||String(err))))
      },1200)
    }

    async function persistActiveSupplyNow(){
      if(!supplyHasEditableContext()) return false
      clearTimeout(draftSaveTimer)
      draftSaveTimer=null
      try{ await autosaveInFlight }catch(_){}
      return await autosaveSupplyDraft(true)
    }

    async function removeRepairStoragePaths(paths){
      const unique=[...new Set((paths||[]).filter(Boolean))]
      if(!unique.length) return {ok:true,error:null}
      let lastError=null
      for(let attempt=0;attempt<2;attempt++){
        const result=await supabase.storage.from(REPAIR_PHOTO_BUCKET).remove(unique)
        if(!result.error){
          unique.forEach(path=>repairPhotoUrlCache.delete(path))
          return {ok:true,error:null}
        }
        lastError=result.error
      }
      return {ok:false,error:lastError}
    }

    function formatDraftTime(iso){
      if(!iso) return '—'
      try{return new Intl.DateTimeFormat('de-DE',{dateStyle:'short',timeStyle:'short'}).format(new Date(iso))}catch(_){return iso}
    }

    function formatArchiveBytes(bytes){
      const value=Number(bytes)||0
      if(value<1024) return value+' B'
      if(value<1024*1024) return (value/1024).toFixed(1)+' KB'
      if(value<1024*1024*1024) return (value/(1024*1024)).toFixed(1)+' MB'
      return (value/(1024*1024*1024)).toFixed(2)+' GB'
    }

    async function loadArchiveOverview(){
      if(!currentSession) return false
      const response=await supabase.functions.invoke('list-care-case-archives',{body:{}})
      if(response.error){
        archiveCache=[]
        renderArchiveOverview()
        showError('appError','Archivübersicht konnte nicht geladen werden: '+(response.error.message||String(response.error)))
        return false
      }
      archiveCache=Array.isArray(response.data?.archives)?response.data.archives:[]
      renderArchiveOverview()
      return true
    }

    function renderArchiveOverview(){
      const body=$('archiveOverviewBody')
      if(!body) return
      if(!archiveCache.length){
        body.innerHTML='<tr><td colspan="7" class="supply-empty"><strong>Noch keine archivierten Versorgungen vorhanden.</strong><small>Archivierte Vorgänge werden hier nach erfolgreicher R2-Prüfung angezeigt.</small></td></tr>'
        return
      }
      body.innerHTML=archiveCache.map(item=>{
        const patient=[item.patient_first_name,item.patient_last_name].filter(Boolean).join(' ')||item.case_number||'Versorgung'
        const caseLine=item.case_number?'<small>Vorgang: '+escapeHtml(item.case_number)+'</small>':''
        const pg=[item.product_group?'PG '+item.product_group:'',item.himi||''].filter(Boolean).join(' · ')||'—'
        const content=escapeHtml(String(item.photo_count||0))+' Bilder · '+escapeHtml(String(item.revision_count||0))+' Versionen · '+escapeHtml(formatArchiveBytes(item.archive_bytes))
        const verified=item.verification_status==='VERIFIED'
        const restored=item.status==='RESTORED'
        const status=restored
          ?'<span class="pill blue">Wiederhergestellt</span>'
          :verified
            ?'<span class="pill success">Verifiziert & ausgelagert</span>'
            :'<span class="pill warning">Prüfung offen</span>'
        const own=item.owner_user_id===currentSession?.user?.id
        const action=restored
          ?'<span class="muted">bereits aktiv</span>'
          :own
            ?'<button class="secondary no-print" type="button" data-archive-restore="'+escapeHtml(item.care_case_id)+'">Wiederherstellen</button>'
            :'<span class="muted">Nur Lesen</span>'
        return '<tr>'+
          '<td><strong>'+escapeHtml(patient)+'</strong>'+caseLine+'</td>'+
          '<td>'+escapeHtml(item.insurer||'—')+'</td>'+
          '<td>'+escapeHtml(pg)+'</td>'+
          '<td>'+escapeHtml(formatDraftTime(item.archived_at))+'</td>'+
          '<td>'+content+'</td>'+
          '<td>'+status+'</td>'+
          '<td>'+action+'</td>'+
        '</tr>'
      }).join('')
    }

    async function restoreArchivedSupply(id,button=null){
      const item=archiveCache.find(x=>x.care_case_id===id)
      if(!item) return
      if(item.owner_user_id!==currentSession?.user?.id){
        showError('appError','Nur der Ersteller kann diesen archivierten Vorgang wiederherstellen.')
        return
      }
      const patient=[item.patient_first_name,item.patient_last_name].filter(Boolean).join(' ')||item.case_number||'diese Versorgung'
      if(!window.confirm('Archivierte Versorgung „'+patient+'“ wieder in den aktiven Bestand übernehmen?')) return
      const oldText=button?.textContent||'Wiederherstellen'
      if(button){button.disabled=true;button.textContent='Wiederherstellung …'}
      try{
        const result=await supabase.functions.invoke('restore-care-case',{body:{care_case_id:id}})
        if(result.error){
          let detail=result.error.message||'Wiederherstellungsdienst nicht erreichbar.'
          try{
            const context=result.error.context
            if(context?.json){
              const body=await context.json()
              if(body?.detail) detail=body.detail
              else if(body?.error) detail=body.error
            }
          }catch(_){}
          throw new Error(detail)
        }
        if(!result.data?.ok) throw new Error(result.data?.error||'Wiederherstellung wurde nicht bestätigt.')
        await loadSupplyDrafts()
        await loadArchiveOverview()
        const restored=readSupplyDrafts().find(x=>x.id===id)
        if(restored) await restoreSupplyDraft(id)
        else setView('supplyOverview')
        showError('appError','')
      }catch(err){
        console.error(err)
        showError('appError','Wiederherstellung fehlgeschlagen: '+(err?.message||String(err)))
      }finally{
        if(button){button.textContent=oldText;button.disabled=false}
      }
    }

    function supplyStepLabel(item){
      const i=Math.max(0,Math.min(Number(item.wizardIndex)||0,wizardSteps.length-1))
      return (i+1)+'. '+wizardSteps[i].name
    }

    function renderSupplyOverview(){
      const body=$('supplyOverviewBody')
      if(!body) return
      const drafts=readSupplyDrafts().filter(x=>x.status!=='Abgeschlossen' && isActiveProductGroup(x.pg))
      const q=($('supplySearch')?.value||'').trim().toLowerCase()
      const status=$('supplyStatusFilter')?.value||''
      const pg=$('supplyPgFilter')?.value||''

      const pgs=[...new Set(drafts.map(x=>String(x.pg||'')).filter(Boolean))].sort((a,b)=>Number(a)-Number(b))
      if($('supplyPgFilter')){
        const old=$('supplyPgFilter').value
        $('supplyPgFilter').innerHTML='<option value="">Alle Produktgruppen</option>'+pgs.map(x=>'<option value="'+escapeHtml(x)+'">PG '+escapeHtml(x)+'</option>').join('')
        if(pgs.includes(old)) $('supplyPgFilter').value=old
      }

      $('supplyCountActive').textContent=drafts.filter(x=>x.status==='Laufend').length
      $('supplyCountWaiting').textContent=drafts.filter(x=>x.status==='Warten / Genehmigung').length
      $('supplyCountQuery').textContent=drafts.filter(x=>x.status==='Rückfrage / offen').length
      $('supplyCountClose').textContent=drafts.filter(x=>x.status==='Abschluss offen').length

      const filtered=drafts.filter(x=>{
        if(status && x.status!==status) return false
        if(pg && String(x.pg)!==String(pg)) return false
        if(q){
          const hay=[x.values?.patientFirstName,x.values?.patientLastName,x.values?.patientName,x.values?.caseNumber,x.kasse,x.pg,x.himi,x.values?.insuredNo].join(' ').toLowerCase()
          if(!hay.includes(q)) return false
        }
        return true
      })

      if(!filtered.length){
        body.innerHTML='<tr><td colspan="7" class="supply-empty"><strong>Keine passenden Versorgungen.</strong><small>Filter anpassen oder eine neue Versorgung beginnen. Änderungen werden automatisch zwischengespeichert.</small></td></tr>'
        return
      }

      body.innerHTML=filtered.map(x=>{
        const name=([x.values?.patientFirstName,x.values?.patientLastName].filter(Boolean).join(' ')||x.values?.patientName||'Patient noch nicht erfasst')
        const caseNo=x.values?.caseNumber||x.id.slice(0,8)
        const pgText=x.pg?'PG '+escapeHtml(x.pg):'PG offen'
        const caseKind=x.values?.caseKind||''
        const caseKindClass=caseKind==='Reparatur'?'warning':caseKind==='Neuversorgung'?'blue':''
        const caseKindText=caseKind||'Nicht erfasst'
        return '<tr class="supply-row" data-supply-id="'+escapeHtml(x.id)+'" tabindex="0" title="Versorgung öffnen">'+
          '<td><strong>'+escapeHtml(name)+'</strong><br><small>'+escapeHtml(caseNo)+'</small></td>'+
          '<td><span class="pill '+caseKindClass+'">'+escapeHtml(caseKindText)+'</span></td>'+
          '<td>'+escapeHtml(x.kasse||'—')+'</td>'+
          '<td>'+pgText+(x.himi?'<br><small>'+escapeHtml(x.himi)+'</small>':'')+'</td>'+
          '<td>'+escapeHtml(supplyStepLabel(x))+'</td>'+
          '<td><span class="pill '+(x.status==='Rückfrage / offen'?'warning':x.status==='Warten / Genehmigung'?'blue':'')+'">'+escapeHtml(x.status)+'</span></td>'+
          '<td>'+escapeHtml(formatDraftTime(x.updatedAt))+'</td>'+
        '</tr>'
      }).join('')
    }

    async function restoreSupplyDraft(id){
      let item=readSupplyDrafts().find(x=>x.id===id)
      if(!item) return
      const detail=await supabase
        .from('care_cases')
        .select('id,created_at,updated_at,wizard_index,insurer,product_group,himi_id,himi,status,payload,schema_version,owner_user_id,last_modified_by')
        .eq('id',id)
        .single()
      if(detail.error){
        showError('appError','Versorgung konnte nicht geöffnet werden: '+detail.error.message)
        return
      }
      item=mapCareCaseRow(detail.data)
      supplyDraftCache=[item,...supplyDraftCache.filter(x=>x.id!==id)].slice(0,250)
      activeSupplyId=item.id
      lastPersistedSupplyFingerprint=supplyPersistenceFingerprint(item)
      Object.keys(values).forEach(k=>delete values[k])
      Object.assign(values,item.values||{})
      if(!values.caseKind) values.caseKind='Neuversorgung'
      if(values.patientName && !values.patientFirstName && !values.patientLastName){
        values.patientLastName=values.patientName
      }
      wizardIndex=Math.max(0,Math.min(Number(item.wizardIndex)||0,wizardSteps.length-1))
      $('careKasse').value=item.kasse||''
      $('carePg').value=item.pg||''
      values.himiId=item.himiId||values.himiId||''
      populateHimiOptions()
      if(values.himiId) $('careHimi').value=values.himiId
      document.querySelectorAll('[data-case-field]').forEach(el=>writeCaseField(el,values[el.dataset.caseField]))
      updateCare()
      syncCaseKind()
      renderMeasureFields()
      syncRxPresence()
      renderRepairPhotos()
      renderRepairLabelPhotos()
      renderWizard()
      setView('care')
      updateSupplyEditState()
    }

    const himiByPg = {
      '04':['Badehilfe','Duschhilfe','Badewannenhilfe','Toilettennahe Bad-/Duschhilfe'],
      '05':['Bandage – obere Extremität','Bandage – untere Extremität','Bandage – Rumpf'],
      '08':['Einlage – stützend/bettend','Einlage – diabetes-/drucksensibel','Einlage – Sonderanfertigung'],
      '10':['Gehstock / Unterarmgehstütze','Gehgestell / Rollator','Spezial-Gehhilfe'],
      '11':['Sitzkissen / Sitzsystem gegen Dekubitus','Matratze / Liegesystem gegen Dekubitus','sonstige Dekubitusversorgung'],
      '15':['aufsaugende Inkontinenzhilfe','ableitende Inkontinenzhilfe','sonstige Inkontinenzhilfe'],
      '17':['Kompressionsstrumpf / -versorgung','Kompressionsversorgung obere Extremität','Kompressionsversorgung untere Extremität','Sonderversorgung'],
      '18':['manueller Rollstuhl','E-Rollstuhl','Zusatzantrieb / Schiebehilfe','Treppensteighilfe','sonstiges Kranken-/Behindertenfahrzeug'],
      '20':['Lagerungssystem','Lagerungshilfe Sitz','Lagerungshilfe Liegen'],
      '22':['Patientenlifter','Aufstehlifter / Aktivlifter','Rampensystem','Straßenverkehr / Fahrzeuganpassung','sonstige Mobilitätshilfe PG22'],
      '23':['Orthese untere Extremität','Orthese obere Extremität','Korsett / Rumpforthese','Mieder','sonstige individuelle Orthese'],
      '24':['Vor-/Mittelfußprothese','Fuß-/Fußwurzel-/Rückfußprothese','Unterschenkelprothese','Knie-Exartikulationsprothese','Oberschenkelprothese','Hüft-Exartikulations-/Hemipelvisprothese'],
      '26':['individuelle Sitzschale','Sitzschale mit Untergestell','Sitzsystem / Sitzeinheit','Änderung / Anpassung Sitzschale'],
      '28':['Stehständer / Stehhilfe','dynamische Stehhilfe','sonstige Stehversorgung'],
      '31':['Schuhversorgung diabetisches Fußsyndrom','orthopädischer Maßschuh','Zurichtung / Sonderversorgung'],
      '32':['fremdkraftbetriebener Bewegungstrainer','eigenkraftbetriebener Bewegungstrainer','sonstiger therapeutischer Bewegungstrainer'],
      '33':['Toilettenstuhl','Toilettensitzerhöhung','Dusch-/Toilettenkombination','sonstige Toilettenhilfe'],
      '38':['Finger-/Handprothese','Unterarmprothese','Ellenbogen-Exartikulationsprothese','Oberarmprothese','Schulter-Exartikulations-/Forequarterprothese']
    }
    let currentSession = null
    let factorId = ''
    const IDLE_TIMEOUT_MS=30*60*1000
    const ACCESS_RECHECK_MS=10*60*1000
    let lastUserActivityAt=Date.now()
    let lastAccessCheckAt=0
    let idleGuardTimer=null

    function markUserActivity(){
      lastUserActivityAt=Date.now()
    }

    function clearSensitiveRuntimeState(){
      clearTimeout(draftSaveTimer)
      draftSaveTimer=null
      activeSupplyId=null
      supplyDraftCache=[]
      lastPersistedSupplyFingerprint=''
      Object.keys(values).forEach(key=>delete values[key])
      try{ repairPhotoUrlCache.clear() }catch(_){}
      clearTimeout(profileAiRecordingTimer)
      profileAiRecordingTimer=null
      try{
        if(profileAiRecorder){
          profileAiRecorder.ondataavailable=null
          profileAiRecorder.onstop=null
          if(profileAiRecorder.state==='recording') profileAiRecorder.stop()
        }
      }catch(_){}
      try{ profileAiStream?.getTracks().forEach(track=>track.stop()) }catch(_){}
      profileAiRecorder=null
      profileAiStream=null
      profileAiChunks=[]
      profileAsrPromise=null
      try{ window.WhisperCppRuntime?.reset?.() }catch(_){}

      document.querySelectorAll('#careView input,#careView textarea').forEach(el=>{
        if(el.type==='checkbox'||el.type==='radio') el.checked=false
        else {
          try{ el.value='' }catch(_){}
        }
      })
      document.querySelectorAll('#careView select').forEach(el=>{ el.selectedIndex=0 })
      document.querySelectorAll('#careView canvas').forEach(canvas=>{
        try{ canvas.width=canvas.width }catch(_){}
      })

      ;['fieldList','measureFieldList','repairPhotoGallery','repairLabelGallery'].forEach(id=>{
        const el=$(id)
        if(el) el.replaceChildren()
      })
      if($('supplyOverviewBody')) $('supplyOverviewBody').replaceChildren()
      if($('currentUser')) $('currentUser').textContent=''
      if($('rxOcrRaw')) $('rxOcrRaw').value=''
      if($('profileAiTranscript')) $('profileAiTranscript').value=''
    }

    function stopIdleSessionGuard(){
      if(idleGuardTimer) clearInterval(idleGuardTimer)
      idleGuardTimer=null
    }

    async function endSessionForSecurity(message){
      stopIdleSessionGuard()
      clearSensitiveRuntimeState()
      try{ await supabase.auth.signOut() }catch(_){}
      currentSession=null
      showLogin()
      showError('loginError',message)
    }

    async function enforceIdleSession(){
      if(!currentSession) return
      if(Date.now()-lastUserActivityAt<IDLE_TIMEOUT_MS) return
      await endSessionForSecurity('Sitzung wegen Inaktivität beendet. Bitte erneut anmelden.')
    }

    async function revalidateSessionAccess(force=false){
      if(!currentSession) return true
      const now=Date.now()
      if(!force && now-lastAccessCheckAt<ACCESS_RECHECK_MS) return true
      lastAccessCheckAt=now
      const access=await supabase.rpc('current_access')
      if(access.error || !access.data?.[0]?.allowed){
        await endSessionForSecurity('Zugriffsberechtigung konnte nicht bestätigt werden. Bitte erneut anmelden.')
        return false
      }
      return true
    }

    function startIdleSessionGuard(){
      markUserActivity()
      if(!idleGuardTimer) idleGuardTimer=setInterval(()=>{
        void enforceIdleSession()
        void revalidateSessionAccess(false)
      },60000)
    }

    ;['pointerdown','keydown','input','touchstart'].forEach(type=>{
      document.addEventListener(type,()=>{ if(currentSession) markUserActivity() },{passive:true})
    })
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='visible'){
        void enforceIdleSession()
        void revalidateSessionAccess(true)
      }
    })

    function escapeHtml(value){
      return String(value ?? '—').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))
    }
    function showError(id,message){ const el=$(id); el.textContent=message||''; el.classList.toggle('hidden',!message) }
    function showLoading(show=true){ $('loading').classList.toggle('hidden',!show) }
    function friendlyUser(email){ return email?.split('@')[0]?.replace(/^mitarbeiter/i,'Mitarbeiter') || 'Tester' }

    async function loadOptionalData(section){
      if(optionalDataLoaded[section]) return true
      if(optionalDataPromises[section]) return optionalDataPromises[section]

      optionalDataPromises[section]=(async()=>{
        const rpcName=section==='pg26'
          ? 'pg26_reference_bootstrap'
          : section==='contractQuestions'
            ? 'contract_knowledge_bootstrap'
            : section==='sources'
              ? 'sources_reference_bootstrap'
              : section==='forms'
                ? 'forms_reference_bootstrap'
                : ''
        if(!rpcName) return true

        const response=await supabase.rpc(rpcName)
        if(response.error){
          showError('appError','Zusatzdaten konnten nicht geladen werden: '+response.error.message)
          return false
        }
        const payload=response.data||{}
        if(section==='sources'){
          data.quellen=Array.isArray(payload)?payload:[]
        }else if(section==='forms'){
          data.formulare=Array.isArray(payload)?payload:[]
          data.formulare.forEach(f=>{if(f?.PG!==undefined&&f?.PG!==null) loadedFormPgs.add(String(f.PG))})
        }else if(section==='pg26'){
          data.pg26=Array.isArray(payload.pg26)?payload.pg26:[]
          data.kalk=Array.isArray(payload.kalk)?payload.kalk:[]
        }else{
          data.contractQuestions=Array.isArray(payload.contractQuestions)?payload.contractQuestions:[]
          data.contractKnowledge=Array.isArray(payload.contractKnowledge)?payload.contractKnowledge:[]
          data.approvedKnowledge=Array.isArray(payload.approvedKnowledge)?payload.approvedKnowledge:[]
        }
        optionalDataLoaded[section]=true

        if(section==='pg26'){
          const current=$('pg26Kasse')?.value||''
          const kassen=[...new Set(data.pg26.map(x=>x.Kasse).filter(Boolean))].sort()
          $('pg26Kasse').innerHTML='<option value="">Alle</option>'+kassen.map(x=>'<option>'+escapeHtml(x)+'</option>').join('')
          if(kassen.includes(current)) $('pg26Kasse').value=current
          renderPg26()
          if(!V09_ANAMNESIS_SCOPE){
            $('calcCount').textContent=data.kalk.length+' Positionen'
            $('calcBody').innerHTML=data.kalk.map(r=>'<tr><td>'+escapeHtml(r.Abschnitt)+'</td><td>'+escapeHtml(r.Art_Nr)+'</td><td>'+escapeHtml(r.Bezeichnung)+'</td><td>'+(r.AZ_gerundet_min?escapeHtml(r.AZ_gerundet_min)+' min':'—')+'</td><td>'+(r.Material_Position_EUR?escapeHtml(r.Material_Position_EUR)+' €':'—')+'</td><td>'+escapeHtml(r.Summe_oder_Regel)+'</td></tr>').join('')
          }
        }else if(section==='contractQuestions'){
          renderContractKnowledge($('knowledgeSearch')?.value||'')
        }else if(section==='sources'){
          $('sourceGrid').innerHTML=data.quellen.map(r=>'<article class="source"><span class="pill">'+escapeHtml(r.Typ)+'</span><h4>'+escapeHtml(r.Beschreibung)+'</h4><p>'+escapeHtml(r.URL_oder_Datei)+'</p><small>'+escapeHtml(r.Quelle_ID)+'</small></article>').join('')
        }else if(section==='forms'){
          renderForms($('formSearch')?.value||'')
        }
        showError('appError','')
        return true
      })().finally(()=>{delete optionalDataPromises[section]})

      return optionalDataPromises[section]
    }

    async function ensureHimiLogicForPg(pg){
      const key=String(pg||'')
      if(!key || loadedHimiLogicPgs.has(key)) return true
      if(himiLogicPgPromises[key]) return himiLogicPgPromises[key]

      himiLogicPgPromises[key]=(async()=>{
        const response=await supabase.rpc('himi_logic_for_pg',{p_pg:key})
        if(response.error){
          showError('appError','Hilfsmittellogik konnte nicht geladen werden: '+response.error.message)
          return false
        }
        const rows=Array.isArray(response.data)?response.data:[]
        data.himilogik=[
          ...data.himilogik.filter(h=>String(h.PG)!==key),
          ...rows
        ]
        loadedHimiLogicPgs.add(key)
        showError('appError','')
        return true
      })().finally(()=>{delete himiLogicPgPromises[key]})

      const ok=await himiLogicPgPromises[key]
      if(ok && $('carePg')?.value===key){
        populateHimiOptions()
        updateCare()
        renderWizard()
      }
      return ok
    }

    async function ensureFormsForPg(pg){
      const key=String(pg||'')
      if(!key || optionalDataLoaded.forms || loadedFormPgs.has(key)) return true
      if(formPgPromises[key]) return formPgPromises[key]

      formPgPromises[key]=(async()=>{
        const response=await supabase.rpc('forms_for_pg',{p_pg:key})
        if(response.error){
          showError('appError','Formulardefinitionen konnten nicht geladen werden: '+response.error.message)
          return false
        }
        const rows=Array.isArray(response.data)?response.data:[]
        data.formulare=[
          ...data.formulare.filter(f=>String(f.PG)!==key),
          ...rows
        ]
        loadedFormPgs.add(key)
        showError('appError','')
        return true
      })().finally(()=>{delete formPgPromises[key]})

      const ok=await formPgPromises[key]
      if(ok && $('carePg')?.value===key){
        updateCare()
        updateWizardStatus()
      }
      return ok
    }

    async function ensureFormFieldsForPg(pg){
      const key=String(pg||'')
      if(!key) return true
      if(loadedFormFieldPgs.has(key)) return true
      if(formFieldPgPromises[key]) return formFieldPgPromises[key]

      formFieldPgPromises[key]=(async()=>{
        const response=await supabase.rpc('form_fields_for_pg',{p_pg:key})
        if(response.error){
          showError('appError','Formularfelder konnten nicht geladen werden: '+response.error.message)
          return false
        }
        const rows=Array.isArray(response.data)?response.data:[]
        data.formularfelder=[
          ...data.formularfelder.filter(f=>String(f.PG)!==key),
          ...rows
        ]
        loadedFormFieldPgs.add(key)
        showError('appError','')
        return true
      })().finally(()=>{delete formFieldPgPromises[key]})

      const ok=await formFieldPgPromises[key]
      if(ok && $('carePg')?.value===key){
        updateCareFields()
        updateWizardStatus()
      }
      return ok
    }

    async function ensureMeasureFieldsForProfile(profileId){
      const key=String(profileId||'')
      if(!key || loadedMeasureProfiles.has(key)) return true
      if(measureProfilePromises[key]) return measureProfilePromises[key]

      measureProfilePromises[key]=(async()=>{
        const response=await supabase.rpc('measure_fields_for_profile',{p_profile:key})
        if(response.error){
          showError('appError','Maßfelder konnten nicht geladen werden: '+response.error.message)
          return false
        }
        const rows=Array.isArray(response.data)?response.data:[]
        data.massfelder=[
          ...data.massfelder.filter(f=>String(f.Massprofil_ID)!==key),
          ...rows
        ]
        loadedMeasureProfiles.add(key)
        showError('appError','')
        return true
      })().finally(()=>{delete measureProfilePromises[key]})

      const ok=await measureProfilePromises[key]
      if(ok && selectedHimiMeta()?.Massprofil_ID===key){
        renderMeasureFields()
        updateWizardStatus()
      }
      return ok
    }

    async function ensureHimiFormRules(himiId){
      const key=String(himiId||'')
      if(!key || loadedHimiRuleIds.has(key)) return true
      if(himiRulePromises[key]) return himiRulePromises[key]

      himiRulePromises[key]=(async()=>{
        const response=await supabase.rpc('himi_form_rules_for_himi',{p_himi_id:key})
        if(response.error){
          showError('appError','Formularregeln konnten nicht geladen werden: '+response.error.message)
          return false
        }
        const rows=Array.isArray(response.data)?response.data:[]
        data.himiformularregeln=[
          ...data.himiformularregeln.filter(r=>String(r.Himi_ID)!==key),
          ...rows
        ]
        loadedHimiRuleIds.add(key)
        showError('appError','')
        return true
      })().finally(()=>{delete himiRulePromises[key]})

      const ok=await himiRulePromises[key]
      if(ok && selectedHimiId()===key){
        updateCare()
        updateWizardStatus()
      }
      return ok
    }

    async function start(){
      const {data:{session}} = await supabase.auth.getSession()
      showLoading(false)
      if(session) await handleSession(session)
      else showLogin()
    }

    function showLogin(){
      $('auth').classList.remove('hidden'); $('app').classList.add('hidden')
      $('loginPane').classList.remove('hidden'); $('mfaPane').classList.add('hidden')
    }

    async function handleSession(session){
      currentSession=session
      const aal=await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if(aal.error){ showLogin(); showError('loginError',aal.error.message); return }
      if(aal.data.currentLevel==='aal2'){ await openApp(session); return }

      const preMfaAccess=await supabase.rpc('mfa_enrollment_access')
      if(preMfaAccess.error || preMfaAccess.data!==true){
        await endSessionForSecurity('Zugriffsberechtigung konnte nicht bestätigt werden. Bitte erneut anmelden.')
        return
      }

      const factors=await supabase.auth.mfa.listFactors()
      if(factors.error){ showLogin(); showError('loginError',factors.error.message); return }
      const verified=(factors.data.totp||[]).find(f=>f.status==='verified') || (factors.data.totp||[])[0]

      $('auth').classList.remove('hidden'); $('app').classList.add('hidden')
      $('loginPane').classList.add('hidden'); $('mfaPane').classList.remove('hidden')
      showError('mfaError','')

      if(verified){
        factorId=verified.id
        $('mfaText').textContent='Aktuellen Code aus Microsoft Authenticator eingeben.'
        $('qr').classList.add('hidden'); $('secretDetails').classList.add('hidden')
      }else{
        const enrolled=await supabase.auth.mfa.enroll({factorType:'totp',friendlyName:'Versorgungsassistent'})
        if(enrolled.error){ showError('mfaError',enrolled.error.message); return }
        factorId=enrolled.data.id
        $('qr').src=enrolled.data.totp.qr_code
        $('qr').classList.remove('hidden')
        $('secret').textContent=enrolled.data.totp.secret
        $('secretDetails').classList.remove('hidden')
        $('mfaText').textContent='QR-Code mit Microsoft Authenticator scannen und anschließend den aktuellen sechsstelligen Code eingeben.'
      }
    }

    async function failClosedStartup(message){
      showLoading(false)
      try{ await supabase.auth.signOut() }catch(_){}
      currentSession=null
      showLogin()
      showError('loginError',message||'Die Anwendung konnte nicht sicher geladen werden. Bitte erneut anmelden.')
    }

    async function openApp(session){
      showLoading(true)
      $('password').value=''
      $('otp').value=''
      $('secret').textContent=''
      $('secretDetails').classList.add('hidden')
      $('qr').removeAttribute('src')
      $('qr').classList.add('hidden')
      const access=await supabase.rpc('current_access')
      if(access.error || !access.data?.[0]?.allowed){
        showLoading(false); $('auth').classList.remove('hidden'); $('app').classList.add('hidden')
        $('loginPane').classList.add('hidden'); $('mfaPane').classList.remove('hidden')
        showError('mfaError',access.error?.message || 'Dieser Benutzer ist nicht für den Versorgungsassistenten freigegeben.')
        return
      }
      lastAccessCheckAt=Date.now()

      const bootstrap=await supabase.rpc('care_reference_bootstrap')
      if(bootstrap.error){
        await failClosedStartup('Die fachliche Datenbasis konnte nicht sicher geladen werden. Bitte erneut anmelden.')
        return
      }
      const payload=bootstrap.data||{}
      ;['kassen','produktgruppen'].forEach(key=>{
        data[key]=Array.isArray(payload[key])?payload[key]:[]
      })
      dataCounts.sources=Number(payload.sourceCount)||0
      dataCounts.forms=Number(payload.formCount)||0
      if(!data.kassen.length || !data.produktgruppen.length){
        await failClosedStartup('Die fachliche Datenbasis ist unvollständig. Die Anwendung wurde vorsorglich nicht geöffnet.')
        return
      }
      showError('appError','')

      const legacyOk=await migrateLegacySupplyDrafts()
      if(!legacyOk){
        await failClosedStartup('Lokale Alt-Entwürfe konnten nicht sicher übernommen werden. Die Anwendung wurde nicht geöffnet.')
        return
      }
      const casesOk=await loadSupplyDrafts()
      if(!casesOk){
        await failClosedStartup('Die Versorgungsübersicht konnte nicht sicher geladen werden. Die Anwendung wurde nicht geöffnet.')
        return
      }
      await loadArchiveOverview()

      $('currentUser').textContent=friendlyUser(session.user.email)
      $('auth').classList.add('hidden'); $('app').classList.remove('hidden')
      startIdleSessionGuard()
      showLoading(false)
      populateSelectors()
      renderAll()
      updateCare()
      bindWizardInputs()
      setView('supplyOverview')
      renderWizard()
      renderSupplyOverview()
      updateSupplyEditState()
    }

    function selectedHimiId(){ return $('careHimi').value||values.himiId||'' }
    function selectedHimiMeta(){ return data.himilogik.find(x=>x.Himi_ID===selectedHimiId()) || null }
    function selectedHimi(){ return selectedHimiMeta()?.Bezeichnung || $('careHimi').selectedOptions?.[0]?.textContent || '' }

    function populateHimiOptions(){
      const pg=$('carePg').value
      if(pg && !loadedHimiLogicPgs.has(String(pg))){
        $('careHimi').innerHTML='<option value="">Hilfsmittellogik wird geladen …</option>'
        void ensureHimiLogicForPg(pg)
        return
      }
      const dbOptions=data.himilogik.filter(x=>String(x.PG)===String(pg)&&x.Aktiv!==false).sort((a,b)=>(a.Sortierung||100)-(b.Sortierung||100))
      if(dbOptions.length){
        $('careHimi').innerHTML='<option value="">Bitte Hilfsmittel wählen</option>'+dbOptions.map(x=>'<option value="'+escapeHtml(x.Himi_ID)+'">'+escapeHtml(x.Bezeichnung)+'</option>').join('')
        if(values.himiId && dbOptions.some(x=>x.Himi_ID===values.himiId)) $('careHimi').value=values.himiId
        else values.himiId=''
      }else{
        const options=himiByPg[pg]||[]
        $('careHimi').innerHTML=options.length
          ? '<option value="">Bitte Hilfsmittel wählen</option>'+options.map(x=>'<option value="'+escapeHtml(x)+'">'+escapeHtml(x)+'</option>').join('')
          : '<option value="">Für diese PG noch keine Himi-Unterteilung hinterlegt</option>'
        if(values.himiId && options.includes(values.himiId)) $('careHimi').value=values.himiId
        else values.himiId=''
      }
      syncSupplyTypeOptions()
      syncSituationFields()
      renderMeasureFields()
    }

    function norm(value){
      return String(value||'').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
        .replace(/[^a-z0-9äöüß]+/g,' ')
        .trim()
    }

    function himiKeywordsFromMeta(meta){
      if(meta?.Suchbegriffe?.length) return meta.Suchbegriffe
      const h=norm(selectedHimi())
      return h.split(' ').filter(x=>x.length>3)
    }

    function formMatchesPgValue(formPg,pg){
      if(!pg) return true
      const raw=String(formPg||'').trim()
      if(!raw) return true
      if(norm(raw)==='diverse') return true
      return raw.split(/[\/;,]+/).map(x=>x.trim()).filter(Boolean).includes(String(pg))
    }

    function formMatchesHimi(form){
      const meta=selectedHimiMeta()
      if(!selectedHimiId()) return true
      const formPg=String(form.PG||'').trim()
      if(formPg.includes('/') || norm(formPg)==='diverse') return true
      const text=norm([form.Versorgungsart,form.Region_Vertrag,form.Beleg,form.Aktion_Versorgungsassistent].join(' '))
      const keys=himiKeywordsFromMeta(meta).map(norm)
      return !keys.length || keys.some(k=>text.includes(k))
    }

    function syncSupplyTypeOptions(){
      const el=$('careSupplyType')
      if(!el) return
      const current=values.supplyType||el.value
      const options=ALL_SUPPLY_TYPES
      el.innerHTML='<option value="">Bitte Versorgungsart wählen</option>'+options.map(x=>'<option>'+escapeHtml(x)+'</option>').join('')
      if(options.includes(current)){
        el.value=current
        values.supplyType=current
      }else{
        el.value=''
        if(current) values.supplyType=''
      }
    }

    function createDynamicControl(f,keyPrefix){
      let control
      const type=String(f.Datentyp||'Text')
      if(type.includes('Ja/Nein')){
        control=document.createElement('select')
        control.innerHTML='<option value="">Bitte wählen</option><option>Ja</option><option>Nein</option>'
      }else if(type==='Datum'){
        control=document.createElement('input');control.type='date'
      }else if(type==='Zahl'){
        control=document.createElement('input');control.type='number'
      }else if(type==='Langtext'||type==='Messreihe'||type.includes('Langtext')){
        control=document.createElement('textarea');control.rows=3
      }else if(type==='Auswahl'){
        control=document.createElement('select')
        const raw=String(f.Einheit_Optionen||f.Bedingung_UI||'')
        const options=raw.split('|').map(x=>x.trim()).filter(Boolean)
        control.innerHTML='<option value="">Bitte wählen</option>'+options.map(x=>'<option>'+escapeHtml(x)+'</option>').join('')
      }else{
        control=document.createElement('input')
      }
      const key=keyPrefix+f.Massfeld_ID
      control.dataset.measureKey=key
      control.dataset.measureFieldId='M-'+String(f.Massfeld_ID||'').replace(/[^A-Za-z0-9_-]/g,'_')
      control.dataset.measureLabel=String(f.Feldbezeichnung||'Maßfeld')
      control.dataset.measureContext=[f.Abschnitt,f.Einheit_Optionen].filter(Boolean).join(' · ')
      control.setAttribute('aria-label',control.dataset.measureFieldId+' · '+control.dataset.measureLabel)
      control.dataset.required=String(f.Pflichtstatus).toLowerCase()==='ja'?'true':'false'
      if(values[key]!==undefined) control.value=values[key]
      const save=()=>{values[key]=control.value;showWizardError('');updateWizardStatus()}
      control.addEventListener('input',save);control.addEventListener('change',save)
      return control
    }

    function goalSuggestionsForCurrentSupply(){
      const pg=String($('carePg')?.value||'')
      if(!['23','24'].includes(pg)) return []
      const kind=String(values.supplyType||$('careSupplyType')?.value||'')
      const region=String(values['GEN_23_region_24']||values.region||selectedHimi()||'').toLowerCase()
      const regionType=region.includes('rumpf')||region.includes('wirbels')?'rumpf':region.includes('obere')||region.includes('arm')?'obere':region.includes('untere')||region.includes('bein')?'untere':'alle'
      const kindMatch=(x)=>{
        if(x.art==='alle') return true
        if(x.art==='Reparatur') return /reparatur|instand|änderung/i.test(kind)
        if(x.art==='Folge') return /folge|wechsel/i.test(kind)
        return kind.toLowerCase().includes(x.art.toLowerCase())
      }
      return versorgungsziele.filter(x=>x.pg===pg&&(x.region==='alle'||regionType==='alle'||x.region===regionType)&&kindMatch(x))
    }

    function attachGoalPicker(parent, control, key){
      if(!parent||!control) return
      const pick=document.createElement('select')
      pick.setAttribute('aria-label','Versorgungszielvorschlag')
      pick.innerHTML='<option value="">Versorgungsziel vorschlagen …</option>'+goalSuggestionsForCurrentSupply().map(x=>'<option value="'+escapeHtml(x.id)+'">'+escapeHtml(x.ziel)+'</option>').join('')
      const info=document.createElement('small')
      info.textContent='Fachliche Formulierungshilfe – individuell prüfen, anpassen und konkretisieren. Freitext bleibt möglich.'
      pick.addEventListener('change',()=>{
        const goal=versorgungsziele.find(x=>x.id===pick.value && goalSuggestionsForCurrentSupply().some(y=>y.id===x.id))
        if(!goal)return
        const old=String(control.value||'').trim()
        control.value=old?(old.includes(goal.ziel)?old:old+'\\n'+goal.ziel):goal.ziel
        control.dispatchEvent(new Event('input',{bubbles:true}))
        pick.value=''
      })
      parent.append(pick,info)
      if(key==='versorgungGoalText') control.dataset.goalText='true'
    }

    function syncLegacyGoalIntoPlanning(){
      // Previous versions captured the goal in profile fields. Preserve those
      // values and use the post-measure planGoal as the single editing point.
      const keys=['versorgungGoalText','tech:therapyGoal',...Object.keys(values).filter(k=>/^GEN_23_/.test(k)&&/goal/i.test(k))]
      if(!String(values.planGoal||'').trim()){
        const existing=keys.map(k=>String(values[k]||'').trim()).find(Boolean)
        if(existing) values.planGoal=existing
      }
      for(const k of keys) if(values[k]!==undefined && String(values.planGoal||'').trim()) values[k]=values.planGoal
      syncCaseFieldControls('planGoal',values.planGoal||'')
    }
    function renderGoalSuggestions(){
      const host=$('versorgungGoalSuggestions')
      if(!host) return
      const pg=String($('carePg')?.value||'')
      const enabled=['23','24'].includes(pg)&&!!selectedHimiId()
      host.classList.toggle('hidden',!enabled)
      host.replaceChildren()
      if(!enabled) return
      syncLegacyGoalIntoPlanning()
      const goalControl=document.querySelector('[data-case-field="planGoal"]')
      if(!goalControl) return
      const section=document.createElement('section')
      section.className='field'
      const title=document.createElement('strong')
      title.textContent='Versorgungsziele nach Maßaufnahme vorschlagen'
      const note=document.createElement('small')
      note.textContent='Vorschläge werden erst in der Versorgungsplanung nach dem Maßblatt angeboten. Individuellen Zieltext fachlich prüfen; AOK-Originalformular bleibt unverändert.'
      section.append(title,note)
      attachGoalPicker(section,goalControl,'planGoal')
      host.appendChild(section)
    }

    function renderMeasureFields(){
      const host=$('measureFieldList')
      if(!host) return
      host.className='field-list'
      // AOK BW PG24: the contractually required Annex 5a–5e takes precedence over
      // internal FMB measurement sheets. Other payers retain the technician sheet.
      if(renderAokPg24MeasureSheet()) return
      if($('carePg').value==='24' && renderPg24SourceMeasureSheet()) return
      const meta=selectedHimiMeta()
      host.innerHTML=''
      const note=$('measureLogicNote')
      if(!meta){
        note.className='status-card open';note.innerHTML='<strong>Hilfsmittel wählen</strong>Die Maßlogik wird aus PG und Hilfsmittel bestimmt.'
        return
      }
      const conditional=meta.Mass_Pflicht_bei||[]
      const applicable=!!meta.Mass_erforderlich && (!conditional.length || conditional.includes(supplyType()))
      if(!applicable){
        note.className='status-card ready';note.innerHTML='<strong>Kein eigener Maßschritt erforderlich</strong>Für diese Auswahl ist im hinterlegten Regelwerk derzeit kein eigener Maßbogen aktiviert.'
        return
      }
      const profileId=String(meta.Massprofil_ID||'')
      if(profileId && !loadedMeasureProfiles.has(profileId)){
        note.className='status-card open'
        note.innerHTML='<strong>Maßprofil wird geladen</strong>Die benötigten Maßfelder werden für diese Versorgung nachgeladen.'
        void ensureMeasureFieldsForProfile(profileId)
        return
      }
      const fields=profileId
        ? data.massfelder.filter(x=>String(x.Massprofil_ID)===profileId).sort((a,b)=>(a.Sortierung||100)-(b.Sortierung||100))
        : []
      note.className='status-card open'
      note.innerHTML='<strong>'+escapeHtml(meta.Bezeichnung)+'</strong>'+escapeHtml(meta.Hinweis||'Passendes Maßprofil wurde geladen.')
      fields.forEach(f=>{
        const label=document.createElement('label');label.className='field'
        const title=document.createElement('span')
        title.innerHTML=escapeHtml(f.Feldbezeichnung)+(String(f.Pflichtstatus).toLowerCase()==='ja'?'<b>*</b>':'')+
          '<small>'+escapeHtml([f.Abschnitt,f.Einheit_Optionen,f.Bedingung_UI].filter(Boolean).join(' · '))+'</small>'
        label.append(title,createDynamicControl(f,'measure:'))
        host.appendChild(label)
      })
      renderMeasureTranscriptCatalog()
    }

    function populateSelectors(){
      const kassen=[...new Set([...data.kassen.map(x=>x.Kasse_Kanonisch).filter(Boolean),'Privat','Selbstzahler'])].sort((a,b)=>a.localeCompare(b,'de'))
      const pgs=[...new Set(data.produktgruppen.map(x=>String(x.PG)).filter(isActiveProductGroup))].sort((a,b)=>Number(a)-Number(b))
      $('careKasse').innerHTML='<option value="">Bitte wählen</option>'+kassen.map(x=>'<option>'+escapeHtml(x)+'</option>').join('')
      $('carePg').innerHTML='<option value="">Bitte wählen</option>'+pgs.map(x=>'<option value="'+escapeHtml(x)+'">PG '+escapeHtml(x)+'</option>').join('')
      populateHimiOptions()
    }


    function renderContractKnowledge(query=''){
      const q=String(query||'').trim().toLowerCase()
      const rows=data.approvedKnowledge.filter(r=>!q||JSON.stringify(r).toLowerCase().includes(q))
      $('approvedKnowledgeCount').textContent=data.approvedKnowledge.length+' verwendbar'
      const revalidation=data.contractKnowledge.filter(r=>r.status==='APPROVED' && r.needs_revalidation)
      const warning=$('knowledgeRevalidationWarning')
      warning.classList.toggle('hidden',!revalidation.length)
      if(revalidation.length) warning.innerHTML='<strong>'+revalidation.length+' Wissenseinträge benötigen erneute Prüfung.</strong><p>Diese Einträge werden nicht als bestehende Entscheidung verwendet.</p>'
      $('knowledgeList').innerHTML=rows.length?rows.map(r=>
        '<article class="knowledge-card"><div class="knowledge-head"><div><strong>'+escapeHtml(r.title)+'</strong><small>'+escapeHtml([r.payer,r.pg?'PG '+r.pg:'',r.hmv_code,r.position_code].filter(Boolean).join(' · ')||'Allgemeiner Geltungsbereich')+'</small></div><span class="pill success">APPROVED</span></div>'+
        (r.question_text?'<p class="knowledge-question">'+escapeHtml(r.question_text)+'</p>':'')+
        '<p>'+escapeHtml(r.decision_text)+'</p><div class="knowledge-meta"><span>Vertrag: '+escapeHtml(r.contract_id||'—')+'</span><span>Version: '+escapeHtml(r.contract_version||'—')+'</span><span>Standort: '+escapeHtml(r.site_reference||'—')+'</span><span>Quelle: '+escapeHtml(r.source_reference||'—')+'</span>'+(r.contract_rule_id?'<span>Regel: '+escapeHtml(r.contract_rule_id)+'</span>':'')+'</div></article>'
      ).join(''):'<div class="empty-panel">Kein passender freigegebener Wissenseintrag gefunden.</div>'

      const questions=[...data.contractQuestions].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)))
      $('contractQuestionCount').textContent=questions.length
      $('contractQuestionList').innerHTML=questions.length?questions.slice(0,100).map(r=>
        '<article class="question-row"><div><strong>'+escapeHtml(r.question_text)+'</strong><small>'+escapeHtml([r.payer,r.pg?'PG '+r.pg:'',r.hmv_code,r.position_code].filter(Boolean).join(' · ')||'ohne Zuordnung')+'</small></div><span class="pill">'+escapeHtml(r.status)+'</span></article>'
      ).join(''):'<div class="empty-panel">Noch keine Vertragsfragen vorhanden.</div>'
    }

    async function submitContractQuestion(event){
      event.preventDefault()
      const msg=$('contractQuestionMessage')
      const question=$('cqQuestion').value.trim()
      msg.className='alert hidden'; msg.textContent=''
      if(question.length<5){msg.className='alert error';msg.textContent='Bitte eine konkrete Vertragsfrage eingeben.';return}
      const button=$('contractQuestionSubmit')
      button.disabled=true;button.textContent='Wird angelegt …'
      const payload={
        created_by:currentSession.user.id,
        question_text:question,status:'OPEN',
        payer:$('cqPayer').value.trim()||null,
        contract_id:$('cqContract').value.trim()||null,
        contract_version:$('cqVersion').value.trim()||null,
        pg:$('cqPg').value.trim()||null,
        hmv_code:$('cqHmv').value.trim()||null,
        position_code:$('cqPosition').value.trim()||null,
        site_reference:$('cqSite').value.trim()||null,
        source_reference:$('cqSource').value.trim()||null
      }
      const result=await supabase.from('contract_questions').insert(payload).select('*').single()
      button.disabled=false;button.textContent='Vertragsfrage anlegen'
      if(result.error){msg.className='alert error';msg.textContent=result.error.message;return}
      data.contractQuestions.unshift(result.data)
      $('contractQuestionForm').reset()
      msg.className='alert success';msg.textContent='Vertragsfrage wurde in die Prüfqueue übernommen.'
      renderContractKnowledge($('knowledgeSearch').value)
    }

    function renderAll(){
      $('metricKassen').textContent=data.kassen.length
      $('metricForms').textContent=dataCounts.forms
      $('metricPg').textContent=data.produktgruppen.filter(r=>isActiveProductGroup(r.PG)).length
      $('metricSources').textContent=dataCounts.sources

      $('productBody').innerHTML=data.produktgruppen.filter(r=>isActiveProductGroup(r.PG)).map(r=>'<tr><td><strong>PG '+escapeHtml(r.PG)+'</strong></td><td>'+escapeHtml(r.Generisches_Blatt)+'</td><td><span class="pill">'+escapeHtml(r.Reifegrad)+'</span></td><td>'+escapeHtml(r.Kritischer_Hinweis)+'</td></tr>').join('')
      if(optionalDataLoaded.forms) renderForms('')
      if(optionalDataLoaded.sources) $('sourceGrid').innerHTML=data.quellen.map(r=>'<article class="source"><span class="pill">'+escapeHtml(r.Typ)+'</span><h4>'+escapeHtml(r.Beschreibung)+'</h4><p>'+escapeHtml(r.URL_oder_Datei)+'</p><small>'+escapeHtml(r.Quelle_ID)+'</small></article>').join('')
    }

    function renderForms(query=''){
      const q=query.toLowerCase()
      const rows=data.formulare.filter(r=>isActiveProductGroup(r.PG) && JSON.stringify(r).toLowerCase().includes(q))
      $('formsBody').innerHTML=rows.map(r=>'<tr><td>'+escapeHtml(r.Kasse)+'</td><td>PG '+escapeHtml(r.PG)+'</td><td>'+escapeHtml(r.Versorgungsart)+'</td><td><span class="pill">'+escapeHtml(r.Status)+'</span></td><td>'+escapeHtml(r.Aktion_Versorgungsassistent)+'</td><td>'+escapeHtml(r.Gueltigkeit_Stand)+'</td></tr>').join('')
    }

    function renderPg26(){
      const kasse=$('pg26Kasse').value
      const rows=data.pg26.filter(r=>!kasse||r.Kasse===kasse)
      $('positionBody').innerHTML=rows.map(r=>'<tr><td>'+escapeHtml(r.Kasse)+'</td><td>'+escapeHtml(r.Kategorie)+'</td><td>'+escapeHtml(r.Art_Nr)+'</td><td>'+escapeHtml(r.HMV_Nr)+'</td><td>'+escapeHtml(r.Inhalt)+'</td></tr>').join('')
    }

    function updateCare(){
      const kasse=$('careKasse').value
      const pg=$('carePg').value
      if(pg && !optionalDataLoaded.forms && !loadedFormPgs.has(String(pg))){
        $('careForm').innerHTML='<option value="">Formularlogik wird geladen …</option>'
        void ensureFormsForPg(pg)
        return
      }
      const himiId=selectedHimiId()
      if(himiId && !loadedHimiRuleIds.has(String(himiId))){
        $('careForm').innerHTML='<option value="">Hilfsmittelregeln werden geladen …</option>'
        void ensureHimiFormRules(himiId)
        return
      }
      const current=values.formId||$('careForm').value
      const meta=selectedHimiMeta()
      const rules=data.himiformularregeln
        .filter(r=>r.Himi_ID===himiId && r.Kasse===kasse)
        .sort((a,b)=>(a.Sortierung||100)-(b.Sortierung||100))
      const ruleFormIds=[...new Set(rules.map(r=>r.Formular_ID).filter(Boolean))]
      const exactForms=data.formulare.filter(f=>ruleFormIds.includes(f.Formular_ID))
      const pgForms=data.formulare.filter(f=>(!kasse||f.Kasse===kasse)&&formMatchesPgValue(f.PG,pg))
      const broad=pgForms.filter(f=>pgForms.length===1 || formMatchesHimi(f))
      const byId=new Map()
      exactForms.forEach(f=>byId.set(f.Formular_ID,f))
      broad.forEach(f=>{if(!byId.has(f.Formular_ID))byId.set(f.Formular_ID,f)})
      const forms=[...byId.values()]
      const genericId=meta?.Generisches_Formular_ID||''
      let html='<option value="">Automatisch nach PG + Himi + Kasse</option>'
      rules.forEach(r=>{
        if(r.Formular_ID) html+='<option value="'+escapeHtml(r.Formular_ID)+'">'+escapeHtml(r.Formularbezeichnung+' · '+(r.Status||''))+'</option>'
      })
      forms.filter(f=>!rules.some(r=>r.Formular_ID===f.Formular_ID)).forEach(f=>{
        html+='<option value="'+escapeHtml(f.Formular_ID)+'">'+escapeHtml((f.Versorgungsart||f.Formular_ID)+' · '+(f.Status||''))+'</option>'
      })
      if(genericId && !forms.some(f=>f.Formular_ID===genericId)) html+='<option value="'+escapeHtml(genericId)+'">Generischer Erhebungsbogen · '+escapeHtml(selectedHimi())+'</option>'
      $('careForm').innerHTML=html
      if(current && [...$('careForm').options].some(o=>o.value===current)) $('careForm').value=current
      else if(rules.length===1 && rules[0].Formular_ID) $('careForm').value=rules[0].Formular_ID
      else if(!rules.length && forms.length===1 && forms[0].Formular_ID) $('careForm').value=forms[0].Formular_ID
      else if(!rules.length && genericId) $('careForm').value=genericId
      else $('careForm').value=''
      values.formId=$('careForm').value||''
      updateCareFields()
      syncSupplyTypeOptions()
      syncSituationFields()
      renderMeasureFields()
    }

    function bindAokProfileControl(el,key){
      const stored=values[key]
      if(el.type==='checkbox'){
        const arr=Array.isArray(stored)?stored:[]
        el.checked=arr.includes(el.value)
        const save=()=>{
          const all=[...document.querySelectorAll('[data-aok-profile-key="'+CSS.escape(key)+'"]')].filter(x=>x.type==='checkbox')
          values[key]=all.filter(x=>x.checked).map(x=>x.value)
          updateWizardStatus()
        }
        el.addEventListener('change',save)
      }else{
        if(stored!==undefined&&stored!==null) el.value=stored
        const save=()=>{values[key]=el.value;updateWizardStatus()}
        el.addEventListener('input',save);el.addEventListener('change',save)
      }
      el.dataset.aokProfileKey=key
      return el
    }

    function aokProfileField(parent,label,key,type='text',options=[],hint=''){
      const box=document.createElement('label');box.className='aok-profile-field'
      const caption=document.createElement('span');caption.textContent=label;box.appendChild(caption)
      let el
      if(type==='textarea'){el=document.createElement('textarea');el.rows=3}
      else if(type==='select'){el=document.createElement('select');el.innerHTML='<option value="">Bitte wählen</option>'+options.map(x=>'<option>'+escapeHtml(x)+'</option>').join('')}
      else {el=document.createElement('input');el.type=type}
      bindAokProfileControl(el,key);box.appendChild(el)
      if(hint){const s=document.createElement('small');s.textContent=hint;box.appendChild(s)}
      parent.appendChild(box);return el
    }

    function aokProfileMulti(parent,label,key,options){
      const box=document.createElement('div');box.className='aok-profile-field'
      const cap=document.createElement('span');cap.textContent=label;box.appendChild(cap)
      const opts=document.createElement('div');opts.className='aok-profile-options'
      options.forEach(v=>{const l=document.createElement('label');const e=document.createElement('input');e.type='checkbox';e.value=v;bindAokProfileControl(e,key);l.append(e,document.createTextNode(v));opts.appendChild(l)})
      box.appendChild(opts);parent.appendChild(box);return box
    }

    function aokProfileSection(host,title,cols=2){
      const section=document.createElement('section');section.className='aok-profile-section'
      const h=document.createElement('h4');h.textContent=title
      const grid=document.createElement('div');grid.className='aok-profile-grid'+(cols===3?' three':'')
      section.append(h,grid);host.appendChild(section);return grid
    }

    function signatureStrokes(key){
      const stored=values[key]
      return Array.isArray(stored)?stored:[]
    }

    function signatureHasInk(key){
      return signatureStrokes(key).some(stroke=>Array.isArray(stroke)&&stroke.length>1)
    }

    function drawSignatureCanvas(canvas,key){
      if(!canvas) return
      const rect=canvas.getBoundingClientRect()
      const dpr=Math.max(1,window.devicePixelRatio||1)
      const w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr))
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
      const ctx=canvas.getContext('2d')
      ctx.clearRect(0,0,w,h)
      ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#0f172a';ctx.lineWidth=Math.max(1.4,1.7*dpr)
      signatureStrokes(key).forEach(stroke=>{
        if(!stroke?.length) return
        ctx.beginPath()
        stroke.forEach((p,i)=>{
          const x=(Number(p.x)||0)*w,y=(Number(p.y)||0)*h
          if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y)
        })
        ctx.stroke()
      })
      canvas.parentElement?.classList.toggle('has-signature',signatureHasInk(key))
    }

    function createSignaturePad(key,{className='signature-pad',label='Unterschrift',ariaLabel='Unterschrift'}={}){
      const wrap=document.createElement('div');wrap.className=className
      const canvas=document.createElement('canvas');canvas.setAttribute('aria-label',ariaLabel);canvas.setAttribute('role','img')
      const clear=document.createElement('button');clear.type='button';clear.className='secondary signature-pad-clear';clear.textContent='Löschen'
      wrap.append(canvas,clear)
      let drawing=false,current=null
      const point=event=>{
        const r=canvas.getBoundingClientRect()
        return {x:Math.max(0,Math.min(1,(event.clientX-r.left)/Math.max(r.width,1))),y:Math.max(0,Math.min(1,(event.clientY-r.top)/Math.max(r.height,1)))}
      }
      canvas.addEventListener('pointerdown',event=>{
        if(!supplyHasEditableContext()) return
        event.preventDefault();canvas.setPointerCapture?.(event.pointerId)
        drawing=true;current=[point(event)]
        const strokes=signatureStrokes(key).slice();strokes.push(current);values[key]=strokes
        drawSignatureCanvas(canvas,key)
      })
      canvas.addEventListener('pointermove',event=>{
        if(!drawing||!current) return
        event.preventDefault();current.push(point(event));drawSignatureCanvas(canvas,key)
      })
      const finish=event=>{
        if(!drawing) return
        event?.preventDefault?.();drawing=false;current=null
        queueAutosaveSupply();updateWizardStatus()
      }
      canvas.addEventListener('pointerup',finish)
      canvas.addEventListener('pointercancel',finish)
      canvas.addEventListener('pointerleave',event=>{if(drawing && event.buttons===0) finish(event)})
      clear.addEventListener('click',event=>{
        event.preventDefault();event.stopPropagation()
        if(!supplyHasEditableContext()) return
        values[key]=[];drawSignatureCanvas(canvas,key);queueAutosaveSupply();updateWizardStatus()
      })
      requestAnimationFrame(()=>drawSignatureCanvas(canvas,key))
      if(window.ResizeObserver){
        const ro=new ResizeObserver(()=>drawSignatureCanvas(canvas,key));ro.observe(wrap);wrap._signatureResizeObserver=ro
      }
      wrap.dataset.signatureKey=key
      wrap.dataset.signatureLabel=label
      return wrap
    }

    function techProfileSignature(parent,label,key){
      const box=document.createElement('div');box.className='signature-field'
      const cap=document.createElement('div');cap.className='signature-field-label';cap.textContent=label
      const pad=createSignaturePad(key,{label,ariaLabel:label})
      const hint=document.createElement('div');hint.className='signature-pad-hint';hint.textContent='Direkt mit Maus, Touch oder Stift unterschreiben. Die Signatur wird im Vorgang zwischengespeichert.'
      box.append(cap,pad,hint);parent.appendChild(box);return pad
    }

    const PROFILE_AI_MAX_RECORDING_MS=5*60*1000
    let profileAiRecorder=null
    let profileAiRecordingTarget='profile'
    let profileAiStream=null
    let profileAiChunks=[]
    let profileAiRecordingTimer=null
    let profileAsrPromise=null
    let profileGuidedTarget=null
    let profileGuidedIndex=-1
    let profileAiSuggestionState=[]

    function profileAiSetStatus(text,state=''){
      const el=profileAiRecordingTarget==='measure' ? $('measureTranscriptStatus') : $('profileAiStatus')
      if(!el) return
      el.textContent=text
      el.className='profile-ai-status'+(state?' '+state:'')
    }

    async function getProfileAsr(){
      if(!window.WhisperCppRuntime){
        throw new Error('Die lokale whisper.cpp-Laufzeit ist nicht verfügbar.')
      }
      window.WhisperCppRuntime.setStatusHandler(text=>profileAiSetStatus(text))
      if(!profileAsrPromise){
        profileAiSetStatus('Lokale whisper.cpp-Spracherkennung wird vorbereitet … Beim ersten Einsatz wird das Modell geladen.')
        profileAsrPromise=window.WhisperCppRuntime.warmup()
          .then(()=>window.WhisperCppRuntime)
          .catch(err=>{profileAsrPromise=null;throw err})
      }
      return profileAsrPromise
    }

    async function audioBlobToMono16k(blob){
      const AudioCtx=window.AudioContext||window.webkitAudioContext
      if(!AudioCtx) throw new Error('AudioContext wird von diesem Browser nicht unterstützt.')
      const ctx=new AudioCtx()
      try{
        const arr=await blob.arrayBuffer()
        const buf=await ctx.decodeAudioData(arr.slice(0))
        const len=buf.length
        const mono=new Float32Array(len)
        for(let ch=0;ch<buf.numberOfChannels;ch++){
          const d=buf.getChannelData(ch)
          for(let i=0;i<len;i++) mono[i]+=d[i]/buf.numberOfChannels
        }
        if(buf.sampleRate===16000) return mono
        const ratio=buf.sampleRate/16000
        const outLen=Math.max(1,Math.round(mono.length/ratio))
        const out=new Float32Array(outLen)
        for(let i=0;i<outLen;i++){
          const p=i*ratio,lo=Math.floor(p),hi=Math.min(mono.length-1,lo+1),t=p-lo
          out[i]=mono[lo]*(1-t)+mono[hi]*t
        }
        return out
      }finally{ try{await ctx.close()}catch(_){} }
    }

    async function transcribeProfileAudio(blob){
      const audio=await audioBlobToMono16k(blob)
      const asr=await getProfileAsr()
      profileAiSetStatus('KI-Transkription läuft vollständig lokal mit whisper.cpp/WebAssembly …')
      return asr.transcribe(audio,'de')
    }

    function profileControlLabel(el){
      if(!el) return 'Profilerhebungsfeld'
      if(el.dataset.aiLabel && !/^Text\d+$/.test(el.dataset.aiLabel)) return (el.dataset.profileSide?el.dataset.profileSide+' · ':'')+el.dataset.aiLabel
      const tech=el.closest('.tech-profile-field')
      const techLabel=tech?.querySelector(':scope > span')?.textContent?.trim()
      if(techLabel) return techLabel
      const label=el.closest('label')?.querySelector('span')?.textContent?.trim()
      return label||el.getAttribute('aria-label')||el.dataset.techKey||el.dataset.profileKey||'Profilerhebungsfeld'
    }

    function profileGuideCatalog(){
      const host=$('fieldList')
      if(!host) return []
      const controls=[...host.querySelectorAll('[data-tech-key],[data-profile-key]')].filter(el=>{
        if(el.matches('[data-signature-key],.aok-plusm-option,.aok-plusm-side-option')) return false
        // Unverified AOK PDF fields cannot be used as guided speech/OCR targets.
        if(el.dataset.profileKey?.startsWith('aokProfilePdf:') && el.dataset.semanticMapping!=='source-verified') return false
        if(el.readOnly||el.disabled) return false
        if(el.type==='checkbox'||el.type==='radio') return false
        if(el.dataset.profileKey==='aokProfilePdf:Text24'||el.dataset.profileKey==='aokProfilePdf:Text25') return false
        return ['INPUT','TEXTAREA','SELECT'].includes(el.tagName)
      })
      return controls.map(el=>({el,label:profileControlLabel(el)})).filter(x=>x.label)
    }

    function profileControlIsEmpty(el){
      return !String(el?.value||'').trim()
    }

    function selectProfileGuidedQuestion(forceNext=true){
      const catalog=profileGuideCatalog()
      if(!catalog.length){
        profileGuidedTarget=null
        $('profileAiQuestion').innerHTML='<strong>Keine offene Abfrage gefunden</strong><span>Der aktuell geladene Bogen enthält keine sprachlich befüllbaren offenen Felder.</span>'
        return null
      }
      let start=forceNext?profileGuidedIndex+1:Math.max(profileGuidedIndex,0)
      let found=-1
      for(let pass=0;pass<2&&found<0;pass++){
        for(let i=pass?0:start;i<catalog.length;i++){
          if(profileControlIsEmpty(catalog[i].el)){found=i;break}
        }
      }
      if(found<0) found=Math.min(Math.max(start,0),catalog.length-1)
      profileGuidedIndex=found
      profileGuidedTarget=catalog[found]
      const q=$('profileAiQuestion')
      q.innerHTML='<strong>Geführte Frage '+(found+1)+' / '+catalog.length+'</strong><span>'+escapeHtml(catalog[found].label)+'</span>'
      catalog[found].el.scrollIntoView({behavior:'smooth',block:'center'})
      try{catalog[found].el.focus({preventScroll:true})}catch(_){}
      return profileGuidedTarget
    }

    function normalizeSpokenChoice(text){
      return norm(text).replace(/\\b(ich|habe|bin|ist|es|der|die|das|bitte|ja)\\b/g,' ').replace(/\\s+/g,' ').trim()
    }

    function valueForControlFromSpeech(el,text){
      const raw=String(text||'').trim()
      if(!el||!raw) return ''
      if(el.tagName==='SELECT'){
        const n=normalizeSpokenChoice(raw)
        const options=[...el.options].filter(o=>o.value)
        let match=options.find(o=>n.includes(norm(o.textContent))||norm(o.textContent).includes(n))
        if(!match && /\\bja\\b/i.test(raw)) match=options.find(o=>norm(o.textContent)==='ja')
        if(!match && /\\bnein\\b/i.test(raw)) match=options.find(o=>norm(o.textContent)==='nein')
        return match?.value||''
      }
      if(el.type==='number'){
        const m=raw.replace(',','.').match(/-?\\d+(?:\\.\\d+)?/)
        return m?m[0]:''
      }
      if(el.type==='date'){
        return normalizeRxDate(raw)
      }
      return raw.replace(/^\\s*(antwort|antwort ist|das ist)\\s*[:,-]?\\s*/i,'').trim()
    }

    function setProfileAssistantControl(el,value){
      if(!el||value===undefined||value===null||String(value).trim()==='') return false
      if(el.tagName==='SELECT'){
        const opts=[...el.options]
        const exact=opts.find(o=>String(o.value)===String(value))||opts.find(o=>norm(o.textContent)===norm(value))
        if(!exact) return false
        el.value=exact.value
      }else el.value=String(value)
      el.dispatchEvent(new Event('input',{bubbles:true}))
      el.dispatchEvent(new Event('change',{bubbles:true}))
      return true
    }

    function findProfileSemanticControl(keys,labels=[]){
      for(const key of keys||[]){
        const el=document.querySelector('[data-tech-key="'+CSS.escape(key)+'"],[data-profile-key="'+CSS.escape(key)+'"]')
        if(el && (!el.dataset.profileKey?.startsWith('aokProfilePdf:') || el.dataset.semanticMapping==='source-verified')) return el
      }
      const catalog=profileGuideCatalog()
      const wanted=(labels||[]).map(norm)
      return catalog.find(item=>{
        const l=norm(item.label)
        return wanted.some(w=>w && (l.includes(w)||w.includes(l)))
      })?.el||null
    }

    function addProfileSuggestion(out,el,value,reason){
      if(!el||value===undefined||value===null||String(value).trim()==='') return
      if(out.some(x=>x.el===el)) return
      out.push({el,value:String(value).trim(),label:profileControlLabel(el),reason})
    }

    function extractProfileSuggestions(text){
      const raw=String(text||'').trim(),n=norm(raw),out=[]
      if(!raw) return out
      // Free speech cannot reliably attribute findings to left versus right.
      if($('carePg').value==='24' && isAokCase() && values.side==='beidseitig') return out
      let m

      m=raw.match(/(?:gewicht|wiegt|wiege)\\D{0,18}(\\d{2,3}(?:[,.]\\d+)?)\\s*(?:kg|kilo)/i)
      if(m) addProfileSuggestion(out,findProfileSemanticControl(['tech:weight'],['gewicht','körpergewicht']),m[1].replace(',','.'),'explizite Gewichtsangabe')

      m=raw.match(/(?:größe|groesse|groß|gross|bin)\\D{0,18}(\\d{2,3})\\s*(?:cm|zentimeter)/i)
      if(m){
        const target=findProfileSemanticControl(['tech:height'],['größe','körpergröße'])
        const heightValue=target?.dataset.profileKey==='aokProfilePdf:Text3'
          ? (Number(m[1])/100).toFixed(2).replace('.',',') // AOK original uses metres
          : m[1] // Technikerbogen uses centimetres
        addProfileSuggestion(out,target,heightValue,'explizite Größenangabe mit passender Maßeinheit')
      }

      const ampContext=/amput|stumpf/i.test(raw)
      if(ampContext){
        if(/\\bbeidseitig\\b/i.test(raw)) addProfileSuggestion(out,findProfileSemanticControl(['tech:side'],['amputationsseite','seite']),'Beidseitig','explizite Seitenangabe')
        else if(/\\brechts\\b/i.test(raw)) addProfileSuggestion(out,findProfileSemanticControl(['tech:side'],['amputationsseite','seite']),'Rechts','explizite Seitenangabe')
        else if(/\\blinks\\b/i.test(raw)) addProfileSuggestion(out,findProfileSemanticControl(['tech:side'],['amputationsseite','seite']),'Links','explizite Seitenangabe')
        const levels=[['Hemipelvektomie','hemipelvekt'],['Hüftexartikulation','hüftex'],['Oberschenkel','oberschenkel'],['Knieexartikulation','knieex'],['Unterschenkel','unterschenkel'],['Teilfußamputation','teilfuß'],['Fuß','fuß']]
        for(const [val,token] of levels){if(n.includes(norm(token))){addProfileSuggestion(out,findProfileSemanticControl(['tech:ampLevel'],['amputationshöhe']),val,'explizite Amputationshöhe');break}}
      }

      const shapes=[['zylindrisch','zylindr'],['konisch','konisch'],['birnenförmig','birnen']]
      for(const [val,token] of shapes){if(n.includes(token)){addProfileSuggestion(out,findProfileSemanticControl(['tech:stumpShape'],['stumpfform']),val,'explizite Stumpfform');break}}

      if(/wundheilung.*abgeschlossen|wunde.*verheilt|narbe.*verheilt/i.test(raw)) addProfileSuggestion(out,findProfileSemanticControl(['tech:woundHealed'],['wundheilung abgeschlossen']),'Ja','explizite Aussage zur Wundheilung')
      if(/wundheilung.*nicht abgeschlossen|wunde.*nicht verheilt/i.test(raw)) addProfileSuggestion(out,findProfileSemanticControl(['tech:woundHealed'],['wundheilung abgeschlossen']),'Nein','explizite Aussage zur Wundheilung')

      if(/volumenschwank/i.test(raw)){
        const v=/keine|nein|nicht/i.test(raw.match(/.{0,40}volumenschwank.{0,60}/i)?.[0]||'')?'Nein':'Ja'
        addProfileSuggestion(out,findProfileSemanticControl(['tech:volumeChange'],['volumenschwank']),v,'explizite Aussage zu Volumenschwankungen')
      }

      if(/physiotherap/i.test(raw)){
        const seg=raw.match(/.{0,40}physiotherap.{0,60}/i)?.[0]||''
        const v=/keine|nicht|nein/i.test(seg)?'Nein':'Ja'
        addProfileSuggestion(out,findProfileSemanticControl(['tech:physio'],['physiotherapeutischer behandlung']),v,'explizite Aussage zur Physiotherapie')
      }

      if(/rehabilitation|reha(?:maßnahme)?/i.test(raw)){
        const seg=raw.match(/.{0,35}(?:rehabilitation|reha).{0,70}/i)?.[0]||''
        const v=/keine|nicht|nein/i.test(seg)?'Nein':'Ja'
        addProfileSuggestion(out,findProfileSemanticControl(['tech:rehabDone'],['rehabilitationsmaßnahme']),v,'explizite Aussage zur Rehabilitation')
      }

      m=raw.match(/(?:beruf|beruflich|arbeitet als|tätig als)\\s*(?:ist|:|als)?\\s*([^,.\\n]{3,60})/i)
      if(m) addProfileSuggestion(out,findProfileSemanticControl(['tech:profession'],['ausgeübten beruf','beruf']),m[1].trim(),'explizite Berufsangabe')

      m=raw.match(/(?:amputationsgrund|ursache(?: der amputation)?)[\\s:,-]+([^,.\\n]{3,100})/i)
      if(m) addProfileSuggestion(out,findProfileSemanticControl(['tech:ampReason'],['amputationsgrund','ursache']),m[1].trim(),'explizit genannter Amputationsgrund')

      m=raw.match(/(?:amputation|amputiert)\\D{0,40}((?:0?[1-9]|[12]\\d|3[01])[.\\/-](?:0?[1-9]|1[0-2])[.\\/-](?:\\d{2}|\\d{4}))/i)
      if(m){
        const d=normalizeRxDate(m[1])
        if(d) addProfileSuggestion(out,findProfileSemanticControl(['tech:ampDate'],['datum der amputation','amputation seit']),d,'explizites Amputationsdatum')
      }

      if(/endbelast/i.test(raw)){
        const seg=norm(raw.match(/.{0,30}endbelast.{0,60}/i)?.[0]||'')
        const v=seg.includes('voll')?'voll':seg.includes('teil')?'teilweise':seg.includes('keine')||seg.includes('nicht')?'nicht':''
        if(v) addProfileSuggestion(out,findProfileSemanticControl(['tech:endLoad'],['endbelastung']),v,'explizite Endbelastungsangabe')
      }

      if(/muskelkraft/i.test(raw)){
        const seg=norm(raw.match(/.{0,30}muskelkraft.{0,50}/i)?.[0]||'')
        const v=seg.includes('aufgehoben')?'aufgehoben':seg.includes('reduziert')?'reduziert':seg.includes('voll')?'voll':''
        if(v) addProfileSuggestion(out,findProfileSemanticControl(['tech:muscleStrength'],['muskelkraft']),v,'explizite Muskelkraftangabe')
      }

      return out
    }

    function renderProfileAiSuggestions(list){
      profileAiSuggestionState=list||[]
      const host=$('profileAiSuggestions')
      if(!host) return
      if(!list?.length){
        host.innerHTML='<div class="profile-ai-empty">Keine eindeutig zuordenbaren Angaben erkannt. Transkript prüfen oder geführte Abfrage verwenden.</div>'
        return
      }
      host.innerHTML=list.map((s,i)=>'<label class="profile-ai-suggestion"><input type="checkbox" data-profile-ai-suggestion="'+i+'" checked><strong>'+escapeHtml(s.label)+'</strong><span>'+escapeHtml(s.value)+'</span></label>').join('')
    }

    function analyzeProfileAiTranscript(){
      const text=$('profileAiTranscript').value.trim()
      if(!text){profileAiSetStatus('Kein Transkript vorhanden.');renderProfileAiSuggestions([]);return}
      if($('profileAiMode').value==='guided'){
        if(!profileGuidedTarget || !document.contains(profileGuidedTarget.el)) selectProfileGuidedQuestion(false)
        if(!profileGuidedTarget){renderProfileAiSuggestions([]);return}
        const value=valueForControlFromSpeech(profileGuidedTarget.el,text)
        renderProfileAiSuggestions(value?[{el:profileGuidedTarget.el,value,label:profileGuidedTarget.label,reason:'Antwort auf geführte Frage'}]:[])
        profileAiSetStatus(value?'Antwort erkannt. Bitte Vorschlag prüfen und übernehmen.':'Antwort konnte nicht passend zum Feld interpretiert werden.')
      }else{
        const suggestions=extractProfileSuggestions(text)
        renderProfileAiSuggestions(suggestions)
        profileAiSetStatus(suggestions.length?suggestions.length+' eindeutige Feldvorschläge erkannt. Bitte prüfen und übernehmen.':'Keine eindeutigen Feldvorschläge erkannt.')
      }
    }

    function applyProfileAiSuggestions(){
      const host=$('profileAiSuggestions')
      let applied=0
      profileAiSuggestionState.forEach((s,i)=>{
        const checked=host?.querySelector('[data-profile-ai-suggestion="'+i+'"]')?.checked
        if(checked && setProfileAssistantControl(s.el,s.value)) applied++
      })
      queueAutosaveSupply();updateWizardStatus()
      profileAiSetStatus(applied?applied+' Feld'+(applied===1?'':'er')+' übernommen.':'Keine Vorschläge übernommen.',applied?'ready':'')
      if(applied && $('profileAiMode').value==='guided'){
        $('profileAiTranscript').value=''
        renderProfileAiSuggestions([])
        selectProfileGuidedQuestion(true)
      }
    }

    async function startProfileAiRecording(target='profile'){
      if(profileAiRecorder?.state==='recording') return
      profileAiRecordingTarget=target
      if(!navigator.mediaDevices?.getUserMedia){profileAiSetStatus('Mikrofonzugriff wird von diesem Browser nicht unterstützt.');return}
      if(target!=='measure' && $('profileAiMode').value==='guided' && (!profileGuidedTarget||!document.contains(profileGuidedTarget.el))) selectProfileGuidedQuestion(false)
      try{
        profileAiStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}})
        profileAiChunks=[]
        profileAiRecorder=new MediaRecorder(profileAiStream)
        profileAiRecorder.ondataavailable=e=>{if(e.data?.size) profileAiChunks.push(e.data)}
        profileAiRecorder.onstop=async()=>{
          try{
            const blob=new Blob(profileAiChunks,{type:profileAiRecorder.mimeType||'audio/webm'})
            profileAiSetStatus('Aufnahme beendet. Lokale KI-Transkription wird vorbereitet …')
            const text=await transcribeProfileAudio(blob)
            if(target==='measure'){
              if($('measureTranscript')) $('measureTranscript').value=text
              profileAiSetStatus(text?'Maßansage lokal transkribiert. Kennungen und Werte bitte prüfen.':'Keine Maßansage erkannt.',text?'ready':'')
              if(text) analyzeMeasureTranscript()
            }else{
              $('profileAiTranscript').value=text
              profileAiSetStatus(text?'Transkription abgeschlossen. Bitte Text prüfen.':'Keine Sprache erkannt.',text?'ready':'')
              if(text) analyzeProfileAiTranscript()
            }
          }catch(err){
            console.error(err);profileAiSetStatus('Transkription fehlgeschlagen: '+(err?.message||'unbekannter Fehler'))
          }finally{
            clearTimeout(profileAiRecordingTimer);profileAiRecordingTimer=null
            profileAiStream?.getTracks().forEach(t=>t.stop());profileAiStream=null
            profileAiRecorder=null
            profileAiChunks=[]
            $(target==='measure'?'measureTranscriptRecord':'profileAiStart').disabled=false
            $(target==='measure'?'measureTranscriptStop':'profileAiStop').disabled=true
            profileAiRecordingTarget='profile'
          }
        }
        profileAiRecorder.start()
        clearTimeout(profileAiRecordingTimer)
        profileAiRecordingTimer=setTimeout(()=>{
          if(profileAiRecorder?.state==='recording'){
            profileAiSetStatus('Maximale Aufnahmezeit erreicht. Aufnahme wird beendet und lokal verarbeitet.')
            profileAiRecorder.stop()
          }
        },PROFILE_AI_MAX_RECORDING_MS)
        $(target==='measure'?'measureTranscriptRecord':'profileAiStart').disabled=true
        $(target==='measure'?'measureTranscriptStop':'profileAiStop').disabled=false
        profileAiSetStatus('Aufnahme läuft … Sprechen Sie normal und deutlich.','recording')
      }catch(err){profileAiSetStatus('Mikrofon konnte nicht gestartet werden: '+(err?.message||'Zugriff verweigert'))}
    }

    function stopProfileAiRecording(){
      clearTimeout(profileAiRecordingTimer)
      profileAiRecordingTimer=null
      if(profileAiRecorder?.state==='recording') profileAiRecorder.stop()
    }

    function resetProfileAiUi(){
      profileGuidedTarget=null;profileGuidedIndex=-1;profileAiSuggestionState=[]
      if($('profileAiTranscript')) $('profileAiTranscript').value=''
      renderProfileAiSuggestions([])
      const q=$('profileAiQuestion')
      if(q) q.innerHTML='<strong>Geführte Abfrage</strong><span>„Nächste offene Frage“ auswählen oder auf „Aufnahme starten“ klicken.</span>'
      profileAiSetStatus('Bereit. Die Spracheingabe läuft lokal mit whisper.cpp/WebAssembly; beim ersten Einsatz wird das Modell einmalig geladen.')
    }

    function profilePdfPrefill(){
      const fullName=[values.patientFirstName,values.patientLastName].filter(Boolean).join(' ')
      const doctor=[values.rxDoctor,values.rxPracticeAddress].filter(Boolean).join(' · ')
      return {
        Text1: values.serviceReason||'',
        Text2: fullName,
        Text3: values['tech:height']||'',
        Text4: values['tech:weight']||'',
        Text5: doctor,
        Text6: values.rxDoctorSpecialty||''
      }
    }

    const plusMTScore12={
      12:21.8,13:25.2,14:27.2,15:28.7,16:30.0,17:31.2,18:32.2,19:33.2,20:34.1,21:34.9,
      22:35.6,23:36.4,24:37.1,25:37.7,26:38.4,27:39.0,28:39.7,29:40.3,30:40.9,31:41.5,
      32:42.1,33:42.7,34:43.3,35:43.9,36:44.5,37:45.2,38:45.8,39:46.4,40:47.1,41:47.7,
      42:48.4,43:49.1,44:49.8,45:50.5,46:51.2,47:52.0,48:52.7,49:53.6,50:54.4,51:55.3,
      52:56.3,53:57.3,54:58.4,55:59.6,56:61.0,57:62.5,58:64.5,59:67.1,60:71.4
    }

    // Preserve unilateral persisted keys; isolate bilateral originals by side.
    function aokProfileKey(name,side=''){
      return 'aokProfilePdf:'+(side?side+':':'')+name
    }
    function aokPlusMKey(row,side=''){
      return 'aokPlusM:'+(side?side+':':'')+row
    }
    function aokPlusMSummaryKey(name,side=''){
      return side?name+':'+side:name
    }
    function aokProfileSides(){
      return values.side==='beidseitig'?['rechts','links']:['']
    }
    function setAokPdfTextField(fieldName,value,side=''){
      const key=aokProfileKey(fieldName,side)
      values[key]=value
      const el=document.querySelector('[data-profile-key="'+CSS.escape(key)+'"]')
      if(el) el.value=value
    }

    function updatePlusMScore(side=''){
      const answers=[]
      for(let row=1;row<=12;row++){
        const v=Number(values[aokPlusMKey(row,side)])
        if(v>=1&&v<=5) answers.push(v)
      }
      const raw=answers.reduce((a,b)=>a+b,0)
      setAokPdfTextField('Text24',answers.length?String(raw):'',side)
      const t=answers.length===12?plusMTScore12[raw]:null
      setAokPdfTextField('Text25',t!==undefined&&t!==null?Number(t).toFixed(1):'',side)
      values[aokPlusMSummaryKey('aokPlusMAnswered',side)]=answers.length
      values[aokPlusMSummaryKey('aokPlusMRaw',side)]=answers.length?raw:null
      values[aokPlusMSummaryKey('aokPlusMTScore',side)]=t??null
      queueAutosaveSupply()
    }

    function renderPlusMPage2Overlays(pageBox,side=''){
      // Exact centers of the 60 printed PLUS-M option boxes in the unchanged AOK source page.
      const xPct=[50.57,58.96,67.35,75.47,83.22]
      const yPct=[41.48,44.74,48.00,51.26,54.15,56.61,59.49,63.13,66.87,70.13,73.39,76.97]
      const scores=[5,4,3,2,1]
      yPct.forEach((y,rowIndex)=>{
        const row=rowIndex+1
        scores.forEach((score,colIndex)=>{
          const option=document.createElement('input')
          option.type='radio'
          option.name='aok-plusm-row-'+(side||'single')+'-'+row
          option.className='aok-plusm-option'
          option.setAttribute('aria-label','PLUS-M '+(side?side+' · ':'')+'Frage '+row+' · '+score+' Punkte')
          applyRuntimeStyle(option,'geometry',{
            left:(xPct[colIndex]-0.875)+'%',
            top:(y-0.64)+'%'
          })
          option.dataset.plusmRow=String(row)
          option.dataset.plusmScore=String(score)
          option.checked=Number(values[aokPlusMKey(row,side)])===score
          option.addEventListener('change',()=>{
            if(!option.checked) return
            values[aokPlusMKey(row,side)]=score
            updatePlusMScore(side)
            updateWizardStatus()
          })
          pageBox.appendChild(option)
        })
      })
      updatePlusMScore(side)
    }

    function renderAokPage2WalkingAidOption(pageBox,fieldName,left,top,width,height,viewport,side=''){
      const map={'Check Box81':'rechts','Check Box82':'links','Check Box83':'beidseitig'}
      const value=map[fieldName]
      if(!value) return false
      const key=aokProfileKey('walkingAidSide',side)
      const option=document.createElement('input')
      option.type='radio'
      option.name='aok-plusm-walking-aid-side-'+(side||'single')
      option.className='aok-plusm-side-option'
      option.value=value
      option.checked=values[key]===value
      option.setAttribute('aria-label','primär verwendete Gehhilfe '+value)
      applyRuntimeStyle(option,'geometry',{
        left:(left/viewport.width*100)+'%',
        top:(top/viewport.height*100)+'%',
        width:Math.max(width/viewport.width*100,1.3)+'%',
        height:Math.max(height/viewport.height*100,1.3)+'%'
      })
      option.addEventListener('change',()=>{
        if(!option.checked) return
        values[key]=value
        queueAutosaveSupply()
        updateWizardStatus()
      })
      pageBox.appendChild(option)
      return true
    }

    function appendAokSignaturePad(pageBox,key,label,role,left,top,width,height,viewport,exact=false){
      if(pageBox.querySelector('[data-signature-role="'+role+'"]')) return
      const pad=createSignaturePad(key,{className:'aok-signature-pad',label,ariaLabel:label})

      // Die Original-PDF-Zeile bleibt die untere Bezugslinie.
      // Das Signaturfeld wächst nur nach oben, damit darunterliegende Beschriftungen frei bleiben.
      const originalBottom=top+height
      const minHeight=exact
        ? Math.max(height*2.8,viewport.height*.048,52)
        : Math.max(height*2.4,viewport.height*.045,48)
      const targetHeight=Math.min(minHeight,viewport.height*.075)
      const targetTop=Math.max(0,originalBottom-targetHeight)
      const targetWidth=exact ? width : Math.max(width,viewport.width*.45)

      applyRuntimeStyle(pad,'geometry',{
        left:Math.max(0,left/viewport.width*100)+'%',
        top:(targetTop/viewport.height*100)+'%',
        width:(targetWidth/viewport.width*100)+'%',
        height:(targetHeight/viewport.height*100)+'%'
      })
      pad.dataset.profileKey=key
      pad.dataset.required='false'
      pad.dataset.signatureRole=role
      pageBox.appendChild(pad)
    }

    function ensureAokPage4SignaturePads(pageBox,textItems,viewport,side=''){
      const sorted=[...(textItems||[])].sort((a,b)=>Math.abs(a.y-b.y)>4?a.y-b.y:a.x-b.x)
      const lines=[]
      sorted.forEach(item=>{
        let line=lines.find(l=>Math.abs(l.y-item.y)<=4)
        if(!line){line={y:item.y,items:[]};lines.push(line)}
        line.items.push(item)
      })
      const printedLines=lines.map(line=>{
        const items=line.items.sort((a,b)=>a.x-b.x)
        return {
          text:items.map(x=>x.text).join(' ').replace(/\s+/g,' ').trim(),
          x:Math.min(...items.map(x=>x.x)),
          y:line.y,
          w:Math.max(...items.map(x=>x.x+(x.w||0)))-Math.min(...items.map(x=>x.x))
        }
      })

      const addFromPrintedLabel=(role,regex,key,label)=>{
        if(pageBox.querySelector('[data-signature-role="'+role+'"]')) return
        const line=printedLines.find(t=>regex.test(String(t.text||'')))
        if(!line) return
        const width=Math.max(line.w||0,viewport.width*.45)
        const height=Math.max(18,viewport.height*.0165)
        appendAokSignaturePad(pageBox,key,label,role,line.x,Math.max(0,line.y-height-4),width,height,viewport,false)
      }

      addFromPrintedLabel(
        'insured',
        /Unterschrift.*Versichert|Unterschrift.*gesetzlichen\s+Vertreter|Unterschrift.*Bevollmächtigt/i,
        aokProfileKey('insuredSignature',side),
        'Unterschrift der Versicherten bzw. gesetzlichen Vertretung / Bevollmächtigten'
      )
      addFromPrintedLabel(
        'provider',
        /Unterschrift.*Hilfsmittelanbieter|Unterschrift.*Stempel.*Hilfsmittelanbieter/i,
        aokProfileKey('providerSignature',side),
        'Unterschrift / Stempel Hilfsmittelanbieter'
      )
    }

    function canonicalAokProfileTextName(fieldName){
      const match=String(fieldName||'').trim().match(/^(?:Textfeld|Text)\s*(\d+)$/i)
      return match?'Text'+match[1]:String(fieldName||'').trim()
    }

    async function renderEditableProfilePdf(url,host,side=''){
      try{
        const pdfjs=await loadPdfJs()
        const pdf=await pdfjs.getDocument(url).promise
        if(!host.isConnected) return
        const prefill=profilePdfPrefill()
        host.innerHTML=''
        host.dataset.pdfReady='false'
        for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){
          if(!host.isConnected) return
          const page=await pdf.getPage(pageNo)
          const viewport=page.getViewport({scale:1.65})
          const pageBox=document.createElement('div');pageBox.className='aok-pdf-page'
          const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height)
          pageBox.appendChild(canvas);host.appendChild(pageBox)
          await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise
          if(!host.isConnected) return
          const textContent=await page.getTextContent()
          // Independently checked against original AOK BW PG24 Annex 4 (01.09.2026).
          // For all other widgets, geometric inference remains a suggestion,
          // never a verified semantic field mapping.
          const verifiedLabels={
            1:{
              Text1:'Grund der Vorstellung',
              Text2:'Vorname, Name, Geburtsdatum bzw. Adressaufkleber',
              Text3:'Körpergröße (m)',
              Text4:'Körpergewicht (kg)',
              Text5:'Verordnende Arztpraxis (Name, Anschrift)',
              Text6:'Fachpraxis'
            },
            2:{
              Text24:'PLUS-M Rohwert',
              Text25:'PLUS-M T-Score',
              Text26:'Primär verwendete Gehhilfe'
            }
          }
          const aiTextItems=(textContent.items||[]).map(item=>{
            const tx=pdfjs.Util.transform(viewport.transform,item.transform)
            return {text:String(item.str||'').trim(),x:tx[4],y:tx[5],w:(Number(item.width)||0)*viewport.scale}
          }).filter(x=>x.text)
          const inferAiLabel=(left,top,width,height)=>{
            const cy=top+height/2
            const same=aiTextItems.filter(t=>Math.abs(t.y-cy)<18 && t.x<left+width && (left-(t.x+t.w))<260)
              .sort((a,b)=>(left-(b.x+b.w))-(left-(a.x+a.w)))
            const above=aiTextItems.filter(t=>t.y<top+4 && (top-t.y)<34 && Math.abs(t.x-left)<240)
              .sort((a,b)=>(top-b.y)-(top-a.y))
            const parts=(same.length?same:above).slice(0,3).map(x=>x.text).filter(Boolean)
            return parts.join(' ').replace(/\s+/g,' ').trim()
          }
          const anns=await page.getAnnotations({intent:'display'})
          // Portal original has an interactive signature for both parties and
          // two dates; the user-provided version only has provider date/signature.
          const officialSignatureLayout=pageNo===4 && anns.some(a=>/^Textfeld\s*68$/i.test(String(a.fieldName||''))) &&
            anns.some(a=>/^Textfeld\s*70$/i.test(String(a.fieldName||'')))
          anns.filter(a=>a.subtype==='Widget').forEach((ann,index)=>{
            const vr=viewport.convertToViewportRectangle(ann.rect)
            const left=Math.min(vr[0],vr[2]),top=Math.min(vr[1],vr[3])
            const width=Math.abs(vr[2]-vr[0]),height=Math.abs(vr[3]-vr[1])
            const fieldName=ann.fieldName||ann.id||('feld'+index)
            const canonicalName=canonicalAokProfileTextName(fieldName)
            const key=aokProfileKey(canonicalName,side)
            const nearbyLabel=inferAiLabel(left,top,width,height)||ann.alternativeText||''
            if(pageNo===2 && renderAokPage2WalkingAidOption(pageBox,fieldName,left,top,width,height,viewport,side)){
              return
            }
            if(pageNo===4){
              // AOK portal source: Textfeld 67 = insured signature, 68 = date;
              // Textfeld 69 = provider signature, 70 = date.
              // User-provided variant: Text67 = provider DATE, Text69 = signature;
              // printed insured signature has no editable PDF widget.
              if(officialSignatureLayout && canonicalName==='Text67' && width>viewport.width*.25){
                appendAokSignaturePad(
                  pageBox,aokProfileKey('insuredSignature',side),
                  'Unterschrift der Versicherten bzw. gesetzlichen Vertretung / Bevollmächtigten','insured',
                  left,top,width,height,viewport,true
                )
                return
              }
              if(canonicalName==='Text69' && width>viewport.width*.25){
                appendAokSignaturePad(
                  pageBox,aokProfileKey('providerSignature',side),
                  'Unterschrift / Stempel Hilfsmittelanbieter','provider',
                  left,top,width,height,viewport,true
                )
                return
              }
            }
            let el
            if(ann.fieldType==='Btn'){
              el=document.createElement('input');el.type='checkbox';el.className='aok-pdf-input aok-pdf-check'
              el.checked=values[key]===true
              el.addEventListener('change',()=>{values[key]=el.checked;queueAutosaveSupply();updateWizardStatus()})
            }else{
              el=ann.multiLine?document.createElement('textarea'):document.createElement('input')
              if(el.tagName==='TEXTAREA') el.rows=1
              else el.type='text'
              el.className='aok-pdf-input'
              const initial=values[key]!==undefined?values[key]:(prefill[canonicalName]||ann.fieldValue||'')
              el.value=initial
              if(values[key]===undefined && initial) values[key]=initial
              if(pageNo===2 && (canonicalName==='Text24'||canonicalName==='Text25')){
                el.readOnly=true
                el.classList.add('aok-plusm-calculated')
                el.title=canonicalName==='Text24'?'Automatisch berechneter PLUS-M Rohwert':'Automatisch ermittelter PLUS-M T-Score (12-Item v1.2)'
              }else{
                const save=()=>{values[key]=el.value;queueAutosaveSupply();updateWizardStatus()}
                el.addEventListener('input',save);el.addEventListener('change',save)
              }
            }
            el.dataset.profileKey=key
            el.dataset.profileSide=side
            el.dataset.required='false'
            const sourceVerifiedLabel=verifiedLabels[pageNo]?.[canonicalName]
            const aiLabel=sourceVerifiedLabel||nearbyLabel||fieldName||'Profilerhebungsfeld'
            el.dataset.aiLabel=aiLabel
            el.dataset.semanticMapping=sourceVerifiedLabel?'source-verified':'unverified-geometric-inference'
            el.setAttribute('aria-label',aiLabel)
            applyRuntimeStyle(el,'geometry',{
              left:(left/viewport.width*100)+'%',
              top:(top/viewport.height*100)+'%',
              width:Math.max(width/viewport.width*100,1.2)+'%',
              height:Math.max(height/viewport.height*100,1.1)+'%',
              'font-size':Math.max(8,Math.min(14,height*.55))+'px'
            })
            pageBox.appendChild(el)
          })
          if(pageNo===2) renderPlusMPage2Overlays(pageBox,side)
          if(pageNo===4) ensureAokPage4SignaturePads(pageBox,aiTextItems,viewport,side)
        }
        if(!host.isConnected) return
        host.dataset.pdfReady='true'
        updateWizardStatus()
      }catch(err){
        if(!host.isConnected) return
        host.dataset.pdfReady='error'
        updateWizardStatus()
        host.innerHTML='<div class="aok-pdf-loading">Der Original-AOK-Profilerhebungsbogen konnte nicht als beschreibbare Ansicht geladen werden. <a target="_blank" rel="noopener" href="'+url+'">Original-PDF öffnen ↗</a></div>'
      }
    }

    function updateAokPg24ProfileHint(){
      const hint=$('profileHint')
      if(!hint) return
      const bilateral=values.side==='beidseitig'
      hint.className=bilateral?'status-card open':'status-card ready'
      hint.innerHTML='<strong>AOK-Vertragsbogen aktiv</strong>Ausschließlich der AOK-Profilerhebungsbogen wird angezeigt. Stammdaten werden nur dort vorbelegt, wo die Zuordnung eindeutig ist. PLUS-M auf Seite 2 wird zeilenweise exklusiv ausgewählt und automatisch bewertet; die Unterschriften der versicherten Person/Vertretung und des Hilfsmittelanbieters auf Seite 4 sind als Stift-, Touch- und Maus-Signaturfelder ausgeführt.'+
        '<p class="source-note"><strong>Quellprüfung:</strong> Die Erhebung ist nach dem Hinweis auf Seite 4 freiwillig. Angaben mit „ja → spezifisch“ beziehungsweise „auffällig → spezifisch“ sind situationsabhängig zu erläutern. Die derzeitige technische Mindestprüfung ersetzt keine vollständig fachlich geprüfte Vertragsfeldmatrix.</p>'+
        (bilateral?'<p><strong>Beidseitige Amputation:</strong> Anlage 4 wird als zwei separate, vierseitige Originalbögen ausgegeben: zuerst rechts, danach links. Feldwerte, PLUS-M und Unterschriften werden pro Seite getrennt gespeichert. Der Profilschritt erfordert Angaben für beide Seiten.</p>':'')
    }

    let aokProfileRenderGeneration=0
    function renderAokPg24Profile(){
      // A case restore can launch more than one asynchronous PDF load.
      const generation=++aokProfileRenderGeneration
      const host=$('fieldList')
      host.className=''
      $('fieldInfo').textContent='AOK Baden-Württemberg · PG24 · Anlage 4 Profilerhebungsbogen. Feldbezeichnungen und Reihenfolge entsprechen dem Originalbogen.'
      updateAokPg24ProfileHint()
      const url='assets/aok-pg24/anlage-4-profilerhebungsbogen.pdf'
      const bilateral=values.side==='beidseitig'
      const sides=aokProfileSides()
      host.innerHTML=sides.map((side,i)=>
        '<section class="profile-original-wrap aok-profile-original-document" data-aok-profile-side="'+escapeHtml(side||'einseitig')+'">'+
        '<div class="profile-original-toolbar"><div><span class="aok-source-badge">AOK Original</span> <strong>Anlage 4 · Profilerhebungsbogen PG24'+(bilateral?' · '+(side==='rechts'?'Rechts':'Links'):'')+'</strong>'+
        (bilateral?'<small> · Originalbogen '+(i+1)+' von 2, getrennt gespeichert</small>':'')+
        '</div><a class="secondary aok-measure-open" target="_blank" rel="noopener" href="'+url+'">Original öffnen ↗</a></div>'+
        '<div '+(!bilateral?'id="aokProfilePdfPages" ':'')+'class="aok-pdf-pages" data-aok-pdf-side="'+escapeHtml(side||'einseitig')+'"><div class="aok-pdf-loading">AOK-Profilerhebungsbogen wird geladen …</div></div></section>'
      ).join('')
      // Keep both original documents in the DOM for an eight-page print;
      // render serially to avoid concurrent PDF canvases exhausting memory.
      void (async()=>{
        for(const side of sides){
          if(generation!==aokProfileRenderGeneration || !host.isConnected) return
          const box=host.querySelector('[data-aok-pdf-side="'+(side||'einseitig')+'"]')
          if(!box || !box.isConnected) return
          await renderEditableProfilePdf(url,box,side)
        }
      })()
    }

    function bindTechProfileControl(el,key,prefill='',readonly=false){
      if(values[key]===undefined && prefill!==undefined && prefill!==null && String(prefill)!=='') values[key]=prefill
      if(el.type==='checkbox'){
        const arr=Array.isArray(values[key])?values[key]:[]
        el.checked=arr.includes(el.value)
        el.addEventListener('change',()=>{
          const all=[...document.querySelectorAll('[data-tech-key="'+CSS.escape(key)+'"]')].filter(x=>x.type==='checkbox')
          values[key]=all.filter(x=>x.checked).map(x=>x.value)
          updateWizardStatus()
        })
      }else{
        el.value=values[key]??''
        if(readonly){el.readOnly=true;el.classList.add('tech-profile-readonly')}
        const save=()=>{values[key]=el.value;updateWizardStatus()}
        if(!readonly){el.addEventListener('input',save);el.addEventListener('change',save)}
      }
      el.dataset.techKey=key
      el.dataset.required='false'
      return el
    }

    function techProfileField(parent,label,key,type='text',options=[],prefill='',readonly=false){
      const box=document.createElement('label');box.className='tech-profile-field'
      const cap=document.createElement('span');cap.textContent=label;box.appendChild(cap)
      let el
      if(type==='textarea'){el=document.createElement('textarea');el.rows=3}
      else if(type==='select'){
        el=document.createElement('select')
        el.innerHTML='<option value="">Bitte wählen</option>'+options.map(x=>'<option>'+escapeHtml(x)+'</option>').join('')
      }else{el=document.createElement('input');el.type=type}
      bindTechProfileControl(el,key,prefill,readonly)
      box.appendChild(el);parent.appendChild(box);return el
    }

    function techProfileChecks(parent,label,key,options,prefill=[]){
      const box=document.createElement('div');box.className='tech-profile-field'
      const cap=document.createElement('span');cap.textContent=label;box.appendChild(cap)
      if(values[key]===undefined && prefill.length) values[key]=prefill
      const opts=document.createElement('div');opts.className='tech-checks'
      options.forEach(v=>{const l=document.createElement('label');const e=document.createElement('input');e.type='checkbox';e.value=v;bindTechProfileControl(e,key);l.append(e,document.createTextNode(v));opts.appendChild(l)})
      box.appendChild(opts);parent.appendChild(box);return box
    }

    function techProfileSection(host,title,cols=2){
      const section=document.createElement('section');section.className='tech-profile-section'
      const h=document.createElement('h4');h.textContent=title
      const grid=document.createElement('div');grid.className='tech-profile-grid'+(cols===3?' three':'')
      section.append(h,grid);host.appendChild(section);return grid
    }

    function techMobilityBlock(host,grade,title,questions){
      const details=document.createElement('details');details.className='mobility-block'
      const summary=document.createElement('summary');summary.textContent='Mobilitätsgrad '+grade+' · '+title
      const list=document.createElement('div');list.className='mobility-list'
      questions.forEach((q,i)=>{
        const row=document.createElement('div');row.className='mobility-row'
        const span=document.createElement('span');span.textContent=q
        const sel=document.createElement('select')
        sel.innerHTML='<option value="">Bitte wählen</option><option>Weniger</option><option>Trifft zu</option><option>Mehr</option><option>Entfällt</option>'
        bindTechProfileControl(sel,'tech:mob:'+grade+':'+i)
        row.append(span,sel);list.appendChild(row)
      })
      details.append(summary,list);host.appendChild(details)
    }

    function renderTechnikerPg24Profile(){
      const host=$('fieldList');host.innerHTML='';host.className='tech-profile'
      $('fieldInfo').textContent='PG24 · FO_PG24_Anamnesebogen Techniker / allgemeiner Techniker-Profilerhebungsbogen. Stammdaten werden automatisch übernommen und müssen nicht doppelt erfasst werden.'
      const hint=$('profileHint');hint.className='status-card ready'
      hint.innerHTML='<strong>Allgemeiner PG24-Technikerbogen aktiv</strong>Für diesen Kostenträger wird kein AOK-BW-Vertragsbogen verwendet. Es werden nur die Felder dieses PG24-Erhebungsbogens angezeigt.'

      const sideMap={rechts:'Rechts',links:'Links',beidseitig:'Beidseitig'}
      const ampMap={'Vor-/Mittelfuß':'Teilfußamputation','Fuß/Fußwurzel/Rückfuß':'Fuß','Unterschenkel':'Unterschenkel','Knie-Exartikulation':'Knieexartikulation','Oberschenkel':'Oberschenkel','Hüft-Exartikulation / Hemipelvis':'Hüftexartikulation / Hemipelvektomie'}
      const supply=['Folge','Wechsel','Reparatur','Änderung','Instandhaltung'].includes(values.supplyType)?'Folgeversorgung':'Erstversorgung'

      let g=techProfileSection(host,'Angaben zur Person',3)
      techProfileField(g,'Nachname','tech:lastName','text',[],values.patientLastName||'')
      techProfileField(g,'Vorname','tech:firstName','text',[],values.patientFirstName||'')
      techProfileField(g,'Geburtsdatum','tech:dob','date')
      techProfileField(g,'Straße','tech:street')
      techProfileField(g,'Ort','tech:city')
      techProfileField(g,'Telefon','tech:phone','tel')
      techProfileField(g,'Versichertennummer','tech:insuranceNo','text',[],values.insuredNo||'',true)
      techProfileField(g,'Geschlecht','tech:sex','select',['Männlich','Weiblich'])
      techProfileField(g,'Gewicht (kg)','tech:weight','number')
      techProfileField(g,'Größe (cm)','tech:height','number')

      g=techProfileSection(host,'Angaben zur Amputation',3)
      techProfileField(g,'Amputationsseite','tech:side','select',['Links','Rechts','Beidseitig'],sideMap[values.side]||'')
      techProfileField(g,'Versorgung','tech:supplyKind','select',['Erstversorgung','Folgeversorgung'],supply)
      techProfileField(g,'Bezeichnung des ausgeübten Berufs','tech:profession')
      techProfileField(g,'Amputationsgrund','tech:ampReason','textarea')
      techProfileField(g,'Datum der Amputation','tech:ampDate','date')
      techProfileField(g,'Wo wurde die Amputation durchgeführt','tech:ampPlace')
      techProfileField(g,'Nachamputation','tech:reamputation','select',['Ja','Nein'])
      techProfileField(g,'Datum Nachamputation','tech:reamputationDate','date')
      techProfileField(g,'Akutbehandlung stationär beendet','tech:acuteDone','select',['Ja','Nein'])
      techProfileField(g,'Rehabilitationsmaßnahme erfolgt','tech:rehabDone','select',['Ja','Nein'])
      techProfileField(g,'In physiotherapeutischer Behandlung','tech:physio','select',['Ja','Nein'])
      techProfileField(g,'Amputationshöhe','tech:ampLevel','select',['Hemipelvektomie','Hüftexartikulation','Oberschenkel','Knieexartikulation','Unterschenkel','Fuß','Teilfußamputation'],ampMap[values.ampLevel]||'')
      techProfileField(g,'Art der Fußamputation','tech:footAmpType')

      g=techProfileSection(host,'Versorgungsrelevante Erkrankungen, Behinderungen und Therapien',2)
      techProfileField(g,'Allgemeine Erkrankungen mit Auswirkungen auf das Tragen der Prothese','tech:generalDiseases','textarea')
      techProfileField(g,'Hauterkrankungen','tech:skinDiseases','textarea')
      techProfileField(g,'Weitere Hinweise (z. B. Implantate, Endoprothesen)','tech:medicalNotes','textarea')

      g=techProfileSection(host,'Angaben zur Vorversorgung',2)
      techProfileField(g,'Datum der Versorgung','tech:previousDate','date')
      techProfileField(g,'Wer führte die Vorversorgung durch','tech:previousProvider')
      techProfileField(g,'Ist diese ausreichend und zweckmäßig','tech:previousAdequate','select',['Ja','Nein'])
      techProfileField(g,'Wenn nein, welche Änderungen sind erforderlich','tech:previousChanges','textarea')
      techProfileField(g,'Bauart des Schaftes','tech:previousSocket')
      techProfileField(g,'Welcher Fuß mit welchen Funktionen','tech:previousFoot','textarea')
      techProfileField(g,'Welches Kniegelenk mit welchen Funktionen','tech:previousKnee','textarea')
      techProfileField(g,'Welches Hüftgelenk mit welchen Funktionen','tech:previousHip','textarea')
      techProfileField(g,'Weitere Funktionspassteile','tech:previousParts','textarea')
      techProfileField(g,'Welche Prothesenverkleidung','tech:previousCover')
      techProfileField(g,'Gewicht der Prothese','tech:previousWeight','number')

      g=techProfileSection(host,'Spezielle Angaben zum prothetisch zu versorgenden und zum kontralateralen Bein',2)
      techProfileField(g,'Amputationsart / -technik','tech:ampTechnique','textarea')
      techProfileField(g,'Stumpfform','tech:stumpShape','select',['zylindrisch','konisch','birnenförmig'])
      techProfileField(g,'Wurden stumpfformende Maßnahmen durchgeführt (Wickeln)','tech:stumpShaping','select',['Ja','Nein'])
      techProfileField(g,'Ist die Wundheilung abgeschlossen','tech:woundHealed','select',['Ja','Nein'])
      techProfileField(g,'Weichteildeckung des Stumpfes','tech:softCover','select',['ausreichend','nicht ausreichend','übermäßig'])
      techProfileField(g,'Endbelastung des Stumpfes','tech:endLoad','select',['nicht','teilweise','voll'])
      techProfileField(g,'Palpationsbefund','tech:palpation','textarea')
      techProfileChecks(g,'Amputationsnarbe','tech:scar',['verheilt','noch nicht verheilt','eingezogen','mit dem Knochen verwachsen'])
      techProfileField(g,'Zusätzliche Narben / Narbenverlauf','tech:additionalScars','textarea')
      techProfileField(g,'Zusätzliche Hautläsionen, Druck- u. Scheuerstellen','tech:skinLesions','textarea')
      techProfileField(g,'Hautempfindung','tech:skinSensitivity','select',['normal','hochsensibel','reduziert'])
      techProfileField(g,'Hauttransplantation','tech:skinTransplant','select',['Ja','Nein'])
      techProfileField(g,'Farbe der Haut','tech:skinColor','select',['normal','andere Verfärbung'])
      techProfileField(g,'Hauttemperatur','tech:skinTemperature','select',['warm','kalt'])
      techProfileField(g,'Ödeme – wo','tech:edema','textarea')
      techProfileField(g,'Gefäßstatus / Gefäßprothese','tech:vascular','textarea')

      g=techProfileSection(host,'Schmerzen und sonstige Befunde',2)
      techProfileField(g,'Stumpfschmerzen – Wo / Wann / Wie oft / Seit wann / provozierbar','tech:stumpPain','textarea')
      techProfileField(g,'Phantomschmerzen – Wo / Wann / Wie oft / Seit wann / provozierbar','tech:phantomPain','textarea')
      techProfileField(g,'Bisherige Therapie der Schmerzen','tech:painTherapy','textarea')
      techProfileField(g,'Röntgenbefund','tech:xray','textarea')
      techProfileField(g,'Muskelkraft','tech:muscleStrength','select',['voll','reduziert','aufgehoben'])
      techProfileField(g,'Volumenschwankung','tech:volumeChange','select',['Ja','Nein'])
      techProfileField(g,'Nachamputation indiziert','tech:reamputationIndicated','select',['Ja','Nein'])
      techProfileField(g,'Infektionen','tech:infections','textarea')
      techProfileField(g,'Statische Veränderungen des Beckens, die nicht ausgeglichen werden sollten','tech:pelvisStatic','select',['Ja','Nein'])
      techProfileField(g,'Nähere Angaben','tech:pelvisStaticDetails','textarea')

      g=techProfileSection(host,'Fragen zur Prothesenfähigkeit',2)
      techProfileField(g,'Ist der Stumpf aus medizinischer Sicht prothetisch versorgbar','tech:prostheticSuitable','select',['Ja','Nein'])
      techProfileField(g,'Ist eine Versorgung mit einem Interimsschaftsystem angezeigt','tech:interimIndicated','select',['Ja','Nein'])
      techProfileField(g,'Ist die Stumpfreifung nach Interimsversorgung abgeschlossen','tech:stumpMature','select',['Ja','Nein'])

      g=techProfileSection(host,'Angaben zur Gelenkfunktion',1)
      techProfileField(g,'Gelenkbefunde inkl. Gelenkbeweglichkeit in der Neutral-Null-Methode der Amputations- und Gegenseite','tech:joints','textarea')

      const mobilitySection=document.createElement('section');mobilitySection.className='tech-profile-section'
      const mh=document.createElement('h4');mh.textContent='Fähigkeiten / Mobilitätsmerkmale des Patienten (am Tag der Erhebung)'
      mobilitySection.appendChild(mh)
      techMobilityBlock(mobilitySection,'0','Nichtgehfähiger',[
        'Alleine sitzen','Auf dem erhaltenen Bein im Gehbarren stehen','Das Stehgleichgewicht im Gehbarren halten',
        'Im Gehbarren oder mit Gehwagen gehen','Mit fremder Hilfe aus sitzender Position aufstehen','Mit fremder Hilfe aus stehender Position hinsetzen',
        'Die Prothese mit fremder Hilfe an- und ablegen','Der Einweisung in den Gebrauch der Prothese geistig folgen',
        'Sich weitgehend alleine an- und ausziehen','Sich weitgehend alleine waschen / duschen / baden'
      ])
      techMobilityBlock(mobilitySection,'1','Innenbereichsgeher',[
        'Sich im häuslichen Bereich mittels Prothese fortbewegen und sich mobil halten','In einförmig langsamer Geschwindigkeit gehen',
        'Die Prothese geringfügig stoßbelasten','Kleine hausinterne Hindernisse überwinden','Die Prothese weitgehend selbständig an- und ablegen',
        'Auf dem erhaltenen Bein mit Gehstützen stehen','Das Stehgleichgewicht mit Gehstützen halten','Mit Gehstützen gehen',
        'Selbständig aus sitzender Position aufstehen','Sich selbständig aus der stehenden Position hinsetzen'
      ])
      techMobilityBlock(mobilitySection,'2','Eingeschränkter Außenbereichsgeher',[
        'Mit Prothese bis zu 15 Minuten gehen','Bordsteinkanten / Stufen bewältigen','Kleine Umwelthindernisse überschreiten',
        'Auf leichten Bodenunebenheiten gehen','Selten seine Gehgeschwindigkeit wechseln','Öffentliche Transportmittel mit Hilfe benutzen',
        'Die Prothese moderat stoßbelasten','Sich therapeutisch / gehschulisch trainieren','Kleineinkäufe selbständig erledigen'
      ])
      techMobilityBlock(mobilitySection,'3','Uneingeschränkter Außenbereichsgeher',[
        'Auf dem erhaltenen Bein stehen','Das Stehgleichgewicht halten','Sich im Innen- und Außenbereich nur unwesentlich limitiert bewegen',
        'Treppen / Stufen bewältigen','Fast alle Umwelthindernisse bewältigen','Auf Bodenunsicherheiten wie Schlamm, Nässe, Schnee oder Eis gehen',
        'Häufig die Gehgeschwindigkeit wechseln','Alle öffentlichen Transportmittel benutzen','Eigene Transportmittel benutzen',
        'Seinen Beruf ausüben','Seine Familie / Haushalt versorgen','Andere Personen versorgen, z. B. pflegen',
        'Die Prothese stoßbelasten','Aktivitäten mit körperlicher Belastung ausüben'
      ])
      techMobilityBlock(mobilitySection,'4','Uneingeschränkter Außenbereichsgeher mit besonders hohen Ansprüchen',[
        'Sich auch in bergiger Umgebung oder auf unebenem Untergrund unlimitiert bewegen',
        'Sich in allen Geschwindigkeitsbereichen bewegen und diese ständig wechseln',
        'Die Prothese im täglichen Einsatz zeitlich unlimitiert beanspruchen',
        'Durch hohe körperliche Aktivitäten die Prothese überdurchschnittlich stoßbelasten und mechanisch beanspruchen'
      ])
      host.appendChild(mobilitySection)

      g=techProfileSection(host,'Therapieziel / Bewertung',2)
      const therapyNote=document.createElement('p')
      therapyNote.className='source-note'
      therapyNote.textContent='Individuelles Therapieziel wird nach der Maßaufnahme im Schritt Versorgungsplanung dokumentiert und mit dem Technikerbogen verknüpft.'
      g.appendChild(therapyNote)
      techProfileField(g,'Ermittelter Mobilitätsgrad','tech:mobilityGrade','select',['0 – Nichtgehfähiger','1 – Innenbereichsgeher','2 – Eingeschränkter Außenbereichsgeher','3 – Uneingeschränkter Außenbereichsgeher','4 – Uneingeschränkter Außenbereichsgeher mit besonders hohen Ansprüchen'])
      techProfileField(g,'Beschreibung der weiteren Fähigkeiten','tech:furtherAbilities','textarea')
      techProfileField(g,'Mit dem Therapieziel verbundene weitere Maßnahmen','tech:furtherMeasures','textarea')
      techProfileField(g,'Wohnungswechsel erforderlich','tech:movingRequired','select',['Ja','Nein'])
      techProfileField(g,'Psychotherapeutische Motivierung','tech:psychotherapy','select',['Ja','Nein'])
      techProfileField(g,'Gehschulung','tech:gaitTraining','select',['ambulant','stationär'])
      techProfileField(g,'Krankengymnastische Mobilisierung','tech:physioMobilization','select',['Ja','Nein'])
      techProfileField(g,'Weitere benötigte Hilfsmittel','tech:furtherAids','textarea')
      techProfileField(g,'Sonstige medizinische Hinweise / Alternativvorschläge','tech:otherMedicalNotes','textarea')

      g=techProfileSection(host,'Wer führte die Beurteilung durch / Bestätigung',2)
      techProfileField(g,'Arzt/in','tech:assessorDoctor')
      techProfileField(g,'Datum Arzt/in','tech:assessorDoctorDate','date')
      techProfileField(g,'Physiotherapeut/in','tech:assessorPhysio')
      techProfileField(g,'Datum Physiotherapeut/in','tech:assessorPhysioDate','date')
      techProfileField(g,'Orthopädietechniker/in','tech:assessorTech')
      techProfileField(g,'Datum Orthopädietechniker/in','tech:assessorTechDate','date')
      techProfileField(g,'Name Versicherte/r / Betreuer/in','tech:consentName','text',[],[values.patientFirstName,values.patientLastName].filter(Boolean).join(' '))
      techProfileField(g,'Datum Einverständnis','tech:consentDate','date')
      techProfileSignature(g,'Unterschrift Versicherte/r bzw. Betreuer/in','tech:insuredSignature')
    }

    let pdfJsLoader=null
    function loadPdfJs(){
      if(!pdfJsLoader){
        pdfJsLoader=import('./vendor/pdfjs/pdf.min.mjs').then(pdfjs=>{
          pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.min.mjs',import.meta.url).href
          return pdfjs
        })
      }
      return pdfJsLoader
    }

    function aokMeasureValueKey(asset,pageNo,ann,index,duplicate=false){
      const name=ann.fieldName||ann.id||('feld'+index)
      const legacy='aokMeasure:'+asset.file+':p'+pageNo+':'+name
      // A repeated AcroForm name is not an individual field identity.
      return duplicate?legacy+':widget'+(index+1):legacy
    }

    function aokMeasureAnnexCode(asset){
      const m=String(asset?.file||'').match(/^anlage-(5[a-e])-/i)
      return m?m[1].toLowerCase():'aok-pg24'
    }

    function pdfMeasureContext(ann,viewport,textItems,left,top,width,height){
      if(String(ann.alternativeText||'').trim()) return {label:String(ann.alternativeText).trim(),basis:'pdf-tooltip'}
      const cy=top+height/2
      const nearby=textItems.filter(t=>t.text && Math.abs(t.y-cy)<22 && t.x<left+width && left-(t.x+t.w)<230)
        .sort((a,b)=>Math.abs((left-(a.x+a.w)))+Math.abs(a.y-cy)*2-(Math.abs(left-(b.x+b.w))+Math.abs(b.y-cy)*2))
      const above=textItems.filter(t=>t.text && t.y<top+4 && top-t.y<38 && Math.abs(t.x-left)<210)
        .sort((a,b)=>(top-a.y)-(top-b.y))
      const label=(nearby[0]||above[0])?.text||''
      return {label:label.slice(0,150),basis:label?'position-unverified':'unmapped'}
    }

    async function renderEditableAokPdf(url,asset,host){
      try{
        const pdfjs=await loadPdfJs()
        const pdf=await pdfjs.getDocument(url).promise
        if(!host.isConnected)return
        host.innerHTML=''
        host.dataset.pdfReady='false'
        const annex=aokMeasureAnnexCode(asset)
        let total=0
        for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){
          if(!host.isConnected)return
          const page=await pdf.getPage(pageNo)
          const viewport=page.getViewport({scale:1.65})
          const pageBox=document.createElement('div');pageBox.className='aok-pdf-page'
          const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height)
          pageBox.appendChild(canvas);host.appendChild(pageBox)
          await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise
          if(!host.isConnected)return
          const [annotations,content]=await Promise.all([page.getAnnotations({intent:'display'}),page.getTextContent()])
          const items=(content.items||[]).map(item=>{
            const t=pdfjs.Util.transform(viewport.transform,item.transform)
            return {text:String(item.str||'').trim(),x:t[4],y:t[5],w:(Number(item.width)||0)*viewport.scale}
          })
          const widgets=annotations.filter(a=>a.subtype==='Widget')
          const nameCounts=new Map()
          widgets.forEach(ann=>{const n=String(ann.fieldName||ann.id||'');nameCounts.set(n,(nameCounts.get(n)||0)+1)})
          widgets.forEach((ann,index)=>{
            const vr=viewport.convertToViewportRectangle(ann.rect)
            const left=Math.min(vr[0],vr[2]),top=Math.min(vr[1],vr[3])
            const width=Math.abs(vr[2]-vr[0]),height=Math.abs(vr[3]-vr[1])
            const fieldName=String(ann.fieldName||ann.id||('feld'+index))
            const duplicated=(nameCounts.get(fieldName)||0)>1
            const key=aokMeasureValueKey(asset,pageNo,ann,index,duplicated)
            const fieldId=annex.toUpperCase()+'-P'+pageNo+'-F'+(index+1)
            const context=pdfMeasureContext(ann,viewport,items,left,top,width,height)
            let el
            if(ann.fieldType==='Btn'){
              el=document.createElement('input');el.type='checkbox';el.className='aok-pdf-input aok-pdf-check'
              const stored=values[key]
              el.checked=stored===true || stored==='Ja' || stored===ann.exportValue
              el.addEventListener('change',()=>{values[key]=el.checked;queueAutosaveSupply();updateWizardStatus()})
            }else{
              el=ann.multiLine?document.createElement('textarea'):document.createElement('input')
              if(el.tagName==='TEXTAREA')el.rows=1
              else el.type='text'
              el.className='aok-pdf-input'
              const stored=values[key]
              el.value=stored!==undefined&&stored!==null?stored:(ann.fieldValue||'')
              if(stored===undefined&&el.value)values[key]=el.value
              const save=()=>{values[key]=el.value;queueAutosaveSupply();updateWizardStatus()}
              el.addEventListener('input',save);el.addEventListener('change',save)
            }
            el.dataset.measureKey=key
            el.dataset.measureFieldId=fieldId
            el.dataset.measureOriginalName=fieldName
            el.dataset.measureContext=asset.name+' · Seite '+pageNo+' · '+fieldName
            el.dataset.measureLabel=context.label||fieldName
            el.dataset.measureMapping=context.basis
            el.dataset.measureValue=el.type==='checkbox'?'false':'true'
            el.setAttribute('aria-label',fieldId+' · '+el.dataset.measureContext+(context.label?' · Kontextvorschlag: '+context.label+' (prüfen)':''))
            el.title=fieldId+' · '+fieldName+(context.label?' · '+context.label+' (Zuordnung prüfen)':'')
            // Existing original PDF/canvas remains unchanged; only the active
            // overlay field receives an outline and a separate contextual readout.
            el.addEventListener('focus',()=>{
              host.querySelectorAll('.aok-pdf-input.measure-active-control').forEach(x=>x.classList.remove('measure-active-control'))
              el.classList.add('measure-active-control')
              const info=$('aokMeasureActiveField')
              if(info)info.textContent=fieldId+' · '+fieldName+(context.label?' · Textnähe (unverifiziert): '+context.label:' · Fachbezeichnung noch zu prüfen')
              // Only original-widget position has been verified. Do not
              // place an anatomical marker without a confirmed source map.
              const region=$('measureOrientationRegion')
              if(region)region.textContent='Anatomische Verortung dieses PDF-Felds noch nicht quellengeprüft; Originalskizze nur zur Orientierung.'
            })
            applyRuntimeStyle(el,'geometry',{
              left:(left/viewport.width*100)+'%',
              top:(top/viewport.height*100)+'%',
              width:Math.max(width/viewport.width*100,1.2)+'%',
              height:Math.max(height/viewport.height*100,1.1)+'%',
              'font-size':Math.max(8,Math.min(14,height*.55))+'px'
            })
            pageBox.appendChild(el)
            total++
          })
        }
        if(!host.isConnected)return
        host.dataset.pdfReady=total?'true':'no-form-widgets'
        const info=$('aokMeasureActiveField')
        if(info)info.textContent=total+' beschreibbare Originalfelder · Kennung '+annex.toUpperCase()+'-P[Seite]-F[Position]. Beschriftungen aus Textnähe sind nicht fachlich bestätigt.'
        renderMeasureTranscriptCatalog()
        updateWizardStatus()
      }catch(err){
        if(!host.isConnected)return
        host.dataset.pdfReady='error'
        host.innerHTML='<div class="aok-pdf-loading">Das Originalmaßblatt konnte nicht als beschreibbare Ansicht geladen werden. <a target="_blank" rel="noopener" href="'+url+'">Original-PDF öffnen ↗</a></div>'
        renderMeasureTranscriptCatalog()
      }
    }

    let measureTranscriptProposals=[]
    function measureEditableControls(){
      return [...$('measureFieldList').querySelectorAll('[data-measure-field-id][data-measure-key]')]
        .filter(el=>el.matches('input,textarea,select') && !el.disabled && !el.readOnly)
    }
    function renderMeasureTranscriptCatalog(){
      const status=$('measureTranscriptStatus')
      if(!status)return
      const controls=measureEditableControls()
      const ids=new Set(controls.map(el=>el.dataset.measureFieldId))
      status.textContent=ids.size
        ?ids.size+' eindeutig gekennzeichnete Eingabefelder vorhanden. Zum Diktieren die Kennung vor den Messwert sprechen oder eingeben (z. B. 5B-P1-F3: 32,5 cm). Ein Kontexttext ohne Kennung wird nicht automatisch zugeordnet.'
        :'Maßblatt und Hilfsmittel auswählen, bevor ein Transkript zugeordnet werden kann.'
      measureTranscriptProposals=[]
      if($('measureTranscriptSuggestions'))$('measureTranscriptSuggestions').replaceChildren()
      const catalog=$('measureTranscriptCatalog')
      if(catalog){
        catalog.replaceChildren()
        const added=new Set()
        controls.forEach(el=>{
          const id=el.dataset.measureFieldId
          if(added.has(id))return
          added.add(id)
          const row=document.createElement('div')
          row.className='measure-catalog-row'
          const token=document.createElement('code');token.textContent=id
          const label=document.createElement('span')
          const context=el.dataset.measureContext||''
          const name=el.dataset.measureOriginalName||el.dataset.measureLabel||''
          label.textContent=context+' · '+name+(el.dataset.measureMapping==='position-unverified'?' · Textnähe ungeprüft':'')
          row.append(token,label);catalog.appendChild(row)
        })
      }
    }
    function measureTranscriptEntries(raw){
      const chunks=String(raw||'').split(/[\n;]/).map(x=>x.trim()).filter(Boolean)
      const matches=[],errors=[]
      const controls=measureEditableControls()
      const byId=new Map()
      controls.forEach(el=>{
        const id=String(el.dataset.measureFieldId||'').toUpperCase()
        if(!byId.has(id)) byId.set(id,[])
        byId.get(id).push(el)
      })
      const seen=new Set()
      for(const chunk of chunks){
        const m=chunk.match(/^([A-Za-z0-9_.:-]+)\s*(?:=|:)\s*(.+)$/)
        if(!m){errors.push('Keine eindeutige Feldkennung: '+chunk.slice(0,80));continue}
        const id=m[1].toUpperCase()
        const targets=byId.get(id)||[]
        if(targets.length!==1){errors.push(id+': '+(targets.length?'Kennung mehrfach vorhanden':'Feld in diesem Maßblatt nicht gefunden'));continue}
        if(seen.has(id)){errors.push(id+': mehrfach im Transkript, bitte eindeutig angeben');continue}
        seen.add(id)
        const el=targets[0],rawValue=m[2].trim()
        let value=rawValue
        if(el.type==='checkbox'){
          if(/^(ja|angekreuzt|x|1|wahr)$/i.test(rawValue))value=true
          else if(/^(nein|nicht angekreuzt|0|falsch)$/i.test(rawValue))value=false
          else{errors.push(id+': Checkbox erwartet Ja oder Nein');continue}
        }else if(el.tagName==='SELECT'){
          const option=[...el.options].find(o=>o.value.toLowerCase()===rawValue.toLowerCase())
          if(!option){errors.push(id+': Wert ist keine zulässige Auswahl');continue}
          value=option.value
        }
        matches.push({id,el,value,label:el.dataset.measureLabel||el.dataset.measureOriginalName||id,context:el.dataset.measureContext||''})
      }
      return {matches,errors}
    }
    function analyzeMeasureTranscript(){
      const output=$('measureTranscriptSuggestions'),status=$('measureTranscriptStatus')
      if(!output||!status)return
      const {matches,errors}=measureTranscriptEntries($('measureTranscript')?.value)
      measureTranscriptProposals=matches
      output.replaceChildren()
      matches.forEach((m,index)=>{
        const label=document.createElement('label');label.className='profile-ai-suggestion'
        const check=document.createElement('input');check.type='checkbox';check.checked=true;check.dataset.measureProposal=String(index)
        const title=document.createElement('strong');title.textContent=m.id+' · '+m.label
        const val=document.createElement('span');val.textContent=String(m.value)
        label.append(check,title,val);output.appendChild(label)
      })
      if(errors.length){
        const warning=document.createElement('div');warning.className='status-card open'
        warning.textContent='Nicht zugeordnet: '+errors.join(' | ')
        output.appendChild(warning)
      }
      status.textContent=matches.length+' Feldvorschläge vorbereitet, '+errors.length+' nicht zugeordnet. Nur angehakte Vorschläge werden übernommen; bitte Fachinhalt und Maßeinheit kontrollieren.'
    }
    function applyMeasureTranscript(){
      const output=$('measureTranscriptSuggestions'),status=$('measureTranscriptStatus')
      if(!output||!status)return
      let applied=0
      for(let i=0;i<measureTranscriptProposals.length;i++){
        if(!output.querySelector('[data-measure-proposal="'+i+'"]')?.checked)continue
        const proposal=measureTranscriptProposals[i]
        const el=measureEditableControls().find(x=>x===proposal.el && x.dataset.measureFieldId===proposal.id)
        if(!el)continue
        if(el.type==='checkbox')el.checked=proposal.value
        else el.value=proposal.value
        el.dispatchEvent(new Event(el.type==='checkbox'?'change':'input',{bubbles:true}))
        applied++
      }
      measureTranscriptProposals=[]
      output.replaceChildren()
      status.textContent=applied+' bestätigte Feldwerte in das beschreibbare Maßblatt übernommen. Auf korrekte Zuordnung und Maßeinheiten prüfen.'
      queueAutosaveSupply()
    }

    function pg24SourceMeasureSchema(){
      const level=values.ampLevel||''
      if(level==='Unterschenkel') return {
        code:'FMB02003',title:'Maßblatt Unterschenkelprothetik und Kosmetik',version:'Version 2.0 vom 11.03.2025',
        heights:['0 (KS)','3','6','9','12','15','18','21','24','27'],
        circCols:['physiol., Haut','über Liner','unbearb. Positiv','Differenz','bearb. Positiv','Kontrolle am','Schaft am'],
        details:['Kniespalt (KS)-Stumpfende (Linerteller)','KS-Tibiaende','LW: M-L Suprakondylär','LW: M-L Kondylär','LW: A-P 3-er Ebene (locker gemessen)','Flexion Knie'],
        detailCols:['Stumpfmaße','unbearb. Positiv','bearb. Positiv','Kontrolle am','Schaft am'],
        summary:['Kniespalt (KS)-Stumpfende (Linerteller)','KS-Tibiaende','LW: M-L Suprakondylär','LW: M-L Kondylär','LW: A-P 3-er Ebene (locker gemessen)','Flexion Knie','Distales Umfangsmaß','KS – Boden','Fußlänge','Effektive Absatzhöhe','Höhe Oberkante Kniescheibe','Höhe Unterkante Kniescheibe','Y-Maß bei 90 °','Drehpunkt-Boden (def. Prothese)']
      }
      if(level==='Knie-Exartikulation') return {
        code:'FMB02002',title:'Maßblatt Knieexprothetik und Kosmetik',version:'Version 2.0 vom 11.03.2025',
        heights:['5','10','15','20','25','30','35','40','45'],
        circCols:['physiol.','Zug 15 N mit Muskelsp.','unbearb. Positiv','Differenz','bearb. Positiv','Kontrolle am','Schaft am'],
        details:['Mediale Höhe Schaftzuschnitt (vom distalen Stumpfende)','Laterale Höhe Schaftzuschnitt (vom distalen Stumpfende)','Höhe Oberkante Patella','Höhe suprakondyläre Einfassung medial','Höhe mediale Anlage (vom distalen Stumpfende bis Mitte Anlage)','M-L mediale Anlage','M-L Suprakondylär','M-L Kondylär','A-P Höhe mediale Anlage','A-P kondylär'],
        detailCols:['Stumpfmaße','unbearb. Positiv','bearb. Positiv','Kontrolle am','Schaft am'],
        summary:['Mediale Höhe Schaftzuschnitt (vom distalen Stumpfende)','Laterale Höhe Schaftzuschnitt (vom distalen Stumpfende)','Höhe Oberkante Patella','M-L Suprakondylär','M-L Kondylär','A-P kondylär','Flexionsstellung','Adduktionsstellung','Distales Umfangsmaß','Stumpfende – Boden','Drehpunkt – Boden','Tuber – Boden','Fußlänge','Effektive Absatzhöhe','Y-Maß bei 90 °']
      }
      if(level==='Oberschenkel') return {
        code:'FMB02001',title:'Maßblatt Oberschenkelprothetik/PBSS und Kosmetik',version:'Version 2.0 vom 05.03.2025',
        heights:['3','6','9','12','15','18','21','24'],
        circCols:['Umfang physiol. mit Zugmaßband','Umfang Zug 15 N in Exten., aktive Muskulatur','Umfang Zug ohne Muskelsp.','unbearb. Positiv','bearb. Positiv','Kontrolle physiol.','Kontrolle Zug 15 N','Kontrolle ohne Muskelsp.','Schaft'],
        details:['Tuber – Add.-Sehne mediales A-P (7,5–11 cm)','Tuber Rectus Femoris laterales A-P (11–15 cm)','Trochanterbreite','Diagonalmaß (13–18 cm)','Diagonalmaß weichteilig Muskelspan. 3-er Ebene','Vorderes skeletäres M-L (14–17 cm)','Ramus – Stumpfende','Ramus – Femurende','Ramuswinkel','Flexionswinkel (entlang Femur)','Ilio-femural Winkel','Add.-Winkel: Stumpfmitte','distales Umfangsmaß (4 cm oberhalb Stumpfende)'],
        detailCols:['Stumpfmaße','unbearb. Positiv','bearb. Positiv','Kontrolle','Schaft'],
        summary:['Tuber – Add.-Sehne mediales A-P (7,5–11 cm)','Tuber Rectus Femoris laterales A-P (11–15 cm)','Trochanterbreite','Diagonalmaß (13–18 cm)','Vorderes skeletäres M-L (14–17 cm)','Ramus – Stumpfende','Ramus – Femurende','Flexionswinkel (entlang Femur)','Ilio-femural Winkel','distales Umfangsmaß (4 cm oberhalb Stumpfende)','KS – Boden','Drehpunkt – Boden','Tuber – Boden','Fußlänge','Effektive Absatzhöhe','Y-Maß bei 90 °']
      }
      return null
    }

    function sourceMeasureKey(schema,id){return 'sourceMeasure:'+schema.code+':'+id}

    function bindSourceMeasureControl(el,schema,id,label,prefill='',isMeasure=false,isSummary=false){
      const key=sourceMeasureKey(schema,id)
      if(values[key]===undefined && prefill!==undefined && prefill!==null && String(prefill)!=='') values[key]=prefill
      if(el.type==='checkbox'){
        const arr=Array.isArray(values[key])?values[key]:[]
        el.checked=arr.includes(el.value)
        el.addEventListener('change',()=>{
          const all=[...document.querySelectorAll('[data-measure-key="'+CSS.escape(key)+'"]')].filter(x=>x.type==='checkbox')
          values[key]=all.filter(x=>x.checked).map(x=>x.value)
          renderSourceMeasureSummary()
          updateWizardStatus()
        })
      }else{
        el.value=values[key]??''
        const save=()=>{values[key]=el.value;renderSourceMeasureSummary();updateWizardStatus()}
        el.addEventListener('input',save);el.addEventListener('change',save)
      }
      el.dataset.measureKey=key
      el.dataset.measureFieldId=schema.code+'-'+String(id).replace(/[^A-Za-z0-9_-]/g,'_')
      el.dataset.measureContext=schema.title+' · '+(schema.version||'')
      el.setAttribute('aria-label',el.dataset.measureFieldId+' · '+label)
      el.dataset.measureId=String(id)
      el.dataset.measureLabel=label
      if(isMeasure){
        el.dataset.measureValue='true'
        const spot=resolveMeasureOrientationSpot(schema,id,label)
        el.dataset.measureX=String(spot.x)
        el.dataset.measureY=String(spot.y)
        el.dataset.measureSketch=spot.sketch||'main'
        el.dataset.measureRegion=spot.region||''
        const orient=()=>updateMeasureOrientation(schema,el)
        el.addEventListener('focus',orient)
        el.addEventListener('click',orient)
        el.addEventListener('input',orient)
        el.addEventListener('change',orient)
      }
      if(isSummary) el.dataset.measureSummary='true'
      el.dataset.required='false'
      return el
    }

    function sourceMeasureField(parent,schema,label,id,type='text',options=[],prefill='',isMeasure=false,isSummary=false,hint=''){
      const box=document.createElement('label');box.className='source-measure-field'
      const cap=document.createElement('span');cap.textContent=label;box.appendChild(cap)
      let el
      if(type==='textarea'){el=document.createElement('textarea');el.rows=3}
      else if(type==='select'){el=document.createElement('select');el.innerHTML='<option value="">– bitte wählen –</option>'+options.map(x=>'<option>'+escapeHtml(x)+'</option>').join('')}
      else{el=document.createElement('input');el.type=type}
      bindSourceMeasureControl(el,schema,id,label,prefill,isMeasure,isSummary)
      box.appendChild(el)
      if(hint){const s=document.createElement('small');s.textContent=hint;box.appendChild(s)}
      parent.appendChild(box);return el
    }

    function sourceMeasureChecks(parent,schema,label,id,options,prefill=[],isSummary=false){
      const box=document.createElement('div');box.className='source-measure-field'
      const cap=document.createElement('span');cap.textContent=label;box.appendChild(cap)
      const key=sourceMeasureKey(schema,id)
      if(values[key]===undefined && prefill.length) values[key]=prefill
      const opts=document.createElement('div');opts.className='source-measure-checks'
      options.forEach(v=>{const l=document.createElement('label');const e=document.createElement('input');e.type='checkbox';e.value=v;bindSourceMeasureControl(e,schema,id,label,'',false,isSummary);l.append(e,document.createTextNode(v));opts.appendChild(l)})
      box.appendChild(opts);parent.appendChild(box);return box
    }

    function sourceMeasureSection(body,title){
      const sec=document.createElement('section');sec.className='source-measure-section'
      const h=document.createElement('h4');h.textContent=title;sec.appendChild(h);body.appendChild(sec);return sec
    }

    function enableVerticalMeasureTableTabbing(host){
      if(!host) return
      host.onkeydown=event=>{
        if(event.key!=='Tab') return
        const control=event.target.closest('.source-measure-table input, .source-measure-table select, .source-measure-table textarea')
        if(!control) return
        const cell=control.closest('td')
        const row=control.closest('tr')
        const tbody=row?.parentElement
        const table=control.closest('.source-measure-table')
        if(!cell||!row||!tbody||!table||tbody.tagName!=='TBODY') return

        const rows=[...tbody.rows]
        const rowIndex=rows.indexOf(row)
        const colIndex=cell.cellIndex
        const firstDataCol=Math.min(...rows.flatMap(r=>[...r.cells].map((td,i)=>td.querySelector('input,select,textarea')?i:999)).filter(i=>i!==999))
        const lastCol=Math.max(...rows.flatMap(r=>[...r.cells].map((td,i)=>td.querySelector('input,select,textarea')?i:-1)))

        const getControl=(r,c)=>{
          const el=rows[r]?.cells[c]?.querySelector('input:not([disabled]),select:not([disabled]),textarea:not([disabled])')
          return el && el.offsetParent!==null ? el : null
        }

        let target=null
        if(!event.shiftKey){
          for(let r=rowIndex+1;r<rows.length&&!target;r++) target=getControl(r,colIndex)
          if(!target){
            for(let col=colIndex+1;col<=lastCol&&!target;col++){
              for(let r=0;r<rows.length&&!target;r++) target=getControl(r,col)
            }
          }
        }else{
          for(let r=rowIndex-1;r>=0&&!target;r--) target=getControl(r,colIndex)
          if(!target){
            for(let col=colIndex-1;col>=firstDataCol&&!target;col--){
              for(let r=rows.length-1;r>=0&&!target;r--) target=getControl(r,col)
            }
          }
        }

        if(target){
          event.preventDefault()
          target.focus()
          if(typeof target.select==='function' && target.tagName==='INPUT') target.select()
        }
      }
    }

    function renderSourceMeasureCircumferences(body,schema){
      const sec=sourceMeasureSection(body,'Stumpf / Positiv / Maßkontrolle')
      const wrap=document.createElement('div');wrap.className='source-measure-table-wrap'
      const table=document.createElement('table');table.className='source-measure-table'
      const thead=document.createElement('thead');const hr=document.createElement('tr')
      ;['Höhe'].concat(schema.circCols).forEach(x=>{const th=document.createElement('th');th.textContent=x;hr.appendChild(th)})
      thead.appendChild(hr);table.appendChild(thead)
      const tb=document.createElement('tbody')
      schema.heights.forEach((height,ri)=>{
        const tr=document.createElement('tr');const label=document.createElement('td');label.textContent=height;tr.appendChild(label)
        schema.circCols.forEach((col,ci)=>{
          const td=document.createElement('td');const input=document.createElement('input');input.type='text'
          bindSourceMeasureControl(input,schema,'circ:'+ri+':'+ci,'Höhe '+height+' · '+col,'',true,false)
          td.appendChild(input);tr.appendChild(td)
        });tb.appendChild(tr)
      })
      table.appendChild(tb);wrap.appendChild(table);sec.appendChild(wrap)
    }

    function renderSourceMeasureDetails(body,schema){
      const sec=sourceMeasureSection(body,'Stumpfmaße / Positiv / Maßkontrolle')
      const wrap=document.createElement('div');wrap.className='source-measure-table-wrap'
      const table=document.createElement('table');table.className='source-measure-table'
      const thead=document.createElement('thead');const hr=document.createElement('tr')
      ;['Maß'].concat(schema.detailCols).forEach(x=>{const th=document.createElement('th');th.textContent=x;hr.appendChild(th)})
      thead.appendChild(hr);table.appendChild(thead)
      const tb=document.createElement('tbody')
      schema.details.forEach((label,ri)=>{
        const tr=document.createElement('tr');const td0=document.createElement('td');td0.textContent=label;tr.appendChild(td0)
        schema.detailCols.forEach((col,ci)=>{
          const td=document.createElement('td');const input=document.createElement('input');input.type='text'
          const summary=schema.summary.includes(label) && ci===0
          bindSourceMeasureControl(input,schema,'detail:'+ri+':'+ci,label+(ci?(' · '+col):''),'',true,summary)
          td.appendChild(input);tr.appendChild(td)
        });tb.appendChild(tr)
      })
      table.appendChild(tb);wrap.appendChild(table);sec.appendChild(wrap)
    }

    function renderSourceMeasureHeader(body,schema){
      const sec=sourceMeasureSection(body,'Stammdaten / Auftrag')
      const grid=document.createElement('div');grid.className='source-measure-grid';sec.appendChild(grid)
      sourceMeasureField(grid,schema,'Nachname','header:last','text',[],values.patientLastName||'')
      sourceMeasureField(grid,schema,'Vorname','header:first','text',[],values.patientFirstName||'')
      sourceMeasureField(grid,schema,'Datum','header:date','date',[],values.measureDate||'')
      sourceMeasureField(grid,schema,'Vorgangsnummer','header:case','text',[],values.caseNumber||'')
      sourceMeasureField(grid,schema,'NZ','header:nz')
      sourceMeasureField(grid,schema,'Niederlassung','header:branch')
      sourceMeasureField(grid,schema,'Pat.-Nr. / Geburtsdatum','header:patientRef')
      sourceMeasureField(grid,schema,'Körpergewicht','header:weight','number',[],'',false,true)
      sourceMeasureChecks(grid,schema,'Gewicht gemessen','header:weightMode',['mit HiMi','ohne HiMi'])
      sourceMeasureField(grid,schema,'Körpergröße','header:height','number',[],'',false,true)
      sourceMeasureChecks(grid,schema,'Seite','header:side',['Rechts','Links'],values.side==='rechts'?['Rechts']:values.side==='links'?['Links']:[])
      sourceMeasureChecks(grid,schema,'Fotos','header:photos',['erhaltenes Bein / aktuelle Versorgung frontal, lateral und dorsal'])
      sourceMeasureField(grid,schema,'Anprobetermin','header:trialDate','date')
    }

    function renderSourceMeasureClassification(body,schema){
      const sec=sourceMeasureSection(body,'Versorgungsplanung / Stumpfklassifikation')
      const grid=document.createElement('div');grid.className='source-measure-grid';sec.appendChild(grid)
      if(schema.code==='FMB02003'){
        sourceMeasureChecks(grid,schema,'Interfacematerial','class:interface',['Silikon','Copolymer/TPE','PU'])
        sourceMeasureField(grid,schema,'Linerbezeichnung','class:linerName')
        sourceMeasureField(grid,schema,'Linergröße','class:linerSize')
        sourceMeasureField(grid,schema,'Linerlänge','class:linerLength')
        sourceMeasureChecks(grid,schema,'Matrixlänge','class:matrix',['5 cm','10 cm','Individuell'])
        sourceMeasureField(grid,schema,'Matrixlänge individuell (cm)','class:matrixCustom','number')
        sourceMeasureChecks(grid,schema,'Schaftsystem','class:socket',['Distales Arretierungssystem','Kniekappensystem','Sealsystem','KBM-System','Oberhülse','Sonstiges'])
        sourceMeasureChecks(grid,schema,'Positiverfassung','class:positive',['Symphony VC','Scan','Gipsabdruck'])
        sourceMeasureChecks(grid,schema,'Gewebe','class:tissue',['weich','mw','mittel','mf','fest'])
        sourceMeasureChecks(grid,schema,'Stumpflänge','class:stumpLength',['≤1/3','2/3','≥2/3'])
        sourceMeasureChecks(grid,schema,'Stumpfform','class:stumpShape',['zylindrisch','konisch','birnenförmig'])
      }else if(schema.code==='FMB02002'){
        sourceMeasureChecks(grid,schema,'Schaftsystem','class:socket',['PBSS Knieex (Silikonhybridschaft)','Knieex (PE-Innenschaft)'])
        sourceMeasureChecks(grid,schema,'Interface','class:interface',['Liner konfektioniert','Liner individuell','RTV-Silicon','HTV-Silicon','Distal Cup/Ausgleichsmanschette','WWL'])
        sourceMeasureField(grid,schema,'Linergröße','class:linerSize')
        sourceMeasureField(grid,schema,'Linerlänge','class:linerLength')
        sourceMeasureField(grid,schema,'Konfektionsgröße Distal Cup','class:distalCupSize')
        sourceMeasureChecks(grid,schema,'Positiverfassung','class:positive',['Symphony','Scan','Gipsabdruck'])
        sourceMeasureChecks(grid,schema,'Gewebe','class:tissue',['weich','mw','mittel','mf','fest'])
        sourceMeasureChecks(grid,schema,'Stumpfform','class:stumpShape',['knöchern','weichteilgedeckt'])
      }else{
        sourceMeasureChecks(grid,schema,'Schaftsystem','class:socket',['PBSS','PBSS short','Sonstige'])
        sourceMeasureChecks(grid,schema,'Interfacematerial','class:interface',['Silikon','Copolymer/TPE'])
        sourceMeasureField(grid,schema,'Linerbezeichnung','class:linerName')
        sourceMeasureField(grid,schema,'Linergröße','class:linerSize')
        sourceMeasureField(grid,schema,'Linerlänge','class:linerLength')
        sourceMeasureChecks(grid,schema,'Positiverfassung','class:positive',['Scan','Gipsabdruck','Sonstige'])
        sourceMeasureChecks(grid,schema,'Gewebe','class:tissue',['weich','mw','mittel','mf','fest'])
        sourceMeasureChecks(grid,schema,'Stumpflänge','class:stumpLength',['≤1/3','2/3','≥2/3'])
        sourceMeasureChecks(grid,schema,'Stumpfform','class:stumpShape',['zylindrisch','konisch','birnenförmig'])
      }
      sourceMeasureChecks(grid,schema,'Geschlecht','class:sex',['weiblich','männlich'])
      sourceMeasureChecks(grid,schema,'Mob','class:mob',['0','1','2','3','4'])
      sourceMeasureField(grid,schema,'Amputation am (Monat/Jahr)','class:ampWhen','month')
      sourceMeasureChecks(grid,schema,'Weitere Hilfsmittel','class:aids',['Sitzkissen','Einlagen','Kompressionsstrumpf','Sonstiges'])
      sourceMeasureField(grid,schema,'Versorgungsplan / Bemerkungen','class:plan','textarea')
    }

    function renderSourceMeasureFooter(body,schema){
      const sec=sourceMeasureSection(body,'Aufbaumaße / Systeme / Zusatzmaße')
      const grid=document.createElement('div');grid.className='source-measure-grid';sec.appendChild(grid)
      const add=(label,id,type='text',opts=[])=>sourceMeasureField(grid,schema,label,'footer:'+id,type,opts,'',true,schema.summary.includes(label))
      if(schema.code==='FMB02003'){
        add('Frontalstellung Knie','frontal','select',['Varus','Valgus'])
        add('Frontalstellung Knie (°)','frontalDeg','number')
        add('Distales Umfangsmaß','distal','number')
        add('KS – Boden','ksFloor','number')
        add('Fußsystem','footSystem')
        add('Fußlänge','footLength','number')
        add('Effektive Absatzhöhe','heel','number')
        add('Höhe Oberkante Kniescheibe','patellaTop','number')
        add('Höhe Unterkante Kniescheibe','patellaBottom','number')
        add('Y-Maß bei 90 °','y90','number')
        add('Drehpunkt-Boden (def. Prothese)','pivotDef','number')
      }else if(schema.code==='FMB02002'){
        add('Flexionsstellung','flexion','number')
        add('Adduktionsstellung','adduction','number')
        add('Distales Umfangsmaß','distal','number')
        add('Stumpfende – Boden','stumpFloor','number')
        add('Drehpunkt – Boden','pivotFloor','number')
        add('Tuber – Boden','tuberFloor','number')
        add('Fußsystem','footSystem')
        add('Kniesystem','kneeSystem')
        add('Fußlänge','footLength','number')
        add('Effektive Absatzhöhe','heel','number')
        add('Höhe Oberkante Kniescheibe','patellaTop','number')
        add('Höhe Unterkante Kniescheibe','patellaBottom','number')
        add('Y-Maß bei 90 °','y90','number')
        add('Drehpunkt-Boden (def. Prothese)','pivotDef','number')
      }else{
        add('KS – Boden','ksFloor','number')
        add('Drehpunkt – Boden','pivotFloor','number')
        add('Tuber – Boden','tuberFloor','number')
        add('Fußsystem','footSystem')
        add('Kniesystem','kneeSystem')
        add('Fußlänge','footLength','number')
        add('Effektive Absatzhöhe','heel','number')
        add('Höhe Oberkante Kniescheibe','patellaTop','number')
        add('Höhe Unterkante Kniescheibe','patellaBottom','number')
        add('Y-Maß bei 90 °','y90','number')
        add('Drehpunkt-Boden (def. Prothese)','pivotDef','number')
      }
    }

    function renderSourceMeasureOptionalOs(body,schema){
      if(schema.code!=='FMB02001') return
      let sec=sourceMeasureSection(body,'Optional: Dynamometer Druckmessung im 6-er Maß (4 cm² Stempel)')
      let grid=document.createElement('div');grid.className='source-measure-grid';sec.appendChild(grid)
      ;['Medio-ventral','Medio-dorsal','Dorso-lateral','Ventro-lateral'].forEach((p,i)=>{
        sourceMeasureField(grid,schema,p+' – entspannt','dyn:'+i+':relaxed','number',[],'',true,false)
        sourceMeasureField(grid,schema,p+' – angespannt','dyn:'+i+':tense','number',[],'',true,false)
      })
      sec=sourceMeasureSection(body,'Optional: Sonographie Gewebemessung – 8 Quadranten pro Ebene (mm)')
      const wrap=document.createElement('div');wrap.className='source-measure-table-wrap'
      const table=document.createElement('table');table.className='source-measure-table'
      const quadrants=['medial','medio-frontal','frontal','fronto-lateral','lateral','dorso-lateral','dorsal','dorso-medial']
      const hr=document.createElement('tr');['Ebene'].concat(quadrants).forEach(x=>{const th=document.createElement('th');th.textContent=x;hr.appendChild(th)})
      const thd=document.createElement('thead');thd.appendChild(hr);table.appendChild(thd)
      const tb=document.createElement('tbody')
      ;['3er','6er','9er','12er','15er','18er','21er'].forEach((lvl,ri)=>{
        const tr=document.createElement('tr');const td0=document.createElement('td');td0.textContent=lvl;tr.appendChild(td0)
        quadrants.forEach((q,ci)=>{const td=document.createElement('td');const input=document.createElement('input');input.type='number';bindSourceMeasureControl(input,schema,'sono:'+ri+':'+ci,lvl+' · '+q,'',true,false);td.appendChild(input);tr.appendChild(td)})
        tb.appendChild(tr)
      })
      table.appendChild(tb);wrap.appendChild(table);sec.appendChild(wrap)
    }

    function resolveMeasureOrientationSpot(schema,id,label){
      const text=String(label||'').toLowerCase()
      const code=schema?.code||''
      let sketch='main',x=52,y=50,region='Stumpf / Prothesenbereich'

      if(String(id).startsWith('circ:')){
        const parts=String(id).split(':')
        const ri=Number(parts[1])||0
        const n=Math.max((schema.heights||[]).length-1,1)
        const t=Math.min(1,Math.max(0,ri/n))
        sketch='main'
        if(code==='FMB02003'){x=48;y=44.25+t*53;region='AOK Anlage 5b · Umfangsebene '+(schema.heights?.[ri]||'')+' cm'}
        else if(code==='FMB02002'){x=48;y=28+t*55;region='AOK Anlage 5c · Umfangsebene '+(schema.heights?.[ri]||'')}
        else{x=48;y=30+t*53;region='AOK Anlage 5d · Umfangsebene '+(schema.heights?.[ri]||'')}
        return {sketch,x,y,region}
      }

      if(String(id).startsWith('sono:')){
        sketch='main'
        const ri=Number(String(id).split(':')[1])||0
        x=/dorso/.test(text)?58:/frontal|ventral/.test(text)?41:49
        y=33+ri*7.5
        region='AOK Anlage 5d · Orientierung an der jeweiligen Umfangsebene'
        return {sketch,x,y,region}
      }
      if(String(id).startsWith('dyn:')){
        sketch='main';x=/dorsal/.test(text)?57:/ventral/.test(text)?42:49;y=45
        region='AOK Anlage 5d · Orientierung im 6-er Maß'
        return {sketch,x,y,region}
      }

      if(code==='FMB02003'){
        if(/fußlänge|absatzhöhe|fußsystem/.test(text)){sketch='foot';x=52;y=59;region='AOK Anlage 5b · Originalskizze effektive Absatzhöhe'}
        else if(/drehpunkt.*boden|ks\s*[–-]\s*boden/.test(text)){sketch='side';x=65;y=51;region='AOK Anlage 5b · Originalskizze Boden-/Drehpunktbezug'}
        else if(/patella|kniescheibe|kondyl|suprakondyl|kniespalt|frontalstellung|y-maß/.test(text)){sketch='main';x=48;y=22;region='AOK Anlage 5b · Originalskizze Knie-/Null-Linienbezug'}
        else if(/tibiaende/.test(text)){sketch='main';x=49;y=78;region='AOK Anlage 5b · distaler Tibia-/Stumpfbereich'}
        else if(/distales umfang|stumpfende/.test(text)){sketch='main';x=49;y=86;region='AOK Anlage 5b · distales Umfangsmaß'}
      }else if(code==='FMB02002'){
        if(/fußlänge|absatzhöhe|fußsystem/.test(text)){sketch='foot';x=54;y=58;region='AOK Anlage 5c · Originalskizze effektive Absatzhöhe'}
        else if(/drehpunkt.*boden|tuber.*boden/.test(text)){sketch='side';x=67;y=52;region='AOK Anlage 5c · Originalskizze Stumpf-/Bodenbezug'}
        else if(/kondyl|suprakondyl|y-maß/.test(text)){sketch='bc';x=51;y=/suprakondyl/.test(text)?42:68;region='AOK Anlage 5c · Originalskizze A/B/C-Bezug'}
        else if(/patella|kniescheibe/.test(text)){sketch='main';x=49;y=20;region='AOK Anlage 5c · Originalskizze Knie-Ex-Bezug'}
        else if(/mediale anlage|a-p.*anlage|m-l.*anlage/.test(text)){sketch='main';x=48;y=48;region='AOK Anlage 5c · Originalskizze mediale Anlage'}
        else if(/schaftzuschnitt|flexion|adduktions/.test(text)){sketch='main';x=48;y=34;region='AOK Anlage 5c · Originalskizze Schaft-/Stumpfachse'}
        else if(/distales umfang|stumpfende/.test(text)){sketch='main';x=48;y=86;region='AOK Anlage 5c · distales Stumpfende'}
      }else{
        if(/fußlänge|absatzhöhe|fußsystem/.test(text)){sketch='foot';x=55;y=60;region='AOK Anlage 5d · Originalskizze effektive Absatzhöhe'}
        else if(/drehpunkt.*boden|tuber.*boden|ks\s*[–-]\s*boden/.test(text)){sketch='side';x=66;y=53;region='AOK Anlage 5d · Originalskizze Tuber-/Drehpunkt-/Bodenbezug'}
        else if(/tuber|ramus|trochanter|ilio/.test(text)){sketch='main';x=48;y=19;region='AOK Anlage 5d · Originalskizze Becken-/Proximalbezug'}
        else if(/adduktions|add\.-?winkel|add\.winkel|flexion/.test(text)){sketch='main';x=48;y=34;region='AOK Anlage 5d · Originalskizze Stumpfachse'}
        else if(/diagonal|skeletäres m-l|vorderes.*m-l/.test(text)){sketch='main';x=48;y=39;region='AOK Anlage 5d · proximale Umfangs-/Querschnittsebene'}
        else if(/distales umfang|stumpfende/.test(text)){sketch='main';x=48;y=85;region='AOK Anlage 5d · distales Stumpfende'}
        else if(/patella|kniescheibe|y-maß/.test(text)){sketch='front';x=49;y=66;region='AOK Anlage 5d · Originalskizze Knie-/Bodenbezug'}
      }
      return {sketch,x,y,region}
    }

    const orientationPdfCache=new Map()
    let orientationRenderToken=0

    function orientationSketchConfig(schema,sketch='main'){
      const code=schema?.code||''
      if(code==='FMB02003'){
        const crops={
          main:{x:.43,y:.265,w:.47,h:.315},
          side:{x:.075,y:.565,w:.39,h:.31},
          foot:{x:.50,y:.57,w:.36,h:.145}
        }
        const masks={
          main:[
            {x:.045,y:.355,w:.175,h:.095},
            {x:.675,y:.445,w:.31,h:.455}
          ],
          side:[
            {x:.075,y:.335,w:.205,h:.275},
            {x:.615,y:.335,w:.235,h:.155},
            {x:.395,y:.745,w:.22,h:.18}
          ],
          foot:[
            {x:.10,y:.29,w:.245,h:.25}
          ]
        }
        return {url:'assets/aok-pg24/anlage-5b-ukb.pdf',annex:'5b',crop:crops[sketch]||crops.main,masks:masks[sketch]||[]}
      }
      if(code==='FMB02002'){
        const crops={
          main:{x:.47,y:.275,w:.40,h:.245},
          side:{x:.06,y:.54,w:.38,h:.255},
          bc:{x:.50,y:.54,w:.34,h:.245},
          foot:{x:.30,y:.79,w:.33,h:.115}
        }
        return {url:'assets/aok-pg24/anlage-5c-knieex.pdf',annex:'5c',crop:crops[sketch]||crops.main}
      }
      const crops={
        main:{x:.46,y:.285,w:.44,h:.295},
        side:{x:.065,y:.61,w:.38,h:.285},
        front:{x:.055,y:.285,w:.40,h:.335},
        foot:{x:.48,y:.66,w:.36,h:.165}
      }
      return {url:'assets/aok-pg24/anlage-5d-okb.pdf',annex:'5d',crop:crops[sketch]||crops.main}
    }

    async function getOrientationPdfCanvas(url){
      if(!orientationPdfCache.has(url)){
        orientationPdfCache.set(url,(async()=>{
          const pdfjs=await loadPdfJs()
          const pdf=await pdfjs.getDocument(url).promise
          const page=await pdf.getPage(1)
          const viewport=page.getViewport({scale:1.8})
          const canvas=document.createElement('canvas')
          canvas.width=Math.ceil(viewport.width)
          canvas.height=Math.ceil(viewport.height)
          await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise
          return canvas
        })())
      }
      return orientationPdfCache.get(url)
    }

    async function drawOriginalOrientationSketch(schema,sketch='main'){
      const token=++orientationRenderToken
      const canvas=$('measureOrientationCanvas')
      const loading=$('measureOrientationLoading')
      if(!canvas) return
      const cfg=orientationSketchConfig(schema,sketch)
      if(loading) loading.classList.remove('hidden')
      try{
        const source=await getOrientationPdfCanvas(cfg.url)
        if(token!==orientationRenderToken || !$('measureOrientationCanvas')) return
        const crop=cfg.crop
        const sx=Math.round(source.width*crop.x),sy=Math.round(source.height*crop.y)
        const sw=Math.round(source.width*crop.w),sh=Math.round(source.height*crop.h)
        canvas.width=sw;canvas.height=sh
        const ctx=canvas.getContext('2d')
        ctx.clearRect(0,0,sw,sh)
        ctx.drawImage(source,sx,sy,sw,sh,0,0,sw,sh)
        ;(cfg.masks||[]).forEach(mask=>{
          ctx.save()
          ctx.fillStyle='#fff'
          ctx.fillRect(
            Math.round(sw*mask.x),
            Math.round(sh*mask.y),
            Math.round(sw*mask.w),
            Math.round(sh*mask.h)
          )
          ctx.restore()
        })
        canvas.dataset.sketch=sketch
        if(loading) loading.classList.add('hidden')
      }catch(err){
        console.error('AOK orientation sketch error',err)
        if(loading){
          loading.classList.remove('hidden')
          loading.textContent='Original-AOK-Skizze konnte nicht geladen werden.'
        }
      }
    }

    function renderMeasureOrientation(schema){
      const stage=$('measureOrientationStage')
      if(!stage) return
      stage.innerHTML='<div class="measure-orientation-crop"><canvas id="measureOrientationCanvas" aria-label="Anatomische Originalskizze aus dem AOK-Maßblatt"></canvas><div id="measureOrientationLoading" class="measure-orientation-loading">Original-AOK-Skizze wird geladen …</div><div class="measure-orientation-overlay"><div id="measureOrientationGuide" class="measure-orientation-guide-html"></div><div id="measureOrientationMarker" class="measure-orientation-marker-html"></div><svg id="measureOrientationOverlaySvg" class="measure-orientation-overlay-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><g id="measureOrientationShape"></g></svg></div></div>'
      const title=$('measureOrientationType')
      if(title) title.textContent=schema.code==='FMB02003'?'Unterschenkel':schema.code==='FMB02002'?'Knieexartikulation':'Oberschenkel'
      const src=$('measureOrientationSource')
      if(src){
        const annex=schema.code==='FMB02003'?'5b':schema.code==='FMB02002'?'5c':'5d'
        src.innerHTML='<strong>Originalskizze:</strong> AOK Baden-Württemberg · Anlage '+annex+' · PG24, Stand 01.09.2026. Die anatomische Originalzeichnung wird aus dem AOK-PDF gerendert. Ausfüllkästchen werden nur in dieser Orientierungsansicht ausgeblendet; Die Verortung des aktiven Maßes wird ohne Richtungs- oder Pfeildarstellung darüber hervorgehoben.'
      }
      const first=$('measureFieldList')?.querySelector('[data-measure-value="true"]')
      if(first) updateMeasureOrientation(schema,first,false)
      else drawOriginalOrientationSketch(schema,'main')
    }

    function measureControlValue(el){
      if(!el) return ''
      if(el.type==='checkbox'){
        const key=el.dataset.measureKey
        const v=values[key]
        return Array.isArray(v)?v.join(', '):(v===true?'Ja':'')
      }
      return String(el.value||'').trim()
    }

    function ukbMeasureAnimationProfile(schema,id,label){
      if(schema?.code!=='FMB02003') return null
      const text=String(label||'').toLowerCase()
      const sid=String(id||'')

      // 1. Umfangstabelle bleibt bewusst bei der bisherigen Marker-/Linienlogik.
      if(sid.startsWith('circ:')) return null

      if(sid.startsWith('detail:')){
        const row=Number(sid.split(':')[1])||0
        if(row===0) return {sketch:'main',kind:'vertical',region:'Kniespalt (KS) bis Stumpfende / Linerteller',x:67,y1:44,y2:91}
        if(row===1) return {sketch:'main',kind:'vertical',region:'Kniespalt (KS) bis Tibiaende',x:67,y1:44,y2:79}
        if(row===2) return {sketch:'main',kind:'horizontal',region:'M-L suprakondylär',x1:36,x2:65,y:38}
        if(row===3) return {sketch:'main',kind:'horizontal',region:'M-L kondylär',x1:34,x2:66,y:47}
        if(row===4) return {sketch:'main',kind:'apZone',region:'A-P-Maß in der 3-er Ebene, locker gemessen',x1:39,x2:64,y1:27,y2:57}
        if(row===5) return {sketch:'side',kind:'angle',region:'Flexion Knie',cx:51,cy:20,r:16,a1:[38,34,51,20],a2:[51,20,66,5]}
      }

      if(sid==='footer:ksFloor' || /ks\s*[–-]\s*boden/.test(text))
        return {sketch:'side',kind:'height',region:'KS – Boden',x:79,y1:22,y2:86,refX1:39,refX2:79}
      if(sid==='footer:footLength' || /fußlänge/.test(text))
        return {sketch:'side',kind:'footLength',region:'Fußlänge',x1:39,x2:61,y:84}
      if(sid==='footer:patellaTop' || /höhe oberkante kniescheibe/.test(text))
        return {sketch:'side',kind:'height',region:'Höhe Oberkante Kniescheibe',x:79,y1:8,y2:86,refX1:40,refX2:79}
      if(sid==='footer:patellaBottom' || /höhe unterkante kniescheibe/.test(text))
        return {sketch:'side',kind:'height',region:'Höhe Unterkante Kniescheibe',x:79,y1:20,y2:86,refX1:40,refX2:79}
      if(sid==='footer:y90' || /y-maß/.test(text))
        return {sketch:'side',kind:'diagonal',region:'Y-Maß bei 90°',x1:39,y1:86,x2:65,y2:51}
      if(sid==='footer:pivotDef' || /drehpunkt-boden/.test(text))
        return {sketch:'side',kind:'height',region:'Drehpunkt – Boden (def. Prothese)',x:80,y1:51,y2:86,refX1:65,refX2:80}
      if(sid==='footer:heel' || /effektive absatzhöhe/.test(text))
        return {sketch:'foot',kind:'height',region:'Effektive Absatzhöhe',x:29,y1:52,y2:69,refX1:20,refX2:38}
      return null
    }

    function ukbMeasureOverlayMarkup(profile){
      if(!profile) return ''
      const dot=(x,y)=>'<circle class="m-pulse" cx="'+x+'" cy="'+y+'" r="4"></circle><circle class="m-dot" cx="'+x+'" cy="'+y+'" r="1.8"></circle>'
      if(profile.kind==='vertical'){
        return '<line class="m-ref" x1="31" y1="'+profile.y1+'" x2="72" y2="'+profile.y1+'"></line>'+
          '<line class="m-ref" x1="31" y1="'+profile.y2+'" x2="72" y2="'+profile.y2+'"></line>'+
          '<line class="m-line m-active" x1="'+profile.x+'" y1="'+profile.y1+'" x2="'+profile.x+'" y2="'+profile.y2+'"></line>'+
          dot(profile.x,(profile.y1+profile.y2)/2)
      }
      if(profile.kind==='horizontal'){
        return (profile.refs?'<line class="m-ref" x1="'+profile.x1+'" y1="'+(profile.y-10)+'" x2="'+profile.x1+'" y2="'+(profile.y+10)+'"></line><line class="m-ref" x1="'+profile.x2+'" y1="'+(profile.y-10)+'" x2="'+profile.x2+'" y2="'+(profile.y+10)+'"></line>':'')+
          '<line class="m-line m-active" x1="'+profile.x1+'" y1="'+profile.y+'" x2="'+profile.x2+'" y2="'+profile.y+'"></line>'+
          dot((profile.x1+profile.x2)/2,profile.y)
      }
      if(profile.kind==='height'){
        return '<line class="m-ref" x1="'+profile.refX1+'" y1="'+profile.y1+'" x2="'+profile.refX2+'" y2="'+profile.y1+'"></line>'+
          '<line class="m-ref" x1="'+profile.refX1+'" y1="'+profile.y2+'" x2="'+profile.refX2+'" y2="'+profile.y2+'"></line>'+
          '<line class="m-line m-active" x1="'+profile.x+'" y1="'+profile.y1+'" x2="'+profile.x+'" y2="'+profile.y2+'"></line>'+
          dot(profile.x,(profile.y1+profile.y2)/2)
      }
      if(profile.kind==='footLength'){
        return '<line class="m-ref" x1="'+profile.x1+'" y1="'+(profile.y-9)+'" x2="'+profile.x1+'" y2="'+(profile.y+5)+'"></line>'+
          '<line class="m-ref" x1="'+profile.x2+'" y1="'+(profile.y-9)+'" x2="'+profile.x2+'" y2="'+(profile.y+5)+'"></line>'+
          '<line class="m-line m-active" x1="'+profile.x1+'" y1="'+profile.y+'" x2="'+profile.x2+'" y2="'+profile.y+'"></line>'+
          dot((profile.x1+profile.x2)/2,profile.y)
      }
      if(profile.kind==='diagonal'){
        return '<line class="m-line m-active" x1="'+profile.x1+'" y1="'+profile.y1+'" x2="'+profile.x2+'" y2="'+profile.y2+'"></line>'+dot(profile.x2,profile.y2)
      }
      if(profile.kind==='angle'){
        return '<line class="m-line" x1="'+profile.a1[0]+'" y1="'+profile.a1[1]+'" x2="'+profile.a1[2]+'" y2="'+profile.a1[3]+'"></line>'+
          '<line class="m-line" x1="'+profile.a2[0]+'" y1="'+profile.a2[1]+'" x2="'+profile.a2[2]+'" y2="'+profile.a2[3]+'"></line>'+
          '<path class="m-line m-active" d="M '+(profile.cx-profile.r*.72)+' '+(profile.cy+profile.r*.40)+' Q '+profile.cx+' '+(profile.cy-profile.r*.82)+' '+(profile.cx+profile.r*.68)+' '+(profile.cy-profile.r*.48)+'"></path>'+
          dot(profile.cx,profile.cy)
      }
      if(profile.kind==='apZone'){
        return '<line class="m-line m-active" x1="'+profile.x1+'" y1="'+profile.y1+'" x2="'+profile.x1+'" y2="'+profile.y2+'"></line>'+
          '<line class="m-line m-active" x1="'+profile.x2+'" y1="'+profile.y1+'" x2="'+profile.x2+'" y2="'+profile.y2+'"></line>'
      }
      return ''
    }

    function updateMeasureOrientation(schema,el,animate=true){
      if(!el) return
      const profile=ukbMeasureAnimationProfile(schema,el.dataset.measureId||'',el.dataset.measureLabel||'')
      const marker=$('measureOrientationMarker'),guide=$('measureOrientationGuide')
      const overlaySvg=$('measureOrientationOverlaySvg'),shape=$('measureOrientationShape')
      const sketch=profile?.sketch||el.dataset.measureSketch||'main'
      const canvas=$('measureOrientationCanvas')
      if(canvas && canvas.dataset.sketch!==sketch) drawOriginalOrientationSketch(schema,sketch)

      if(profile){
        if(marker) marker.classList.add('hidden')
        if(guide) guide.classList.add('hidden')
        if(overlaySvg) overlaySvg.classList.remove('hidden')
        if(shape) shape.innerHTML=ukbMeasureOverlayMarkup(profile)
      }else{
        if(overlaySvg) overlaySvg.classList.add('hidden')
        if(shape) shape.innerHTML=''
        if(marker) marker.classList.remove('hidden')
        if(guide) guide.classList.remove('hidden')
        const x=Math.max(2,Math.min(98,Number(el.dataset.measureX)||50))
        const y=Math.max(2,Math.min(98,Number(el.dataset.measureY)||50))
        if(marker) applyRuntimeStyle(marker,'geometry',{left:x+'%',top:y+'%'})
        if(guide) applyRuntimeStyle(guide,'geometry',{top:y+'%'})
      }

      document.querySelectorAll('.measure-active-control').forEach(n=>n.classList.remove('measure-active-control'))
      document.querySelectorAll('.measure-active-cell').forEach(n=>n.classList.remove('measure-active-cell'))
      el.classList.add('measure-active-control')
      const cell=el.closest('td,.source-measure-field')
      if(cell) cell.classList.add('measure-active-cell')

      const label=el.dataset.measureLabel||'Maß'
      const region=profile?.region||el.dataset.measureRegion||''
      const value=measureControlValue(el)
      if($('measureOrientationLabel')) $('measureOrientationLabel').textContent=label
      if($('measureOrientationRegion')) $('measureOrientationRegion').textContent=region
      if($('measureOrientationValue')) $('measureOrientationValue').textContent=value?('Aktueller Wert: '+value):'Wert noch nicht eingetragen'
    }

    function renderSourceMeasureSummary(){
      const host=$('measureSummaryList');if(!host) return
      const controls=[...$('measureFieldList').querySelectorAll('[data-measure-summary="true"]')]
      const seen=new Set(),rows=[]
      controls.forEach(el=>{
        const key=el.dataset.measureKey;if(seen.has(key)) return;seen.add(key)
        let v=values[key]
        if(Array.isArray(v)) v=v.join(', ')
        if(v===undefined||v===null||String(v).trim()==='') return
        rows.push({label:el.dataset.measureLabel||key,value:String(v)})
      })
      host.innerHTML=rows.length?rows.map(r=>'<div class="measure-summary-row"><strong>'+escapeHtml(r.label)+'</strong><span>'+escapeHtml(r.value)+'</span></div>').join(''):'<div class="measure-empty">Noch keine Werte erfasst.</div>'
    }

    function saveSourceMeasureSnapshot(schema){
      const controls=[...$('measureFieldList').querySelectorAll('[data-measure-key]')]
      const fields=[],seen=new Set()
      controls.forEach(el=>{
        const key=el.dataset.measureKey;if(seen.has(key)) return;seen.add(key)
        let v=values[key];if(Array.isArray(v)) v=v.join(', ')
        if(v===undefined||v===null||String(v).trim()==='') return
        fields.push({key,label:el.dataset.measureLabel||key,value:String(v)})
      })
      if(!fields.length) return
      const history=Array.isArray(values.measureHistory)?values.measureHistory:[]
      history.unshift({id:Date.now(),schema:schema.code,title:schema.title,measureDate:values.measureDate||'',savedAt:new Date().toISOString(),fields})
      values.measureHistory=history.slice(0,25)
      renderSourceMeasureHistory(schema)
      queueAutosaveSupply()
    }

    function renderSourceMeasureHistory(schema){
      const host=$('measureHistoryList');if(!host) return
      const history=(Array.isArray(values.measureHistory)?values.measureHistory:[]).filter(x=>x.schema===schema.code)
      if(!history.length){host.innerHTML='<div class="measure-empty">Noch kein Messstand dokumentiert.</div>';return}
      host.innerHTML=history.map(h=>{
        const when=h.measureDate?new Date(h.measureDate+'T12:00:00').toLocaleDateString('de-DE'):new Date(h.savedAt).toLocaleString('de-DE')
        const vals=(h.fields||[]).slice(0,80).map(f=>'<div class="measure-history-value"><span>'+escapeHtml(f.label)+'</span><strong>'+escapeHtml(f.value)+'</strong></div>').join('')
        return '<details class="measure-history-item"><summary>'+escapeHtml(when)+' · '+(h.fields?.length||0)+' Werte</summary><div class="measure-history-values">'+vals+'</div></details>'
      }).join('')
    }

    function renderPg24SourceMeasureSheet(){
      const schema=pg24SourceMeasureSchema()
      if(!schema || !requiresMeasure()) return false
      values.measureSchema=schema.title
      const schemaInput=document.querySelector('[data-case-field="measureSchema"]');if(schemaInput) schemaInput.value=schema.title
      const note=$('measureLogicNote');note.className='status-card ready'
      note.innerHTML='<strong>'+escapeHtml(schema.title)+'</strong>'+escapeHtml(schema.version)+' · Quelle '+escapeHtml(schema.code)+'. Werteübersicht und Verlaufsdokumentation werden fallbezogen ergänzt.'
      const host=$('measureFieldList');host.className=''
      host.innerHTML='<div class="pg24-measure-workspace"><div class="source-measure-sheet"><div class="source-measure-title"><span class="measure-source-badge">'+escapeHtml(schema.code)+'</span><h3>'+escapeHtml(schema.title)+'</h3><p>'+escapeHtml(schema.version)+'</p></div><div id="sourceMeasureBody" class="source-measure-body"></div></div><aside class="measure-side"><section class="measure-orientation-card"><h3>Messposition</h3><p class="measure-orientation-sub"><span id="measureOrientationType"></span> · unveränderte Originalskizze aus dem AOK-Maßblatt</p><div id="measureOrientationStage" class="measure-orientation-stage"></div><div class="measure-orientation-readout" aria-live="polite"><strong id="measureOrientationLabel">Maß auswählen</strong><span id="measureOrientationRegion">Messfeld anklicken, um die Position anzuzeigen.</span><span id="measureOrientationValue" class="measure-orientation-value">Wert noch nicht eingetragen</span></div><div class="measure-orientation-hint">Die Grafik dient der schnellen Orientierung im Maßblatt; maßgeblich bleiben Feldbezeichnung und Messanweisung der hinterlegten Quelle.</div><div id="measureOrientationSource" class="measure-orientation-source"></div></section><section class="measure-summary-card"><h3>Werteübersicht</h3><div id="measureSummaryList" class="measure-summary-list"></div></section><section class="measure-history-card"><h3>Verlaufsdokumentation der Maße</h3><div class="measure-history-actions"><button id="saveMeasureHistoryButton" type="button" class="secondary">Messstand speichern</button></div><div id="measureHistoryList" class="measure-history-list"></div></section></aside></div>'
      const body=$('sourceMeasureBody')
      renderSourceMeasureHeader(body,schema)
      renderSourceMeasureClassification(body,schema)
      renderSourceMeasureCircumferences(body,schema)
      renderSourceMeasureDetails(body,schema)
      renderSourceMeasureFooter(body,schema)
      renderSourceMeasureOptionalOs(body,schema)
      enableVerticalMeasureTableTabbing(host)
      $('saveMeasureHistoryButton').addEventListener('click',()=>saveSourceMeasureSnapshot(schema))
      renderMeasureOrientation(schema)
      renderSourceMeasureSummary()
      renderSourceMeasureHistory(schema)
      renderMeasureTranscriptCatalog()
      return true
    }

    function aokPg24MeasureAsset(){
      if($('carePg').value!=='24'||!isAokCase()||!requiresMeasure()) return null
      const level=values.ampLevel||''
      if(level==='Vor-/Mittelfuß'||level==='Fuß/Fußwurzel/Rückfuß') return {file:'anlage-5a-fuss.pdf',name:'Anlage 5a · Maßblatt Fußprothesen'}
      if(level==='Unterschenkel') return {file:'anlage-5b-ukb.pdf',name:'Anlage 5b · Maßblatt Unterschenkelprothesen'}
      if(level==='Knie-Exartikulation') return {file:'anlage-5c-knieex.pdf',name:'Anlage 5c · Maßblatt Knie-Ex-Prothesen'}
      if(level==='Oberschenkel') return {file:'anlage-5d-okb.pdf',name:'Anlage 5d · Maßblatt Oberschenkelprothesen'}
      if(level==='Hüft-Exartikulation / Hemipelvis') return {file:'anlage-5e-hueftex.pdf',name:'Anlage 5e · Maßblatt Hüft-Ex-Prothesen'}
      return null
    }

    function renderAokPg24MeasureSheet(){
      const host=$('measureFieldList'),asset=aokPg24MeasureAsset()
      if(!asset) return false
      values.measureSchema=asset.name
      const schema=document.querySelector('[data-case-field="measureSchema"]');if(schema) schema.value=asset.name
      const url='assets/aok-pg24/'+asset.file
      $('measureLogicNote').className='status-card ready'
      $('measureLogicNote').innerHTML='<strong>'+escapeHtml(asset.name)+'</strong>Beschreibbares AOK-Originalmaßblatt · Feldkennung, Originalname und PDF-Seite sind eindeutig. Kontext aus Textnähe nur nach Prüfung verwenden.'
      const sourceSchema=pg24SourceMeasureSchema()
      const hasAnatomy=sourceSchema&&['FMB02001','FMB02002','FMB02003'].includes(sourceSchema.code)
      host.className=''
      host.innerHTML='<div class="pg24-measure-workspace"><div class="aok-measure-frame-wrap"><div class="aok-measure-toolbar"><div><span class="aok-source-badge">AOK Original</span> <strong>'+escapeHtml(asset.name)+'</strong></div><a class="secondary aok-measure-open" target="_blank" rel="noopener" href="'+url+'">Originalmaßblatt öffnen ↗</a></div><div id="aokPdfMeasurePages" class="aok-pdf-pages"><div class="aok-pdf-loading">Originalmaßblatt wird geladen …</div></div></div>'+
        '<aside class="measure-side"><section class="measure-orientation-card"><h3>Messposition / Visualisierung</h3><p class="measure-orientation-sub">Originalskizze ohne Pfeildarstellung – Fokus auf Maßfeld</p>'+
        (hasAnatomy?'<div id="measureOrientationStage" class="measure-orientation-stage"></div><div class="measure-orientation-readout" aria-live="polite"><strong id="measureOrientationLabel">Maß auswählen</strong><span id="measureOrientationRegion">Anatomische Zuordnung anhand Feldkontext prüfen.</span><span id="measureOrientationValue" class="measure-orientation-value"></span></div><span id="measureOrientationType" class="hidden"></span><div id="measureOrientationSource" class="measure-orientation-source"></div>':'<p class="source-note">Die vollständige Originalzeichnung ist im beschreibbaren Maßblatt sichtbar. Das aktive Feld wird dort hervorgehoben; eine zusätzliche anatomische Detailvisualisierung ist für diese Anlage noch nicht zugeordnet.</p>')+
        '<div class="measure-orientation-readout"><strong>Aktives Originalfeld</strong><span id="aokMeasureActiveField">Maßfeld im PDF anklicken, um Kennung, Seite und Quellkontext anzuzeigen.</span></div>'+
        '</section></aside></div>'
      if(hasAnatomy){
        renderMeasureOrientation(sourceSchema)
        // Hide position guides until a source-verified anatomical mapping exists.
        $('measureOrientationMarker')?.classList.add('hidden')
        $('measureOrientationGuide')?.classList.add('hidden')
      }
      renderEditableAokPdf(url,asset,$('aokPdfMeasurePages'))
      return true
    }

    function updateCareFields(){
      if(isRepairCase()){
        $('fieldList').innerHTML=''
        $('ruleBox').classList.add('hidden')
        return
      }
      const pg=$('carePg').value
      if(pg && !loadedFormFieldPgs.has(String(pg))){
        $('fieldInfo').textContent='Felddefinitionen werden für PG '+pg+' geladen …'
        $('fieldList').innerHTML=''
        void ensureFormFieldsForPg(pg)
        return
      }
      const himi=selectedHimi()
      const himiId=selectedHimiId()
      const meta=selectedHimiMeta()
      const formId=$('careForm').value
      const selected=data.formulare.find(f=>f.Formular_ID===formId)
      $('fieldList').className='field-list'
      renderGoalSuggestions()
      if(pg && !himiId){
        $('ruleBox').classList.remove('hidden')
        $('ruleBox').innerHTML='<div><strong>Hilfsmittel noch nicht festgelegt</strong><p>Die Formularlogik wird erst nach Auswahl des konkreten Hilfsmittels innerhalb der Produktgruppe freigegeben.</p></div><span class="pill warning">PG '+escapeHtml(pg)+'</span>'
        $('fieldInfo').textContent='Bitte zuerst das konkrete Hilfsmittel / den Versorgungsbereich auswählen.'
        $('fieldList').innerHTML=''
        return
      }
      if(pg==='24'){
        $('ruleBox').classList.add('hidden')
        if(isAokCase()) renderAokPg24Profile()
        else renderTechnikerPg24Profile()
        return
      }
      if(selected){
        $('ruleBox').classList.remove('hidden')
        $('ruleBox').innerHTML='<div><strong>'+escapeHtml(selected.Status)+'</strong><p>'+escapeHtml(selected.Aktion_Versorgungsassistent)+'</p><small>'+escapeHtml(himi||'')+'</small></div><span class="pill blue">'+escapeHtml(selected.Region_Vertrag||'allgemein')+'</span>'
      }else $('ruleBox').classList.add('hidden')

      let fields=[]
      let fieldSource='none'
      if(formId){
        fields=data.formularfelder.filter(f=>f.Formular_ID===formId)
        if(fields.length) fieldSource='exact'
      }
      const map={FORM_001:'BARMER_PG18_ANH4',FORM_002:'BARMER_PG22_ANHB'}
      if(!fields.length && map[formId]){
        fields=data.formularfelder.filter(f=>f.Formular_ID===map[formId])
        if(fields.length) fieldSource='mapped-contract'
      }
      if(!fields.length && meta?.Generisches_Formular_ID){
        fields=data.formularfelder.filter(f=>f.Formular_ID===meta.Generisches_Formular_ID)
        if(fields.length) fieldSource=formId?'generic-fallback':'generic'
      }
      if(!fields.length && pg){
        fields=data.formularfelder.filter(f=>String(f.PG)===String(pg)&&f.Formular_Typ==='GENERISCH')
        if(fields.length) fieldSource=formId?'generic-fallback':'generic'
      }
      if(meta?.Massprofil_ID) fields=fields.filter(f=>!['maße','masse'].includes(norm(f.Abschnitt)))

      const fallbackContract=selected && fieldSource==='generic-fallback' && ['EXPLIZIT_PFLICHT','VERTRAGSFORMULAR','PFLICHT_AUF_ANFORDERUNG','VERTRAG_PRUEFEN'].includes(selected.Status)
      if(fallbackContract){
        $('ruleBox').classList.remove('hidden')
        const contractCheck=pg==='23' && $('careKasse').value==='AOK Baden-Württemberg'
          ? '<p><strong>Vertragsfassung vor der Abgabe prüfen:</strong> Bei AOK BW PG23 bestehen verschiedene Verträge und Anlagen (unter anderem Fachverband 2023 und Verbandsvertrag vom 01.07.2026). Vertragskennzeichen, Vertragspartner und Verordnungsdatum entscheiden über die zutreffende Anlage. Hier wird kein geprüfter AOK-Originalbogen ausgegeben.</p>'
          : ''
        $('ruleBox').innerHTML='<div><strong>'+escapeHtml(selected.Status)+'</strong><p>'+escapeHtml(selected.Aktion_Versorgungsassistent)+'</p><small>Digitale Voraufnahme: Die angezeigten Felder stammen aus dem allgemeinen PG-/Hilfsmittelbogen, nicht aus dem exakten Kassenformular.</small>'+contractCheck+'</div><span class="pill warning">Voraufnahme</span>'
      }

      $('fieldInfo').textContent=fields.length
        ? fields.length+' Felder aus der hinterlegten Formularlogik'+(fallbackContract?' · allgemeine Voraufnahme':'')
        :'Für diese Auswahl sind noch keine Felddefinitionen hinterlegt.'
      $('fieldList').innerHTML=''
      fields.forEach(renderField)
    }

    function profileAutofillValue(f){
      const label=String(f.Feldbezeichnung||'').trim().toLowerCase()
      const id=String(f.Feldzeile_ID||'').toLowerCase()
      if(label==='name, vorname' || label==='name / vorname'){
        const name=[values.patientLastName,values.patientFirstName].filter(Boolean).join(', ')
        return name||''
      }
      if(label==='vorname') return values.patientFirstName||''
      if(label==='nachname' || label==='name') return values.patientLastName||''
      if(['versichertennummer','kv-nummer','kv.-nr.'].includes(label)) return values.insuredNo||''
      if(label==='geburtsdatum') return values.patientBirthDate||''
      if(label==='seite' || label==='betroffene seite') return values.side||''
      return ''
    }

    function fieldOptionValues(f){
      const raw=String(f.Einheit_Optionen||f.Bedingung_UI||'').trim()
      if(!raw.includes('|')) return []
      const optionPart=raw.split(';')[0]
      return optionPart.split('|').map(x=>x.trim()).filter(Boolean)
    }

    const profileConditionControllers=new Set([
      'GEN_04_bath_or_shower_25',
      'GEN_23_region_24',
      'GEN_23_custom_need_22'
    ])

    function profileConditionalState(f){
      const id=String(f.Feldzeile_ID||'')
      const status=String(f.Pflichtstatus||'').toLowerCase()
      if(status!=='bedingt') return {visible:true,required:status==='ja'}

      const kasse=String($('careKasse')?.value||'')
      const himiId=selectedHimiId()
      const himi=norm(selectedHimi())
      const value=key=>String(values[key]||'').trim()

      if(['GEN_04_tub_height_27','GEN_04_tub_inner_width_28'].includes(id)){
        const place=norm(value('GEN_04_bath_or_shower_25'))
        const active=place.includes('badewanne')||place.includes('beides')
        return {visible:active,required:active}
      }

      if(id==='GEN_11_kkh_status_36'){
        return {visible:kasse==='KKH',required:false}
      }

      if(id==='GEN_18_storage_32'){
        const active=himiId==='PG18_E'||himi.includes('e rollstuhl')
        return {visible:active,required:active}
      }

      if(id==='GEN_22_arm_hold_24'){
        const active=himi.includes('aktivlifter')||himi.includes('aufstehlifter')
        return {visible:active,required:active}
      }

      if([
        'GEN_23_contralateral_29','GEN_23_genu_recurvatum_27','GEN_23_muscle_janda_28',
        'GEN_23_rom_lower_25','GEN_23_varus_valgus_26'
      ].includes(id)){
        const active=norm(value('GEN_23_region_24'))==='untere extremitat'
        return {visible:active,required:active}
      }

      if(id==='GEN_23_rom_upper_34'){
        const active=norm(value('GEN_23_region_24'))==='obere extremitat'
        return {visible:active,required:active}
      }

      if(['GEN_23_cobb_angle_33','GEN_23_trunk_findings_32'].includes(id)){
        const active=norm(value('GEN_23_region_24'))==='rumpf wirbelsaule'
        return {visible:active,required:active}
      }

      if(id==='GEN_23_custom_reason_23'){
        const active=norm(value('GEN_23_custom_need_22'))==='nein'
        return {visible:active,required:active}
      }

      if(['GEN_26_therapy_environment_42','GEN_26_usage_scope_41'].includes(id)){
        const active=kasse==='AOK PLUS'
        return {visible:active,required:active}
      }

      // Für weitere "bedingt"-Felder nennt die Quelle keinen eindeutig
      // maschinenlesbaren Auslöser. Sie bleiben sichtbar, blockieren aber
      // die Vollständigkeit nicht, bis eine belastbare Regel hinterlegt ist.
      return {visible:true,required:false}
    }

    function renderField(f){
      const id=f.Feldzeile_ID
      const type=String(f.Datentyp||'Text')
      if($('carePg').value==='23' && /versorgungsziel/i.test(String(f.Feldbezeichnung||''))){
        if(!String(values.planGoal||'').trim() && String(values[id]||'').trim()) values.planGoal=values[id]
        if(String(values.planGoal||'').trim()) values[id]=values.planGoal
        return // Goal belongs to planning after measurement, not initial profile
      }
      const conditional=profileConditionalState(f)
      if(!conditional.visible){
        if(Object.prototype.hasOwnProperty.call(values,id)) delete values[id]
        return
      }
      const sourceStatus=String(f.Pflichtstatus||'').toLowerCase()
      const required=type==='Hinweis'?false:conditional.required
      const options=fieldOptionValues(f)
      const autoValue=profileAutofillValue(f)
      if(autoValue!=='') values[id]=autoValue
      const metaParts=[f.Abschnitt,f.Einheit_Optionen,f.Bedingung_UI].filter(Boolean)
      if(autoValue!=='') metaParts.push('aus Stammdaten übernommen')
      if(sourceStatus==='bedingt' && !f.Bedingung_UI) metaParts.push('bedingt laut Quelle · Auslöser nicht eindeutig hinterlegt')
      if((type==='Auswahl'||type==='Mehrfachauswahl') && !options.length) metaParts.push('Auswahloptionen in der Quelle nicht einzeln hinterlegt · Freitext')
      if(type==='Hinweis') metaParts.push('Hinweis · keine Eingabe erforderlich')
      const meta=metaParts.join(' · ')

      const title=document.createElement('span')
      title.innerHTML=escapeHtml(f.Feldbezeichnung)+(required?'<b>*</b>':'')+(meta?'<small>'+escapeHtml(meta)+'</small>':'')

      const persistSimple=control=>{
        if(values[id]!==undefined && values[id]!==null && typeof values[id]!=='object'){
          if(control.type==='checkbox') control.checked=!!values[id]
          else control.value=values[id]
        }
        control.dataset.required=required?'true':'false'
        if(autoValue!==''){
          control.dataset.profileLinked='true'
          if('readOnly' in control && control.tagName!=='SELECT') control.readOnly=true
          if(control.tagName==='SELECT') control.disabled=true
        }
        const save=()=>{
          values[id]=control.type==='checkbox'?!!control.checked:control.value
          showWizardError('')
          if(profileConditionControllers.has(String(id))) updateCareFields()
          updateWizardStatus()
        }
        control.addEventListener('input',save)
        control.addEventListener('change',save)
        return control
      }

      if(type==='Hinweis'){
        const row=document.createElement('div')
        row.className='field generic-info-field'
        const info=document.createElement('div')
        info.className='generic-field-note'
        info.textContent=f.Bedingung_UI||f.Einheit_Optionen||'Hinweis aus der hinterlegten Formularlogik.'
        row.append(title,info)
        $('fieldList').appendChild(row)
        return
      }

      if(type==='Unterschrift'){
        const row=document.createElement('div')
        row.className='signature-field generic-signature-field'
        const cap=document.createElement('div')
        cap.className='signature-field-label'
        cap.innerHTML=title.innerHTML
        const pad=createSignaturePad(id,{label:f.Feldbezeichnung,ariaLabel:f.Feldbezeichnung})
        pad.dataset.required=required?'true':'false'
        const hint=document.createElement('div')
        hint.className='signature-pad-hint'
        hint.textContent='Direkt mit Maus, Touch oder Stift unterschreiben.'
        row.append(cap,pad,hint)
        $('fieldList').appendChild(row)
        return
      }

      if(type==='Mehrfachauswahl'){
        const row=document.createElement('div')
        row.className='field'
        const group=document.createElement('div')
        group.className='aok-profile-options generic-multi-options'
        group.dataset.profileGroupKey=id
        group.dataset.required=required?'true':'false'
        const selected=Array.isArray(values[id])?values[id]:[]
        const sourceOptions=options.length?options:['Angabe 1']
        sourceOptions.forEach(value=>{
          const item=document.createElement('label')
          const check=document.createElement('input')
          check.type='checkbox'
          check.value=value
          check.checked=selected.includes(value)
          check.addEventListener('change',()=>{
            values[id]=[...group.querySelectorAll('input[type="checkbox"]:checked')].map(x=>x.value)
            showWizardError('')
            updateWizardStatus()
          })
          item.append(check,document.createTextNode(value))
          group.appendChild(item)
        })
        if(!options.length){
          group.replaceChildren()
          const free=document.createElement('textarea')
          free.rows=2
          free.placeholder='Mehrfachangaben dokumentieren'
          free.value=Array.isArray(values[id])?values[id].join('; '):String(values[id]||'')
          free.dataset.required=required?'true':'false'
          free.addEventListener('input',()=>{
            values[id]=free.value.split(';').map(x=>x.trim()).filter(Boolean)
            updateWizardStatus()
          })
          group.appendChild(free)
        }
        row.append(title,group)
        $('fieldList').appendChild(row)
        return
      }

      if(type==='Bestätigung'){
        const row=document.createElement('label')
        row.className='field'
        const control=document.createElement('input')
        control.type='checkbox'
        control.checked=values[id]===true
        control.dataset.required=required?'true':'false'
        const save=()=>{values[id]=!!control.checked;showWizardError('');updateWizardStatus()}
        control.addEventListener('change',save)
        row.append(title,control)
        $('fieldList').appendChild(row)
        return
      }

      if(type==='Bestätigung + Langtext'){
        const row=document.createElement('div')
        row.className='field'
        const wrap=document.createElement('div')
        wrap.className='generic-composite'
        const stored=(values[id]&&typeof values[id]==='object')?values[id]:{}
        const confirm=document.createElement('label')
        confirm.className='generic-inline-check'
        const check=document.createElement('input')
        check.type='checkbox'
        check.checked=stored.confirmed===true
        check.dataset.required=required?'true':'false'
        confirm.append(check,document.createTextNode('Bestätigt'))
        const note=document.createElement('textarea')
        note.rows=2
        note.placeholder='Bemerkung'
        note.value=stored.text||''
        const save=()=>{
          values[id]={confirmed:!!check.checked,text:note.value}
          showWizardError('')
          updateWizardStatus()
        }
        check.addEventListener('change',save);note.addEventListener('input',save)
        wrap.append(confirm,note)
        row.append(title,wrap)
        $('fieldList').appendChild(row)
        return
      }

      if(type.startsWith('Ja/Nein +')){
        const row=document.createElement('div')
        row.className='field'
        const wrap=document.createElement('div')
        wrap.className='generic-composite'
        const stored=(values[id]&&typeof values[id]==='object')?values[id]:{}
        const choice=document.createElement('select')
        choice.innerHTML='<option value="">Bitte wählen</option><option>Ja</option><option>Nein</option>'
        choice.value=stored.choice||((values[id]==='Ja'||values[id]==='Nein')?values[id]:'')
        choice.dataset.required=required?'true':'false'
        let detail
        if(type.includes('Zahl')||type.includes('Distanz')){
          detail=document.createElement('input')
          detail.type='number'
          detail.step='any'
        }else{
          detail=document.createElement('textarea')
          detail.rows=2
        }
        detail.placeholder=type.includes('Bemerkung')?'Bemerkung':'Zusatzangabe'
        detail.value=stored.detail||''
        const save=()=>{
          values[id]={choice:choice.value,detail:detail.value}
          showWizardError('')
          updateWizardStatus()
        }
        choice.addEventListener('change',save);detail.addEventListener('input',save)
        wrap.append(choice,detail)
        row.append(title,wrap)
        $('fieldList').appendChild(row)
        return
      }

      if(type==='Auswahl + Langtext'){
        const row=document.createElement('div')
        row.className='field'
        const wrap=document.createElement('div')
        wrap.className='generic-composite'
        const stored=(values[id]&&typeof values[id]==='object')?values[id]:{}
        let choice
        if(options.length){
          choice=document.createElement('select')
          choice.innerHTML='<option value="">Bitte wählen</option>'+options.map(x=>'<option>'+escapeHtml(x)+'</option>').join('')
        }else{
          choice=document.createElement('input')
          choice.placeholder='Auswahl / Status'
        }
        choice.value=stored.choice||''
        choice.dataset.required=required?'true':'false'
        const detail=document.createElement('textarea')
        detail.rows=2
        detail.placeholder='Bemerkung'
        detail.value=stored.detail||''
        const save=()=>{
          values[id]={choice:choice.value,detail:detail.value}
          showWizardError('')
          updateWizardStatus()
        }
        choice.addEventListener('input',save);choice.addEventListener('change',save);detail.addEventListener('input',save)
        wrap.append(choice,detail)
        row.append(title,wrap)
        $('fieldList').appendChild(row)
        return
      }

      const label=document.createElement('label')
      label.className='field'
      let control
      if(type==='Ja/Nein'){
        control=document.createElement('select')
        control.innerHTML='<option value="">Bitte wählen</option><option>Ja</option><option>Nein</option>'
      }else if(type==='Datum'){
        control=document.createElement('input');control.type='date'
      }else if(type==='Zahl'){
        control=document.createElement('input');control.type='number'
      }else if(type==='Langtext'||type==='Messreihe'||type==='Messwert/Anhang'){
        control=document.createElement('textarea');control.rows=3
      }else if(type==='Auswahl'){
        if(options.length){
          control=document.createElement('select')
          control.innerHTML='<option value="">Bitte wählen</option>'+options.map(x=>'<option>'+escapeHtml(x)+'</option>').join('')
        }else{
          control=document.createElement('input')
          control.placeholder='Angabe'
        }
      }else{
        control=document.createElement('input')
      }
      persistSimple(control)
      label.append(title,control)
      $('fieldList').appendChild(label)
    }



    const wizardSteps=[
      {name:'Auftragserfassung'}, {name:'Rezepterfassung'}, {name:'Profilerhebung / Reparaturprotokoll'},
      {name:'Maßblatt'}, {name:'Versorgungsplanung'}, {name:'Vertrag & Kostenvoranschlag'},
      {name:'Genehmigung / Voraussetzungen'}, {name:'Versorgungsverlauf'}, {name:'Erprobung / Bild / Video'},
      {name:'Abgabe'}, {name:'Abrechnung & Abschluss'}
    ]
    let wizardIndex=0
    let wizardBound=false

    async function setView(view){
      if(view==='supplyOverview') renderSupplyOverview()
      document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view))
      views.forEach(v=>$(v+'View').classList.toggle('hidden',v!==view))
      $('pageTitle').textContent=titles[view]
      if(view==='pg26') await loadOptionalData('pg26')
      if(view==='contractQuestions') await loadOptionalData('contractQuestions')
      if(view==='sources') await loadOptionalData('sources')
      if(view==='forms') await loadOptionalData('forms')
    }

    function readCaseField(el){
      if(el.type==='checkbox') return !!el.checked
      if(el.type==='radio') return el.checked?el.value:undefined
      return el.value
    }

    function writeCaseField(el,value){
      if(el.type==='checkbox') el.checked=!!value
      else if(el.type==='radio') el.checked=String(value??'')===String(el.value)
      else if(value!==undefined && value!==null) el.value=value
      else if(value===undefined||value===null) el.value=''
    }

    function syncCaseFieldControls(key,value,source=null){
      document.querySelectorAll('[data-case-field="'+CSS.escape(String(key))+'"]').forEach(el=>{
        if(el!==source) writeCaseField(el,value)
      })
    }

    const ALL_SUPPLY_TYPES=['Post-OP','Interim','Definitiv','Folge','Wechsel','Reparatur','Änderung','Instandhaltung','Funktionsbauteilerprobung']
    const NEW_SUPPLY_TYPES=['Post-OP','Interim','Definitiv','Folge','Wechsel','Funktionsbauteilerprobung']
    const REPAIR_SUPPLY_TYPES=['Reparatur','Änderung','Instandhaltung']

    function selectedCaseKind(){
      const checked=document.querySelector('input[name="caseKindChoice"]:checked')
      return checked?.value || values.caseKind || ''
    }

    function isRepairCase(){
      return selectedCaseKind()==='Reparatur'
    }

    function inferredCaseKindFromSupplyType(type=values.supplyType){
      if(REPAIR_SUPPLY_TYPES.includes(type)) return 'Reparatur'
      if(NEW_SUPPLY_TYPES.includes(type)) return 'Neuversorgung'
      return ''
    }

    function syncWizardBranchLabels(){
      const repair=isRepairCase()
      wizardSteps[2].name=repair?'Reparaturprotokoll':'Profilerhebung'
      const step=document.querySelector('.wizard-step[data-step="2"] .step-label')
      if(step) step.textContent=wizardSteps[2].name
      const profile=$('profileStepContent'),repairBox=$('repairStepContent')
      if(profile) profile.classList.toggle('hidden',repair)
      if(repairBox) repairBox.classList.toggle('hidden',!repair)
      if(repair){
        renderRepairPhotos()
        renderRepairLabelPhotos()
      }
    }

    function syncCaseKind(explicitKind=''){
      const kind=explicitKind || selectedCaseKind()
      if(kind) values.caseKind=kind

      document.querySelectorAll('input[name="caseKindChoice"]').forEach(radio=>{
        radio.checked=String(radio.value)===String(values.caseKind||'')
      })

      const repair=values.caseKind==='Reparatur'
      $('repairPathNote')?.classList.toggle('hidden',!repair)
      $('orderSupplyTypeField')?.classList.remove('hidden')

      if(!repair){
        values.repairPreperformed=''
        if($('repairPreperformed')) $('repairPreperformed').value=''
      }

      syncSupplyTypeOptions()
      syncWizardBranchLabels()
      syncSituationFields()
      syncRxPresence()
      updateCareFields()
      renderMeasureFields()
    }

    function isAokCase(){ return $('careKasse').value==='AOK Baden-Württemberg' }
    function supplyType(){ return values.supplyType||'' }
    function syncPg24Level(){
      if($('carePg').value!=='24') return
      const h=selectedHimi()
      const map={
        'Vor-/Mittelfußprothese':'Vor-/Mittelfuß',
        'Fuß-/Fußwurzel-/Rückfußprothese':'Fuß/Fußwurzel/Rückfuß',
        'Unterschenkelprothese':'Unterschenkel',
        'Knie-Exartikulationsprothese':'Knie-Exartikulation',
        'Oberschenkelprothese':'Oberschenkel',
        'Hüft-Exartikulations-/Hemipelvisprothese':'Hüft-Exartikulation / Hemipelvis'
      }
      if(map[h]){
        values.ampLevel=map[h]
        const el=document.querySelector('[data-case-field="ampLevel"]')
        if(el) el.value=map[h]
      }
    }

    function requiresSide(){
      const pg=$('carePg').value
      const id=selectedHimiId()
      return pg==='24' || pg==='05' || pg==='08' || pg==='38' || ['PG23_UE','PG23_OE'].includes(id)
    }

    function syncSituationFields(){
      const pg=$('carePg').value
      const amp=$('careAmpLevelLabel')
      const side=$('careSideLabel')
      if(amp){
        const show=pg==='24'
        amp.classList.toggle('hidden',!show)
        if(!show){
          values.ampLevel=''
          if($('careAmpLevel')) $('careAmpLevel').value=''
        }
      }
      if(side){
        const show=requiresSide()
        side.classList.toggle('hidden',!show)
        if(!show){
          values.side=''
          if($('careSide')) $('careSide').value=''
        }
      }
    }

    function requiresProfile(){
      const kind=selectedCaseKind()
      if(kind==='Reparatur') return false
      if(kind==='Neuversorgung') return true
      const meta=selectedHimiMeta()
      if(meta) return !!meta.Profil_erforderlich
      return true
    }
    function requiresMeasure(){
      if(isRepairCase()) return false
      const meta=selectedHimiMeta()
      if(meta){
        if(!meta.Mass_erforderlich) return false
        const cond=meta.Mass_Pflicht_bei||[]
        return !cond.length || cond.includes(supplyType())
      }
      return ['Interim','Definitiv','Folge','Wechsel'].includes(supplyType())
    }
    function requiresCourse(){
      if(isRepairCase()) return false
      const meta=selectedHimiMeta()
      if(meta) return !!meta.Verlauf_erforderlich
      return ['Interim','Definitiv','Folge','Wechsel'].includes(supplyType())
    }
    function requiresEvidence(){
      if(isRepairCase()) return false
      const meta=selectedHimiMeta()
      return !!meta?.Erprobung_erforderlich || supplyType()==='Funktionsbauteilerprobung' || supplyType()==='Erprobung' || values.requiresTrialEvidence==='Ja' || values.evidenceRequired===true
    }
    function stepApplicable(i){
      if(V09_ANAMNESIS_SCOPE && i===10) return false
      if(i===2) return selectedCaseKind()==='Neuversorgung' || selectedCaseKind()==='Reparatur'
      if(i===3) return !isRepairCase() && requiresMeasure()
      if(i===4) return !isRepairCase()
      if(i===7) return !isRepairCase() && requiresCourse()
      if(i===8) return !isRepairCase() && requiresEvidence()
      return true
    }

    function fieldLabel(key){
      const el=document.querySelector('[data-case-field="'+key+'"]')
      return el?.closest('label')?.childNodes?.[0]?.textContent?.trim() || key
    }
    function missingValues(keys){
      return keys.filter(k=>{
        const v=values[k]
        return v===undefined || v===null || v===false || String(v).trim()===''
      }).map(fieldLabel)
    }

    function profileValidation(){
      const host=$('fieldList')
      const controls=[...host.querySelectorAll('input,select,textarea')]
      const signatures=[...host.querySelectorAll('[data-signature-key]')]
      const groups=[...host.querySelectorAll('[data-profile-group-key]')]
      if($('carePg').value==='24' && isAokCase()){
        const missing=[]
        for(const side of aokProfileSides()){
          const scope=host.querySelector('[data-aok-pdf-side="'+(side||'einseitig')+'"]')
          const label=side?' ('+side+')':''
          if(!scope || scope.dataset.pdfReady!=='true'){
            missing.push('AOK-Anlage 4'+label+': Originalbogen noch nicht vollständig geladen')
            continue
          }
          const excluded=/^Text(?:1|2|3|4|5|6|24|25|67|68|70)$/
          const documented=[...scope.querySelectorAll('[data-profile-key]')].some(el=>{
            const key=String(el.dataset.profileKey||'')
            const name=key.split(':').pop()
            if(excluded.test(name)||el.readOnly||el.dataset.signatureRole) return false
            return el.type==='checkbox'?el.checked:!!String(el.value||'').trim()
          })
          const plusM=Number(values[aokPlusMSummaryKey('aokPlusMAnswered',side)])||0
          if(!documented && plusM===0) missing.push('AOK-Anlage 4'+label+': mindestens eine fachliche Angabe erforderlich')
          if(plusM>0 && plusM<12) missing.push('AOK-Anlage 4'+label+': PLUS-M mit 12 Antworten abschließen')
        }
        if(missing.length) return {ok:false,missing}
      }
      if(!controls.length && !signatures.length && !groups.length) return {ok:false,missing:['passender Profilerhebungsbogen / Felddefinitionen']}

      // Region is a source-defined PG23 field, while the selected aid determines
      // the anatomical measurement profile. Do not accept contradictory pairings.
      if($('carePg').value==='23'){
        const expectedRegion={
          PG23_UE:'untere extremitat',
          PG23_OE:'obere extremitat',
          PG23_KORSETT:'rumpf wirbelsaule',
          PG23_MIEDER:'rumpf wirbelsaule'
        }[selectedHimiId()]
        const chosenRegion=norm(values.GEN_23_region_24)
        if(expectedRegion && chosenRegion && chosenRegion!==expectedRegion){
          return {ok:false,missing:['Anwendungsregion widerspricht dem ausgewählten Hilfsmittel / Maßprofil']}
        }
      }

      // On PG24 source PDFs many widgets are not individually classified as
      // mandatory. Prefilled demographics alone are not a clinical assessment.
      if($('carePg').value==='24'){
        // The therapy goal is now required in step 5 (Versorgungsplanung),
        // after the clinical measure sheet; existing saved values migrate there.
      }

      const required=controls.filter(x=>x.dataset.required==='true')
      const emptyControls=required.filter(x=>{
        if(x.type==='checkbox') return !x.checked
        return !String(x.value||'').trim()
      })
      const requiredGroups=groups.filter(x=>x.dataset.required==='true')
      const emptyGroups=requiredGroups.filter(x=>{
        const value=values[x.dataset.profileGroupKey]
        return !Array.isArray(value)||value.length===0
      })
      const requiredSignatures=signatures.filter(x=>x.dataset.required==='true')
      const emptySignatures=requiredSignatures.filter(x=>!signatureHasInk(x.dataset.signatureKey))

      const missing=[
        ...emptyControls.map(x=>x.closest('.field')?.querySelector(':scope > span')?.childNodes?.[0]?.textContent?.trim()||x.closest('label')?.querySelector('span')?.childNodes?.[0]?.textContent?.trim()||'Pflichtfeld'),
        ...emptyGroups.map(x=>x.closest('.field')?.querySelector(':scope > span')?.childNodes?.[0]?.textContent?.trim()||'Mehrfachauswahl'),
        ...emptySignatures.map(x=>x.dataset.signatureLabel||'Unterschrift')
      ]

      if(required.length || requiredGroups.length || requiredSignatures.length){
        return {ok:missing.length===0,missing:missing.slice(0,8)}
      }

      const anyFilled=
        controls.some(x=>x.type==='checkbox'?x.checked:String(x.value||'').trim()) ||
        groups.some(x=>Array.isArray(values[x.dataset.profileGroupKey])&&values[x.dataset.profileGroupKey].length>0) ||
        signatures.some(x=>signatureHasInk(x.dataset.signatureKey))
      return {ok:anyFilled,missing:anyFilled?[]:['mindestens eine fachliche Angabe im Profilerhebungsbogen']}
    }

    function validateStep(i){
      if(!stepApplicable(i)) return {ok:true,missing:[]}
      let missing=[]
      if(i===0){
        const caseKind=selectedCaseKind()
        if(caseKind && values.caseKind!==caseKind) values.caseKind=caseKind
        if(!$('careKasse').value) missing.push('Krankenkasse / Kostenträger')
        if(!$('carePg').value) missing.push('Produktgruppe')
        if(!selectedHimiId()) missing.push('Hilfsmittel / Versorgungsbereich')
        if(!values.caseKind) missing.push('Vorgangsart')
        missing.push(...missingValues(['patientFirstName','patientLastName','patientBirthDate','supplyType']))
        if(requiresSide()) missing.push(...missingValues(['side']))
        if($('carePg').value==='24') missing.push(...missingValues(['ampLevel']))
      } else if(i===1){
        missing=missingValues(['rxPresent'])
        if(values.rxPresent==='Ja'){
          if(!values.rxFileCaptured) missing.push('Rezeptfoto / Rezeptdatei')
          if(!String(values.rxText||'').trim()) missing.push('Verordnung / Hilfsmitteltext')
        }else if(values.rxPresent==='Nein' && !isRepairCase()){
          if(!String(values.rxNeededText||'').trim()) missing.push('Verordnungstext / benötigter Rezepttext')
        }
      } else if(i===2){
        if(isRepairCase()){
          missing=missingValues(['repairSicHimiId','repairDate','repairTechnician','repairPreperformed','repairComplaint','repairWork','repairFunctionTest','repairUsable','repairCompleted'])
          return {ok:missing.length===0,missing}
        }
        return profileValidation()
      } else if(i===3){
        missing=missingValues(['measureDate'])
        if($('carePg').value==='24' && isAokCase() && aokPg24MeasureAsset()){
          // A date alone must not mark an otherwise empty AOK contract sheet complete.
          // Require a manually entered entry in the original PDF widget layer.
          const originalMeasures=[...$('measureFieldList').querySelectorAll('[data-measure-key]')]
          const anyOriginal=originalMeasures.some(x=>x.type==='checkbox'?x.checked:String(x.value||'').trim())
          if(!anyOriginal) missing.push('mindestens eine Maßangabe im AOK-Originalmaßblatt')
          return {ok:missing.length===0,missing}
        }
        if($('carePg').value==='24' && pg24SourceMeasureSchema()){
          const sourceMeasures=[...$('measureFieldList').querySelectorAll('[data-measure-value="true"]')]
          const anySource=sourceMeasures.some(x=>x.type==='checkbox'?x.checked:String(x.value||'').trim())
          if(!anySource) missing.push('mindestens ein Maßwert')
          return {ok:missing.length===0,missing}
        }
        const measureControls=[...$('measureFieldList').querySelectorAll('[data-measure-key]')]
        const required=measureControls.filter(x=>x.dataset.required==='true')
        required.forEach(x=>{if(!String(x.value||'').trim()) missing.push(x.closest('label')?.querySelector('span')?.childNodes?.[0]?.textContent?.trim()||'Maßfeld')})
        if(!measureControls.length && !String(values.measureValues||'').trim()) missing.push('Maßangaben')
      } else if(i===4){
        missing=missingValues(['planGoal'])
        if(!String(values.planShaft||'').trim() && !String(values.planParts||'').trim()) missing.push('Schaft-/Bettungskonzept oder geplante Komponenten')
      } else if(i===5){
        missing=missingValues(['quotePositions'])
      } else if(i===6){
        missing=missingValues(['approvalState'])
        if(values.approvalState && values.approvalState!=='Nicht genehmigungspflichtig'){
          if(!values.docQuote) missing.push('Kostenvoranschlag vollständig')
          if(isAokCase() && !['Reparatur','Instandhaltung'].includes(supplyType()) && !values.docRx) missing.push('Verordnung geprüft')
          if(requiresProfile() && !values.docProfile) missing.push('Profilerhebung vorhanden')
          if(requiresMeasure() && !values.docMeasure) missing.push('Maßdokumentation vorhanden')
          if(values.approvalState==='Genehmigt' && !values.approvalDate) missing.push('Genehmigungsdatum')
        }
      } else if(i===7){
        if(!values.courseFormDate) missing.push('Datum Formerfassung')
        if(!values.courseStaticDate && !values.courseDynamicDate) missing.push('mindestens eine statische oder dynamische Anprobe')
      } else if(i===8){
        if(!values.consentPresent) missing.push('Einwilligung vorhanden')
        missing.push(...missingValues(['trialPeriod','functionalBenefit']))
      } else if(i===9){
        missing=missingValues(['deliveryDate'])
        if(!values.deliveryUsable) missing.push('gebrauchsfähige Abgabe bestätigt')
        if(!values.deliveryInstruction) missing.push('Gebrauchseinweisung bestätigt')
        if(!values.deliveryReceipt) missing.push('Empfang bestätigt')
      } else if(i===10){
        missing=missingValues(['billingState'])
        if(isAokCase() && values.billingState){
          if(!values.billingPosition) missing.push('Abrechnungsposition')
          if(!values.billingVwkz) missing.push('VWKZ')
        }
      }
      return {ok:missing.length===0,missing}
    }

    function firstBlockingIndex(){
      for(let i=0;i<wizardSteps.length;i++){
        if(stepApplicable(i) && !validateStep(i).ok) return i
      }
      return wizardSteps.length-1
    }

    function nextApplicableIndex(from){
      for(let i=from+1;i<wizardSteps.length;i++) if(stepApplicable(i)) return i
      return from
    }
    function previousApplicableIndex(from){
      for(let i=from-1;i>=0;i--) if(stepApplicable(i)) return i
      return from
    }

    function showWizardError(message,missing=[]){
      const el=$('wizardError')
      if(!message){el.classList.add('hidden');el.innerHTML='';return}
      el.classList.remove('hidden')
      el.innerHTML='<strong>'+escapeHtml(message)+'</strong>'+(missing.length?escapeHtml(missing.join(' · ')):'')
    }

    const REPAIR_PHOTO_BUCKET='repair-photos-private'
    const REPAIR_SOURCE_MAX_BYTES=20*1024*1024
    const REPAIR_SOURCE_MAX_PIXELS=50000000
    const repairPhotoUrlCache=new Map()

    function repairPhotos(){
      return Array.isArray(values.repairPhotos)?values.repairPhotos:[]
    }

    function formatRepairPhotoSize(bytes){
      bytes=Number(bytes)||0
      if(bytes<1024) return bytes+' B'
      if(bytes<1024*1024) return Math.round(bytes/1024)+' KB'
      return (bytes/(1024*1024)).toFixed(1)+' MB'
    }

    function canvasToJpegBlob(canvas,quality){
      return new Promise((resolve,reject)=>{
        canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Bild konnte nicht komprimiert werden.')),'image/jpeg',quality)
      })
    }

    async function compressRepairPhoto(file){
      if((Number(file?.size)||0)>REPAIR_SOURCE_MAX_BYTES){
        throw new Error('Foto ist größer als 20 MB und wurde nicht verarbeitet.')
      }
      const bmp=await createImageBitmap(file)
      try{
        if((Number(bmp.width)||0)*(Number(bmp.height)||0)>REPAIR_SOURCE_MAX_PIXELS){
          throw new Error('Fotoauflösung ist zu groß und wurde nicht verarbeitet.')
        }
        const maxSide=1000
        const scale=Math.min(1,maxSide/Math.max(bmp.width,bmp.height))
        let width=Math.max(1,Math.round(bmp.width*scale))
        let height=Math.max(1,Math.round(bmp.height*scale))
        let canvas=document.createElement('canvas')
        canvas.width=width;canvas.height=height
        let ctx=canvas.getContext('2d',{alpha:false})
        ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height)
        ctx.drawImage(bmp,0,0,width,height)
        let blob=await canvasToJpegBlob(canvas,.72)
        if(blob.size>430000){
          const ratio=Math.sqrt(400000/blob.size)
          width=Math.max(1,Math.round(width*ratio))
          height=Math.max(1,Math.round(height*ratio))
          const smaller=document.createElement('canvas')
          smaller.width=width;smaller.height=height
          ctx=smaller.getContext('2d',{alpha:false})
          ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height)
          ctx.drawImage(canvas,0,0,width,height)
          canvas=smaller
          blob=await canvasToJpegBlob(canvas,.58)
        }
        const id=crypto.randomUUID?crypto.randomUUID():'foto-'+Date.now()+'-'+Math.random().toString(16).slice(2)
        return {
          meta:{
            id,
            name:String(file.name||'Reparaturfoto').slice(0,120),
            type:'image/jpeg',
            width,height,
            size:blob.size,
            createdAt:new Date().toISOString()
          },
          blob
        }
      }finally{bmp.close?.()}
    }

    async function uploadRepairPhoto(prepared,folder='repair'){
      if(!currentSession?.user?.id || !activeSupplyId) throw new Error('Kein aktiver Versorgungsvorgang.')
      const safeFolder=folder==='labels'?'labels':'repair'
      // Keep all media under the immutable case owner's path, including
      // photos added by other approved staff, so existing URLs remain valid.
      const ownerId=activeSupplyRecord()?.ownerUserId||currentSession.user.id
      const path=ownerId+'/'+activeSupplyId+'/'+safeFolder+'/'+prepared.meta.id+'.jpg'
      const upload=await supabase.storage.from(REPAIR_PHOTO_BUCKET).upload(path,prepared.blob,{
        contentType:'image/jpeg',
        cacheControl:'0',
        upsert:false
      })
      if(upload.error) throw upload.error
      return {...prepared.meta,path}
    }

    async function repairPhotoDisplayUrl(photo){
      if(photo?.dataUrl) return photo.dataUrl
      if(!photo?.path) return ''
      const cached=repairPhotoUrlCache.get(photo.path)
      if(cached?.expiresAt>Date.now()+30000) return cached.url
      const signed=await supabase.storage.from(REPAIR_PHOTO_BUCKET).createSignedUrl(photo.path,300)
      if(signed.error) throw signed.error
      repairPhotoUrlCache.set(photo.path,{url:signed.data.signedUrl,expiresAt:Date.now()+240000})
      return signed.data.signedUrl
    }

    async function renderRepairPhotos(){
      const host=$('repairPhotoGallery'),counter=$('repairPhotoCounter')
      if(!host||!counter) return
      const photos=repairPhotos()
      counter.textContent=photos.length?photos.length+' von 4 Fotos gespeichert.':'Noch keine Fotos erfasst.'
      if(!photos.length){
        host.innerHTML='<div class="repair-photo-empty">Noch keine Fotodokumentation vorhanden.</div>'
        return
      }
      host.innerHTML='<div class="repair-photo-empty">Fotodokumentation wird geladen …</div>'
      const urls=await Promise.all(photos.map(async photo=>{
        try{return await repairPhotoDisplayUrl(photo)}catch(err){console.error(err);return ''}
      }))
      const canEdit=supplyHasEditableContext()
      host.innerHTML=photos.map((photo,index)=>
        '<article class="repair-photo-item">'+
          (canEdit?'<button type="button" class="repair-photo-remove" data-repair-photo-remove="'+index+'" aria-label="Foto löschen">×</button>':'')+
          (urls[index]?'<img src="'+escapeHtml(urls[index])+'" alt="Reparaturfoto '+(index+1)+'">':'<div class="repair-photo-empty">Foto konnte nicht geladen werden.</div>')+
          '<div class="repair-photo-meta" title="'+escapeHtml(photo.name)+'">'+escapeHtml(photo.name)+' · '+escapeHtml(formatRepairPhotoSize(photo.size||0))+'</div>'+
        '</article>'
      ).join('')
      host.querySelectorAll('[data-repair-photo-remove]').forEach(btn=>btn.addEventListener('click',async()=>{
        const i=Number(btn.dataset.repairPhotoRemove)
        const previous=repairPhotos().slice()
        const next=previous.slice()
        const [removed]=next.splice(i,1)
        if(!removed) return

        values.repairPhotos=next
        const saved=await persistActiveSupplyNow()
        if(!saved){
          values.repairPhotos=previous
          await renderRepairPhotos()
          showWizardError('Foto konnte nicht sicher aus dem Vorgang entfernt werden. Der bisherige Stand bleibt erhalten.')
          return
        }

        if(removed.path){
          const storageDelete=await removeRepairStoragePaths([removed.path])
          if(!storageDelete.ok){
            values.repairPhotos=previous
            const rollbackSaved=await persistActiveSupplyNow()
            await renderRepairPhotos()
            showWizardError(
              rollbackSaved
                ? 'Foto konnte im Bildspeicher nicht gelöscht werden. Die Änderung am Vorgang wurde zurückgenommen.'
                : 'Foto konnte im Bildspeicher nicht gelöscht werden und der Vorgang konnte nicht vollständig zurückgesetzt werden. Bitte Administrator informieren.',
              [storageDelete.error?.message||'Storage-Löschung fehlgeschlagen']
            )
            return
          }
        }

        await renderRepairPhotos()
        showWizardError('')
        updateWizardStatus()
      }))
    }

    async function handleRepairPhotos(files){
      if(!supplyHasEditableContext()) return
      const selected=[...(files||[])].filter(file=>String(file.type||'').startsWith('image/'))
      if(!selected.length) return
      const previous=repairPhotos().slice()
      const next=previous.slice()
      const uploaded=[]
      const slots=Math.max(0,4-next.length)
      if(!slots){
        showWizardError('Es können maximal 4 Reparaturfotos gespeichert werden.')
        return
      }
      const todo=selected.slice(0,slots)
      const counter=$('repairPhotoCounter')
      if(counter) counter.textContent='Fotos werden vorbereitet und sicher gespeichert …'
      try{
        const parentSaved=await persistActiveSupplyNow()
        if(!parentSaved) throw new Error('Versorgung konnte vor dem Foto-Upload nicht sicher gespeichert werden.')
        for(const file of todo){
          const prepared=await compressRepairPhoto(file)
          const photo=await uploadRepairPhoto(prepared)
          uploaded.push(photo)
          next.push(photo)
        }
        values.repairPhotos=next
        const saved=await persistActiveSupplyNow()
        if(!saved) throw new Error('Vorgang konnte nach dem Foto-Upload nicht gespeichert werden.')
        await renderRepairPhotos()
        showWizardError('')
        updateWizardStatus()
      }catch(err){
        console.error(err)
        values.repairPhotos=previous
        const cleanup=await removeRepairStoragePaths(uploaded.map(photo=>photo.path))
        await renderRepairPhotos()
        showWizardError(
          cleanup.ok
            ? 'Ein Reparaturfoto konnte nicht sicher gespeichert werden. Bereits hochgeladene Dateien wurden zurückgerollt.'
            : 'Ein Reparaturfoto konnte nicht sicher gespeichert werden. Mindestens eine hochgeladene Datei konnte nicht automatisch entfernt werden; bitte Administrator informieren.',
          [err?.message||'Unbekannter Fehler',cleanup.error?.message].filter(Boolean)
        )
      }finally{
        if($('repairPhotoFiles')) $('repairPhotoFiles').value=''
        if($('repairPhotoCamera')) $('repairPhotoCamera').value=''
      }
    }

    function repairLabelPhotos(){
      return Array.isArray(values.repairLabelPhotos)?values.repairLabelPhotos:[]
    }

    async function renderRepairLabelPhotos(){
      const host=$('repairLabelGallery'),counter=$('repairLabelCounter')
      if(!host||!counter) return
      const photos=repairLabelPhotos()
      counter.textContent=photos.length?photos.length+' von 10 Etikett-Fotos gespeichert.':'Noch keine Passteiletiketten erfasst.'
      if(!photos.length){
        host.innerHTML='<div class="repair-photo-empty">Noch keine Hersteller-/Passteiletiketten vorhanden.</div>'
        return
      }
      host.innerHTML='<div class="repair-photo-empty">Etikett-Fotos werden geladen …</div>'
      const urls=await Promise.all(photos.map(async photo=>{
        try{return await repairPhotoDisplayUrl(photo)}catch(err){console.error(err);return ''}
      }))
      const canEdit=supplyHasEditableContext()
      host.innerHTML=photos.map((photo,index)=>
        '<article class="repair-photo-item">'+
          (canEdit?'<button type="button" class="repair-photo-remove" data-repair-label-remove="'+index+'" aria-label="Etikett-Foto löschen">×</button>':'')+
          (urls[index]?'<img src="'+escapeHtml(urls[index])+'" alt="Passteiletikett '+(index+1)+'">':'<div class="repair-photo-empty">Foto konnte nicht geladen werden.</div>')+
          '<div class="repair-photo-meta" title="'+escapeHtml(photo.name)+'">'+escapeHtml(photo.name)+' · '+escapeHtml(formatRepairPhotoSize(photo.size||0))+'</div>'+
        '</article>'
      ).join('')
      host.querySelectorAll('[data-repair-label-remove]').forEach(btn=>btn.addEventListener('click',async()=>{
        const i=Number(btn.dataset.repairLabelRemove)
        const previous=repairLabelPhotos().slice()
        const next=previous.slice()
        const [removed]=next.splice(i,1)
        if(!removed) return

        values.repairLabelPhotos=next
        const saved=await persistActiveSupplyNow()
        if(!saved){
          values.repairLabelPhotos=previous
          await renderRepairLabelPhotos()
          showWizardError('Etikett-Foto konnte nicht sicher aus dem Vorgang entfernt werden. Der bisherige Stand bleibt erhalten.')
          return
        }

        if(removed.path){
          const storageDelete=await removeRepairStoragePaths([removed.path])
          if(!storageDelete.ok){
            values.repairLabelPhotos=previous
            const rollbackSaved=await persistActiveSupplyNow()
            await renderRepairLabelPhotos()
            showWizardError(
              rollbackSaved
                ? 'Etikett-Foto konnte im Bildspeicher nicht gelöscht werden. Die Änderung am Vorgang wurde zurückgenommen.'
                : 'Etikett-Foto konnte im Bildspeicher nicht gelöscht werden und der Vorgang konnte nicht vollständig zurückgesetzt werden. Bitte Administrator informieren.',
              [storageDelete.error?.message||'Storage-Löschung fehlgeschlagen']
            )
            return
          }
        }

        await renderRepairLabelPhotos()
        showWizardError('')
        updateWizardStatus()
      }))
    }

    async function handleRepairLabelPhotos(files){
      if(!supplyHasEditableContext()) return
      const selected=[...(files||[])].filter(file=>String(file.type||'').startsWith('image/'))
      if(!selected.length) return
      const previous=repairLabelPhotos().slice()
      const next=previous.slice()
      const uploaded=[]
      const slots=Math.max(0,10-next.length)
      if(!slots){
        showWizardError('Es können maximal 10 Passteiletiketten gespeichert werden.')
        return
      }
      const todo=selected.slice(0,slots)
      const counter=$('repairLabelCounter')
      if(counter) counter.textContent='Etikett-Fotos werden vorbereitet und sicher gespeichert …'
      try{
        const parentSaved=await persistActiveSupplyNow()
        if(!parentSaved) throw new Error('Versorgung konnte vor dem Etikett-Upload nicht sicher gespeichert werden.')
        for(const file of todo){
          const prepared=await compressRepairPhoto(file)
          const photo=await uploadRepairPhoto(prepared,'labels')
          uploaded.push(photo)
          next.push(photo)
        }
        values.repairLabelPhotos=next
        const saved=await persistActiveSupplyNow()
        if(!saved) throw new Error('Vorgang konnte nach dem Etikett-Upload nicht gespeichert werden.')
        await renderRepairLabelPhotos()
        showWizardError('')
        updateWizardStatus()
      }catch(err){
        console.error(err)
        values.repairLabelPhotos=previous
        const cleanup=await removeRepairStoragePaths(uploaded.map(photo=>photo.path))
        await renderRepairLabelPhotos()
        showWizardError(
          cleanup.ok
            ? 'Ein Etikett-Foto konnte nicht sicher gespeichert werden. Bereits hochgeladene Dateien wurden zurückgerollt.'
            : 'Ein Etikett-Foto konnte nicht sicher gespeichert werden. Mindestens eine hochgeladene Datei konnte nicht automatisch entfernt werden; bitte Administrator informieren.',
          [err?.message||'Unbekannter Fehler',cleanup.error?.message].filter(Boolean)
        )
      }finally{
        if($('repairLabelFiles')) $('repairLabelFiles').value=''
        if($('repairLabelCamera')) $('repairLabelCamera').value=''
      }
    }

    function bindWizardInputs(){
      if(wizardBound) return
      wizardBound=true
      document.querySelectorAll('[data-case-field]').forEach(el=>{
        const key=el.dataset.caseField
        writeCaseField(el,values[key])
        const save=(event)=>{
          if(el.type==='radio' && !el.checked) return
          const next=readCaseField(el)
          if(next!==undefined){
            values[key]=next
            syncCaseFieldControls(key,next,el)
          }
          if(key==='planGoal'){
            values.versorgungGoalText=String(next||'')
            values['tech:therapyGoal']=String(next||'')
            Object.keys(values).filter(k=>/^GEN_23_/.test(k)&&/goal/i.test(k)).forEach(k=>{values[k]=String(next||'')})
          }
          if(key==='caseKind') syncCaseKind()
          if(key==='supplyType'){syncSituationFields();renderMeasureFields();updateCareFields()}
          if(key==='rxPresent') syncRxPresence()
          if(['patientFirstName','patientLastName','patientBirthDate','insuredNo','side'].includes(key) && event?.type==='change') updateCareFields()
          showWizardError('');updateWizardStatus()
        }
        el.addEventListener('input',save)
        el.addEventListener('change',save)
      })
      document.querySelectorAll('input[name="caseKindChoice"]').forEach(radio=>{
        radio.addEventListener('change',()=>{
          if(!radio.checked) return
          values.caseKind=radio.value
          syncCaseKind(radio.value)
          showWizardError('')
          updateWizardStatus()
        })
      })
      document.querySelectorAll('.wizard-step').forEach(b=>b.addEventListener('click',()=>{
        const target=Number(b.dataset.step)
        const blocker=firstBlockingIndex()
        if(!stepApplicable(target)) return
        if(!activeSupplyIsReadOnly() && target>blocker){
          showWizardError('Dieser Schritt ist noch gesperrt. Bitte zuerst abschließen:',[wizardSteps[blocker].name])
          return
        }
        goWizard(target)
      }))
      $('wizardBack').addEventListener('click',()=>goWizard(previousApplicableIndex(wizardIndex)))
      $('wizardNext').addEventListener('click',advanceWizard)
      $('newSupplyOverviewButton').addEventListener('click',startNewSupply)
      $('rxFile').addEventListener('change',handleRxFile)
      $('rxCameraFile').addEventListener('change',handleRxFile)
      $('repairPhotoFiles').addEventListener('change',e=>handleRepairPhotos(e.target.files))
      $('repairPhotoCamera').addEventListener('change',e=>handleRepairPhotos(e.target.files))
      $('repairLabelFiles').addEventListener('change',e=>handleRepairLabelPhotos(e.target.files))
      $('repairLabelCamera').addEventListener('change',e=>handleRepairLabelPhotos(e.target.files))
      syncCaseKind()
      renderRepairPhotos()
      renderRepairLabelPhotos()
      syncRxPresence()
    }

    function syncRxPresence(){
      const present=values.rxPresent || $('rxPresent')?.value || ''
      const yes=present==='Ja'
      const no=present==='Nein'
      $('rxYesPanel')?.classList.toggle('hidden',!yes)
      $('rxNoPanel')?.classList.toggle('hidden',!no)
      if($('rxNeededHint')) $('rxNeededHint').textContent=isRepairCase()
        ?'Bei Reparaturen ist dieser Text optional, wenn keine Verordnung vorliegt.'
        :'Pflichtangabe, solange keine Verordnung vorhanden ist.'
      if(yes) values.rxNeededText=''
      if(no){
        values.rxText=''
        values.rxFileCaptured=false
        values.rxFileName=''
        values.rxFileType=''
        values.rxOcrAt=''
      }
      if(yes && values.rxFileCaptured && $('ocrStatus')){
        $('ocrStatus').className='status-card ready'
        $('ocrStatus').textContent='Rezept wurde erfasst'+(values.rxFileName?' ('+values.rxFileName+')':'')+'. OCR-Text bitte fachlich prüfen.'
        $('rxFileName').textContent=(values.rxFileName||'Rezeptdatei')+' · Datei selbst wird nicht im Browser-Autosave gespeichert.'
      }
    }

    async function recognizeImageSource(source){
      const tesseractModule=await import('./vendor/tesseract/tesseract.esm.min.js')
      const createWorker=tesseractModule.createWorker
        || tesseractModule.default?.createWorker
        || (typeof tesseractModule.default==='function'?tesseractModule.default:null)
      if(typeof createWorker!=='function') throw new Error('Lokale OCR-Laufzeit konnte nicht initialisiert werden.')
      const worker=await createWorker('deu',1,{
        workerPath:new URL('./vendor/tesseract/worker.min.js',import.meta.url).href,
        corePath:new URL('./vendor/tesseract/core/',import.meta.url).href,
        langPath:new URL('./vendor/tesseract/lang',import.meta.url).href,
        workerBlobURL:false,
        logger:m=>{
          if(m.status==='recognizing text' && $('ocrStatus')){
            $('ocrStatus').textContent='OCR läuft … '+Math.round((m.progress||0)*100)+' %'
          }
        }
      })
      try{
        const result=await worker.recognize(source)
        const data=result?.data||{}
        return {
          text:data.text||'',
          words:Array.isArray(data.words)?data.words:[],
          width:Number(data.imageSize?.width)||Number(source?.width)||0,
          height:Number(data.imageSize?.height)||Number(source?.height)||0
        }
      }finally{
        await worker.terminate()
      }
    }

    const RX_OCR_MAX_PIXELS=12000000
    const RX_OCR_MAX_SIDE=3500
    const RX_IMAGE_MAX_DECODE_PIXELS=50000000

    async function pdfFirstPageToCanvas(file){
      const pdfjs=await import('./vendor/pdfjs/pdf.min.mjs')
      pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.min.mjs',import.meta.url).href
      const bytes=new Uint8Array(await file.arrayBuffer())
      const pdf=await pdfjs.getDocument({data:bytes}).promise
      const page=await pdf.getPage(1)
      const base=page.getViewport({scale:1})
      const basePixels=Math.max(1,base.width*base.height)
      const safeScale=Math.min(
        2,
        RX_OCR_MAX_SIDE/Math.max(base.width,base.height,1),
        Math.sqrt(RX_OCR_MAX_PIXELS/basePixels)
      )
      if(!Number.isFinite(safeScale) || safeScale<=0.1){
        throw new Error('PDF-Seitenformat ist für die lokale OCR zu groß.')
      }
      const viewport=page.getViewport({scale:safeScale})
      const canvas=document.createElement('canvas')
      canvas.width=Math.ceil(viewport.width)
      canvas.height=Math.ceil(viewport.height)
      const ctx=canvas.getContext('2d',{willReadFrequently:true})
      await page.render({canvasContext:ctx,viewport}).promise
      return canvas
    }

    async function imageFileToCanvas(file){
      const bmp=await createImageBitmap(file)
      try{
        const sourcePixels=Math.max(1,(Number(bmp.width)||0)*(Number(bmp.height)||0))
        if(sourcePixels>RX_IMAGE_MAX_DECODE_PIXELS){
          throw new Error('Bildauflösung ist für die lokale OCR zu groß.')
        }
        const scale=Math.min(
          1,
          RX_OCR_MAX_SIDE/Math.max(bmp.width,bmp.height,1),
          Math.sqrt(RX_OCR_MAX_PIXELS/sourcePixels)
        )
        const width=Math.max(1,Math.round(bmp.width*scale))
        const height=Math.max(1,Math.round(bmp.height*scale))
        const canvas=document.createElement('canvas')
        canvas.width=width
        canvas.height=height
        const ctx=canvas.getContext('2d',{willReadFrequently:true})
        ctx.drawImage(bmp,0,0,width,height)
        return canvas
      }finally{
        bmp.close?.()
      }
    }

    function normalizeRxDate(value){
      const m=String(value||'').match(/\b(0?[1-9]|[12]\d|3[01])[.\/-](0?[1-9]|1[0-2])[.\/-](\d{2}|\d{4})\b/)
      if(!m) return ''
      let y=m[3]; if(y.length===2) y='20'+y
      return y+'-'+String(m[2]).padStart(2,'0')+'-'+String(m[1]).padStart(2,'0')
    }

    function setRecognizedField(key,value,overwrite=false){
      value=String(value||'').trim()
      if(!value) return
      if(!overwrite && String(values[key]||'').trim()) return
      values[key]=value
      syncCaseFieldControls(key,value)
      if(['patientFirstName','patientLastName','patientBirthDate','insuredNo'].includes(key)) updateCareFields()
    }

    function extractAfterLabel(text,labelPattern,digitsPattern){
      const m=String(text||'').match(new RegExp(labelPattern+'[^A-Z0-9]{0,18}('+digitsPattern+')','i'))
      return m?m[1]:''
    }

    function rxWordCenter(word){
      const b=word?.bbox||{}
      const x0=Number(b.x0)||0,y0=Number(b.y0)||0,x1=Number(b.x1)||0,y1=Number(b.y1)||0
      return {x:(x0+x1)/2,y:(y0+y1)/2}
    }

    function rxWordsInRegion(ocr,x0,y0,x1,y1){
      const w=Math.max(Number(ocr?.width)||1,1),h=Math.max(Number(ocr?.height)||1,1)
      return (ocr?.words||[]).filter(word=>{
        const p=rxWordCenter(word)
        const nx=p.x/w,ny=p.y/h
        return nx>=x0&&nx<=x1&&ny>=y0&&ny<=y1
      }).sort((a,b)=>{
        const ay=rxWordCenter(a).y,by=rxWordCenter(b).y
        if(Math.abs(ay-by)>12) return ay-by
        return rxWordCenter(a).x-rxWordCenter(b).x
      })
    }

    function rxRegionText(ocr,x0,y0,x1,y1){
      const words=rxWordsInRegion(ocr,x0,y0,x1,y1)
      if(!words.length) return ''
      let out='',lastY=null
      words.forEach(word=>{
        const y=rxWordCenter(word).y
        if(lastY!==null && Math.abs(y-lastY)>14) out+='\n'
        else if(out && !out.endsWith('\n')) out+=' '
        out+=String(word.text||'')
        lastY=y
      })
      return out.replace(/[ \t]+\n/g,'\n').trim()
    }

    function digitsOnly(value){ return String(value||'').replace(/\D/g,'') }

    function findNineDigitNumber(text){
      const compact=String(text||'').replace(/[OQ]/gi,'0').replace(/[Il|]/g,'1')
      const m=compact.match(/(?:\d[\s.-]?){9}/)
      if(!m) return ''
      const d=digitsOnly(m[0])
      return d.length===9?d:''
    }

    function findKvnr(text){
      const compact=String(text||'').toUpperCase().replace(/\s+/g,' ')
      const m=compact.match(/\b[A-Z]\s*\d(?:[\s.-]?\d){8}\b/)
      if(!m) return ''
      return m[0].replace(/[\s.-]/g,'')
    }

    function cleanDoctorBlock(text){
      return String(text||'')
        .split('\n').map(x=>x.replace(/\s+/g,' ').trim())
        .filter(Boolean)
        .filter(x=>!/^(Betriebsstätten|Arzt[- ]?Nr|Datum|BSNR|LANR)$/i.test(x))
    }

    function parsePrescriptionByGeometry(ocr){
      const result={}
      if(!ocr?.words?.length || !ocr.width || !ocr.height) return result

      // Layout based on the provided Musterrezept (Muster 16-like structure):
      // insured block left/middle, identifier row in middle, doctor stamp lower right, free Rx text below OP.
      const insuredBlock=rxRegionText(ocr,0.03,0.16,0.58,0.54)
      const idRow=rxRegionText(ocr,0.02,0.45,0.80,0.67)
      const bsnrBlock=rxRegionText(ocr,0.28,0.47,0.46,0.66)
      const lanrBlock=rxRegionText(ocr,0.45,0.47,0.63,0.66)
      const dateBlock=rxRegionText(ocr,0.62,0.47,0.79,0.66)
      const doctorBlock=rxRegionText(ocr,0.68,0.55,0.99,0.99)
      const rxTextBlock=rxRegionText(ocr,0.03,0.57,0.67,0.97)

      result.insuredNo=findKvnr(insuredBlock) || findKvnr(idRow)

      // Explicit spatial priority: BSNR left of Arzt-Nr.; LANR is Arzt-Nr.
      result.bsnr=findNineDigitNumber(bsnrBlock)
      result.lanr=findNineDigitNumber(lanrBlock)

      // Date sits next to Arzt-Nr. in the middle identifier row.
      const dm=dateBlock.match(/\b(?:0?[1-9]|[12]\d|3[01])[.\/-](?:0?[1-9]|1[0-2])[.\/-](?:\d{2}|\d{4})\b/)
      result.date=normalizeRxDate(dm?.[0]||'')

      // Doctor/practice details are read from the lower-right stamp/signature area.
      const doctorLines=cleanDoctorBlock(doctorBlock)
      if(doctorLines.length){
        const addressLines=doctorLines.filter(l=>/\b\d{5}\b/.test(l)||/(straße|str\.|weg|platz|allee|gasse|chaussee|ring)\b/i.test(l))
        const doctorLinesOnly=doctorLines.filter(l=>!addressLines.includes(l))
        result.doctor=doctorLinesOnly.slice(0,3).join(' · ')
        result.address=addressLines.slice(0,3).join(' · ')
      }

      // Prescription text is typically the large free-text field below "OP".
      let rxLines=String(rxTextBlock||'').split('\n').map(x=>x.trim()).filter(Boolean)
      const opIndex=rxLines.findIndex(l=>/^OP\b|\bOP\b/i.test(l))
      if(opIndex>=0) rxLines=rxLines.slice(opIndex+1)
      rxLines=rxLines.filter(l=>!/(Krankenkasse|Versicherten|Betriebsstätten|Arzt[- ]?Nr|Datum|Status|Geb\.?\s*am)/i.test(l))
      result.rxText=rxLines.join('\n').trim()

      return result
    }

    function parsePrescriptionOcr(ocr){
      const text=typeof ocr==='string'?ocr:String(ocr?.text||'')
      const clean=text.replace(/\r/g,'')
      const lines=clean.split('\n').map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean)
      const result=parsePrescriptionByGeometry(typeof ocr==='string'?null:ocr)

      result.bsnr=result.bsnr||extractAfterLabel(clean,'(?:BSNR|Betriebsstätten(?:-?Nr\.?|nummer)?)','\\d{9}')
      result.lanr=result.lanr||extractAfterLabel(clean,'(?:LANR|Arzt[- ]?Nr\.?|Arztnummer)','\\d{9}')
      result.insuredNo=result.insuredNo||findKvnr(clean)

      if(!result.date){
        const labelledDate=clean.match(/(?:Ausstellungsdatum|Verordnungsdatum|Rezeptdatum|Datum)\D{0,20}((?:0?[1-9]|[12]\d|3[01])[.\/-](?:0?[1-9]|1[0-2])[.\/-](?:\d{2}|\d{4}))/i)
        const anyDate=clean.match(/\b(?:0?[1-9]|[12]\d|3[01])[.\/-](?:0?[1-9]|1[0-2])[.\/-](?:\d{2}|\d{4})\b/)
        result.date=normalizeRxDate(labelledDate?.[1]||anyDate?.[0]||'')
      }

      const hmvs=[...clean.matchAll(/\b\d{2}\.\d{2}\.\d{2}\.\d{3,4}\b/g)].map(m=>m[0])
      result.hmv=[...new Set(hmvs)].join(', ')

      if(!result.doctor) result.doctor=lines.find(l=>/(?:\bDr\.?\b|Praxis|MVZ|Arzt|Ärztin|Ärzte)/i.test(l) && l.length<120)||''
      if(!result.address) result.address=lines.find(l=>/\b\d{5}\s+[A-Za-zÄÖÜäöüß-]{2,}/.test(l) || /(straße|str\.|weg|platz|allee|gasse|chaussee|ring)\b/i.test(l))||''

      if(!result.rxText){
        const opIndex=lines.findIndex(l=>/^OP\b|\bOP\b/i.test(l))
        if(opIndex>=0){
          result.rxText=lines.slice(opIndex+1,Math.min(lines.length,opIndex+9))
            .filter(l=>!/(BSNR|LANR|Versichert|Krankenkasse|Geburtsdatum|Arzt[- ]?Nr|Betriebsstätten)/i.test(l)).join('\n')
        }
      }
      if(!result.rxText){
        const rxIndex=lines.findIndex(l=>/(Verordnung|Hilfsmittel|Hilfsmitteltext|Bezeichnung des Hilfsmittels)/i.test(l))
        if(rxIndex>=0) result.rxText=lines.slice(rxIndex,Math.min(lines.length,rxIndex+6))
          .filter(l=>!/(BSNR|LANR|Versichert|Krankenkasse|Geburtsdatum)/i.test(l)).join('\n')
      }

      return result
    }

    function applyPrescriptionOcr(ocr){
      const text=typeof ocr==='string'?ocr:String(ocr?.text||'')
      const parsed=parsePrescriptionOcr(ocr)
      values.rxOcrRaw=text
      const raw=$('rxOcrRaw'); if(raw) raw.value=values.rxOcrRaw
      setRecognizedField('rxDoctor',parsed.doctor)
      setRecognizedField('rxPracticeAddress',parsed.address)
      setRecognizedField('rxDate',parsed.date)
      setRecognizedField('rxBsnr',parsed.bsnr)
      setRecognizedField('rxLanr',parsed.lanr)
      setRecognizedField('rxHmvPositions',parsed.hmv)
      setRecognizedField('insuredNo',parsed.insuredNo)
      setRecognizedField('rxText',parsed.rxText)
      const kassen=[...new Set(data.kassen.map(x=>x.Kasse_Kanonisch).filter(Boolean))]
      if(!$('careKasse').value){
        const hay=norm(text)
        const found=kassen.find(k=>hay.includes(norm(k)))
        if(found){$('careKasse').value=found;updateCare()}
      }
    }

    async function handleRxFile(e){
      const file=e.target.files?.[0]
      if(!file){
        $('rxFileName').textContent='Foto, Bild oder PDF auswählen. Die OCR läuft lokal im Browser; die Datei wird nicht an die Fachdatenbank übertragen.'
        return
      }
      $('rxFileName').textContent=file.name+' · '+Math.max(1,Math.round(file.size/1024))+' KB · lokale OCR'
      $('ocrStatus').className='status-card open'
      $('ocrStatus').textContent='OCR wird vorbereitet …'
      try{
        if(file.size>15*1024*1024) throw new Error('Datei ist größer als 15 MB.')
        if(file.type && file.type!=='application/pdf' && !file.type.startsWith('image/')) throw new Error('Nicht unterstützter Dateityp.')
        const source=file.type==='application/pdf'?await pdfFirstPageToCanvas(file):await imageFileToCanvas(file)
        const ocr=await recognizeImageSource(source)
        const text=String(ocr?.text||'').trim()
        values.rxFileCaptured=true
        values.rxFileName=file.name||'Kameraaufnahme'
        values.rxFileType=file.type||'image/*'
        values.rxOcrAt=new Date().toISOString()
        applyPrescriptionOcr(ocr)
        $('ocrStatus').className=text?'status-card ready':'status-card open'
        $('ocrStatus').textContent=text?'OCR abgeschlossen. Rezeptbereiche wurden positionsbezogen ausgewertet: Versichertennummer, BSNR, LANR/Arztnummer, Verordnungsdatum, Arzt/Praxis und Verordnungstext wurden soweit erkennbar übernommen. Bitte fachlich prüfen.':'OCR abgeschlossen, aber kein Text erkannt. Bitte Verordnungsdaten manuell erfassen.'
        updateWizardStatus()
      }catch(err){
        console.error('OCR error',err)
        $('ocrStatus').className='status-card open'
        values.rxFileCaptured=true
        values.rxFileName=file.name||'Kameraaufnahme'
        values.rxFileType=file.type||''
        values.rxOcrAt=new Date().toISOString()
        $('ocrStatus').textContent=(err?.message||'OCR konnte nicht abgeschlossen werden.')+' Bitte Rezepttext manuell erfassen und prüfen.'
        updateWizardStatus()
      }
    }

    function advanceWizard(){
      showWizardError('')
      if(activeSupplyIsReadOnly()){
        const next=nextApplicableIndex(wizardIndex)
        if(next!==wizardIndex) goWizard(next)
        return
      }
      const result=validateStep(wizardIndex)
      if(!result.ok){
        showWizardError('Bitte diesen Arbeitsschritt zuerst vollständig bearbeiten:',result.missing)
        return
      }
      const next=nextApplicableIndex(wizardIndex)
      if(next===wizardIndex){updateWizardStatus();return}
      goWizard(next)
    }

    function goWizard(index){
      if(index<0||index>=wizardSteps.length) return
      if(!stepApplicable(index)) return
      const blocker=firstBlockingIndex()
      if(!activeSupplyIsReadOnly() && index>blocker){
        showWizardError('Dieser Schritt ist noch gesperrt. Bitte zuerst abschließen:',[wizardSteps[blocker].name])
        return
      }
      wizardIndex=index
      showWizardError('')
      renderWizard()
      window.scrollTo({top:0,behavior:'smooth'})
    }

    function renderWizard(){
      syncWizardBranchLabels()
      if(!stepApplicable(wizardIndex)){
        const n=nextApplicableIndex(wizardIndex)
        wizardIndex=n!==wizardIndex?n:previousApplicableIndex(wizardIndex)
      }
      const blocker=firstBlockingIndex()
      const readOnly=activeSupplyIsReadOnly()
      document.querySelectorAll('.wizard-step').forEach((b,i)=>{
        const applicable=stepApplicable(i)
        const done=applicable && validateStep(i).ok && i<blocker
        const locked=applicable && !readOnly && i>blocker
        b.classList.toggle('active',i===wizardIndex)
        b.classList.toggle('done',done)
        b.classList.toggle('skipped',!applicable)
        b.classList.toggle('locked',locked)
        b.disabled=!applicable || locked
        b.title=!applicable?'Für diese Versorgung nicht erforderlich':locked?'Zuerst '+wizardSteps[blocker].name+' abschließen':''
      })
      document.querySelectorAll('.wizard-panel').forEach((p,i)=>p.classList.toggle('active',i===wizardIndex))
      $('wizardBack').disabled=previousApplicableIndex(wizardIndex)===wizardIndex
      const next=nextApplicableIndex(wizardIndex)
      $('wizardNext').textContent=next===wizardIndex?'Status prüfen':'Weiter →'
      updateWizardStatus(false)
    }

    function updateWizardStatus(rerender=true){
      const blocker=firstBlockingIndex()
      const applicable=wizardSteps.map((_,i)=>stepApplicable(i))
      const complete=wizardSteps.map((_,i)=>applicable[i]&&validateStep(i).ok)
      const total=applicable.filter(Boolean).length
      const count=complete.filter(Boolean).length
      applyRuntimeStyle($('wizardProgressBar'),'progress',{width:Math.round((count/Math.max(total,1))*100)+'%'})
      $('wizardProgressText').textContent=count+' von '+total+' relevanten Arbeitsschritten vollständig'
      const context=[]
      const patient=([values.patientFirstName,values.patientLastName].filter(Boolean).join(' ')||values.patientName||values.caseNumber)
      if(patient) context.push('<span class="pill blue">'+escapeHtml(patient)+'</span>')
      if($('careKasse').value) context.push('<span class="pill">'+escapeHtml($('careKasse').value)+'</span>')
      if($('carePg').value) context.push('<span class="pill">PG '+escapeHtml($('carePg').value)+'</span>')
      if(selectedHimi()) context.push('<span class="pill blue">'+escapeHtml(selectedHimi())+'</span>')
      if(values.caseKind) context.push('<span class="pill">'+escapeHtml(values.caseKind)+'</span>')
      if(values.supplyType && values.supplyType!==values.caseKind) context.push('<span class="pill">'+escapeHtml(values.supplyType)+'</span>')
      if(activeSupplyIsReadOnly()) context.push('<span class="pill warning">Nur Lesen</span>')
      $('wizardContext').innerHTML=context.length?context.join(''):'<span class="pill">Neuer Vorgang</span>'

      const missing=wizardSteps.filter((_,i)=>applicable[i]&&!complete[i]).map(x=>x.name)
      updateArchiveButtonState(missing)
      const box=$('finalStatusBox')
      if(box){
        if(!missing.length){
          box.className='status-card ready'
          box.innerHTML='<strong>Anamnese im Assistenten vollständig bearbeitet</strong>Alle für Version 0.9 relevanten Arbeitsschritte sind vollständig. Abrechnung und Kalkulation sind in dieser Version nicht Bestandteil der Oberfläche.'
        }else{
          box.className='status-card open'
          box.innerHTML='<strong>Noch '+missing.length+' relevante Arbeitsschritte offen</strong>'+escapeHtml(missing.slice(0,5).join(' · '))+(missing.length>5?' …':'')+'<br><small>Nicht erforderliche Schritte werden automatisch übersprungen.</small>'
        }
      }

      const ph=$('profileHint')
      if(ph && !isRepairCase()){
        // Do not overwrite the mandatory bilateral/source-specific AOK warning
        // on each wizard status change or during PDF form rendering.
        if($('carePg').value==='24' && isAokCase() && selectedHimiId()){
          updateAokPg24ProfileHint()
        }else{
          ph.innerHTML=requiresProfile()
            ?'<strong>Profilerhebung erforderlich</strong>'+(isAokCase()?'Die AOK-/Vertragslogik wird verwendet; vorhandene Pflichtfelder müssen vollständig sein.':'Der hinterlegte PG-Erhebungsbogen muss bearbeitet werden.')
            :'<strong>Für diesen Versorgungspfad nicht erforderlich</strong>Der Schritt wird im Ablauf automatisch übersprungen.'
        }
      }

      queueAutosaveSupply()
      if(rerender){
        const readOnly=activeSupplyIsReadOnly()
        document.querySelectorAll('.wizard-step').forEach((b,i)=>{
          const isApp=applicable[i]
          const done=isApp&&complete[i]&&i<blocker
          const locked=isApp&&!readOnly&&i>blocker
          b.classList.toggle('done',done)
          b.classList.toggle('skipped',!isApp)
          b.classList.toggle('locked',locked)
          b.disabled=!isApp||locked
        })
      }
    }

    function activeSupplyRecord(){
      return activeSupplyId?readSupplyDrafts().find(x=>x.id===activeSupplyId)||null:null
    }

    function activeSupplyIsReadOnly(){
      // Team access is enforced by MFA and the server-side member allowlist,
      // not by the care-case creator's user ID.
      return !!activeSupplyId && !currentSession?.user?.id
    }

    function supplyHasEditableContext(){
      return !!activeSupplyId && !!currentSession?.user?.id && !activeSupplyIsReadOnly()
    }

    function archiveMissingSteps(){
      if(!supplyHasEditableContext()) return ['bearbeitbarer Vorgang']
      return wizardSteps
        .filter((_,i)=>stepApplicable(i) && !validateStep(i).ok)
        .map(step=>step.name)
    }

    function updateArchiveButtonState(){
      const button=$('archiveSupplyButton')
      if(!button) return
      button.classList.remove('hidden')
      button.removeAttribute('aria-hidden')
      button.removeAttribute('tabindex')
      // Archive Edge Functions still enforce the original owner and are being
      // migrated separately (P0 / issue #12). Do not expose a broken action
      // to the team until the server also supports shared archive operations.
      const archiveSupported=supplyHasEditableContext()
        && activeSupplyRecord()?.ownerUserId===currentSession?.user?.id
      const missing=archiveSupported?archiveMissingSteps():['Archiv-Backend für Teamzugriff ausstehend']
      button.disabled=!archiveSupported || missing.length>0
      button.title=!archiveSupported
        ? 'Archivierung fremder Vorgänge wird serverseitig noch umgestellt.'
        : missing.length
          ? 'Archivierung nach vollständiger v0.9-Dokumentation: '+missing.slice(0,3).join(' · ')
          : 'Vollständig dokumentierten Vorgang geschützt archivieren.'
    }

    function updateSupplyEditState(){
      const hasContext=!!activeSupplyId
      const editable=supplyHasEditableContext()
      document.querySelectorAll('#careView input,#careView select,#careView textarea').forEach(el=>{
        if(['newSupplyButton'].includes(el.id)) return
        const linkedSelect=el.dataset.profileLinked==='true' && el.tagName==='SELECT'
        el.disabled=!editable || linkedSelect
        if(el.dataset.profileLinked==='true' && 'readOnly' in el && el.tagName!=='SELECT') el.readOnly=true
      })
      if($('clearButton')) $('clearButton').disabled=!editable
      document.querySelectorAll('#careView .signature-pad-clear').forEach(el=>{el.disabled=!editable})
      document.querySelectorAll('#careView .signature-pad canvas').forEach(el=>{el.setAttribute('aria-disabled',editable?'false':'true')})
      updateArchiveButtonState()
      if($('printButton')) $('printButton').disabled=!hasContext
      if($('readOnlyBanner')) $('readOnlyBanner').classList.toggle('hidden',!activeSupplyIsReadOnly())
      document.querySelectorAll('.wizard-step').forEach(el=>{ if(!hasContext) el.disabled=true })
      if($('wizardNext')) $('wizardNext').disabled=!hasContext
    }

    async function archiveActiveSupply(){
      if(!supplyHasEditableContext()) return
      if(activeSupplyRecord()?.ownerUserId!==currentSession?.user?.id){
        showWizardError('Die Archivierung durch andere Teammitglieder ist serverseitig noch nicht freigeschaltet.')
        return
      }
      const missing=archiveMissingSteps()
      if(missing.length){
        showWizardError('Archivierung ist erst nach vollständiger v0.9-Dokumentation möglich:',missing)
        updateArchiveButtonState()
        return
      }
      const patient=([values.patientFirstName,values.patientLastName].filter(Boolean).join(' ')||values.patientName||values.caseNumber||'diese Versorgung')
      if(!window.confirm('Versorgung „'+patient+'“ extern archivieren? Der aktuelle Stand, die Revisionshistorie und zugehörige Bilder werden nach Prüfsummenprüfung in das geschützte EU-Archiv übertragen und anschließend aus dem operativen Bestand entfernt.')) return

      const button=$('archiveSupplyButton')
      const oldText=button?.textContent||'Archivieren'
      if(button){button.disabled=true;button.textContent='Archivierung …'}
      showWizardError('')

      try{
        const saved=await persistActiveSupplyNow()
        if(!saved) throw new Error('Der aktuelle Stand konnte vor der Archivierung nicht gespeichert werden.')

        const result=await supabase.functions.invoke('archive-care-case',{body:{care_case_id:activeSupplyId}})
        if(result.error){
          let detail=result.error.message||'Archivierungsdienst nicht erreichbar.'
          try{
            const context=result.error.context
            if(context?.json){
              const body=await context.json()
              if(body?.detail) detail=body.detail
              else if(body?.error) detail=body.error
            }
          }catch(_){}
          throw new Error(detail)
        }
        if(!result.data?.ok) throw new Error(result.data?.error||'Archivierung wurde nicht bestätigt.')

        const archivedId=activeSupplyId
        supplyDraftCache=supplyDraftCache.filter(x=>x.id!==archivedId)
        activeSupplyId=null
        lastPersistedSupplyFingerprint=''
        renderSupplyOverview()
        await loadArchiveOverview()
        resetWizard()
        setView('supplyOverview')
        if(result.data?.cleanup_complete===false){
          showError('appError','Archivierung wurde verifiziert; bei der lokalen Speicherbereinigung besteht noch ein Restfehler. Die Archivkopie ist vorhanden.')
        }else{
          showError('appError','')
        }
      }catch(err){
        console.error(err)
        showWizardError('Archivierung fehlgeschlagen. Die Versorgung bleibt im operativen Bestand.',[err?.message||String(err)])
      }finally{
        if(button){button.textContent=oldText;updateSupplyEditState()}
      }
    }

    function clearCurrentSupplyInputs(){
      if(!supplyHasEditableContext()) return
      Object.keys(values).forEach(k=>delete values[k])
      document.querySelectorAll('[data-case-field]').forEach(el=>{if(el.type==='checkbox'||el.type==='radio')el.checked=false;else el.value=''})
      $('careKasse').value=''
      $('carePg').value=''
      values.himiId=''
      $('careHimi').innerHTML='<option value="">Bitte zuerst PG wählen</option>'
      $('careForm').innerHTML='<option value="">Automatisch nach PG + Himi + Kasse</option>'
      $('fieldList').innerHTML=''
      $('fieldInfo').textContent='Kasse und Produktgruppe auswählen, um den passenden Erhebungsbogen aus der hinterlegten Formularlogik zu laden.'
      $('ruleBox').classList.add('hidden')
      $('rxFile').value=''
      $('rxCameraFile').value=''
      if($('repairPhotoFiles')) $('repairPhotoFiles').value=''
      if($('repairPhotoCamera')) $('repairPhotoCamera').value=''
      if($('repairLabelFiles')) $('repairLabelFiles').value=''
      if($('repairLabelCamera')) $('repairLabelCamera').value=''
      renderRepairPhotos()
      renderRepairLabelPhotos()
      $('rxFileName').textContent='Foto, Bild oder PDF auswählen. Die OCR läuft lokal im Browser; die Datei wird nicht an die Fachdatenbank übertragen.'
      $('ocrStatus').className='status-card open'
      $('ocrStatus').textContent='Noch keine Rezeptdatei ausgewählt.'
      if($('rxOcrRaw')) $('rxOcrRaw').value=''
      values.rxFileCaptured=false
      values.rxFileName=''
      values.rxFileType=''
      values.rxOcrAt=''
      syncCaseKind()
      wizardIndex=0
      showWizardError('')
      renderWizard()
      lastPersistedSupplyFingerprint=''
      void autosaveSupplyDraft(true)
      renderSupplyOverview()
      updateSupplyEditState()
    }

    function startNewSupply(){
      if(activeSupplyId) void autosaveSupplyDraft()
      activeSupplyId=(crypto.randomUUID?crypto.randomUUID():'versorgung-'+Date.now()+'-'+Math.random().toString(16).slice(2))
      Object.keys(values).forEach(k=>delete values[k])
      document.querySelectorAll('[data-case-field]').forEach(el=>{if(el.type==='checkbox'||el.type==='radio')el.checked=false;else el.value=''})
      $('careKasse').value=''
      $('carePg').value=''
      values.himiId=''
      $('careHimi').innerHTML='<option value="">Bitte zuerst PG wählen</option>'
      $('careForm').innerHTML='<option value="">Automatisch nach PG + Himi + Kasse</option>'
      $('fieldList').innerHTML=''
      $('fieldInfo').textContent='Kasse und Produktgruppe auswählen, um den passenden Erhebungsbogen aus der hinterlegten Formularlogik zu laden.'
      $('ruleBox').classList.add('hidden')
      $('rxFile').value=''
      $('rxCameraFile').value=''
      if($('repairPhotoFiles')) $('repairPhotoFiles').value=''
      if($('repairPhotoCamera')) $('repairPhotoCamera').value=''
      if($('repairLabelFiles')) $('repairLabelFiles').value=''
      if($('repairLabelCamera')) $('repairLabelCamera').value=''
      renderRepairPhotos()
      renderRepairLabelPhotos()
      $('rxFileName').textContent='Foto, Bild oder PDF auswählen. Die OCR läuft lokal im Browser; die Datei wird nicht an die Fachdatenbank übertragen.'
      $('ocrStatus').className='status-card open'
      $('ocrStatus').textContent='Noch keine Rezeptdatei ausgewählt.'
      if($('rxOcrRaw')) $('rxOcrRaw').value=''
      values.rxFileCaptured=false
      values.rxFileName=''
      values.rxFileType=''
      values.rxOcrAt=''
      syncCaseKind()
      wizardIndex=0
      showWizardError('')
      setView('care')
      renderWizard()
      updateSupplyEditState()
    }

    function resetWizard(){
      void autosaveSupplyDraft()
      activeSupplyId=null
      Object.keys(values).forEach(k=>delete values[k])
      document.querySelectorAll('[data-case-field]').forEach(el=>{if(el.type==='checkbox'||el.type==='radio')el.checked=false;else el.value=''})
      $('careKasse').value=''
      $('carePg').value=''
      values.himiId=''
      $('careHimi').innerHTML='<option value="">Bitte zuerst PG wählen</option>'
      $('careForm').innerHTML='<option value="">Automatisch nach PG + Himi + Kasse</option>'
      $('fieldList').innerHTML=''
      $('fieldInfo').textContent='Kasse und Produktgruppe auswählen, um den passenden Erhebungsbogen aus der hinterlegten Formularlogik zu laden.'
      $('ruleBox').classList.add('hidden')
      $('rxFile').value=''
      $('rxCameraFile').value=''
      if($('repairPhotoFiles')) $('repairPhotoFiles').value=''
      if($('repairPhotoCamera')) $('repairPhotoCamera').value=''
      if($('repairLabelFiles')) $('repairLabelFiles').value=''
      if($('repairLabelCamera')) $('repairLabelCamera').value=''
      renderRepairPhotos()
      renderRepairLabelPhotos()
      $('rxFileName').textContent='Foto, Bild oder PDF auswählen. Die OCR läuft lokal im Browser; die Datei wird nicht an die Fachdatenbank übertragen.'
      $('ocrStatus').className='status-card open'
      $('ocrStatus').textContent='Noch keine Rezeptdatei ausgewählt.'
      if($('rxOcrRaw')) $('rxOcrRaw').value=''
      values.rxFileCaptured=false
      values.rxFileName=''
      values.rxFileType=''
      values.rxOcrAt=''
      syncCaseKind()
      wizardIndex=0
      showWizardError('')
      renderWizard()
      updateSupplyEditState()
    }

    $('loginForm').addEventListener('submit',async(event)=>{
      event.preventDefault(); showError('loginError','')
      const username=$('username').value.trim().toLowerCase()
      if(!/^[a-z0-9._-]{1,64}$/.test(username)){
        showError('loginError','Anmeldung fehlgeschlagen.')
        return
      }
      $('loginButton').disabled=true
      const result=await supabase.auth.signInWithPassword({
        email:username+'@versorgungsassistent.test',
        password:$('password').value
      })
      $('loginButton').disabled=false
      if(result.error){
        $('password').value=''
        showError('loginError','Anmeldung fehlgeschlagen.')
        return
      }
      $('password').value=''
      await handleSession(result.data.session)
    })

    $('verifyButton').addEventListener('click',async()=>{
      showError('mfaError','')
      const code=$('otp').value.trim()
      if(code.length<6){ showError('mfaError','Bitte den aktuellen Authenticator-Code eingeben.'); return }
      $('verifyButton').disabled=true
      const challenge=await supabase.auth.mfa.challenge({factorId})
      if(challenge.error){ $('verifyButton').disabled=false; showError('mfaError',challenge.error.message); return }
      const verify=await supabase.auth.mfa.verify({factorId,challengeId:challenge.data.id,code})
      $('verifyButton').disabled=false
      if(verify.error){ showError('mfaError',verify.error.message); return }
      $('otp').value=''
      const {data:{session}}=await supabase.auth.getSession()
      await openApp(session)
    })

    $('logoutButton').addEventListener('click',async()=>{await supabase.auth.signOut(); location.reload()})
    $('formSearch').addEventListener('input',e=>renderForms(e.target.value))
    $('pg26Kasse').addEventListener('change',renderPg26)
    $('careKasse').addEventListener('change',()=>{values.formId='';updateCare();showWizardError('');renderWizard()})
    $('carePg').addEventListener('change',()=>{values.himiId='';values.formId='';populateHimiOptions();updateCare();showWizardError('');renderWizard()})
    $('careHimi').addEventListener('change',()=>{values.himiId=$('careHimi').value;values.formId='';syncPg24Level();syncSituationFields();updateCare();showWizardError('');renderWizard()})
    $('careForm').addEventListener('change',()=>{values.formId=$('careForm').value||'';updateCareFields();showWizardError('');renderWizard();queueAutosaveSupply()})
    $('printButton').addEventListener('click',()=>{
      if($('carePg').value==='24' && isAokCase() && values.side==='beidseitig'){
        const documents=[...$('fieldList').querySelectorAll('[data-aok-pdf-side]')]
        if(documents.length!==2 || documents.some(d=>d.dataset.pdfReady!=='true')){
          showWizardError('Beide AOK-Originalbögen müssen vor dem Drucken vollständig geladen sein.')
          return
        }
      }
      window.print()
    })
    $('archiveSupplyButton').addEventListener('click',archiveActiveSupply)
    $('clearButton').addEventListener('click',clearCurrentSupplyInputs)
    $('profileAiMode').addEventListener('change',()=>{
      profileGuidedTarget=null;profileGuidedIndex=-1;renderProfileAiSuggestions([])
      const guided=$('profileAiMode').value==='guided'
      $('profileAiNext').disabled=!guided
      $('profileAiQuestion').innerHTML=guided?'<strong>Geführte Abfrage</strong><span>„Nächste offene Frage“ wählen.</span>':'<strong>Freies Gespräch</strong><span>Gespräch aufnehmen oder vorhandenes Transkript einfügen. Eindeutige Angaben werden anschließend als Vorschläge angezeigt.</span>'
    })
    $('profileAiNext').addEventListener('click',()=>selectProfileGuidedQuestion(true))
    $('profileAiStart').addEventListener('click',()=>startProfileAiRecording('profile'))
    $('measureTranscriptRecord')?.addEventListener('click',()=>startProfileAiRecording('measure'))
    $('measureTranscriptStop')?.addEventListener('click',stopProfileAiRecording)
    $('profileAiStop').addEventListener('click',stopProfileAiRecording)
    $('profileAiAnalyze').addEventListener('click',analyzeProfileAiTranscript)
    $('profileAiApply').addEventListener('click',applyProfileAiSuggestions)
    $('profileAiClear').addEventListener('click',resetProfileAiUi)
    $('measureTranscriptAnalyze')?.addEventListener('click',analyzeMeasureTranscript)
    $('measureTranscriptApply')?.addEventListener('click',applyMeasureTranscript)
    $('supplySearch').addEventListener('input',renderSupplyOverview)
    $('supplyStatusFilter').addEventListener('change',renderSupplyOverview)
    $('supplyPgFilter').addEventListener('change',renderSupplyOverview)
    $('supplyOverviewBody').addEventListener('click',e=>{const row=e.target.closest('[data-supply-id]');if(row)restoreSupplyDraft(row.dataset.supplyId)})
    $('supplyOverviewBody').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-supply-id]')){e.preventDefault();restoreSupplyDraft(e.target.dataset.supplyId)}})
    if($('archiveRefreshButton')) $('archiveRefreshButton').addEventListener('click',()=>loadArchiveOverview())
    if($('archiveOverviewBody')) $('archiveOverviewBody').addEventListener('click',e=>{
      const button=e.target.closest('[data-archive-restore]')
      if(button) restoreArchivedSupply(button.dataset.archiveRestore,button)
    })

    document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)))
    $('knowledgeSearch').addEventListener('input',e=>renderContractKnowledge(e.target.value))
    $('contractQuestionForm').addEventListener('submit',submitContractQuestion)

    supabase.auth.onAuthStateChange((event,session)=>{
      if(event==='SIGNED_OUT'){
        stopIdleSessionGuard()
        clearSensitiveRuntimeState()
        showLogin()
      }
      currentSession=session
    })

    start()
