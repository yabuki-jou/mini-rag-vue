<script setup lang="ts">
defineProps<{ status: 'checking' | 'ok' | 'degraded'; compact?: boolean }>()
</script>

<template>
  <div class="service-pill"><i :class="status"></i><span>{{ compact ? 'RAG Assistant' : status === 'ok' ? '服务运行正常' : status === 'checking' ? '检查服务中' : '服务连接异常' }}</span></div>
</template>
