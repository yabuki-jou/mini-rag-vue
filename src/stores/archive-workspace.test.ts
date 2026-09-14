import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ApiError, api } from '../services/api'
import type { ArchiveAuditPage, ArchiveDraft, ArchiveDetail, ArchivePage, ArchiveSummary, ProcessDocument } from '../types'
import { useArchiveWorkspaceStore } from './archive-workspace'

vi.mock('../services/api', async (original) => {
  const module = await original<typeof import('../services/api')>()
  return {
    ...module,
    api: {
      ...module.api,
      register: vi.fn(),
      login: vi.fn(),
      refreshSession: vi.fn(),
      logout: vi.fn(),
      listArchiveProjects: vi.fn(),
      createArchiveProject: vi.fn(),
      updateArchiveProject: vi.fn(),
      deleteArchiveProject: vi.fn(),
      listChecklistItems: vi.fn(),
      createChecklistItem: vi.fn(),
      updateChecklistItem: vi.fn(),
      deleteChecklistItem: vi.fn(),
      listProjectDocuments: vi.fn(),
      deleteProjectDocument: vi.fn(),
      listArchives: vi.fn(),
      listAuditLogs: vi.fn(),
      getArchiveDetail: vi.fn(),
      uploadProjectDocument: vi.fn(),
      parseProjectDocument: vi.fn(),
      retryProjectDocumentParse: vi.fn(),
      createArchiveSuggestions: vi.fn(),
      retryArchiveSuggestions: vi.fn(),
      regenerateArchiveSuggestions: vi.fn(),
      createManualArchiveDraft: vi.fn(),
      getArchiveDraft: vi.fn(),
      updateArchiveField: vi.fn(),
      confirmArchiveDocument: vi.fn(),
      cancelArchiveDocumentConfirmation: vi.fn(),
      listChecklistLinkSuggestions: vi.fn(),
      listChecklistLinks: vi.fn(),
      createChecklistLink: vi.fn(),
      deleteChecklistLink: vi.fn(),
      retrieveArchives: vi.fn(),
      askArchiveQuestion: vi.fn(),
    },
  }
})

const project = {
  id: 'project-1', name: '滨江研发中心改造项目', description: null, uses_demo_checklist: true,
  active_document_count: 0, version: 1, created_at: '2026-08-06T00:00:00Z', updated_at: '2026-08-06T00:00:00Z',
}

const checklistItem = {
  id: 'item-1', name: '施工方案', document_type: 'CONSTRUCTION' as const, is_required: true,
  project_stage: 'CONSTRUCTION' as const, description: '包含关键工序说明。',
  fulfillment_status: 'MISSING' as const, confirmed_document_count: 0, version: 1,
}

const uploadedDocument = {
  id: 'document-1', filename: '施工方案.txt', file_hash: 'a'.repeat(64), status: 'UPLOADED' as const,
  last_error: { code: null, message: null }, field_summary: { checked_count: 0, total_count: 0 },
  confirmed_at: null, version: 1, uploaded_at: '2026-08-27T00:00:00Z', updated_at: '2026-08-27T00:00:00Z',
}

const draft = {
  document: { ...uploadedDocument, status: 'PENDING_CONFIRMATION' as const, version: 2 },
  fields: [{
    id: 'field-1', field_name: 'TITLE' as const, text_value: '施工方案', date_value: null, json_value: null,
    review_status: 'PENDING_CHECK' as const, source: 'AI' as const, no_source_evidence: false,
    updated_by: null, updated_at: '2026-08-27T00:02:00Z', evidences: [],
  }],
  snapshot: null,
  next_actions: ['CHECK_FIELDS'],
} satisfies ArchiveDraft

describe('archive workspace store', () => {
  beforeEach(() => { localStorage.clear(); setActivePinia(createPinia()); vi.resetAllMocks() })

  it('loads only the current user project page and selects a stable active project', async () => {
    vi.mocked(api.listArchiveProjects).mockResolvedValue({ items: [project], page: 1, page_size: 20, total: 1 })
    const store = useArchiveWorkspaceStore()
    store.hasSession = true

    await store.loadProjects()

    expect(api.listArchiveProjects).toHaveBeenCalledOnce()
    expect(store.activeProjectId).toBe('project-1')
    expect(localStorage.getItem('archive-v1-project-id')).toBe('project-1')
  })

  it('keeps the server version in the update payload for optimistic locking', async () => {
    vi.mocked(api.updateArchiveProject).mockResolvedValue({ ...project, name: '新名称', version: 2 })
    const store = useArchiveWorkspaceStore()
    store.projects = [project]
    store.activeProjectId = project.id

    await store.updateProject(project.id, { name: '新名称', expected_version: 1 })

    expect(api.updateArchiveProject).toHaveBeenCalledWith(project.id, { name: '新名称', expected_version: 1 })
    expect(store.activeProject?.version).toBe(2)
  })

  it('logs in with the token pair and then loads the authenticated project page', async () => {
    vi.mocked(api.login).mockResolvedValue({
      access_token: 'access-token', refresh_token: 'refresh-token', token_type: 'bearer', access_expires_in: 1800, refresh_expires_in: 604800,
    })
    vi.mocked(api.listArchiveProjects).mockResolvedValue({ items: [project], page: 1, page_size: 20, total: 1 })
    const store = useArchiveWorkspaceStore()

    await store.login({ username: 'Demo_User', password: 'safe-password-123' })

    expect(api.login).toHaveBeenCalledWith({ username: 'demo_user', password: 'safe-password-123' })
    expect(store.isAuthenticated).toBe(true)
    expect(store.username).toBe('demo_user')
    expect(store.activeProjectId).toBe(project.id)
    expect(localStorage.getItem('archive-v1-access-token')).toBe('access-token')
  })

  it('loads checklist items only for the selected project', async () => {
    vi.mocked(api.listChecklistItems).mockResolvedValue({ items: [checklistItem] })
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [project]
    store.activeProjectId = project.id

    await store.loadChecklistItems()

    expect(api.listChecklistItems).toHaveBeenCalledWith(project.id)
    expect(store.checklistItems).toEqual([checklistItem])
  })

  it('uses the selected project version to create an item and keeps the server version', async () => {
    const payload = {
      name: '施工方案', document_type: 'CONSTRUCTION' as const, is_required: true,
      project_stage: 'CONSTRUCTION' as const, description: null, expected_project_version: 1,
    }
    vi.mocked(api.createChecklistItem).mockResolvedValue({ item: checklistItem, project_version: 2 })
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [project]
    store.activeProjectId = project.id

    await store.createChecklistItem(payload)

    expect(api.createChecklistItem).toHaveBeenCalledWith(project.id, payload)
    expect(store.checklistItems).toEqual([checklistItem])
    expect(store.activeProject?.version).toBe(2)
  })

  it('replaces the checklist item with the version returned by the update endpoint', async () => {
    const updatedItem = { ...checklistItem, description: '已补充满足条件。', version: 2 }
    vi.mocked(api.updateChecklistItem).mockResolvedValue(updatedItem)
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [project]
    store.activeProjectId = project.id
    store.checklistItems = [checklistItem]

    await store.updateChecklistItem(checklistItem.id, { description: updatedItem.description, expected_version: 1 })

    expect(api.updateChecklistItem).toHaveBeenCalledWith(project.id, checklistItem.id, {
      description: updatedItem.description,
      expected_version: 1,
    })
    expect(store.checklistItems).toEqual([updatedItem])
  })

  it('removes a checklist item only after the delete endpoint succeeds', async () => {
    vi.mocked(api.deleteChecklistItem).mockResolvedValue(undefined)
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [project]
    store.activeProjectId = project.id
    store.checklistItems = [checklistItem]

    await store.deleteChecklistItem(checklistItem.id)

    expect(api.deleteChecklistItem).toHaveBeenCalledWith(project.id, checklistItem.id)
    expect(store.checklistItems).toEqual([])
  })

  it('loads document processing records only for the selected project', async () => {
    vi.mocked(api.listProjectDocuments).mockResolvedValueOnce({ items: [uploadedDocument], page: 1, page_size: 20, total: 1 })
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [project]
    store.activeProjectId = project.id

    await store.loadProjectDocuments()

    expect(api.listProjectDocuments).toHaveBeenCalledWith(project.id)
    expect(store.projectDocuments).toEqual([uploadedDocument])
  })

  it('physically deletes a document from the current view and refreshes derived project state', async () => {
    vi.mocked(api.deleteProjectDocument).mockResolvedValue(undefined)
    vi.mocked(api.listProjectDocuments).mockResolvedValue({ items: [], page: 1, page_size: 20, total: 0 })
    vi.mocked(api.listChecklistItems).mockResolvedValueOnce({ items: [] })
    vi.mocked(api.listArchives).mockResolvedValueOnce({ items: [], page: 1, page_size: 20, total: 0 })
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [{ ...project, active_document_count: 1 }]
    store.activeProjectId = project.id
    store.projectDocuments = [uploadedDocument]
    store.projectDocumentTotal = 1
    store.currentDraft = draft
    store.currentArchive = { id: uploadedDocument.id, filename: uploadedDocument.filename, status: 'CONFIRMED', title: null, document_type: null, document_date: null, authoring_organization: null, project_stage: null, confirmed_at: null, version: 2, fields: [] }
    store.checklistLinkDocumentId = uploadedDocument.id
    store.archiveRetrieval = { items: [], requested_top_k: 5, returned_count: 0 }
    store.archiveAnswer = { answer_status: 'ANSWERED', answer: '旧回答', citations: [] }

    await store.deleteProjectDocument(uploadedDocument.id)

    expect(api.deleteProjectDocument).toHaveBeenCalledWith(project.id, uploadedDocument.id)
    expect(store.projectDocuments).toEqual([])
    expect(store.projectDocumentTotal).toBe(0)
    expect(store.activeProject?.active_document_count).toBe(0)
    expect(store.currentDraft).toBeNull()
    expect(store.currentArchive).toBeNull()
    expect(store.checklistLinkDocumentId).toBe('')
    expect(store.archiveRetrieval).toBeNull()
    expect(store.archiveAnswer).toBeNull()
    expect(api.listProjectDocuments).toHaveBeenCalled()
    expect(api.listChecklistItems).toHaveBeenCalledWith(project.id)
    expect(api.listArchives).toHaveBeenCalledWith(project.id, 1, 20, {})
  })

  it('moves to the previous processing page when deleting the only row on a later page', async () => {
    vi.mocked(api.deleteProjectDocument).mockResolvedValue(undefined)
    vi.mocked(api.listProjectDocuments).mockResolvedValue({ items: [uploadedDocument], page: 2, page_size: 1, total: 1 })
    vi.mocked(api.listChecklistItems).mockResolvedValue({ items: [] })
    vi.mocked(api.listArchives).mockResolvedValue({ items: [], page: 1, page_size: 20, total: 0 })
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [{ ...project, active_document_count: 2 }]
    store.activeProjectId = project.id
    store.projectDocuments = [uploadedDocument]
    store.projectDocumentPage = 2
    store.projectDocumentPageSize = 1
    store.projectDocumentTotal = 2

    await store.deleteProjectDocument(uploadedDocument.id)

    expect(api.listProjectDocuments).toHaveBeenCalledWith(project.id, 1, 1, '')
  })

  it('preserves the 503 delete error after refresh and leaves the row available for retry', async () => {
    const error = new ApiError('DOCUMENT_DELETE_INCOMPLETE', '文档删除尚未完成，请稍后重试。', 503)
    vi.mocked(api.deleteProjectDocument).mockRejectedValue(error)
    vi.mocked(api.listProjectDocuments).mockResolvedValueOnce({ items: [uploadedDocument], page: 1, page_size: 20, total: 1 })
    vi.mocked(api.listChecklistItems).mockResolvedValueOnce({ items: [] })
    vi.mocked(api.listArchives).mockResolvedValueOnce({ items: [], page: 1, page_size: 20, total: 0 })
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [{ ...project, active_document_count: 1 }]
    store.activeProjectId = project.id
    store.projectDocuments = [uploadedDocument]
    store.projectDocumentTotal = 1
    store.archiveRetrieval = { items: [], requested_top_k: 5, returned_count: 0 }
    store.archiveAnswer = { answer_status: 'ANSWERED', answer: '待清理旧回答', citations: [] }
    const retrievalRequestId = store.archiveRetrievalRequestId
    const questionRequestId = store.archiveQuestionRequestId

    await expect(store.deleteProjectDocument(uploadedDocument.id)).rejects.toBe(error)

    expect(store.projectDocuments).toEqual([uploadedDocument])
    expect(store.error).toBe(error.message)
    expect(store.errorStatus).toBe(503)
    expect(store.archiveRetrieval).toBeNull()
    expect(store.archiveAnswer).toBeNull()
    expect(store.archiveRetrievalRequestId).toBeGreaterThan(retrievalRequestId)
    expect(store.archiveQuestionRequestId).toBeGreaterThan(questionRequestId)
    expect(api.listProjectDocuments).toHaveBeenCalledWith(project.id)
    expect(api.deleteProjectDocument).toHaveBeenCalledTimes(1)
  })

  it('keeps existing retrieval and answer evidence when deletion is blocked by another operation', async () => {
    const error = new ApiError('DOCUMENT_OPERATION_IN_PROGRESS', '文档正在处理中，请稍后重试。', 409)
    const retrieval = { items: [], requested_top_k: 5, returned_count: 0 }
    const answer = { answer_status: 'ANSWERED' as const, answer: '当前项目回答', citations: [] }
    vi.mocked(api.deleteProjectDocument).mockRejectedValue(error)
    vi.mocked(api.listProjectDocuments).mockResolvedValueOnce({ items: [uploadedDocument], page: 1, page_size: 20, total: 1 })
    vi.mocked(api.listChecklistItems).mockResolvedValueOnce({ items: [] })
    vi.mocked(api.listArchives).mockResolvedValueOnce({ items: [], page: 1, page_size: 20, total: 0 })
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [{ ...project, active_document_count: 1 }]
    store.activeProjectId = project.id
    store.projectDocuments = [uploadedDocument]
    store.archiveRetrieval = retrieval
    store.archiveAnswer = answer

    await expect(store.deleteProjectDocument(uploadedDocument.id)).rejects.toBe(error)

    expect(store.archiveRetrieval).toEqual(retrieval)
    expect(store.archiveAnswer).toEqual(answer)
    expect(store.error).toBe(error.message)
    expect(store.errorStatus).toBe(409)
  })

  it('does not restore an old project delete error after switching projects during refresh', async () => {
    const error = new ApiError('DOCUMENT_DELETE_INCOMPLETE', '旧项目删除尚未完成。', 503)
    let resolveRefresh!: (value: { items: ProcessDocument[]; page: number; page_size: number; total: number }) => void
    vi.mocked(api.deleteProjectDocument).mockRejectedValue(error)
    vi.mocked(api.listProjectDocuments).mockReturnValueOnce(new Promise((resolve) => { resolveRefresh = resolve }))
    vi.mocked(api.listChecklistItems).mockResolvedValue({ items: [] })
    vi.mocked(api.listArchives).mockResolvedValue({ items: [], page: 1, page_size: 20, total: 0 })
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [project, { ...project, id: 'project-2', active_document_count: 4 }]
    store.activeProjectId = project.id
    store.projectDocuments = [uploadedDocument]

    const request = store.deleteProjectDocument(uploadedDocument.id).catch(() => undefined)
    await vi.waitFor(() => expect(resolveRefresh).toBeTypeOf('function'))
    store.selectProject('project-2')
    resolveRefresh({ items: [], page: 1, page_size: 20, total: 0 })
    await request

    expect(store.activeProjectId).toBe('project-2')
    expect(store.error).toBe('')
    expect(store.errorStatus).toBeNull()
  })

  it('does not let a completed old-project delete mutate the newly selected project', async () => {
    let resolveDelete!: () => void
    vi.mocked(api.deleteProjectDocument).mockReturnValueOnce(new Promise((resolve) => { resolveDelete = resolve }))
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [project, { ...project, id: 'project-2', active_document_count: 4 }]
    store.activeProjectId = project.id
    store.projectDocuments = [uploadedDocument]
    store.projectDocumentTotal = 1

    const request = store.deleteProjectDocument(uploadedDocument.id)
    store.selectProject('project-2')
    store.projectDocuments = [{ ...uploadedDocument, id: 'project-2-document' }]
    resolveDelete()
    await request

    expect(store.activeProjectId).toBe('project-2')
    expect(store.projectDocuments[0].id).toBe('project-2-document')
    expect(store.projects.find((item) => item.id === 'project-2')?.active_document_count).toBe(4)
  })

  it('keeps processing pagination and status filter, resetting to page one when status changes', async () => {
    vi.mocked(api.listProjectDocuments)
      .mockResolvedValueOnce({ items: [uploadedDocument], page: 2, page_size: 10, total: 11 })
      .mockResolvedValueOnce({ items: [], page: 1, page_size: 10, total: 0 })
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [project]
    store.activeProjectId = project.id

    await store.loadProjectDocuments(undefined, 2, 10)
    await store.setProjectDocumentStatus('PARSED')

    expect(api.listProjectDocuments).toHaveBeenNthCalledWith(1, project.id, 2, 10, '')
    expect(api.listProjectDocuments).toHaveBeenNthCalledWith(2, project.id, 1, 10, 'PARSED')
    expect(store.projectDocumentPage).toBe(1)
    expect(store.projectDocumentTotal).toBe(0)
  })

  it('keeps the last fast processing filter response when earlier requests finish later', async () => {
    let resolveParsed!: (value: { items: ProcessDocument[]; page: number; page_size: number; total: number }) => void
    let resolveConfirmed!: (value: { items: ProcessDocument[]; page: number; page_size: number; total: number }) => void
    vi.mocked(api.listProjectDocuments).mockImplementation((_projectId, _page, _pageSize, status) => new Promise((resolve) => {
      if (status === 'PARSED') resolveParsed = resolve
      else resolveConfirmed = resolve
    }))
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [project]
    store.activeProjectId = project.id

    const parsedRequest = store.setProjectDocumentStatus('PARSED')
    const confirmedRequest = store.setProjectDocumentStatus('CONFIRMED')
    resolveParsed({ items: [{ ...uploadedDocument, status: 'PARSED' }], page: 1, page_size: 20, total: 1 })
    resolveConfirmed({ items: [{ ...uploadedDocument, status: 'CONFIRMED' }], page: 1, page_size: 20, total: 1 })
    await Promise.all([parsedRequest, confirmedRequest])

    expect(store.projectDocuments[0].status).toBe('CONFIRMED')
    expect(store.projectDocumentStatus).toBe('CONFIRMED')
  })

  it('keeps the last fast archive filter response when earlier requests finish later', async () => {
    let resolveContract!: (value: ArchivePage) => void
    let resolveDesign!: (value: ArchivePage) => void
    vi.mocked(api.listArchives).mockImplementation((_projectId, _page, _pageSize, filters) => new Promise((resolve) => {
      if (filters?.document_type === 'CONTRACT') resolveContract = resolve
      else resolveDesign = resolve
    }))
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [project]
    store.activeProjectId = project.id

    const contractRequest = store.setArchiveFilters({ document_type: 'CONTRACT' })
    const designRequest = store.setArchiveFilters({ document_type: 'DESIGN' })
    resolveContract({ items: [{ id: 'contract', filename: '合同.pdf', status: 'CONFIRMED', title: null, document_type: 'CONTRACT', document_date: null, authoring_organization: null, project_stage: null, confirmed_at: null, version: 1 }], page: 1, page_size: 20, total: 1 })
    resolveDesign({ items: [{ id: 'design', filename: '设计.pdf', status: 'CONFIRMED', title: null, document_type: 'DESIGN', document_date: null, authoring_organization: null, project_stage: null, confirmed_at: null, version: 1 }], page: 1, page_size: 20, total: 1 })
    await Promise.all([contractRequest, designRequest])

    expect(store.archives[0].id).toBe('design')
    expect(store.archiveFilters).toEqual({ document_type: 'DESIGN' })
  })

  it('does not let an older failed processing request pollute a newer successful result', async () => {
    let rejectParsed!: (reason: unknown) => void
    let resolveConfirmed!: (value: { items: ProcessDocument[]; page: number; page_size: number; total: number }) => void
    vi.mocked(api.listProjectDocuments).mockImplementation((_projectId, _page, _pageSize, status) => new Promise((resolve, reject) => {
      if (status === 'PARSED') rejectParsed = reject
      else resolveConfirmed = resolve
    }))
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [project]
    store.activeProjectId = project.id

    const oldRequest = store.setProjectDocumentStatus('PARSED').catch(() => undefined)
    const latestRequest = store.setProjectDocumentStatus('CONFIRMED')
    resolveConfirmed({ items: [{ ...uploadedDocument, status: 'CONFIRMED' }], page: 1, page_size: 20, total: 1 })
    rejectParsed(new ApiError('OLD_REQUEST', '旧请求失败', 503))
    await Promise.all([oldRequest, latestRequest])

    expect(store.projectDocuments[0].status).toBe('CONFIRMED')
    expect(store.error).toBe('')
    expect(store.errorStatus).toBeNull()
  })

  it('does not let an older failed archive request pollute a newer successful result', async () => {
    let rejectContract!: (reason: unknown) => void
    let resolveDesign!: (value: ArchivePage) => void
    vi.mocked(api.listArchives).mockImplementation((_projectId, _page, _pageSize, filters) => new Promise((resolve, reject) => {
      if (filters?.document_type === 'CONTRACT') rejectContract = reject
      else resolveDesign = resolve
    }))
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [project]
    store.activeProjectId = project.id

    const oldRequest = store.setArchiveFilters({ document_type: 'CONTRACT' }).catch(() => undefined)
    const latestRequest = store.setArchiveFilters({ document_type: 'DESIGN' })
    resolveDesign({ items: [{ id: 'design', filename: '设计.pdf', status: 'CONFIRMED', title: null, document_type: 'DESIGN', document_date: null, authoring_organization: null, project_stage: null, confirmed_at: null, version: 1 }], page: 1, page_size: 20, total: 1 })
    rejectContract(new ApiError('OLD_REQUEST', '旧请求失败', 503))
    await Promise.all([oldRequest, latestRequest])

    expect(store.archives[0].id).toBe('design')
    expect(store.error).toBe('')
    expect(store.errorStatus).toBeNull()
  })

  it('keeps the current processing page on an unparameterized refresh', async () => {
    vi.mocked(api.listProjectDocuments).mockResolvedValue({ items: [uploadedDocument], page: 3, page_size: 10, total: 25 })
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [project]
    store.activeProjectId = project.id
    store.projectDocumentPage = 3
    store.projectDocumentPageSize = 10

    await store.loadProjectDocuments()

    expect(api.listProjectDocuments).toHaveBeenCalledWith(project.id, 3, 10, '')
  })

  it('discards an archive page response after project or filter changes', async () => {
    let resolveOld!: (value: ArchivePage) => void
    const oldRequest = new Promise<ArchivePage>((resolve) => { resolveOld = resolve })
    vi.mocked(api.listArchives).mockReturnValueOnce(oldRequest)
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [project, { ...project, id: 'project-2' }]
    store.activeProjectId = project.id

    const pending = store.loadArchives()
    store.selectProject('project-2')
    resolveOld({ items: [], page: 1, page_size: 20, total: 99 })
    await pending

    expect(store.archivePage.total).toBe(0)
    expect(store.archives).toEqual([])
  })

  it('loads audit pages with the selected operation type and keeps pagination on refresh', async () => {
    const response: ArchiveAuditPage = { items: [], page: 2, page_size: 10, total: 21 }
    vi.mocked(api.listAuditLogs).mockResolvedValue(response)
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [project]
    store.activeProjectId = project.id
    store.auditPage = { page: 2, page_size: 10, total: 21 }
    store.auditOperationType = 'DOCUMENT_DELETED'

    await store.loadAuditLogs()

    expect(api.listAuditLogs).toHaveBeenCalledWith(project.id, 2, 10, 'DOCUMENT_DELETED')
    expect(store.auditPage).toEqual({ page: response.page, page_size: response.page_size, total: response.total })
  })

  it('clears late audit responses when the project changes', async () => {
    let resolveOld!: (value: ArchiveAuditPage) => void
    const oldRequest = new Promise<ArchiveAuditPage>((resolve) => { resolveOld = resolve })
    vi.mocked(api.listAuditLogs).mockReturnValueOnce(oldRequest)
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [project, { ...project, id: 'project-2' }]
    store.activeProjectId = project.id

    const pending = store.loadAuditLogs()
    store.selectProject('project-2')
    resolveOld({ items: [{ id: 'stale', actor_id: 'user-1', operation_type: 'DOCUMENT_DELETED', resource_type: 'DOCUMENT', resource_id: 'doc-1', redacted_summary: {}, created_at: '2026-09-11T00:00:00Z' }], page: 1, page_size: 20, total: 1 })
    await pending

    expect(store.auditLogs).toEqual([])
    expect(store.auditPage.total).toBe(0)
  })

  it('does not let a late audit error pollute the newly selected project', async () => {
    let rejectOld!: (reason?: unknown) => void
    const oldRequest = new Promise<ArchiveAuditPage>((_resolve, reject) => { rejectOld = reject })
    vi.mocked(api.listAuditLogs).mockReturnValueOnce(oldRequest)
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [project, { ...project, id: 'project-2' }]
    store.activeProjectId = project.id

    const pending = store.loadAuditLogs()
    store.selectProject('project-2')
    rejectOld(new ApiError('AUDIT_FAILED', '旧项目失败', 500))
    await pending

    expect(store.error).toBe('')
    expect(store.loading.audit).toBe(false)
  })

  it('clears the selected archive detail when switching projects or selecting another archive', async () => {
    const summary: ArchiveSummary = {
      id: 'archive-1', filename: '合同.pdf', status: 'CONFIRMED', title: '施工合同', document_type: 'CONTRACT',
      document_date: '2026-01-01', authoring_organization: '甲方', project_stage: 'CONSTRUCTION',
      confirmed_at: '2026-01-02T00:00:00Z', version: 3,
    }
    const detail: ArchiveDetail = { ...summary, fields: [] }
    vi.mocked(api.listArchives).mockResolvedValue({ items: [summary], page: 1, page_size: 20, total: 1 })
    vi.mocked(api.getArchiveDetail).mockResolvedValue(detail)
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [project, { ...project, id: 'project-2' }]
    store.activeProjectId = project.id

    await store.loadArchives()
    await store.loadArchiveDetail(summary.id)
    expect(store.currentArchive?.id).toBe(summary.id)
    store.selectProject('project-2')
    expect(store.currentArchive).toBeNull()
  })

  it('adds the uploaded server document and increases the visible project count', async () => {
    const file = new File(['虚构施工方案'], '施工方案.txt', { type: 'text/plain' })
    vi.mocked(api.uploadProjectDocument).mockResolvedValue(uploadedDocument)
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [project]
    store.activeProjectId = project.id

    await store.uploadProjectDocument(file)

    expect(api.uploadProjectDocument).toHaveBeenCalledWith(project.id, file)
    expect(store.projectDocuments).toEqual([uploadedDocument])
    expect(store.activeProject?.active_document_count).toBe(1)
  })

  it('replaces the processing record with the first-parse response', async () => {
    const parsedDocument = { ...uploadedDocument, status: 'PARSED' as const, updated_at: '2026-08-27T00:01:00Z' }
    vi.mocked(api.parseProjectDocument).mockResolvedValue(parsedDocument)
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [project]
    store.activeProjectId = project.id
    store.projectDocuments = [uploadedDocument]

    await store.parseProjectDocument(uploadedDocument.id)

    expect(api.parseProjectDocument).toHaveBeenCalledWith(project.id, uploadedDocument.id)
    expect(store.projectDocuments).toEqual([parsedDocument])
  })

  it('replaces only the failed record with the dedicated parse-retry response', async () => {
    const failedDocument = { ...uploadedDocument, id: 'document-2', status: 'PARSE_FAILED' as const, last_error: { code: 'PARSE_TEXT_UNAVAILABLE', message: '没有可用文本。' } }
    const retriedDocument = { ...failedDocument, status: 'PARSED' as const, last_error: { code: null, message: null }, version: 2 }
    vi.mocked(api.retryProjectDocumentParse).mockResolvedValue(retriedDocument)
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [project]
    store.activeProjectId = project.id
    store.projectDocuments = [uploadedDocument, failedDocument]

    await store.retryProjectDocumentParse(failedDocument.id)

    expect(api.retryProjectDocumentParse).toHaveBeenCalledWith(project.id, failedDocument.id)
    expect(store.projectDocuments).toEqual([uploadedDocument, retriedDocument])
  })

  it('loads a draft and synchronizes the returned document row', async () => {
    vi.mocked(api.getArchiveDraft).mockResolvedValue(draft)
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [project]
    store.activeProjectId = project.id
    store.projectDocuments = [uploadedDocument]

    await store.loadArchiveDraft(uploadedDocument.id)

    expect(api.getArchiveDraft).toHaveBeenCalledWith(project.id, uploadedDocument.id)
    expect(store.currentDraft).toEqual(draft)
    expect(store.projectDocuments[0]).toEqual(draft.document)
  })

  it('clears the current draft when the active project changes', () => {
    const store = useArchiveWorkspaceStore()
    store.projects = [project, { ...project, id: 'project-2', name: '第二项目' }]
    store.activeProjectId = project.id
    store.currentDraft = draft

    store.selectProject('project-2')

    expect(store.currentDraft).toBeNull()
    expect(store.projectDocuments).toEqual([])
  })

  it('does not let an old project draft response overwrite the selected project', async () => {
    let resolveDraft!: (value: ArchiveDraft) => void
    vi.mocked(api.getArchiveDraft).mockReturnValueOnce(new Promise<ArchiveDraft>((resolve) => { resolveDraft = resolve }))
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [project, { ...project, id: 'project-2', name: '第二项目' }]
    store.activeProjectId = project.id

    const request = store.loadArchiveDraft(uploadedDocument.id)
    store.selectProject('project-2')
    resolveDraft(draft)
    await request

    expect(store.currentDraft).toBeNull()
  })

  it('submits a field with the draft document version and synchronizes the response', async () => {
    const updatedDraft = { ...draft, document: { ...draft.document, version: 3 } }
    vi.mocked(api.updateArchiveField).mockResolvedValue(updatedDraft)
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [project]
    store.activeProjectId = project.id
    store.projectDocuments = [uploadedDocument]
    store.currentDraft = draft
    const payload = {
      text_value: '施工方案（修订）', review_status: 'VALUE_CONFIRMED' as const,
      source: 'MANUAL' as const, no_source_evidence: false, evidences: [], expected_version: draft.document.version,
    }

    await store.updateArchiveField(uploadedDocument.id, 'TITLE', payload)

    expect(api.updateArchiveField).toHaveBeenCalledWith(project.id, uploadedDocument.id, 'TITLE', payload)
    expect(store.currentDraft).toEqual(updatedDraft)
    expect(store.projectDocuments[0]).toEqual(updatedDraft.document)
  })

  it('refreshes a persisted suggestion failure while preserving the original stable error', async () => {
    const failedDocument = { ...uploadedDocument, status: 'SUGGESTION_FAILED' as const, last_error: { code: 'SUGGESTION_FAILED', message: '建议生成失败。' }, version: 2 }
    const originalError = new ApiError('SUGGESTION_FAILED', '建议生成失败。', 422)
    vi.mocked(api.createArchiveSuggestions).mockRejectedValue(originalError)
    vi.mocked(api.listProjectDocuments).mockResolvedValue({ items: [failedDocument], page: 1, page_size: 20, total: 1 })
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [project]
    store.activeProjectId = project.id
    store.projectDocuments = [uploadedDocument]

    await expect(store.createArchiveSuggestions(uploadedDocument.id)).rejects.toBe(originalError)

    expect(api.listProjectDocuments).toHaveBeenCalledWith(project.id)
    expect(api.getArchiveDraft).not.toHaveBeenCalled()
    expect(store.projectDocuments[0]).toEqual(failedDocument)
    expect(store.currentDraft).toBeNull()
    expect(store.error).toBe('建议生成失败。')
    expect(store.errorStatus).toBe(422)
  })

  it('confirms the current draft with its version and synchronizes the document row and draft', async () => {
    const confirmedDocument = { ...draft.document, status: 'CONFIRMED' as const, version: 5, confirmed_at: '2026-08-27T00:10:00Z', index_context_chunk_count: 12 }
    vi.mocked(api.confirmArchiveDocument).mockResolvedValue(confirmedDocument)
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [project]
    store.activeProjectId = project.id
    store.projectDocuments = [uploadedDocument]
    store.currentDraft = draft

    await store.confirmArchiveDocument(uploadedDocument.id, 4)

    expect(api.confirmArchiveDocument).toHaveBeenCalledWith(project.id, uploadedDocument.id, { expected_version: 4 })
    expect(store.currentDraft?.document).toEqual(confirmedDocument)
    expect(store.currentDraft?.fields).toEqual(draft.fields)
    expect(store.projectDocuments[0]).toEqual(confirmedDocument)
  })

  it('cancels confirmation with the current version and preserves project isolation for stale responses', async () => {
    let resolveConfirmation!: (value: ProcessDocument) => void
    vi.mocked(api.cancelArchiveDocumentConfirmation).mockReturnValueOnce(new Promise<ProcessDocument>((resolve) => { resolveConfirmation = resolve }))
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [project, { ...project, id: 'project-2', name: '第二项目' }]
    store.activeProjectId = project.id
    store.currentDraft = draft

    const request = store.cancelArchiveDocumentConfirmation(uploadedDocument.id, 11)
    store.selectProject('project-2')
    resolveConfirmation({ ...draft.document, status: 'PENDING_RECONFIRMATION' as const, version: 6 })
    await request

    expect(api.cancelArchiveDocumentConfirmation).toHaveBeenCalledWith(project.id, uploadedDocument.id, { expected_version: 11 })
    expect(store.currentDraft).toBeNull()
    expect(store.projectDocuments).toEqual([])
  })

  it('does not prewrite confirmation state when the backend rejects', async () => {
    const error = new ApiError('CONFIRMATION_INVALID', '字段尚未完成检查。', 422)
    vi.mocked(api.confirmArchiveDocument).mockRejectedValue(error)
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [project]
    store.activeProjectId = project.id
    store.currentDraft = draft

    await expect(store.confirmArchiveDocument(uploadedDocument.id, 4)).rejects.toBe(error)

    expect(store.currentDraft).toEqual(draft)
    expect(store.currentDraft?.document.status).toBe('PENDING_CONFIRMATION')
    expect(store.error).toBe('字段尚未完成检查。')
    expect(store.errorStatus).toBe(422)
  })

  it('isolates checklist link responses by both project and document', async () => {
    let resolveSuggestions!: (value: { items: never[] }) => void
    let resolveLinks!: (value: { items: never[] }) => void
    vi.mocked(api.listChecklistLinkSuggestions).mockReturnValueOnce(new Promise((resolve) => { resolveSuggestions = resolve }))
    vi.mocked(api.listChecklistLinks).mockReturnValueOnce(new Promise((resolve) => { resolveLinks = resolve }))
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [project, { ...project, id: 'project-2', name: '第二项目' }]
    store.activeProjectId = project.id
    store.currentDraft = draft

    const request = store.loadChecklistLinkState('document-1')
    store.selectProject('project-2')
    resolveSuggestions({ items: [] })
    resolveLinks({ items: [] })
    await request

    expect(store.checklistLinkSuggestions).toEqual([])
    expect(store.checklistLinks).toEqual([])
  })

  it('drops an older document link response after the current draft changes', async () => {
    let resolveOldSuggestions!: (value: { items: never[] }) => void
    let resolveOldLinks!: (value: { items: never[] }) => void
    vi.mocked(api.listChecklistLinkSuggestions).mockImplementationOnce(() => new Promise((resolve) => { resolveOldSuggestions = resolve }))
    vi.mocked(api.listChecklistLinks).mockImplementationOnce(() => new Promise((resolve) => { resolveOldLinks = resolve }))
    vi.mocked(api.listChecklistLinkSuggestions).mockResolvedValueOnce({ items: [] })
    vi.mocked(api.listChecklistLinks).mockResolvedValueOnce({ items: [] })
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [project]
    store.activeProjectId = project.id
    store.currentDraft = draft

    const oldRequest = store.loadChecklistLinkState('document-1')
    store.currentDraft = { ...draft, document: { ...draft.document, id: 'document-2' } }
    await store.loadChecklistLinkState('document-2')
    resolveOldSuggestions({ items: [] })
    resolveOldLinks({ items: [] })
    await oldRequest

    expect(store.checklistLinkDocumentId).toBe('document-2')
    expect(store.checklistLinkSuggestions).toEqual([])
    expect(store.checklistLinks).toEqual([])
  })

  it('passes document and checklist item versions, then refreshes links, suggestions, and checklist after creating or deleting', async () => {
    const confirmedLink = { id: 'link-1', document_id: 'document-1', checklist_item_id: 'item-1', status: 'CONFIRMED' as const, confirmed_by: 'user-1', confirmed_at: '2026-09-10T00:00:00Z', invalidated_at: null, invalidated_reason: null, version: 1 }
    vi.mocked(api.createChecklistLink).mockResolvedValue(confirmedLink)
    vi.mocked(api.deleteChecklistLink).mockResolvedValue(undefined)
    vi.mocked(api.listChecklistLinkSuggestions).mockResolvedValue({ items: [] })
    vi.mocked(api.listChecklistLinks).mockResolvedValue({ items: [confirmedLink] })
    vi.mocked(api.listChecklistItems).mockResolvedValue({ items: [checklistItem] })
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [project]
    store.activeProjectId = project.id
    store.currentDraft = { ...draft, document: { ...draft.document, status: 'CONFIRMED', version: 12 } }

    await store.createChecklistLink('document-1', { checklist_item_id: 'item-1', expected_document_version: 12, expected_checklist_item_version: 4 })
    expect(api.createChecklistLink).toHaveBeenCalledWith(project.id, 'document-1', { checklist_item_id: 'item-1', expected_document_version: 12, expected_checklist_item_version: 4 })
    expect(api.listChecklistLinkSuggestions).toHaveBeenCalledWith(project.id, 'document-1')
    expect(api.listChecklistLinks).toHaveBeenCalledWith(project.id, 'document-1')
    expect(api.listChecklistItems).toHaveBeenCalledWith(project.id)

    vi.clearAllMocks()
    vi.mocked(api.listChecklistLinkSuggestions).mockResolvedValue({ items: [] })
    vi.mocked(api.listChecklistLinks).mockResolvedValue({ items: [] })
    vi.mocked(api.listChecklistItems).mockResolvedValue({ items: [] })
    await store.deleteChecklistLink('document-1', 'link-1')
    expect(api.deleteChecklistLink).toHaveBeenCalledWith(project.id, 'document-1', 'link-1')
    expect(api.listChecklistLinkSuggestions).toHaveBeenCalledWith(project.id, 'document-1')
    expect(api.listChecklistLinks).toHaveBeenCalledWith(project.id, 'document-1')
    expect(api.listChecklistItems).toHaveBeenCalledWith(project.id)
  })

  it('refreshes the project checklist after document confirmation changes', async () => {
    vi.mocked(api.confirmArchiveDocument).mockResolvedValue({ ...draft.document, status: 'CONFIRMED', version: 5 })
    vi.mocked(api.cancelArchiveDocumentConfirmation).mockResolvedValue({ ...draft.document, status: 'PENDING_RECONFIRMATION', version: 6 })
    vi.mocked(api.listChecklistItems).mockResolvedValue({ items: [checklistItem] })
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [project]
    store.activeProjectId = project.id
    store.currentDraft = draft

    await store.confirmArchiveDocument('document-1', 4)
    await store.cancelArchiveDocumentConfirmation('document-1', 5)
    expect(api.listChecklistItems).toHaveBeenCalledTimes(2)
  })

  it('stores FR-039 retrieval and answer responses, then clears them on project switch', async () => {
    const retrieval = { items: [], requested_top_k: 5, returned_count: 0 }
    const answer = { answer_status: 'REFUSED_NO_EVIDENCE' as const, answer: '没有足够证据。', citations: [] }
    vi.mocked(api.retrieveArchives).mockResolvedValue(retrieval)
    vi.mocked(api.askArchiveQuestion).mockResolvedValue(answer)
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [project, { ...project, id: 'project-2', name: '另一个项目' }]
    store.activeProjectId = project.id

    await store.retrieveArchives('合同', 5)
    await store.askArchiveQuestion('合同签订日期是什么？')
    expect(store.archiveRetrieval).toEqual(retrieval)
    expect(store.archiveAnswer).toEqual(answer)
    expect(api.retrieveArchives).toHaveBeenCalledWith(project.id, { query: '合同', top_k: 5 })
    expect(api.askArchiveQuestion).toHaveBeenCalledWith(project.id, { question: '合同签订日期是什么？' })

    store.selectProject('project-2')
    expect(store.archiveRetrieval).toBeNull()
    expect(store.archiveAnswer).toBeNull()
  })

  it('accepts only the last retrieval and question response, including stale errors', async () => {
    let resolveRetrievalOld!: (value: { items: never[]; requested_top_k: number; returned_count: number }) => void
    let rejectQuestionOld!: (reason: Error) => void
    vi.mocked(api.retrieveArchives)
      .mockImplementationOnce(() => new Promise(resolve => { resolveRetrievalOld = resolve }))
      .mockResolvedValueOnce({ items: [{ chunk_id: 'new', document_id: 'document-2', filename: 'new.txt', location_type: 'TEXT_LINE_RANGE', location_start: 1, location_end: 2, excerpt: 'new', score: 0.9, reranker_score: null }], requested_top_k: 5, returned_count: 1 })
    vi.mocked(api.askArchiveQuestion)
      .mockImplementationOnce(() => new Promise((_, reject) => { rejectQuestionOld = reject }))
      .mockResolvedValueOnce({ answer_status: 'ANSWERED', answer: '最新回答', citations: [] })
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [project]
    store.activeProjectId = project.id

    const oldRetrieval = store.retrieveArchives('旧查询', 5)
    const newRetrieval = store.retrieveArchives('新查询', 5)
    resolveRetrievalOld({ items: [], requested_top_k: 5, returned_count: 0 })
    await Promise.all([oldRetrieval, newRetrieval])
    expect(store.archiveRetrieval?.items[0].chunk_id).toBe('new')

    const oldQuestion = store.askArchiveQuestion('旧问题')
    const newQuestion = store.askArchiveQuestion('新问题')
    rejectQuestionOld(new Error('过期错误'))
    await Promise.all([oldQuestion, newQuestion])
    expect(store.archiveAnswer?.answer).toBe('最新回答')
    expect(store.error).toBe('')
  })

  it('does not retain an in-flight question error after switching projects', async () => {
    let rejectOld!: (reason: Error) => void
    vi.mocked(api.askArchiveQuestion).mockImplementationOnce(() => new Promise((_, reject) => { rejectOld = reject }))
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [project, { ...project, id: 'project-2', name: '另一个项目' }]
    store.activeProjectId = project.id

    const oldQuestion = store.askArchiveQuestion('旧项目问题')
    store.selectProject('project-2')
    rejectOld(new Error('旧项目请求失败'))
    await oldQuestion
    expect(store.error).toBe('')
  })

  it('does not let a late retrieval failure overwrite the current operation error', async () => {
    let rejectOld!: (reason: Error) => void
    let resolveCurrent!: (value: { items: never[]; requested_top_k: number; returned_count: number }) => void
    vi.mocked(api.retrieveArchives)
      .mockImplementationOnce(() => new Promise((_, reject) => { rejectOld = reject }))
      .mockImplementationOnce(() => new Promise(resolve => { resolveCurrent = resolve }))
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [project]
    store.activeProjectId = project.id

    const oldRequest = store.retrieveArchives('旧查询', 5)
    const currentRequest = store.retrieveArchives('当前查询', 5)
    store.error = '当前操作失败。'
    store.errorStatus = 409
    rejectOld(new Error('过期检索失败'))
    await oldRequest
    expect(store.error).toBe('当前操作失败。')
    expect(store.errorStatus).toBe(409)
    resolveCurrent({ items: [], requested_top_k: 5, returned_count: 0 })
    await currentRequest
  })

  it('does not let a late question failure overwrite the current operation error', async () => {
    let rejectOld!: (reason: Error) => void
    let resolveCurrent!: (value: { answer_status: 'ANSWERED'; answer: string; citations: never[] }) => void
    vi.mocked(api.askArchiveQuestion)
      .mockImplementationOnce(() => new Promise((_, reject) => { rejectOld = reject }))
      .mockImplementationOnce(() => new Promise(resolve => { resolveCurrent = resolve }))
    const store = useArchiveWorkspaceStore()
    store.hasSession = true
    store.projects = [project]
    store.activeProjectId = project.id

    const oldRequest = store.askArchiveQuestion('旧问题')
    const currentRequest = store.askArchiveQuestion('当前问题')
    store.error = '当前操作失败。'
    store.errorStatus = 409
    rejectOld(new Error('过期问答失败'))
    await oldRequest
    expect(store.error).toBe('当前操作失败。')
    expect(store.errorStatus).toBe(409)
    resolveCurrent({ answer_status: 'ANSWERED', answer: '当前回答', citations: [] })
    await currentRequest
  })
})
