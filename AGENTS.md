# Knowledge Graph Explorer

## Cursor Cloud specific instructions

### Architecture

- **Backend**: Express + TypeScript server at `server/` (default port 3001, via `tsx watch`)
- **Frontend**: React + Vite SPA at `client/` (port 5173, proxies `/api` to backend)
- **No database**: data stored as local JSON files in `server/data/`
- **External dependency**: Coze API (`api.coze.cn`) — requires credentials in `server/.env`

### Running in dev mode

```bash
npm run dev          # starts both server (port 3001) and client (port 5173) via concurrently
npm run server       # server only
npm run client       # client only
```

See `README.md` for full details.

### Environment files (.env)

- **Style**: 各类 `.env` / `.env.example` 使用**纯键值**，**不写注释**；变量含义与排错见 `README.md` 对应小节。
- **`server/.env`**: 主站后端与知识图谱；**`news-sync-service/.env`**: 融媒同步专用，勿混用。

### News sync Coze 分段

- 默认 `COZE_CHUNK_MODE=auto`：`chunk_type=1`（自动分段与清洗）。改纯自定义：`COZE_CHUNK_MODE=custom`。

### News sync crontab（改时间）

- 定时任务由 **`news-sync-service/run-cron.sh`** 执行；`CRON_SCHEDULE` 仅在执行 **`npm run news-sync:setup`** **新写入** crontab 时生效。
- 若已装过 cron，仅改 `.env` **不会**自动改系统里的时间，需二选一：**`crontab -e`** 把时间改成与 `.env` 一致（如 `0 8 * * *`）；或删掉含 `run-cron.sh` / `# aiyanglao-news-sync-service` 的旧行后再跑一次 **`npm run news-sync:setup`**。

### Important caveats

- The Vite proxy in `client/vite.config.ts` targets `http://localhost:3001`. The server `PORT` in `server/.env` **must** be set to `3001` for development, otherwise the frontend cannot reach the backend API.
- Knowledge extraction (`POST /api/graph/extract`) calls the Coze API and requires valid `COZE_API_TOKEN`, `COZE_SPACE_ID`, `KNOWLEDGE_DATASET_IDS`, and `COZE_BOT_ID` in `server/.env`. Without these, graph data viewing still works if cached data exists in `server/data/`.
- TypeScript check: use `npx tsc --noEmit` in both `server/` and `client/` directories. Do not use `tsc -b --noEmit` in `client/` as it conflicts with the referenced project config.
- The build command (`npm run build`) only builds the client. Server uses `tsx` in dev and `tsc` + `node dist/index.js` in production.
