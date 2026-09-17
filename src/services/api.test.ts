import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, clearApiTokens, setApiTokens } from './api'

describe('API client', () => {
  beforeEach(() => { clearApiTokens(); localStorage.clear(); vi.restoreAllMocks() })

  it('reads the signed-in profile through the protected current-user endpoint', async () => {
    setApiTokens({ access_token: 'profile-access-token', refresh_token: 'refresh-token' })
    const profile = {
      id: 'user-1', username: '000001', name: '张三',
      created_at: '2026-09-14T00:00:00Z', updated_at: '2026-09-14T00:00:00Z',
    }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(profile), { status: 200 }))

    await expect(api.currentUser()).resolves.toEqual(profile)

    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/me')
    const headers = (fetchMock.mock.calls[0][1]?.headers as Headers)
    expect(headers.get('Authorization')).toBe('Bearer profile-access-token')
    expect(headers.get('X-User-ID')).toBeNull()
  })
  it('attaches a Bearer Access Token and never sends the retired UUID header', async () => {
    setApiTokens({ access_token: 'access-token', refresh_token: 'refresh-token' })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }))
    await api.listKnowledgeBases()
    const headers = fetchMock.mock.calls[0][1]?.headers as Headers
    expect(headers.get('Authorization')).toBe('Bearer access-token')
    expect(headers.get('X-User-ID')).toBeNull()
    expect(headers.get('X-Request-ID')).toBeTruthy()
  })

  it('converts the unified backend error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: { code: 'KB_FORBIDDEN', message: '无权访问' } }), { status: 403 }))
    await expect(api.listKnowledgeBases()).rejects.toMatchObject({ code: 'KB_FORBIDDEN', message: '无权访问', status: 403 } satisfies Partial<ApiError>)
  })

  it('uses the FR-030 project endpoint and sends the real create payload', async () => {
    setApiTokens({ access_token: 'project-access-token', refresh_token: 'refresh-token' })
    const project = { id: 'project-1', name: '演示项目', description: null, uses_demo_checklist: true, active_document_count: 0, version: 1, created_at: '2026-08-06T00:00:00Z', updated_at: '2026-08-06T00:00:00Z' }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(project), { status: 201 }))

    await api.createArchiveProject({ name: '演示项目', description: null, use_demo_checklist: true })

    expect(fetchMock.mock.calls[0][0]).toBe('/api/projects')
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ name: '演示项目', description: null, use_demo_checklist: true }))
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer project-access-token')
  })

  it('uses the FR-039 retrieval and question endpoints with exact payloads', async () => {
    setApiTokens({ access_token: 'fr039-access-token', refresh_token: 'refresh-token' })
    const retrieval = { items: [], requested_top_k: 8, returned_count: 0 }
    const answer = { answer_status: 'REFUSED_NO_EVIDENCE', answer: '当前正式档案没有足够证据。', citations: [] }
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(retrieval), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(answer), { status: 200 }))

    await expect(api.retrieveArchives('project-1', { query: '合同签订日期', top_k: 8 })).resolves.toEqual(retrieval)
    await expect(api.askArchiveQuestion('project-1', { question: '合同签订日期是什么？' })).resolves.toEqual(answer)

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/projects/project-1/archive-retrieval',
      '/api/projects/project-1/archive-questions',
    ])
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('POST')
    expect((fetchMock.mock.calls[0][1] as RequestInit).body).toBe(JSON.stringify({ query: '合同签订日期', top_k: 8 }))
    expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe('POST')
    expect((fetchMock.mock.calls[1][1] as RequestInit).body).toBe(JSON.stringify({ question: '合同签订日期是什么？' }))
    for (const [, init] of fetchMock.mock.calls) {
      expect((init?.headers as Headers).get('Authorization')).toBe('Bearer fr039-access-token')
      expect((init?.headers as Headers).get('X-User-ID')).toBeNull()
    }
  })

  it('uses the FR-031 checklist read endpoint within the selected project scope', async () => {
    setApiTokens({ access_token: 'checklist-access-token', refresh_token: 'refresh-token' })
    const checklist = {
      items: [{
        id: 'item-1',
        name: '施工方案',
        document_type: 'CONSTRUCTION',
        is_required: true,
        project_stage: 'CONSTRUCTION',
        description: '包含关键工序说明。',
        fulfillment_status: 'MISSING',
        confirmed_document_count: 0,
        version: 1,
      }],
    }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(checklist), { status: 200 }))

    await expect(api.listChecklistItems('project-1')).resolves.toEqual(checklist)

    expect(fetchMock.mock.calls[0][0]).toBe('/api/projects/project-1/checklist-items')
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.method).toBeUndefined()
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer checklist-access-token')
    expect((init.headers as Headers).get('X-User-ID')).toBeNull()
  })

  it('uses the FR-031 create endpoint with the project version required by the backend', async () => {
    setApiTokens({ access_token: 'checklist-access-token', refresh_token: 'refresh-token' })
    const payload = {
      name: '施工方案',
      document_type: 'CONSTRUCTION' as const,
      is_required: true,
      project_stage: 'CONSTRUCTION' as const,
      description: null,
      expected_project_version: 3,
    }
    const response = {
      item: {
        id: 'item-1',
        ...payload,
        fulfillment_status: 'MISSING',
        confirmed_document_count: 0,
        version: 1,
      },
      project_version: 4,
    }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(response), { status: 201 }))

    await expect(api.createChecklistItem('project-1', payload)).resolves.toEqual(response)

    expect(fetchMock.mock.calls[0][0]).toBe('/api/projects/project-1/checklist-items')
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify(payload))
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer checklist-access-token')
  })

  it('uses the FR-031 update endpoint with the checklist item version', async () => {
    setApiTokens({ access_token: 'checklist-access-token', refresh_token: 'refresh-token' })
    const payload = { description: '已补充满足条件。', expected_version: 1 }
    const response = {
      id: 'item-1',
      name: '施工方案',
      document_type: 'CONSTRUCTION',
      is_required: true,
      project_stage: 'CONSTRUCTION',
      description: payload.description,
      fulfillment_status: 'MISSING',
      confirmed_document_count: 0,
      version: 2,
    }
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(response), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(response), { status: 200 }))

    await expect(api.updateChecklistItem('project-1', 'item-1', payload)).resolves.toEqual(response)

    expect(fetchMock.mock.calls[0][0]).toBe('/api/projects/project-1/checklist-items/item-1')
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.method).toBe('PATCH')
    expect(init.body).toBe(JSON.stringify(payload))
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer checklist-access-token')
  })

  it('uses the FR-031 delete endpoint without inventing a client-side authorization field', async () => {
    setApiTokens({ access_token: 'checklist-access-token', refresh_token: 'refresh-token' })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))

    await expect(api.deleteChecklistItem('project-1', 'item-1')).resolves.toBeUndefined()

    expect(fetchMock.mock.calls[0][0]).toBe('/api/projects/project-1/checklist-items/item-1')
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.method).toBe('DELETE')
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer checklist-access-token')
    expect((init.headers as Headers).get('X-User-ID')).toBeNull()
  })

  it('uploads an FR-032 document with the only allowed multipart field', async () => {
    setApiTokens({ access_token: 'document-access-token', refresh_token: 'refresh-token' })
    const response = {
      id: 'document-1',
      filename: '施工方案.txt',
      file_hash: 'a'.repeat(64),
      status: 'UPLOADED',
      last_error: { code: null, message: null },
      field_summary: { checked_count: 0, total_count: 0 },
      confirmed_at: null,
      version: 1,
      uploaded_at: '2026-08-27T00:00:00Z',
      updated_at: '2026-08-27T00:00:00Z',
    }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(response), { status: 201 }))
    const file = new File(['虚构施工方案'], '施工方案.txt', { type: 'text/plain' })

    await expect(api.uploadProjectDocument('project-1', file)).resolves.toEqual(response)

    expect(fetchMock.mock.calls[0][0]).toBe('/api/projects/project-1/documents')
    const init = fetchMock.mock.calls[0][1] as RequestInit
    const body = init.body as FormData
    expect(init.method).toBe('POST')
    expect(body).toBeInstanceOf(FormData)
    expect(Array.from(body.keys())).toEqual(['file'])
    expect(body.get('file')).toBe(file)
    expect((init.headers as Headers).get('Content-Type')).toBeNull()
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer document-access-token')
    expect((init.headers as Headers).get('X-User-ID')).toBeNull()
  })

  it('reads the project-scoped document processing page without using an internal knowledge-base ID', async () => {
    setApiTokens({ access_token: 'document-access-token', refresh_token: 'refresh-token' })
    const response = { items: [], page: 1, page_size: 20, total: 0 }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }))

    await expect(api.listProjectDocuments('project-1')).resolves.toEqual(response)

    expect(fetchMock.mock.calls[0][0]).toBe('/api/projects/project-1/documents?page=1&page_size=20')
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer document-access-token')
    expect((init.headers as Headers).get('X-User-ID')).toBeNull()
  })

  it('uses the FR-040 project document delete endpoint with no request body', async () => {
    setApiTokens({ access_token: 'document-access-token', refresh_token: 'refresh-token' })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))

    await expect(api.deleteProjectDocument('project-1', 'document-1')).resolves.toBeUndefined()

    expect(fetchMock.mock.calls[0][0]).toBe('/api/projects/project-1/documents/document-1')
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.method).toBe('DELETE')
    expect(init.body).toBeUndefined()
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer document-access-token')
    expect((init.headers as Headers).get('X-User-ID')).toBeNull()
  })

  it('encodes document processing status and pagination exactly', async () => {
    setApiTokens({ access_token: 'document-access-token', refresh_token: 'refresh-token' })
    const response = { items: [], page: 2, page_size: 10, total: 11 }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }))

    await api.listProjectDocuments('project-1', 2, 10, 'PARSED')

    expect(fetchMock.mock.calls[0][0]).toBe('/api/projects/project-1/documents?page=2&page_size=10&status=PARSED')
  })

  it('encodes only selected archive filters and reads archive detail separately', async () => {
    setApiTokens({ access_token: 'archive-access-token', refresh_token: 'refresh-token' })
    const response = { items: [], page: 1, page_size: 20, total: 0 }
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(response), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'document-1', fields: [] }), { status: 200 }))

    await api.listArchives('project-1', 3, 5, {
      document_type: 'CONTRACT',
      document_date_from: '2026-01-01',
      document_date_is_null: true,
      authoring_organization: '甲方建设单位',
    })
    await api.getArchiveDetail('project-1', 'document-1')

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/projects/project-1/archives?page=3&page_size=5&document_type=CONTRACT&document_date_from=2026-01-01&document_date_is_null=true&authoring_organization=%E7%94%B2%E6%96%B9%E5%BB%BA%E8%AE%BE%E5%8D%95%E4%BD%8D',
      '/api/projects/project-1/archives/document-1',
    ])
  })

  it('reads FR-041 audit logs with pagination and only selected operation type', async () => {
    setApiTokens({ access_token: 'audit-access-token', refresh_token: 'refresh-token' })
    const response = { items: [], page: 2, page_size: 5, total: 11 }
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(response), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(response), { status: 200 }))

    await expect(api.listAuditLogs('project-1', 2, 5, 'DOCUMENT_DELETED')).resolves.toEqual(response)
    await expect(api.listAuditLogs('project-1')).resolves.toEqual(response)
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/projects/project-1/audit-logs?page=2&page_size=5&operation_type=DOCUMENT_DELETED',
      '/api/projects/project-1/audit-logs?page=1&page_size=20',
    ])
  })

  it('uses the FR-033 first-parse endpoint without adding a request body', async () => {
    setApiTokens({ access_token: 'document-access-token', refresh_token: 'refresh-token' })
    const response = { id: 'document-1', status: 'PARSED' }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }))

    await expect(api.parseProjectDocument('project-1', 'document-1')).resolves.toEqual(response)

    expect(fetchMock.mock.calls[0][0]).toBe('/api/projects/project-1/documents/document-1/parse')
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.method).toBe('POST')
    expect(init.body).toBeUndefined()
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer document-access-token')
  })

  it('keeps FR-033 parse retry on its dedicated endpoint', async () => {
    setApiTokens({ access_token: 'document-access-token', refresh_token: 'refresh-token' })
    const response = { id: 'document-1', status: 'PARSED' }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }))

    await expect(api.retryProjectDocumentParse('project-1', 'document-1')).resolves.toEqual(response)

    expect(fetchMock.mock.calls[0][0]).toBe('/api/projects/project-1/documents/document-1/parse-retry')
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.method).toBe('POST')
    expect(init.body).toBeUndefined()
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer document-access-token')
  })

  it('uses the six FR-034/035 draft endpoints with their exact request bodies', async () => {
    setApiTokens({ access_token: 'draft-access-token', refresh_token: 'refresh-token' })
    const draft = { document: { id: 'document-1' }, fields: [], snapshot: null, next_actions: [] }
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response(JSON.stringify(draft), { status: 200 }))

    await api.createArchiveSuggestions('project-1', 'document-1')
    await api.retryArchiveSuggestions('project-1', 'document-1')
    await api.regenerateArchiveSuggestions('project-1', 'document-1', { expected_version: 3 })
    await api.createManualArchiveDraft('project-1', 'document-1')
    await api.getArchiveDraft('project-1', 'document-1')
    await api.updateArchiveField('project-1', 'document-1', 'TITLE', {
      text_value: '施工方案', review_status: 'VALUE_CONFIRMED',
      source: 'MANUAL', no_source_evidence: false, evidences: [], expected_version: 4,
    })

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/projects/project-1/documents/document-1/suggestions',
      '/api/projects/project-1/documents/document-1/suggestions/retry',
      '/api/projects/project-1/documents/document-1/suggestions/regenerate',
      '/api/projects/project-1/documents/document-1/manual-draft',
      '/api/projects/project-1/documents/document-1/draft',
      '/api/projects/project-1/documents/document-1/fields/TITLE',
    ])
    expect((fetchMock.mock.calls[0][1] as RequestInit).body).toBeUndefined()
    expect((fetchMock.mock.calls[1][1] as RequestInit).body).toBeUndefined()
    expect((fetchMock.mock.calls[2][1] as RequestInit).body).toBe(JSON.stringify({ expected_version: 3 }))
    expect((fetchMock.mock.calls[3][1] as RequestInit).body).toBeUndefined()
    expect((fetchMock.mock.calls[4][1] as RequestInit).body).toBeUndefined()
    expect((fetchMock.mock.calls[5][1] as RequestInit).body).toContain('expected_version')
    expect((fetchMock.mock.calls[5][1]?.headers as Headers).get('Authorization')).toBe('Bearer draft-access-token')
  })

  it('validates every FR-034/035 endpoint method, body, Bearer header, and retired-header absence', async () => {
    setApiTokens({ access_token: 'draft-access-token', refresh_token: 'refresh-token' })
    const draft = { document: { id: 'document-1' }, fields: [], snapshot: null, next_actions: [] }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify(draft), { status: 200 }))
    const cases = [
      { invoke: () => api.createArchiveSuggestions('project-1', 'document-1'), url: '/api/projects/project-1/documents/document-1/suggestions', method: 'POST', body: undefined },
      { invoke: () => api.retryArchiveSuggestions('project-1', 'document-1'), url: '/api/projects/project-1/documents/document-1/suggestions/retry', method: 'POST', body: undefined },
      { invoke: () => api.regenerateArchiveSuggestions('project-1', 'document-1', { expected_version: 3 }), url: '/api/projects/project-1/documents/document-1/suggestions/regenerate', method: 'POST', body: JSON.stringify({ expected_version: 3 }) },
      { invoke: () => api.createManualArchiveDraft('project-1', 'document-1'), url: '/api/projects/project-1/documents/document-1/manual-draft', method: 'POST', body: undefined },
      { invoke: () => api.getArchiveDraft('project-1', 'document-1'), url: '/api/projects/project-1/documents/document-1/draft', method: undefined, body: undefined },
      { invoke: () => api.updateArchiveField('project-1', 'document-1', 'TITLE', { text_value: '施工方案', review_status: 'VALUE_CONFIRMED', source: 'MANUAL', no_source_evidence: false, evidences: [], expected_version: 4 }), url: '/api/projects/project-1/documents/document-1/fields/TITLE', method: 'PUT', body: JSON.stringify({ text_value: '施工方案', review_status: 'VALUE_CONFIRMED', source: 'MANUAL', no_source_evidence: false, evidences: [], expected_version: 4 }) },
    ]

    for (const expected of cases) {
      fetchMock.mockClear()
      await expected.invoke()
      const init = fetchMock.mock.calls[0][1] as RequestInit
      const headers = init.headers as Headers
      expect(fetchMock.mock.calls[0][0]).toBe(expected.url)
      expect(init.method).toBe(expected.method)
      expect(init.body).toBe(expected.body)
      expect(headers.get('Authorization')).toBe('Bearer draft-access-token')
      expect(headers.get('X-User-ID')).toBeNull()
    }
  })

  it('refreshes an expired Access Token once before retrying a protected request', async () => {
    setApiTokens({ access_token: 'expired-access-token', refresh_token: 'refresh-token' })
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'TOKEN_EXPIRED', message: '认证令牌已过期。' } }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'renewed-access-token', token_type: 'bearer', access_expires_in: 1800 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))

    await api.listKnowledgeBases()

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/knowledge-bases', '/api/auth/refresh', '/api/knowledge-bases'])
    expect((fetchMock.mock.calls[2][1]?.headers as Headers).get('Authorization')).toBe('Bearer renewed-access-token')
  })

  it('uses the FR-036 confirm and cancel endpoints with only the current version', async () => {
    setApiTokens({ access_token: 'confirm-access-token', refresh_token: 'refresh-token' })
    const response = {
      id: 'document-1', filename: '施工方案.txt', file_hash: 'a'.repeat(64), status: 'CONFIRMED',
      last_error: { code: null, message: null }, field_summary: { checked_count: 7, total_count: 7 },
      confirmed_at: '2026-08-27T00:10:00Z', version: 5, uploaded_at: '2026-08-27T00:00:00Z', updated_at: '2026-08-27T00:10:00Z',
      index_context_chunk_count: 12,
    }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify(response), { status: 200 }))

    await api.confirmArchiveDocument('project-1', 'document-1', { expected_version: 7 })
    await api.cancelArchiveDocumentConfirmation('project-1', 'document-1', { expected_version: 8 })

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/projects/project-1/documents/document-1/confirm',
      '/api/projects/project-1/documents/document-1/cancel-confirmation',
    ])
    for (const [index, body] of [JSON.stringify({ expected_version: 7 }), JSON.stringify({ expected_version: 8 })].entries()) {
      const init = fetchMock.mock.calls[index][1] as RequestInit
      const headers = init.headers as Headers
      expect(init.method).toBe('POST')
      expect(init.body).toBe(body)
      expect(headers.get('Authorization')).toBe('Bearer confirm-access-token')
      expect(headers.get('X-User-ID')).toBeNull()
    }
  })

  it('uses the FR-037 checklist link endpoints with exact URLs, methods, and version body', async () => {
    setApiTokens({ access_token: 'link-access-token', refresh_token: 'refresh-token' })
    const suggestionResponse = { items: [{ checklist_item_id: 'item-1', name: '施工方案', document_type: 'CONSTRUCTION', project_stage: 'CONSTRUCTION', is_required: true, already_linked: false }] }
    const linksResponse = { items: [{ id: 'link-1', document_id: 'document-1', checklist_item_id: 'item-1', status: 'INVALIDATED', confirmed_by: null, confirmed_at: null, invalidated_at: '2026-09-10T00:00:00Z', invalidated_reason: '清单项版本变更。', version: 2 }] }
    const createdResponse = { ...linksResponse.items[0], status: 'CONFIRMED', version: 3 }
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(suggestionResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(linksResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(createdResponse), { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    await api.listChecklistLinkSuggestions('project-1', 'document-1')
    await api.listChecklistLinks('project-1', 'document-1')
    await api.createChecklistLink('project-1', 'document-1', {
      checklist_item_id: 'item-1', expected_document_version: 12, expected_checklist_item_version: 4,
    })
    await api.deleteChecklistLink('project-1', 'document-1', 'link-1')

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/projects/project-1/documents/document-1/checklist-link-suggestions',
      '/api/projects/project-1/documents/document-1/checklist-links',
      '/api/projects/project-1/documents/document-1/checklist-links',
      '/api/projects/project-1/documents/document-1/checklist-links/link-1',
    ])
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBeUndefined()
    expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBeUndefined()
    expect((fetchMock.mock.calls[2][1] as RequestInit).method).toBe('POST')
    expect((fetchMock.mock.calls[2][1] as RequestInit).body).toBe(JSON.stringify({ checklist_item_id: 'item-1', expected_document_version: 12, expected_checklist_item_version: 4 }))
    expect((fetchMock.mock.calls[3][1] as RequestInit).method).toBe('DELETE')
    for (const [, init] of fetchMock.mock.calls) expect((init?.headers as Headers).get('Authorization')).toBe('Bearer link-access-token')
  })

  it('uses the four FR-042 project archive agent endpoints without client scope fields', async () => {
    setApiTokens({ access_token: 'archive-agent-access-token', refresh_token: 'refresh-token' })
    const session = {
      id: 'session-1', project_id: 'project-1',
      created_at: '2026-09-17T00:00:00Z', updated_at: '2026-09-17T00:00:00Z',
    }
    const response = {
      session_id: 'session-1', answer_status: 'ANSWERED', answer: '签订日期为 2026-01-02。',
      citations: [{ filename: '合同.txt', location_type: 'TEXT_LINE_RANGE', location_start: 2, location_end: 2, excerpt: '签订日期：2026-01-02' }],
      request_id: 'request-1',
    }
    const history = [
      { role: 'USER', content: '合同签订日期是什么？', citations: [] },
      { role: 'ASSISTANT', content: response.answer, citations: response.citations },
    ]
    const toolCalls = [{
      id: 'log-1', tool_call_id: 'call-1', tool_name: 'search_confirmed_archive_evidence', status: 'COMPLETED',
      arguments_summary: { query_provided: true, query_length: 8 }, result_summary: { found: true, result_count: 1 }, duration_ms: 12,
      error_code: null, created_at: '2026-09-17T00:00:01Z', updated_at: '2026-09-17T00:00:01Z',
    }]
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(session), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(response), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(history), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(toolCalls), { status: 200 }))

    await expect(api.createArchiveAgentSession('project-1')).resolves.toEqual(session)
    await expect(api.sendArchiveAgentMessage('project-1', 'session-1', { message: '合同签订日期是什么？' })).resolves.toEqual(response)
    await expect(api.listArchiveAgentMessages('project-1', 'session-1')).resolves.toEqual(history)
    await expect(api.listArchiveAgentToolCalls('project-1', 'session-1')).resolves.toEqual(toolCalls)

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/projects/project-1/agent-sessions',
      '/api/projects/project-1/agent-sessions/session-1/messages',
      '/api/projects/project-1/agent-sessions/session-1/messages',
      '/api/projects/project-1/agent-sessions/session-1/tool-calls',
    ])
    const [createInit, sendInit, historyInit, toolCallsInit] = fetchMock.mock.calls.map(([, init]) => init as RequestInit)
    expect(createInit.method).toBe('POST')
    expect(createInit.body).toBe(JSON.stringify({}))
    expect(sendInit.method).toBe('POST')
    expect(sendInit.body).toBe(JSON.stringify({ message: '合同签订日期是什么？' }))
    expect(historyInit.method).toBeUndefined()
    expect(toolCallsInit.method).toBeUndefined()
    for (const init of [createInit, sendInit, historyInit, toolCallsInit]) {
      expect((init.headers as Headers).get('Authorization')).toBe('Bearer archive-agent-access-token')
      expect((init.headers as Headers).get('X-User-ID')).toBeNull()
    }
  })
})
