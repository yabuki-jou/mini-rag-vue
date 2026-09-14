<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { api } from '../services/api'
import { useWorkspaceStore } from '../stores/workspace'
import type { DocumentRecord } from '../types'
import ServiceStatus from '../components/common/ServiceStatus.vue'

const store = useWorkspaceStore()
const activeView = ref<'overview' | 'documents' | 'retrieval' | 'chat'>('overview')
const identityMode = ref<'create' | 'restore'>('create')
const identityValue = ref('')
const newKbName = ref('')
const newSessionTitle = ref('')
const retrievalQuestion = ref('')
const chatQuestion = ref('')
const uploadInput = ref<HTMLInputElement>()
const dragging = ref(false)
const health = ref<'checking' | 'ok' | 'degraded'>('checking')
const messagesEnd = ref<HTMLElement>()

const navigation = [
  { id: 'overview', label: '工作台', icon: '⌂' }, { id: 'documents', label: '文档管理', icon: '▤' },
  { id: 'retrieval', label: '检索测试', icon: '⌕' }, { id: 'chat', label: '智能问答', icon: '✦' },
] as const
const busy = computed(() => Object.values(store.loading).some(Boolean))
const formatDate = (value?: string) => value ? new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value + (value.endsWith('Z') ? '' : 'Z'))) : ''
const statusLabel: Record<string, string> = { UPLOADED: '待解析', PROCESSING: '解析中', READY: '可检索', FAILED: '解析失败', DELETING: '删除中', DELETE_FAILED: '删除失败' }

onMounted(async () => {
  api.health().then((result) => { health.value = result.status === 'ok' ? 'ok' : 'degraded' }).catch(() => { health.value = 'degraded' })
  if (store.userId) { try { await store.activateUser(store.userId, store.userName) } catch { store.logout() } }
})

async function submitIdentity() {
  // 该旧视图未注册到当前路由。身份创建已迁移到智慧档案页面的账号密码入口，
  // 不能再以 UUID 调用已删除的 /users 模拟身份接口。
  store.error = '请从智慧档案登录页面使用账号密码登录。'
  store.errorStatus = null
}
async function createKb() {
  const name = newKbName.value.trim(); if (!name) return
  const kb = await store.run('createKb', () => api.createKnowledgeBase(name)); if (!kb) return
  newKbName.value = ''; await store.loadKnowledgeBases(); await store.selectKnowledgeBase(kb.id)
}
async function upload(files: FileList | File[]) {
  if (!store.currentKbId) return
  for (const file of Array.from(files)) await store.run(`upload-${file.name}`, () => api.uploadDocument(store.currentKbId, file))
  await store.loadDocuments(); if (uploadInput.value) uploadInput.value.value = ''
}
async function parse(doc: DocumentRecord) { await store.run(`parse-${doc.id}`, () => api.parseDocument(store.currentKbId, doc.id)); await store.loadDocuments() }
async function remove(doc: DocumentRecord) {
  if (!confirm(`确定删除“${doc.original_name}”吗？相关向量也会一并清除。`)) return
  await store.run(`delete-${doc.id}`, () => api.deleteDocument(store.currentKbId, doc.id)); store.retrieval = null; await store.loadDocuments()
}
async function runRetrieval() {
  const question = retrievalQuestion.value.trim(); if (!question) return
  const result = await store.run('retrieval', () => api.retrieve(store.currentKbId, question)); if (result) store.retrieval = result
}
async function createSession() {
  const title = newSessionTitle.value.trim() || '新会话'
  const session = await store.run('createSession', () => api.createSession(store.currentKbId, title)); if (!session) return
  newSessionTitle.value = ''; await store.loadSessions(); await store.selectSession(session.id)
}
async function sendMessage() {
  const question = chatQuestion.value.trim(); if (!question || !store.currentSessionId) return
  store.messages.push({ role: 'user', content: question, rejected: false, sources: [] }); chatQuestion.value = ''; await nextTick(); messagesEnd.value?.scrollIntoView()
  try {
    const result = await store.run('sendMessage', () => api.sendMessage(store.currentSessionId, question))
    if (result) store.messages.push({ role: 'assistant', content: result.answer, rejected: result.rejected, sources: result.sources })
    await store.loadSessions()
  } catch { store.messages = store.messages.filter((message) => message.id || message.content !== question) }
  await nextTick(); messagesEnd.value?.scrollIntoView({ behavior: 'smooth' })
}
</script>

<template>
  <div v-if="!store.userId" class="identity-page">
    <div class="identity-art"><div class="brand brand-large"><span class="brand-mark">M</span><span>mini.rag</span></div><div class="orb orb-one"></div><div class="orb orb-two"></div><div class="identity-copy"><span class="eyebrow">FASTAPI × LANGCHAIN × MILVUS</span><h1>让知识，有据可循。</h1><p>上传资料、验证检索、开始一场带引用的智能问答。</p></div></div>
    <main class="identity-panel"><div class="identity-card"><div class="mobile-brand brand"><span class="brand-mark">M</span><span>mini.rag</span></div><span class="step">开始使用</span><h2>{{ identityMode === 'create' ? '创建学习身份' : '恢复已有身份' }}</h2><p class="muted">这里使用用户 UUID 模拟身份，仅适用于本地学习环境。</p><form @submit.prevent="submitIdentity"><label>{{ identityMode === 'create' ? '你的称呼' : '用户 UUID' }}</label><input v-model="identityValue" :placeholder="identityMode === 'create' ? '例如：张三' : '粘贴已有 UUID'" autofocus /><button class="primary wide" :disabled="!identityValue.trim() || store.loading.identity">{{ store.loading.identity ? '正在连接…' : identityMode === 'create' ? '创建并进入' : '恢复工作台' }}</button></form><button class="text-button" @click="identityMode = identityMode === 'create' ? 'restore' : 'create'">{{ identityMode === 'create' ? '已有用户 UUID？恢复身份' : '没有身份？创建一个' }}</button><div v-if="store.error" class="inline-error error-detail"><strong v-if="store.errorStatus">HTTP {{ store.errorStatus }}</strong><span>{{ store.error }}</span></div></div></main>
  </div>

  <div v-else class="app-shell">
    <header class="sidebar"><div class="brand"><span class="brand-mark">M</span><span>Mini RAG</span></div><nav><button v-for="item in navigation" :key="item.id" :class="{ active: activeView === item.id }" @click="activeView = item.id"><span>{{ item.icon }}</span>{{ item.label }}</button></nav><div class="sidebar-foot"><ServiceStatus :status="health" /><button class="user-card" @click="store.logout"><span class="avatar">{{ (store.userName || 'U').slice(0, 1).toUpperCase() }}</span><span><strong>{{ store.userName || '已恢复用户' }}</strong><small>{{ store.userId.slice(0, 8) }}… · 切换</small></span></button></div></header>
    <main class="main-content"><header class="topbar"><div><span class="breadcrumb">知识工作台 /</span><strong>{{ navigation.find(n => n.id === activeView)?.label }}</strong></div><div class="kb-switcher"><span>当前知识库</span><select :value="store.currentKbId" @change="store.selectKnowledgeBase(($event.target as HTMLSelectElement).value)"><option value="">请选择知识库</option><option v-for="kb in store.knowledgeBases" :key="kb.id" :value="kb.id">{{ kb.name }}</option></select></div></header><div v-if="store.error" class="error-banner"><span>!</span><div><strong v-if="store.errorStatus">HTTP {{ store.errorStatus }}</strong><p>{{ store.error }}</p></div><button @click="store.clearError()">×</button></div>

      <section v-if="activeView === 'overview'" class="page home-page"><div class="hero"><div><span class="eyebrow">MINI RAG WORKSPACE</span><h1>欢迎来到 <span>Mini RAG</span></h1><p>{{ store.currentKb ? `“${store.currentKb.name}”已准备好，继续构建你的可信知识空间。` : `你好，${store.userName || '学习者'}。从一个知识库开始。` }}</p></div><button class="primary" @click="activeView = 'documents'">＋ 添加知识</button></div><div class="stats"><article><span class="stat-icon violet">◫</span><div><small>知识库</small><strong>{{ store.knowledgeBases.length }}</strong></div><em>个空间</em></article><article><span class="stat-icon blue">▤</span><div><small>全部文档</small><strong>{{ store.documents.length }}</strong></div><em>份资料</em></article><article><span class="stat-icon green">✓</span><div><small>可检索文档</small><strong>{{ store.readyDocuments }}</strong></div><em>已就绪</em></article><article><span class="stat-icon amber">✦</span><div><small>问答会话</small><strong>{{ store.sessions.length }}</strong></div><em>条会话</em></article></div><div class="overview-grid"><article class="panel knowledge-section"><div class="panel-title"><div><span class="section-kicker">KNOWLEDGE BASES</span><h2>▱ 知识库</h2></div><button class="icon-button" @click="store.loadKnowledgeBases">↻</button></div><form class="inline-form" @submit.prevent="createKb"><input v-model="newKbName" placeholder="新知识库名称" maxlength="120" /><button class="primary" :disabled="!newKbName.trim()">创建</button></form><button v-for="kb in store.knowledgeBases" :key="kb.id" class="kb-row" :class="{ selected: store.currentKbId === kb.id }" @click="store.selectKnowledgeBase(kb.id)"><span class="folder">W</span><span><strong>{{ kb.name }}</strong><small>{{ formatDate(kb.created_at) }}</small></span><i>›</i></button><div v-if="!store.knowledgeBases.length" class="empty compact">还没有知识库</div></article><article class="panel files-section"><div class="panel-title"><div><span class="section-kicker">RECENT FILES</span><h2>▤ 最近文档</h2></div><button class="link-button" @click="activeView = 'documents'">查看全部 →</button></div><div v-for="doc in store.documents.slice(0, 5)" :key="doc.id" class="recent-row"><span class="file-type">{{ doc.suffix.slice(1).toUpperCase() }}</span><span><strong>{{ doc.original_name }}</strong><small>{{ doc.chunk_count }} Chunks · {{ formatDate(doc.updated_at) }}</small></span><span class="status" :class="doc.status.toLowerCase()">{{ statusLabel[doc.status] }}</span></div><div v-if="!store.documents.length" class="empty compact">选择知识库并上传第一份文档</div></article></div></section>

      <section v-else-if="activeView === 'documents'" class="page"><div class="page-heading"><div><span class="eyebrow">DOCUMENT PIPELINE</span><h1>文档管理</h1><p>上传资料并解析为可检索的向量 Chunks。</p></div><button class="secondary" @click="store.loadDocuments">↻ 刷新</button></div><div v-if="!store.currentKbId" class="empty large"><span>◇</span><h3>请先选择知识库</h3><p>在顶部选择或前往工作台创建知识库。</p></div><template v-else><div class="dropzone" :class="{ dragging }" @dragover.prevent="dragging = true" @dragleave.prevent="dragging = false" @drop.prevent="dragging = false; upload($event.dataTransfer!.files)" @click="uploadInput?.click()"><input ref="uploadInput" type="file" multiple accept=".txt,.md,.pdf,.docx" hidden @change="upload(($event.target as HTMLInputElement).files!)" /><span class="upload-icon">↑</span><div><strong>拖拽文件到这里，或点击选择</strong><p>支持 TXT、Markdown、PDF、DOCX · 单文件不超过 20 MB</p></div></div><div class="table-panel"><div class="table-head"><h2>文档列表 <span>{{ store.documents.length }}</span></h2><small v-if="busy">正在处理任务，请勿关闭页面</small></div><div v-if="!store.documents.length" class="empty"><p>还没有上传文档</p></div><div v-else class="doc-list"><article v-for="doc in store.documents" :key="doc.id" class="doc-row"><span class="file-type large">{{ doc.suffix.slice(1).toUpperCase() }}</span><div class="doc-info"><strong>{{ doc.original_name }}</strong><small>{{ formatDate(doc.created_at) }} · {{ doc.chunk_count }} Chunks</small><p v-if="doc.error_message" class="doc-error">{{ doc.error_message }}</p></div><span class="status" :class="doc.status.toLowerCase()"><i></i>{{ statusLabel[doc.status] || doc.status }}</span><div class="row-actions"><button v-if="['UPLOADED','FAILED','READY'].includes(doc.status)" class="secondary small" :disabled="busy" @click="parse(doc)">{{ doc.status === 'READY' ? '重新解析' : '解析入库' }}</button><button class="danger-icon" :disabled="busy" aria-label="删除文档" @click="remove(doc)">⌫</button></div></article></div></div></template></section>

      <section v-else-if="activeView === 'retrieval'" class="page"><div class="page-heading"><div><span class="eyebrow">VECTOR SEARCH LAB</span><h1>检索测试</h1><p>绕过大模型，直接观察 Milvus 的召回结果与相似度。</p></div></div><div v-if="!store.currentKbId" class="empty large"><h3>请先选择知识库</h3></div><template v-else><form class="query-box" @submit.prevent="runRetrieval"><textarea v-model="retrievalQuestion" placeholder="输入一个需要在知识库中检索的问题…" maxlength="4000"></textarea><div><span>将使用当前知识库 · {{ store.currentKb?.name }}</span><button class="primary" :disabled="!retrievalQuestion.trim() || store.loading.retrieval">{{ store.loading.retrieval ? '正在向量检索…' : '⌕ 开始检索' }}</button></div></form><div v-if="store.retrieval" class="retrieval-results"><div class="metrics"><span>候选 Top-K <strong>{{ store.retrieval.top_k }}</strong></span><span>返回 Top-N <strong>{{ store.retrieval.top_n }}</strong></span><span>最低阈值 <strong>{{ store.retrieval.threshold.toFixed(2) }}</strong></span><span>命中 <strong>{{ store.retrieval.chunks.length }}</strong></span></div><article v-for="(chunk, index) in store.retrieval.chunks" :key="chunk.chunk_id" class="chunk-card"><header><span class="rank">#{{ index + 1 }}</span><strong>{{ chunk.document_name }}</strong><span v-if="chunk.page">第 {{ chunk.page }} 页</span><em>{{ (chunk.score * 100).toFixed(1) }}%</em></header><p>{{ chunk.content }}</p><footer>Chunk ID · {{ chunk.chunk_id }}</footer></article><div v-if="!store.retrieval.chunks.length" class="empty large"><span>⌕</span><h3>没有 Chunk 通过阈值</h3><p>换一种问法，或检查文档是否已经解析入库。</p></div></div></template></section>

      <section v-else class="chat-page"><aside class="sessions"><div class="sessions-head"><div><span class="section-kicker">CONVERSATIONS</span><h2>会话</h2></div><button class="icon-button" @click="store.loadSessions">↻</button></div><form @submit.prevent="createSession"><input v-model="newSessionTitle" placeholder="新会话标题" /><button class="primary" :disabled="!store.currentKbId">＋</button></form><button v-for="session in store.sessions" :key="session.id" class="session-row" :class="{ active: store.currentSessionId === session.id }" @click="store.selectSession(session.id)"><span>✦</span><div><strong>{{ session.title }}</strong><small>{{ formatDate(session.created_at) }}</small></div></button><div v-if="!store.sessions.length" class="empty compact">创建一场有据可循的问答</div></aside><div class="conversation"><header><div><span class="assistant-avatar">✦</span><span><strong>{{ store.currentSession?.title || '智能问答' }}</strong><small>{{ store.currentKb?.name || '请先选择知识库' }}</small></span></div><ServiceStatus :status="health" compact /></header><div class="messages"><div v-if="!store.currentSessionId" class="chat-empty"><span>✦</span><h2>从知识中找到答案</h2><p>创建或选择一个会话，回答将严格依据已解析的文档，并附带来源引用。</p></div><template v-else><article v-for="(message, index) in store.messages" :key="message.id || index" class="message" :class="message.role"><span class="message-avatar">{{ message.role === 'user' ? (store.userName || 'U').slice(0,1) : '✦' }}</span><div><div class="bubble" :class="{ rejected: message.rejected }">{{ message.content }}</div><details v-if="message.sources.length" class="sources"><summary>{{ message.sources.length }} 条引用依据</summary><article v-for="source in message.sources" :key="source.chunk_id"><header><strong>[{{ source.source_id }}] {{ source.document_name }}</strong><span>{{ source.page ? `第 ${source.page} 页 · ` : '' }}{{ (source.score * 100).toFixed(1) }}%</span></header><p>{{ source.excerpt }}</p></article></details></div></article><div v-if="store.loading.sendMessage" class="typing"><span></span><span></span><span></span> 正在检索并生成回答</div><div ref="messagesEnd"></div></template></div><form class="composer" @submit.prevent="sendMessage"><textarea v-model="chatQuestion" :disabled="!store.currentSessionId" placeholder="向知识库提问，Enter 发送…" @keydown.enter.exact.prevent="sendMessage"></textarea><div><span>回答由 DeepSeek 生成，请核对引用来源</span><button class="primary" :disabled="!chatQuestion.trim() || !store.currentSessionId || store.loading.sendMessage">发送 ↑</button></div></form></div></section>
    </main>
  </div>
</template>
