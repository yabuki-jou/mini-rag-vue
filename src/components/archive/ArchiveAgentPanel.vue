<script setup lang="ts">
import { ref } from 'vue'
import type { ArchiveAgentMessage, ArchiveAgentResponse, ArchiveAgentSession, ArchiveAgentToolCallLog } from '../../types'

const props = defineProps<{
  session: ArchiveAgentSession | null
  messages: ArchiveAgentMessage[]
  lastResponse: ArchiveAgentResponse | null
  toolCalls: ArchiveAgentToolCallLog[]
  loading: Record<string, boolean>
}>()

const emit = defineEmits<{
  'create-session': []
  send: [message: string]
  'refresh-history': []
  'refresh-tool-calls': []
}>()

const message = ref('')
const messageError = ref('')

const summaryLabels: Record<string, string> = {
  query_provided: '已提供查询',
  query_length: '查询长度',
  filter_names: '筛选字段',
  page: '页码',
  page_size: '每页数量',
  top_k: '候选数量',
  found: '找到结果',
  result_count: '结果数量',
}
const allowedArgumentKeys = ['query_provided', 'query_length', 'filter_names', 'page', 'page_size', 'top_k']
const allowedResultKeys = ['found', 'result_count']
const toolLabels: Record<string, string> = {
  list_formal_archives: '读取正式档案目录',
  search_confirmed_archive_evidence: '检索正式档案原文',
}

function submitMessage() {
  const value = message.value.trim()
  messageError.value = value ? '' : '请输入消息。'
  if (value) emit('send', value)
}

function formatLocation(item: { location_type: string; location_start: number; location_end: number }) {
  const range = item.location_start === item.location_end ? `${item.location_start}` : `${item.location_start}-${item.location_end}`
  if (item.location_type === 'PDF_PAGE') return `PDF 第 ${range} 页`
  if (item.location_type === 'DOCX_PARAGRAPH') return `DOCX 第 ${range} 段`
  return `文本第 ${range} 行`
}

function formatSummary(summary: Record<string, unknown> | null, keys: string[]) {
  if (!summary) return []
  return keys
    .filter(key => Object.prototype.hasOwnProperty.call(summary, key))
    .map(key => ({ key, label: summaryLabels[key], value: formatValue(summary[key]) }))
}

function formatValue(value: unknown) {
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (Array.isArray(value)) return value.length ? value.join('、') : '无'
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}
</script>

<template>
  <section class="archive-agent-panel" data-testid="archive-agent-panel">
    <header class="agent-header">
      <div>
        <span class="eyebrow">FR-042 · PROJECT ARCHIVE AGENT</span>
        <h1>项目档案助手</h1>
        <p>在当前项目正式档案范围内连续对话；无证据时由服务端拒答。</p>
      </div>
      <button data-testid="archive-agent-create" class="primary-button" :disabled="loading['archive-agent-session'] || loading['archive-agent-message']" @click="emit('create-session')">
        {{ loading['archive-agent-session'] ? '正在创建…' : '新建会话' }}
      </button>
    </header>

    <div v-if="!session" class="agent-empty">
      <strong>尚未创建档案助手会话</strong>
      <p>选择当前项目后点击“新建会话”。会话范围由服务端绑定，页面不会提交知识库或用户标识。</p>
    </div>

    <template v-else>
      <div class="agent-toolbar">
        <span>当前会话</span>
        <div>
          <button data-testid="archive-agent-refresh-history" class="secondary-button" :disabled="loading['archive-agent-history'] || loading['archive-agent-message']" @click="emit('refresh-history')">{{ loading['archive-agent-history'] ? '刷新中…' : '刷新历史' }}</button>
          <button data-testid="archive-agent-refresh-tools" class="secondary-button" :disabled="loading['archive-agent-tool-calls'] || loading['archive-agent-message']" @click="emit('refresh-tool-calls')">{{ loading['archive-agent-tool-calls'] ? '刷新中…' : '工具记录' }}</button>
        </div>
      </div>

      <div v-if="lastResponse" class="agent-answer-status" data-testid="archive-agent-answer-status" :class="lastResponse.answer_status === 'ANSWERED' ? 'answered' : 'refused'">
        {{ lastResponse.answer_status === 'ANSWERED' ? '当前回答：已回答' : '当前回答：服务端拒答' }}
      </div>

      <section class="agent-conversation" aria-label="当前会话消息">
        <p v-if="!messages.length" class="agent-placeholder">会话已创建，请输入目录问题、原文问题或其他档案问题。</p>
        <article v-for="(item, messageIndex) in messages" :key="`${messageIndex}-${item.role}`" class="agent-message" :class="item.role.toLowerCase()">
          <strong>{{ item.role === 'USER' ? '你' : '档案助手' }}</strong>
          <p>{{ item.content }}</p>
          <div v-if="item.role === 'ASSISTANT' && item.citations.length" class="agent-citations">
            <article v-for="(citation, citationIndex) in item.citations" :key="`${citation.filename}-${citation.location_type}-${citation.location_start}-${citationIndex}`" class="evidence-card" data-testid="archive-agent-citation">
              <strong>{{ citation.filename }}</strong>
              <span>{{ formatLocation(citation) }}</span>
              <p>{{ citation.excerpt }}</p>
            </article>
          </div>
        </article>
      </section>

      <form class="agent-composer" @submit.prevent="submitMessage">
        <label>消息<textarea data-testid="archive-agent-input" v-model="message" maxlength="2000" placeholder="例如：先列出当前项目正式档案，再说明合同签订日期。"></textarea></label>
        <p v-if="messageError" class="inline-error">{{ messageError }}</p>
        <button data-testid="archive-agent-send" type="submit" class="primary-button" :disabled="loading['archive-agent-message']" @click.prevent="submitMessage">{{ loading['archive-agent-message'] ? '正在发送…' : '发送消息' }}</button>
      </form>

      <section class="tool-call-section">
        <div class="card-heading"><div><span class="eyebrow">REDACTED TOOL LOGS</span><h2>脱敏工具记录</h2></div><small>{{ toolCalls.length }} 条</small></div>
        <p v-if="!toolCalls.length" class="agent-placeholder">点击“工具记录”读取当前会话的脱敏调用摘要。</p>
        <article v-for="(call, index) in toolCalls" :key="index" class="tool-call-row">
          <div><strong>{{ toolLabels[call.tool_name] || call.tool_name }}</strong><span :class="call.status === 'COMPLETED' ? 'completed' : 'failed'">{{ call.status === 'COMPLETED' ? '已完成' : '失败' }}</span></div>
          <div class="tool-summary">
            <span v-for="item in formatSummary(call.arguments_summary, allowedArgumentKeys)" :key="`argument-${item.key}`">{{ item.label }}：{{ item.value }}</span>
            <span v-for="item in formatSummary(call.result_summary, allowedResultKeys)" :key="`result-${item.key}`">{{ item.label }}：{{ item.value }}</span>
            <span v-if="call.duration_ms !== null">耗时：{{ call.duration_ms }} ms</span>
            <span v-if="call.error_code">错误码：{{ call.error_code }}</span>
          </div>
        </article>
      </section>
    </template>
  </section>
</template>

<style scoped>
.archive-agent-panel{display:grid;gap:18px}.agent-header{display:flex;justify-content:space-between;align-items:flex-start;gap:18px}.agent-header h1{margin:5px 0;font-size:28px}.agent-header p{margin:0;color:#64748b}.agent-empty,.agent-placeholder{padding:28px;border:1px dashed #cbd5e1;border-radius:12px;background:#fff;color:#64748b;text-align:center}.agent-empty p{max-width:620px;margin:8px auto 0;line-height:1.7}.agent-toolbar{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;color:#475569;font-weight:700}.agent-toolbar>div{display:flex;gap:8px}.agent-answer-status{padding:10px 14px;border-radius:8px;font-size:13px;font-weight:700}.agent-answer-status.answered{border:1px solid #b7eb8f;background:#f6ffed;color:#237804}.agent-answer-status.refused{border:1px solid #ffe58f;background:#fffbe6;color:#8a6100}.agent-conversation{display:grid;gap:12px;max-height:560px;overflow:auto;padding:18px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc}.agent-message{max-width:86%;padding:13px 15px;border-radius:12px;background:#fff;box-shadow:0 1px 2px #0f172a12}.agent-message.user{justify-self:end;background:#eaf2ff}.agent-message.assistant{justify-self:start}.agent-message>strong{font-size:12px;color:#475569}.agent-message>p{margin:7px 0 0;white-space:pre-wrap;line-height:1.7}.agent-citations{display:grid;gap:8px;margin-top:12px}.evidence-card{display:grid;grid-template-columns:1fr auto;gap:5px 12px;padding:11px;border:1px solid #d8e0ea;border-radius:8px;background:#fff}.evidence-card>span{color:var(--primary);font-size:12px}.evidence-card>p{grid-column:1/-1;margin:3px 0 0;color:#64748b;font-size:12px;line-height:1.6}.agent-composer{display:grid;gap:10px;padding:16px;border:1px solid #e2e8f0;border-radius:12px;background:#fff}.agent-composer label{display:grid;gap:8px;color:#344054;font-size:13px;font-weight:600}.agent-composer textarea{min-height:96px;width:100%;resize:vertical;border:1px solid #d8e0ea;border-radius:8px;padding:11px 12px;color:var(--ink)}.agent-composer button{justify-self:end}.inline-error{margin:0;color:var(--danger);font-size:12px}.tool-call-section{display:grid;gap:10px;padding:16px;border:1px solid #e2e8f0;border-radius:12px;background:#fff}.tool-call-row{display:grid;gap:8px;padding:13px;border:1px solid #e2e8f0;border-radius:9px}.tool-call-row>div{display:flex;flex-wrap:wrap;gap:10px;align-items:center}.tool-call-row span{font-size:12px;color:#64748b}.tool-call-row .completed{color:#237804}.tool-call-row .failed{color:#b42318}.tool-summary span{padding:4px 7px;border-radius:6px;background:#f1f5f9}@media(max-width:720px){.agent-header{display:grid}.agent-header button{justify-self:start}.agent-message{max-width:96%}.agent-toolbar{align-items:flex-start;gap:10px}.agent-toolbar>div{flex-wrap:wrap;justify-content:flex-end}}
</style>
