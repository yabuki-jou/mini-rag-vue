<script setup lang="ts">
import ToastHost from '../components/common/ToastHost.vue'
import ConfirmDialog from '../components/common/ConfirmDialog.vue'

defineOptions({ name: 'DefaultLayout' })
</script>

<template>
    <div class="default-layout">
        <slot />
        <ToastHost />
        <ConfirmDialog />
    </div>
</template>
