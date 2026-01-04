# Coze 知识库管理系统

一个基于 Coze API 的知识库文件管理系统，支持文件的增删改查操作，可嵌入 iframe 使用。

## 功能特性

- 📄 **文件管理**
  - 查看文件列表（支持搜索、分页）
  - 上传本地文件（支持 PDF、TXT、DOC、DOCX、MD）
  - 上传在线网页
  - 批量删除文件
  - 查看文件上传进度

- 🎨 **现代 UI**
  - 深色主题，玻璃拟态设计
  - 支持 iframe 嵌入
  - 响应式布局

## 技术栈

- **前端**: React 18 + TypeScript + Vite + Tailwind CSS
- **后端**: Node.js + Express + TypeScript
- **API**: Coze Open API

## 快速开始

### 方式一：一键安装（推荐）

```bash
# 克隆项目后，运行安装脚本
./scripts/install.sh

# 或使用 npm
npm run setup
```

### 方式二：手动安装

```bash
# 安装所有依赖
npm run install:all
```

## 配置

编辑 `server/.env` 文件：

```env
# Coze API Token
# 获取方式: https://www.coze.cn/open/oauth/pats
COZE_API_TOKEN=your_coze_api_token_here

# 工作空间 ID
# 从 Coze 工作空间 URL 获取: https://www.coze.cn/space/{SPACE_ID}/...
COZE_SPACE_ID=your_space_id_here

# 服务器端口
PORT=3001
```

## 启动服务

### 开发环境

```bash
npm run dev
```

- 前端: `http://localhost:5173`
- 后端: `http://localhost:3001`

### 生产部署

```bash
# 一键部署（默认端口 3000）
npm run deploy

# 指定端口
./scripts/deploy.sh 8080

# 启动生产服务
npm run start
```

#### 使用 PM2（推荐）

```bash
# 安装 PM2
npm install -g pm2

# 部署
npm run deploy

# 使用 PM2 启动
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 访问方式

### URL 格式

```
http://localhost:5173/{知识库ID}
```

或

```
http://localhost:5173/?knowledge_id={知识库ID}
```

### 示例

```
http://localhost:5173/7588493565027942463
```

### iframe 嵌入

```html
<iframe 
  src="http://your-domain.com/7588493565027942463"
  width="100%"
  height="600"
  frameborder="0"
></iframe>
```

## 项目结构

```
aiyanglao/
├── client/                 # 前端 React 应用
│   ├── src/
│   │   ├── components/     # React 组件
│   │   ├── services/       # API 服务
│   │   ├── types/          # TypeScript 类型定义
│   │   └── App.tsx         # 主应用组件
│   └── ...
├── server/                 # 后端 Node.js 服务
│   ├── src/
│   │   ├── routes/         # API 路由
│   │   ├── services/       # Coze API 服务
│   │   └── index.ts        # 服务器入口
│   └── .env                # 环境配置
├── scripts/
│   ├── install.sh          # 安装脚本
│   └── deploy.sh           # 部署脚本
├── ecosystem.config.js     # PM2 配置（部署后生成）
├── start-production.sh     # 生产启动脚本（部署后生成）
└── README.md
```

## 脚本命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run setup` | 一键安装所有依赖 |
| `npm run deploy` | 一键部署生产环境 |
| `npm run start` | 启动生产服务 |
| `npm run build` | 构建前端 |
| `npm run install:all` | 安装所有依赖 |

## API 接口

### 知识库文件接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/datasets/:id/documents | 获取文件列表 |
| POST | /api/datasets/:id/documents | 上传文件 |
| DELETE | /api/documents/:id | 删除文件 |
| GET | /api/documents/:id/progress | 查看上传进度 |

## 注意事项

1. 请确保你的 Coze API Token 具有相应的权限
2. 每次最多可上传 10 个文件
3. 支持的文件格式：PDF、TXT、DOC、DOCX、MD
4. 文件大小限制请参考 Coze 官方文档

## License

MIT
