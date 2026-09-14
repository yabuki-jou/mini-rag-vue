# 编码约定

## 1. 命名规则

| 项目 | 规则 | 示例 | 证据 |
|---|---|---|---|
| Vue 组件 | PascalCase | ArchiveSidebar.vue | src/components/archive/ |
| TypeScript 文件 | kebab-case | archive-workspace.ts | src/stores/ |
| 类型与接口 | PascalCase | ArchiveProjectCreate、AuthTokenPair | src/types/index.ts |
| 函数与变量 | camelCase | createProject、accessToken | src/services/api.ts |
| 环境变量 | VITE_ 大写前缀 | VITE_API_BASE_URL | .env.example |
| localStorage 键 | 固定 kebab-case 前缀 | archive-v1-access-token | src/services/api.ts |

## 2. 格式与类型

- 未发现 formatter、linter 或配置；[TODO] 如需引入，先确认工具选择。
- npm run typecheck 执行 vue-tsc -b。
- tsconfig.app.json 开启 strict、isolatedModules 和 noEmit。
- npm run build 会先运行 vue-tsc -b 再运行 Vite 构建。

## 3. 导入约定

- 使用相对导入，如 ../services/api。
- 类型导入使用 import type。
- 未使用 barrel export 或路径别名。

## 4. 错误与令牌

- 非成功 HTTP 响应转为 ApiError(code, message, status, details)。
- Store 保存稳定消息和 HTTP 状态；workspace.ts 测试断言不将 error details 保存为展示状态。
- 页面只显示稳定错误消息，不展示堆栈或凭据。
- 令牌只能由 setApiTokens、setApiAccessToken、clearApiTokens 管理；不得保存密码。
- 未发现客户端日志、遥测或错误上报。

## 5. 测试约定

- 测试与源文件同目录，命名 *.test.ts。
- 使用 vi.mock 与 vi.spyOn(globalThis, fetch) 隔离网络和 Store。
- 未发现覆盖率阈值或浏览器 E2E 测试。
- P14 接入每个智慧档案接口时，先新增并实际运行失败测试（RED），再以最小实现转为 GREEN；只有相关测试持续通过时才重构。完成切片后还要运行 typecheck、全量前端测试、构建及 Vite `/api` 真实联调。

## 6. 证据

- tsconfig.app.json
- package.json
- src/services/api.ts
- src/stores/archive-workspace.ts
- src/services/api.test.ts
