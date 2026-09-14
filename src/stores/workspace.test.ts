import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ApiError, api } from '../services/api'
import { useWorkspaceStore } from './workspace'

vi.mock('../services/api', async (original) => {
  const module = await original<typeof import('../services/api')>()
  return { ...module, setApiUser: vi.fn(), api: { ...module.api, listKnowledgeBases: vi.fn(), listDocuments: vi.fn(), listSessions: vi.fn() } }
})

describe('workspace store', () => {
  beforeEach(() => { localStorage.clear(); setActivePinia(createPinia()); vi.clearAllMocks() })

  it('clears dependent state when user changes', async () => {
    vi.mocked(api.listKnowledgeBases).mockResolvedValue([])
    const store = useWorkspaceStore()
    store.documents = [{ id: 'doc', kb_id: 'kb', original_name: 'a.txt', suffix: '.txt', content_hash: '', status: 'READY', chunk_count: 1, error_message: null, created_at: '', updated_at: '' }]
    store.sessions = [{ id: 'session', owner_id: 'old', kb_id: 'kb', title: 'old', created_at: '' }]
    await store.activateUser('new-user', '新用户')
    expect(store.documents).toEqual([])
    expect(store.sessions).toEqual([])
    expect(store.currentKbId).toBe('')
    expect(localStorage.getItem('mini-rag-user-id')).toBe('new-user')
  })

  it('resets documents, sessions, messages and retrieval when knowledge base changes', async () => {
    vi.mocked(api.listDocuments).mockResolvedValue([])
    vi.mocked(api.listSessions).mockResolvedValue([])
    const store = useWorkspaceStore()
    store.messages = [{ role: 'assistant', content: 'answer', rejected: false, sources: [] }]
    store.retrieval = { question: 'q', top_k: 10, top_n: 3, threshold: .5, chunks: [] }
    await store.selectKnowledgeBase('kb-new')
    expect(store.messages).toEqual([])
    expect(store.retrieval).toBeNull()
    expect(localStorage.getItem('mini-rag-kb-id')).toBe('kb-new')
  })

  it('prevents duplicate keyed operations', async () => {
    const store = useWorkspaceStore()
    let release!: () => void
    const pending = new Promise<void>((resolve) => { release = resolve })
    const action = vi.fn(() => pending)
    const first = store.run('parse-doc', action)
    const second = store.run('parse-doc', action)
    expect(action).toHaveBeenCalledTimes(1)
    expect(await second).toBeUndefined()
    release(); await first
  })

  it('keeps only HTTP status and error message for display', async () => {
    const store = useWorkspaceStore()
    const action = () => Promise.reject(new ApiError('VALIDATION_ERROR', '请求参数校验失败。', 422, [{ loc: ['header'], msg: 'hidden detail' }]))
    await expect(store.run('invalid', action)).rejects.toThrow('请求参数校验失败。')
    expect(store.errorStatus).toBe(422)
    expect(store.error).toBe('请求参数校验失败。')
    expect('errorDetails' in store).toBe(false)
  })
})
