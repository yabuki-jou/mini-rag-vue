<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ArchiveSidebar from '../components/archive/ArchiveSidebar.vue'
import ArchiveDraftPanel from '../components/archive/ArchiveDraftPanel.vue'
import ChecklistPanel from '../components/archive/ChecklistPanel.vue'
import ChecklistLinkPanel from '../components/archive/ChecklistLinkPanel.vue'
import DocumentProcessingPanel from '../components/archive/DocumentProcessingPanel.vue'
import ArchiveCatalogPanel from '../components/archive/ArchiveCatalogPanel.vue'
import ArchiveAuditPanel from '../components/archive/ArchiveAuditPanel.vue'
import ArchiveQuestionPanel from '../components/archive/ArchiveQuestionPanel.vue'
import ArchiveAgentPanel from '../components/archive/ArchiveAgentPanel.vue'
import StatusMetric from '../components/archive/StatusMetric.vue'
import UnavailablePanel from '../components/archive/UnavailablePanel.vue'
import { api } from '../services/api'
import { useArchiveWorkspaceStore } from '../stores/archive-workspace'
import type { ArchiveAuditOperationType, ArchiveFieldName, ArchiveFieldUpdate, ArchiveFilters, ChecklistItemCreate, ChecklistItemUpdate, ChecklistLinkCreate, ProcessDocument } from '../types'

type ArchiveView = 'overview' | 'checklist' | 'documents' | 'archives' | 'questions' | 'agent' | 'audit' | 'settings'

const route = useRoute()
const router = useRouter()
const store = useArchiveWorkspaceStore()

const authMode = ref<'login' | 'register'>('login')
const username = ref('')
const password = ref('')
const displayName = ref('')
const passwordConfirmation = ref('')
const authValidationError = ref('')
const health = ref<'checking' | 'ok' | 'degraded'>('checking')
const createOpen = ref(false)
const projectName = ref('')
const projectDescription = ref('')
const useDemoChecklist = ref(true)
const settingsName = ref('')
const settingsDescription = ref('')

const viewByRouteName: Record<string, ArchiveView> = {
    overview: 'overview',
    checklist: 'checklist',
    documents: 'documents',
    archives: 'archives',
    questions: 'questions',
    'archive-agent': 'agent',
    audit: 'audit',
    settings: 'settings'
}

const activeView = computed<ArchiveView>(() => viewByRouteName[String(route.name)] || 'overview')
const activeProject = computed(() => store.activeProject)
const projectAvailable = computed(() => Boolean(activeProject.value))
const pendingConfirmationCount = computed(() => store.projectDocuments.filter(d => d.status === 'PENDING_CONFIRMATION' || d.status === 'PENDING_RECONFIRMATION').length)
const failedCount = computed(() => store.projectDocuments.filter(d => d.status === 'PARSE_FAILED' || d.status === 'SUGGESTION_FAILED').length)
const documentStatusLabels: Record<ProcessDocument['status'], string> = {
    UPLOADED: '待解析',
    PARSE_FAILED: '解析失败',
    PARSED: '已解析',
    SUGGESTION_FAILED: '建议失败',
    PENDING_CONFIRMATION: '待人工确认',
    CONFIRMED: '已确认',
    PENDING_RECONFIRMATION: '待重新确认'
}
const statusText = computed(() => (health.value === 'ok' ? '服务状态：正常' : health.value === 'checking' ? '服务状态：检查中' : '服务状态：不可用'))
const archiveFeature = computed<[string, string]>(() => {
    const featureByView: Partial<Record<ArchiveView, [string, string]>> = {
        documents: ['FR-032 / FR-033', '后端已提供项目内上传、解析和重试接口；前端尚未接入。'],
        archives: ['FR-038', '正式档案目录已接入服务端确认结果、筛选、分页与字段证据。'],
        questions: ['FR-039', '在当前项目正式档案范围内执行原文检索与单轮带证据问答。'],
        agent: ['FR-042', '在当前项目正式档案范围内执行持久化多轮档案问答。'],
        audit: ['FR-041', '按受控操作类型查询当前项目的脱敏审计记录。']
    }
    return featureByView[activeView.value] || ['[TODO]', '该功能尚未进入当前前端范围。']
})

function projectPath(view: ArchiveView, projectId: string) {
    const root = `/projects/${projectId}`
    return {
        overview: '/',
        checklist: `${root}/checklist-items`,
        documents: `${root}/documents`,
        archives: `${root}/archives`,
        questions: `${root}/archive-questions`,
        agent: `${root}/archive-agent`,
        audit: `${root}/audit-logs`,
        settings: `${root}/settings`
    }[view]
}

function navigate(view: ArchiveView) {
    if (view !== 'overview' && !activeProject.value) return
    router.push(projectPath(view, activeProject.value?.id || ''))
}

function selectProject(projectId: string) {
    store.selectProject(projectId)
    if (activeView.value !== 'overview') navigate(activeView.value)
}

async function loadChecklistItems() {
    try {
        await store.loadChecklistItems()
    } catch {
        // Store 统一显示后端稳定错误；页面不从失败响应推断清单状态。
    }
}

async function createChecklistItem(payload: ChecklistItemCreate) {
    try {
        await store.createChecklistItem(payload)
    } catch {
        // VERSION_CONFLICT 等错误由 Store 的统一错误横幅提示。
    }
}

async function updateChecklistItem(itemId: string, payload: ChecklistItemUpdate) {
    try {
        await store.updateChecklistItem(itemId, payload)
    } catch {
        // 修改失败时保留服务端最后一次成功返回的清单状态。
    }
}

async function deleteChecklistItem(itemId: string) {
    try {
        await store.deleteChecklistItem(itemId)
    } catch {
        // 删除失败时 Store 不移除当前行，并显示后端稳定错误。
    }
}

async function loadProjectDocuments() {
    try {
        await store.loadProjectDocuments()
    } catch {
        // 文档处理列表只展示当前项目的服务端响应，不以项目计数或本地缓存替代失败结果。
    }
}

async function deleteProjectDocument(documentId: string, filename: string) {
    const ok = await store.confirm(`确定物理删除文档“${filename}”吗？\n\n这会清理原文件、解析快照、正式档案、向量和清单关联，删除后无法从页面恢复。`, '物理删除文档', true)
    if (!ok) return
    try {
        await store.deleteProjectDocument(documentId)
    } catch {
        // 删除失败时保留后端稳定错误；文档行仍由服务端刷新结果决定，可再次确认并重试。
    }
}

async function loadArchives(filters = store.archiveFilters, page = store.archivePage.page) {
    try {
        await store.loadArchives(filters, page)
    } catch {
        // 目录只展示正式档案接口的成功响应，不用处理列表拼装目录。
    }
}

async function loadAuditLogs() {
    try {
        await store.loadAuditLogs()
    } catch {
        // 审计面板只展示服务端返回的脱敏记录，不从其他项目状态推断日志。
    }
}

async function changeAuditOperationType(operationType: ArchiveAuditOperationType | '') {
    try {
        await store.setAuditOperationType(operationType)
    } catch {
        // 筛选失败时保留 Store 的稳定错误。
    }
}

async function changeArchiveFilters(filters: ArchiveFilters) {
    try {
        await store.setArchiveFilters(filters)
    } catch {
        // 筛选失败时保留 Store 的稳定错误。
    }
}

async function retrieveArchiveEvidence(query: string, topK: number) {
    try {
        await store.retrieveArchives(query, topK)
    } catch {
        // 检索失败由 Store 展示服务端稳定错误，不从旧结果补造当前证据。
    }
}

async function askArchiveQuestion(question: string) {
    try {
        await store.askArchiveQuestion(question)
    } catch {
        // 问答失败时保留服务端错误提示，不以检索结果拼装答案。
    }
}

async function createArchiveAgentSession() {
    try {
        await store.createArchiveAgentSession()
    } catch {
        // 创建失败只显示后端稳定错误，不在客户端构造或复用旧会话标识。
    }
}

async function restoreLatestArchiveAgentSession() {
    try {
        await store.restoreLatestArchiveAgentSession()
    } catch {
        // 最近会话恢复失败时保留 Store 的稳定错误，用户仍可显式新建会话重试。
    }
}

async function sendArchiveAgentMessage(message: string) {
    try {
        await store.sendArchiveAgentMessage(message)
    } catch {
        // 发送失败保留当前完整历史，允许用户按服务端错误决定是否重试。
    }
}

async function loadArchiveAgentMessages() {
    try {
        await store.loadArchiveAgentMessages()
    } catch {
        // 历史读取失败不清空最近一次成功显示的完整轮次。
    }
}

async function loadArchiveAgentToolCalls() {
    try {
        await store.loadArchiveAgentToolCalls()
    } catch {
        // 工具日志只接受后端脱敏响应，失败时不从消息正文推断调用记录。
    }
}

async function loadArchiveDetail(documentId: string) {
    try {
        await store.loadArchiveDetail(documentId)
    } catch {
        // 详情失败时清空旧详情，避免误把另一份档案的证据留在页面上。
    }
}

async function uploadProjectDocument(file: File) {
    try {
        await store.uploadProjectDocument(file)
    } catch {
        // 文件类型、容量、重复或项目范围错误由 Store 统一展示稳定后端错误。
    }
}

async function parseProjectDocument(documentId: string) {
    try {
        await store.parseProjectDocument(documentId)
    } catch {
        // 解析失败后保留后端已写入的 PARSE_FAILED 状态，用户可使用专用重试。
        await loadProjectDocuments()
    }
}

async function retryProjectDocumentParse(documentId: string) {
    try {
        await store.retryProjectDocumentParse(documentId)
    } catch {
        // 重试失败时刷新服务端受控摘要；不把异常详情写入页面。
        await loadProjectDocuments()
    }
}

async function openArchiveDraft(documentId: string) {
    try {
        await store.loadArchiveDraft(documentId)
    } catch {
        // 草稿读取失败时只保留 Store 的稳定错误，不展示异常详情。
    }
}

async function createArchiveSuggestions(documentId?: string) {
    const targetDocumentId = documentId || store.currentDraft?.document.id
    if (!targetDocumentId) return
    try {
        await store.createArchiveSuggestions(targetDocumentId)
    } catch {
        // 建议生成失败由后端状态和 Store 错误提示共同呈现。
    }
}

async function retryArchiveSuggestions(documentId?: string) {
    const targetDocumentId = documentId || store.currentDraft?.document.id
    if (!targetDocumentId) return
    try {
        await store.retryArchiveSuggestions(targetDocumentId)
    } catch {
        // 重试失败后保留服务端返回的失败状态。
    }
}

async function regenerateArchiveSuggestions(expectedVersion: number) {
    const documentId = store.currentDraft?.document.id
    if (!documentId) return
    try {
        await store.regenerateArchiveSuggestions(documentId, expectedVersion)
    } catch {
        // 版本冲突由后端拒绝并由 Store 展示稳定错误。
    }
}

async function createManualArchiveDraft(documentId?: string) {
    const targetDocumentId = documentId || store.currentDraft?.document.id
    if (!targetDocumentId) return
    try {
        await store.createManualArchiveDraft(targetDocumentId)
    } catch {
        // 手工草稿创建失败时不在页面猜测文档状态。
    }
}

async function saveArchiveField(fieldName: ArchiveFieldName, payload: ArchiveFieldUpdate) {
    const documentId = store.currentDraft?.document.id
    if (!documentId) return
    try {
        await store.updateArchiveField(documentId, fieldName, payload)
    } catch {
        // 字段版本冲突或校验错误由后端响应决定，当前草稿保持不变。
    }
}

async function confirmArchiveDocument(expectedVersion: number) {
    const targetDocumentId = store.currentDraft?.document.id
    if (!targetDocumentId) return
    try {
        await store.confirmArchiveDocument(targetDocumentId, expectedVersion)
    } catch {
        // 确认失败由后端稳定错误和 Store 状态展示，不在页面预写正式状态。
    }
}

async function cancelArchiveDocumentConfirmation(expectedVersion: number) {
    const targetDocumentId = store.currentDraft?.document.id
    if (!targetDocumentId) return
    try {
        await store.cancelArchiveDocumentConfirmation(targetDocumentId, expectedVersion)
    } catch {
        // 取消失败由后端稳定错误展示，页面保留当前正式状态。
    }
}

async function loadChecklistLinkState(documentId?: string) {
    const targetDocumentId = documentId || store.currentDraft?.document.id
    if (!targetDocumentId) return
    try {
        await store.loadChecklistLinkState(targetDocumentId)
    } catch {
        // 关联建议和历史关联失败时只显示 Store 的稳定错误，不凭本地状态推断满足结果。
    }
}

async function createChecklistLink(payload: ChecklistLinkCreate) {
    const documentId = store.currentDraft?.document.id
    if (!documentId) return
    try {
        await store.createChecklistLink(documentId, payload)
    } catch {
        // 只有服务端成功创建后，Store 才会刷新关联和清单派生状态。
    }
}

async function deleteChecklistLink(linkId: string) {
    const documentId = store.currentDraft?.document.id
    if (!documentId) return
    try {
        await store.deleteChecklistLink(documentId, linkId)
    } catch {
        // 删除前的明确确认由面板完成，删除失败保留服务端返回的当前状态。
    }
}

function syncRouteProject() {
    const projectId = typeof route.params.projectId === 'string' ? route.params.projectId : ''
    if (!projectId) return
    if (store.projects.some(project => project.id === projectId)) {
        store.selectProject(projectId)
        return
    }
    // 不能让 URL 中的项目 ID 与实际选中项目不一致，否则会误导用户认为页面已通过该项目授权。
    router.replace('/')
}

function formatDate(value: string) {
    return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value))
}

async function submitAuthentication() {
    const normalizedUsername = username.value.trim().toLowerCase()
    authValidationError.value = ''
    if (!normalizedUsername || !password.value) return
    if (!/^[a-z0-9_-]{3,50}$/.test(normalizedUsername)) {
        authValidationError.value = '账号必须为 3–50 位小写字母、数字、下划线或连字符。'
        return
    }
    if (authMode.value === 'register' && password.value !== passwordConfirmation.value) {
        authValidationError.value = '两次输入的密码不一致。'
        return
    }
    try {
        if (authMode.value === 'login') {
            await store.login({ username: normalizedUsername, password: password.value })
        } else {
            await store.register({ username: normalizedUsername, name: displayName.value.trim(), password: password.value })
        }
        syncRouteProject()
        password.value = ''
        passwordConfirmation.value = ''
    } catch {
        // Store 只显示后端的稳定错误消息，不展示异常细节或凭据。
    }
}

async function signOut() {
    await store.signOut()
    await router.replace('/')
}

function toggleAuthMode() {
    authMode.value = authMode.value === 'login' ? 'register' : 'login'
    authValidationError.value = ''
    password.value = ''
    passwordConfirmation.value = ''
}

async function createProject() {
    const name = projectName.value.trim()
    if (!name) return
    try {
        const project = await store.createProject({
            name,
            description: projectDescription.value.trim() || null,
            use_demo_checklist: useDemoChecklist.value
        })
        if (!project) return
        projectName.value = ''
        projectDescription.value = ''
        useDemoChecklist.value = true
        createOpen.value = false
        router.push('/')
    } catch {
        // 由 Store 统一显示 API 错误。
    }
}

async function saveProjectSettings() {
    if (!activeProject.value || !settingsName.value.trim()) return
    try {
        await store.updateProject(activeProject.value.id, {
            name: settingsName.value.trim(),
            description: settingsDescription.value.trim() || null,
            expected_version: activeProject.value.version
        })
    } catch {
        // 乐观锁冲突会通过稳定 API 错误提示用户刷新，不在客户端猜测合并策略。
    }
}

async function deleteProject() {
    if (!activeProject.value || activeProject.value.active_document_count > 0) return
    const ok = await store.confirm(`确定删除空项目“${activeProject.value.name}”吗？`, '删除空项目', true)
    if (!ok) return
    try {
        await store.deleteProject(activeProject.value.id)
        router.push('/')
    } catch {
        // 后端仍会执行所有权与空项目校验，前端提示不代替服务端约束。
    }
}

watch(
    activeProject,
    project => {
        settingsName.value = project?.name || ''
        settingsDescription.value = project?.description || ''
    },
    { immediate: true }
)

watch(
    () => route.params.projectId,
    () => syncRouteProject()
)

watch(
    [activeView, () => store.activeProjectId, () => store.isAuthenticated],
    ([view, projectId, isAuthenticated]) => {
        if (view === 'checklist' && projectId && isAuthenticated) loadChecklistItems()
        if ((view === 'documents' || view === 'overview') && projectId && isAuthenticated) loadProjectDocuments()
        if (view === 'archives' && projectId && isAuthenticated) loadArchives()
        if (view === 'audit' && projectId && isAuthenticated) loadAuditLogs()
        if (view === 'documents' && projectId && isAuthenticated) loadChecklistItems()
        if (view === 'agent' && projectId && isAuthenticated) restoreLatestArchiveAgentSession()
    },
    { immediate: true }
)

watch(
    [() => store.currentDraft?.document.id, activeView],
    ([documentId, view]) => {
        if (view === 'documents' && documentId && store.isAuthenticated) loadChecklistLinkState(documentId)
    },
    { immediate: true }
)

function refreshHealth() {
    api.health()
        .then(response => {
            health.value = response.status === 'ok' ? 'ok' : 'degraded'
        })
        .catch(() => {
            health.value = 'degraded'
        })
}

let healthTimer: number | undefined

onMounted(async () => {
    refreshHealth()
    healthTimer = window.setInterval(refreshHealth, 30000)
    if (store.isAuthenticated) {
        try {
            await store.restoreSession()
            syncRouteProject()
        } catch {
            store.clearSession()
        }
    }
})

onUnmounted(() => {
    if (healthTimer) window.clearInterval(healthTimer)
})
</script>

<template>
    <main v-if="!store.isAuthenticated" class="identity-page">
        <section class="identity-intro">
            <div class="archive-brand inverse"><span class="archive-brand-mark">▱</span><span>智慧档案</span></div>
            <div class="identity-copy">
                <span>ARCHIVE V1 · ACCOUNT SECURITY</span>
                <h1>让项目资料<br />有据可循。</h1>
                <p>使用账号密码建立可撤销会话，再进入项目资料归档与原文追溯工作台。</p>
            </div>
        </section>
        <section class="identity-form-wrap">
            <form class="identity-form" @submit.prevent="submitAuthentication">
                <span class="eyebrow">安全访问</span>
                <h1>{{ authMode === 'login' ? '登录工作台' : '创建账号' }}</h1>
                <p>{{ authMode === 'login' ? '使用账号和密码登录，受保护请求将携带短期 Bearer Access Token。' : '创建账号后会自动登录；密码只用于本次请求，不会写入本地存储。' }}</p>
                <label v-if="authMode === 'register'">用户名<input v-model="displayName" maxlength="100" placeholder="例如：张三" autocomplete="name" required /></label>
                <label>账号<input v-model="username" maxlength="50" placeholder="例如：000001（3–50 位小写字母、数字、下划线或连字符）" autocomplete="username" required /></label>
                <label>密码<input v-model="password" type="password" :minlength="authMode === 'register' ? 8 : 1" maxlength="128" :autocomplete="authMode === 'login' ? 'current-password' : 'new-password'" :placeholder="authMode === 'register' ? '至少 8 位' : '输入密码'" required /></label>
                <label v-if="authMode === 'register'">确认密码<input v-model="passwordConfirmation" type="password" minlength="8" maxlength="128" autocomplete="new-password" placeholder="再次输入密码" required /></label>
                <button class="primary-button" :disabled="!username.trim() || !password || (authMode === 'register' && (!displayName.trim() || !passwordConfirmation)) || store.loading.login || store.loading.register">
                    {{ store.loading.login || store.loading.register ? '正在验证…' : authMode === 'login' ? '登录并进入' : '注册并进入' }}
                </button>
                <button type="button" class="text-button" @click="toggleAuthMode">{{ authMode === 'login' ? '没有账号？创建一个' : '已有账号？返回登录' }}</button>
                <p v-if="authValidationError || store.error" class="form-error">{{ authValidationError || store.error }}</p>
            </form>
        </section>
    </main>

    <div v-else class="archive-app">
        <ArchiveSidebar :active-view="activeView" :project-available="projectAvailable" @navigate="navigate" />
        <section class="archive-main">
            <header class="archive-topbar">
                <label class="project-switcher"
                    >当前项目
                    <select :value="store.activeProjectId" :disabled="!store.projects.length" @change="selectProject(($event.target as HTMLSelectElement).value)">
                        <option value="">{{ store.projects.length ? '请选择项目' : '尚无项目' }}</option>
                        <option v-for="project in store.projects" :key="project.id" :value="project.id">{{ project.name }}</option>
                    </select>
                </label>
                <div class="topbar-actions">
                    <span class="metadata-badge">{{ activeProject?.uses_demo_checklist ? '项目类型：演示' : '项目类型：自定义' }}</span
                    ><span class="service-status" :class="health"><i></i>{{ statusText }}</span
                    ><button class="user-chip" @click="signOut">
                        <b>{{ (store.userName || 'U').slice(0, 1) }}</b
                        ><span>{{ store.userName || store.username || '当前账号' }}<small>退出登录</small></span>
                    </button>
                </div>
            </header>

            <div v-if="store.error" class="error-banner" role="alert" aria-live="assertive">
                <div>
                    <strong v-if="store.errorStatus">HTTP {{ store.errorStatus }}{{ store.errorCode ? ` · ${store.errorCode}` : '' }}</strong>
                    <span>{{ store.error }}</span>
                    <details v-if="store.errorDetails" class="error-details">
                        <summary>查看详细信息</summary>
                        <pre>{{ JSON.stringify(store.errorDetails, null, 2) }}</pre>
                    </details>
                </div>
                <button aria-label="关闭错误提示" @click="store.clearError()">×</button>
            </div>

            <section class="archive-content">
                <template v-if="activeView === 'overview'">
                    <header class="page-heading">
                        <div>
                            <h1>智慧档案工作台</h1>
                            <p>工程项目资料归档、核验与原文追溯</p>
                        </div>
                        <button class="primary-button" @click="createOpen = true">＋ 新建项目</button>
                    </header>

                    <div v-if="!store.projects.length" class="empty-project">
                        <span>▱</span>
                        <h2>创建第一个工程项目</h2>
                        <p>项目是知识库、文档、清单与检索范围的隔离边界。可以选择复制五项虚构演示清单。</p>
                        <button class="primary-button" @click="createOpen = true">新建演示项目</button>
                    </div>

                    <template v-else>
                        <p class="section-caption">全项目状态统计</p>
                        <div class="metrics-grid">
                            <StatusMetric tone="primary" label="当前项目" :value="activeProject ? '已选择' : '未选择'" detail="项目 CRUD 已接入" />
                            <StatusMetric tone="success" label="演示清单" :value="activeProject?.uses_demo_checklist ? '5 项' : '—'" :detail="activeProject?.uses_demo_checklist ? '模板已复制' : '未复制模板'" />
                            <StatusMetric tone="warning" label="待人工确认" :value="String(pendingConfirmationCount)" detail="待确认/重新确认文档" />
                            <StatusMetric tone="danger" label="处理失败" :value="String(failedCount)" detail="解析失败/建议失败" />
                        </div>

                        <div class="overview-grid">
                            <article class="dashboard-card project-card">
                                <div class="card-heading">
                                    <div>
                                        <span class="eyebrow">PROJECT</span>
                                        <h2>当前项目</h2>
                                    </div>
                                    <button class="link-button" @click="navigate('settings')">项目设置 →</button>
                                </div>
                                <h3>{{ activeProject?.name }}</h3>
                                <p>{{ activeProject?.description || '尚未填写项目说明。' }}</p>
                                <dl>
                                    <div>
                                        <dt>文档数</dt>
                                        <dd>{{ activeProject?.active_document_count }} 份</dd>
                                    </div>
                                    <div>
                                        <dt>版本</dt>
                                        <dd>v{{ activeProject?.version }}</dd>
                                    </div>
                                    <div>
                                        <dt>创建日期</dt>
                                        <dd>{{ activeProject ? formatDate(activeProject.created_at) : '—' }}</dd>
                                    </div>
                                </dl>
                                <button class="secondary-button" @click="navigate('checklist')">查看清单详情</button>
                            </article>
                            <article class="dashboard-card progress-card">
                                <div class="card-heading">
                                    <div>
                                        <span class="eyebrow">ARCHIVE FLOW</span>
                                        <h2>归档进度</h2>
                                    </div>
                                </div>
                                <div class="progress-notice"><span>当前进度：项目已创建</span><b>→</b><span>清单可维护</span><b>→</b><span>之后：人工确认</span></div>
                                <p>FR-031 已接入真实清单接口；满足、缺失和未提供状态只展示后端派生结果。</p>
                                <button class="secondary-button" @click="navigate('documents')">前往文档处理</button>
                            </article>
                        </div>

                        <article id="implementation-boundary" class="dashboard-card document-preview">
                            <div class="card-heading">
                                <div>
                                    <span class="eyebrow">DOCUMENT QUEUE</span>
                                    <h2>待处理文档（快速预览）</h2>
                                </div>
                                <small>仅展示真实接口返回的数据</small>
                            </div>
                            <div class="preview-toolbar"><button disabled>状态筛选　⌄</button><input disabled placeholder="搜索文件名（后续接入）" /></div>
                            <div class="preview-table">
                                <div class="preview-table-head"><span>文档名</span><span>处理阶段</span><span>状态</span><span>操作</span></div>
                                <div v-if="store.loading['project-documents'] && !store.projectDocuments.length" class="preview-empty">正在加载文档列表…</div>
                                <div v-else-if="!store.projectDocuments.length" class="preview-empty">当前没有已加载的项目文档；进入文档处理可上传并查看真实处理状态。</div>
                                <div v-else v-for="document in store.projectDocuments.slice(0, 3)" :key="document.id" class="preview-row">
                                    <span class="preview-name">{{ document.filename }}</span
                                    ><span>文档处理</span><span class="preview-status" :class="document.status.toLowerCase()">{{ documentStatusLabels[document.status] || document.status }}</span
                                    ><button class="link-button" @click="navigate('documents')">查看</button>
                                </div>
                            </div>
                            <button class="link-button" @click="navigate('documents')">查看全部文档 → 文档处理</button>
                        </article>

                        <div class="quick-links">
                            <button @click="navigate('checklist')"><span>▤</span><b>查看清单详情</b><i>→</i></button><button @click="navigate('archives')"><span>▱</span><b>进入正式档案</b><i>→</i></button><button @click="navigate('questions')"><span>⌕</span><b>开始带证据问答</b><i>→</i></button>
                        </div>
                    </template>
                </template>

                <ChecklistPanel
                    v-else-if="activeView === 'checklist' && activeProject"
                    :items="store.checklistItems"
                    :project-version="activeProject.version"
                    :loading="store.loading"
                    @refresh="loadChecklistItems"
                    @create="createChecklistItem"
                    @update="updateChecklistItem"
                    @delete="deleteChecklistItem" />

                <template v-else-if="activeView === 'documents' && activeProject">
                    <DocumentProcessingPanel
                        :documents="store.projectDocuments"
                        :loading="store.loading"
                        :page="store.projectDocumentPage"
                        :page-size="store.projectDocumentPageSize"
                        :total="store.projectDocumentTotal"
                        :status="store.projectDocumentStatus"
                        @refresh="loadProjectDocuments"
                        @status-change="store.setProjectDocumentStatus"
                        @page-change="store.loadProjectDocumentPage"
                        @upload="uploadProjectDocument"
                        @parse="parseProjectDocument"
                        @retry-parse="retryProjectDocumentParse"
                        @create-suggestions="createArchiveSuggestions"
                        @retry-suggestions="retryArchiveSuggestions"
                        @create-manual-draft="createManualArchiveDraft"
                        @open-draft="openArchiveDraft"
                        @delete="deleteProjectDocument" />
                    <ArchiveDraftPanel
                        v-if="store.currentDraft"
                        :draft="store.currentDraft"
                        :loading="store.loading"
                        @suggest="createArchiveSuggestions"
                        @retry-suggest="retryArchiveSuggestions"
                        @regenerate="regenerateArchiveSuggestions"
                        @manual-draft="createManualArchiveDraft"
                        @save-field="saveArchiveField"
                        @notify="(message: string, kind?: 'ok' | 'info') => store.notifySuccess(message, kind)"
                        @confirm="confirmArchiveDocument"
                        @cancel-confirmation="cancelArchiveDocumentConfirmation" />
                    <ChecklistLinkPanel
                        v-if="store.currentDraft"
                        :document="store.currentDraft.document"
                        :checklist-items="store.checklistItems"
                        :suggestions="store.checklistLinkSuggestions"
                        :links="store.checklistLinks"
                        :loading="store.loading"
                        @refresh="loadChecklistLinkState"
                        @create="createChecklistLink"
                        @delete="deleteChecklistLink" />
                </template>

                <ArchiveCatalogPanel
                    v-else-if="activeView === 'archives' && activeProject"
                    :archives="store.archives"
                    :page="store.archivePage.page"
                    :page-size="store.archivePage.page_size"
                    :total="store.archivePage.total"
                    :filters="store.archiveFilters"
                    :loading="store.loading"
                    :current-archive="store.currentArchive"
                    @filter-change="changeArchiveFilters"
                    @page-change="store.loadArchivePage"
                    @open-detail="loadArchiveDetail" />

                <ArchiveQuestionPanel v-else-if="activeView === 'questions' && activeProject" :answer="store.archiveAnswer" :retrieval="store.archiveRetrieval" :loading="store.loading" @ask="askArchiveQuestion" @retrieve="retrieveArchiveEvidence" />

                <ArchiveAgentPanel
                    v-else-if="activeView === 'agent' && activeProject"
                    :session="store.archiveAgentSession"
                    :messages="store.archiveAgentMessages"
                    :last-response="store.archiveAgentLastResponse"
                    :tool-calls="store.archiveAgentToolCalls"
                    :loading="store.loading"
                    @create-session="createArchiveAgentSession"
                    @send="sendArchiveAgentMessage"
                    @refresh-history="loadArchiveAgentMessages"
                    @refresh-tool-calls="loadArchiveAgentToolCalls" />

                <ArchiveAuditPanel
                    v-else-if="activeView === 'audit' && activeProject"
                    :logs="store.auditLogs"
                    :page="store.auditPage.page"
                    :page-size="store.auditPage.page_size"
                    :total="store.auditPage.total"
                    :operation-type="store.auditOperationType"
                    :loading="store.loading"
                    @filter-change="changeAuditOperationType"
                    @page-change="store.loadAuditPage"
                    @refresh="loadAuditLogs" />

                <section v-else-if="activeView === 'settings'" class="settings-page">
                    <header class="page-heading">
                        <div>
                            <span class="eyebrow">PROJECT SETTINGS</span>
                            <h1>项目设置</h1>
                            <p>修改名称或项目说明时必须携带当前版本，服务端会拒绝过期更新。</p>
                        </div>
                    </header>
                    <div v-if="activeProject" class="settings-grid">
                        <form class="dashboard-card settings-form" @submit.prevent="saveProjectSettings">
                            <label>项目名称<input v-model="settingsName" maxlength="200" required /></label><label>项目说明<textarea v-model="settingsDescription" maxlength="2000" placeholder="可选的项目说明"></textarea></label>
                            <p class="version-note">当前版本 v{{ activeProject.version }} · 最后更新 {{ formatDate(activeProject.updated_at) }}</p>
                            <button class="primary-button" :disabled="store.loading['update-project']">{{ store.loading['update-project'] ? '正在保存…' : '保存项目设置' }}</button>
                        </form>
                        <aside class="danger-zone">
                            <span>危险操作</span>
                            <h2>删除空项目</h2>
                            <p>后端仅允许删除没有文档的项目。当前文档计数：{{ activeProject.active_document_count }}。</p>
                            <button class="danger-button" :disabled="activeProject.active_document_count > 0 || store.loading['delete-project']" @click="deleteProject">删除项目</button>
                        </aside>
                    </div>
                </section>

                <UnavailablePanel v-else :title="({ checklist: '项目与清单', documents: '文档处理', archives: '正式档案', questions: '智能检索', agent: '档案助手', audit: '审计日志' } as Record<string, string>)[activeView]" :feature="archiveFeature[0]" :description="archiveFeature[1]" />
            </section>
        </section>

        <div v-if="createOpen" class="modal-backdrop" @click.self="createOpen = false">
            <form class="project-modal" @submit.prevent="createProject">
                <div>
                    <span class="eyebrow">FR-030</span>
                    <h2>新建工程项目</h2>
                    <button type="button" class="modal-close" aria-label="关闭" @click="createOpen = false">×</button>
                </div>
                <label>项目名称<input v-model="projectName" maxlength="200" placeholder="例如：滨江研发中心改造项目" autofocus required /> </label><label>项目说明<textarea v-model="projectDescription" maxlength="2000" placeholder="可选；不填写行业扩展字段"></textarea></label>
                <label class="checkbox-row"> <input v-model="useDemoChecklist" type="checkbox" />复制五项虚构演示清单<small>仅用于学习和验收，不代表法定或行业归档要求。</small></label>
                <button class="primary-button" :disabled="!projectName.trim() || store.loading['create-project']">{{ store.loading['create-project'] ? '正在创建…' : '创建项目' }}</button>
                <p v-if="store.error" class="form-error" data-testid="modal-error">
                    <strong v-if="store.errorStatus">HTTP {{ store.errorStatus }}</strong>
                    {{ store.error }}
                </p>
            </form>
        </div>
    </div>
</template>
