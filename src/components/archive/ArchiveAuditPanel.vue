<script setup lang="ts">
import { computed } from 'vue'
import type { ArchiveAuditLog, ArchiveAuditOperationType } from '../../types'

const props = defineProps<{
  logs: ArchiveAuditLog[]
  page: number
  pageSize: number
  total: number
  operationType: ArchiveAuditOperationType | ''
  loading: Record<string, boolean>
}>()

const emit = defineEmits<{
  'filter-change': [operationType: ArchiveAuditOperationType | '']
  'page-change': [page: number]
  refresh: []
}>()

const operationTypes: Array<[ArchiveAuditOperationType, string]> = [
  ['ARCHIVE_CONFIRMED', '档案确认'],
  ['ARCHIVE_CONFIRMATION_CANCELLED', '取消档案确认'],
  ['ARCHIVE_FIELD_UPDATED', '档案字段更新'],
  ['CHECKLIST_ITEM_CREATED', '创建清单项'],
  ['CHECKLIST_ITEM_UPDATED', '更新清单项'],
  ['CHECKLIST_ITEM_DELETED', '删除清单项'],
  ['CHECKLIST_LINK_CONFIRMED', '确认清单关联'],
  ['CHECKLIST_LINK_DELETED', '删除清单关联'],
  ['PARSE_RETRIED', '重试解析'],
  ['SUGGESTION_RETRIED', '重试建议'],
  ['SUGGESTION_REGENERATED', '重新生成建议'],
  ['DOCUMENT_DELETED', '删除文档'],
]
const operationLabels = Object.fromEntries(operationTypes)
const allowedSummaryKeys = ['status', 'version', 'document_type', 'is_required', 'matching_fields_changed', 'field_name', 'review_status'] as const
const summaryLabels: Record<typeof allowedSummaryKeys[number], string> = {
  status: '状态', version: '版本', document_type: '资料类型', is_required: '是否必需', matching_fields_changed: '匹配字段已变化', field_name: '字段', review_status: '检查状态',
}
const canPrev = computed(() => props.page > 1)
const canNext = computed(() => props.page * props.pageSize < props.total)

function visibleSummary(log: ArchiveAuditLog) {
  return allowedSummaryKeys
    .filter((key) => Object.prototype.hasOwnProperty.call(log.redacted_summary, key))
    .map((key) => ({ key, label: summaryLabels[key], value: formatValue(log.redacted_summary[key]) }))
}

function formatValue(value: unknown) {
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}
</script>

<template>
  <section class="audit-panel" data-testid="archive-audit-panel">
    <header class="audit-header">
      <div><span class="eyebrow">FR-041 · REDACTED AUDIT</span><h1>脱敏审计日志</h1><p>只展示当前项目内的业务操作摘要，不包含正文或模型输入输出。</p></div>
      <button data-testid="audit-refresh" class="primary-button" :disabled="loading.audit" @click="emit('refresh')">刷新</button>
    </header>
    <div class="audit-toolbar">
      <select data-testid="audit-operation-filter" :value="operationType" @change="emit('filter-change', ($event.target as HTMLSelectElement).value as ArchiveAuditOperationType | '')">
        <option value="">全部操作类型</option>
        <option v-for="[value, label] in operationTypes" :key="value" :value="value">{{ label }}</option>
      </select>
      <span>共 {{ total }} 条 · 第 {{ page }} 页</span>
    </div>
    <div v-if="loading.audit && !logs.length" class="audit-empty">正在读取审计日志…</div>
    <div v-else-if="!logs.length" class="audit-empty">当前项目暂无符合条件的审计记录。</div>
    <section v-else class="audit-list">
      <article v-for="log in logs" :key="log.id" class="audit-row">
        <div class="audit-row-main"><strong>{{ operationLabels[log.operation_type] || log.operation_type }}</strong><time>{{ new Date(log.created_at).toLocaleString('zh-CN') }}</time></div>
        <div class="audit-meta"><span>操作人：{{ log.actor_id }}</span><span>资源：{{ log.resource_type }} / {{ log.resource_id }}</span></div>
        <div v-if="visibleSummary(log).length" class="audit-summary"><span v-for="item in visibleSummary(log)" :key="item.key">{{ item.label }}：{{ item.value }}</span></div>
      </article>
    </section>
    <footer class="audit-pagination"><button data-testid="audit-prev-page" :disabled="!canPrev || loading.audit" @click="emit('page-change', page - 1)">{{ loading.audit ? '加载中…' : '上一页' }}</button><button data-testid="audit-next-page" :disabled="!canNext || loading.audit" @click="emit('page-change', page + 1)">{{ loading.audit ? '加载中…' : '下一页' }}</button></footer>
  </section>
</template>

<style scoped>
.audit-panel{display:grid;gap:18px}.audit-header{display:flex;justify-content:space-between;align-items:flex-start}.audit-header h1{margin:5px 0;font-size:28px}.audit-header p{margin:0;color:#64748b}.audit-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:16px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;color:#64748b}.audit-toolbar select{min-height:38px;padding:0 10px;border:1px solid #cbd5e1;border-radius:7px}.audit-list{display:grid;gap:10px}.audit-row{display:grid;gap:8px;padding:16px;border:1px solid #e2e8f0;border-radius:12px;background:#fff}.audit-row-main,.audit-meta,.audit-summary{display:flex;flex-wrap:wrap;gap:12px;align-items:center}.audit-row-main{justify-content:space-between}.audit-row-main time,.audit-meta{color:#64748b;font-size:13px}.audit-summary span{padding:4px 8px;border-radius:6px;background:#f1f5f9;color:#475569;font-size:13px}.audit-empty{padding:50px;text-align:center;color:#64748b;border:1px dashed #cbd5e1;border-radius:12px}.audit-pagination{display:flex;justify-content:flex-end;gap:9px}.audit-pagination button{padding:7px 12px;border:1px solid #cbd5e1;border-radius:7px;background:#fff}
</style>
