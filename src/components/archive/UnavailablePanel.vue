<script setup lang="ts">
defineProps<{
  title: string
  feature: string
  description: string
}>()
</script>

<template>
  <section class="unavailable-panel">
    <span class="unavailable-icon">◇</span>
    <p class="eyebrow">{{ feature }}</p>
    <h2>{{ title }}</h2>
    <p>{{ description }}</p>
    <small>当前前端不会伪造接口响应；后端实现并通过验证后，此处再接入真实数据。</small>
  </section>
</template>
