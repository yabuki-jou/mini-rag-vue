import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ArchiveAuditPanel from './ArchiveAuditPanel.vue'

const log = {
  id: 'audit-1', actor_id: 'user-1', operation_type: 'CHECKLIST_ITEM_UPDATED' as const,
  resource_type: 'CHECKLIST_ITEM', resource_id: 'item-1', created_at: '2026-09-11T08:00:00Z',
  redacted_summary: { is_required: true, matching_fields_changed: false, field_name: 'TITLE', review_status: 'VALUE_CONFIRMED', secret: 'must not render' },
}

describe('ArchiveAuditPanel', () => {
  it('renders redacted audit fields and hides unknown summary keys', () => {
    const wrapper = mount(ArchiveAuditPanel, { props: { logs: [log], page: 1, pageSize: 20, total: 1, operationType: '', loading: {} } })
    expect(wrapper.text()).toContain('更新清单项')
    expect(wrapper.text()).toContain('user-1')
    expect(wrapper.text()).toContain('是否必需：是')
    expect(wrapper.text()).toContain('字段：TITLE')
    expect(wrapper.text()).toContain('检查状态：VALUE_CONFIRMED')
    expect(wrapper.text()).not.toContain('must not render')
  })

  it('emits controlled filter, refresh and pagination actions', async () => {
    const wrapper = mount(ArchiveAuditPanel, { props: { logs: [log], page: 1, pageSize: 1, total: 2, operationType: '', loading: {} } })
    await wrapper.get('[data-testid="audit-operation-filter"]').setValue('DOCUMENT_DELETED')
    await wrapper.get('[data-testid="audit-next-page"]').trigger('click')
    await wrapper.get('[data-testid="audit-refresh"]').trigger('click')
    expect(wrapper.emitted('filter-change')?.[0]).toEqual(['DOCUMENT_DELETED'])
    expect(wrapper.emitted('page-change')?.[0]).toEqual([2])
    expect(wrapper.emitted('refresh')).toHaveLength(1)
  })

  it('shows a truthful empty state', () => {
    const wrapper = mount(ArchiveAuditPanel, { props: { logs: [], page: 1, pageSize: 20, total: 0, operationType: '', loading: {} } })
    expect(wrapper.text()).toContain('当前项目暂无符合条件的审计记录')
  })
})
