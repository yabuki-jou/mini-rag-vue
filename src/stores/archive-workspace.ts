import { defineStore } from 'pinia'
import { ApiError, api, clearApiTokens, hasRefreshToken, setApiTokens } from '../services/api'
import type {
    ArchiveProject,
    ArchiveProjectCreate,
    ArchiveProjectUpdate,
    AuthLoginRequest,
    AuthRegisterRequest,
    AuthTokenPair,
    ArchiveDraft,
    ArchiveDetail,
    ArchiveFilters,
    ArchivePage,
    ArchiveAuditLog,
    ArchiveAuditOperationType,
    ArchiveAgentMessage,
    ArchiveAgentResponse,
    ArchiveAgentSession,
    ArchiveAgentToolCallLog,
    ArchiveQuestionResponse,
    ArchiveRetrievalResponse,
    ArchiveSummary,
    ArchiveFieldName,
    ArchiveFieldUpdate,
    ChecklistItem,
    ChecklistItemCreate,
    ChecklistItemUpdate,
    ChecklistLink,
    ChecklistLinkCreate,
    ChecklistLinkSuggestion,
    ProcessDocument
} from '../types'

const usernameKey = 'archive-v1-username'
const userNameKey = 'archive-v1-user-name'
const projectIdKey = 'archive-v1-project-id'

/**
 * 管理智慧档案前端的 Bearer 会话、项目选择与项目清单。
 *
 * 当前只保存项目、清单、文档处理、正式档案和 FR-039 接口的真实响应；不在 Store 中编造确认、
 * 问答或审计状态。
 */
export const useArchiveWorkspaceStore = defineStore('archive-workspace', {
    state: () => ({
        username: localStorage.getItem(usernameKey) || '',
        userName: localStorage.getItem(userNameKey) || '',
        hasSession: hasRefreshToken(),
        projects: [] as ArchiveProject[],
        checklistItems: [] as ChecklistItem[],
        checklistLinkSuggestions: [] as ChecklistLinkSuggestion[],
        checklistLinks: [] as ChecklistLink[],
        checklistLinkDocumentId: '',
        checklistLinkRequestId: 0,
        projectDocuments: [] as ProcessDocument[],
        projectDocumentPage: 1,
        projectDocumentPageSize: 20,
        projectDocumentTotal: 0,
        projectDocumentStatus: '' as ProcessDocument['status'] | '',
        projectDocumentRequestId: 0,
        projectDocumentSuccessfulRequestId: 0,
        archives: [] as ArchiveSummary[],
        archivePage: { page: 1, page_size: 20, total: 0 } as Omit<ArchivePage, 'items'>,
        archiveFilters: {} as ArchiveFilters,
        archiveRequestId: 0,
        archiveSuccessfulRequestId: 0,
        auditLogs: [] as ArchiveAuditLog[],
        auditPage: { page: 1, page_size: 20, total: 0 } as { page: number; page_size: number; total: number },
        auditOperationType: '' as ArchiveAuditOperationType | '',
        auditRequestId: 0,
        auditSuccessfulRequestId: 0,
        currentArchive: null as ArchiveDetail | null,
        archiveDetailRequestId: 0,
        archiveRetrieval: null as ArchiveRetrievalResponse | null,
        archiveRetrievalRequestId: 0,
        archiveRetrievalSuccessfulRequestId: 0,
        archiveAnswer: null as ArchiveQuestionResponse | null,
        archiveQuestionRequestId: 0,
        archiveQuestionSuccessfulRequestId: 0,
        archiveAgentSession: null as ArchiveAgentSession | null,
        archiveAgentMessages: [] as ArchiveAgentMessage[],
        archiveAgentLastResponse: null as ArchiveAgentResponse | null,
        archiveAgentToolCalls: [] as ArchiveAgentToolCallLog[],
        archiveAgentRequestId: 0,
        currentDraft: null as ArchiveDraft | null,
        activeProjectId: localStorage.getItem(projectIdKey) || '',
        loading: {} as Record<string, boolean>,
        error: '',
        errorStatus: null as number | null,
        errorDetails: null as unknown,
        errorCode: '' as string,
        success: '' as string,
        successKind: 'ok' as 'ok' | 'info',
        successTimer: null as ReturnType<typeof setTimeout> | null,
        confirmDialog: null as { title: string; message: string; danger: boolean; resolve: (ok: boolean) => void } | null
    }),
    getters: {
        isAuthenticated: state => state.hasSession,
        activeProject: state => state.projects.find(project => project.id === state.activeProjectId) ?? null
    },
    actions: {
        clearError() {
            this.error = ''
            this.errorStatus = null
            this.errorDetails = null
            this.errorCode = ''
        },
        notifySuccess(message: string, kind: 'ok' | 'info' = 'ok') {
            this.success = message
            this.successKind = kind
            if (this.successTimer) clearTimeout(this.successTimer)
            this.successTimer = setTimeout(() => {
                this.success = ''
            }, 3000)
        },
        clearSuccess() {
            this.success = ''
            this.successKind = 'ok'
            if (this.successTimer) {
                clearTimeout(this.successTimer)
                this.successTimer = null
            }
        },
        confirm(message: string, title = '请确认操作', danger = false): Promise<boolean> {
            return new Promise<boolean>(resolve => {
                this.confirmDialog = { title, message, danger, resolve }
            })
        },
        resolveConfirm(ok: boolean) {
            if (!this.confirmDialog) return
            const { resolve } = this.confirmDialog
            this.confirmDialog = null
            resolve(ok)
        },
        async run<T>(key: string, action: () => Promise<T>): Promise<T | undefined> {
            if (this.loading[key]) return undefined
            this.loading[key] = true
            this.clearError()
            try {
                return await action()
            } catch (error) {
                this.error = error instanceof Error ? error.message : '发生未知错误。'
                this.errorStatus = error instanceof ApiError ? error.status : null
                this.errorDetails = error instanceof ApiError ? error.details : null
                this.errorCode = error instanceof ApiError ? error.code : ''
                throw error
            } finally {
                this.loading[key] = false
            }
        },
        persistProfile() {
            if (this.username) localStorage.setItem(usernameKey, this.username)
            if (this.userName) localStorage.setItem(userNameKey, this.userName)
        },
        async loadCurrentUser() {
            const profile = await this.run('current-user', () => api.currentUser())
            if (!profile) return
            this.username = profile.username || ''
            this.userName = profile.name
            this.persistProfile()
        },
        async startSession(tokens: AuthTokenPair) {
            setApiTokens(tokens)
            this.hasSession = true
            await this.loadCurrentUser()
            await this.loadProjects()
        },
        async login(payload: AuthLoginRequest) {
            const normalizedUsername = payload.username.trim().toLowerCase()
            const tokens = await this.run('login', () => api.login({ ...payload, username: normalizedUsername }))
            if (!tokens) return undefined
            await this.startSession(tokens)
            return tokens
        },
        async register(payload: AuthRegisterRequest) {
            const registration = await this.run('register', () => api.register({ ...payload, username: payload.username.trim().toLowerCase(), name: payload.name.trim() }))
            if (!registration) return undefined
            const tokens = await this.run('login', () => api.login({ username: registration.username || payload.username, password: payload.password }))
            if (!tokens) return undefined
            await this.startSession(tokens)
            return registration
        },
        async restoreSession() {
            if (!hasRefreshToken()) return undefined
            const refreshed = await this.run('refresh-session', () => api.refreshSession())
            if (!refreshed) return undefined
            await this.loadCurrentUser()
            await this.loadProjects()
            return refreshed
        },
        async loadProjects() {
            if (!this.isAuthenticated) return
            const page = await this.run('projects', () => api.listArchiveProjects())
            if (!page) return
            this.projects = page.items
            const savedProject = localStorage.getItem(projectIdKey) || ''
            const candidate = this.projects.some(project => project.id === this.activeProjectId) ? this.activeProjectId : this.projects.some(project => project.id === savedProject) ? savedProject : this.projects[0]?.id || ''
            this.selectProject(candidate)
        },
        selectProject(projectId: string) {
            if (this.activeProjectId !== projectId) {
                this.checklistItems = []
                this.checklistLinkSuggestions = []
                this.checklistLinks = []
                this.checklistLinkDocumentId = ''
                this.checklistLinkRequestId += 1
                this.projectDocuments = []
                this.projectDocumentPage = 1
                this.projectDocumentTotal = 0
                this.projectDocumentStatus = ''
                this.projectDocumentRequestId += 1
                this.archives = []
                this.archivePage = { page: 1, page_size: 20, total: 0 }
                this.archiveFilters = {}
                this.archiveRequestId += 1
                this.auditLogs = []
                this.auditPage = { page: 1, page_size: 20, total: 0 }
                this.auditOperationType = ''
                this.auditRequestId += 1
                this.auditSuccessfulRequestId = 0
                this.loading.audit = false
                this.currentArchive = null
                this.archiveDetailRequestId += 1
                this.archiveRetrieval = null
                this.archiveRetrievalRequestId += 1
                this.archiveAnswer = null
                this.archiveQuestionRequestId += 1
                this.archiveAgentSession = null
                this.archiveAgentMessages = []
                this.archiveAgentLastResponse = null
                this.archiveAgentToolCalls = []
                this.archiveAgentRequestId += 1
                this.loading['archive-agent-session'] = false
                this.loading['archive-agent-restore'] = false
                this.loading['archive-agent-message'] = false
                this.loading['archive-agent-history'] = false
                this.loading['archive-agent-tool-calls'] = false
                this.currentDraft = null
            }
            this.activeProjectId = projectId
            if (projectId) localStorage.setItem(projectIdKey, projectId)
            else localStorage.removeItem(projectIdKey)
        },
        async loadChecklistItems(requestedProjectId?: string) {
            const projectId = requestedProjectId || this.activeProjectId
            if (!this.isAuthenticated || !projectId) {
                this.checklistItems = []
                return undefined
            }
            const response = await this.run('checklist-items', () => api.listChecklistItems(projectId))
            // 用户可能在请求期间切换项目；过期响应不能覆盖新项目的清单。
            if (!response || this.activeProjectId !== projectId) return undefined
            this.checklistItems = response.items
            return response.items
        },
        async createChecklistItem(payload: ChecklistItemCreate) {
            const projectId = this.activeProjectId
            if (!projectId) return undefined
            const response = await this.run('create-checklist-item', () => api.createChecklistItem(projectId, payload))
            if (!response || this.activeProjectId !== projectId) return undefined
            this.checklistItems = [...this.checklistItems, response.item]
            this.projects = this.projects.map(project => (project.id === projectId ? { ...project, version: response.project_version } : project))
            this.notifySuccess('清单项已创建')
            return response.item
        },
        async updateChecklistItem(itemId: string, payload: ChecklistItemUpdate) {
            const projectId = this.activeProjectId
            if (!projectId) return undefined
            const item = await this.run(`update-checklist-item:${itemId}`, () => api.updateChecklistItem(projectId, itemId, payload))
            if (!item || this.activeProjectId !== projectId) return undefined
            this.checklistItems = this.checklistItems.map(current => (current.id === item.id ? item : current))
            this.notifySuccess('清单项已保存')
            return item
        },
        async deleteChecklistItem(itemId: string) {
            const projectId = this.activeProjectId
            if (!projectId) return
            await this.run(`delete-checklist-item:${itemId}`, () => api.deleteChecklistItem(projectId, itemId))
            if (this.activeProjectId === projectId) {
                this.checklistItems = this.checklistItems.filter(item => item.id !== itemId)
                this.notifySuccess('清单项已删除')
            }
        },
        async loadProjectDocuments(requestedProjectId?: string, page?: number, pageSize?: number, status?: ProcessDocument['status'] | '') {
            const projectId = requestedProjectId || this.activeProjectId
            const resolvedPage = page ?? this.projectDocumentPage
            const resolvedPageSize = pageSize ?? this.projectDocumentPageSize
            const resolvedStatus = status ?? this.projectDocumentStatus
            if (!this.isAuthenticated || !projectId) {
                this.projectDocuments = []
                this.projectDocumentTotal = 0
                return undefined
            }
            const requestId = ++this.projectDocumentRequestId
            this.loading['project-documents'] = true
            let response: Awaited<ReturnType<typeof api.listProjectDocuments>> | undefined
            try {
                response = await this.run(`project-documents:${requestId}`, () => {
                    if (resolvedPage === 1 && resolvedPageSize === 20 && resolvedStatus === '') return api.listProjectDocuments(projectId)
                    return api.listProjectDocuments(projectId, resolvedPage, resolvedPageSize, resolvedStatus)
                })
                if (response && this.projectDocumentRequestId === requestId) {
                    this.projectDocumentSuccessfulRequestId = requestId
                    this.clearError()
                }
            } catch (error) {
                if (this.projectDocumentRequestId !== requestId) {
                    if (this.projectDocumentSuccessfulRequestId === this.projectDocumentRequestId) this.clearError()
                    return undefined
                }
                throw error
            } finally {
                if (this.projectDocumentRequestId === requestId) this.loading['project-documents'] = false
            }
            // 请求期间若切换项目，旧项目的处理状态不能覆盖新的项目范围。
            if (!response || this.activeProjectId !== projectId || this.projectDocumentRequestId !== requestId) return undefined
            this.projectDocuments = response.items
            this.projectDocumentPage = response.page
            this.projectDocumentPageSize = response.page_size
            this.projectDocumentTotal = response.total
            this.projectDocumentStatus = resolvedStatus
            return response.items
        },
        /** FR-040：调用项目级物理删除，并在当前项目内同步清理所有依赖状态。 */
        async deleteProjectDocument(documentId: string) {
            const projectId = this.activeProjectId
            const key = `delete-project-document:${documentId}`
            if (!this.isAuthenticated || !projectId || !documentId || this.loading[key]) return undefined
            const deletingOnlyRow = this.projectDocuments.length === 1
            const currentPage = this.projectDocumentPage
            const pageSize = this.projectDocumentPageSize
            const targetPage = deletingOnlyRow && currentPage > 1 ? currentPage - 1 : currentPage
            try {
                await this.run(key, () => api.deleteProjectDocument(projectId, documentId))
            } catch (error) {
                const originalMessage = this.error
                const originalStatus = this.errorStatus
                if (this.activeProjectId === projectId) {
                    if (error instanceof ApiError && error.code === 'DOCUMENT_DELETE_INCOMPLETE') {
                        // 503 表示文档已退出可见范围；先使旧检索和问答结果失效，避免继续展示已被阻断的证据。
                        this.archiveRetrieval = null
                        this.archiveRetrievalRequestId += 1
                        this.archiveRetrievalSuccessfulRequestId = 0
                        this.archiveAnswer = null
                        this.archiveQuestionRequestId += 1
                        this.archiveQuestionSuccessfulRequestId = 0
                        this.loading['archive-retrieval'] = false
                        this.loading['archive-question'] = false
                    }
                    await Promise.allSettled([this.loadProjectDocuments(projectId), this.loadChecklistItems(projectId), this.loadArchives(this.archiveFilters, this.archivePage.page, this.archivePage.page_size)])
                    // 刷新接口也经过 run；删除失败的稳定错误必须继续展示，便于用户重试。
                    if (this.activeProjectId === projectId) {
                        this.error = originalMessage
                        this.errorStatus = originalStatus
                    } else if (this.error === originalMessage && this.errorStatus === originalStatus) {
                        // 切换项目后，旧项目的错误也必须从新项目页面移除。
                        this.clearError()
                    }
                } else {
                    // 若请求失败前已经切换项目，run 仍可能写入旧错误；只清理这一次删除产生的错误。
                    const failedMessage = error instanceof Error ? error.message : '发生未知错误。'
                    const failedStatus = error instanceof ApiError ? error.status : null
                    if (this.error === failedMessage && this.errorStatus === failedStatus) this.clearError()
                }
                throw error
            }
            // 删除请求可能在返回前切换项目；旧项目的结果不得污染新项目页面。
            if (this.activeProjectId !== projectId) return undefined

            this.projectDocuments = this.projectDocuments.filter(item => item.id !== documentId)
            this.projectDocumentTotal = Math.max(0, this.projectDocumentTotal - 1)
            this.projects = this.projects.map(project => (project.id === projectId ? { ...project, active_document_count: Math.max(0, project.active_document_count - 1) } : project))
            if (this.currentDraft?.document.id === documentId) this.currentDraft = null
            if (this.currentArchive?.id === documentId) {
                this.currentArchive = null
                this.archiveDetailRequestId += 1
            }
            if (this.checklistLinkDocumentId === documentId) this.clearChecklistLinkState()
            this.archiveRetrieval = null
            this.archiveRetrievalRequestId += 1
            this.archiveRetrievalSuccessfulRequestId = 0
            this.archiveAnswer = null
            this.archiveQuestionRequestId += 1
            this.archiveQuestionSuccessfulRequestId = 0
            this.loading['archive-retrieval'] = false
            this.loading['archive-question'] = false

            await Promise.allSettled([this.loadProjectDocuments(projectId, targetPage, pageSize, this.projectDocumentStatus), this.loadChecklistItems(projectId), this.loadArchives(this.archiveFilters, this.archivePage.page, this.archivePage.page_size)])
            this.notifySuccess('文档已删除')
            return undefined
        },
        async setProjectDocumentStatus(status: ProcessDocument['status'] | '') {
            this.projectDocumentStatus = status
            return this.loadProjectDocuments(undefined, 1, this.projectDocumentPageSize, status)
        },
        async loadProjectDocumentPage(page: number) {
            return this.loadProjectDocuments(undefined, Math.max(1, page), this.projectDocumentPageSize, this.projectDocumentStatus)
        },
        async loadArchives(filters?: ArchiveFilters, page?: number, pageSize?: number) {
            const projectId = this.activeProjectId
            const resolvedFilters = filters ?? this.archiveFilters
            const resolvedPage = page ?? 1
            const resolvedPageSize = pageSize ?? this.archivePage.page_size
            if (!this.isAuthenticated || !projectId) {
                this.archives = []
                this.archivePage = { page: 1, page_size: resolvedPageSize, total: 0 }
                return undefined
            }
            const requestId = ++this.archiveRequestId
            const snapshot = { ...resolvedFilters }
            this.loading.archives = true
            let response: Awaited<ReturnType<typeof api.listArchives>> | undefined
            try {
                response = await this.run(`archives:${requestId}`, () => api.listArchives(projectId, resolvedPage, resolvedPageSize, snapshot))
                if (response && this.archiveRequestId === requestId) {
                    this.archiveSuccessfulRequestId = requestId
                    this.clearError()
                }
            } catch (error) {
                if (this.archiveRequestId !== requestId) {
                    if (this.archiveSuccessfulRequestId === this.archiveRequestId) this.clearError()
                    return undefined
                }
                throw error
            } finally {
                if (this.archiveRequestId === requestId) this.loading.archives = false
            }
            if (!response || this.activeProjectId !== projectId || this.archiveRequestId !== requestId || JSON.stringify(this.archiveFilters) !== JSON.stringify(snapshot)) return undefined
            this.archives = response.items
            this.archivePage = { page: response.page, page_size: response.page_size, total: response.total }
            this.archiveFilters = snapshot
            this.currentArchive = null
            this.archiveDetailRequestId += 1
            return response.items
        },
        async setArchiveFilters(filters: ArchiveFilters) {
            this.archiveFilters = { ...filters }
            return this.loadArchives(this.archiveFilters, 1, this.archivePage.page_size)
        },
        async loadArchivePage(page: number) {
            return this.loadArchives(this.archiveFilters, Math.max(1, page), this.archivePage.page_size)
        },
        async loadAuditLogs(requestedProjectId?: string, page?: number, pageSize?: number, operationType?: ArchiveAuditOperationType | '') {
            const projectId = requestedProjectId || this.activeProjectId
            const resolvedPage = page ?? this.auditPage.page
            const resolvedPageSize = pageSize ?? this.auditPage.page_size
            const resolvedOperationType = operationType ?? this.auditOperationType
            if (!this.isAuthenticated || !projectId) {
                this.auditLogs = []
                this.auditPage = { page: 1, page_size: resolvedPageSize, total: 0 }
                return undefined
            }
            const requestId = ++this.auditRequestId
            this.loading.audit = true
            let response: Awaited<ReturnType<typeof api.listAuditLogs>> | undefined
            try {
                response = await this.run(`audit:${requestId}`, () => api.listAuditLogs(projectId, resolvedPage, resolvedPageSize, resolvedOperationType))
                if (response && this.auditRequestId === requestId) {
                    this.auditSuccessfulRequestId = requestId
                    this.clearError()
                }
            } catch (error) {
                if (this.auditRequestId !== requestId) {
                    if (this.activeProjectId !== projectId || this.auditSuccessfulRequestId === this.auditRequestId) this.clearError()
                    return undefined
                }
                throw error
            } finally {
                if (this.auditRequestId === requestId) this.loading.audit = false
            }
            if (!response || this.activeProjectId !== projectId || this.auditRequestId !== requestId || this.auditOperationType !== resolvedOperationType) return undefined
            this.auditLogs = response.items
            this.auditPage = { page: response.page, page_size: response.page_size, total: response.total }
            this.auditOperationType = resolvedOperationType
            return response.items
        },
        async setAuditOperationType(operationType: ArchiveAuditOperationType | '') {
            this.auditOperationType = operationType
            return this.loadAuditLogs(undefined, 1, this.auditPage.page_size, operationType)
        },
        async loadAuditPage(page: number) {
            return this.loadAuditLogs(undefined, Math.max(1, page), this.auditPage.page_size, this.auditOperationType)
        },
        async retrieveArchives(query: string, topK = 5, requestedProjectId?: string) {
            const projectId = requestedProjectId || this.activeProjectId
            if (!this.isAuthenticated || !projectId || !query.trim()) return undefined
            const requestId = ++this.archiveRetrievalRequestId
            const payload = { query: query.trim(), top_k: Math.min(10, Math.max(1, topK)) }
            this.loading['archive-retrieval'] = true
            let response: Awaited<ReturnType<typeof api.retrieveArchives>> | undefined
            try {
                response = await api.retrieveArchives(projectId, payload)
                if (response && this.archiveRetrievalRequestId === requestId && this.activeProjectId === projectId) {
                    this.archiveRetrievalSuccessfulRequestId = requestId
                    this.archiveRetrieval = response
                    this.clearError()
                }
            } catch (error) {
                const isCurrentRequest = this.archiveRetrievalRequestId === requestId && this.activeProjectId === projectId
                if (!isCurrentRequest) {
                    return undefined
                }
                this.error = error instanceof Error ? error.message : '发生未知错误。'
                this.errorStatus = error instanceof ApiError ? error.status : null
                throw error
            } finally {
                if (this.archiveRetrievalRequestId === requestId) this.loading['archive-retrieval'] = false
            }
            return response && this.archiveRetrievalRequestId === requestId && this.activeProjectId === projectId ? response : undefined
        },
        async askArchiveQuestion(question: string, requestedProjectId?: string) {
            const projectId = requestedProjectId || this.activeProjectId
            if (!this.isAuthenticated || !projectId || !question.trim()) return undefined
            const requestId = ++this.archiveQuestionRequestId
            const payload = { question: question.trim() }
            this.loading['archive-question'] = true
            let response: Awaited<ReturnType<typeof api.askArchiveQuestion>> | undefined
            try {
                response = await api.askArchiveQuestion(projectId, payload)
                if (response && this.archiveQuestionRequestId === requestId && this.activeProjectId === projectId) {
                    this.archiveQuestionSuccessfulRequestId = requestId
                    this.archiveAnswer = response
                    this.clearError()
                }
            } catch (error) {
                const isCurrentRequest = this.archiveQuestionRequestId === requestId && this.activeProjectId === projectId
                if (!isCurrentRequest) {
                    return undefined
                }
                this.error = error instanceof Error ? error.message : '发生未知错误。'
                this.errorStatus = error instanceof ApiError ? error.status : null
                throw error
            } finally {
                if (this.archiveQuestionRequestId === requestId) this.loading['archive-question'] = false
            }
            return response && this.archiveQuestionRequestId === requestId && this.activeProjectId === projectId ? response : undefined
        },
        async restoreLatestArchiveAgentSession() {
            const projectId = this.activeProjectId
            if (!this.isAuthenticated || !projectId || this.loading['archive-agent-restore']) return undefined
            const requestId = ++this.archiveAgentRequestId
            this.loading['archive-agent-restore'] = true
            this.clearError()
            try {
                const response = await api.getLatestArchiveAgentSession(projectId)
                if (this.activeProjectId !== projectId || this.archiveAgentRequestId !== requestId) return undefined
                this.archiveAgentSession = response
                this.archiveAgentMessages = []
                this.archiveAgentLastResponse = null
                this.archiveAgentToolCalls = []
                if (!response) return null

                await Promise.all([this.loadArchiveAgentMessages(), this.loadArchiveAgentToolCalls()])
                if (this.activeProjectId !== projectId || this.archiveAgentRequestId !== requestId) return undefined
                return response
            } catch (error) {
                if (this.activeProjectId !== projectId || this.archiveAgentRequestId !== requestId) return undefined
                this.error = error instanceof Error ? error.message : '发生未知错误。'
                this.errorStatus = error instanceof ApiError ? error.status : null
                this.errorDetails = error instanceof ApiError ? error.details : null
                this.errorCode = error instanceof ApiError ? error.code : ''
                throw error
            } finally {
                if (this.archiveAgentRequestId === requestId) this.loading['archive-agent-restore'] = false
            }
        },
        async createArchiveAgentSession() {
            const projectId = this.activeProjectId
            if (!this.isAuthenticated || !projectId || this.loading['archive-agent-session'] || this.loading['archive-agent-restore']) return undefined
            const requestId = ++this.archiveAgentRequestId
            this.loading['archive-agent-session'] = true
            this.clearError()
            try {
                const response = await api.createArchiveAgentSession(projectId)
                if (this.activeProjectId !== projectId || this.archiveAgentRequestId !== requestId) return undefined
                this.archiveAgentSession = response
                this.archiveAgentMessages = []
                this.archiveAgentLastResponse = null
                this.archiveAgentToolCalls = []
                return response
            } catch (error) {
                if (this.activeProjectId !== projectId || this.archiveAgentRequestId !== requestId) return undefined
                this.error = error instanceof Error ? error.message : '发生未知错误。'
                this.errorStatus = error instanceof ApiError ? error.status : null
                this.errorDetails = error instanceof ApiError ? error.details : null
                this.errorCode = error instanceof ApiError ? error.code : ''
                throw error
            } finally {
                if (this.archiveAgentRequestId === requestId) this.loading['archive-agent-session'] = false
            }
        },
        async sendArchiveAgentMessage(message: string) {
            const projectId = this.activeProjectId
            const sessionId = this.archiveAgentSession?.id || ''
            const normalizedMessage = message.trim()
            if (!this.isAuthenticated || !projectId || !sessionId || !normalizedMessage || this.loading['archive-agent-message']) return undefined
            const requestId = this.archiveAgentRequestId
            this.loading['archive-agent-message'] = true
            this.clearError()
            try {
                const response = await api.sendArchiveAgentMessage(projectId, sessionId, { message: normalizedMessage })
                if (this.activeProjectId !== projectId || this.archiveAgentSession?.id !== sessionId || this.archiveAgentRequestId !== requestId) return undefined
                this.archiveAgentMessages.push({ role: 'USER', content: normalizedMessage, citations: [] }, { role: 'ASSISTANT', content: response.answer, citations: response.citations })
                this.archiveAgentLastResponse = response
                return response
            } catch (error) {
                if (this.activeProjectId !== projectId || this.archiveAgentSession?.id !== sessionId || this.archiveAgentRequestId !== requestId) return undefined
                this.error = error instanceof Error ? error.message : '发生未知错误。'
                this.errorStatus = error instanceof ApiError ? error.status : null
                this.errorDetails = error instanceof ApiError ? error.details : null
                this.errorCode = error instanceof ApiError ? error.code : ''
                throw error
            } finally {
                if (this.archiveAgentRequestId === requestId) this.loading['archive-agent-message'] = false
            }
        },
        async loadArchiveAgentMessages() {
            const projectId = this.activeProjectId
            const sessionId = this.archiveAgentSession?.id || ''
            if (!this.isAuthenticated || !projectId || !sessionId || this.loading['archive-agent-history']) return undefined
            const requestId = this.archiveAgentRequestId
            this.loading['archive-agent-history'] = true
            this.clearError()
            try {
                const response = await api.listArchiveAgentMessages(projectId, sessionId)
                if (this.activeProjectId !== projectId || this.archiveAgentSession?.id !== sessionId || this.archiveAgentRequestId !== requestId) return undefined
                this.archiveAgentMessages = response
                return response
            } catch (error) {
                if (this.activeProjectId !== projectId || this.archiveAgentSession?.id !== sessionId || this.archiveAgentRequestId !== requestId) return undefined
                this.error = error instanceof Error ? error.message : '发生未知错误。'
                this.errorStatus = error instanceof ApiError ? error.status : null
                this.errorDetails = error instanceof ApiError ? error.details : null
                this.errorCode = error instanceof ApiError ? error.code : ''
                throw error
            } finally {
                if (this.archiveAgentRequestId === requestId) this.loading['archive-agent-history'] = false
            }
        },
        async loadArchiveAgentToolCalls() {
            const projectId = this.activeProjectId
            const sessionId = this.archiveAgentSession?.id || ''
            if (!this.isAuthenticated || !projectId || !sessionId || this.loading['archive-agent-tool-calls']) return undefined
            const requestId = this.archiveAgentRequestId
            this.loading['archive-agent-tool-calls'] = true
            this.clearError()
            try {
                const response = await api.listArchiveAgentToolCalls(projectId, sessionId)
                if (this.activeProjectId !== projectId || this.archiveAgentSession?.id !== sessionId || this.archiveAgentRequestId !== requestId) return undefined
                this.archiveAgentToolCalls = response
                return response
            } catch (error) {
                if (this.activeProjectId !== projectId || this.archiveAgentSession?.id !== sessionId || this.archiveAgentRequestId !== requestId) return undefined
                this.error = error instanceof Error ? error.message : '发生未知错误。'
                this.errorStatus = error instanceof ApiError ? error.status : null
                this.errorDetails = error instanceof ApiError ? error.details : null
                this.errorCode = error instanceof ApiError ? error.code : ''
                throw error
            } finally {
                if (this.archiveAgentRequestId === requestId) this.loading['archive-agent-tool-calls'] = false
            }
        },
        async loadArchiveDetail(documentId: string) {
            const projectId = this.activeProjectId
            if (!this.isAuthenticated || !projectId || !documentId) {
                this.currentArchive = null
                return undefined
            }
            const requestId = ++this.archiveDetailRequestId
            this.currentArchive = null
            const detail = await this.run(`archive-detail:${documentId}`, () => api.getArchiveDetail(projectId, documentId))
            if (!detail || this.activeProjectId !== projectId || this.archiveDetailRequestId !== requestId) return undefined
            this.currentArchive = detail
            return detail
        },
        async uploadProjectDocument(file: File) {
            const projectId = this.activeProjectId
            if (!this.isAuthenticated || !projectId) return undefined
            const document = await this.run('upload-project-document', () => api.uploadProjectDocument(projectId, file))
            if (!document || this.activeProjectId !== projectId) return undefined
            this.projectDocuments = [document, ...this.projectDocuments.filter(item => item.id !== document.id)]
            this.projects = this.projects.map(project => (project.id === projectId ? { ...project, active_document_count: project.active_document_count + 1 } : project))
            this.notifySuccess('文档已上传')
            return document
        },
        async parseProjectDocument(documentId: string) {
            const projectId = this.activeProjectId
            if (!this.isAuthenticated || !projectId) return undefined
            const document = await this.run(`parse-project-document:${documentId}`, () => api.parseProjectDocument(projectId, documentId))
            if (!document || this.activeProjectId !== projectId) return undefined
            this.projectDocuments = this.projectDocuments.map(item => (item.id === document.id ? document : item))
            this.notifySuccess('已开始解析')
            return document
        },
        async retryProjectDocumentParse(documentId: string) {
            const projectId = this.activeProjectId
            if (!this.isAuthenticated || !projectId) return undefined
            const document = await this.run(`retry-project-document-parse:${documentId}`, () => api.retryProjectDocumentParse(projectId, documentId))
            if (!document || this.activeProjectId !== projectId) return undefined
            this.projectDocuments = this.projectDocuments.map(item => (item.id === document.id ? document : item))
            this.notifySuccess('已重试解析')
            return document
        },
        syncDraftResponse(projectId: string, documentId: string, draft: ArchiveDraft | undefined) {
            if (!draft || this.activeProjectId !== projectId || draft.document.id !== documentId) return undefined
            if (this.checklistLinkDocumentId && this.checklistLinkDocumentId !== documentId) this.clearChecklistLinkState()
            this.currentDraft = draft
            this.projectDocuments = this.projectDocuments.some(item => item.id === draft.document.id) ? this.projectDocuments.map(item => (item.id === draft.document.id ? draft.document : item)) : [draft.document, ...this.projectDocuments]
            return draft
        },
        syncDocumentResponse(projectId: string, documentId: string, document: ProcessDocument | undefined) {
            if (!document || this.activeProjectId !== projectId || document.id !== documentId) return undefined
            this.projectDocuments = this.projectDocuments.some(item => item.id === document.id) ? this.projectDocuments.map(item => (item.id === document.id ? document : item)) : [document, ...this.projectDocuments]
            if (this.currentDraft?.document.id === document.id) this.currentDraft = { ...this.currentDraft, document }
            return document
        },
        async createArchiveSuggestions(documentId: string) {
            const projectId = this.activeProjectId
            if (!this.isAuthenticated || !projectId) return undefined
            try {
                const draft = await this.run(`create-archive-suggestions:${documentId}`, () => api.createArchiveSuggestions(projectId, documentId))
                const synced = this.syncDraftResponse(projectId, documentId, draft)
                if (synced) this.notifySuccess('已生成 AI 建议')
                return synced
            } catch (error) {
                // 首次生成失败可能已经持久化 SUGGESTION_FAILED；刷新真实文档和草稿后仍保留原错误提示。
                const originalMessage = this.error
                const originalStatus = this.errorStatus
                try {
                    await this.loadProjectDocuments(projectId)
                    if (this.activeProjectId === projectId && this.currentDraft?.document.id === documentId) this.currentDraft = null
                } catch {
                    // 刷新失败不能遮蔽首次建议请求的稳定错误，也不能把异常详情展示给用户。
                } finally {
                    this.error = originalMessage
                    this.errorStatus = originalStatus
                }
                throw error
            }
        },
        async retryArchiveSuggestions(documentId: string) {
            const projectId = this.activeProjectId
            if (!this.isAuthenticated || !projectId) return undefined
            const draft = await this.run(`retry-archive-suggestions:${documentId}`, () => api.retryArchiveSuggestions(projectId, documentId))
            const synced = this.syncDraftResponse(projectId, documentId, draft)
            if (synced) this.notifySuccess('已重试 AI 建议')
            return synced
        },
        async regenerateArchiveSuggestions(documentId: string, expectedVersion: number) {
            const projectId = this.activeProjectId
            if (!this.isAuthenticated || !projectId) return undefined
            const draft = await this.run(`regenerate-archive-suggestions:${documentId}`, () => api.regenerateArchiveSuggestions(projectId, documentId, { expected_version: expectedVersion }))
            const synced = this.syncDraftResponse(projectId, documentId, draft)
            if (synced) this.notifySuccess('已重新生成 AI 建议')
            return synced
        },
        async createManualArchiveDraft(documentId: string) {
            const projectId = this.activeProjectId
            if (!this.isAuthenticated || !projectId) return undefined
            const draft = await this.run(`create-manual-archive-draft:${documentId}`, () => api.createManualArchiveDraft(projectId, documentId))
            const synced = this.syncDraftResponse(projectId, documentId, draft)
            if (synced) this.notifySuccess('已启动人工草稿')
            return synced
        },
        async loadArchiveDraft(documentId: string) {
            const projectId = this.activeProjectId
            if (!this.isAuthenticated || !projectId) return undefined
            if (this.currentDraft?.document.id !== documentId) this.clearChecklistLinkState()
            const draft = await this.run(`load-archive-draft:${documentId}`, () => api.getArchiveDraft(projectId, documentId))
            const synced = this.syncDraftResponse(projectId, documentId, draft)
            if (synced) this.notifySuccess('已打开字段草稿', 'info')
            return synced
        },
        clearChecklistLinkState() {
            this.checklistLinkSuggestions = []
            this.checklistLinks = []
            this.checklistLinkDocumentId = ''
            this.checklistLinkRequestId += 1
        },
        async loadChecklistLinkState(documentId: string) {
            const projectId = this.activeProjectId
            if (!this.isAuthenticated || !projectId || !documentId) {
                this.clearChecklistLinkState()
                return undefined
            }
            const requestId = ++this.checklistLinkRequestId
            this.checklistLinkDocumentId = documentId
            this.checklistLinkSuggestions = []
            this.checklistLinks = []
            const [suggestions, links] = await Promise.all([this.run(`checklist-link-suggestions:${documentId}`, () => api.listChecklistLinkSuggestions(projectId, documentId)), this.run(`checklist-links:${documentId}`, () => api.listChecklistLinks(projectId, documentId))])
            // 项目、文档或请求序号变化时丢弃旧响应，避免面板短暂展示另一份档案的关联。
            if (!suggestions || !links || this.activeProjectId !== projectId || this.currentDraft?.document.id !== documentId || this.checklistLinkDocumentId !== documentId || this.checklistLinkRequestId !== requestId) return undefined
            this.checklistLinkSuggestions = suggestions.items
            this.checklistLinks = links.items
            return { suggestions: suggestions.items, links: links.items }
        },
        async refreshChecklistLinkState(projectId: string, documentId: string) {
            if (this.activeProjectId !== projectId || this.currentDraft?.document.id !== documentId) return
            await Promise.all([this.loadChecklistLinkState(documentId), this.loadChecklistItems(projectId)])
        },
        async createChecklistLink(documentId: string, payload: ChecklistLinkCreate) {
            const projectId = this.activeProjectId
            if (!this.isAuthenticated || !projectId || this.currentDraft?.document.id !== documentId) return undefined
            const link = await this.run(`create-checklist-link:${documentId}:${payload.checklist_item_id}`, () => api.createChecklistLink(projectId, documentId, payload))
            if (!link || this.activeProjectId !== projectId || this.currentDraft?.document.id !== documentId) return undefined
            await this.refreshChecklistLinkState(projectId, documentId)
            this.notifySuccess('关联已确认')
            return link
        },
        async deleteChecklistLink(documentId: string, linkId: string) {
            const projectId = this.activeProjectId
            if (!this.isAuthenticated || !projectId || this.currentDraft?.document.id !== documentId) return undefined
            await this.run(`delete-checklist-link:${linkId}`, () => api.deleteChecklistLink(projectId, documentId, linkId))
            if (this.activeProjectId !== projectId || this.currentDraft?.document.id !== documentId) return undefined
            await this.refreshChecklistLinkState(projectId, documentId)
            this.notifySuccess('关联已删除')
        },
        async updateArchiveField(documentId: string, fieldName: ArchiveFieldName, payload: ArchiveFieldUpdate) {
            const projectId = this.activeProjectId
            if (!this.isAuthenticated || !projectId) return undefined
            const draft = await this.run(`update-archive-field:${documentId}:${fieldName}`, () => api.updateArchiveField(projectId, documentId, fieldName, payload))
            const synced = this.syncDraftResponse(projectId, documentId, draft)
            if (synced) this.notifySuccess('字段检查已保存')
            return synced
        },
        async confirmArchiveDocument(documentId: string, expectedVersion: number) {
            const projectId = this.activeProjectId
            if (!this.isAuthenticated || !projectId) return undefined
            const document = await this.run(`confirm-archive-document:${documentId}`, () => api.confirmArchiveDocument(projectId, documentId, { expected_version: expectedVersion }))
            const synced = this.syncDocumentResponse(projectId, documentId, document)
            if (synced) await this.refreshChecklistLinkState(projectId, documentId)
            if (synced) this.notifySuccess('档案已确认')
            return synced
        },
        async cancelArchiveDocumentConfirmation(documentId: string, expectedVersion: number) {
            const projectId = this.activeProjectId
            if (!this.isAuthenticated || !projectId) return undefined
            const document = await this.run(`cancel-confirmation:${documentId}`, () => api.cancelArchiveDocumentConfirmation(projectId, documentId, { expected_version: expectedVersion }))
            const synced = this.syncDocumentResponse(projectId, documentId, document)
            if (synced) await this.refreshChecklistLinkState(projectId, documentId)
            if (synced) this.notifySuccess('已取消确认')
            return synced
        },
        async createProject(payload: ArchiveProjectCreate) {
            const project = await this.run('create-project', () => api.createArchiveProject(payload))
            if (!project) return undefined
            this.projects = [project, ...this.projects]
            this.selectProject(project.id)
            this.notifySuccess('项目已创建')
            return project
        },
        async updateProject(projectId: string, payload: ArchiveProjectUpdate) {
            const project = await this.run('update-project', () => api.updateArchiveProject(projectId, payload))
            if (!project) return undefined
            this.projects = this.projects.map(item => (item.id === project.id ? project : item))
            this.notifySuccess('项目设置已保存')
            return project
        },
        async deleteProject(projectId: string) {
            await this.run('delete-project', () => api.deleteArchiveProject(projectId))
            this.projects = this.projects.filter(project => project.id !== projectId)
            if (this.activeProjectId === projectId) this.selectProject(this.projects[0]?.id || '')
            this.notifySuccess('项目已删除')
        },
        clearSession() {
            clearApiTokens()
            ;[usernameKey, userNameKey, projectIdKey].forEach(key => localStorage.removeItem(key))
            this.$reset()
        },
        async signOut() {
            try {
                await api.logout()
            } catch {
                // Access Token 已过期或会话已撤销时，仍必须清除本地令牌。
            } finally {
                this.clearSession()
            }
        }
    }
})
