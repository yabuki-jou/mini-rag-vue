<script setup lang="ts">
type ArchiveView = 'overview' | 'checklist' | 'documents' | 'archives' | 'questions' | 'audit' | 'settings'

defineProps<{
  activeView: ArchiveView
  projectAvailable: boolean
}>()

const emit = defineEmits<{ navigate: [view: ArchiveView] }>()

const items: Array<{ view: ArchiveView; label: string; icon: string }> = [
  { view: 'overview', label: '总览', icon: '⌂' },
  { view: 'checklist', label: '项目与清单', icon: '▤' },
  { view: 'documents', label: '文档处理', icon: '▧' },
  { view: 'archives', label: '正式档案', icon: '▱' },
  { view: 'questions', label: '智能检索', icon: '⌕' },
  { view: 'audit', label: '审计日志', icon: '▦' },
]
</script>

<template>
  <aside class="archive-sidebar">
    <div class="archive-brand"><span class="archive-brand-mark">▱</span><span>智慧档案</span></div>
    <nav aria-label="智慧档案导航">
      <button
        v-for="item in items"
        :key="item.view"
        class="archive-nav-item"
        :class="{ active: activeView === item.view }"
        :disabled="item.view !== 'overview' && !projectAvailable"
        @click="emit('navigate', item.view)"
      ><span aria-hidden="true">{{ item.icon }}</span>{{ item.label }}</button>
    </nav>
    <div class="archive-sidebar-bottom">
      <button class="archive-nav-item" :class="{ active: activeView === 'settings' }" :disabled="!projectAvailable" @click="emit('navigate', 'settings')"><span>⚙</span>项目设置</button>
      <a href="#implementation-boundary"><span>?</span>实现边界</a>
    </div>
  </aside>
</template>
