# 智慧档案 Vue 工作台

`mini-rag-milvus-vue` 是 `mini-rag-handwrite` 智慧档案 V1 的相邻 Vue 3 前端。它以“工程项目”为工作范围，提供
账号密码登录、项目创建/选择/修改/删除，以及智慧档案 V1 的导航与接口边界提示。

## 当前已接入的能力

当前实现通过账号密码登录取得的 `Authorization: Bearer <Access Token>` 调用认证接口和 FR-030～FR-042 已接入接口：

- `POST /projects`：创建项目，可选择复制五项虚构演示清单；
- `GET /projects`：读取当前用户可见项目；
- `PATCH /projects/{project_id}`：带 `expected_version` 的项目修改；
- `DELETE /projects/{project_id}`：删除空项目。
- `GET/POST/PATCH/DELETE /projects/{project_id}/checklist-items`：读取和维护项目独立清单。

FR-031 已完成 DTO、API 客户端、Pinia Store 和清单页面；清单读取、新增、修改和删除都携带 Bearer Token，新增使用
`expected_project_version`，修改使用 `expected_version`。页面只展示后端返回的 `SATISFIED/MISSING/NOT_PROVIDED`，不在客户端推导满足状态。

FR-032～FR-041 已完成项目文档处理、字段草稿、人工确认、清单关联、正式目录、单轮检索问答、物理删除和脱敏审计接入。FR-042 新增独立“档案助手”入口：可在当前项目创建一个会话、连续发送消息、刷新完整可见历史，并读取脱敏工具调用记录。它不替换 FR-039 单轮诊断入口，也不提供会话列表、重命名或删除。

FR-042 客户端只提交空对象创建会话和 `{ message }` 发送消息；`user_id`、`project_id`、`kb_id`、`thread_id`、`agent_type` 均不由消息请求提交或在页面展示。回答引用只展示文件名、位置类型、起止位置和原文摘录，不显示持久化标识或检索分数。

## P14 前端验收范围

本项目是 P14 的本地联调工作台，不是公开多用户网站。后续按后端 API 设计的 FR 编号以 TDD 接入：

- FR-031：DTO、API、Store、列表、创建/修改/删除交互和真实 Vite `/api` 代理 canary 已完成；
- FR-032/033：DTO、API、Store、文档处理页面和真实 Vite `/api` 上传/解析/重试 canary 已完成；
- FR-034～FR-041：建议与手工草稿、人工检查/确认/取消确认、清单关联、正式目录、检索问答、物理删除和脱敏审计均已接入；
- FR-042：独立档案助手 DTO、四端点 API、Store、页面与自动化测试已完成；当前路由为 `/projects/{project_id}/archive-agent`。

每一项都必须先新增实际运行的失败测试，再补最小实现，并以 `npm run typecheck`、`npm run test`、`npm run build` 和 Vite `/api` 对真实 FastAPI 的无模拟联调完成验收。浏览器页面不能直接连接 PostgreSQL、Chroma、文件系统、本地 BGE 或 DeepSeek，也不能提交 `user_id`、`owner_id` 或 `kb_id`。

## 技术栈

- Vue 3 + TypeScript + Vite
- Vue Router
- Pinia
- Vitest + Vue Test Utils

## 文档导航

- [Vue 文档目录](docs/README.md)
- [当前交接](docs/stage/handoff.md)
- [FR-042 Vue 接入说明](docs/implementation/FR042-Vue接入说明.md)
- [FR-042 Vue 真实代理闭环验收](docs/review/FR-042-Vue真实代理闭环验收/验收复盘.md)
- [后端 API 契约](https://github.com/yabuki-jou/mini-rag-milvus/blob/main/docs/design/接口设计.md)

## 项目结构

```text
src/
├── components/archive/  # 清单、文档、档案、问答、审计与项目档案助手组件
├── router/              # 项目范围的页面路由
├── services/            # Bearer 请求、令牌刷新与智慧档案 API
├── stores/              # 登录、项目、归档流程、检索和档案助手状态
├── types/               # 前端消费的公开 API 契约类型
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
- FR-031～FR-042 的当前公开契约已接入。FR-042 当前会话只保存在页面 Store；刷新浏览器后需要新建会话，本期不提供会话列表；
- 2026-09-17 的 FR-042 前端回归为 11 个测试文件、130 个测试通过，类型检查和生产构建通过；随后使用随机隔离 PostgreSQL Schema、临时 Chroma Collection、文件和 Checkpoint，经真实 Vite `5173/api` 代理完成注册登录、建档确认、目录题、有据题、无据题、三轮历史和脱敏工具日志；
- 真实代理验收的三轮状态为 `ANSWERED / ANSWERED / REFUSED_NO_EVIDENCE`，有据回答返回同文件脱敏引用；验收后隔离 Schema、Collection、文件和 Checkpoint 均已清理。该证据不包含真实浏览器 DOM 点击，也不代表长期稳定性；
- 2026-08-27 的 FR-032/033 canary 使用两份虚构 TXT：有效文本完成 `UPLOADED → PARSED`；无有效文本经普通解析和专用重试稳定返回 `422 PARSE_TEXT_UNAVAILABLE` 并保持 `PARSE_FAILED`。两份文档、项目、账号、会话和内部知识库均已删除并核对为零；首次清理因 Chroma 暂不可用保守中断，恢复心跳后重新完成，未绕过跨存储删除服务；
- 2026-08-27 使用本地 `.env`，经正式 Vite `5173/api → 8000` 代理完成健康、认证、项目和清单 CRUD canary，随后核对测试用户、会话、项目、知识库均为零；
- 状态别名、颜色映射和后续归档接口的完整 UI 行为，须随对应后端状态机实现后再冻结；
- “项目类型：演示”仅表示项目曾复制虚构演示清单，不代表真实工程归档规则。
