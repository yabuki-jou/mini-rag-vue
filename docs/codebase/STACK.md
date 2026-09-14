# 技术栈

## 1. 运行时概览

| 范围 | 实际值 | 证据 |
|---|---|---|
| 主要语言 | TypeScript 与 Vue 单文件组件 | package.json、src/ |
| Node.js 版本 | [TODO] 未提供 .nvmrc 或 engines | package.json |
| 包管理器 | npm，lockfile v3 | package-lock.json |
| 构建 | 原生 ESM、Vite 7、vue-tsc | package.json |

## 2. 依赖

| 依赖 | 声明版本 | 作用 | 证据 |
|---|---:|---|---|
| vue | ^3.5.18 | Vue 运行时与组合式 API | package.json、src/main.ts |
| vue-router | ^4.5.1 | 浏览器路由 | package.json、src/router/index.ts |
| pinia | ^3.0.3 | 会话、项目和请求状态 | package.json、src/stores/ |
| @vueuse/core | ^13.6.0 | 已安装；src 未发现直接导入 | package.json、代码搜索 |

## 3. 开发工具

| 工具 | 用途 | 证据 |
|---|---|---|
| Vite 7 与 Vue 插件 | 开发服务器、代理、构建 | vite.config.ts |
| TypeScript 5.8 与 vue-tsc | 严格类型检查 | tsconfig.app.json、package.json |
| Vitest 3、jsdom、Vue Test Utils | 单元测试 | vite.config.ts、package.json |

未发现 ESLint、Prettier、Docker、CI 或覆盖率阈值配置。

## 4. 常用命令

    npm install
    npm run dev
    npm run typecheck
    npm run test
    npm run build

默认开发服务器为 5173。联调前先确认后端 8000 的 health 接口可用。

## 5. 配置

- .env.example 提供 VITE_API_BASE_URL=/api；真实 .env 被忽略，不能提交或读取。
- 未设置变量时，HTTP 客户端也默认使用 /api。
- Vite 将 /api/* 代理到 http://127.0.0.1:8000/* 并移除 /api 前缀。
- 浏览器网络面板的 http://localhost:5173/api/auth/login 对应后端 POST /auth/login。
- Access Token 与 Refresh Token 保存于 localStorage；没有 HttpOnly Cookie 会话。

## 6. 证据

- package.json
- package-lock.json
- vite.config.ts
- .env.example
- tsconfig.app.json

