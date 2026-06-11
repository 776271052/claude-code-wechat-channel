<div align="center">

# Claude Code WeChat Channel

**微信 ClawBot 连接助手 — 将微信消息桥接到 Claude Code / 远程 API**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)
[![Electron](https://img.shields.io/badge/Electron-42-blue.svg)](https://electronjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org)
[![Release](https://img.shields.io/github/v/release/776271052/claude-code-wechat-channel)](https://github.com/776271052/claude-code-wechat-channel/releases)

</div>

---

## 📖 目录

- [功能特性](#-功能特性)
- [快速开始](#-快速开始)
- [使用指南](#-使用指南)
- [支持的 API 提供商](#-支持的-api-提供商)
- [技术架构](#-技术架构)
- [技术栈](#-技术栈)
- [项目结构](#-项目结构)
- [配置说明](#-配置说明)
- [开发指南](#-开发指南)
- [故障排除](#-故障排除)
- [常见问题](#-常见问题)
- [更新日志](#-更新日志)
- [许可证](#-许可证)
- [贡献](#-贡献)
- [联系方式](#-联系方式)

---

## ✨ 功能特性

### 🔐 微信扫码登录
- 一键扫码连接，无需复杂配置
- 支持微信 iOS 最新版（需支持 ClawBot 插件）
- 自动保存登录凭据，下次启动自动连接
- 支持多账号切换

### 🤖 多 LLM 支持
- **CLI 模式**：本地 Claude Code CLI 调用
- **API 模式**：远程 OpenAI 兼容 / Anthropic API
- 自动检测已安装的 CLI
- 支持手动指定 CLI 路径
- 可配置工作目录和额外参数

### 🔍 智能模型发现
- 自动获取可用模型列表
- 支持手动输入模型名称
- 一键测试 API 连接
- 实时显示连接状态

### 💬 实时消息
- 收发消息实时显示
- 支持文本、语音、图片、文件、视频消息
- 语音消息自动转文字
- 图片和文件自动下载缓存
- 支持群聊消息

### 🛡️ 权限管理
- 5 种权限模式可选：
  - 默认（每次操作都询问）
  - 自动编辑（文件读写自动通过）
  - 计划模式（只规划不执行）
  - 自动（自动执行安全操作）
  - 绕过权限（所有操作自动通过，危险！）

### 🔄 自动更新
- 检测 GitHub Releases 新版本
- 显示更新日志
- 一键下载安装包

### 🎨 精美 UI
- 现代化亮色主题设计
- 响应式布局
- 流畅的动画效果
- 清晰的图标和提示

### 🛠️ 开发者工具
- 实时终端输出
- 进程管理面板
- 系统诊断工具
- 日志查看器

---

## 🚀 快速开始

### 方式一：下载安装包（推荐）

1. 访问 [Releases 页面](https://github.com/776271052/claude-code-wechat-channel/releases)
2. 下载最新版 `Claude Code WeChat x.x.x.exe`
3. 双击运行，无需安装
4. 按照界面提示完成配置

### 方式二：从源码构建

```bash
# 1. 克隆仓库
git clone https://github.com/776271052/claude-code-wechat-channel.git
cd claude-code-wechat-channel

# 2. 安装依赖
npm install

# 3. 启动开发模式
npm run dev

# 4. 构建 EXE（可选）
npm run package:win
```

构建完成后，EXE 文件位于 `dist/` 目录。

---

## 🎯 使用指南

### 第一步：微信扫码登录

1. 启动应用后，点击「扫码登录」按钮
2. 使用微信扫描显示的二维码
3. 在微信中确认登录
4. 等待连接成功提示

**注意事项**：
- 需要微信 iOS 最新版
- 需要支持 ClawBot 插件
- 二维码有效期为 8 分钟
- 超时后需重新扫码

### 第二步：配置 LLM 模式

#### CLI 模式

使用本地安装的 Claude Code CLI：

1. 切换到「CLI 模式」
2. 系统自动检测已安装的 CLI
3. 如未检测到，可手动指定路径
4. 可选配置：
   - 工作目录
   - 额外 CLI 参数（JSON 数组）
   - 权限模式

**支持的 CLI 参数**：
```json
["--model", "sonnet", "--max-tokens", "4096"]
```

#### API 模式

使用远程 API：

1. 切换到「API 模式」
2. 选择接口协议：
   - **OpenAI 兼容**：DeepSeek、小米 MiMo 等
   - **Anthropic**：Claude API 及兼容代理
3. 选择 API 提供商（快捷选择）
4. 填写 API 地址和 Token
5. 点击「获取模型」自动获取可用模型
6. 选择模型
7. 点击「测试连接」验证配置

**API 地址示例**：
```
DeepSeek: https://api.deepseek.com/v1/chat/completions
小米 MiMo: https://token-plan-cn.xiaomimimo.com/v1/chat/completions
Anthropic: https://api.anthropic.com/v1/messages
```

### 第三步：启动 Bot

1. 配置完成后，点击「启动」按钮
2. Bot 开始监听微信消息
3. 在微信中发送消息
4. Claude 会自动回复

**Bot 状态说明**：
- 🟢 运行中：正常监听消息
- 🟡 启动中：正在初始化
- 🔴 错误：出现异常
- ⚪ 待机：未启动

### 第四步：查看消息

在控制台页面可以：
- 查看收到的消息
- 查看发送的回复
- 查看错误信息
- 搜索和过滤消息

---

## 📋 支持的 API 提供商

### OpenAI 兼容协议

| 提供商 | API 地址 | 说明 |
|--------|----------|------|
| DeepSeek | `https://api.deepseek.com/v1/chat/completions` | 国产大模型 |
| 小米 MiMo | `https://token-plan-cn.xiaomimimo.com/v1/chat/completions` | 小米自研模型 |
| 月之暗面 | `https://api.moonshot.cn/v1/chat/completions` | Kimi 模型 |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4/chat/completions` | ChatGLM 模型 |
| 阿里通义 | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` | 通义千问 |
| OpenRouter | `https://openrouter.ai/api/v1/chat/completions` | 多模型聚合 |
| SiliconFlow | `https://api.siliconflow.cn/v1/chat/completions` | 硅基流动 |
| Groq | `https://api.groq.com/openai/v1/chat/completions` | 高速推理 |
| Together AI | `https://api.together.xyz/v1/chat/completions` | 开源模型 |

### Anthropic 协议

| 提供商 | API 地址 | 说明 |
|--------|----------|------|
| Anthropic 官方 | `https://api.anthropic.com/v1/messages` | Claude API |
| 小米 MiMo | `https://token-plan-cn.xiaomimimo.com/anthropic/v1/messages` | Anthropic 兼容 |

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                    Electron 应用                         │
├─────────────────────────────────────────────────────────┤
│  主进程 (Node.js)                                        │
│  ├── WeChat API 客户端                                   │
│  │   ├── QR 登录                                         │
│  │   ├── 长轮询                                          │
│  │   ├── 消息收发                                        │
│  │   └── 输入状态                                        │
│  ├── Claude CLI 进程管理                                  │
│  │   ├── 进程池                                          │
│  │   ├── 超时控制                                        │
│  │   └── 输出流                                          │
│  ├── OpenAI/Anthropic API 客户端                          │
│  │   ├── 协议适配                                        │
│  │   ├── SSE 流式解析                                    │
│  │   └── 模型发现                                        │
│  └── 系统托盘 & 窗口管理                                  │
├─────────────────────────────────────────────────────────┤
│  渲染进程 (React)                                        │
│  ├── 控制台 (Dashboard)                                  │
│  ├── 登录页面                                            │
│  ├── 设置页面                                            │
│  ├── 终端页面                                            │
│  └── 进程管理                                            │
├─────────────────────────────────────────────────────────┤
│  预加载脚本 (Preload)                                    │
│  └── IPC 桥接                                            │
└─────────────────────────────────────────────────────────┘
```

### 数据流

```
微信消息 → ilink API → 长轮询 → 消息提取 → Claude CLI/API → 回复生成 → 发送回微信
```

### 进程通信

```
主进程 (Node.js) ←→ IPC ←→ 预加载脚本 ←→ 渲染进程 (React)
```

---

## 🛠️ 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 桌面框架 | Electron | 42 |
| 前端框架 | React | 18 |
| 构建工具 | Vite | 7 |
| UI 组件 | shadcn/ui | - |
| CSS 框架 | Tailwind CSS | 3.4 |
| 状态管理 | Zustand | 5.0 |
| 类型系统 | TypeScript | 5.6 |
| 包管理 | npm | - |

### 依赖库

| 库 | 用途 |
|----|------|
| `@radix-ui/react-slot` | 组件插槽 |
| `class-variance-authority` | 样式变体 |
| `clsx` | 类名合并 |
| `lucide-react` | 图标库 |
| `qrcode.react` | 二维码生成 |
| `react-router-dom` | 路由管理 |
| `tailwind-merge` | Tailwind 类名合并 |
| `tailwindcss-animate` | 动画支持 |

---

## 📦 项目结构

```
claude-code-wechat-channel/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── modules/             # 核心模块
│   │   │   ├── bot-controller.ts    # Bot 生命周期管理
│   │   │   ├── bot-handler.ts       # 消息处理逻辑
│   │   │   ├── claude-runner.ts     # CLI 进程管理
│   │   │   ├── openai-runner.ts     # API 调用
│   │   │   ├── polling.ts           # WeChat 长轮询
│   │   │   ├── credentials.ts       # 凭据管理
│   │   │   ├── context-tokens.ts    # 会话令牌
│   │   │   ├── crypto.ts            # AES 加解密
│   │   │   ├── media.ts             # 媒体处理
│   │   │   ├── typing.ts            # 输入状态
│   │   │   ├── updater.ts           # 更新检查
│   │   │   ├── cli-discovery.ts     # CLI 发现
│   │   │   ├── wechat-api.ts        # WeChat API
│   │   │   └── types.ts             # 类型定义
│   │   ├── utils/               # 工具函数
│   │   │   ├── logger.ts            # 日志系统
│   │   │   └── paths.ts             # 路径管理
│   │   ├── ipc-handlers.ts      # IPC 处理器
│   │   ├── index.ts             # 主入口
│   │   ├── window.ts            # 窗口管理
│   │   └── tray.ts              # 系统托盘
│   ├── renderer/                # React 前端
│   │   ├── src/
│   │   │   ├── components/      # UI 组件
│   │   │   │   └── ui/          # shadcn/ui 组件
│   │   │   ├── pages/           # 页面
│   │   │   │   ├── DashboardPage.tsx
│   │   │   │   ├── LoginPage.tsx
│   │   │   │   ├── SettingsPage.tsx
│   │   │   │   ├── CLIPage.tsx
│   │   │   │   ├── TerminalPage.tsx
│   │   │   │   ├── ProcessesPage.tsx
│   │   │   │   └── DiagPage.tsx
│   │   │   ├── hooks/           # 自定义 Hooks
│   │   │   │   ├── useBot.ts
│   │   │   │   └── useQRLogin.ts
│   │   │   ├── stores/          # 状态管理
│   │   │   │   ├── app-store.ts
│   │   │   │   └── message-store.ts
│   │   │   ├── lib/             # 工具库
│   │   │   │   └── utils.ts
│   │   │   ├── styles/          # 样式
│   │   │   │   └── global.css
│   │   │   ├── App.tsx          # 应用入口
│   │   │   └── main.tsx         # 渲染入口
│   │   └── index.html           # HTML 模板
│   ├── preload/                 # 预加载脚本
│   │   ├── index.ts             # IPC 桥接
│   │   └── index.d.ts           # 类型定义
│   └── shared/                  # 共享类型
│       └── types.ts
├── resources/                   # 应用资源
│   ├── icon.ico                 # 应用图标
│   └── icon.png
├── scripts/                     # 构建脚本
│   └── strip-locales.mjs        # 语言包清理
├── electron-builder.yml         # 打包配置
├── electron.vite.config.ts      # Vite 配置
├── tsconfig.json                # TypeScript 配置
├── tailwind.config.ts           # Tailwind 配置
├── postcss.config.mjs           # PostCSS 配置
├── components.json              # shadcn/ui 配置
└── package.json
```

---

## ⚙️ 配置说明

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `CLAUDE_CODE_CLI` | Claude CLI 路径 | 自动检测 |
| `CLAUDE_CODE_TIMEOUT_MS` | CLI 超时时间（毫秒） | 600000 |
| `CLAUDE_CODE_WORKDIR` | 工作目录 | 当前目录 |

### 配置文件位置

所有配置文件存储在应用目录下的 `data/` 文件夹：

| 文件 | 说明 |
|------|------|
| `account.json` | 微信登录凭据（Token、账号 ID） |
| `gui_settings.json` | 应用设置（LLM 模式、API 配置、CLI 路径） |
| `context_tokens.json` | 会话令牌缓存 |
| `sync_buf.txt` | 同步状态缓冲 |

**配置文件示例**：

```json
// account.json
{
  "token": "your_wechat_token",
  "baseUrl": "https://ilinkai.weixin.qq.com",
  "accountId": "your_account_id",
  "userId": "your_user_id",
  "savedAt": "2025-01-01T00:00:00.000Z"
}
```

```json
// gui_settings.json
{
  "mode": "api",
  "apiProtocol": "openai",
  "apiUrl": "https://api.deepseek.com/v1/chat/completions",
  "apiToken": "sk-your-api-token",
  "model": "deepseek-chat",
  "apiMaxTokens": 4096,
  "apiSystemPrompt": "",
  "permissionMode": "default",
  "timeoutMs": 600000
}
```

---

## 🔧 开发指南

### 前置要求

- [Node.js](https://nodejs.org) >= 18
- [Git](https://git-scm.com)
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)（仅 Windows 打包需要）

### 开发命令

```bash
# 安装依赖
npm install

# 启动开发服务器（热重载）
npm run dev

# 类型检查
npm run typecheck

# 构建生产版本
npm run build

# 打包 Windows EXE
npm run package:win

# 打包 macOS DMG（需要 macOS）
npm run package:mac

# 打包 Linux AppImage
npm run package:linux
```

### 开发模式特性

- 热重载：修改代码自动刷新
- DevTools：按 F12 打开开发者工具
- 日志输出：控制台显示详细日志
- 错误提示：友好的错误信息

### 代码规范

- 使用 TypeScript 严格模式
- 遵循 ESLint 规则
- 使用 Prettier 格式化
- 组件使用函数式写法
- 状态管理使用 Zustand

---

## 🔍 故障排除

### 登录问题

#### 二维码不显示
```
原因：网络连接问题
解决：
1. 检查网络连接
2. 尝试刷新页面
3. 检查防火墙设置
```

#### 扫码后无反应
```
原因：微信版本不支持
解决：
1. 更新微信到最新版
2. 确认支持 ClawBot 插件
3. 重启应用重试
```

#### 登录超时
```
原因：二维码过期（8分钟）
解决：
1. 重新点击扫码登录
2. 尽快完成扫码
```

### Bot 启动问题

#### Claude CLI 未找到
```
原因：CLI 未安装或路径错误
解决：
1. 安装 Claude Code CLI
2. 在设置中手动指定路径
3. 检查 PATH 环境变量
```

#### API 连接失败
```
原因：API 地址或 Token 错误
解决：
1. 检查 API 地址是否正确
2. 验证 Token 是否有效
3. 点击「测试连接」诊断
4. 检查网络代理设置
```

#### Bot 启动后无响应
```
原因：权限配置问题
解决：
1. 检查权限模式设置
2. 查看终端日志
3. 尝试重启 Bot
```

### 消息问题

#### 消息发送失败
```
原因：网络问题或 Token 过期
解决：
1. 检查网络连接
2. 重新登录微信
3. 查看错误日志
```

#### 回复延迟
```
原因：API 响应慢或超时
解决：
1. 增加超时时间设置
2. 检查 API 服务状态
3. 尝试其他 API 提供商
```

#### 消息丢失
```
原因：轮询中断
解决：
1. 重启 Bot
2. 检查网络稳定性
3. 查看日志排查原因
```

---

## ❓ 常见问题

### Q: 支持哪些微信版本？
A: 需要微信 iOS 最新版，且支持 ClawBot 插件。Android 版本暂不支持。

### Q: 可以同时使用多个 API 提供商吗？
A: 目前只支持配置一个 API 提供商。如需切换，需在设置中修改配置。

### Q: 消息记录会保存吗？
A: 消息记录保存在内存中，应用重启后会清空。如需持久化，可考虑导出功能。

### Q: 如何更新到最新版本？
A: 在设置页面点击「检查更新」，或从 GitHub Releases 下载最新版。

### Q: 支持群聊吗？
A: 支持。群聊消息会自动识别并回复。

### Q: 可以自定义回复模板吗？
A: 目前不支持。回复由 Claude 生成，无法自定义模板。

### Q: 如何查看详细日志？
A: 在终端页面可以查看实时日志输出。

### Q: 应用占用多少资源？
A: 内存占用约 100-200MB，CPU 占用很低（空闲时 < 1%）。

---

## 📝 更新日志

### v1.0.0 (2025-01-01)
- ✨ 初始发布
- 🔐 微信扫码登录
- 🤖 Claude CLI 支持
- 🌐 OpenAI/Anthropic API 支持
- 🎨 现代化 UI 设计
- 📱 系统托盘支持
- 🔄 自动更新检查

### v0.9.0 (2024-12-15)
- 🧪 测试版本
- 🔧 基础功能实现
- 🐛 Bug 修复

---

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE) — **仅限非商业用途**。

**许可条款**：
- ✅ 个人使用
- ✅ 学习研究
- ✅ 非商业项目
- ❌ 商业使用
- ❌ 销售盈利
- ❌ 付费服务

商业使用请联系版权所有者获取授权。

---

## 🤝 贡献

欢迎贡献代码、报告问题或提出建议！

### 贡献方式

1. **报告 Bug**
   - 使用 [Issue 模板](https://github.com/776271052/claude-code-wechat-channel/issues/new)
   - 提供详细复现步骤
   - 附上错误日志

2. **提交代码**
   - Fork 项目
   - 创建功能分支
   - 提交 Pull Request
   - 等待代码审查

3. **提出建议**
   - 使用 [Discussion](https://github.com/776271052/claude-code-wechat-channel/discussions)
   - 描述使用场景
   - 提供改进方案

### 开发规范

- 遵循 TypeScript 严格模式
- 添加必要的注释
- 更新相关文档
- 确保测试通过

---

## 📞 联系方式

- **GitHub**: [776271052](https://github.com/776271052)
- **Issues**: [提交问题](https://github.com/776271052/claude-code-wechat-channel/issues)
- **Discussions**: [参与讨论](https://github.com/776271052/claude-code-wechat-channel/discussions)
- **Releases**: [版本发布](https://github.com/776271052/claude-code-wechat-channel/releases)

---

## 🙏 致谢

感谢以下开源项目：

- [Electron](https://electronjs.org/) - 跨平台桌面应用框架
- [React](https://react.dev/) - 用户界面库
- [shadcn/ui](https://ui.shadcn.com/) - UI 组件库
- [Tailwind CSS](https://tailwindcss.com/) - CSS 框架
- [Vite](https://vitejs.dev/) - 构建工具
- [Zustand](https://github.com/pmndrs/zustand) - 状态管理

---

<div align="center">

**如果这个项目对你有帮助，请给个 ⭐ Star 支持一下！**

[![Star History Chart](https://api.star-history.com/svg?repos=776271052/claude-code-wechat-channel&type=Date)](https://star-history.com/#776271052/claude-code-wechat-channel&Date)

</div>
