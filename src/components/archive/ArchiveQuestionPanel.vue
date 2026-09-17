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

const activeTab = ref<'ask' | 'diag'>('ask')
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

        <article class="qa-card">
            <div class="qa-tabs" role="tablist">
                <button class="qa-tab" :class="{ active: activeTab === 'ask' }" role="tab" :aria-selected="activeTab === 'ask'" @click="activeTab = 'ask'">向正式档案提问</button>
                <button class="qa-tab" :class="{ active: activeTab === 'diag' }" role="tab" :aria-selected="activeTab === 'diag'" @click="activeTab = 'diag'">检索诊断</button>
            </div>

            <div v-show="activeTab === 'ask'" class="qa-panel">
                <form @submit.prevent="submitQuestion">
                    <label>问题<textarea data-testid="archive-question-input" v-model="question" maxlength="2000" placeholder="例如：合同签订日期是什么？"></textarea></label>
                    <p v-if="questionError" class="inline-error">{{ questionError }}</p>
                    <div class="ask-foot">
                        <span class="ask-hint">单轮问答 · 2000 字符以内</span>
                        <button type="submit" data-testid="archive-question-submit" class="primary-button" :disabled="props.loading['archive-question']" @click.prevent="submitQuestion">{{ props.loading['archive-question'] ? '正在回答…' : '提交问题' }}</button>
                    </div>
                </form>
                <div v-if="props.answer" class="answer-result" :class="props.answer.answer_status === 'ANSWERED' ? 'answered' : 'refused'">
                    <div class="result-label">{{ props.answer.answer_status === 'ANSWERED' ? '已依据正式证据回答' : '服务端拒答' }}</div>
                    <p data-testid="archive-answer">{{ props.answer.answer }}</p>
                    <div v-if="props.answer.answer_status === 'ANSWERED' && props.answer.citations.length" class="citation-list">
                        <h3>回答引用</h3>
                        <article v-for="citation in props.answer.citations" :key="citation.chunk_id" class="evidence-card" data-testid="answer-citation">
                            <strong>{{ citation.filename }}</strong
                            ><span>{{ formatLocation(citation) }}</span>
                            <p>{{ citation.excerpt }}</p>
                            <small>向量分数 {{ formatScore(citation.score) }} · 重排分数 {{ formatScore(citation.reranker_score) }}</small>
                        </article>
                    </div>
                </div>
            </div>

            <div v-show="activeTab === 'diag'" class="qa-panel">
                <form class="retrieval-form" @submit.prevent="submitRetrieval">
                    <label>查询<input data-testid="archive-retrieval-input" v-model="retrievalQuery" maxlength="2000" placeholder="输入需要查找的原文主题" /></label>
                    <label>Top-K（1–10）<input data-testid="archive-retrieval-top-k" v-model.number="retrievalTopK" type="number" min="1" max="10" /></label>
                    <button type="submit" data-testid="archive-retrieval-submit" class="secondary-button" :disabled="props.loading['archive-retrieval']" @click.prevent="submitRetrieval">{{ props.loading['archive-retrieval'] ? '正在检索…' : '检索原文' }}</button>
                </form>
                <p v-if="retrievalError" class="inline-error">{{ retrievalError }}</p>
                <div v-if="props.retrieval" class="retrieval-result">
                    <p class="result-meta">请求 Top-K {{ props.retrieval.requested_top_k }} · 返回 {{ props.retrieval.returned_count }} 条</p>
                    <article v-for="item in props.retrieval.items" :key="item.chunk_id" class="evidence-card">
                        <strong>{{ item.filename }}</strong
                        ><span>{{ formatLocation(item) }}</span>
                        <p>{{ item.excerpt }}</p>
                        <small>向量分数 {{ formatScore(item.score) }} · 重排分数 {{ formatScore(item.reranker_score) }}</small>
                    </article>
                    <small class="diagnostic-note">分数仅供检索诊断，不作为前端证据充分性阈值。</small>
                </div>
            </div>
        </article>
    </section>
</template>

<style scoped>
.question-page {
    max-width: 820px;
    margin: 0 auto;
}
.qa-card {
    max-width: 820px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
    box-shadow: var(--shadow-xs);
    overflow: hidden;
}
.qa-tabs {
    display: flex;
    align-items: center;
    gap: 2px;
    border-bottom: 1px solid var(--line);
    padding: 0 12px;
}
.qa-tab {
    border: 0;
    background: none;
    padding: 13px 14px;
    color: var(--ink-3);
    font-size: 13px;
    font-weight: 600;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
}
.qa-tab:hover {
    color: var(--ink-2);
}
.qa-tab.active {
    color: var(--ink);
    border-bottom-color: var(--ink);
}
.qa-panel {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 18px;
}
.qa-panel label {
    display: grid;
    gap: 7px;
    color: var(--ink-2);
    font-size: 12.5px;
    font-weight: 600;
}
.qa-panel textarea,
.retrieval-form input {
    width: 100%;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-md);
    padding: 10px 12px;
    outline: none;
    color: var(--ink);
    background: var(--surface);
    transition:
        border-color 0.15s,
        box-shadow 0.15s;
}
.qa-panel textarea {
    min-height: 84px;
    resize: vertical;
}
.qa-panel textarea:focus,
.retrieval-form input:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(26, 115, 232, 0.1);
}
.ask-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}
.ask-hint {
    color: var(--ink-3);
    font-size: 11.5px;
}
.retrieval-form {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 96px auto;
    gap: 8px;
    align-items: end;
}
.retrieval-form label {
    font-size: 11.5px;
}
.inline-error {
    margin: -6px 0 0;
    color: var(--danger);
    font-size: 12px;
}
.answer-result,
.retrieval-result {
    margin-top: 4px;
}
.answer-result {
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 16px 18px;
    background: var(--surface);
}
.answer-result.refused {
    border: 1px dashed var(--line-strong);
    background: var(--surface-2);
}
.result-label {
    display: flex;
    align-items: center;
    gap: 7px;
    color: var(--ink-3);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.5px;
}
.result-label::before {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    content: '';
    background: var(--ink-3);
}
.answer-result.answered .result-label {
    color: var(--ink-2);
}
.answer-result.answered .result-label::before {
    background: var(--success);
}
.answer-result > p {
    margin: 10px 0 0;
    color: var(--ink);
    line-height: 1.8;
    white-space: pre-wrap;
}
.citation-list h3 {
    margin: 16px 0 8px;
    font-size: 12.5px;
    color: var(--ink-2);
}
.evidence-card {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 5px 12px;
    margin-top: 8px;
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    padding: 11px 12px;
    background: var(--surface);
    box-shadow: var(--shadow-xs);
}
.evidence-card strong {
    color: var(--ink);
    font-size: 12.5px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.evidence-card > span {
    justify-self: end;
    color: var(--primary-hover);
    font-family: var(--font-mono);
    font-size: 11px;
    background: var(--primary-weak);
    border-radius: 5px;
    padding: 2px 8px;
    white-space: nowrap;
}
.evidence-card p {
    grid-column: 1 / -1;
    margin: 3px 0 0;
    color: var(--ink-2);
    font-size: 12.5px;
    line-height: 1.65;
}
.evidence-card small {
    grid-column: 1 / -1;
    color: var(--ink-3);
    font-family: var(--font-mono);
    font-size: 10.5px;
}
.retrieval-result .evidence-card {
    margin-top: 8px;
}
.result-meta {
    margin: 0;
    color: var(--ink-3);
    font-family: var(--font-mono);
    font-size: 11px;
}
.diagnostic-note {
    margin-top: 4px;
    color: var(--ink-3);
    font-size: 11.5px;
    line-height: 1.7;
}
@media (max-width: 560px) {
    .retrieval-form {
        grid-template-columns: 1fr 90px;
    }
    .retrieval-form button {
        grid-column: 1 / -1;
    }
}
</style>
