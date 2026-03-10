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

### Important caveats

- The Vite proxy in `client/vite.config.ts` targets `http://localhost:3001`. The server `PORT` in `server/.env` **must** be set to `3001` for development, otherwise the frontend cannot reach the backend API.
- Knowledge extraction (`POST /api/graph/extract`) calls the Coze API and requires valid `COZE_API_TOKEN`, `COZE_SPACE_ID`, `KNOWLEDGE_DATASET_IDS`, and `COZE_BOT_ID` in `server/.env`. Without these, graph data viewing still works if cached data exists in `server/data/`.
- TypeScript check: use `npx tsc --noEmit` in both `server/` and `client/` directories. Do not use `tsc -b --noEmit` in `client/` as it conflicts with the referenced project config.
- The build command (`npm run build`) only builds the client. Server uses `tsx` in dev and `tsc` + `node dist/index.js` in production.
