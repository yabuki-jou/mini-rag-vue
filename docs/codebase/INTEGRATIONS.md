# 外部集成与前后端联调

## 1. 集成清单

| 系统 | 类型 | 作用 | 身份方式 | 关键性 | 证据 |
|---|---|---|---|---|---|
| FastAPI 后端 | HTTP JSON / multipart API | 认证、项目 CRUD、智慧档案 FR-031～FR-041 与旧知识库 API | 公共认证接口除外均为 Bearer | 高 | src/services/api.ts、相邻后端 `docs/api-design.md` |
| Vite 开发代理 | 本地反向代理 | 将 /api 转发至 127.0.0.1:8000 | 不适用 | 高 | vite.config.ts |
| 浏览器 localStorage | 客户端存储 | Token、用户名、选中项目、旧 UI 状态 | 同源存储 | 中 | api.ts、stores/ |

前端不直接连接数据库、向量库、消息队列或 LLM；只应访问 FastAPI。

## 2. 当前档案工作台实际调用

| 前端方法 | 方法与后端路径 | 调用时机 |
|---|---|---|
| api.health | GET /health | 页面挂载 |
| api.register | POST /auth/register | 注册 |
| api.login | POST /auth/login | 登录与注册后自动登录 |
| api.refreshSession | POST /auth/refresh | 恢复会话或首次 401 |
| api.logout | POST /auth/logout | 退出 |
| api.listArchiveProjects | GET /projects?page=&page_size= | 登录后和会话恢复后 |
| api.createArchiveProject | POST /projects | 新建项目 |
| api.updateArchiveProject | PATCH /projects/:id | 项目设置，必须有 expected_version |
| api.deleteArchiveProject | DELETE /projects/:id | 删除空项目 |
| api.listChecklistItems | GET /projects/:id/checklist-items | 进入清单页或手工刷新 |
| api.createChecklistItem | POST /projects/:id/checklist-items | 携带 expected_project_version 新增 |
| api.updateChecklistItem | PATCH /projects/:id/checklist-items/:itemId | 携带 expected_version 修改 |
| api.deleteChecklistItem | DELETE /projects/:id/checklist-items/:itemId | 用户确认后删除 |
| api.uploadProjectDocument | POST /projects/:id/documents | multipart 的唯一字段为 file；文档处理页调用 |
| api.listProjectDocuments | GET /projects/:id/documents | 当前项目文档处理列表；不等同于正式档案目录 |
| api.parseProjectDocument | POST /projects/:id/documents/:documentId/parse | 首次解析；文档处理页调用 |
| api.retryProjectDocumentParse | POST /projects/:id/documents/:documentId/parse-retry | 失败后的专用重试；文档处理页调用 |

api.ts 还保留 /knowledge-bases、旧 documents、retrieval-test 和 chat-sessions 调用；只被未注册的 WorkspaceView.vue 与 workspace.ts 引用，不是智慧档案项目级入口。

## 3. 后端已实现但前端未接入

后端 `docs/api-design.md`（2026-08-27）列出 FR-031～FR-041 的清单、项目文档、草稿/确认、关联、正式目录、检索、问答、删除和审计接口。FR-031 已完成 DTO、API、Pinia、真实列表和 Vite/真实后端联调。FR-032/033 已完成项目级上传、处理列表、首次解析、专用解析重试的 DTO/API、Pinia、页面和真实文件代理联调。FR-034～FR-041 还没有对应 DTO、API 方法、Pinia 操作或真实列表。后续仍按 `测试 RED → 最小实现 GREEN → 相关重构 → Vite /api 真实联调` 接入。

建议的验收顺序是：

1. FR-031 清单项 Store、列表和编辑/删除交互（已完成）；
2. FR-032/033 上传、解析状态与重试（已完成）；
3. FR-034/035 草稿与建议（下一项）；
4. FR-036/037/038 确认、关联和目录；
5. FR-039/040/041 检索问答、删除和审计。

## 4. 身份与内容类型

- register、login、refresh、health 不附加 Authorization。
- 其他请求由 request() 附加 Authorization: Bearer <Access Token>。
- 每次请求附加 crypto.randomUUID() 生成的 X-Request-ID。
- JSON 请求使用 application/json；FormData 上传由浏览器设置 boundary。
- X-User-ID 不参与 HTTP 身份认证，api.test.ts 断言该头不会被发送。

## 5. 本地联调

    # 终端 1：后端 mini-rag-handwrite
    python run.py

    # 终端 2：此前端
    npm run dev

先验证：

    Invoke-WebRequest http://127.0.0.1:8000/health -UseBasicParsing
    Invoke-WebRequest http://127.0.0.1:5173/api/health -UseBasicParsing

两者都应为 200。浏览器面板中的 POST http://localhost:5173/api/auth/login 会由代理转发为后端 POST http://127.0.0.1:8000/auth/login。

已接入部分的最小真实链路：注册 201（无密码字段）或登录 200（Access/Refresh Token）→ GET /api/projects 为 200 → 创建项目 201 → 带 expected_version 修改 200 → 空项目删除 204。

2026-08-27 已按正式 `vite.config.ts` 验证 `5173/api → 8000`：OpenAPI 和完整健康均为 200/ok；注册 201、登录 200、创建项目 201、清单读取 200（五项）、新增 201（后端返回 MISSING）、修改 200（版本 2）、删除 204、项目删除 204、注销 204。虚构用户、会话、项目和内部知识库均精确清理并核对为零。

同日 FR-032/033 canary 经相同代理验证：两份虚构 TXT 上传均为 201/UPLOADED；有效文本解析为 200/PARSED；无有效文本的普通解析和专用重试均为 422/PARSE_TEXT_UNAVAILABLE，处理列表最终为 PARSED 与 PARSE_FAILED。两份文档物理删除、项目删除、注销和所有测试范围清理均完成。首次清理因 Chroma 暂不可用中断；Chroma 心跳恢复后由既有物理删除服务恢复完成，未绕过跨存储约束。

完成 FR-031～FR-041 后，P14 端到端链路需在同一个项目上覆盖：清单 → 上传 → 解析/重试 → 草稿/建议 → 人工确认 → 关联 → 正式目录 → 检索/带证据问答 → 删除 → 审计。页面不得用 mock、`UnavailablePanel` 或直接构造状态代替真实响应；Swagger 可用于逐接口诊断，但不替代前端联调。

## 6. 可靠性与可观测性

- 401 自动刷新：已实现，每请求仅刷新并重试一次。
- 超时、退避、断路器：未实现。[TODO]
- 请求日志、指标和追踪上报：未实现；可使用 X-Request-ID 与后端关联。[TODO]

## 7. 证据

- vite.config.ts
- .env.example
- src/services/api.ts
- src/services/api.test.ts
- src/views/ArchiveWorkspaceView.vue
- ../mini-rag-handwrite/docs/api-design.md
