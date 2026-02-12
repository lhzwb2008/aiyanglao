# Knowledge Graph Explorer

基于 Coze 知识库的知识图谱抽取与 3D 可视化展示工具。

通过 LLM 大模型从知识库文档中自动抽取实体和关系，以酷炫的 3D 力导向图形式展示知识图谱。

## 技术栈

- **前端**: React + TypeScript + Tailwind CSS + react-force-graph-3d (Three.js)
- **后端**: Express + TypeScript
- **知识抽取**: Coze LLM API
- **数据存储**: 本地 JSON 文件

## 快速开始

### 1. 安装依赖

```bash
npm run install:all
```

### 2. 配置环境变量

编辑 `server/.env`：

```env
COZE_API_TOKEN=your_coze_service_token
COZE_SPACE_ID=your_space_id
KNOWLEDGE_DATASET_ID=your_dataset_id
LLM_MODEL_ID=doubao-1-5-pro-256k-250115
PORT=3001
```

### 3. 启动开发

```bash
npm run dev
```

访问 http://localhost:5173 即可查看知识图谱。

## 功能

- 从 Coze 知识库自动抽取文档中的实体和关系
- 3D 力导向图展示，支持旋转、缩放、拖拽
- 节点按类型着色（人物、技术、概念、组织等）
- 节点悬浮信息展示
- 点击节点聚焦并查看关联详情
- 增量/全量抽取，结果缓存到本地
- 实时抽取进度展示
- 统计面板：类型分布、核心实体排行

## 项目结构

```
├── client/          # React 前端
│   └── src/
│       ├── components/
│       │   ├── KnowledgeGraph3D.tsx   # 3D 图谱组件
│       │   └── StatsPanel.tsx         # 统计侧边栏
│       ├── services/api.ts            # API 客户端
│       ├── types/index.ts             # 类型定义
│       └── App.tsx                    # 入口
├── server/          # Express 后端
│   ├── data/        # 图谱数据存储（自动生成）
│   └── src/
│       ├── routes/graph.ts            # 图谱 API
│       └── services/
│           ├── cozeApi.ts             # Coze API 服务
│           ├── graphStore.ts          # 图谱本地存储
│           └── knowledgeExtractor.ts  # 知识抽取引擎
└── package.json
```
