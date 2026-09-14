<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import type {
  ArchiveDocumentType,
  ChecklistItem,
  ChecklistItemCreate,
  ChecklistItemUpdate,
  ProjectStage,
} from '../../types'

const props = defineProps<{
  items: ChecklistItem[]
  projectVersion: number
  loading: Record<string, boolean>
}>()

const emit = defineEmits<{
  refresh: []
  create: [payload: ChecklistItemCreate]
  update: [itemId: string, payload: ChecklistItemUpdate]
  delete: [itemId: string]
}>()

const documentTypes: Array<{ value: ArchiveDocumentType; label: string }> = [
  { value: 'CONTRACT', label: '项目合同' },
  { value: 'DESIGN', label: '设计资料' },
  { value: 'CONSTRUCTION', label: '施工资料' },
  { value: 'MEETING_MINUTES', label: '会议纪要' },
  { value: 'ACCEPTANCE', label: '验收资料' },
  { value: 'OTHER', label: '其他资料' },
]

const projectStages: Array<{ value: ProjectStage; label: string }> = [
  { value: 'PREPARATION', label: '准备阶段' },
  { value: 'DESIGN', label: '设计阶段' },
  { value: 'CONSTRUCTION', label: '施工阶段' },
  { value: 'ACCEPTANCE', label: '验收阶段' },
  { value: 'CROSS_STAGE', label: '跨阶段' },
  { value: 'OTHER_STAGE', label: '其他阶段' },
]

const statusLabels = {
  SATISFIED: '已满足',
  MISSING: '缺失',
  NOT_PROVIDED: '未提供',
} as const

const editorOpen = ref(false)
const editingItem = ref<ChecklistItem | null>(null)
const form = reactive({
  name: '',
  documentType: 'OTHER' as ArchiveDocumentType,
  isRequired: true,
  projectStage: 'OTHER_STAGE' as ProjectStage,
  description: '',
})

const satisfiedCount = computed(() => props.items.filter((item) => item.fulfillment_status === 'SATISFIED').length)
const missingCount = computed(() => props.items.filter((item) => item.fulfillment_status === 'MISSING').length)
const notProvidedCount = computed(() => props.items.filter((item) => item.fulfillment_status === 'NOT_PROVIDED').length)

function resetForm() {
  editingItem.value = null
  form.name = ''
  form.documentType = 'OTHER'
  form.isRequired = true
  form.projectStage = 'OTHER_STAGE'
  form.description = ''
}

function openCreate() {
  resetForm()
  editorOpen.value = true
}

function openEdit(item: ChecklistItem) {
  editingItem.value = item
  form.name = item.name
  form.documentType = item.document_type
  form.isRequired = item.is_required
  form.projectStage = item.project_stage
  form.description = item.description || ''
  editorOpen.value = true
}

function closeEditor() {
  editorOpen.value = false
  resetForm()
}

function submitForm() {
  const name = form.name.trim()
  if (!name) return
  const commonFields = {
    name,
    document_type: form.documentType,
    is_required: form.isRequired,
    project_stage: form.projectStage,
    description: form.description.trim() || null,
  }
  if (editingItem.value) {
    emit('update', editingItem.value.id, {
      ...commonFields,
      expected_version: editingItem.value.version,
    })
  } else {
    emit('create', {
      ...commonFields,
      expected_project_version: props.projectVersion,
    })
  }
  closeEditor()
}

function requestDelete(item: ChecklistItem) {
  if (window.confirm(`确定删除清单项“${item.name}”吗？已确认的关联也会被删除。`)) {
    emit('delete', item.id)
  }
}
</script>

<template>
  <section class="checklist-page">
    <header class="page-heading">
      <div>
        <span class="eyebrow">FR-031 · PROJECT CHECKLIST</span>
        <h1>项目与清单</h1>
        <p>满足状态由后端根据已确认档案和人工确认关联实时派生。</p>
      </div>
      <div class="checklist-actions">
        <button class="secondary-button" :disabled="loading['checklist-items']" @click="emit('refresh')">
          {{ loading['checklist-items'] ? '刷新中…' : '刷新清单' }}
        </button>
        <button class="primary-button" data-testid="new-checklist-item" @click="openCreate">＋ 新增清单项</button>
      </div>
    </header>

    <div class="checklist-metrics">
      <article><span>清单总数</span><strong>{{ items.length }}</strong></article>
      <article class="success"><span>已满足</span><strong>{{ satisfiedCount }}</strong></article>
      <article class="danger"><span>缺失</span><strong data-testid="missing-count">{{ missingCount }}</strong></article>
      <article class="muted"><span>未提供</span><strong>{{ notProvidedCount }}</strong></article>
    </div>

    <article class="dashboard-card checklist-card">
      <div class="checklist-table-head">
        <span>清单项</span><span>资料类型 / 阶段</span><span>满足状态</span><span>版本</span><span>操作</span>
      </div>
      <div v-if="!items.length" class="checklist-empty">
        当前项目没有清单项。空清单不产生项目级缺失结论。
      </div>
      <div v-for="item in items" v-else :key="item.id" class="checklist-row">
        <div>
          <strong data-testid="checklist-item-name">{{ item.name }}</strong>
          <small>{{ item.description || '未填写满足条件说明' }}</small>
        </div>
        <div>
          <span>{{ documentTypes.find((option) => option.value === item.document_type)?.label }}</span>
          <small>{{ projectStages.find((option) => option.value === item.project_stage)?.label }}</small>
        </div>
        <div>
          <span class="status-pill" :class="item.fulfillment_status.toLowerCase()" data-testid="checklist-item-status">
            {{ statusLabels[item.fulfillment_status] }}
          </span>
          <small>{{ item.confirmed_document_count }} 份已确认档案</small>
        </div>
        <span>v{{ item.version }}</span>
        <div class="row-actions">
          <button class="link-button" data-testid="edit-checklist-item" @click="openEdit(item)">编辑</button>
          <button
            class="link-button danger-link"
            data-testid="delete-checklist-item"
            :disabled="loading[`delete-checklist-item:${item.id}`]"
            @click="requestDelete(item)"
          >删除</button>
        </div>
      </div>
    </article>

    <div v-if="editorOpen" class="modal-backdrop" @click.self="closeEditor">
      <form class="checklist-modal" data-testid="checklist-form" @submit.prevent="submitForm">
        <header>
          <div><span class="eyebrow">{{ editingItem ? 'EDIT CHECKLIST' : 'NEW CHECKLIST' }}</span><h2>{{ editingItem ? '编辑清单项' : '新增清单项' }}</h2></div>
          <button type="button" class="modal-close" aria-label="关闭" @click="closeEditor">×</button>
        </header>
        <label>清单项名称<input v-model="form.name" data-testid="checklist-name" maxlength="200" required /></label>
        <div class="form-grid">
          <label>资料类型<select v-model="form.documentType" data-testid="checklist-document-type"><option v-for="option in documentTypes" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
          <label>项目阶段<select v-model="form.projectStage" data-testid="checklist-project-stage"><option v-for="option in projectStages" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
        </div>
        <label>满足条件说明<textarea v-model="form.description" data-testid="checklist-description" maxlength="2000" placeholder="可选；只描述人工确认规则"></textarea></label>
        <label class="checkbox-row"><input v-model="form.isRequired" type="checkbox" />必需资料<small>未满足时显示“缺失”；可选项未满足时显示“未提供”。</small></label>
        <p class="version-note">{{ editingItem ? `清单项版本 v${editingItem.version}` : `项目版本 v${projectVersion}` }} · 过期版本会由服务端拒绝</p>
        <button class="primary-button" :disabled="!form.name.trim() || loading['create-checklist-item']">
          {{ editingItem ? '保存修改' : '创建清单项' }}
        </button>
      </form>
    </div>
  </section>
</template>

<style scoped>
.checklist-actions,.row-actions,.form-grid{display:flex;gap:12px}.checklist-actions{align-items:center}.checklist-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin:20px 0}.checklist-metrics article{border-left:4px solid var(--primary);background:#fff;border-radius:10px;padding:16px;box-shadow:0 6px 18px rgba(15,23,42,.06);display:flex;justify-content:space-between;align-items:center}.checklist-metrics article.success{border-color:#52c41a}.checklist-metrics article.danger{border-color:#ff4d4f}.checklist-metrics article.muted{border-color:#8c8c8c}.checklist-metrics span{color:#64748b}.checklist-metrics strong{font-size:24px}.checklist-card{overflow:hidden}.checklist-table-head,.checklist-row{display:grid;grid-template-columns:1.4fr 1fr .9fr .35fr .65fr;gap:16px;align-items:center}.checklist-table-head{padding:12px 18px;background:#f8fafc;color:#64748b;font-size:13px;font-weight:700}.checklist-row{padding:16px 18px;border-top:1px solid #e2e8f0}.checklist-row>div{display:flex;flex-direction:column;gap:5px}.checklist-row small{color:#64748b}.status-pill{width:max-content;border-radius:999px;padding:4px 9px;font-size:12px;font-weight:700}.status-pill.satisfied{background:#f0fff0;color:#2d8b2d}.status-pill.missing{background:#fff1f0;color:#d32f2f}.status-pill.not_provided{background:#f5f5f5;color:#737373}.danger-link{color:#d32f2f}.checklist-empty{padding:48px;text-align:center;color:#64748b}.checklist-modal{width:min(620px,calc(100vw - 32px));background:#fff;border-radius:14px;padding:24px;display:grid;gap:18px;box-shadow:0 20px 50px rgba(15,23,42,.22)}.checklist-modal header{display:flex;justify-content:space-between}.checklist-modal label{display:grid;gap:7px;font-weight:600}.checklist-modal input,.checklist-modal select,.checklist-modal textarea{border:1px solid #cbd5e1;border-radius:8px;padding:10px 12px;font:inherit}.checklist-modal textarea{min-height:90px;resize:vertical}.form-grid>*{flex:1}@media(max-width:900px){.checklist-metrics{grid-template-columns:repeat(2,1fr)}.checklist-table-head{display:none}.checklist-row{grid-template-columns:1fr;gap:10px}.form-grid{flex-direction:column}}
</style>
