# FR-042 Vue 项目档案助手接入说明

## 1. 目标与边界

Vue 工作台为当前项目提供独立的“档案助手”入口，支持创建一个项目绑定会话、连续发送消息、
查看完整用户/助手历史，以及读取脱敏工具日志。它不替换 FR-039 单轮档案问答。

前端不提交或展示 `user_id`、`kb_id`、`thread_id`、`agent_type`、持久化文档标识、Chunk 标识
或检索分数。服务端仍是身份、项目范围、正式档案范围和最终引用的唯一裁决者。

## 2. 接入的后端端点

- `POST /projects/{project_id}/agent-sessions`
- `POST /projects/{project_id}/agent-sessions/{session_id}/messages`
- `GET /projects/{project_id}/agent-sessions/{session_id}/messages`
- `GET /projects/{project_id}/agent-sessions/{session_id}/tool-calls`

创建请求只发送空对象 `{}`；消息请求只发送 `{ message }`。字段、错误码与响应结构以
[后端接口设计](https://github.com/yabuki-jou/mini-rag-milvus/blob/main/docs/design/接口设计.md)
为准。

## 3. 前端职责

- 在项目路由下提供 `/projects/{project_id}/archive-agent` 页面。
- 顺序展示当前回答、完整历史和脱敏引用。
- 项目切换时清除当前档案助手会话状态。
- 只根据结构化 `citations` 展示可信引用，不解析回答正文中的引用标记。
- 工具日志只展示服务端返回的安全摘要。

## 4. 已验证结果

- 前端完整回归：11 个测试文件、130 个测试通过。
- `npm run typecheck` 与 `npm run build` 通过。
- 真实 Vite `5173/api` 代理完成目录题、有据题、无据题、三轮历史与脱敏工具日志闭环。
- 验收后临时 PostgreSQL Schema、Chroma Collection、文件和 Checkpoint 已清理。

详细证据与限制见 [FR-042 Vue 真实代理闭环验收](../review/FR-042-Vue真实代理闭环验收/验收复盘.md)。

## 5. 当前限制

- 当前会话只保存在页面 Store；刷新后需要重新创建，本期无会话列表、重命名和删除。
- 验收证明真实 HTTP 代理闭环，不包含新增浏览器 DOM 点击证据，也不代表长期稳定性。
- 本文只记录 Vue 接入，不复制后端 Graph、数据库、Checkpoint 或判定层设计。
