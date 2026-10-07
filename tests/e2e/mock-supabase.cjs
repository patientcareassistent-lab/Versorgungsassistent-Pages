async function installSupabaseMock(page, options = {}) {
  const mode = options.mode || 'signed-in'
  const failBootstrap = options.failBootstrap === true
  const failCases = options.failCases === true
  const denyPreMfa = options.denyPreMfa === true
  await page.addInitScript(({ mode, failBootstrap, failCases, denyPreMfa }) => {
    const SESSION = {
      user: {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'e2e-user@versorgungsassistent.test'
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
      let rangeValue = null

      const builder = {
        select() { return builder },
        neq(column, value) { filters.push({ type: 'neq', column, value }); return builder },
        eq(column, value) { filters.push({ type: 'eq', column, value }); return builder },
        order() { return builder },
        limit(value) { limitValue = Number(value) || null; return builder },
        range(from, to) { rangeValue = [Number(from) || 0, Number(to) || 0]; return builder },
        upsert(value) {
          operation = 'upsert'
          payload = value
          if (table === 'care_cases' && localStorage.getItem('va:e2e:fail-next-care-upsert') === '1') {
            localStorage.removeItem('va:e2e:fail-next-care-upsert')
            operation = 'upsert-fail'
          } else if (table === 'care_cases') {
            const rows = readRows()
            normalizeRows(value).forEach(item => {
              const index = rows.findIndex(row => row.id === item.id)
              if (index >= 0) rows[index] = { ...rows[index], ...item }
              else rows.push({ ...item })
            })
            writeRows(rows)
          }
          return builder
        },
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
        if (rangeValue) result = result.slice(rangeValue[0], rangeValue[1] + 1)
        if (limitValue) result = result.slice(0, limitValue)
        return result
      }

      function execute() {
        if (operation === 'upsert-fail') {
          return { data: null, error: { message: 'simulated care case save failure' } }
        }

        if (operation === 'upsert') {
          return { data: normalizeRows(payload), error: null }
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
          if (failCases && operation === 'select') {
            return { data: null, error: { message: 'simulated care case load failure' } }
          }
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
        if (name === 'mfa_enrollment_access') {
          return Promise.resolve({ data: !denyPreMfa, error: null })
        }
        if (failBootstrap && name === 'care_reference_bootstrap') {
          return Promise.resolve({ data: null, error: { message: 'simulated bootstrap failure' } })
        }
        const data = Object.prototype.hasOwnProperty.call(rpcPayloads, name) ? rpcPayloads[name] : []
        return Promise.resolve({ data, error: null })
      },
      from(table) { return makeQueryBuilder(table) },
      storage: {
        from() {
          const readStoragePaths = () => {
            try {
              const parsed = JSON.parse(localStorage.getItem('va:e2e:mock-storage-paths') || '[]')
              return Array.isArray(parsed) ? parsed : []
            } catch (_) { return [] }
          }
          const writeStoragePaths = paths => localStorage.setItem('va:e2e:mock-storage-paths', JSON.stringify(paths))
          return {
            async upload(path) {
              writeStoragePaths([...new Set([...readStoragePaths(), path])])
              return { data: { path }, error: null }
            },
            async remove(paths) {
              const removeSet = new Set(paths || [])
              writeStoragePaths(readStoragePaths().filter(path => !removeSet.has(path)))
              localStorage.setItem('va:e2e:last-storage-remove', JSON.stringify(paths || []))
              return { data: [], error: null }
            },
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
  }, { mode, failBootstrap, failCases, denyPreMfa })
}

module.exports = { installSupabaseMock }
