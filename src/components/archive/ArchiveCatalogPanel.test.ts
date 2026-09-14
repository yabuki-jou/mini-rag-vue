import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ArchiveCatalogPanel from './ArchiveCatalogPanel.vue'

const archive = {
  id: 'archive-1', filename: '施工合同.pdf', status: 'CONFIRMED' as const, title: '施工总承包合同',
  document_type: 'CONTRACT' as const, document_date: '2026-01-01', authoring_organization: '甲方建设单位',
  project_stage: 'CONSTRUCTION' as const, confirmed_at: '2026-01-02T00:00:00Z', version: 3,
}

const detail = {
  ...archive,
  fields: [{
    id: 'field-1', field_name: 'TITLE' as const, text_value: '施工总承包合同', date_value: null, json_value: null,
    review_status: 'VALUE_CONFIRMED' as const, source: 'MANUAL' as const, no_source_evidence: false,
    updated_by: 'user-1', updated_at: '2026-01-02T00:00:00Z', evidences: [{
      id: 'evidence-1', snapshot_id: 'snapshot-1', excerpt: '第一条 工程名称：滨江研发中心', location_type: 'PDF_PAGE' as const,
      location_start: 2, location_end: 2, normalized_anchor: null, created_at: '2026-01-02T00:00:00Z',
    }],
  }],
}

describe('ArchiveCatalogPanel', () => {
  it('emits selected filters and pagination without inventing archive rows', async () => {
    const wrapper = mount(ArchiveCatalogPanel, {
      props: { archives: [archive], page: 1, pageSize: 20, total: 21, filters: {}, loading: {}, currentArchive: null },
    })
    await wrapper.get('[data-testid="archive-document-type-filter"]').setValue('CONTRACT')
    await wrapper.get('form').trigger('submit')
    await wrapper.get('[data-testid="archive-next-page"]').trigger('click')
    expect(wrapper.emitted('filter-change')?.[0]).toEqual([{ document_type: 'CONTRACT' }])
    expect(wrapper.emitted('page-change')?.[0]).toEqual([2])
    expect(wrapper.text()).toContain('施工总承包合同')
  })

  it('shows detail evidence and explains contract date as signing date', () => {
    const detailWithDate = {
      ...detail,
      fields: [
        ...detail.fields,
        { ...detail.fields[0], id: 'field-2', field_name: 'DOCUMENT_DATE' as const, text_value: null, date_value: '2026-01-01' },
      ],
    }
    const wrapper = mount(ArchiveCatalogPanel, {
      props: { archives: [archive], page: 1, pageSize: 20, total: 1, filters: {}, loading: {}, currentArchive: detailWithDate },
    })
    expect(wrapper.text()).toContain('合同签订日期')
    expect(wrapper.text()).toContain('第一条 工程名称：滨江研发中心')
    expect(wrapper.text()).toContain('PDF 第 2 页')
  })

  it('clears and disables date range when date-empty filtering is selected', async () => {
    const wrapper = mount(ArchiveCatalogPanel, {
      props: { archives: [], page: 1, pageSize: 20, total: 0, filters: {}, loading: {}, currentArchive: null },
    })
    const from = wrapper.get('[data-testid="archive-date-from"]')
    const to = wrapper.get('[data-testid="archive-date-to"]')
    await from.setValue('2026-01-01')
    await to.setValue('2026-12-31')
    await wrapper.get('[data-testid="archive-date-null-filter"]').setValue(true)
    expect((from.element as HTMLInputElement).value).toBe('')
    expect((to.element as HTMLInputElement).value).toBe('')
    expect((from.element as HTMLInputElement).disabled).toBe(true)
    expect((to.element as HTMLInputElement).disabled).toBe(true)
  })
})
