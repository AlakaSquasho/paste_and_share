# Paste and Share

一个简单高效的基于 Web 的工具，用于在局域网内的设备之间共享文本和文件。

[English README](./README_en.md)

## 功能特性

- **共享剪贴板**：在手机、平板和电脑之间即时共享文本。
- **文件共享**：轻松上传和下载文件。
- **深色模式**：支持浅色、深色和基于系统设置的主题切换。
- **Docker 支持**：支持使用 Docker Compose 快速部署。

## 快速开始

### 前提条件

- [Docker](https://www.docker.com/) 和 [Docker Compose](https://docs.docker.com/compose/)

### 安装与运行

1. 克隆仓库：
   ```bash
   git clone https://github.com/AlakaSquasho/paste_and_share.git
   cd paste_and_share
   ```

2. 启动应用：
   ```bash
   docker-compose up -d --build
   ```

3. 访问应用：
   - 前端界面：[http://localhost:8080](http://localhost:8080)
   - 后端 API：[http://localhost:3000](http://localhost:3000)

## 安全特性

为保障公网部署的安全性，本项目已集成以下防护措施：

- **频率限制 (Rate Limiting)**：针对登录接口及全局 API 进行了频率限制，防止暴力破解。
- **防爆破延迟**：登录验证引入了人为延迟，增加攻击者时间成本。
- **Bcrypt 支持**：支持在环境变量中使用 Bcrypt 哈希值作为密码。
- **访问审计日志**：自动记录所有访问者的 IP、请求路径及状态，日志存储在服务器本地（`server/logs/access.log`）。

## 配置说明

您可以在 `docker-compose.yml` 中自定义以下环境变量：

- `SHARED_PASSWORD`：访问所需的密码。支持明文或 Bcrypt 哈希值（推荐）。
- `JWT_SECRET`：用于身份验证 Token 的密钥。请务必修改。

### 生成安全密码哈希

建议使用哈希值而非明文：
```bash
node -e "console.log(require('bcryptjs').hashSync('你的密码', 10))"
```
将生成的 `$2a$...` 字符串填入 `SHARED_PASSWORD`。

## 技术栈

- **前端**：React, TypeScript, Tailwind CSS, Vite.
- **后端**：Node.js, Express, Prisma.
- **数据库**：SQLite.
- **部署**：Nginx, Docker.

## 开源协议

本项目采用 MIT 协议。
