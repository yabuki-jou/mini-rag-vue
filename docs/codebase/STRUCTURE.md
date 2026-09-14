# 前端结构

## 1. 顶层地图

| 路径 | 作用 | 证据 |
|---|---|---|
| src/ | 前端源代码 | src/main.ts |
| src/components/archive/ | 侧栏、指标卡、FR-031 清单、FR-032/033 文档处理、未接入提示 | ArchiveSidebar.vue、StatusMetric.vue、ChecklistPanel.vue、DocumentProcessingPanel.vue、UnavailablePanel.vue |
| src/components/common/ | 通用服务状态 | ServiceStatus.vue |
| src/layouts/ | 根布局插槽容器 | DefaultLayout.vue |
| src/router/ | Vue Router 路由表 | src/router/index.ts |
| src/services/ | HTTP、令牌、API 调用 | src/services/api.ts |
| src/stores/ | Pinia 会话与工作台状态 | archive-workspace.ts、workspace.ts |
| src/types/ | 前后端 DTO 类型 | src/types/index.ts |
| src/views/ | 页面级组件 | ArchiveWorkspaceView.vue、WorkspaceView.vue |
| docs/review/ | UI 规则 | archive-v1-ui-guidelines.md |
| docs/codebase/ | 此次生成的交接文档 | 本目录 |

## 2. 入口与路由

- src/main.ts 创建 Vue App，注册 Pinia 和 Router，再挂载 App.vue。
- App.vue 用 DefaultLayout 包裹 RouterView。
- src/router/index.ts 中所有当前注册路由均渲染 ArchiveWorkspaceView.vue。

| URL | 路由名 | 当前行为 |
|---|---|---|
| / | overview | 登录/注册、项目列表、项目 CRUD |
| /projects/:projectId/checklist-items | checklist | FR-031：真实清单列表与创建、修改、删除 |
| /projects/:projectId/documents | documents | FR-032/033：真实上传、处理列表、首次解析和失败重试 |
| /projects/:projectId/archives | archives | FR-034～FR-038：当前未接入提示；P14 第三项 |
| /projects/:projectId/archive-questions | questions | FR-039：当前未接入提示；P14 第四项 |
| /projects/:projectId/audit-logs | audit | FR-040/041：当前未接入提示；P14 第四项 |
| /projects/:projectId/settings | settings | 修改、删除当前项目 |

projectId 会与当前项目列表比较；不匹配时跳回 /，不会用另一个项目的数据渲染该 URL。

## 3. 模块边界

| 边界 | 应负责 | 不应负责 |
|---|---|---|
| views/ | 表单交互、路由同步、组件编排 | 直接拼接 HTTP 请求、伪造接口数据 |
| stores/ | 会话、项目、加载/错误状态 | 直接 fetch、服务端权限裁决 |
| services/api.ts | 请求头、刷新重试、统一错误、API 调用 | DOM 展示 |
| types/ | 编译期 DTO 描述 | 运行时校验、权限判断 |
| components/ | 展示与事件 | 持久化会话、业务 API 调用 |

## 4. 命名与组织

- Vue 组件使用 PascalCase，如 ArchiveWorkspaceView.vue。
- TypeScript 源文件和 Store 使用 kebab-case，如 archive-workspace.ts。
- 当前采用技术分层目录，archive 子目录是领域组件分组。
- 所有导入为相对路径；未配置路径别名。

## 5. 证据

- src/main.ts
- src/App.vue
- src/router/index.ts
- src/views/ArchiveWorkspaceView.vue
- src/services/api.ts
