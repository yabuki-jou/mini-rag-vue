<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { ArchiveDetail, ArchiveDocumentType, ArchiveFilters, ArchiveSummary, ProjectStage } from '../../types'

const props = defineProps<{
  archives: ArchiveSummary[]
  page: number
  pageSize: number
  total: number
  filters: ArchiveFilters
  loading: Record<string, boolean>
  currentArchive: ArchiveDetail | null
}>()

const emit = defineEmits<{
  'filter-change': [filters: ArchiveFilters]
  'page-change': [page: number]
  'open-detail': [documentId: string]
}>()

const form = reactive({ document_type: '', project_stage: '', document_date_from: '', document_date_to: '', document_date_is_null: false, authoring_organization: '' })
const documentTypes: Array<[ArchiveDocumentType, string]> = [['CONTRACT', '合同'], ['DESIGN', '设计资料'], ['CONSTRUCTION', '施工资料'], ['MEETING_MINUTES', '会议纪要'], ['ACCEPTANCE', '验收资料'], ['OTHER', '其他']]
const projectStages: Array<[ProjectStage, string]> = [['PREPARATION', '准备阶段'], ['DESIGN', '设计阶段'], ['CONSTRUCTION', '施工阶段'], ['ACCEPTANCE', '验收阶段'], ['CROSS_STAGE', '跨阶段'], ['OTHER_STAGE', '其他阶段']]
const typeLabels = Object.fromEntries(documentTypes)
const stageLabels = Object.fromEntries(projectStages)
const fieldLabels: Record<string, string> = { TITLE: '标题', DOCUMENT_TYPE: '资料类型', DOCUMENT_DATE: '文档日期', AUTHORING_ORGANIZATION: '责任单位', VERSION_NUMBER: '版本号', PROJECT_STAGE: '项目阶段', KEYWORDS: '关键词' }
const canPrev = computed(() => props.page > 1)
const canNext = computed(() => props.page * props.pageSize < props.total)

watch(() => props.filters, (filters) => {
  Object.assign(form, { document_type: filters.document_type || '', project_stage: filters.project_stage || '', document_date_from: filters.document_date_from || '', document_date_to: filters.document_date_to || '', document_date_is_null: filters.document_date_is_null || false, authoring_organization: filters.authoring_organization || '' })
}, { immediate: true, deep: true })

function applyFilters() {
  const filters: ArchiveFilters = {}
  if (form.document_type) filters.document_type = form.document_type as ArchiveDocumentType
  if (form.project_stage) filters.project_stage = form.project_stage as ProjectStage
  if (form.document_date_from) filters.document_date_from = form.document_date_from
  if (form.document_date_to) filters.document_date_to = form.document_date_to
  if (form.document_date_is_null) filters.document_date_is_null = true
  if (form.authoring_organization.trim()) filters.authoring_organization = form.authoring_organization.trim()
  emit('filter-change', filters)
}

function archiveDateLabel(documentType: ArchiveDocumentType | null) {
  return documentType === 'CONTRACT' ? '合同签订日期' : '文档日期'
}

function fieldLabel(fieldName: string, documentType: ArchiveDocumentType | null) {
  return fieldName === 'DOCUMENT_DATE' ? archiveDateLabel(documentType) : fieldLabels[fieldName] || fieldName
}

function clearDateRangeWhenNull() {
  if (form.document_date_is_null) {
    form.document_date_from = ''
    form.document_date_to = ''
  }
}

function fieldValue(field: ArchiveDetail['fields'][number]) {
  return field.text_value || field.date_value || field.json_value?.join('、') || '（空值）'
}

function evidenceLocation(evidence: ArchiveDetail['fields'][number]['evidences'][number]) {
  if (evidence.location_type === 'PDF_PAGE') return `PDF 第 ${evidence.location_start} 页`
  if (evidence.location_type === 'DOCX_PARAGRAPH') return `DOCX 第 ${evidence.location_start} 段`
  return `文本第 ${evidence.location_start}-${evidence.location_end} 行`
}
</script>

<template>
  <section class="archive-catalog-panel" data-testid="archive-catalog-panel">
    <header class="catalog-header"><div><span class="eyebrow">FR-038 · FORMAL ARCHIVE CATALOG</span><h1>正式档案目录</h1><p>只展示服务端已确认并归属于当前项目的档案。</p></div></header>
    <form class="catalog-filters" @submit.prevent="applyFilters">
      <select data-testid="archive-document-type-filter" v-model="form.document_type"><option value="">全部资料类型</option><option v-for="[value, label] in documentTypes" :key="value" :value="value">{{ label }}</option></select>
      <select v-model="form.project_stage"><option value="">全部项目阶段</option><option v-for="[value, label] in projectStages" :key="value" :value="value">{{ label }}</option></select>
      <input data-testid="archive-date-from" v-model="form.document_date_from" type="date" aria-label="起始日期" :disabled="form.document_date_is_null" /><input data-testid="archive-date-to" v-model="form.document_date_to" type="date" aria-label="结束日期" :disabled="form.document_date_is_null" />
      <label class="checkbox-row"><input data-testid="archive-date-null-filter" v-model="form.document_date_is_null" type="checkbox" @change="clearDateRangeWhenNull" />日期为空</label>
      <input v-model="form.authoring_organization" placeholder="责任单位" />
      <button class="primary-button" type="submit">应用筛选</button>
    </form>
    <div v-if="!archives.length" class="archive-empty">当前筛选下没有正式档案。</div>
    <section v-else class="archive-table">
      <div class="archive-table-head"><span>文件名</span><span>标题</span><span>资料类型</span><span>项目阶段</span><span>责任单位</span><span>日期</span><span>确认时间</span><span>操作</span></div>
      <article v-for="archive in archives" :key="archive.id" class="archive-row">
        <span>{{ archive.filename }}</span><span>{{ archive.title || '（无标题）' }}</span><span>{{ archive.document_type ? typeLabels[archive.document_type] : '—' }}</span><span>{{ archive.project_stage ? stageLabels[archive.project_stage] : '—' }}</span><span>{{ archive.authoring_organization || '—' }}</span><span>{{ archive.document_date || '—' }}</span><span>{{ archive.confirmed_at }}</span><button class="link-button" @click="emit('open-detail', archive.id)">查看详情</button>
      </article>
    </section>
    <footer class="catalog-pagination"><span>共 {{ total }} 份 · 第 {{ page }} 页</span><button data-testid="archive-prev-page" :disabled="!canPrev" @click="emit('page-change', page - 1)">上一页</button><button data-testid="archive-next-page" :disabled="!canNext" @click="emit('page-change', page + 1)">下一页</button></footer>
    <aside v-if="currentArchive" class="archive-detail" data-testid="archive-detail">
      <div class="card-heading"><div><span class="eyebrow">ARCHIVE DETAIL</span><h2>{{ currentArchive.title || currentArchive.filename }}</h2></div><span>v{{ currentArchive.version }}</span></div>
      <p>{{ archiveDateLabel(currentArchive.document_type) }}：{{ currentArchive.document_date || '（未提供）' }}</p>
      <article v-for="field in currentArchive.fields" :key="field.id" class="archive-field"><strong>{{ fieldLabel(field.field_name, currentArchive.document_type) }}</strong><span>{{ fieldValue(field) }}</span><small v-for="evidence in field.evidences" :key="evidence.id">{{ evidenceLocation(evidence) }}：{{ evidence.excerpt }}</small></article>
    </aside>
  </section>
</template>

<style scoped>
.archive-catalog-panel{display:grid;gap:18px}.catalog-header h1{margin:5px 0;font-size:28px}.catalog-header p{margin:0;color:#64748b}.catalog-filters{display:flex;flex-wrap:wrap;gap:10px;padding:16px;border:1px solid #e2e8f0;border-radius:12px;background:#fff}.catalog-filters select,.catalog-filters input{min-height:38px;padding:0 10px;border:1px solid #cbd5e1;border-radius:7px}.catalog-filters .checkbox-row{display:flex;align-items:center;gap:5px}.archive-table{overflow:hidden;border:1px solid #e2e8f0;border-radius:12px;background:#fff}.archive-table-head,.archive-row{display:grid;grid-template-columns:1.4fr 1.4fr .9fr .9fr 1.1fr .9fr 1.2fr .7fr;gap:12px;align-items:center;padding:13px 16px}.archive-table-head{background:#f8fafc;color:#64748b;font-size:12px;font-weight:700}.archive-row{border-top:1px solid #e2e8f0;font-size:13px}.archive-empty{padding:50px;text-align:center;color:#64748b;border:1px dashed #cbd5e1;border-radius:12px}.catalog-pagination{display:flex;align-items:center;justify-content:flex-end;gap:9px;color:#64748b}.catalog-pagination button{padding:7px 12px;border:1px solid #cbd5e1;border-radius:7px;background:#fff}.archive-detail{display:grid;gap:12px;padding:20px;border:1px solid #bfdbfe;border-radius:12px;background:#f8fbff}.archive-detail h2{margin:5px 0}.archive-field{display:grid;gap:4px;padding:12px;border-radius:8px;background:#fff}.archive-field small{color:#475569}.archive-field small::before{content:'证据：';font-weight:700}@media(max-width:1100px){.archive-table-head{display:none}.archive-row{grid-template-columns:1fr;gap:6px}.archive-row span::before{content:' ';font-weight:700}}
</style>
