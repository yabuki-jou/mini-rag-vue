<script setup lang="ts">
defineProps<{
  label: string
  value: string
  detail: string
  tone: 'primary' | 'warning' | 'success' | 'danger'
}>()
</script>

<template>
  <article class="archive-metric" :class="`tone-${tone}`">
    <span class="metric-label">{{ label }}</span>
    <strong>{{ value }}</strong>
    <small>{{ detail }}</small>
  </article>
</template>
