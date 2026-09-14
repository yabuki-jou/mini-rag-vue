import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { ProcessDocument } from '../../types'
import DocumentProcessingPanel from './DocumentProcessingPanel.vue'

const uploadedDocument: ProcessDocument = {
  id: 'document-1', filename: '施工方案.txt', file_hash: 'a'.repeat(64), status: 'UPLOADED',
  last_error: { code: null, message: null }, field_summary: { checked_count: 0, total_count: 0 },
  confirmed_at: null, version: 1, uploaded_at: '2026-08-27T00:00:00Z', updated_at: '2026-08-27T00:00:00Z',
}

const mountPanel = (documents = [uploadedDocument]) => mount(DocumentProcessingPanel, {
  props: { documents, loading: {}, page: 1, pageSize: 20, total: documents.length, status: '' },
})

describe('DocumentProcessingPanel', () => {
  it('emits the selected File for project-scoped upload', async () => {
    const wrapper = mount(DocumentProcessingPanel, { props: { documents: [], loading: {}, page: 1, pageSize: 20, total: 21, status: '' } })
    const file = new File(['虚构施工方案'], '施工方案.txt', { type: 'text/plain' })

    const input = wrapper.get('[data-testid="project-document-file"]')
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    await wrapper.get('[data-testid="upload-project-document"]').trigger('click')

    expect(wrapper.emitted('upload')?.[0]).toEqual([file])
  })

  it('shows only the first-parse action for an uploaded document', async () => {
    const wrapper = mountPanel()

    expect(wrapper.text()).toContain('待解析')
    expect(wrapper.get('[data-testid="parse-project-document"]').text()).toContain('开始解析')
    expect(wrapper.find('[data-testid="retry-project-document-parse"]').exists()).toBe(false)

    await wrapper.get('[data-testid="parse-project-document"]').trigger('click')
    expect(wrapper.emitted('parse')?.[0]).toEqual(['document-1'])
  })

  it('shows the controlled error and emits the dedicated retry action only after parse failure', async () => {
    const failedDocument = {
      ...uploadedDocument,
      status: 'PARSE_FAILED' as const,
      last_error: { code: 'PARSE_TEXT_UNAVAILABLE', message: '暂不支持扫描件，请上传文本版资料。' },
    }
    const wrapper = mountPanel([failedDocument])

    expect(wrapper.text()).toContain('解析失败')
    expect(wrapper.text()).toContain('暂不支持扫描件，请上传文本版资料。')
    expect(wrapper.find('[data-testid="parse-project-document"]').exists()).toBe(false)

    await wrapper.get('[data-testid="retry-project-document-parse"]').trigger('click')
    expect(wrapper.emitted('retry-parse')?.[0]).toEqual(['document-1'])
  })

  it('offers row-level suggestion and manual-draft actions for a parsed document without a draft', async () => {
    const wrapper = mountPanel([{ ...uploadedDocument, status: 'PARSED' as const }])

    expect(wrapper.find('[data-testid="parse-project-document"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="retry-project-document-parse"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="create-archive-suggestions"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="create-manual-draft"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="open-archive-draft"]').exists()).toBe(false)

    await wrapper.get('[data-testid="create-archive-suggestions"]').trigger('click')
    await wrapper.get('[data-testid="create-manual-draft"]').trigger('click')
    expect(wrapper.emitted('create-suggestions')?.[0]).toEqual(['document-1'])
    expect(wrapper.emitted('create-manual-draft')?.[0]).toEqual(['document-1'])
  })

  it('offers retry and manual-draft actions for a suggestion failure, without opening a missing draft', async () => {
    const wrapper = mountPanel([{ ...uploadedDocument, status: 'SUGGESTION_FAILED' as const }])

    expect(wrapper.find('[data-testid="retry-suggestions"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="create-manual-draft"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="open-archive-draft"]').exists()).toBe(false)
    await wrapper.get('[data-testid="retry-suggestions"]').trigger('click')

    expect(wrapper.emitted('retry-suggestions')?.[0]).toEqual(['document-1'])
  })

  it('opens only an existing draft for confirmation states', async () => {
    const wrapper = mountPanel([{ ...uploadedDocument, status: 'PENDING_CONFIRMATION' as const }])

    expect(wrapper.find('[data-testid="open-archive-draft"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="create-archive-suggestions"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="create-manual-draft"]').exists()).toBe(false)
    await wrapper.get('[data-testid="open-archive-draft"]').trigger('click')
    expect(wrapper.emitted('open-draft')?.[0]).toEqual(['document-1'])
  })

  it('emits a status filter and page navigation for the server-backed processing list', async () => {
    const wrapper = mount(DocumentProcessingPanel, { props: { documents: [], loading: {}, page: 1, pageSize: 20, total: 21, status: '' } })
    await wrapper.get('[data-testid="document-status-filter"]').setValue('PARSED')
    await wrapper.get('[data-testid="document-next-page"]').trigger('click')
    expect(wrapper.emitted('status-change')?.[0]).toEqual(['PARSED'])
    expect(wrapper.emitted('page-change')?.[0]).toEqual([2])
  })

  it('shows the server total rather than only the current page length', () => {
    const wrapper = mount(DocumentProcessingPanel, { props: { documents: [uploadedDocument], loading: {}, page: 2, pageSize: 20, total: 41, status: '' } })
    expect(wrapper.get('[data-testid="document-total"]').text()).toBe('41')
  })

  it('always provides a row delete action and emits the document identity and filename', async () => {
    const wrapper = mountPanel([{ ...uploadedDocument, status: 'CONFIRMED' as const }])

    await wrapper.get('[data-testid="delete-project-document"]').trigger('click')

    expect(wrapper.emitted('delete')?.[0]).toEqual(['document-1', '施工方案.txt'])
  })

  it('disables only the deleting row and shows its in-progress label', () => {
    const second = { ...uploadedDocument, id: 'document-2', filename: '竣工资料.pdf' }
    const wrapper = mount(DocumentProcessingPanel, {
      props: {
        documents: [uploadedDocument, second], loading: { 'delete-project-document:document-2': true },
        page: 1, pageSize: 20, total: 2, status: '',
      },
    })

    const buttons = wrapper.findAll('[data-testid="delete-project-document"]')
    expect(buttons[0].attributes('disabled')).toBeUndefined()
    expect(buttons[0].text()).toContain('删除文档')
    expect(buttons[1].attributes('disabled')).toBeDefined()
    expect(buttons[1].text()).toContain('删除中')
  })
})
