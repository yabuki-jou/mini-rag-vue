import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ArchiveAgentPanel from './ArchiveAgentPanel.vue'

const session = {
  id: 'session-secret', project_id: 'project-secret',
  created_at: '2026-09-17T00:00:00Z', updated_at: '2026-09-17T00:00:00Z',
}

describe('ArchiveAgentPanel', () => {
  it('starts only an explicit new session and does not expose its internal scope', async () => {
    const wrapper = mount(ArchiveAgentPanel, {
      props: { session: null, messages: [], lastResponse: null, toolCalls: [], loading: {} },
    })

    await wrapper.get('[data-testid="archive-agent-create"]').trigger('click')

    expect(wrapper.emitted('create-session')).toEqual([[]])
    expect(wrapper.text()).toContain('新建会话')
    expect(wrapper.text()).not.toContain('project_id')
    expect(wrapper.text()).not.toContain('kb_id')
  })

  it('validates blank input and emits one trimmed message for the current session', async () => {
    const wrapper = mount(ArchiveAgentPanel, {
      props: { session, messages: [], lastResponse: null, toolCalls: [], loading: {} },
    })

    await wrapper.get('[data-testid="archive-agent-send"]').trigger('click')
    expect(wrapper.text()).toContain('请输入消息')
    await wrapper.get('[data-testid="archive-agent-input"]').setValue('  合同签订日期是什么？  ')
    await wrapper.get('[data-testid="archive-agent-send"]').trigger('click')

    expect(wrapper.emitted('send')).toEqual([['合同签订日期是什么？']])
  })

  it('renders answer status, five-field citations, history controls and only allowlisted tool summaries', async () => {
    const citation = { filename: '合同.txt', location_type: 'TEXT_LINE_RANGE' as const, location_start: 2, location_end: 3, excerpt: '签订日期：2026-01-02' }
    const wrapper = mount(ArchiveAgentPanel, {
      props: {
        session,
        messages: [
          { role: 'USER', content: '合同签订日期是什么？', citations: [] },
          { role: 'ASSISTANT', content: '签订日期为 2026-01-02。[S1]', citations: [citation] },
        ],
        lastResponse: { session_id: session.id, answer_status: 'ANSWERED', answer: '签订日期为 2026-01-02。[S1]', citations: [citation], request_id: 'request-secret' },
        toolCalls: [{
          id: 'log-secret', tool_call_id: 'call-secret', tool_name: 'search_confirmed_archive_evidence', status: 'COMPLETED',
          arguments_summary: { query_provided: true, query_length: 8, user_id: 'user-secret' },
          result_summary: { found: true, result_count: 1, document_id: 'document-secret' },
          duration_ms: 12, error_code: null,
          created_at: '2026-09-17T00:00:01Z', updated_at: '2026-09-17T00:00:01Z',
        }],
        loading: {},
      },
    })

    expect(wrapper.get('[data-testid="archive-agent-answer-status"]').text()).toContain('已回答')
    expect(wrapper.get('[data-testid="archive-agent-citation"]').text()).toContain('合同.txt')
    expect(wrapper.get('[data-testid="archive-agent-citation"]').text()).toContain('文本第 2-3 行')
    expect(wrapper.text()).toContain('[S1]')
    expect(wrapper.text()).toContain('查询长度：8')
    expect(wrapper.text()).toContain('结果数量：1')
    expect(wrapper.text()).toContain('检索正式档案原文')
    expect(wrapper.text()).not.toContain('user-secret')
    expect(wrapper.text()).not.toContain('document-secret')
    expect(wrapper.text()).not.toContain('session-secret')
    expect(wrapper.text()).not.toContain('request-secret')
    expect(wrapper.text()).not.toContain('call-secret')

    await wrapper.get('[data-testid="archive-agent-refresh-history"]').trigger('click')
    await wrapper.get('[data-testid="archive-agent-refresh-tools"]').trigger('click')
    expect(wrapper.emitted('refresh-history')).toEqual([[]])
    expect(wrapper.emitted('refresh-tool-calls')).toEqual([[]])
  })
})
