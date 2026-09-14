import type {
  AuthAccessToken,
  AuthLoginRequest,
  AuthRegisterRequest,
  AuthTokenPair,
  ArchiveProject,
  ArchiveProjectCreate,
  ArchiveProjectPage,
  ArchiveProjectUpdate,
  ArchiveDraft,
  ArchiveDetail,
  ArchiveFilters,
  ArchivePage,
  ArchiveAuditPage,
  ArchiveAuditOperationType,
  ArchiveQuestionRequest,
  ArchiveQuestionResponse,
  ArchiveRetrievalRequest,
  ArchiveRetrievalResponse,
  ArchiveConfirmationRequest,
  ArchiveFieldName,
  ArchiveFieldUpdate,
  ChecklistItemCreate,
  ChecklistItemCreateResponse,
  ChecklistItem,
  ChecklistItemList,
  ChecklistItemUpdate,
  ChecklistLink,
  ChecklistLinkCreate,
  ChecklistLinkList,
  ChecklistLinkSuggestionList,
  ProcessDocument,
  ProcessDocumentPage,
  ChatMessage,
  ChatSession,
  DocumentRecord,
  KnowledgeBase,
  RetrievalResponse,
  User,
} from '../types'

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number, public details?: unknown) { super(message) }
}

const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
const accessTokenKey = 'archive-v1-access-token'
const refreshTokenKey = 'archive-v1-refresh-token'

let accessToken = localStorage.getItem(accessTokenKey) || ''
let refreshToken = localStorage.getItem(refreshTokenKey) || ''
let legacySessionScope = ''

/** 将令牌保存在本地学习工作台；不保存密码或 UUID 作为鉴权依据。 */
export function setApiTokens(tokens: Pick<AuthTokenPair, 'access_token' | 'refresh_token'>) {
  accessToken = tokens.access_token
  refreshToken = tokens.refresh_token
  localStorage.setItem(accessTokenKey, accessToken)
  localStorage.setItem(refreshTokenKey, refreshToken)
}

/** 刷新只替换短期 Access Token，后端不会轮换 Refresh Token。 */
export function setApiAccessToken(token: string) {
  accessToken = token
  localStorage.setItem(accessTokenKey, accessToken)
}

/** 清除本地令牌；注销仍由调用方先向服务端撤销认证会话。 */
export function clearApiTokens() {
  accessToken = ''
  refreshToken = ''
  localStorage.removeItem(accessTokenKey)
  localStorage.removeItem(refreshTokenKey)
}

export const hasRefreshToken = () => Boolean(refreshToken)

/** 仅用于未路由旧视图的浏览器缓存分区，不参与 HTTP 身份认证。 */
export const setLegacySessionScope = (value: string) => { legacySessionScope = value }

async function request<T>(path: string, init: RequestInit = {}, authenticated = true, retryAfterRefresh = true): Promise<T> {
  const headers = new Headers(init.headers)
  if (!(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  headers.set('X-Request-ID', crypto.randomUUID())
  if (authenticated && accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers })
  if (response.status === 401 && authenticated && retryAfterRefresh && refreshToken) {
    await refreshSession()
    return request<T>(path, init, authenticated, false)
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const error = body.error || {}
    throw new ApiError(error.code || 'HTTP_ERROR', error.message || `请求失败 (${response.status})`, response.status, error.details)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

type HandwriteDocument = Omit<DocumentRecord, 'original_name' | 'suffix'> & { filename: string }
type HandwriteSession = { id: string; user_id: string; kb_id: string; created_at: string; updated_at: string }
const sessionKey = (kbId: string) => `mini-rag-handwrite-sessions:${legacySessionScope}:${kbId}`
const readLocalSessions = (kbId: string): ChatSession[] => JSON.parse(localStorage.getItem(sessionKey(kbId)) || '[]')
const saveLocalSessions = (kbId: string, sessions: ChatSession[]) => localStorage.setItem(sessionKey(kbId), JSON.stringify(sessions))
const normalizeDocument = (doc: HandwriteDocument): DocumentRecord => ({ ...doc, original_name: doc.filename, suffix: `.${doc.filename.split('.').pop() || ''}` })

async function refreshSession(): Promise<AuthAccessToken> {
  const result = await request<AuthAccessToken>(
    '/auth/refresh',
    { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }) },
    false,
    false,
  )
  setApiAccessToken(result.access_token)
  return result
}

export const api = {
  health: () => request<{ status: string; components: Record<string, { status: string; detail?: string }> }>('/health', {}, false),
  register: (payload: AuthRegisterRequest) => request<User>('/auth/register', { method: 'POST', body: JSON.stringify(payload) }, false),
  login: (payload: AuthLoginRequest) => request<AuthTokenPair>('/auth/login', { method: 'POST', body: JSON.stringify(payload) }, false),
  refreshSession,
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  /** 仅访问当前 Bearer Access Token 所属的智慧档案项目。 */
  listArchiveProjects: (page = 1, pageSize = 20) => request<ArchiveProjectPage>(`/projects?page=${page}&page_size=${pageSize}`),
  createArchiveProject: (payload: ArchiveProjectCreate) => request<ArchiveProject>('/projects', { method: 'POST', body: JSON.stringify(payload) }),
  updateArchiveProject: (projectId: string, payload: ArchiveProjectUpdate) => request<ArchiveProject>(`/projects/${projectId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteArchiveProject: (projectId: string) => request<void>(`/projects/${projectId}`, { method: 'DELETE' }),
  /** 只读取当前 Bearer 用户有权访问项目的实时清单状态。 */
  listChecklistItems: (projectId: string) => request<ChecklistItemList>(`/projects/${projectId}/checklist-items`),
  /** 以项目版本创建清单项；项目版本由后端原子递增后返回。 */
  createChecklistItem: (projectId: string, payload: ChecklistItemCreate) => request<ChecklistItemCreateResponse>(`/projects/${projectId}/checklist-items`, { method: 'POST', body: JSON.stringify(payload) }),
  /** 以清单项版本修改字段；后端决定是否需要使已有关联失效。 */
  updateChecklistItem: (projectId: string, itemId: string, payload: ChecklistItemUpdate) => request<ChecklistItem>(`/projects/${projectId}/checklist-items/${itemId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  /** 删除清单项及其关联；项目授权始终由 Bearer Token 在服务端确定。 */
  deleteChecklistItem: (projectId: string, itemId: string) => request<void>(`/projects/${projectId}/checklist-items/${itemId}`, { method: 'DELETE' }),
  /** FR-037：读取当前文档按类型和阶段生成的非正式建议。 */
  listChecklistLinkSuggestions: (projectId: string, documentId: string) => request<ChecklistLinkSuggestionList>(`/projects/${projectId}/documents/${documentId}/checklist-link-suggestions`),
  /** FR-037：读取当前文档的确认或失效关联记录。 */
  listChecklistLinks: (projectId: string, documentId: string) => request<ChecklistLinkList>(`/projects/${projectId}/documents/${documentId}/checklist-links`),
  /** FR-037：仅将用户明确确认的同项目清单项与已确认档案关联。 */
  createChecklistLink: (projectId: string, documentId: string, payload: ChecklistLinkCreate) => request<ChecklistLink>(`/projects/${projectId}/documents/${documentId}/checklist-links`, { method: 'POST', body: JSON.stringify(payload) }),
  /** FR-037：删除当前文档的一条关联；204 不读取响应体。 */
  deleteChecklistLink: (projectId: string, documentId: string, linkId: string) => request<void>(`/projects/${projectId}/documents/${documentId}/checklist-links/${linkId}`, { method: 'DELETE' }),
  /** 上传项目原文件；multipart 只包含后端契约规定的 `file` 字段。 */
  uploadProjectDocument: (projectId: string, file: File) => {
    const data = new FormData()
    data.append('file', file)
    return request<ProcessDocument>(`/projects/${projectId}/documents`, { method: 'POST', body: data })
  },
  /** 读取当前项目的文档处理列表；正式档案目录仍使用独立 `/archives` 接口。 */
  listProjectDocuments: (projectId: string, page = 1, pageSize = 20, status?: ProcessDocument['status'] | '') => {
    const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
    if (status) query.set('status', status)
    return request<ProcessDocumentPage>(`/projects/${projectId}/documents?${query.toString()}`)
  },
  /** FR-040：物理删除项目文档；删除范围和跨存储清理由后端服务裁决。 */
  deleteProjectDocument: (projectId: string, documentId: string) => request<void>(`/projects/${projectId}/documents/${documentId}`, { method: 'DELETE' }),
  /** FR-038：正式档案目录只读取服务端确认结果，并精确提交用户选择的筛选条件。 */
  listArchives: (projectId: string, page = 1, pageSize = 20, filters: ArchiveFilters = {}) => {
    const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== '' && value !== false) query.set(key, String(value))
    }
    return request<ArchivePage>(`/projects/${projectId}/archives?${query.toString()}`)
  },
  /** FR-041：读取当前项目的脱敏业务审计；操作类型仅发送受控枚举。 */
  listAuditLogs: (projectId: string, page = 1, pageSize = 20, operationType?: ArchiveAuditOperationType | '') => {
    const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
    if (operationType) query.set('operation_type', operationType)
    return request<ArchiveAuditPage>(`/projects/${projectId}/audit-logs?${query.toString()}`)
  },
  /** FR-038：读取单个正式档案详情，字段证据必须来自后端详情响应。 */
  getArchiveDetail: (projectId: string, documentId: string) => request<ArchiveDetail>(`/projects/${projectId}/archives/${documentId}`),
  /** FR-039：只检索当前项目正式档案并原样返回可追溯证据。 */
  retrieveArchives: (projectId: string, payload: ArchiveRetrievalRequest) => request<ArchiveRetrievalResponse>(`/projects/${projectId}/archive-retrieval`, { method: 'POST', body: JSON.stringify(payload) }),
  /** FR-039：提交单轮问题；回答和引用均由服务端正式证据链返回。 */
  askArchiveQuestion: (projectId: string, payload: ArchiveQuestionRequest) => request<ArchiveQuestionResponse>(`/projects/${projectId}/archive-questions`, { method: 'POST', body: JSON.stringify(payload) }),
  /** 仅对 UPLOADED 文档发起首次解析；状态是否允许由后端判断。 */
  parseProjectDocument: (projectId: string, documentId: string) => request<ProcessDocument>(`/projects/${projectId}/documents/${documentId}/parse`, { method: 'POST' }),
  /** 仅对 PARSE_FAILED 文档使用专用重试端点，不能退化为普通 parse。 */
  retryProjectDocumentParse: (projectId: string, documentId: string) => request<ProcessDocument>(`/projects/${projectId}/documents/${documentId}/parse-retry`, { method: 'POST' }),
  /** FR-034：仅对已解析文档生成首次 AI 字段建议；请求体必须为空。 */
  createArchiveSuggestions: (projectId: string, documentId: string) => request<ArchiveDraft>(`/projects/${projectId}/documents/${documentId}/suggestions`, { method: 'POST' }),
  /** FR-034：仅对建议失败文档使用专用重试动作；请求体必须为空。 */
  retryArchiveSuggestions: (projectId: string, documentId: string) => request<ArchiveDraft>(`/projects/${projectId}/documents/${documentId}/suggestions/retry`, { method: 'POST' }),
  /** FR-034：重新生成只携带当前文档版本，最终状态仍由后端裁决。 */
  regenerateArchiveSuggestions: (projectId: string, documentId: string, payload: { expected_version: number }) => request<ArchiveDraft>(`/projects/${projectId}/documents/${documentId}/suggestions/regenerate`, { method: 'POST', body: JSON.stringify(payload) }),
  /** FR-035：从已解析或建议失败状态创建空白七字段草稿；请求体必须为空。 */
  createManualArchiveDraft: (projectId: string, documentId: string) => request<ArchiveDraft>(`/projects/${projectId}/documents/${documentId}/manual-draft`, { method: 'POST' }),
  /** FR-035：读取当前项目文档的草稿、解析快照和后端下一步动作。 */
  getArchiveDraft: (projectId: string, documentId: string) => request<ArchiveDraft>(`/projects/${projectId}/documents/${documentId}/draft`),
  /** FR-035：按后端字段值列提交人工检查和证据，并携带文档版本。 */
  updateArchiveField: (projectId: string, documentId: string, fieldName: ArchiveFieldName, payload: ArchiveFieldUpdate) => request<ArchiveDraft>(`/projects/${projectId}/documents/${documentId}/fields/${fieldName}`, { method: 'PUT', body: JSON.stringify(payload) }),
  /** FR-036：携带当前版本确认并正式入档；索引是否成功由后端裁决。 */
  confirmArchiveDocument: (projectId: string, documentId: string, payload: ArchiveConfirmationRequest) => request<ProcessDocument>(`/projects/${projectId}/documents/${documentId}/confirm`, { method: 'POST', body: JSON.stringify(payload) }),
  /** FR-036：携带当前版本取消正式入档；后端负责清理正式索引。 */
  cancelArchiveDocumentConfirmation: (projectId: string, documentId: string, payload: ArchiveConfirmationRequest) => request<ProcessDocument>(`/projects/${projectId}/documents/${documentId}/cancel-confirmation`, { method: 'POST', body: JSON.stringify(payload) }),
  listKnowledgeBases: () => request<KnowledgeBase[]>('/knowledge-bases'),
  createKnowledgeBase: (name: string) => request<KnowledgeBase>('/knowledge-bases', { method: 'POST', body: JSON.stringify({ name }) }),
  listDocuments: (kbId: string) => request<HandwriteDocument[]>(`/knowledge-bases/${kbId}/documents`).then((rows) => rows.map(normalizeDocument)),
  uploadDocument: (kbId: string, file: File) => { const data = new FormData(); data.append('upload', file); return request<HandwriteDocument>(`/knowledge-bases/${kbId}/documents`, { method: 'POST', body: data }).then(normalizeDocument) },
  parseDocument: (kbId: string, id: string) => request(`/knowledge-bases/${kbId}/documents/${id}/parse`, { method: 'POST' }),
  deleteDocument: (kbId: string, id: string) => request(`/knowledge-bases/${kbId}/documents/${id}`, { method: 'DELETE' }),
  retrieve: (kbId: string, question: string) => request<RetrievalResponse>(`/knowledge-bases/${kbId}/retrieval-test`, { method: 'POST', body: JSON.stringify({ question }) }),
  listSessions: async (kbId: string) => readLocalSessions(kbId).sort((a, b) => (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at)),
  createSession: async (kbId: string, title: string) => {
    const row = await request<HandwriteSession>('/chat-sessions', { method: 'POST', body: JSON.stringify({ kb_id: kbId }) })
    const session: ChatSession = { id: row.id, owner_id: row.user_id, kb_id: row.kb_id, title, created_at: row.created_at, updated_at: row.updated_at }
    saveLocalSessions(kbId, [session, ...readLocalSessions(kbId).filter((item) => item.id !== session.id)])
    return session
  },
  listMessages: (id: string) => request<Array<Omit<ChatMessage, 'rejected'>>>(`/chat-sessions/${id}/messages`).then((rows) => rows.map((row) => ({ ...row, rejected: false }))),
  sendMessage: (id: string, question: string) => request<{ answer: string; rejected: boolean; sources: ChatMessage['sources'] }>(`/chat-sessions/${id}/messages`, { method: 'POST', body: JSON.stringify({ question }) }),
}
