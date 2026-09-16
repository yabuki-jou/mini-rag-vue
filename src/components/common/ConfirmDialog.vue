<script setup lang="ts">
import { useArchiveWorkspaceStore } from '../../stores/archive-workspace'

const store = useArchiveWorkspaceStore()
</script>

<template>
  <Transition name="confirm-dialog">
    <div
      v-if="store.confirmDialog"
      class="modal-backdrop"
      role="dialog"
      aria-modal="true"
      :aria-label="store.confirmDialog.title"
      @click.self="store.resolveConfirm(false)"
    >
      <div class="project-modal confirm-dialog">
        <div>
          <span class="eyebrow" :class="{ danger: store.confirmDialog.danger }">
            {{ store.confirmDialog.danger ? '危险操作' : '请确认操作' }}
          </span>
          <h2>{{ store.confirmDialog.title }}</h2>
          <button
            type="button"
            class="modal-close"
            aria-label="关闭"
            @click="store.resolveConfirm(false)"
          >×</button>
        </div>
        <p class="confirm-message">{{ store.confirmDialog.message }}</p>
        <div class="confirm-actions">
          <button
            type="button"
            class="secondary-button"
            data-testid="confirm-cancel"
            @click="store.resolveConfirm(false)"
          >取消</button>
          <button
            type="button"
            :class="store.confirmDialog.danger ? 'danger-button' : 'primary-button'"
            data-testid="confirm-ok"
            @click="store.resolveConfirm(true)"
          >{{ store.confirmDialog.danger ? '确认删除' : '确认' }}</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.confirm-dialog .confirm-message {
  margin: 18px 0 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.7;
  white-space: pre-line;
}

.confirm-dialog .confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 22px;
}

.confirm-dialog .eyebrow.danger {
  color: var(--danger);
}

.confirm-dialog-enter-active,
.confirm-dialog-leave-active {
  transition: opacity .2s ease;
}

.confirm-dialog-enter-from,
.confirm-dialog-leave-to {
  opacity: 0;
}
</style>
