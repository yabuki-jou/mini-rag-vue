# Vue 工作台当前交接

## 1. 当前分支与环境

- 仓库：`mini-rag-milvus-vue`
- 当前工作分支：`main`；FR042-P08 功能分支已快进合并并推送。
- 后端契约仓库：`mini-rag`（https://github.com/yabuki-jou/mini-rag）。
- 当前正式范围只保留智慧档案 V1、FR-039 档案问答和 FR-042 项目档案助手。

## 2. 已完成里程碑

- FR-030～FR-041 的 Vue 工作台接入和真实代理链路已完成。
- FR-042 项目档案助手的 DTO、API、Store、页面和自动化测试已完成。
- FR-042 真实 Vite 代理闭环已覆盖目录题、有据题、无据题、历史和脱敏工具日志。
- 已删除旧知识库、普通 Chat、检索和本地会话 API 残留，不改变智慧档案页面与 FR-042 交互。
- 前端完整回归为 11 个测试文件、136 个测试通过，类型检查和生产构建通过。
- Vue 专属实施计划和验收记录已从后端仓库迁入本仓库，并保留来源信息。
- `codex/archive-only-scope` 已在同步最新远端 `main` 后无冲突合并，合并文件树与已验收功能分支一致。
- FR042-P08 已实现进入档案助手页后恢复当前项目最近会话，并自动加载历史与脱敏工具记录；项目切换和登录状态变化均有竞态测试。
- P08 不把会话 ID 写入 localStorage，不提供会话列表、旧会话选择、重命名或删除，也不恢复历史引用或不完整轮次。
- P08 真实刷新恢复已通过：隔离 PostgreSQL、独立 SQLite Checkpoint、真实 `5173/api` 代理与浏览器整页刷新共同验证历史和 1 条脱敏工具记录自动恢复；固定本地模型仅用于写入受控历史，没有调用 DeepSeek。
- 经正式项目删除后，会话、工具记录和 Checkpoint 均由 1 归零；隔离 Schema、临时 SQLite 文件和本地服务已清理。
- P08 进入 `main` 后再次通过 11 个测试文件、136 个测试，以及类型检查和生产构建。

## 3. 未完成与待确认

- 智慧档案单主线与 P08 最近会话恢复均已进入 `main`；不再保留待合并的功能项。
- P08 浏览器整页刷新已有 DOM 恢复证据；这不等于完整用户操作 E2E 或 DeepSeek 语义质量复验。
- P08 已有真实 PostgreSQL + Checkpoint + Vite 页面刷新恢复证据，但不新增 DeepSeek 语义质量结论。
- 云端部署、公开网站形态和生产资源规格仍未决定。

## 4. 已知风险

- `docs/codebase/` 是较早的自动扫描快照，部分状态可能过期；当前事实以代码、根 README 和本交接为准。
- Access Token 与 Refresh Token 当前保存在浏览器 `localStorage`，同源 XSS 仍是已知风险。
- 前端只做项目选择一致性提示，不能替代后端项目所有权和资源范围校验。

## 5. 文档导航

- [文档目录](../README.md)
- [UI 指南](../design/archive-v1-ui-guidelines.md)
- [FR-042 Vue 接入说明](../implementation/FR042-Vue接入说明.md)
- [FR-042 真实代理验收](../review/FR-042-Vue真实代理闭环验收/验收复盘.md)
- [后端 API 契约](https://github.com/yabuki-jou/mini-rag/blob/main/docs/design/接口设计.md)
