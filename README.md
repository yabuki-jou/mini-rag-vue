# 智慧档案 Vue 工作台

`mini-rag-milvus-vue` 是 `mini-rag-handwrite` 智慧档案 V1 的相邻 Vue 3 前端。它以“工程项目”为工作范围，提供
账号密码登录、项目创建/选择/修改/删除，以及智慧档案 V1 的导航与接口边界提示。

## 当前已接入的能力

当前实现通过账号密码登录取得的 `Authorization: Bearer <Access Token>` 调用认证接口、FR-030 项目接口和 FR-031 清单接口：

- `POST /projects`：创建项目，可选择复制五项虚构演示清单；
- `GET /projects`：读取当前用户可见项目；
- `PATCH /projects/{project_id}`：带 `expected_version` 的项目修改；
- `DELETE /projects/{project_id}`：删除空项目。
- `GET/POST/PATCH/DELETE /projects/{project_id}/checklist-items`：读取和维护项目独立清单。

FR-031 已完成 DTO、API 客户端、Pinia Store 和清单页面；清单读取、新增、修改和删除都携带 Bearer Token，新增使用
`expected_project_version`，修改使用 `expected_version`。页面只展示后端返回的 `SATISFIED/MISSING/NOT_PROVIDED`，不在客户端推导满足状态。

FR-032/033 项目文档处理已接入：页面可通过 Bearer Token 上传资料、读取处理列表、发起首次解析和专用解析重试，并只展示后端返回的状态。正式档案、带证据问答和审计菜单仍会明确显示为“接口待接入”。后端已提供 FR-031～FR-041 的对应路由；这并不代表后续前端能力已经接入。前端不会以模拟文档或状态冒充后端已经完成的业务能力。

## P14 前端验收范围

本项目是 P14 的本地联调工作台，不是公开多用户网站。后续按后端 API 设计的 FR 编号以 TDD 接入：

- FR-031：DTO、API、Store、列表、创建/修改/删除交互和真实 Vite `/api` 代理 canary 已完成；
- FR-032/033：DTO、API、Store、文档处理页面和真实 Vite `/api` 上传/解析/重试 canary 已完成；
- FR-034/035/036/037/038：建议与手工草稿、人工检查/确认/取消确认、清单关联和正式目录；
- FR-039/040/041：正式检索、带证据问答、物理删除和脱敏审计。

每一项都必须先新增实际运行的失败测试，再补最小实现，并以 `npm run typecheck`、`npm run test`、`npm run build` 和 Vite `/api` 对真实 FastAPI 的无模拟联调完成验收。浏览器页面不能直接连接 PostgreSQL、Chroma、文件系统、本地 BGE 或 DeepSeek，也不能提交 `user_id`、`owner_id` 或 `kb_id`。

## 技术栈

- Vue 3 + TypeScript + Vite
- Vue Router
- Pinia
- Vitest + Vue Test Utils

## 项目结构

```text
src/
├── components/archive/  # 侧栏、状态卡片、FR-031 清单、FR-032/033 文档处理与未接入接口提示
├── router/              # 项目范围的页面路由
├── services/            # Bearer 请求、令牌刷新、项目/清单/文档处理 API
├── stores/              # 登录会话、项目/清单/文档处理状态与乐观锁版本
├── types/               # 项目与清单 API 契约类型
└── views/               # 智慧档案工作台
```

## 本地启动

先启动 handwrite 后端：

```powershell
cd ../mini-rag-milvus-handwrite
python run.py
```

再启动前端：

```powershell
cd ../mini-rag-milvus-vue
npm install
npm run dev
```

访问 `http://127.0.0.1:5173`。如需覆盖 API 地址，将 `.env.example` 复制为 `.env`
并修改 `VITE_API_BASE_URL`。

## 质量检查

```powershell
npm run typecheck
npm run test
npm run build
```

## 当前限制

- 认证令牌保存在浏览器 `localStorage`；前端不保存密码，受保护请求使用 Bearer Access Token；
- 不读取或保存 `owner_id`、`kb_id` 等资源授权字段；
- FR-031 的 DTO/API、Store、视图与真实代理 canary 已完成。FR-032/033 已完成项目级上传、处理列表、首次解析、专用解析重试的 DTO/API、Store、视图与真实文件代理 canary；FR-034～FR-041 仍未接入，当前对应导航是占位而非验收证据；
- 2026-08-27 的 FR-032/033 canary 使用两份虚构 TXT：有效文本完成 `UPLOADED → PARSED`；无有效文本经普通解析和专用重试稳定返回 `422 PARSE_TEXT_UNAVAILABLE` 并保持 `PARSE_FAILED`。两份文档、项目、账号、会话和内部知识库均已删除并核对为零；首次清理因 Chroma 暂不可用保守中断，恢复心跳后重新完成，未绕过跨存储删除服务；
- 2026-08-27 使用本地 `.env`，经正式 Vite `5173/api → 8000` 代理完成健康、认证、项目和清单 CRUD canary，随后核对测试用户、会话、项目、知识库均为零；
- 状态别名、颜色映射和后续归档接口的完整 UI 行为，须随对应后端状态机实现后再冻结；
- “项目类型：演示”仅表示项目曾复制虚构演示清单，不代表真实工程归档规则。
