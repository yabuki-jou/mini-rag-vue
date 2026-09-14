<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ProcessDocument } from '../../types'

const props = defineProps<{
  documents: ProcessDocument[]
  loading: Record<string, boolean>
  page?: number
  pageSize?: number
  total?: number
  status?: ProcessDocument['status'] | ''
}>()

const emit = defineEmits<{
  refresh: []
  'status-change': [status: ProcessDocument['status'] | '']
  'page-change': [page: number]
  upload: [file: File]
  parse: [documentId: string]
  'retry-parse': [documentId: string]
  'create-suggestions': [documentId: string]
  'retry-suggestions': [documentId: string]
  'create-manual-draft': [documentId: string]
  'open-draft': [documentId: string]
  delete: [documentId: string, filename: string]
}>()

const selectedFile = ref<File | null>(null)

const statusLabels: Record<ProcessDocument['status'], string> = {
  UPLOADED: '待解析',
  PARSE_FAILED: '解析失败',
  PARSED: '已解析',
  SUGGESTION_FAILED: '建议失败',
  PENDING_CONFIRMATION: '待人工确认',
  CONFIRMED: '已确认',
  PENDING_RECONFIRMATION: '待重新确认',
}

const parsingCount = computed(() => props.documents.filter((item) => item.status === 'UPLOADED').length)
const failedCount = computed(() => props.documents.filter((item) => item.status === 'PARSE_FAILED').length)
const currentPage = computed(() => props.page || 1)
const pageSize = computed(() => props.pageSize || 20)
const total = computed(() => props.total ?? props.documents.length)
const canPrev = computed(() => currentPage.value > 1)
const canNext = computed(() => currentPage.value * pageSize.value < total.value)

function selectFile(event: Event) {
  const input = event.target as HTMLInputElement
  selectedFile.value = input.files?.[0] || null
}

function upload() {
  if (selectedFile.value) emit('upload', selectedFile.value)
}

function canStartParse(document: ProcessDocument) {
  return document.status === 'UPLOADED'
}

function canRetryParse(document: ProcessDocument) {
  return document.status === 'PARSE_FAILED'
}

function canOpenDraft(document: ProcessDocument) {
  return ['PENDING_CONFIRMATION', 'CONFIRMED', 'PENDING_RECONFIRMATION'].includes(document.status)
}
</script>

<template>
  <section class="document-panel">
    <header class="document-header">
      <div>
        <span class="eyebrow">FR-032 / FR-033 · DOCUMENT PROCESSING</span>
        <h1>文档处理</h1>
        <p>上传后保持待解析；解析和失败重试由后端状态机裁决，页面不推断处理结果。</p>
      </div>
      <button class="secondary-button" :disabled="loading['project-documents']" @click="emit('refresh')">
        {{ loading['project-documents'] ? '刷新中…' : '刷新列表' }}
      </button>
    </header>

    <section class="upload-box" aria-label="项目文档上传">
      <div>
        <b>上传项目资料</b>
        <small>支持 PDF、DOCX、TXT、MD；单文件不超过 20 MiB。上传不会自动解析或生成 AI 建议。</small>
      </div>
      <div class="upload-controls">
        <input data-testid="project-document-file" type="file" accept=".pdf,.docx,.txt,.md" @change="selectFile" />
        <button class="primary-button" data-testid="upload-project-document" :disabled="!selectedFile || loading['upload-project-document']" @click="upload">
          {{ loading['upload-project-document'] ? '上传中…' : '上传文件' }}
        </button>
      </div>
    </section>

    <section class="document-metrics" aria-label="文档处理统计">
      <article><span>文档总数</span><strong data-testid="document-total">{{ total }}</strong></article>
      <article><span>待解析</span><strong>{{ parsingCount }}</strong></article>
      <article><span>解析失败</span><strong>{{ failedCount }}</strong></article>
    </section>

    <div class="document-toolbar">
      <label>状态筛选<select data-testid="document-status-filter" :value="status || ''" @change="emit('status-change', ($event.target as HTMLSelectElement).value as ProcessDocument['status'] | '')"><option value="">全部状态</option><option v-for="(label, value) in statusLabels" :key="value" :value="value">{{ label }}</option></select></label>
      <span>共 {{ total }} 份 · 第 {{ currentPage }} 页</span>
      <button data-testid="document-prev-page" :disabled="!canPrev" @click="emit('page-change', currentPage - 1)">上一页</button>
      <button data-testid="document-next-page" :disabled="!canNext" @click="emit('page-change', currentPage + 1)">下一页</button>
    </div>

    <div v-if="documents.length === 0" class="document-empty">当前项目还没有上传资料。</div>
    <section v-else class="document-table" aria-label="项目文档处理列表">
      <div class="document-table-head"><span>文件</span><span>处理状态</span><span>字段检查</span><span>版本</span><span>操作</span></div>
      <article v-for="document in documents" :key="document.id" class="document-row">
        <div><b>{{ document.filename }}</b><small>{{ document.file_hash.slice(0, 12) }}…</small></div>
        <div>
          <span class="status-pill" :class="document.status.toLowerCase()" data-testid="project-document-status">{{ statusLabels[document.status] }}</span>
          <small v-if="document.last_error.message" class="document-error">{{ document.last_error.message }}</small>
        </div>
        <div><b>{{ document.field_summary.checked_count }}/{{ document.field_summary.total_count }}</b><small>已检查字段</small></div>
        <div><b>v{{ document.version }}</b><small>服务端版本</small></div>
        <div class="document-actions">
          <button v-if="canStartParse(document)" class="secondary-button" data-testid="parse-project-document" :disabled="loading[`parse-project-document:${document.id}`]" @click="emit('parse', document.id)">
            {{ loading[`parse-project-document:${document.id}`] ? '解析中…' : '开始解析' }}
          </button>
          <button v-else-if="canRetryParse(document)" class="secondary-button" data-testid="retry-project-document-parse" :disabled="loading[`retry-project-document-parse:${document.id}`]" @click="emit('retry-parse', document.id)">
            {{ loading[`retry-project-document-parse:${document.id}`] ? '重试中…' : '重试解析' }}
          </button>
          <button v-else-if="document.status === 'PARSED'" class="primary-button" data-testid="create-archive-suggestions" :disabled="loading[`create-archive-suggestions:${document.id}`]" @click="emit('create-suggestions', document.id)">生成 AI 建议</button>
          <button v-else-if="document.status === 'SUGGESTION_FAILED'" class="secondary-button" data-testid="retry-suggestions" :disabled="loading[`retry-archive-suggestions:${document.id}`]" @click="emit('retry-suggestions', document.id)">重试 AI 建议</button>
          <button v-if="document.status === 'PARSED' || document.status === 'SUGGESTION_FAILED'" class="link-button" data-testid="create-manual-draft" :disabled="loading[`create-manual-archive-draft:${document.id}`]" @click="emit('create-manual-draft', document.id)">启动人工草稿</button>
          <button v-if="canOpenDraft(document)" class="link-button" data-testid="open-archive-draft" @click="emit('open-draft', document.id)">打开字段草稿</button>
          <button
            class="danger-button"
            data-testid="delete-project-document"
            :disabled="loading[`delete-project-document:${document.id}`]"
            @click="emit('delete', document.id, document.filename)"
          >
            {{ loading[`delete-project-document:${document.id}`] ? '删除中…' : '删除文档' }}
          </button>
          <small v-if="document.status !== 'UPLOADED' && document.status !== 'PARSE_FAILED' && document.status !== 'PARSED' && document.status !== 'SUGGESTION_FAILED' && !canOpenDraft(document)">当前状态无解析操作</small>
        </div>
      </article>
    </section>
  </section>
</template>

<style scoped>
.document-panel{display:grid;gap:20px}.document-header{display:flex;justify-content:space-between;gap:18px;align-items:start}.document-header h1{margin:5px 0;font-size:28px}.document-header p{margin:0;color:#64748b}.upload-box{display:flex;justify-content:space-between;gap:18px;align-items:center;padding:18px;border:1px dashed #93c5fd;border-radius:12px;background:#f8fbff}.upload-box>div{display:grid;gap:5px}.upload-box small{color:#64748b}.upload-controls{display:flex!important;align-items:center;gap:10px}.document-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.document-metrics article{padding:15px;border:1px solid #e2e8f0;border-left:4px solid #1a73e8;border-radius:10px;background:#fff;display:grid;gap:4px}.document-metrics span,.document-row small{color:#64748b}.document-metrics strong{font-size:23px}.document-toolbar{display:flex;align-items:center;gap:12px;color:#64748b}.document-toolbar label{display:flex;align-items:center;gap:6px}.document-toolbar select,.document-toolbar button{padding:7px;border:1px solid #cbd5e1;border-radius:7px;background:#fff}.document-table{border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#fff}.document-table-head,.document-row{display:grid;grid-template-columns:2fr 1.25fr 1fr .8fr 1.1fr;gap:14px;align-items:center;padding:14px 18px}.document-table-head{background:#f8fafc;color:#64748b;font-size:12px;font-weight:700}.document-row{border-top:1px solid #e2e8f0}.document-row>div{display:flex;flex-direction:column;gap:5px}.document-actions{align-items:start}.document-error{color:#d32f2f}.document-empty{padding:52px;text-align:center;color:#64748b;border:1px dashed #cbd5e1;border-radius:12px}.status-pill{width:max-content;border-radius:999px;padding:4px 9px;font-size:12px;font-weight:700}.status-pill.uploaded{background:#f0f8ff;color:#1a73e8}.status-pill.parse_failed{background:#fff1f0;color:#d32f2f}.status-pill.parsed{background:#f0fff0;color:#2d8b2d}.status-pill.suggestion_failed,.status-pill.pending_confirmation,.status-pill.pending_reconfirmation{background:#fff7e6;color:#b45309}.status-pill.confirmed{background:#f0fff0;color:#2d8b2d}@media(max-width:900px){.document-header,.upload-box,.upload-controls{flex-direction:column;align-items:stretch}.document-metrics{grid-template-columns:1fr}.document-table-head{display:none}.document-row{grid-template-columns:1fr;gap:10px}}
</style>
