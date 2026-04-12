# 部署教程 - Vercel 云端部署

---

## 📖 教程概述

本教程将指导你如何将 Ozon rFBS 利润计算器部署到 Vercel 云平台，实现：

- ✅ 在线访问（无需本地环境）
- ✅ 手机、平板、电脑都能用
- ✅ 自动 HTTPS 加密
- ✅ 完全免费（个人使用）

---

## 📋 准备工作

### 1. 下载项目代码

**方式一：直接下载 ZIP**

1. 获取项目源码压缩包
2. 解压到本地目录（如：`D:\ozon-calculator`）

**方式二：使用 Git 克隆**

```bash
git clone [项目Git地址]
cd ozon-calculator
```

---

### 2. 注册 GitHub 账号

如果还没有 GitHub 账号：

1. 访问：https://github.com
2. 点击右上角 **"Sign Up"** 按钮
3. 填写邮箱、密码、用户名
4. 完成邮箱验证
5. 登录 GitHub

---

## 🚀 部署步骤

### 步骤 1：创建 GitHub 仓库

1. **登录 GitHub**

   - 访问：https://github.com
   - 输入用户名和密码登录

2. **创建新仓库**

   - 点击右上角的 **"+"** 号
   - 选择 **"New repository"**

3. **填写仓库信息**

   - **Repository name**：`ozon-rfbs-calculator`（或自定义名称）
   - **Description**：（可选）填写项目描述
   - **可见性**：选择 **Public**（公开）或 **Private**（私有）
   - **注意**：Vercel 免费版支持公开和私有仓库
   
4. **点击 "Create repository"**

---

### 步骤 2：上传代码到 GitHub

#### 方式一：使用 GitHub Desktop（推荐新手）

1. **下载安装 GitHub Desktop**
   - 访问：https://desktop.github.com
   - 下载并安装

2. **登录 GitHub 账号**
   - 打开 GitHub Desktop
   - File → Options → Accounts → Sign in

3. **添加本地仓库**
   - File → Add local repository
   - 选择项目解压的目录（如：`D:\ozon-calculator`）
   - 点击 "Add repository"

4. **提交代码**
   - 在左下角输入提交信息：`初始化项目`
   - 点击 **"Commit to master"** 按钮

5. **推送到 GitHub**
   - 点击 **"Publish repository"** 按钮
   - 确认仓库名称
   - 点击 **"Publish repository"**

---

#### 方式二：使用命令行

1. **打开命令行工具**
   - Windows: 按 `Win + R`，输入 `cmd`，按 Enter
   - Mac: 打开"终端"应用

2. **进入项目目录**
   ```bash
   cd ozon-calculator
   ```

3. **初始化 Git 仓库**
   ```bash
   git init
   ```

4. **添加远程仓库**
   ```bash
   git remote add origin https://github.com/你的用户名/ozon-rfbs-calculator.git
   ```

5. **添加所有文件**
   ```bash
   git add .
   ```

6. **提交代码**
   ```bash
   git commit -m "初始化项目"
   ```

7. **推送到 GitHub**
   ```bash
   git push -u origin master
   ```

   如果提示输入用户名和密码：
   - Username: 输入你的 GitHub 用户名
   - Password: 输入你的 GitHub Personal Access Token（不是密码）
     - 获取 Token: GitHub → Settings → Developer settings → Personal access tokens → Generate new token

---

### 步骤 3：注册 Vercel 账号

1. **访问 Vercel 官网**

   - 打开浏览器
   - 访问：https://vercel.com

2. **使用 GitHub 登录**

   - 点击右上角 **"Sign Up"** 按钮
   - 选择 **"Continue with GitHub"**
   - 在弹出的授权页面，点击 **"Authorize Vercel"**
   - 登录成功后会自动跳转到 Vercel 控制台

---

### 步骤 4：导入 GitHub 项目

1. **进入项目导入页面**

   - 登录 Vercel 后，会自动进入控制台首页
   - 点击右上角的 **"Add New..."** 按钮
   - 在下拉菜单中选择 **"Project"**

2. **选择 GitHub 仓库**

   - 在 "Import Git Repository" 页面
   - 找到你刚创建的仓库：`ozon-rfbs-calculator`
   - 点击该仓库右侧的 **"Import"** 按钮

   **如果找不到仓库**：
   - 点击 "Adjust GitHub App Permissions"
   - 授权 Vercel 访问你的 GitHub 仓库
   - 刷新页面后即可看到

---

### 步骤 5：配置项目

Vercel 会自动识别这是一个 Next.js 项目，配置如下：

**Framework Preset**: Next.js ✅（自动检测）

**Root Directory**: `./` ✅（默认，无需修改）

**Build Command**: `next build` ✅（自动填充）

**Output Directory**: `.next` ✅（自动填充）

**Install Command**: `npm install` ✅（自动填充）

**环境变量**：无需配置

---

### 步骤 6：开始部署

1. **点击部署按钮**

   - 在配置页面底部，点击 **"Deploy"** 按钮
   - 部署过程会开始

2. **等待部署完成**

   - 页面会显示构建日志
   - 整个过程大约 1-3 分钟
   - 日志中会显示：
     ```
     Installing dependencies...
     npm install
     
     Building...
     npm run build
     
     Generating static pages...
     ```

3. **部署成功**

   - 当看到 🎉 庆祝动画和 **"Congratulations!"** 时
   - 表示部署成功！

---

### 步骤 7：获取访问链接

1. **查看部署结果**

   - 点击 **"Continue to Dashboard"** 按钮
   - 进入项目控制台

2. **获取访问地址**

   - 在控制台顶部，你会看到项目的访问链接
   - 格式通常为：`https://你的项目名.vercel.app`
   - 或自定义域名：`https://你的域名.com`

3. **测试访问**

   - 点击链接，或复制到浏览器打开
   - 应该能看到应用界面

---

## 🎨 自定义域名（可选）

如果你有自己的域名，可以绑定到 Vercel：

### 1. 进入域名设置

- 在 Vercel 项目控制台
- 点击 **"Settings"** 标签
- 左侧菜单选择 **"Domains"**

### 2. 添加自定义域名

- 输入你的域名（如：`ozon.yourdomain.com`）
- 点击 **"Add"** 按钮

### 3. 配置 DNS 解析

Vercel 会提供 DNS 配置信息，通常需要：

- **A 记录**：指向 `76.76.21.21`
- **CNAME 记录**：指向 `cname.vercel-dns.com`

在你的域名服务商后台添加相应记录。

### 4. 等待生效

- DNS 解析需要几分钟到几小时
- 生效后，即可通过自定义域名访问

---

## 🔄 更新部署

当你修改代码后，如何更新线上版本？

### 自动部署（推荐）

如果你是通过 GitHub 导入的项目，Vercel 会自动部署：

1. **修改本地代码**

2. **提交到 GitHub**
   ```bash
   git add .
   git commit -m "更新说明"
   git push
   ```

3. **自动触发部署**
   - Vercel 会自动检测 GitHub 更新
   - 自动重新构建和部署
   - 通常 1-2 分钟完成

4. **查看部署日志**
   - Vercel 控制台 → 项目 → Deployments
   - 可以查看每次部署的日志和状态

---

### 手动触发部署

如果需要手动触发：

1. 进入 Vercel 项目控制台
2. 点击 **"Deployments"** 标签
3. 找到最新的部署记录
4. 点击右侧的 **"..."** 按钮
5. 选择 **"Redeploy"**

---

## 📊 监控与分析

### 查看访问统计

1. 进入项目控制台
2. 点击 **"Analytics"** 标签
3. 可以查看：
   - 访问量
   - 访问来源
   - 页面加载速度
   - 访问设备分布

### 查看运行日志

1. 进入项目控制台
2. 点击 **"Logs"** 标签
3. 可以查看：
   - 构建日志
   - 运行时日志
   - 错误日志

---

## 💰 费用说明

### Vercel 免费套餐包含：

- ✅ 无限项目部署
- ✅ 100GB 带宽/月
- ✅ 自动 HTTPS
- ✅ 自动 CI/CD
- ✅ 全球 CDN 加速

**个人使用完全免费！**

### 收费套餐：

- Pro: $20/月（团队协作、更多带宽）
- Enterprise: 定制（企业级支持）

**个人项目无需付费！**

---

## 🔐 安全与隐私

### 数据安全

- 所有计算在用户浏览器本地完成
- 不上传任何数据到服务器
- Vercel 只托管静态文件和代码

### HTTPS 加密

- 自动配置 SSL 证书
- 所有通信加密传输
- 防止中间人攻击

---

## 🛠️ 常见问题

### Q1：部署失败怎么办？

**A**：查看构建日志定位问题：

1. 进入 Vercel 项目控制台
2. 点击失败的部署记录
3. 查看 "Build Logs"
4. 常见错误：
   - `npm install` 失败：检查 package.json
   - `next build` 失败：检查代码语法
   - 超时：项目过大，优化代码

---

### Q2：如何回滚到旧版本？

**A**：

1. 进入 Vercel 项目控制台
2. 点击 "Deployments" 标签
3. 找到想要回滚的版本
4. 点击右侧 "..." 按钮
5. 选择 "Promote to Production"

---

### Q3：如何删除部署？

**A**：

1. 进入 Vercel 项目控制台
2. 点击 "Settings" 标签
3. 滚动到页面底部
4. 点击 "Delete Project"
5. 输入项目名称确认删除

---

### Q4：部署后页面空白？

**A**：检查以下几点：

1. **浏览器控制台错误**
   - 按 F12 打开开发者工具
   - 查看 Console 标签是否有错误

2. **构建配置**
   - 检查 `next.config.js` 是否有特殊配置
   - 确认 `package.json` 中的 scripts 正确

3. **环境变量**
   - 如果代码依赖环境变量，需在 Vercel 中配置
   - Settings → Environment Variables

---

### Q5：如何查看实际访问地址？

**A**：

- 方式 1：Vercel 控制台顶部显示
- 方式 2：项目 Settings → Domains
- 方式 3：部署成功页面显示

---

## 📞 技术支持

### Vercel 官方文档

- 官方文档：https://vercel.com/docs
- Next.js 部署：https://vercel.com/docs/frameworks/nextjs

### 社区支持

- Vercel Discord: https://vercel.com/discord
- GitHub Issues: 在项目仓库提交 Issue

---

## 🎉 部署完成！

恭喜你成功部署 Ozon rFBS 利润计算器！

现在你可以：

1. ✅ 通过访问链接使用应用
2. ✅ 在手机、平板、电脑上访问
3. ✅ 分享链接给团队成员
4. ✅ 修改代码后自动更新

---

**祝你使用愉快！** 🚀
