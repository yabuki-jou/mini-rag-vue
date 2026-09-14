import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ChecklistPanel from './ChecklistPanel.vue'

const checklistItem = {
  id: 'item-1',
  name: '施工方案',
  document_type: 'CONSTRUCTION' as const,
  is_required: true,
  project_stage: 'CONSTRUCTION' as const,
  description: '包含关键工序说明。',
  fulfillment_status: 'MISSING' as const,
  confirmed_document_count: 0,
  version: 3,
}

function mountPanel() {
  return mount(ChecklistPanel, {
    props: {
      items: [checklistItem],
      projectVersion: 5,
      loading: {},
    },
  })
}

describe('ChecklistPanel', () => {
  it('renders the server-derived checklist status without guessing project completeness', () => {
    const wrapper = mountPanel()

    expect(wrapper.get('[data-testid="checklist-item-name"]').text()).toBe('施工方案')
    expect(wrapper.get('[data-testid="checklist-item-status"]').text()).toBe('缺失')
    expect(wrapper.get('[data-testid="missing-count"]').text()).toContain('1')
  })

  it('emits a create payload with the current project version', async () => {
    const wrapper = mountPanel()
    await wrapper.get('[data-testid="new-checklist-item"]').trigger('click')
    await wrapper.get('[data-testid="checklist-name"]').setValue('验收记录')
    await wrapper.get('[data-testid="checklist-document-type"]').setValue('ACCEPTANCE')
    await wrapper.get('[data-testid="checklist-project-stage"]').setValue('ACCEPTANCE')
    await wrapper.get('[data-testid="checklist-description"]').setValue('包含签字页')
    await wrapper.get('[data-testid="checklist-form"]').trigger('submit')

    expect(wrapper.emitted('create')?.[0]).toEqual([{
      name: '验收记录',
      document_type: 'ACCEPTANCE',
      is_required: true,
      project_stage: 'ACCEPTANCE',
      description: '包含签字页',
      expected_project_version: 5,
    }])
  })

  it('emits an update payload with the current checklist item version', async () => {
    const wrapper = mountPanel()
    await wrapper.get('[data-testid="edit-checklist-item"]').trigger('click')
    await wrapper.get('[data-testid="checklist-description"]').setValue('已更新条件')
    await wrapper.get('[data-testid="checklist-form"]').trigger('submit')

    expect(wrapper.emitted('update')?.[0]).toEqual(['item-1', {
      name: '施工方案',
      document_type: 'CONSTRUCTION',
      is_required: true,
      project_stage: 'CONSTRUCTION',
      description: '已更新条件',
      expected_version: 3,
    }])
  })

  it('asks for confirmation before emitting delete', async () => {
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const wrapper = mountPanel()

    await wrapper.get('[data-testid="delete-checklist-item"]').trigger('click')

    expect(confirmMock).toHaveBeenCalledOnce()
    expect(wrapper.emitted('delete')?.[0]).toEqual(['item-1'])
  })
})
