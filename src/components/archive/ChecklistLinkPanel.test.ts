import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { ChecklistItem, ChecklistLink, ChecklistLinkSuggestion, ProcessDocument } from '../../types'
import ChecklistLinkPanel from './ChecklistLinkPanel.vue'

const document = { id: 'document-1', filename: '施工方案.txt', status: 'PENDING_CONFIRMATION', version: 12 } as ProcessDocument
const confirmedDocument = { ...document, status: 'CONFIRMED' as const }
const item = { id: 'item-1', name: '施工方案', document_type: 'CONSTRUCTION', project_stage: 'CONSTRUCTION', is_required: true, description: null, fulfillment_status: 'MISSING', confirmed_document_count: 0, version: 4 } as ChecklistItem
const suggestion = { checklist_item_id: item.id, name: item.name, document_type: item.document_type, project_stage: item.project_stage, is_required: true, already_linked: false } as ChecklistLinkSuggestion
const invalidatedLink = { id: 'link-1', document_id: document.id, checklist_item_id: item.id, status: 'INVALIDATED', confirmed_by: null, confirmed_at: null, invalidated_at: '2026-09-10T00:00:00Z', invalidated_reason: '清单项版本变更。', version: 2 } as ChecklistLink

describe('ChecklistLinkPanel', () => {
  it('explains that suggestions do not satisfy the checklist, marks suggestions, and allows active linking only for confirmed documents', async () => {
    const wrapper = mount(ChecklistLinkPanel, { props: { document, checklistItems: [item], suggestions: [suggestion], links: [], loading: {} } })
    expect(wrapper.text()).toContain('建议不会自动满足清单项')
    expect(wrapper.text()).toContain('系统建议')
    expect(wrapper.get('[data-testid="create-checklist-link-item-1"]').attributes('disabled')).toBeDefined()

    await wrapper.setProps({ document: confirmedDocument })
    expect(wrapper.get('[data-testid="create-checklist-link-item-1"]').attributes('disabled')).toBeUndefined()
    await wrapper.get('[data-testid="create-checklist-link-item-1"]').trigger('click')
    expect(wrapper.emitted('create')?.[0]).toEqual([{ checklist_item_id: 'item-1', expected_document_version: 12, expected_checklist_item_version: 4 }])
  })

  it('shows invalidated links with their reason and requires explicit confirmation before deletion', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const wrapper = mount(ChecklistLinkPanel, { props: { document: confirmedDocument, checklistItems: [item], suggestions: [], links: [invalidatedLink], loading: {} } })
    expect(wrapper.text()).toContain('已失效')
    expect(wrapper.text()).toContain('清单项版本变更。')
    await wrapper.get('[data-testid="delete-checklist-link-link-1"]').trigger('click')
    expect(confirm).toHaveBeenCalled()
    expect(wrapper.emitted('delete')).toBeUndefined()
    confirm.mockReturnValue(true)
    await wrapper.get('[data-testid="delete-checklist-link-link-1"]').trigger('click')
    expect(wrapper.emitted('delete')?.[0]).toEqual(['link-1'])
    confirm.mockRestore()
  })

  it('disables refresh while the current document link requests are pending', () => {
    const wrapper = mount(ChecklistLinkPanel, { props: {
      document: confirmedDocument, checklistItems: [item], suggestions: [], links: [],
      loading: { 'checklist-link-suggestions:document-1': true },
    } })
    expect(wrapper.get('button.secondary-button').attributes('disabled')).toBeDefined()
  })
})
