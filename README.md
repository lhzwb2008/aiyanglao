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

## 新闻同步（news-sync-service）

从**融媒网关**按时间窗拉取稿件，按稿件 ID 去重后，将**增量**合并成文本并上传到 **Coze 知识库**。定时任务由 **`run-cron.sh`** 执行（`npm run sync`，日志在 `news-sync-service/logs/sync.log`），**不要**在 crontab 里手抄长命令。

### 配置

1. 复制环境变量（与根目录 `server/.env` **分开**）：

   ```bash
   cp news-sync-service/.env.example news-sync-service/.env
   ```

2. 在 `news-sync-service/.env` 中填写网关与 Coze 等变量，说明见 `.env.example`。可选 **`CRON_SCHEDULE`**（五段式，默认 **`0 8 * * *`** 每天 8:00），仅用于「一键安装定时任务」。**已装过旧 cron（如凌晨 2 点）不会自动改**，需 `crontab -e` 改时间或删掉旧行后重新 `news-sync:setup`。

3. 安装依赖：仓库根目录 `npm run install:all`，或 `cd news-sync-service && npm install`。

### 筛选项与「接口 0 条」排查（重要）

- **`SYNC_DAYS` 不是「全历史」**：只是一次查询的时间窗；要更久需调大或多次跑。
- **`MEDIA_TYPES` + `MEDIA_LEVELS` 为 AND 关系**：两者须**同时**命中接口索引。曾用 `融媒APP` + `上海市` 时，网关侧交集为 **0**（与「仅时间窗不筛选」能出数百万条」不矛盾）。
- **推荐**：全量融媒 APP 稿件时 **`MEDIA_LEVELS` 留空**（不按层级筛），只保留 `MEDIA_TYPES=融媒APP`。若必须按市/区筛，请向网关方要**与库内字段一致的枚举**，勿凭感觉填「上海市」。
- **`MAX_PAGES` × `PAGE_SIZE`** 为单次同步条数上限（默认 50×50=2500）；数据多时请提高 `MAX_PAGES` 或缩小 `SYNC_DAYS` 分批跑。
- 诊断脚本（在 `news-sync-service` 下）：`npm run probe:variants`、`npm run probe:sample`（会请求真实网关，勿在 CI 随意跑）。

### 推荐：安装定时任务并立即同步一次

在 **`news-sync-service` 目录**执行 `npm run setup`（或 `npm start`，等价），或在**仓库根目录**执行：

```bash
npm run news-sync:setup
```

行为：

1. **幂等**检查当前用户 `crontab`：若已存在指向本目录 **`run-cron.sh`** 的一行，则**不再追加**。
2. 否则写入一行：`$CRON_SCHEDULE /bin/bash <本目录绝对路径>/run-cron.sh`。
3. **立刻**再执行一次 `npm run sync`（见下方「首次同步时间窗」）。

**首次同步时间窗**：本地 **`data/synced_ids.json` 为空**且 **`FIRST_SYNC_TODAY_ONLY` 未设为 `0`** 时，只拉 **当日 0 点～当前时间** 的稿件（便于当天就有可检索内容）；第二次起按 **`SYNC_DAYS`** 拉「最近若干天至当天 23:59」。时区默认 **`Asia/Shanghai`**（`run-cron.sh` 与进程内均已处理）。**`purge-and-resync`** 清空后会按 **完整 `SYNC_DAYS` 窗口**拉取，不会只用「今天」。

之后改调度只需编辑 `.env` 里的 `CRON_SCHEDULE` 并**再执行一次** `npm run news-sync:setup`（会先检测到已有 `run-cron.sh` 任务而跳过重复行；若需更新 cron 表达式，请先 `crontab -e` 删掉旧行或含 `# aiyanglao-news-sync-service` 的块，再运行 setup）。更省事可直接 `crontab -e` 改时间。

### 仅手动跑一轮（不装 cron）

```bash
npm run news-sync
```

### 清空知识库并重新拉取（换筛选条件/全量重来）

会删除 **`COZE_DATASET_ID` 对应知识库中的全部文件**，并清空本地 `synced_ids.json`，再执行与 `sync` 相同的逻辑。**务必确认 dataset 无误。**

```bash
cd news-sync-service && CONFIRM_PURGE=1 npm run purge-and-resync
```

或根目录：`CONFIRM_PURGE=1 npm run news-sync:purge-and-resync`。

说明：融媒接口按时间窗查询，单次同步覆盖**最近 `SYNC_DAYS` 个自然日**；若要更长历史，可临时增大 `SYNC_DAYS` 或分多次跑。

**若只在扣子控制台删了知识库文件、没有用 `purge-and-resync`**：本地 `news-sync-service/data/synced_ids.json` 仍会记录「已同步」，下一轮会把这些 ID 当旧稿**跳过上传**，与空知识库不一致。此时应单独清空本地记录：

```bash
npm run news-sync:clear-synced-ids
```

根目录也支持短别名：`npm run clear-synced-ids`（与上一行等价）。在 `news-sync-service` 目录下可直接：`npm run clear-synced-ids`。

若服务器提示 `Missing script`，说明仓库未更新到含这些脚本的版本，请在服务器上 **`git pull`** 后再执行。清空知识库并重拉：根目录 `CONFIRM_PURGE=1 npm run news-sync:purge-and-resync` 或短别名 `CONFIRM_PURGE=1 npm run purge-and-resync`。

### 服务器上查看拉取日志

**由 crontab 调 `run-cron.sh` 的同步**，标准输出与错误都会**追加**到：

`news-sync-service/logs/sync.log`

在服务器上（路径按你的仓库根目录调整）：

```bash
# 持续跟踪最新日志（最常用）
tail -f ~/aiyanglao/news-sync-service/logs/sync.log

# 只看末尾 100 行
tail -n 100 ~/aiyanglao/news-sync-service/logs/sync.log

# 搜错误
grep -i error ~/aiyanglao/news-sync-service/logs/sync.log
```

**在终端手动执行** `npm run news-sync` / `news-sync:setup` 时，日志默认只在当前终端，**不会**自动写入 `sync.log`。若也要落盘，可自行：`npm run news-sync >> news-sync-service/logs/manual.log 2>&1`。

**前台 vs crontab**：在 SSH 里跑 `npm run news-sync` 是**前台进程**，关掉终端或按 **Ctrl+C** 会中断本次同步；**不会**关掉系统里的 crontab。定时任务由 **`cron` 守护进程**在后台调 `run-cron.sh`，与当前是否登录 SSH **无关**。长时间手工同步可：`cd news-sync-service && nohup npm run sync >> logs/manual.log 2>&1 &`。

### 知识库分段（扣子侧）

上传的 txt 使用**自定义分段**：以 `<<NEWS_ITEM>>` 为界先按篇切开；**此外**扣子仍会用 `max_tokens`（环境变量 **`CHUNK_MAX_TOKENS`**，默认 **32000**）限制单段长度——若设得太小（例如 2000），**长稿会在一篇内被再切几段**，看起来就像「有的按篇、有的切碎」。极长正文仍可能超过上限，属平台限制；可再调大 `CHUNK_MAX_TOKENS` 试到接口接受的上限。旧文件若仍显示 `###NEWS_ITEM###` 等，需删文档后重新同步生成新文件。

### 控制台里「知识库是空的」但脚本显示已上传

1. **核对 `COZE_DATASET_ID`**：须与浏览器地址栏里该知识库 URL 中 `knowledge/` 后的数字**完全一致**；`COZE_API_TOKEN` 须为能访问该空间的令牌（PAT/服务令牌）。
2. **用 API 列文档**（与脚本同一 `.env`）：在仓库根目录执行 `npm run news-sync:list-dataset`，应能看到 `融媒增量-*.txt`。若这里有而网页没有，多半是**登错空间/看错知识库**；若这里也没有，说明**未上传成功或未跑完**（勿在「上传完成」前 `Ctrl+C`）。
3. 大文件入库后，控制台可能**延迟几秒再出分段**，刷新页面后再看。

### 「重启」说明

- 无常驻进程；**改 `.env` 后**定时仍由 cron 调 `run-cron.sh`，若需立刻生效可再执行 `npm run news-sync`。
- 若 cron 里 `npm` 找不到，在 **`run-cron.sh`** 中取消 **nvm** 相关注释，或保证系统 PATH 含 Node。

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
├── news-sync-service/  # 融媒 → Coze 知识库增量同步（见上文「新闻同步」）
└── package.json
```
