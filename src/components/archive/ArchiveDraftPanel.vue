<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { ArchiveDraft, ArchiveFieldDraft, ArchiveFieldName, ArchiveFieldUpdate, ArchiveDocumentType, EvidenceLocationType, FieldEvidenceInput, FieldReviewStatus, ProjectStage } from '../../types'

const props = defineProps<{
    draft: ArchiveDraft
    loading: Record<string, boolean>
}>()

const emit = defineEmits<{
    suggest: []
    'retry-suggest': []
    regenerate: [expectedVersion: number]
    'manual-draft': []
    'save-field': [fieldName: ArchiveFieldName, payload: ArchiveFieldUpdate]
    notify: [message: string, kind?: 'ok' | 'info']
    confirm: [expectedVersion: number]
    'cancel-confirmation': [expectedVersion: number]
}>()

const fieldLabels: Record<ArchiveFieldName, string> = {
    TITLE: '标题',
    DOCUMENT_TYPE: '资料类型',
    DOCUMENT_DATE: '文档日期',
    AUTHORING_ORGANIZATION: '编制单位',
    VERSION_NUMBER: '版本号',
    PROJECT_STAGE: '项目阶段',
    KEYWORDS: '关键词'
}
const fieldOrder: ArchiveFieldName[] = ['TITLE', 'DOCUMENT_TYPE', 'DOCUMENT_DATE', 'AUTHORING_ORGANIZATION', 'VERSION_NUMBER', 'PROJECT_STAGE', 'KEYWORDS']
const documentTypes: Array<{ value: ArchiveDocumentType; label: string }> = [
    { value: 'CONTRACT', label: '合同' },
    { value: 'DESIGN', label: '设计' },
    { value: 'CONSTRUCTION', label: '施工' },
    { value: 'MEETING_MINUTES', label: '会议纪要' },
    { value: 'ACCEPTANCE', label: '验收' },
    { value: 'OTHER', label: '其他' }
]
const projectStages: Array<{ value: ProjectStage; label: string }> = [
    { value: 'PREPARATION', label: '准备' },
    { value: 'DESIGN', label: '设计' },
    { value: 'CONSTRUCTION', label: '施工' },
    { value: 'ACCEPTANCE', label: '验收' },
    { value: 'CROSS_STAGE', label: '跨阶段' },
    { value: 'OTHER_STAGE', label: '其他阶段' }
]
const reviewStatusLabels: Record<FieldReviewStatus, string> = {
    PENDING_CHECK: '待检查',
    VALUE_CONFIRMED: '值已确认',
    EMPTY_ACCEPTED: '接受为空'
}
const locationTypeLabels: Record<EvidenceLocationType, string> = {
    PDF_PAGE: 'PDF 页码',
    DOCX_PARAGRAPH: 'DOCX 段落',
    TEXT_LINE_RANGE: '文本行区间'
}
function startLocationLabel(type: EvidenceLocationType) {
    if (type === 'PDF_PAGE') return '页码'
    if (type === 'DOCX_PARAGRAPH') return '段落号'
    return '起始行'
}
const localValues = reactive<Record<string, string>>({})
const localStatuses = reactive<Record<string, FieldReviewStatus>>({})
const localNoEvidence = reactive<Record<string, boolean>>({})
const localEvidences = reactive<Record<string, FieldEvidenceInput[]>>({})

function valueOf(field: ArchiveFieldDraft) {
    if (field.field_name === 'DOCUMENT_DATE') return field.date_value || ''
    if (field.field_name === 'KEYWORDS') return (field.json_value || []).join(', ')
    return field.text_value || ''
}

function syncValues(draft: ArchiveDraft) {
    for (const field of draft.fields) {
        localValues[field.field_name] = valueOf(field)
        localStatuses[field.field_name] = field.review_status
        localNoEvidence[field.field_name] = field.no_source_evidence
        localEvidences[field.field_name] = field.evidences.map(({ excerpt, location_type, location_start, location_end, normalized_anchor }) => ({ excerpt, location_type, location_start, location_end, normalized_anchor }))
    }
}

watch(() => props.draft, syncValues, { immediate: true })

function fieldByName(fieldName: ArchiveFieldName) {
    return props.draft.fields.find(field => field.field_name === fieldName)
}

function canEdit() {
    return props.draft.document.status === 'PENDING_CONFIRMATION' || props.draft.document.status === 'PENDING_RECONFIRMATION'
}

function canRegenerate() {
    return props.draft.document.status === 'PENDING_CONFIRMATION' && props.draft.fields.length === fieldOrder.length && props.draft.fields.every(field => field.review_status === 'PENDING_CHECK' && field.source !== 'MANUAL' && !field.no_source_evidence)
}

function uncheckedCount() {
    return fieldOrder.filter(fieldName => fieldByName(fieldName)?.review_status === 'PENDING_CHECK').length
}

function allFieldsChecked() {
    return props.draft.fields.length === fieldOrder.length && props.draft.fields.every(field => field.review_status !== 'PENDING_CHECK')
}

function setValue(fieldName: ArchiveFieldName, value: string) {
    localValues[fieldName] = value
}

function setStatus(fieldName: ArchiveFieldName, value: string) {
    localStatuses[fieldName] = value as FieldReviewStatus
}

function setEvidenceValue(fieldName: ArchiveFieldName, index: number, key: keyof FieldEvidenceInput, value: string) {
    const evidence = localEvidences[fieldName]?.[index]
    if (!evidence) return
    if (key === 'location_type') {
        evidence.location_type = value as EvidenceLocationType
        if (evidence.location_type !== 'TEXT_LINE_RANGE') evidence.location_end = evidence.location_start
    } else if (key === 'location_start') {
        evidence.location_start = Number(value) || 1
        if (evidence.location_type !== 'TEXT_LINE_RANGE') evidence.location_end = evidence.location_start
    } else if (key === 'location_end') {
        evidence.location_end = Number(value) || evidence.location_start
    } else if (key === 'normalized_anchor') {
        evidence.normalized_anchor = value || null
    } else {
        evidence.excerpt = value
    }
}

function addEvidence(fieldName: ArchiveFieldName) {
    if (localNoEvidence[fieldName]) return
    localEvidences[fieldName] = [
        ...(localEvidences[fieldName] || []),
        {
            excerpt: '',
            location_type: 'TEXT_LINE_RANGE',
            location_start: 1,
            location_end: 1,
            normalized_anchor: null
        }
    ]
    emit('notify', '已添加证据')
}

function removeEvidence(fieldName: ArchiveFieldName, index: number) {
    localEvidences[fieldName] = (localEvidences[fieldName] || []).filter((_evidence, evidenceIndex) => evidenceIndex !== index)
    emit('notify', '已删除证据')
}

function toggleNoEvidence(fieldName: ArchiveFieldName, value: boolean) {
    localNoEvidence[fieldName] = value
    if (value) localEvidences[fieldName] = []
}

function statusesFor(fieldName: ArchiveFieldName): FieldReviewStatus[] {
    return fieldName === 'TITLE' || fieldName === 'DOCUMENT_TYPE' ? ['PENDING_CHECK', 'VALUE_CONFIRMED'] : ['PENDING_CHECK', 'VALUE_CONFIRMED', 'EMPTY_ACCEPTED']
}

function saveField(field: ArchiveFieldDraft) {
    const value = localValues[field.field_name] || ''
    const noSourceEvidence = Boolean(localNoEvidence[field.field_name])
    const reviewStatus = localStatuses[field.field_name] || 'PENDING_CHECK'
    const payload: ArchiveFieldUpdate = {
        text_value: null,
        date_value: null,
        json_value: null,
        review_status: reviewStatus,
        source: 'MANUAL',
        no_source_evidence: noSourceEvidence,
        evidences: noSourceEvidence ? [] : (localEvidences[field.field_name] || []).map(evidence => ({ ...evidence })),
        expected_version: props.draft.document.version
    }
    if (reviewStatus !== 'EMPTY_ACCEPTED') {
        if (field.field_name === 'DOCUMENT_DATE') payload.date_value = value || null
        else if (field.field_name === 'KEYWORDS')
            payload.json_value = value
                .split(',')
                .map(item => item.trim())
                .filter(Boolean)
        else payload.text_value = value || null
    }
    emit('save-field', field.field_name, payload)
}

function locationText(field: ArchiveFieldDraft) {
    return field.evidences
        .map(evidence => {
            const label = locationTypeLabels[evidence.location_type]
            if (evidence.location_type === 'TEXT_LINE_RANGE' && evidence.location_start !== evidence.location_end) {
                return `${label} ${evidence.location_start}–${evidence.location_end}`
            }
            return `${label} ${evidence.location_start}`
        })
        .join('；')
}
</script>

<template>
    <section class="draft-panel" data-testid="archive-draft-panel">
        <header class="draft-header">
            <div>
                <span class="eyebrow">FR-034 / FR-035 / FR-036 · ARCHIVE DRAFT</span>
                <h1>字段草稿与检查</h1>
                <p>{{ draft.document.filename }} · 当前文档版本 v{{ draft.document.version }}</p>
            </div>
            <div class="draft-actions">
                <button v-if="draft.document.status === 'PENDING_CONFIRMATION'" data-testid="confirm-archive" class="primary-button" :disabled="!allFieldsChecked() || loading[`confirm-archive-document:${draft.document.id}`]" @click="emit('confirm', draft.document.version)">
                    {{ allFieldsChecked() ? '确认并正式入档' : `确认并正式入档（还剩 ${uncheckedCount()} 个字段待检查）` }}
                </button>
                <button v-if="draft.document.status === 'PENDING_RECONFIRMATION'" data-testid="reconfirm-archive" class="primary-button" :disabled="!allFieldsChecked() || loading[`confirm-archive-document:${draft.document.id}`]" @click="emit('confirm', draft.document.version)">
                    重新确认并正式入档
                </button>
                <button v-if="draft.document.status === 'CONFIRMED'" data-testid="cancel-confirmation" class="danger-button" :disabled="loading[`cancel-confirmation:${draft.document.id}`]" @click="emit('cancel-confirmation', draft.document.version)">取消正式入档</button>
                <button v-if="draft.document.status === 'PARSED'" data-testid="create-suggestions" class="primary-button" :disabled="loading[`create-archive-suggestions:${draft.document.id}`]" @click="emit('suggest')">生成 AI 建议</button>
                <button v-if="draft.document.status === 'SUGGESTION_FAILED'" data-testid="retry-suggestions" class="secondary-button" :disabled="loading[`retry-archive-suggestions:${draft.document.id}`]" @click="emit('retry-suggest')">重试 AI 建议</button>
                <button v-if="draft.document.status === 'PARSED' || draft.document.status === 'SUGGESTION_FAILED'" data-testid="create-manual-draft" class="secondary-button" :disabled="loading[`create-manual-archive-draft:${draft.document.id}`]" @click="emit('manual-draft')">启动人工草稿</button>
                <button v-if="canRegenerate()" data-testid="regenerate-suggestions" class="secondary-button" :disabled="loading[`regenerate-archive-suggestions:${draft.document.id}`]" @click="emit('regenerate', draft.document.version)">重新生成建议</button>
            </div>
        </header>

        <div class="draft-notice" v-if="draft.document.status === 'CONFIRMED'">
            <strong>已确认并正式入档。</strong>
            <span v-if="draft.document.confirmed_at">确认时间：{{ draft.document.confirmed_at }}</span>
            <span v-if="draft.document.index_context_chunk_count !== null && draft.document.index_context_chunk_count !== undefined">索引上下文 Chunk：{{ draft.document.index_context_chunk_count }}</span>
        </div>
        <div class="draft-notice" v-else>完成七字段检查后可执行 FR-036 确认；当前页面不会伪造正式目录或检索结果。</div>
        <div class="draft-fields">
            <article v-for="fieldName in fieldOrder" :key="fieldName" class="draft-field" :data-testid="`draft-field-${fieldName}`">
                <div class="field-heading">
                    <label :for="`field-${fieldName}`">{{ fieldLabels[fieldName] }}</label
                    ><span class="review-status-tag">{{ reviewStatusLabels[fieldByName(fieldName)?.review_status || 'PENDING_CHECK'] }}</span>
                </div>
                <select :data-testid="`review-status-${fieldName}`" :value="localStatuses[fieldName]" :disabled="!canEdit()" @change="setStatus(fieldName, ($event.target as HTMLSelectElement).value)">
                    <option v-for="status in statusesFor(fieldName)" :key="status" :value="status">{{ reviewStatusLabels[status] }}</option>
                </select>
                <select v-if="fieldName === 'DOCUMENT_TYPE'" :id="`field-${fieldName}`" :data-testid="`field-${fieldName}`" :value="localValues[fieldName]" :disabled="!canEdit()" @change="setValue(fieldName, ($event.target as HTMLSelectElement).value)">
                    <option value="">请选择资料类型</option>
                    <option v-for="option in documentTypes" :key="option.value" :value="option.value">{{ option.label }}</option>
                </select>
                <select v-else-if="fieldName === 'PROJECT_STAGE'" :id="`field-${fieldName}`" :data-testid="`field-${fieldName}`" :value="localValues[fieldName]" :disabled="!canEdit()" @change="setValue(fieldName, ($event.target as HTMLSelectElement).value)">
                    <option value="">请选择项目阶段</option>
                    <option v-for="option in projectStages" :key="option.value" :value="option.value">{{ option.label }}</option>
                </select>
                <input v-else :id="`field-${fieldName}`" :type="fieldName === 'DOCUMENT_DATE' ? 'date' : 'text'" :data-testid="`field-${fieldName}`" :value="localValues[fieldName]" :readonly="!canEdit()" @input="setValue(fieldName, ($event.target as HTMLInputElement).value)" />
                <label class="no-evidence-toggle" v-if="canEdit()"
                    ><input :data-testid="`no-evidence-${fieldName}`" type="checkbox" :checked="localNoEvidence[fieldName]" :disabled="Boolean(localEvidences[fieldName]?.length)" @change="toggleNoEvidence(fieldName, ($event.target as HTMLInputElement).checked)" />确认无原文证据</label
                >
                <div v-if="canEdit() && !localNoEvidence[fieldName]" class="evidence-editor" :data-testid="`evidence-editor-${fieldName}`">
                    <div v-for="(evidence, evidenceIndex) in localEvidences[fieldName]" :key="`${fieldName}-${evidenceIndex}`" class="evidence-row">
                        <div class="evidence-excerpt-row">
                            <textarea rows="2" :data-testid="`evidence-excerpt-${fieldName}-${evidenceIndex}`" :value="evidence.excerpt" placeholder="证据摘录（原文内容）" @input="setEvidenceValue(fieldName, evidenceIndex, 'excerpt', ($event.target as HTMLTextAreaElement).value)"></textarea>
                            <button type="button" class="danger-button sm evidence-remove" :data-testid="`evidence-remove-${fieldName}-${evidenceIndex}`" @click="removeEvidence(fieldName, evidenceIndex)">删除证据</button>
                        </div>
                        <div class="evidence-location-grid">
                            <label class="evidence-field">
                                <span>定位类型</span>
                                <select :data-testid="`evidence-location-${fieldName}-${evidenceIndex}`" :value="evidence.location_type" @change="setEvidenceValue(fieldName, evidenceIndex, 'location_type', ($event.target as HTMLSelectElement).value)">
                                    <option value="PDF_PAGE">PDF 页码</option>
                                    <option value="DOCX_PARAGRAPH">DOCX 段落</option>
                                    <option value="TEXT_LINE_RANGE">文本行区间</option>
                                </select>
                            </label>
                            <label class="evidence-field">
                                <span>{{ startLocationLabel(evidence.location_type) }}</span>
                                <input :data-testid="`evidence-start-${fieldName}-${evidenceIndex}`" type="number" min="1" :value="evidence.location_start" @input="setEvidenceValue(fieldName, evidenceIndex, 'location_start', ($event.target as HTMLInputElement).value)" />
                            </label>
                            <label v-if="evidence.location_type === 'TEXT_LINE_RANGE'" class="evidence-field">
                                <span>结束行</span>
                                <input :data-testid="`evidence-end-${fieldName}-${evidenceIndex}`" type="number" min="1" :value="evidence.location_end" @input="setEvidenceValue(fieldName, evidenceIndex, 'location_end', ($event.target as HTMLInputElement).value)" />
                            </label>
                        </div>
                        <label class="evidence-field evidence-anchor-field">
                            <span>规范化辅助摘录<span class="evidence-hint">（可选，DOCX 等场景定位用，如：施工方案（版本：V1.0））</span></span>
                            <input
                                :data-testid="`evidence-anchor-${fieldName}-${evidenceIndex}`"
                                :value="evidence.normalized_anchor || ''"
                                placeholder="例如：施工方案（版本：V1.0）"
                                @input="setEvidenceValue(fieldName, evidenceIndex, 'normalized_anchor', ($event.target as HTMLInputElement).value)" />
                        </label>
                    </div>
                    <button type="button" class="secondary-button sm" :data-testid="`evidence-add-${fieldName}`" @click="addEvidence(fieldName)">＋ 添加证据</button>
                </div>
                <div class="field-meta">
                    <span>{{ fieldByName(fieldName)?.source === 'AI' ? 'AI 建议' : fieldByName(fieldName)?.source === 'MANUAL' ? '人工填写' : '尚无来源' }}</span
                    ><span v-if="fieldByName(fieldName)?.evidences.length">证据：{{ locationText(fieldByName(fieldName)!) }}</span
                    ><span v-else-if="localNoEvidence[fieldName]">人工填写、无原文证据</span><span v-else-if="localValues[fieldName]">非空人工值需要明确勾选无原文证据或提供证据</span>
                </div>
                <small v-if="fieldByName(fieldName)?.evidences.length" class="evidence-excerpt">{{
                    fieldByName(fieldName)
                        ?.evidences.map(evidence => evidence.excerpt)
                        .join('；')
                }}</small>
                <button v-if="canEdit()" class="primary-button sm save-field" :data-testid="`save-field-${fieldName}`" :disabled="loading[`update-archive-field:${draft.document.id}:${fieldName}`]" @click="saveField(fieldByName(fieldName)!)">保存字段检查</button>
            </article>
        </div>
    </section>
</template>

<style scoped>
.draft-panel {
    display: grid;
    gap: 24px;
    margin-top: 8px;
}
.draft-header {
    display: flex;
    justify-content: space-between;
    gap: 24px;
    align-items: flex-start;
}
.draft-header h1 {
    margin: 6px 0 5px;
    font-size: 20px;
    letter-spacing: -0.01em;
}
.draft-header p {
    margin: 0;
    color: var(--ink-2);
    font-size: 13px;
}
.draft-actions {
    display: flex;
    gap: 8px;
    row-gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
    margin-top: 20px;
}
.draft-notice {
    padding: 12px 16px;
    border: 1px solid var(--primary-line);
    border-radius: var(--radius-md);
    background: var(--primary-weak);
    color: var(--primary-hover);
    font-size: 13px;
}
.draft-fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
    align-items: start;
}
.draft-field {
    display: grid;
    gap: 8px;
    padding: 16px;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    background: #fff;
}
.field-heading {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-weight: 700;
}
.field-heading span,
.field-meta,
.evidence-excerpt {
    color: #64748b;
    font-size: 12px;
}
.draft-field input,
.draft-field select,
.draft-field textarea {
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 10px 12px;
    font: inherit;
}
.field-meta {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}
.evidence-excerpt {
    line-height: 1.5;
}
.save-field {
    justify-self: start;
}
@media (max-width: 900px) {
    .draft-header {
        flex-direction: column;
    }
    .draft-fields {
        grid-template-columns: 1fr;
    }
}
.review-status-tag {
    border-radius: 999px;
    padding: 2px 10px;
    background: #fff7e6;
    color: #b45309;
    font-size: 12px;
    font-weight: 600;
}
.evidence-editor {
    display: grid;
    gap: 10px;
}
.evidence-row {
    display: grid;
    gap: 10px;
    padding: 12px;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    background: #f8fafc;
}
.evidence-excerpt-row {
    display: flex;
    gap: 10px;
    align-items: flex-start;
}
.evidence-excerpt-row textarea {
    flex: 1;
    min-width: 0;
    resize: vertical;
    line-height: 1.6;
    font-family: inherit;
}
.evidence-remove {
    margin-top: 10px;
}
.evidence-remove {
    flex-shrink: 0;
    white-space: nowrap;
}
.evidence-location-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
}
.evidence-field {
    display: grid;
    gap: 4px;
    min-width: 0;
}
.evidence-field input,
.evidence-field select {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
}
.evidence-field > span {
    color: #475467;
    font-size: 12px;
    font-weight: 600;
}
.evidence-hint {
    font-weight: 400;
    color: #94a3b8;
}
.evidence-anchor-field {
    grid-column: 1 / -1;
}
@media (max-width: 560px) {
    .evidence-location-grid {
        grid-template-columns: 1fr 1fr;
    }
}
</style>
