# Vue 工作台文档导航

本目录只维护 Vue 工作台的实现、联调和验收资料。后端业务规则、数据库结构和 HTTP API
契约以 `mini-rag-milvus` 后端仓库为唯一事实源，前端文档不复制完整契约。

## 目录职责

- `design/`：前端交互与展示规则。
- `implementation/`：Vue 功能切片和接入记录。
- `review/`：前端真实代理验收与问题复盘。
- `stage/handoff.md`：当前可继续执行的前端状态快照。
- `codebase/`：历史代码扫描产物，可能早于当前实现，使用前必须回到实际代码核验。

## 当前入口

- [前端 UI 指南](design/archive-v1-ui-guidelines.md)
- [FR-042 Vue 接入说明](implementation/FR042-Vue接入说明.md)
- [FR-042 Vue 真实代理闭环验收](review/FR-042-Vue真实代理闭环验收/验收复盘.md)
- [当前交接](stage/handoff.md)
- [后端 API 契约](https://github.com/yabuki-jou/mini-rag-milvus/blob/main/docs/design/接口设计.md)

跨仓库迁入的文档均在标题下记录原仓库、原路径和源提交短哈希，以便回溯原始 Git 历史。
