import { defineStore } from 'pinia'
import { ApiError, api, setLegacySessionScope } from '../services/api'
import type { ChatMessage, ChatSession, DocumentRecord, KnowledgeBase, RetrievalResponse } from '../types'

export const useWorkspaceStore = defineStore('workspace', {
  state: () => ({
    userId: localStorage.getItem('mini-rag-user-id') || '',
    userName: localStorage.getItem('mini-rag-user-name') || '',
    knowledgeBases: [] as KnowledgeBase[],
    currentKbId: localStorage.getItem('mini-rag-kb-id') || '',
    documents: [] as DocumentRecord[], sessions: [] as ChatSession[], currentSessionId: localStorage.getItem('mini-rag-session-id') || '',
    messages: [] as ChatMessage[], retrieval: null as RetrievalResponse | null,
    loading: {} as Record<string, boolean>, error: '', errorStatus: null as number | null,
  }),
  getters: {
    currentKb: (state) => state.knowledgeBases.find((kb) => kb.id === state.currentKbId),
    currentSession: (state) => state.sessions.find((session) => session.id === state.currentSessionId),
    readyDocuments: (state) => state.documents.filter((doc) => doc.status === 'READY').length,
  },
  actions: {
    async run<T>(key: string, action: () => Promise<T>): Promise<T | undefined> {
      if (this.loading[key]) return
      this.loading[key] = true; this.clearError()
      try { return await action() } catch (error) {
        this.error = error instanceof Error ? error.message : '发生未知错误'
        if (error instanceof ApiError) this.errorStatus = error.status
        throw error
      }
      finally { this.loading[key] = false }
    },
    clearError() { this.error = ''; this.errorStatus = null },
    async activateUser(id: string, name = '') {
      const normalizedId = id.trim()
      const sameUser = Boolean(this.userId) && this.userId === normalizedId
      this.userId = normalizedId; this.userName = name.trim() || this.userName; setLegacySessionScope(this.userId)
      localStorage.setItem('mini-rag-user-id', this.userId)
      if (this.userName) localStorage.setItem('mini-rag-user-name', this.userName)
      this.knowledgeBases = []; this.documents = []; this.sessions = []; this.messages = []; this.retrieval = null
      this.currentKbId = ''; this.currentSessionId = ''
      if (!sameUser) {
        localStorage.removeItem('mini-rag-kb-id'); localStorage.removeItem('mini-rag-session-id')
      }
      await this.loadKnowledgeBases()
    },
    logout() {
      this.$reset(); setLegacySessionScope('');
      ;['mini-rag-user-id', 'mini-rag-user-name', 'mini-rag-kb-id', 'mini-rag-session-id'].forEach((key) => localStorage.removeItem(key))
    },
    async loadKnowledgeBases() {
      await this.run('knowledgeBases', async () => {
        this.knowledgeBases = await api.listKnowledgeBases()
        const saved = localStorage.getItem('mini-rag-kb-id') || ''
        await this.selectKnowledgeBase(this.knowledgeBases.some((kb) => kb.id === saved) ? saved : this.knowledgeBases[0]?.id || '')
      })
    },
    async selectKnowledgeBase(id: string) {
      this.currentKbId = id; this.documents = []; this.sessions = []; this.messages = []; this.retrieval = null; this.currentSessionId = ''
      if (!id) { localStorage.removeItem('mini-rag-kb-id'); return }
      localStorage.setItem('mini-rag-kb-id', id)
      await Promise.all([this.loadDocuments(), this.loadSessions()])
    },
    async loadDocuments() { if (this.currentKbId) await this.run('documents', async () => { this.documents = await api.listDocuments(this.currentKbId) }) },
    async loadSessions() {
      if (!this.currentKbId) return
      await this.run('sessions', async () => {
        this.sessions = await api.listSessions(this.currentKbId)
        const saved = localStorage.getItem('mini-rag-session-id') || ''
        const id = this.sessions.some((s) => s.id === saved) ? saved : this.sessions[0]?.id || ''
        if (id) await this.selectSession(id)
      })
    },
    async selectSession(id: string) {
      this.currentSessionId = id; this.messages = []; this.clearError()
      if (!id) { localStorage.removeItem('mini-rag-session-id'); return }
      localStorage.setItem('mini-rag-session-id', id)
      await this.run('messages', async () => { this.messages = await api.listMessages(id) })
    },
  },
})
