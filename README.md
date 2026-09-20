# 智慧档案 Vue 工作台

`mini-rag-milvus-vue` 是 [`mini-rag-handwrite`](https://github.com/yabuki-jou/mini-rag) 智慧档案后端的相邻 Vue 3 工作台，用于本地演示以项目为边界的档案处理、证据问答和项目档案助手。项目面向学习、作品集和小范围本地使用，不是公开多用户网站。

## 当前可演示能力

- **智慧档案 V1**：账号登录、项目与清单、项目文档处理、人工确认后的正式档案和脱敏审计等工作台流程。
- **FR-039 档案问答**：在当前项目的正式档案范围内进行原文检索和单轮带证据问答，展示后端返回的引用或拒答结果。
- **FR-042 项目档案助手（P08）**：在当前项目创建或恢复最近一个会话，连续发送消息，查看可见历史和脱敏工具记录；进入页面或刷新后会自动恢复最近会话。

FR-042 P08 只恢复当前项目最近会话，不提供通用会话列表、任意旧会话选择、重命名或删除。身份和检索范围由后端服务裁决，前端不提交 `user_id`、`owner_id` 或 `kb_id`。

## 技术栈

- Vue 3 + TypeScript + Vite
- Vue Router + Pinia
- Vitest + Vue Test Utils

## 本地启动

先在相邻目录启动后端：

```powershell
cd ..\mini-rag-handwrite
python run.py
```

再在本仓库启动前端：

```powershell
cd ..\mini-rag-milvus-vue
npm install
npm run dev
```

访问 `http://127.0.0.1:5173`。Vite 开发服务器会将 `/api` 请求代理到本机 `127.0.0.1:8000`；前端业务客户端只访问 FastAPI。

## 本地验证

```powershell
npm run typecheck
npm run test
npm run build
```

## MVP 限制

- 当前交付是本地联调工作台，不承诺云端部署、公开网站形态或生产资源规格。
- 浏览器不直接连接 PostgreSQL、Chroma、文件系统、本地 BGE 或 DeepSeek；后端负责身份、项目归属、检索范围和最终引用。
- Access Token 与 Refresh Token 当前保存在浏览器 `localStorage`，这是本地 MVP 的已知安全限制。
- 历史消息只恢复可见对话正文，不恢复旧回答的引用卡片；未完成的异常轮次不显示。
- FR-042 P08 的真实代理与页面刷新证据不等同于完整用户操作 E2E，也不代表真实模型语义质量评测。

## 证据与文档

- [Vue 文档目录](docs/README.md)
- [当前交接](docs/stage/handoff.md)
- [FR-042 Vue 接入说明](docs/implementation/FR042-Vue接入说明.md)
- [FR-042 Vue 真实代理闭环验收](docs/review/FR-042-Vue真实代理闭环验收/验收复盘.md)
- [后端 API 契约](https://github.com/yabuki-jou/mini-rag/blob/main/docs/design/接口设计.md)
