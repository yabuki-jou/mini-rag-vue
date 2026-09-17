# 风险与联调待办

## 1. 优先级风险

| 严重性 | 问题 | 证据 | 影响 | P14 处理方式 |
|---|---|---|---|---|
| 高 | 后端已提供 FR-031～FR-041；前端只完成至 FR-032/033 | 相邻后端 `docs/api-design.md`、`DocumentProcessingPanel.vue`、`ArchiveWorkspaceView.vue` | 用户仍不能在工作台完成人工草稿、确认、目录、检索问答和审计闭环 | 按 FR-034/035 → FR-036/037/038 → FR-039～041 接入；不使用模拟数据 |
| 中 | Refresh Token 位于 `localStorage` | `src/services/api.ts` | 同源 XSS 可读取 Token | 当前不保存密码；若改为 Cookie/BFF，先单独确认安全方案 |
| 低 | `WorkspaceView.vue` 与 `workspace.ts` 未注册但仍存在 | router、`WorkspaceView.vue` | 维护者可能误判为当前入口 | 不将其用于智慧档案；后续决定保留、删除或迁移 |

## 2. 验收边界

- 本项目已被确认为 P14 的本地 Vue 联调界面。当前实际页面接入覆盖认证、FR-030 项目 CRUD、FR-031 清单 CRUD 和 FR-032/033 文档上传、处理状态、解析与重试，并已完成真实代理 canary。
- Vue 单元测试、类型检查和构建只能证明客户端行为；不能替代后端固定问题集检索质量、真实 DeepSeek 回答质量或 P13 的真实跨存储故障恢复。
- Swagger/OpenAPI 保留为接口契约诊断工具。Vue 工作台完成验收必须经过 Vite `/api` 调用真实 FastAPI，不得以 `UnavailablePanel` 或 mock 状态作为闭环证据。

## 3. 技术债务

| 债务 | 原因 | 位置 | 风险 | 建议 |
|---|---|---|---|---|
| 档案 API 接入缺失 | 前端已完成 FR-030/031，后续后端能力尚未映射到页面 | `ArchiveWorkspaceView.vue`、`api.ts` | 前后端仍未形成完整闭环 | 按 032/033 → 034～038 → 039～041 接入 |
| 无 lint/format/coverage/CI | 扫描未发现配置 | `package.json` | 回归与风格难约束 | P14 不自动扩大工具范围；若要引入，先确认最小工具组合 |

## 4. 安全与一致性关注点

- 所有受保护请求继续使用 Bearer Access Token，绝不发送已废弃的 `X-User-ID`。
- 前端不保存密码，也不读取或提交 `user_id`、`owner_id`、`kb_id`；后端仍是唯一授权裁决者。
- 路由中的项目 ID 只能选择界面已加载的项目；这只是避免误导，不能替代后端项目所有权校验。

## 5. 易受影响区域

| 区域 | 原因 | 安全改法 |
|---|---|---|
| `src/services/api.ts` | 集中 Token、身份头、刷新重试和 DTO | 先更新 `api.test.ts`，再改实现；不输出 Token |
| `ArchiveWorkspaceView.vue` | 认证、项目 CRUD、路由和大模板集中 | 新能力优先拆组件或视图，逐接口联调 |
| `src/router/index.ts` | 所有当前路由复用同一视图 | 接入真实功能时同步检查深链接、项目范围和未授权回退 |

## 6. 证据

- `src/services/api.ts`
- `src/services/api.test.ts`
- `src/views/ArchiveWorkspaceView.vue`
- `src/views/WorkspaceView.vue`
- `docs/design/archive-v1-ui-guidelines.md`
- 相邻后端 `docs/api-design.md`
