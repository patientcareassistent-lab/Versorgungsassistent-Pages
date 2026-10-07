async function installSupabaseMock(page, options = {}) {
  const mode = options.mode || 'signed-in'
  await page.addInitScript(({ mode }) => {
    const SESSION = {
      user: {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'mitarbeiter3@versorgungsassistent.test'
      }
    }
    let session = mode === 'signed-in' ? SESSION : null
    let aal = mode === 'signed-in' ? 'aal2' : 'aal1'
    const rowKey = 'va:e2e:mock-care-cases'

    const readRows = () => {
      try {
        const parsed = JSON.parse(localStorage.getItem(rowKey) || '[]')
        return Array.isArray(parsed) ? parsed : []
      } catch (_) {
        return []
      }
    }
    const writeRows = rows => localStorage.setItem(rowKey, JSON.stringify(rows))
    const normalizeRows = payload => Array.isArray(payload) ? payload : [payload]

    function makeQueryBuilder(table) {
      let operation = 'select'
      let payload = null
      let filters = []
      let limitValue = null

      const builder = {
        select() { return builder },
        neq(column, value) { filters.push({ type: 'neq', column, value }); return builder },
        eq(column, value) { filters.push({ type: 'eq', column, value }); return builder },
        order() { return builder },
        limit(value) { limitValue = Number(value) || null; return builder },
        upsert(value) { operation = 'upsert'; payload = value; return builder },
        insert(value) { operation = 'insert'; payload = value; return builder },
        update(value) { operation = 'update'; payload = value; return builder },
        delete() { operation = 'delete'; return builder },
        single() {
          const result = execute()
          return Promise.resolve({
            data: Array.isArray(result.data) ? (result.data[0] || null) : result.data,
            error: result.error || null
          })
        },
        maybeSingle() { return builder.single() },
        then(resolve, reject) { return Promise.resolve(execute()).then(resolve, reject) }
      }

      function applyFilters(rows) {
        let result = rows.slice()
        for (const filter of filters) {
          if (filter.type === 'neq') result = result.filter(row => String(row?.[filter.column] ?? '') !== String(filter.value))
          if (filter.type === 'eq') result = result.filter(row => String(row?.[filter.column] ?? '') === String(filter.value))
        }
        if (limitValue) result = result.slice(0, limitValue)
        return result
      }

      function execute() {
        if (operation === 'upsert') {
          const incoming = normalizeRows(payload)
          if (table === 'care_cases') {
            const rows = readRows()
            incoming.forEach(item => {
              const index = rows.findIndex(row => row.id === item.id)
              if (index >= 0) rows[index] = { ...rows[index], ...item }
              else rows.push({ ...item })
            })
            writeRows(rows)
          }
          return { data: incoming, error: null }
        }

        if (operation === 'insert') {
          const incoming = normalizeRows(payload).map((item, index) => ({
            id: item?.id || 'mock-insert-' + Date.now() + '-' + index,
            created_at: item?.created_at || new Date().toISOString(),
            ...item
          }))
          return { data: incoming, error: null }
        }

        if (table === 'care_case_overview' || table === 'care_cases') {
          const rows = readRows().map(row => ({
            ...row,
            patient_first_name: row.payload?.patientFirstName || '',
            patient_last_name: row.payload?.patientLastName || '',
            patient_name: row.payload?.patientName || '',
            case_number: row.payload?.caseNumber || '',
            insured_no: row.payload?.insuredNo || '',
            case_kind: row.payload?.caseKind || ''
          }))
          return { data: applyFilters(rows), error: null }
        }

        return { data: [], error: null }
      }

      return builder
    }

    const rpcPayloads = {
      current_access: [{ allowed: true, aal: 'aal2' }],
      care_reference_bootstrap: {
        kassen: [{ Kasse_Kanonisch: 'AOK Baden-Württemberg' }],
        produktgruppen: [
          { PG: '10', Generisches_Blatt: 'Regressionstest PG10', Reifegrad: 'TEST' },
          { PG: '24', Generisches_Blatt: 'Regressionstest PG24', Reifegrad: 'TEST' }
        ],
        sourceCount: 1,
        formCount: 1
      },
      himi_logic_for_pg: [],
      forms_for_pg: [],
      form_fields_for_pg: [],
      measure_fields_for_profile: [],
      himi_form_rules_for_himi: [],
      sources_reference_bootstrap: [],
      forms_reference_bootstrap: [],
      pg26_reference_bootstrap: { pg26: [], kalk: [] },
      contract_knowledge_bootstrap: { contractQuestions: [], contractKnowledge: [], approvedKnowledge: [] }
    }

    const client = {
      auth: {
        async getSession() { return { data: { session }, error: null } },
        async signInWithPassword({ email }) {
          session = { ...SESSION, user: { ...SESSION.user, email } }
          aal = 'aal1'
          return { data: { session }, error: null }
        },
        async signOut() { session = null; aal = 'aal1'; return { error: null } },
        onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } } },
        mfa: {
          async getAuthenticatorAssuranceLevel() {
            return { data: { currentLevel: aal, nextLevel: 'aal2' }, error: null }
          },
          async listFactors() {
            return { data: { totp: [{ id: 'factor-e2e', status: 'verified', friendly_name: 'E2E' }] }, error: null }
          },
          async enroll() { return { data: null, error: { message: 'Enrollment is not used in this regression mock.' } } },
          async challenge() { return { data: { id: 'challenge-e2e' }, error: null } },
          async verify() { aal = 'aal2'; return { data: {}, error: null } }
        }
      },
      rpc(name) {
        const data = Object.prototype.hasOwnProperty.call(rpcPayloads, name) ? rpcPayloads[name] : []
        return Promise.resolve({ data, error: null })
      },
      from(table) { return makeQueryBuilder(table) },
      storage: {
        from() {
          return {
            async upload(path) { return { data: { path }, error: null } },
            async remove() { return { data: [], error: null } },
            async createSignedUrl(path) { return { data: { signedUrl: 'data:text/plain,' + encodeURIComponent(path) }, error: null } },
            getPublicUrl(path) { return { data: { publicUrl: 'data:text/plain,' + encodeURIComponent(path) } } }
          }
        }
      }
    }

    Object.defineProperty(window, 'supabase', {
      configurable: true,
      get() { return undefined },
      set(realLibrary) {
        realLibrary.createClient = () => client
        Object.defineProperty(window, 'supabase', {
          configurable: true,
          writable: true,
          value: realLibrary
        })
      }
    })
  }, { mode })
}

module.exports = { installSupabaseMock }
