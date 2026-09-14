<script setup lang="ts">
import { ref } from 'vue'
import type { ArchiveQuestionResponse, ArchiveRetrievalResponse } from '../../types'

const props = defineProps<{
  answer: ArchiveQuestionResponse | null
  retrieval: ArchiveRetrievalResponse | null
  loading: Record<string, boolean>
}>()

const emit = defineEmits<{
  ask: [question: string]
  retrieve: [query: string, topK: number]
}>()

const question = ref('')
const retrievalQuery = ref('')
const retrievalTopK = ref(5)
const questionError = ref('')
const retrievalError = ref('')

function submitQuestion() {
  const value = question.value.trim()
  questionError.value = value ? '' : '请输入问题。'
  if (value) emit('ask', value)
}

function submitRetrieval() {
  const value = retrievalQuery.value.trim()
  if (!value) {
    retrievalError.value = '请输入检索内容。'
    return
  }
  retrievalError.value = ''
  emit('retrieve', value, Math.min(10, Math.max(1, Number(retrievalTopK.value) || 5)))
}

function formatLocation(item: { location_type: string; location_start: number; location_end: number }) {
  if (item.location_type === 'PDF_PAGE') return item.location_start === item.location_end ? `PDF 第 ${item.location_start} 页` : `PDF 第 ${item.location_start}-${item.location_end} 页`
  if (item.location_type === 'DOCX_PARAGRAPH') return item.location_start === item.location_end ? `DOCX 第 ${item.location_start} 段` : `DOCX 第 ${item.location_start}-${item.location_end} 段`
  return item.location_start === item.location_end ? `文本第 ${item.location_start} 行` : `文本第 ${item.location_start}-${item.location_end} 行`
}

function formatScore(value: number | null) {
  return value === null ? '—' : value.toFixed(3)
}
</script>

<template>
  <section class="question-page" data-testid="archive-question-panel">
    <header class="page-heading">
      <div>
        <span class="eyebrow">FR-039 · EVIDENCE QA</span>
        <h1>带证据问答</h1>
        <p>问题只在当前项目的正式档案范围内回答，引用和拒答状态均来自服务端。</p>
      </div>
    </header>

    <div class="question-grid">
      <article class="dashboard-card question-card">
        <div class="card-heading"><div><span class="eyebrow">ASK ONCE</span><h2>向正式档案提问</h2></div><small>单轮问题</small></div>
        <form @submit.prevent="submitQuestion">
          <label>问题<textarea data-testid="archive-question-input" v-model="question" maxlength="2000" placeholder="例如：合同签订日期是什么？"></textarea></label>
          <p v-if="questionError" class="inline-error">{{ questionError }}</p>
          <button type="submit" data-testid="archive-question-submit" class="primary-button" :disabled="props.loading['archive-question']" @click.prevent="submitQuestion">{{ props.loading['archive-question'] ? '正在回答…' : '提交问题' }}</button>
        </form>
        <div v-if="props.answer" class="answer-result" :class="props.answer.answer_status === 'ANSWERED' ? 'answered' : 'refused'">
          <div class="result-label">{{ props.answer.answer_status === 'ANSWERED' ? '已依据正式证据回答' : '服务端拒答' }}</div>
          <p data-testid="archive-answer">{{ props.answer.answer }}</p>
          <div v-if="props.answer.answer_status === 'ANSWERED' && props.answer.citations.length" class="citation-list">
            <h3>回答引用</h3>
            <article v-for="citation in props.answer.citations" :key="citation.chunk_id" class="evidence-card" data-testid="answer-citation">
              <strong>{{ citation.filename }}</strong><span>{{ formatLocation(citation) }}</span><p>{{ citation.excerpt }}</p>
              <small>向量分数 {{ formatScore(citation.score) }} · 重排分数 {{ formatScore(citation.reranker_score) }}（仅供检索诊断）</small>
            </article>
          </div>
        </div>
      </article>

      <article class="dashboard-card retrieval-card">
        <div class="card-heading"><div><span class="eyebrow">RETRIEVAL DIAGNOSTIC</span><h2>原文检索</h2></div><small>仅供诊断</small></div>
        <form class="retrieval-form" @submit.prevent="submitRetrieval">
          <label>查询<input data-testid="archive-retrieval-input" v-model="retrievalQuery" maxlength="2000" placeholder="输入需要查找的原文主题" /></label>
          <label>Top-K<input data-testid="archive-retrieval-top-k" v-model.number="retrievalTopK" type="number" min="1" max="10" /></label>
          <button type="submit" data-testid="archive-retrieval-submit" class="secondary-button" :disabled="props.loading['archive-retrieval']" @click.prevent="submitRetrieval">{{ props.loading['archive-retrieval'] ? '正在检索…' : '检索原文' }}</button>
        </form>
        <p v-if="retrievalError" class="inline-error">{{ retrievalError }}</p>
        <div v-if="props.retrieval" class="retrieval-result">
          <p class="result-meta">请求 Top-K {{ props.retrieval.requested_top_k }} · 返回 {{ props.retrieval.returned_count }} 条</p>
          <article v-for="item in props.retrieval.items" :key="item.chunk_id" class="evidence-card">
            <strong>{{ item.filename }}</strong><span>{{ formatLocation(item) }}</span><p>{{ item.excerpt }}</p>
            <small>向量分数 {{ formatScore(item.score) }} · 重排分数 {{ formatScore(item.reranker_score) }}</small>
          </article>
          <small class="diagnostic-note">分数仅供检索诊断，不作为前端证据充分性阈值。</small>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.question-grid { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, .95fr); gap: 16px; }
.question-card, .retrieval-card { min-width: 0; }
.question-card form, .retrieval-form { display: grid; gap: 14px; margin-top: 20px; }
label { display: grid; gap: 8px; color: #344054; font-size: 13px; font-weight: 600; }
textarea, input { width: 100%; border: 1px solid #d8e0ea; border-radius: 8px; padding: 11px 12px; outline: none; color: var(--ink); background: #fff; }
textarea { min-height: 118px; resize: vertical; }
textarea:focus, input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px #1a73e81c; }
.retrieval-form { grid-template-columns: minmax(0, 1fr) 92px auto; align-items: end; }
.inline-error { margin: 0; color: var(--danger); font-size: 12px; }
.answer-result, .retrieval-result { margin-top: 22px; border-top: 1px solid var(--line); padding-top: 18px; }
.answer-result { border-radius: 8px; padding: 15px; background: #f8fafc; }
.answer-result.answered { border: 1px solid #b7eb8f; background: #f6ffed; }
.answer-result.refused { border: 1px solid #ffe58f; background: #fffbe6; }
.result-label { color: #344054; font-size: 12px; font-weight: 700; }
.answer-result > p { margin: 10px 0 0; color: var(--ink); line-height: 1.8; white-space: pre-wrap; }
.citation-list h3 { margin: 17px 0 9px; font-size: 13px; }
.evidence-card { display: grid; grid-template-columns: 1fr auto; gap: 5px 12px; margin-top: 9px; border: 1px solid var(--line); border-radius: 8px; padding: 12px; background: #fff; }
.evidence-card strong { color: var(--ink); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.evidence-card > span { color: var(--primary); font-size: 12px; }
.evidence-card p { grid-column: 1 / -1; margin: 4px 0 0; color: var(--muted); font-size: 12px; line-height: 1.65; }
.evidence-card small { grid-column: 1 / -1; color: #8993a4; font-size: 11px; }
.result-meta, .diagnostic-note { color: #8993a4; font-size: 12px; }
.diagnostic-note { display: block; margin-top: 13px; line-height: 1.6; }
@media (max-width: 900px) { .question-grid { grid-template-columns: 1fr; } }
@media (max-width: 560px) { .retrieval-form { grid-template-columns: 1fr 90px; }.retrieval-form button { grid-column: 1 / -1; } }
</style>
