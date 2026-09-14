export interface User {
  id: string
  username: string | null
  name: string
  created_at: string
  updated_at: string
}

/** 注册账号时允许提交的公开字段；密码只用于本次请求。 */
export interface AuthRegisterRequest {
  username: string
  name: string
  password: string
}

/** 登录账号时允许提交的凭据。 */
export interface AuthLoginRequest {
  username: string
  password: string
}

/** 登录成功后返回的短期 Access Token 与长期 Refresh Token。 */
export interface AuthTokenPair {
  access_token: string
  refresh_token: string
  token_type: 'bearer'
  access_expires_in: number
  refresh_expires_in: number
}

/** 使用 Refresh Token 成功后返回的新 Access Token。 */
export interface AuthAccessToken {
  access_token: string
  token_type: 'bearer'
  access_expires_in: number
}
export interface KnowledgeBase { id: string; owner_id: string; name: string; created_at: string }
export interface DocumentRecord {
  id: string; kb_id: string; original_name: string; suffix: string; content_hash: string
  status: string; chunk_count: number; error_message: string | null; created_at: string; updated_at: string
}
export interface ChatSession { id: string; owner_id: string; kb_id: string; title: string; created_at: string; updated_at?: string }
export interface Source { source_id: string; chunk_id: string; document_id: string; document_name: string; page: number | null; excerpt: string; score: number }
export interface ChatMessage { id?: string; role: 'user' | 'assistant'; content: string; rejected: boolean; sources: Source[]; created_at?: string }
export interface RetrievedChunk { chunk_id: string; document_id: string; document_name: string; page: number | null; content: string; score: number }
export interface RetrievalResponse { question: string; top_k: number; top_n: number; threshold: number; chunks: RetrievedChunk[] }

/** 智慧档案 V1 项目管理接口返回的项目摘要。 */
export interface ArchiveProject {
  id: string
  name: string
  description: string | null
  uses_demo_checklist: boolean
  active_document_count: number
  version: number
  created_at: string
  updated_at: string
}

/** 项目列表接口的稳定分页响应。 */
export interface ArchiveProjectPage {
  items: ArchiveProject[]
  page: number
  page_size: number
  total: number
}

/** 创建项目时客户端允许提交的字段。 */
export interface ArchiveProjectCreate {
  name: string
  description?: string | null
  use_demo_checklist: boolean
}

/** 修改项目时必须携带页面读到的版本号，避免静默覆盖。 */
export interface ArchiveProjectUpdate {
  name?: string
  description?: string | null
  expected_version: number
}

/** 智慧档案后端固定的资料类型字典；前端不能自行扩展。 */
export type ArchiveDocumentType =
  | 'CONTRACT'
  | 'DESIGN'
  | 'CONSTRUCTION'
  | 'MEETING_MINUTES'
  | 'ACCEPTANCE'
  | 'OTHER'

/** 智慧档案后端固定的项目阶段字典；用于清单与档案的匹配。 */
export type ProjectStage =
  | 'PREPARATION'
  | 'DESIGN'
  | 'CONSTRUCTION'
  | 'ACCEPTANCE'
  | 'CROSS_STAGE'
  | 'OTHER_STAGE'

/** 后端根据已确认档案和确认关联实时派生的清单状态。 */
export type ChecklistFulfillmentStatus = 'SATISFIED' | 'MISSING' | 'NOT_PROVIDED'

/** FR-031 返回的项目独有清单项；满足状态不是客户端可编辑字段。 */
export interface ChecklistItem {
  id: string
  name: string
  document_type: ArchiveDocumentType
  is_required: boolean
  project_stage: ProjectStage
  description: string | null
  fulfillment_status: ChecklistFulfillmentStatus
  confirmed_document_count: number
  version: number
}

/** FR-031 清单读取响应；项目无清单时 items 是空数组。 */
export interface ChecklistItemList {
  items: ChecklistItem[]
}

/** FR-037 按文档类型和项目阶段返回的非正式关联建议。 */
export interface ChecklistLinkSuggestion {
  checklist_item_id: string
  name: string
  document_type: ArchiveDocumentType
  project_stage: ProjectStage
  is_required: boolean
  already_linked: boolean
}

/** FR-037 文档关联建议列表响应。 */
export interface ChecklistLinkSuggestionList {
  items: ChecklistLinkSuggestion[]
}

/** FR-037 已确认或已失效的文档—清单关联。 */
export interface ChecklistLink {
  id: string
  document_id: string
  checklist_item_id: string
  status: 'CONFIRMED' | 'INVALIDATED'
  confirmed_by: string | null
  confirmed_at: string | null
  invalidated_at: string | null
  invalidated_reason: string | null
  version: number
}

/** FR-037 文档关联列表响应。 */
export interface ChecklistLinkList {
  items: ChecklistLink[]
}

/** FR-037 创建关联时的双版本乐观锁请求。 */
export interface ChecklistLinkCreate {
  checklist_item_id: string
  expected_document_version: number
  expected_checklist_item_version: number
}

/** 新建清单项时必须提交项目版本，防止并发创建静默覆盖。 */
export interface ChecklistItemCreate {
  name: string
  document_type: ArchiveDocumentType
  is_required: boolean
  project_stage: ProjectStage
  description?: string | null
  expected_project_version: number
}

/** 新建成功后同时返回项目原子递增后的版本。 */
export interface ChecklistItemCreateResponse {
  item: ChecklistItem
  project_version: number
}

/** 修改清单项时必须携带该项版本；未提供的可编辑字段保持不变。 */
export interface ChecklistItemUpdate {
  name?: string
  document_type?: ArchiveDocumentType
  is_required?: boolean
  project_stage?: ProjectStage
  description?: string | null
  expected_version: number
}

/** 智慧档案文档的七种后端状态；前端只能显示，不能自行跳转状态。 */
export type ArchiveDocumentStatus =
  | 'UPLOADED'
  | 'PARSE_FAILED'
  | 'PARSED'
  | 'SUGGESTION_FAILED'
  | 'PENDING_CONFIRMATION'
  | 'CONFIRMED'
  | 'PENDING_RECONFIRMATION'

/** 最近一次解析、建议或索引失败的受控摘要。 */
export interface ArchiveDocumentLastError {
  code: string | null
  message: string | null
}

/** 七个固定归档字段的人工检查进度；上传和解析阶段通常尚无字段。 */
export interface ArchiveDocumentFieldSummary {
  checked_count: number
  total_count: number
}

/** FR-032/033 项目文档响应；不包含内部知识库、所有者或文件存储路径。 */
export interface ProcessDocument {
  id: string
  filename: string
  file_hash: string
  status: ArchiveDocumentStatus
  last_error: ArchiveDocumentLastError
  field_summary: ArchiveDocumentFieldSummary
  confirmed_at: string | null
  version: number
  uploaded_at: string
  updated_at: string
  /** 确认后由后端返回的 Final Chunk 上下文数量；未确认时可能为空。 */
  index_context_chunk_count?: number | null
}

/** 确认或取消确认时用于乐观锁的当前文档版本。 */
export interface ArchiveConfirmationRequest {
  expected_version: number
}

/** 项目内未删除文档的稳定分页结果；该列表不等同于仅 CONFIRMED 的正式档案目录。 */
export interface ProcessDocumentPage {
  items: ProcessDocument[]
  page: number
  page_size: number
  total: number
}

/** 正式档案目录中的摘要；目录只接受服务端已经确认的档案。 */
export interface ArchiveSummary {
  id: string
  filename: string
  status: 'CONFIRMED'
  title: string | null
  document_type: ArchiveDocumentType | null
  document_date: string | null
  authoring_organization: string | null
  project_stage: ProjectStage | null
  confirmed_at: string | null
  version: number
}

/** 正式档案目录的稳定分页响应。 */
export interface ArchivePage {
  items: ArchiveSummary[]
  page: number
  page_size: number
  total: number
}

/** FR-041 允许展示和筛选的业务审计操作类型。 */
export type ArchiveAuditOperationType =
  | 'ARCHIVE_CONFIRMED'
  | 'ARCHIVE_CONFIRMATION_CANCELLED'
  | 'ARCHIVE_FIELD_UPDATED'
  | 'CHECKLIST_ITEM_CREATED'
  | 'CHECKLIST_ITEM_UPDATED'
  | 'CHECKLIST_ITEM_DELETED'
  | 'CHECKLIST_LINK_CONFIRMED'
  | 'CHECKLIST_LINK_DELETED'
  | 'PARSE_RETRIED'
  | 'SUGGESTION_RETRIED'
  | 'SUGGESTION_REGENERATED'
  | 'DOCUMENT_DELETED'

export interface ArchiveAuditLog {
  id: string
  actor_id: string
  operation_type: ArchiveAuditOperationType
  resource_type: string
  resource_id: string
  redacted_summary: Record<string, unknown>
  created_at: string
}

/** FR-041 项目审计日志分页结果。 */
export interface ArchiveAuditPage {
  items: ArchiveAuditLog[]
  page: number
  page_size: number
  total: number
}

/** 正式档案目录可提交的服务端筛选条件。 */
export interface ArchiveFilters {
  document_type?: ArchiveDocumentType
  project_stage?: ProjectStage
  document_date_from?: string
  document_date_to?: string
  document_date_is_null?: boolean
  authoring_organization?: string
}

/** FR-039 正式档案原文检索请求；项目和知识库范围由服务端会话确定。 */
export interface ArchiveRetrievalRequest {
  query: string
  top_k?: number
}

/** FR-039 返回的可追溯原文 Chunk；分数仅用于检索诊断。 */
export interface ArchiveRetrievalItem {
  chunk_id: string
  document_id: string
  filename: string
  location_type: EvidenceLocationType
  location_start: number
  location_end: number
  excerpt: string
  score: number
  reranker_score: number | null
}

/** FR-039 正式档案检索响应。 */
export interface ArchiveRetrievalResponse {
  items: ArchiveRetrievalItem[]
  requested_top_k: number
  returned_count: number
}

/** FR-039 单轮带证据问答请求。 */
export interface ArchiveQuestionRequest {
  question: string
}

export type ArchiveAnswerStatus = 'ANSWERED' | 'REFUSED_NO_EVIDENCE'

/** FR-039 单轮带证据问答响应；引用完全采用后端返回值。 */
export interface ArchiveQuestionResponse {
  answer_status: ArchiveAnswerStatus
  answer: string
  citations: ArchiveRetrievalItem[]
}

/** 正式档案详情；字段和证据均来自独立详情接口。 */
export interface ArchiveDetail extends ArchiveSummary {
  fields: ArchiveFieldDraft[]
}

/** 归档字段的固定名称、检查状态、来源和原文定位字典。 */
export type ArchiveFieldName = 'TITLE' | 'DOCUMENT_TYPE' | 'DOCUMENT_DATE' | 'AUTHORING_ORGANIZATION' | 'VERSION_NUMBER' | 'PROJECT_STAGE' | 'KEYWORDS'
export type FieldReviewStatus = 'PENDING_CHECK' | 'VALUE_CONFIRMED' | 'EMPTY_ACCEPTED'
export type FieldSource = 'AI' | 'MANUAL'
export type EvidenceLocationType = 'PDF_PAGE' | 'DOCX_PARAGRAPH' | 'TEXT_LINE_RANGE'

export interface FieldEvidenceInput {
  excerpt: string
  location_type: EvidenceLocationType
  location_start: number
  location_end: number
  normalized_anchor?: string | null
}

export interface FieldEvidence extends FieldEvidenceInput {
  id: string
  snapshot_id: string
  created_at: string
}

export interface ParsedSnapshot {
  id: string
  snapshot_hash: string
  parser_name: string
  parser_version: string
  normalization_version: string
  fragment_count: number
  created_at: string
}

export interface ArchiveFieldDraft {
  id: string
  field_name: ArchiveFieldName
  text_value: string | null
  date_value: string | null
  json_value: string[] | null
  review_status: FieldReviewStatus
  source: FieldSource | null
  no_source_evidence: boolean
  updated_by: string | null
  updated_at: string
  evidences: FieldEvidence[]
}

export interface ArchiveDraft {
  document: ProcessDocument
  fields: ArchiveFieldDraft[]
  snapshot: ParsedSnapshot | null
  next_actions: string[]
}

export interface ArchiveFieldUpdate {
  text_value?: string | null
  date_value?: string | null
  json_value?: string[] | null
  review_status: FieldReviewStatus
  source?: FieldSource | null
  no_source_evidence: boolean
  evidences: FieldEvidenceInput[]
  reason?: string | null
  expected_version: number
}
