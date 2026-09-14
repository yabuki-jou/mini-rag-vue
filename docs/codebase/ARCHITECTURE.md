# 前端架构与联调数据流

## 1. 架构风格

- 主要风格：轻量分层 Vue 单页应用。
- 判断依据：页面组件通过 Pinia Store 调用 API 服务；DTO 类型独立于 views 与 stores。
- 主要约束：
  1. 开发期 API 基地址默认是 Vite 代理 /api，后端目标是 127.0.0.1:8000。
  2. 受保护请求使用 Bearer Access Token，不能再使用 X-User-ID。
  3. 未接入档案能力必须显示接口边界，不能渲染模拟结果。

## 2. 认证与项目数据流

    浏览器表单
      -> ArchiveWorkspaceView
      -> archive-workspace Pinia Store
      -> services/api.ts 的 request()
      -> /api 前缀 fetch
      -> Vite proxy 移除 /api
      -> FastAPI 127.0.0.1:8000 的 /auth 或 /projects
      -> JSON / 稳定错误 / 204
      -> ApiError 与 Store 状态
      -> Vue 响应式页面

1. 注册调用 POST /auth/register；成功后同一密码自动调用 POST /auth/login。
2. 登录响应的 Access/Refresh Token 写入 localStorage；密码不写入本地。
3. request() 为受保护调用附加 Authorization: Bearer 和 X-Request-ID。
4. 首次 401 且有 Refresh Token 时调用 POST /auth/refresh，只重试一次。
5. 项目 CRUD 由 Store 更新本地集合；权限、乐观锁与删除条件仍由后端裁决。

## 3. 模块职责

| 模块 | 负责 | 不负责 | 证据 |
|---|---|---|---|
| src/main.ts | 初始化 Vue、Pinia、Router、全局样式 | 业务状态 | src/main.ts |
| src/router/index.ts | URL 与页面路由 | 资源授权 | src/router/index.ts |
| ArchiveWorkspaceView.vue | 表单、项目/清单交互、路由同步 | HTTP/Token 协议 | src/views/ArchiveWorkspaceView.vue |
| ChecklistPanel.vue | FR-031 清单展示、创建/编辑/删除事件 | HTTP、服务端状态推导 | src/components/archive/ChecklistPanel.vue |
| DocumentProcessingPanel.vue | FR-032/033 上传、处理状态、解析/重试事件 | HTTP、状态机跳转、虚构状态 | src/components/archive/DocumentProcessingPanel.vue |
| archive-workspace.ts | 会话、项目、清单、文档处理、加载和错误状态 | 直接 fetch | src/stores/archive-workspace.ts |
| api.ts | HTTP、身份头、刷新重试、DTO 调用 | UI 展示 | src/services/api.ts |
| UnavailablePanel.vue | 未接入能力说明 | 编造业务数据 | src/components/archive/UnavailablePanel.vue |

## 4. 已复用模式

| 模式 | 位置 | 作用 |
|---|---|---|
| run(key, action) | 两个 Store | 防止同 key 重复请求，集中处理 loading/error |
| ApiError 与 request() | api.ts | 统一后端错误体 |
| 刷新后单次重试 | request() 与 refreshSession() | 防止无限刷新循环 |
| syncRouteProject() | ArchiveWorkspaceView.vue | 防止 URL 与已选项目不一致 |

## 5. 架构风险

- P14 已将本项目定为智慧档案本地联调界面。FR-031 和 FR-032/033 均已完成 `DTO → API → Store → View → Test → Vite /api`；FR-034～FR-041 尚未接入。后续仍按同一顺序完成，且每项先有实际运行的 RED 测试。
- Vue 单元测试只能验证客户端契约和展示逻辑；固定问题集检索质量、真实 DeepSeek 回答质量和 P13 跨 PostgreSQL/Chroma/文件系统恢复仍由后端 P14 独立验收，不能用界面测试替代。
- WorkspaceView.vue 与 workspace.ts 未注册到当前路由，仍是旧知识库 UI；不应作为智慧档案主联调入口。
- Refresh Token 位于 localStorage，受同源 XSS 风险影响。

## 6. 证据

- src/router/index.ts
- src/views/ArchiveWorkspaceView.vue
- src/stores/archive-workspace.ts
- src/services/api.ts
- ../mini-rag-handwrite/docs/api-design.md
