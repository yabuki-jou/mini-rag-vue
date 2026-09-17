# Vue 工作台当前交接

## 1. 当前分支与环境

- 仓库：`mini-rag-milvus-vue`
- 当前整理分支：`codex/docs-reorganization`
- 后端契约仓库：`mini-rag-milvus`
- 本轮只整理文档，不修改 Vue 运行代码。

## 2. 已完成里程碑

- FR-030～FR-041 的 Vue 工作台接入和真实代理链路已完成。
- FR-042 项目档案助手的 DTO、API、Store、页面和自动化测试已完成。
- FR-042 真实 Vite 代理闭环已覆盖目录题、有据题、无据题、历史和脱敏工具日志。
- 前端最后记录的完整回归为 11 个测试文件、130 个测试通过，类型检查和生产构建通过。
- Vue 专属实施计划和验收记录已从后端仓库迁入本仓库，并保留来源信息。

## 3. 未完成与待确认

- 文档整理已完成链接检查、差异主审和本地提交，并已推送至 `origin/codex/docs-reorganization`；尚未合并。
- 浏览器 DOM 点击没有新增验收证据；现有结论只覆盖自动化测试和真实 HTTP 代理。
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
- [后端 API 契约](https://github.com/yabuki-jou/mini-rag-milvus/blob/main/docs/design/接口设计.md)
