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
const toolsOpen = ref(false)

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

function toggleTools() {
  toolsOpen.value = !toolsOpen.value
  emit('refresh-tool-calls')
}

function isRefused(item: ArchiveAgentMessage) {
  const response = props.lastResponse
  if (!response || response.answer_status === 'ANSWERED') return false
  return item.role === 'ASSISTANT' && item.content === response.answer
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
    <div v-if="!session" class="agent-empty">
      <span class="agent-empty-icon">◇</span>
      <strong>尚未创建档案助手会话</strong>
      <p>选择当前项目后点击“新建会话”。会话范围由服务端绑定，页面不会提交知识库或用户标识。</p>
      <button data-testid="archive-agent-create" class="primary-button" :disabled="loading['archive-agent-session'] || loading['archive-agent-message']" @click="emit('create-session')">
        {{ loading['archive-agent-session'] ? '正在创建…' : '新建会话' }}
      </button>
    </div>

    <div v-else class="agent-shell">
      <div class="agent-col">
        <header class="agent-session-bar">
          <span class="agent-session-title"><i class="agent-dot" :class="lastResponse && lastResponse.answer_status !== 'ANSWERED' ? 'warn' : 'ok'"></i>项目档案助手</span>
          <div class="agent-session-acts">
            <button data-testid="archive-agent-create" class="ghost-button" :disabled="loading['archive-agent-session'] || loading['archive-agent-message']" @click="emit('create-session')">
              {{ loading['archive-agent-session'] ? '正在创建…' : '＋ 新建会话' }}
            </button>
            <button data-testid="archive-agent-refresh-history" class="ghost-button" :disabled="loading['archive-agent-history'] || loading['archive-agent-message']" @click="emit('refresh-history')">{{ loading['archive-agent-history'] ? '刷新中…' : '↻ 刷新历史' }}</button>
            <button data-testid="archive-agent-refresh-tools" class="ghost-button" :disabled="loading['archive-agent-tool-calls'] || loading['archive-agent-message']" @click="toggleTools">{{ loading['archive-agent-tool-calls'] ? '刷新中…' : '≣ 工具记录' }}</button>
          </div>
        </header>

        <div v-if="lastResponse" class="agent-answer-status" data-testid="archive-agent-answer-status" :class="lastResponse.answer_status === 'ANSWERED' ? 'answered' : 'refused'">
          {{ lastResponse.answer_status === 'ANSWERED' ? '当前回答：已回答' : '当前回答：服务端拒答' }}
        </div>

        <div class="agent-chat-scroll">
          <div class="agent-chat-inner">
            <p v-if="!messages.length" class="agent-placeholder">会话已创建，请输入目录问题、原文问题或其他档案问题。</p>
            <article v-for="(item, messageIndex) in messages" :key="`${messageIndex}-${item.role}`" class="agent-message" :class="[item.role.toLowerCase(), { refused: isRefused(item) }]">
              <span class="agent-msg-who">
                <template v-if="item.role === 'USER'">你</template>
                <template v-else><i class="agent-avatar">✦</i>档案助手</template>
              </span>
              <div class="agent-bubble">
                <span v-if="isRefused(item)" class="refuse-tag">REFUSED_NO_EVIDENCE</span>
                <p>{{ item.content }}</p>
              </div>
              <div v-if="item.role === 'ASSISTANT' && item.citations.length" class="agent-citations">
                <article v-for="(citation, citationIndex) in item.citations" :key="`${citation.filename}-${citation.location_type}-${citation.location_start}-${citationIndex}`" class="evidence-card" data-testid="archive-agent-citation">
                  <strong>{{ citation.filename }}</strong>
                  <span>{{ formatLocation(citation) }}</span>
                  <p>{{ citation.excerpt }}</p>
                </article>
              </div>
            </article>
          </div>
        </div>

        <div class="agent-composer-wrap">
          <form class="agent-composer" @submit.prevent="submitMessage">
            <textarea data-testid="archive-agent-input" v-model="message" maxlength="2000" placeholder="输入问题，例如：先列出当前项目正式档案，再说明合同签订日期。" @keydown.enter.exact.prevent="submitMessage"></textarea>
            <p v-if="messageError" class="inline-error">{{ messageError }}</p>
            <div class="agent-composer-foot">
              <span class="composer-hint"><kbd>Enter</kbd> 发送 · <kbd>Shift+Enter</kbd> 换行 · 2000 字符以内</span>
              <button data-testid="archive-agent-send" type="submit" class="primary-button" :disabled="loading['archive-agent-message']" @click.prevent="submitMessage">{{ loading['archive-agent-message'] ? '正在发送…' : '发送' }}</button>
            </div>
          </form>
        </div>
      </div>

      <aside class="agent-tool-rail" :class="{ open: toolsOpen }" aria-label="脱敏工具记录">
        <div class="agent-rail-head"><b>脱敏工具记录</b><small>{{ toolCalls.length }} 条</small></div>
        <p v-if="!toolCalls.length" class="agent-placeholder rail-empty">点击“工具记录”读取当前会话的脱敏调用摘要。</p>
        <article v-for="(call, index) in toolCalls" :key="index" class="tool-call-row">
          <div class="tool-row-top">
            <strong>{{ toolLabels[call.tool_name] || call.tool_name }}</strong>
            <span class="pill" :class="call.status === 'COMPLETED' ? 'ok' : 'fail'">{{ call.status === 'COMPLETED' ? '已完成' : '失败' }}</span>
          </div>
          <div class="tool-summary">
            <span v-for="item in formatSummary(call.arguments_summary, allowedArgumentKeys)" :key="`argument-${item.key}`">{{ item.label }}：{{ item.value }}</span>
            <span v-for="item in formatSummary(call.result_summary, allowedResultKeys)" :key="`result-${item.key}`">{{ item.label }}：{{ item.value }}</span>
            <span v-if="call.duration_ms !== null">耗时：{{ call.duration_ms }} ms</span>
            <span v-if="call.error_code">错误码：{{ call.error_code }}</span>
          </div>
        </article>
        <p class="rail-note">仅展示服务端返回的脱敏摘要：不含文档标识、分数与原文内容。窄屏时收入“工具记录”按钮的抽屉中。</p>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.archive-agent-panel { height: calc(100vh - 108px); min-height: 520px; }
.agent-shell { display: grid; grid-template-columns: minmax(0, 1fr) 296px; height: 100%; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); box-shadow: var(--shadow-xs); overflow: hidden; }
.agent-col { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.agent-session-bar { flex: none; display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--line); padding: 10px 20px; }
.agent-session-title { display: inline-flex; align-items: center; gap: 9px; color: var(--ink); font-size: 13px; font-weight: 600; }
.agent-dot { width: 7px; height: 7px; border-radius: 50%; }
.agent-dot.ok { background: var(--success); }
.agent-dot.warn { background: var(--ink-3); }
.agent-session-acts { display: flex; gap: 8px; }
.ghost-button { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--line); border-radius: var(--radius-md); padding: 6px 12px; background: var(--surface); color: var(--ink-2); font-size: 12.5px; font-weight: 500; }
.ghost-button:hover:not(:disabled) { border-color: var(--line-strong); color: var(--ink); }
.agent-answer-status { flex: none; align-self: flex-start; margin: 10px 20px 0; display: inline-flex; align-items: center; border: 1px solid var(--line); border-radius: 999px; padding: 3px 11px; font-family: var(--font-mono); font-size: 11px; background: var(--surface-2); }
.agent-answer-status.answered { color: #067647; background: #e6f6ef; border-color: transparent; }
.agent-answer-status.refused { color: var(--ink-2); border-style: dashed; }
.agent-chat-scroll { flex: 1; overflow-y: auto; padding: 24px 20px 12px; }
.agent-chat-inner { max-width: 780px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px; }
.agent-placeholder { margin: 0; padding: 20px; border: 1px dashed var(--line-strong); border-radius: 12px; color: var(--ink-3); text-align: center; font-size: 13px; }
.agent-message { display: flex; flex-direction: column; gap: 6px; max-width: 86%; }
.agent-message.user { align-self: flex-end; align-items: flex-end; }
.agent-message.assistant { align-self: flex-start; }
.agent-msg-who { display: inline-flex; align-items: center; gap: 7px; color: var(--ink-3); font-size: 11.5px; font-weight: 600; }
.agent-avatar { display: grid; width: 18px; height: 18px; border-radius: 5px; place-items: center; color: #fff; background: var(--ink); font-size: 10px; font-weight: 600; font-style: normal; }
.agent-bubble { border-radius: 10px; padding: 11px 14px; line-height: 1.75; white-space: pre-wrap; }
.agent-bubble p { margin: 0; }
.agent-message.user .agent-bubble { color: #fff; background: var(--primary); border-bottom-right-radius: 4px; font-weight: 500; }
.agent-message.assistant .agent-bubble { background: var(--surface); border: 1px solid var(--line); border-bottom-left-radius: 4px; box-shadow: var(--shadow-xs); }
.agent-message.refused .agent-bubble { color: var(--ink-2); background: var(--surface-2); border: 1px dashed var(--line-strong); }
.refuse-tag { display: inline-flex; margin-bottom: 4px; color: var(--ink-3); font-family: var(--font-mono); font-size: 11px; font-weight: 500; letter-spacing: .4px; }
.agent-citations { display: flex; flex-direction: column; gap: 6px; }
.evidence-card { display: grid; grid-template-columns: 1fr auto; gap: 3px 12px; border: 1px solid var(--line); border-radius: var(--radius-md); padding: 10px 12px; background: var(--surface); box-shadow: var(--shadow-xs); }
.evidence-card strong { display: flex; align-items: center; gap: 7px; overflow: hidden; color: var(--ink); font-size: 12.5px; font-weight: 600; }
.evidence-card > span { justify-self: end; color: var(--primary-hover); font-family: var(--font-mono); font-size: 11px; background: var(--primary-weak); border-radius: 5px; padding: 2px 8px; white-space: nowrap; }
.evidence-card p { grid-column: 1 / -1; margin: 0; color: var(--ink-2); font-size: 12.5px; line-height: 1.65; }
.agent-composer-wrap { flex: none; padding: 6px 20px 16px; }
.agent-composer { max-width: 780px; margin: 0 auto; border: 1px solid var(--line-strong); border-radius: 12px; background: var(--surface); box-shadow: 0 4px 16px rgba(16, 24, 40, .07); padding: 11px 12px 9px; transition: border-color .15s, box-shadow .15s; }
.agent-composer:focus-within { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(26, 115, 232, .1); }
.agent-composer textarea { display: block; width: 100%; min-height: 44px; max-height: 160px; resize: none; border: 0; outline: none; font: inherit; line-height: 1.6; color: var(--ink); background: transparent; }
.agent-composer textarea::placeholder { color: var(--ink-3); }
.agent-composer-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 6px; }
.composer-hint { color: var(--ink-3); font-size: 11.5px; }
.composer-hint kbd { font-family: var(--font-mono); font-size: 10.5px; border: 1px solid var(--line); border-bottom-width: 2px; border-radius: 4px; padding: 0 5px; background: var(--surface-2); }
.agent-composer .primary-button { padding: 7px 14px; font-size: 13px; }
.inline-error { margin: 4px 0 0; color: var(--danger); font-size: 12px; }
.agent-tool-rail { display: flex; flex-direction: column; gap: 10px; border-left: 1px solid var(--line); padding: 16px 14px; background: var(--bg); min-width: 0; overflow-y: auto; }
.agent-rail-head { display: flex; align-items: center; justify-content: space-between; }
.agent-rail-head b { color: var(--ink); font-size: 13px; font-weight: 600; }
.agent-rail-head small { color: var(--ink-3); font-family: var(--font-mono); font-size: 11px; }
.rail-empty { padding: 14px; font-size: 12px; }
.tool-call-row { display: flex; flex-direction: column; gap: 8px; border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--surface); padding: 11px 12px; }
.tool-row-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.tool-row-top strong { color: var(--ink); font-size: 12.5px; font-weight: 600; }
.pill { color: #067647; background: #e6f6ef; font-family: var(--font-mono); font-size: 10px; border-radius: 999px; padding: 2px 8px; }
.pill.fail { color: var(--danger); background: var(--danger-weak); }
.tool-summary { display: flex; flex-wrap: wrap; gap: 5px; }
.tool-summary span { color: var(--ink-2); font-family: var(--font-mono); font-size: 10.5px; background: var(--surface-2); border-radius: 5px; padding: 3px 7px; }
.rail-note { margin: 2px 0 0; color: var(--ink-3); font-size: 11.5px; line-height: 1.7; }
@media (max-width: 1280px) {
  .agent-shell { grid-template-columns: minmax(0, 1fr); }
  .agent-tool-rail { position: fixed; z-index: 45; top: 72px; right: 18px; bottom: 18px; width: 320px; border: 1px solid var(--line-strong); border-radius: 12px; background: var(--surface); box-shadow: var(--shadow-md); transform: translateX(calc(100% + 30px)); transition: transform .2s ease; }
  .agent-tool-rail.open { transform: translateX(0); }
}
@media (max-width: 760px) {
  .archive-agent-panel { height: calc(100vh - 167px); min-height: 480px; }
  .agent-session-bar { flex-wrap: wrap; padding: 10px 14px; }
  .agent-session-acts { flex-wrap: wrap; }
  .agent-message { max-width: 96%; }
  .agent-chat-scroll { padding: 18px 14px 10px; }
  .agent-composer-wrap { padding: 6px 14px 12px; }
}
</style>
