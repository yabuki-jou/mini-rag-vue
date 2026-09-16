<script setup lang="ts">
import { useArchiveWorkspaceStore } from '../../stores/archive-workspace'

const store = useArchiveWorkspaceStore()
</script>

<template>
  <Transition name="toast">
    <div
      v-if="store.success"
      class="toast-host"
      role="status"
      aria-live="polite"
      data-testid="toast-success"
      @click="store.clearSuccess()"
    >
      <span class="toast-icon" aria-hidden="true">✓</span>
      <span class="toast-message">{{ store.success }}</span>
    </div>
  </Transition>
</template>

<style scoped>
.toast-host {
  position: fixed;
  z-index: 50;
  top: 91px;
  right: 32px;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 360px;
  border-radius: 9px;
  padding: 12px 16px;
  color: #146c2e;
  background: #f0fff0;
  border: 1px solid #b7eb8f;
  box-shadow: 0 12px 30px #2371231a;
  cursor: pointer;
  font-size: 14px;
}

.toast-icon {
  display: grid;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  place-items: center;
  color: #fff;
  background: #52c41a;
  font-size: 13px;
  font-weight: 700;
}

.toast-message {
  flex: 1;
  font-weight: 600;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity .25s ease, transform .25s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (max-width: 760px) {
  .toast-host {
    top: 74px;
    right: 14px;
    left: 14px;
    max-width: none;
  }
}
</style>
