import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { ArchiveDraft, ArchiveFieldName } from '../../types'
import ArchiveDraftPanel from './ArchiveDraftPanel.vue'

const field = (fieldName: ArchiveFieldName, values: Partial<ArchiveDraft['fields'][number]> = {}) => ({
  id: `field-${fieldName}`,
  field_name: fieldName,
  text_value: null,
  date_value: null,
  json_value: null,
  review_status: 'PENDING_CHECK' as const,
  source: 'AI' as const,
  no_source_evidence: false,
  updated_by: null,
  updated_at: '2026-08-27T00:00:00Z',
  evidences: [],
  ...values,
})

const draft: ArchiveDraft = {
  document: {
    id: 'document-1', filename: '施工方案.txt', file_hash: 'a'.repeat(64), status: 'PENDING_CONFIRMATION',
    last_error: { code: null, message: null }, field_summary: { checked_count: 2, total_count: 7 },
    confirmed_at: null, version: 4, uploaded_at: '2026-08-27T00:00:00Z', updated_at: '2026-08-27T00:00:00Z',
  },
  fields: [
    field('TITLE', { text_value: '施工方案', evidences: [{ id: 'e1', snapshot_id: 's1', excerpt: '施工方案', location_type: 'TEXT_LINE_RANGE', location_start: 2, location_end: 2, created_at: '2026-08-27T00:00:00Z' }] }),
    field('DOCUMENT_TYPE', { text_value: 'CONSTRUCTION' }),
    field('DOCUMENT_DATE', { date_value: '2026-08-27' }),
    field('AUTHORING_ORGANIZATION', { text_value: '北辰设计院', source: 'MANUAL', no_source_evidence: true }),
    field('VERSION_NUMBER', { text_value: 'V1.0' }),
    field('PROJECT_STAGE', { text_value: 'CONSTRUCTION' }),
    field('KEYWORDS', { json_value: ['施工', '安全'] }),
  ],
  snapshot: null,
  next_actions: ['CHECK_FIELDS'],
}

const mountPanel = (value = draft) => mount(ArchiveDraftPanel, { props: { draft: value, loading: {} } })

describe('ArchiveDraftPanel', () => {
  it('identifies the panel as including FR-036 confirmation workflow', () => {
    const wrapper = mountPanel()
    expect(wrapper.find('.eyebrow').text()).toContain('FR-034 / FR-035 / FR-036')
  })

  it('shows legal actions for parsed and suggestion-failed states', async () => {
    const parsed = mountPanel({ ...draft, document: { ...draft.document, status: 'PARSED' } })
    expect(parsed.find('[data-testid="create-suggestions"]').exists()).toBe(true)
    expect(parsed.find('[data-testid="create-manual-draft"]').exists()).toBe(true)
    await parsed.get('[data-testid="create-suggestions"]').trigger('click')
    expect(parsed.emitted('suggest')?.[0]).toEqual([])

    const failed = mountPanel({ ...draft, document: { ...draft.document, status: 'SUGGESTION_FAILED' } })
    expect(failed.find('[data-testid="retry-suggestions"]').exists()).toBe(true)
    expect(failed.find('[data-testid="create-manual-draft"]').exists()).toBe(true)
  })

  it('maps date and keyword values to their dedicated controls and submits the document version', async () => {
    const wrapper = mountPanel()
    expect(wrapper.get('[data-testid="field-DOCUMENT_DATE"]').element).toHaveProperty('value', '2026-08-27')
    expect(wrapper.get('[data-testid="field-KEYWORDS"]').element).toHaveProperty('value', '施工, 安全')
    expect(wrapper.text()).toContain('当前文档版本 v4')

    await wrapper.get('[data-testid="field-DOCUMENT_DATE"]').setValue('2026-08-28')
    await wrapper.get('[data-testid="field-KEYWORDS"]').setValue('施工, 质量')
    await wrapper.get('[data-testid="save-field-DOCUMENT_DATE"]').trigger('click')

    expect(wrapper.emitted('save-field')?.[0]).toEqual([
      'DOCUMENT_DATE',
      expect.objectContaining({ date_value: '2026-08-28', expected_version: 4 }),
    ])
  })

  it('shows source, evidence locations, and the explicit no-evidence explanation', () => {
    const wrapper = mountPanel()
    expect(wrapper.text()).toContain('AI 建议')
    expect(wrapper.text()).toContain('文本行区间 2')
    expect(wrapper.text()).toContain('人工填写、无原文证据')
    expect(wrapper.text()).toContain('完成七字段检查后可执行 FR-036 确认')
  })

  it('lets each field choose a review status while required fields cannot accept empty values', async () => {
    const wrapper = mountPanel()
    const titleStatuses = wrapper.get('[data-testid="review-status-TITLE"]').findAll('option').map((option) => option.element.value)
    const dateStatuses = wrapper.get('[data-testid="review-status-DOCUMENT_DATE"]').findAll('option').map((option) => option.element.value)

    expect(titleStatuses).toEqual(['PENDING_CHECK', 'VALUE_CONFIRMED'])
    expect(dateStatuses).toEqual(['PENDING_CHECK', 'VALUE_CONFIRMED', 'EMPTY_ACCEPTED'])

    await wrapper.get('[data-testid="review-status-DOCUMENT_DATE"]').setValue('EMPTY_ACCEPTED')
    await wrapper.get('[data-testid="save-field-DOCUMENT_DATE"]').trigger('click')
    expect(wrapper.emitted('save-field')?.at(-1)).toEqual([
      'DOCUMENT_DATE', expect.objectContaining({ review_status: 'EMPTY_ACCEPTED', text_value: null, date_value: null, json_value: null }),
    ])

    await wrapper.get('[data-testid="review-status-KEYWORDS"]').setValue('EMPTY_ACCEPTED')
    await wrapper.get('[data-testid="save-field-KEYWORDS"]').trigger('click')
    expect(wrapper.emitted('save-field')?.at(-1)).toEqual([
      'KEYWORDS', expect.objectContaining({ review_status: 'EMPTY_ACCEPTED', text_value: null, date_value: null, json_value: null }),
    ])
  })

  it('requires an explicit no-source-evidence choice for manual values and keeps it exclusive with evidence', async () => {
    const wrapper = mountPanel()
    const noEvidence = wrapper.get('[data-testid="no-evidence-AUTHORING_ORGANIZATION"]')
    expect(noEvidence.attributes('disabled')).toBeUndefined()

    await noEvidence.setValue(true)
    await wrapper.get('[data-testid="save-field-AUTHORING_ORGANIZATION"]').trigger('click')
    expect(wrapper.emitted('save-field')?.at(-1)).toEqual([
      'AUTHORING_ORGANIZATION', expect.objectContaining({ no_source_evidence: true, evidences: [] }),
    ])

    expect(wrapper.get('[data-testid="no-evidence-TITLE"]').attributes('disabled')).toBeDefined()
  })

  it('only offers regeneration for untouched pending confirmation fields', () => {
    const eligible = mountPanel({
      ...draft,
      document: { ...draft.document, status: 'PENDING_CONFIRMATION' },
      fields: draft.fields.map((item) => ({ ...item, review_status: 'PENDING_CHECK' as const, source: 'AI' as const, no_source_evidence: false })),
    })
    expect(eligible.find('[data-testid="regenerate-suggestions"]').exists()).toBe(true)

    const reconfirmation = mountPanel({ ...eligible.props('draft'), document: { ...draft.document, status: 'PENDING_RECONFIRMATION' } })
    expect(reconfirmation.find('[data-testid="regenerate-suggestions"]').exists()).toBe(false)
    const manuallyEdited = mountPanel({ ...eligible.props('draft'), fields: draft.fields.map((item) => ({ ...item, review_status: 'PENDING_CHECK' as const, source: 'AI' as const, no_source_evidence: item.field_name === 'TITLE' })) })
    expect(manuallyEdited.find('[data-testid="regenerate-suggestions"]').exists()).toBe(false)
  })

  it('locks every field control when the document is not editable', () => {
    const wrapper = mountPanel({ ...draft, document: { ...draft.document, status: 'CONFIRMED' } })
    for (const fieldName of ['TITLE', 'DOCUMENT_TYPE', 'DOCUMENT_DATE', 'AUTHORING_ORGANIZATION', 'VERSION_NUMBER', 'PROJECT_STAGE', 'KEYWORDS']) {
      const control = wrapper.get(`[data-testid="field-${fieldName}"]`)
      expect(control.attributes('readonly') !== undefined || control.attributes('disabled') !== undefined).toBe(true)
      expect(wrapper.find(`[data-testid="review-status-${fieldName}"]`).attributes('disabled')).toBeDefined()
    }
  })

  it('edits evidence locations and submits edited evidence, then clears it for no-source values', async () => {
    const wrapper = mountPanel()
    await wrapper.get('[data-testid="evidence-excerpt-TITLE-0"]').setValue('修订后的标题证据')
    await wrapper.get('[data-testid="evidence-location-TITLE-0"]').setValue('PDF_PAGE')
    await wrapper.get('[data-testid="evidence-start-TITLE-0"]').setValue('7')
    await wrapper.get('[data-testid="evidence-anchor-TITLE-0"]').setValue('title-anchor')
    await wrapper.get('[data-testid="save-field-TITLE"]').trigger('click')
    expect(wrapper.emitted('save-field')?.at(-1)).toEqual([
      'TITLE', expect.objectContaining({ no_source_evidence: false, evidences: [{ excerpt: '修订后的标题证据', location_type: 'PDF_PAGE', location_start: 7, location_end: 7, normalized_anchor: 'title-anchor' }] }),
    ])

    await wrapper.get('[data-testid="evidence-add-DOCUMENT_TYPE"]').trigger('click')
    expect(wrapper.get('[data-testid="no-evidence-DOCUMENT_TYPE"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-testid="evidence-remove-DOCUMENT_TYPE-0"]').trigger('click')
    await wrapper.get('[data-testid="no-evidence-DOCUMENT_TYPE"]').setValue(true)
    await wrapper.get('[data-testid="save-field-DOCUMENT_TYPE"]').trigger('click')
    expect(wrapper.emitted('save-field')?.at(-1)).toEqual([
      'DOCUMENT_TYPE', expect.objectContaining({ no_source_evidence: true, evidences: [] }),
    ])
  })

  it('shows confirmation actions with the current version and disables confirmation until all fields are checked', async () => {
    const incomplete = mountPanel({ ...draft, document: { ...draft.document, status: 'PENDING_CONFIRMATION' } })
    expect(incomplete.find('[data-testid="confirm-archive"]').exists()).toBe(true)
    expect(incomplete.get('[data-testid="confirm-archive"]').attributes('disabled')).toBeDefined()
    expect(incomplete.text()).toContain('还剩 7 个字段待检查')

    const complete = mountPanel({
      ...draft,
      document: { ...draft.document, status: 'PENDING_CONFIRMATION' },
      fields: draft.fields.map((item) => ({ ...item, review_status: 'VALUE_CONFIRMED' as const })),
    })
    expect(complete.get('[data-testid="confirm-archive"]').attributes('disabled')).toBeUndefined()
    await complete.get('[data-testid="confirm-archive"]').trigger('click')
    expect(complete.emitted('confirm')?.[0]).toEqual([4])

    const reconfirm = mountPanel({ ...complete.props('draft'), document: { ...draft.document, status: 'PENDING_RECONFIRMATION', version: 9 } })
    await reconfirm.get('[data-testid="reconfirm-archive"]').trigger('click')
    expect(reconfirm.emitted('confirm')?.[0]).toEqual([9])
  })

  it('keeps confirmation disabled when local review selections are not saved to the server draft', async () => {
    const wrapper = mountPanel({ ...draft, document: { ...draft.document, status: 'PENDING_CONFIRMATION' } })
    for (const fieldName of ['TITLE', 'DOCUMENT_TYPE', 'DOCUMENT_DATE', 'AUTHORING_ORGANIZATION', 'VERSION_NUMBER', 'PROJECT_STAGE', 'KEYWORDS']) {
      await wrapper.get(`[data-testid="review-status-${fieldName}"]`).setValue('VALUE_CONFIRMED')
    }

    expect(wrapper.get('[data-testid="confirm-archive"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('还剩 7 个字段待检查')
  })

  it('shows confirmed metadata and emits cancellation with the server version', async () => {
    const wrapper = mountPanel({
      ...draft,
      document: { ...draft.document, status: 'CONFIRMED', confirmed_at: '2026-08-27T00:10:00Z', version: 11, index_context_chunk_count: 12 },
    })
    expect(wrapper.text()).toContain('已确认')
    expect(wrapper.text()).toContain('索引上下文 Chunk：12')
    expect(wrapper.find('[data-testid="cancel-confirmation"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="confirm-archive"]').exists()).toBe(false)
    await wrapper.get('[data-testid="cancel-confirmation"]').trigger('click')
    expect(wrapper.emitted('cancel-confirmation')?.[0]).toEqual([11])
  })
})
