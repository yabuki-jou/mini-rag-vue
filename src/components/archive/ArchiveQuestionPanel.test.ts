import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ArchiveQuestionPanel from './ArchiveQuestionPanel.vue'

const evidence = {
  chunk_id: 'chunk-1', document_id: 'document-1', filename: '滨江施工合同.pdf',
  location_type: 'PDF_PAGE' as const, location_start: 3, location_end: 3,
  excerpt: '合同签订日期为 2026 年 1 月 1 日。', score: 0.91, reranker_score: 0.88,
}

describe('ArchiveQuestionPanel', () => {
  it('validates blank question and emits a trimmed question', async () => {
    const wrapper = mount(ArchiveQuestionPanel, { props: { answer: null, retrieval: null, loading: {} } })
    const question = wrapper.get('[data-testid="archive-question-input"]')
    await wrapper.get('[data-testid="archive-question-submit"]').trigger('click')
    expect(wrapper.text()).toContain('请输入问题')
    await question.setValue('  合同签订日期是什么？  ')
    await wrapper.get('[data-testid="archive-question-submit"]').trigger('click')
    expect(wrapper.emitted('ask')).toEqual([['合同签订日期是什么？']])
  })

  it('renders answered citations with server locations and diagnostic scores', () => {
    const wrapper = mount(ArchiveQuestionPanel, {
      props: {
        answer: { answer_status: 'ANSWERED', answer: '合同签订日期为 2026 年 1 月 1 日。', citations: [evidence] },
        retrieval: { items: [evidence], requested_top_k: 5, returned_count: 1 }, loading: {},
      },
    })
    expect(wrapper.text()).toContain('合同签订日期为 2026 年 1 月 1 日。')
    const citation = wrapper.get('[data-testid="answer-citation"]')
    expect(citation.text()).toContain('滨江施工合同.pdf')
    expect(citation.text()).toContain('PDF 第 3 页')
    expect(citation.text()).toContain('向量分数 0.910')
    expect(citation.text()).toContain('重排分数 0.880')
    expect(wrapper.text()).toContain('仅供检索诊断')
  })

  it('renders refusal without citations and emits retrieval query with bounded top-k', async () => {
    const wrapper = mount(ArchiveQuestionPanel, {
      props: {
        answer: { answer_status: 'REFUSED_NO_EVIDENCE', answer: '当前正式档案没有足够证据。', citations: [] },
        retrieval: { items: [], requested_top_k: 3, returned_count: 0 }, loading: {},
      },
    })
    expect(wrapper.text()).toContain('当前正式档案没有足够证据。')
    expect(wrapper.find('[data-testid="answer-citation"]').exists()).toBe(false)
    await wrapper.get('[data-testid="archive-retrieval-input"]').setValue('合同')
    await wrapper.get('[data-testid="archive-retrieval-top-k"]').setValue('8')
    await wrapper.get('[data-testid="archive-retrieval-submit"]').trigger('click')
    expect(wrapper.emitted('retrieve')).toEqual([['合同', 8]])
  })
})
