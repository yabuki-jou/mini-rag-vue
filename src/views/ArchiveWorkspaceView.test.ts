import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ArchiveWorkspaceView from './ArchiveWorkspaceView.vue'

const draft = {
    document: {
        id: 'document-1',
        filename: '施工方案.txt',
        file_hash: 'a'.repeat(64),
        status: 'PARSED',
        last_error: { code: null, message: null },
        field_summary: { checked_count: 0, total_count: 7 },
        confirmed_at: null,
        version: 4,
        uploaded_at: '2026-08-27T00:00:00Z',
        updated_at: '2026-08-27T00:00:00Z'
    },
    fields: [
        {
            id: 'field-1',
            field_name: 'TITLE',
            text_value: '施工方案',
            date_value: null,
            json_value: null,
            review_status: 'PENDING_CHECK',
            source: 'AI',
            no_source_evidence: false,
            updated_by: 'AI',
            updated_at: '2026-08-27T00:00:00Z',
            evidences: []
        }
    ],
    snapshot: null,
    next_actions: ['确认字段']
}

const store = {
    isAuthenticated: true,
    hasSession: true,
    username: 'demo',
    userName: '演示用户',
    projects: [{ id: 'project-1', name: '演示项目', description: null, kb_id: 'kb-1', version: 1, active_document_count: 1, uses_demo_checklist: true, created_at: '2026-08-27T00:00:00Z', updated_at: '2026-08-27T00:00:00Z' }],
    activeProjectId: 'project-1',
    activeProject: null as unknown,
    checklistLinkSuggestions: [],
    checklistLinks: [],
    projectDocuments: [draft.document],
    checklistItems: [],
    currentDraft: draft as typeof draft | null,
    projectDocumentPage: 1,
    projectDocumentPageSize: 20,
    projectDocumentTotal: 1,
    projectDocumentStatus: '',
    archives: [],
    archivePage: { page: 1, page_size: 20, total: 0 },
    archiveFilters: {},
    currentArchive: null,
    auditLogs: [],
    auditPage: { page: 1, page_size: 20, total: 0 },
    auditOperationType: '',
    archiveAnswer: null,
    archiveRetrieval: null,
    loading: {},
    error: '',
    errorStatus: null,
    selectProject: vi.fn(),
    restoreSession: vi.fn().mockResolvedValue(undefined),
    loadProjectDocuments: vi.fn().mockResolvedValue(undefined),
    loadChecklistItems: vi.fn(),
    deleteProjectDocument: vi.fn().mockResolvedValue(undefined),
    setProjectDocumentStatus: vi.fn(),
    loadProjectDocumentPage: vi.fn(),
    loadArchives: vi.fn(),
    setArchiveFilters: vi.fn(),
    loadArchivePage: vi.fn(),
    loadArchiveDetail: vi.fn(),
    loadAuditLogs: vi.fn(),
    setAuditOperationType: vi.fn(),
    loadAuditPage: vi.fn(),
    askArchiveQuestion: vi.fn(),
    retrieveArchives: vi.fn(),
    loadArchiveDraft: vi.fn().mockResolvedValue(draft),
    createArchiveSuggestions: vi.fn().mockResolvedValue(draft),
    retryArchiveSuggestions: vi.fn(),
    regenerateArchiveSuggestions: vi.fn(),
    createManualArchiveDraft: vi.fn(),
    updateArchiveField: vi.fn(),
    confirmArchiveDocument: vi.fn(),
    cancelArchiveDocumentConfirmation: vi.fn(),
    loadChecklistLinkState: vi.fn().mockResolvedValue(undefined),
    createChecklistLink: vi.fn(),
    deleteChecklistLink: vi.fn(),
    clearError: vi.fn(),
    signOut: vi.fn(),
    login: vi.fn().mockResolvedValue(undefined),
    register: vi.fn().mockResolvedValue(undefined),
    confirm: vi.fn().mockResolvedValue(false),
    notifySuccess: vi.fn(),
    clearSuccess: vi.fn(),
    resolveConfirm: vi.fn(),
    success: '',
    confirmDialog: null
}
store.activeProject = store.projects[0]

const router = { push: vi.fn(), replace: vi.fn() }
const route = { name: 'documents', params: { projectId: 'project-1' } }

vi.mock('../stores/archive-workspace', () => ({ useArchiveWorkspaceStore: () => store }))
vi.mock('../services/api', () => ({ api: { health: vi.fn().mockResolvedValue({ status: 'ok' }) } }))
vi.mock('vue-router', () => ({
    useRoute: () => route,
    useRouter: () => router
}))

describe('ArchiveWorkspaceView FR-034/035 wiring', () => {
    it('clears a stale project route after login loads another account projects', async () => {
        const previousAuthenticated = store.isAuthenticated
        const previousProjects = store.projects
        const previousProjectId = route.params.projectId
        store.isAuthenticated = false
        store.projects = [{ ...previousProjects[0], id: 'project-new' }]
        route.params.projectId = 'project-old'
        store.login.mockClear()
        router.replace.mockClear()
        const wrapper = mount(ArchiveWorkspaceView)

        try {
            const inputs = wrapper.findAll('.identity-form input')
            await inputs[0].setValue('new-user')
            await inputs[1].setValue('password')
            await wrapper.get('.identity-form').trigger('submit')
            await flushPromises()

            expect(store.login).toHaveBeenCalledWith({ username: 'new-user', password: 'password' })
            expect(router.replace).toHaveBeenCalledWith('/')
        } finally {
            wrapper.unmount()
            store.isAuthenticated = previousAuthenticated
            store.projects = previousProjects
            route.params.projectId = previousProjectId
        }
    })

    it('clears a stale project route after registration automatically logs in', async () => {
        const previousAuthenticated = store.isAuthenticated
        const previousProjects = store.projects
        const previousProjectId = route.params.projectId
        store.isAuthenticated = false
        store.projects = [{ ...previousProjects[0], id: 'project-new' }]
        route.params.projectId = 'project-old'
        store.register.mockClear()
        router.replace.mockClear()
        const wrapper = mount(ArchiveWorkspaceView)

        try {
            await wrapper.get('.identity-form .text-button').trigger('click')
            const inputs = wrapper.findAll('.identity-form input')
            await inputs[0].setValue('新用户')
            await inputs[1].setValue('new-user')
            await inputs[2].setValue('password1')
            await inputs[3].setValue('password1')
            await wrapper.get('.identity-form').trigger('submit')
            await flushPromises()

            expect(store.register).toHaveBeenCalledWith({ username: 'new-user', name: '新用户', password: 'password1' })
            expect(router.replace).toHaveBeenCalledWith('/')
        } finally {
            wrapper.unmount()
            store.isAuthenticated = previousAuthenticated
            store.projects = previousProjects
            route.params.projectId = previousProjectId
        }
    })

    it('keeps a valid deep link and selects its project after login', async () => {
        const previousAuthenticated = store.isAuthenticated
        const previousProjectId = route.params.projectId
        store.isAuthenticated = false
        route.params.projectId = 'project-1'
        store.login.mockClear()
        store.selectProject.mockClear()
        router.replace.mockClear()
        const wrapper = mount(ArchiveWorkspaceView)

        try {
            const inputs = wrapper.findAll('.identity-form input')
            await inputs[0].setValue('demo')
            await inputs[1].setValue('password')
            await wrapper.get('.identity-form').trigger('submit')
            await flushPromises()

            expect(store.selectProject).toHaveBeenCalledWith('project-1')
            expect(router.replace).not.toHaveBeenCalled()
        } finally {
            wrapper.unmount()
            store.isAuthenticated = previousAuthenticated
            route.params.projectId = previousProjectId
        }
    })

    it('clears the project route after signing out', async () => {
        store.signOut.mockClear()
        router.replace.mockClear()
        const wrapper = mount(ArchiveWorkspaceView)

        try {
            await wrapper.get('.user-chip').trigger('click')
            await flushPromises()

            expect(store.signOut).toHaveBeenCalledOnce()
            expect(router.replace).toHaveBeenCalledWith('/')
        } finally {
            wrapper.unmount()
        }
    })

    it('renders the FR-041 audit panel and loads the selected project logs', async () => {
        route.name = 'audit'
        const wrapper = mount(ArchiveWorkspaceView)
        expect(wrapper.find('[data-testid="archive-audit-panel"]').exists()).toBe(true)
        expect(store.loadAuditLogs).toHaveBeenCalled()
        wrapper.unmount()
        route.name = 'documents'
    })

    it('does not delete when the physical-delete confirmation is cancelled', async () => {
        const confirmMock = vi.mocked(store.confirm).mockResolvedValue(false)
        const wrapper = mount(ArchiveWorkspaceView)

        await wrapper.get('[data-testid="delete-project-document"]').trigger('click')
        await flushPromises()

        expect(confirmMock).toHaveBeenCalledWith(expect.stringContaining('施工方案.txt'), expect.anything(), true)
        expect(store.deleteProjectDocument).not.toHaveBeenCalled()
        confirmMock.mockRestore()
        wrapper.unmount()
    })

    it('confirms physical deletion once and delegates to the selected project store', async () => {
        const confirmMock = vi.mocked(store.confirm).mockResolvedValue(true)
        const wrapper = mount(ArchiveWorkspaceView)

        await wrapper.get('[data-testid="delete-project-document"]').trigger('click')
        await flushPromises()

        expect(confirmMock).toHaveBeenCalledWith(expect.stringContaining('物理删除'), expect.anything(), true)
        expect(store.deleteProjectDocument).toHaveBeenCalledOnce()
        expect(store.deleteProjectDocument).toHaveBeenCalledWith('document-1')
        confirmMock.mockRestore()
        wrapper.unmount()
    })

    it('renders the FR-039 question panel on the questions route without auto-submitting', () => {
        const previousRouteName = route.name
        route.name = 'questions'
        const wrapper = mount(ArchiveWorkspaceView)

        try {
            expect(wrapper.find('[data-testid="archive-question-panel"]').exists()).toBe(true)
            expect(store.askArchiveQuestion).not.toHaveBeenCalled()
            expect(store.retrieveArchives).not.toHaveBeenCalled()
        } finally {
            wrapper.unmount()
            route.name = previousRouteName
        }
    })

    it('renders the FR-038 archive catalog on the archives route', () => {
        const previousRouteName = route.name
        route.name = 'archives'
        const wrapper = mount(ArchiveWorkspaceView)

        try {
            expect(wrapper.text()).toContain('正式档案目录')
            expect(wrapper.find('[data-testid="archive-catalog-panel"]').exists()).toBe(true)
            expect(store.loadArchives).toHaveBeenCalled()
        } finally {
            wrapper.unmount()
            route.name = previousRouteName
        }
    })

    it('starts suggestions or a manual draft directly from a parsed document row', async () => {
        const previousDraft = store.currentDraft
        const previousDocuments = store.projectDocuments
        store.currentDraft = null
        store.projectDocuments = [{ ...draft.document, status: 'PARSED' }]
        const wrapper = mount(ArchiveWorkspaceView)

        await wrapper.get('[data-testid="create-archive-suggestions"]').trigger('click')
        expect(store.createArchiveSuggestions).toHaveBeenCalledWith('document-1')
        await wrapper.get('[data-testid="create-manual-draft"]').trigger('click')
        expect(store.createManualArchiveDraft).toHaveBeenCalledWith('document-1')

        wrapper.unmount()
        store.currentDraft = previousDraft
        store.projectDocuments = previousDocuments
    })

    it('opens an existing seven-field draft only from a confirmation-state document row', async () => {
        const previousDraft = store.currentDraft
        const previousDocuments = store.projectDocuments
        const pendingDraft = {
            ...draft,
            document: { ...draft.document, status: 'PENDING_CONFIRMATION' },
            fields: ['TITLE', 'DOCUMENT_TYPE', 'DOCUMENT_DATE', 'AUTHORING_ORGANIZATION', 'VERSION_NUMBER', 'PROJECT_STAGE', 'KEYWORDS'].map((fieldName, index) => ({
                ...draft.fields[0],
                id: `field-${index}`,
                field_name: fieldName
            }))
        }
        store.currentDraft = pendingDraft
        store.projectDocuments = [pendingDraft.document]
        const wrapper = mount(ArchiveWorkspaceView)

        await wrapper.get('[data-testid="open-archive-draft"]').trigger('click')
        expect(store.loadArchiveDraft).toHaveBeenCalledWith('document-1')
        expect(wrapper.text()).toContain('字段草稿')

        wrapper.unmount()
        store.currentDraft = previousDraft
        store.projectDocuments = previousDocuments
    })

    it('keeps the documents view available when no draft is selected', () => {
        const previousDraft = store.currentDraft
        store.currentDraft = null
        const wrapper = mount(ArchiveWorkspaceView)

        expect(wrapper.find('[data-testid="project-document-file"]').exists()).toBe(true)
        expect(wrapper.text()).not.toContain('前端尚未接入')
        expect(wrapper.find('[data-testid="unavailable-panel"]').exists()).toBe(false)

        wrapper.unmount()
        store.currentDraft = previousDraft
    })

    it('wires confirm and cancel actions from the draft panel to the selected project store', async () => {
        const previousDraft = store.currentDraft
        const previousDocuments = store.projectDocuments
        const confirmedDraft = {
            ...draft,
            document: { ...draft.document, status: 'PENDING_CONFIRMATION' as const, version: 4 },
            fields: ['TITLE', 'DOCUMENT_TYPE', 'DOCUMENT_DATE', 'AUTHORING_ORGANIZATION', 'VERSION_NUMBER', 'PROJECT_STAGE', 'KEYWORDS'].map((fieldName, index) => ({
                ...draft.fields[0],
                id: `field-${index}`,
                field_name: fieldName,
                review_status: 'VALUE_CONFIRMED' as const
            }))
        }
        store.currentDraft = confirmedDraft
        store.projectDocuments = [confirmedDraft.document]
        const wrapper = mount(ArchiveWorkspaceView)

        await wrapper.get('[data-testid="confirm-archive"]').trigger('click')
        expect(store.confirmArchiveDocument).toHaveBeenCalledWith('document-1', 4)

        wrapper.unmount()
        store.currentDraft = { ...confirmedDraft, document: { ...confirmedDraft.document, status: 'CONFIRMED' as const, version: 5 } }
        const confirmedWrapper = mount(ArchiveWorkspaceView)
        await confirmedWrapper.get('[data-testid="cancel-confirmation"]').trigger('click')
        expect(store.cancelArchiveDocumentConfirmation).toHaveBeenCalledWith('document-1', 5)

        confirmedWrapper.unmount()
        store.currentDraft = previousDraft
        store.projectDocuments = previousDocuments
    })

    it('passes the selected draft and current link state to the independent link panel', () => {
        const wrapper = mount(ArchiveWorkspaceView)
        expect(wrapper.find('[data-testid="checklist-link-panel"]').exists()).toBe(true)
        expect(store.loadChecklistLinkState).toHaveBeenCalledWith('document-1')
        wrapper.unmount()
    })
})
