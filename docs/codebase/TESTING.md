# 测试与验证

## 1. 测试栈与命令

- 测试框架：Vitest ^3.2.4，运行环境 jsdom。
- Mock：Vitest expect、vi.mock、vi.spyOn；已安装 Vue Test Utils。

    npm run test
    npm run typecheck
    npm run build

未配置独立 unit/integration/e2e/coverage 命令；单元测试不能替代真实后端联调。

## 2. 测试布局

| 文件 | 覆盖范围 |
|---|---|
| src/services/api.test.ts | Bearer、无 X-User-ID、统一错误、项目创建、FR-031 清单 CRUD、FR-032 multipart 上传、FR-033 解析/专用重试、401 刷新 |
| src/stores/archive-workspace.test.ts | 项目加载、乐观锁版本、登录后加载项目、FR-031 清单 CRUD、FR-032/033 文档列表/上传/解析/重试状态同步 |
| src/components/archive/ChecklistPanel.test.ts | FR-031 列表、空状态、创建载荷与后端派生状态展示 |
| src/components/archive/DocumentProcessingPanel.test.ts | FR-032/033 File 上传事件、状态驱动解析/重试与受控失败摘要展示 |
| src/stores/workspace.test.ts | 旧知识库状态清理、防重复操作、错误展示边界 |

测试与源文件同目录，命名 *.test.ts；未发现 Vitest setup 文件。

## 3. 测试范围

| 范围 | 覆盖？ | 说明 |
|---|---|---|
| 单元 | 是 | fetch 与 API 方法均 mocked |
| Vite 代理 | FR-031、FR-032/033 是 | 2026-08-27 经正式 5173/api → 8000 canary |
| 前端到真实后端 | FR-031、FR-032/033 是 | 认证、项目、清单和项目文档处理；其他 FR 未接入 |
| 浏览器 E2E | 否 | 未发现 Playwright/Cypress |

## 4. 隔离策略

- api.test.ts mock globalThis.fetch，只验证浏览器请求构建和响应处理。
- Store 测试 mock API 模块，不访问网络。
- 每个测试清空 localStorage 并清理 mock。
- mock 可通过并不代表真实后端 DTO、JWT 配置或代理可用。

## 5. P14 验收测试要求

- 每个 FR-031～FR-041 的可观察行为先在对应 `*.test.ts` 中新增并实际运行失败用例（RED），再实施最小代码使其通过（GREEN）。
- API 测试必须断言方法、路径、请求体、Bearer 身份头、版本字段和稳定错误处理；不得新增 `X-User-ID` 或服务端授权字段。
- 视图/Store 测试覆盖正常、空结果、权限/版本冲突、失败重试提示和删除后的状态同步。涉及上传时，测试必须覆盖 `FormData`，但不在单元测试中读真实文件或 Token。
- 每个前端切片完成后运行 `npm run typecheck`、`npm run test`、`npm run build`；随后在 Vite `/api` 与真实后端验证一次，记录状态码和可观察结果。真实检索质量、DeepSeek 质量与跨存储恢复另由后端 P14 记录。

## 6. 覆盖率和已知缺口

- 覆盖率工具/阈值：[TODO] 未配置。
- 当前运行结果（2026-08-27）：FR-031 API、Store 与组件均实际记录有效 RED（初始 mock 包装错误不计入 RED）；FR-032/033 的列表 API、四个 Store 方法和缺失的处理组件均实际记录 RED。最小实现后 API 12/12、Store 11/11、处理组件 4/4，前端全量为 5 个测试文件、35 个测试；`npm run typecheck`、`npm run test` 和 `npm run build` 均通过。正式 `5173/api → 8000` canary 覆盖健康、认证、项目、上传、处理列表、成功解析、受控失败重试与物理删除/清理。
- 主要缺口：浏览器自动化 E2E、注销后旧 Token 拒绝的真实复验，以及 FR-034～FR-041 的前端接入。

## 7. 证据

- package.json
- vite.config.ts
- src/services/api.test.ts
- src/stores/archive-workspace.test.ts
- src/components/archive/ChecklistPanel.test.ts
- src/components/archive/DocumentProcessingPanel.test.ts
- src/stores/workspace.test.ts
