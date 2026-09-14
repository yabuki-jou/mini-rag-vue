<script setup lang="ts">
import { computed } from 'vue'
import type { ChecklistItem, ChecklistLink, ChecklistLinkCreate, ChecklistLinkSuggestion, ProcessDocument } from '../../types'

const props = defineProps<{
  document: ProcessDocument
  checklistItems: ChecklistItem[]
  suggestions: ChecklistLinkSuggestion[]
  links: ChecklistLink[]
  loading: Record<string, boolean>
}>()

const emit = defineEmits<{
  refresh: []
  create: [payload: ChecklistLinkCreate]
  delete: [linkId: string]
}>()

const suggestionIds = computed(() => new Set(props.suggestions.map((item) => item.checklist_item_id)))
const linksByItem = computed(() => new Map(props.links.map((link) => [link.checklist_item_id, link])))
const confirmed = computed(() => props.document.status === 'CONFIRMED')

function linkFor(itemId: string) {
  return linksByItem.value.get(itemId)
}

function requestCreate(item: ChecklistItem) {
  if (!confirmed.value || linkFor(item.id)?.status === 'CONFIRMED') return
  emit('create', {
    checklist_item_id: item.id,
    expected_document_version: props.document.version,
    expected_checklist_item_version: item.version,
  })
}

function requestDelete(link: ChecklistLink) {
  if (window.confirm(`确定删除“${link.status === 'CONFIRMED' ? '已确认' : '已失效'}”关联吗？`)) emit('delete', link.id)
}
</script>

<template>
  <section class="dashboard-card checklist-link-panel" data-testid="checklist-link-panel">
    <header class="card-heading">
      <div>
        <span class="eyebrow">FR-037 · CHECKLIST LINKS</span>
        <h2>档案—清单关联</h2>
        <p>系统建议仅用于辅助选择；建议不会自动满足清单项，满足状态仍以项目清单为准。</p>
      </div>
      <button class="secondary-button" :disabled="loading[`checklist-link-suggestions:${document.id}`] || loading[`checklist-links:${document.id}`]" @click="emit('refresh')">
        {{ loading[`checklist-link-suggestions:${document.id}`] || loading[`checklist-links:${document.id}`] ? '刷新中…' : '刷新关联' }}
      </button>
    </header>

    <p v-if="!confirmed" class="version-note">当前文档状态为 {{ document.status }}，只有 CONFIRMED 文档可以确认关联。</p>

    <div v-if="!checklistItems.length" class="checklist-empty">当前项目没有清单项。</div>
    <div v-else class="checklist-link-list">
      <article v-for="item in checklistItems" :key="item.id" class="checklist-link-row">
        <div>
          <strong>{{ item.name }}</strong>
          <small>{{ item.document_type }} · {{ item.project_stage }} · v{{ item.version }}</small>
        </div>
        <div class="link-state">
          <span v-if="suggestionIds.has(item.id)" class="status-pill suggested">系统建议</span>
          <span v-else class="status-pill manual">可主动关联</span>
          <span v-if="linkFor(item.id)?.status === 'CONFIRMED'" class="status-pill confirmed">已确认关联</span>
          <span v-else-if="linkFor(item.id)?.status === 'INVALIDATED'" class="status-pill invalidated">已失效</span>
        </div>
        <div v-if="linkFor(item.id)?.status === 'INVALIDATED'" class="invalidated-detail">
          失效原因：{{ linkFor(item.id)?.invalidated_reason || '服务端未提供原因。' }}
        </div>
        <div class="row-actions">
          <button
            v-if="linkFor(item.id)?.status !== 'CONFIRMED'"
            class="primary-button"
            :data-testid="`create-checklist-link-${item.id}`"
            :disabled="!confirmed || loading[`create-checklist-link:${document.id}:${item.id}`]"
            @click="requestCreate(item)"
          >{{ linkFor(item.id)?.status === 'INVALIDATED' ? '重新确认关联' : '确认关联' }}</button>
          <button
            v-if="linkFor(item.id)"
            class="link-button danger-link"
            :data-testid="`delete-checklist-link-${linkFor(item.id)!.id}`"
            :disabled="loading[`delete-checklist-link:${linkFor(item.id)!.id}`]"
            @click="requestDelete(linkFor(item.id)!)"
          >删除关联</button>
        </div>
      </article>
    </div>

    <div v-if="links.length && links.some((link) => !checklistItems.some((item) => item.id === link.checklist_item_id))" class="invalidated-links">
      <h3>当前清单外的历史关联</h3>
      <p v-for="link in links.filter((entry) => !checklistItems.some((item) => item.id === entry.checklist_item_id))" :key="link.id">
        {{ link.status === 'INVALIDATED' ? '已失效' : '已确认' }}：{{ link.invalidated_reason || '关联记录仍保留。' }}
        <button class="link-button danger-link" :data-testid="`delete-checklist-link-${link.id}`" @click="requestDelete(link)">删除关联</button>
      </p>
    </div>
  </section>
</template>

<style scoped>
.checklist-link-panel{margin-top:20px;padding:22px}.checklist-link-list{display:grid;gap:0}.checklist-link-row{display:grid;grid-template-columns:1.2fr 1fr 1.3fr auto;gap:16px;align-items:center;padding:15px 0;border-top:1px solid #e2e8f0}.checklist-link-row small{display:block;color:#64748b;margin-top:5px}.link-state{display:flex;flex-wrap:wrap;gap:6px}.status-pill{width:max-content;border-radius:999px;padding:4px 9px;font-size:12px;font-weight:700}.suggested{background:#fff7e6;color:#ad6800}.manual{background:#f8fafc;color:#64748b}.confirmed{background:#f0fff0;color:#2d8b2d}.invalidated{background:#fff1f0;color:#cf1322}.invalidated-detail{color:#a61d24;font-size:13px}.row-actions{display:flex;align-items:center;gap:10px;white-space:nowrap}.danger-link{color:#d32f2f}.invalidated-links{border-top:1px solid #e2e8f0;margin-top:10px;padding-top:15px}.invalidated-links h3{font-size:15px}.invalidated-links p{color:#64748b}@media(max-width:900px){.checklist-link-row{grid-template-columns:1fr}.row-actions{justify-content:flex-start}}
</style>
