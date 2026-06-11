<div align="center">

# Claude Code WeChat Channel

**微信 ClawBot 连接助手 — 将微信消息桥接到 Claude Code / 远程 API**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)
[![Electron](https://img.shields.io/badge/Electron-42-blue.svg)](https://electronjs.org)
[![Release](https://img.shields.io/github/v/release/776271052/claude-code-wechat-channel)](https://github.com/776271052/claude-code-wechat-channel/releases)

</div>

---

## 功能

- **微信扫码登录** — 一键连接，无需配置
- **多 LLM 支持** — Claude CLI / OpenAI 兼容 / Anthropic API
- **智能模型发现** — 自动获取可用模型列表
- **实时消息** — 收发消息实时显示
- **权限管理** — 5 种权限模式
- **自动更新** — 检测新版本，下载并自动替换
- **精美 UI** — 现代化亮色主题

## 快速开始

### 下载

从 [Releases](https://github.com/776271052/claude-code-wechat-channel/releases) 下载 `Claude Code WeChat.exe`，双击运行。

### 使用

1. 启动应用，点击「扫码登录」
2. 使用微信扫描二维码
3. 配置 LLM 模式（CLI 或 API）
4. 点击「启动 Bot」

## 支持的 API

### 预设

| 提供商 | 协议 |
|--------|------|
| DeepSeek | OpenAI |
| 小米 MiMo | OpenAI / Anthropic |
| Anthropic | Anthropic |
| 月之暗面 | OpenAI |
| 智谱 GLM | OpenAI |
| 阿里通义 | OpenAI |

### 自定义

点击「+ 自定义」按钮，输入任意 OpenAI 兼容或 Anthropic API 地址。

## 配置

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `CLAUDE_CODE_CLI` | CLI 路径 | 自动检测 |
| `CLAUDE_CODE_TIMEOUT_MS` | 超时时间 | 600000 |

### 配置文件

存储在应用目录下的 `data/` 文件夹：

- `account.json` — 登录凭据
- `gui_settings.json` — 应用设置
- `context_tokens.json` — 会话令牌
- `sync_buf.txt` — 同步状态

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建 EXE
npm run package:win
```

## 技术栈

- Electron 42
- React 18
- TypeScript 5.6
- Vite 7
- Tailwind CSS 3.4
- shadcn/ui

## 更新日志

### v1.2.0
- 自定义 API 按钮
- 智能模型发现
- 自动更新下载并重启替换
- 移除 EXE 文件名中的版本号
- 优化 UI 布局和配色
- 修复多个 Bug

### v1.1.0
- 自定义 API 支持
- 模型下拉选择
- 重启提示
- 优化错误提示
- 检查更新改为直接获取 package.json

### v1.0.0
- 初始发布
- 微信扫码登录
- Claude CLI / API 支持
- 实时消息显示
- 权限管理
- 自动更新检查

## 许可证

MIT — 仅限非商业用途。

商业使用请联系版权所有者。

## 联系方式

- GitHub: [776271052](https://github.com/776271052)
- Issues: [提交问题](https://github.com/776271052/claude-code-wechat-channel/issues)
