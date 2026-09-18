# FR-042 Vue 项目档案助手接入说明

## 1. 目标与边界

Vue 工作台为当前项目提供独立的“档案助手”入口，支持创建或自动恢复最近一个项目绑定会话、
连续发送消息、查看完整用户/助手历史，以及读取脱敏工具日志。它不替换 FR-039 单轮档案问答。

前端不提交或展示 `user_id`、`kb_id`、`thread_id`、`agent_type`、持久化文档标识、Chunk 标识
或检索分数。服务端仍是身份、项目范围、正式档案范围和最终引用的唯一裁决者。

## 2. 接入的后端端点

- `POST /projects/{project_id}/agent-sessions`
- `GET /projects/{project_id}/agent-sessions/latest`
- `POST /projects/{project_id}/agent-sessions/{session_id}/messages`
- `GET /projects/{project_id}/agent-sessions/{session_id}/messages`
- `GET /projects/{project_id}/agent-sessions/{session_id}/tool-calls`

创建请求只发送空对象 `{}`；消息请求只发送 `{ message }`。字段、错误码与响应结构以
[后端接口设计](https://github.com/yabuki-jou/mini-rag-milvus/blob/main/docs/design/接口设计.md)
为准。

## 3. 前端职责

- 在项目路由下提供 `/projects/{project_id}/archive-agent` 页面。
- 进入页面时恢复当前项目最近一个档案助手会话；无会话时保留新建入口。
- 恢复成功后自动读取完整可见历史和脱敏工具记录。
- 顺序展示当前回答、完整历史和脱敏引用。
- 项目切换时清除当前档案助手会话状态。
- 项目切换、新建会话和恢复请求通过项目、会话和请求序号隔离，延迟响应不得覆盖新项目。
- 只根据结构化 `citations` 展示可信引用，不解析回答正文中的引用标记。
- 工具日志只展示服务端返回的安全摘要。

## 4. 已验证结果

- 前端完整回归：11 个测试文件、136 个测试通过。
- `npm run typecheck` 与 `npm run build` 通过。
- 真实 Vite `5173/api` 代理完成目录题、有据题、无据题、三轮历史与脱敏工具日志闭环。
- 验收后临时 PostgreSQL Schema、Chroma Collection、文件和 Checkpoint 已清理。

详细证据与限制见 [FR-042 Vue 真实代理闭环验收](../review/FR-042-Vue真实代理闭环验收/验收复盘.md)。

## 5. 当前限制

- 页面刷新后只自动恢复当前项目最近一个会话；本期仍无通用会话列表、任意旧会话选择、
  重命名和删除，也不把 `session_id` 写入 localStorage。
- 历史接口仍只恢复完整用户/助手正文，历史引用固定为空，不显示不完整轮次。
- 验收证明真实 HTTP 代理闭环，不包含新增浏览器 DOM 点击证据，也不代表长期稳定性。
- P08 已独立验证刷新后经 PostgreSQL 会话发现、SQLite Checkpoint 历史恢复和 Vite 页面重载的
  完整链路。验收使用固定本地模型写入受控历史，没有调用 DeepSeek，不能替代既有语义质量评测。
- 本文只记录 Vue 接入，不复制后端 Graph、数据库、Checkpoint 或判定层设计。

## 6. P08 TDD 实施记录

1. API 测试先固定 `GET /projects/{project_id}/agent-sessions/latest` 与可空响应。
2. Store 测试先固定自动恢复、历史/工具记录加载、无会话空状态和延迟响应隔离。
3. View/Panel 测试先固定进入档案助手路由自动触发恢复，并在恢复期间禁用新建。
4. 只实现使上述 RED 转绿的最小代码，再运行前端全量测试、类型检查、构建和差异检查。

P08 初始 RED 为 4 个文件中 `6 failed, 91 passed`，GREEN 为 `97 passed`。主审随后发现登录后
认证状态变化而项目 ID 不变时不会触发恢复，补充测试得到 `1 failed, 16 passed`，最小修正后
该文件 `17 passed`。最终前端全量为 11 个文件、`136 passed`，类型检查、生产构建和差异检查通过。

真实刷新验收经 `5173/api → 8000` 在隔离 PostgreSQL Schema 中创建临时账号、项目和会话，向独立
SQLite Checkpoint 写入一轮完整用户/助手历史，并保存 1 条脱敏工具记录。浏览器进入页面和整页刷新后
均自动恢复同一历史与工具记录。正式项目删除后，会话、工具记录和 Checkpoint 由 1 归零；隔离 Schema、
临时 SQLite 文件和本地服务均已清理。
