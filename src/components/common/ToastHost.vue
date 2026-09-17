<script setup lang="ts">
import { useArchiveWorkspaceStore } from '../../stores/archive-workspace'

const store = useArchiveWorkspaceStore()
</script>

<template>
  <Transition name="toast">
    <div
      v-if="store.success"
      class="toast-host"
      :class="store.successKind === 'info' ? 'info' : 'ok'"
      role="status"
      aria-live="polite"
      data-testid="toast-success"
      @click="store.clearSuccess()"
    >
      <span class="toast-icon" aria-hidden="true">{{ store.successKind === 'info' ? 'i' : '✓' }}</span>
      <span class="toast-message">{{ store.success }}</span>
    </div>
  </Transition>
</template>

<style scoped>
.toast-host {
  position: fixed;
  z-index: 50;
  top: 64px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 9px;
  max-width: 360px;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 9px 14px 9px 11px;
  color: var(--ink);
  background: var(--surface);
  box-shadow: var(--shadow-md);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

.toast-icon {
  display: grid;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  place-items: center;
  color: #fff;
  background: var(--success);
  font-size: 10px;
  font-weight: 700;
}

.toast-host.info .toast-icon {
  background: var(--ink-3);
}

.toast-message {
  flex: 1;
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
    top: 64px;
    right: 14px;
    left: 14px;
    max-width: none;
  }
}
</style>
