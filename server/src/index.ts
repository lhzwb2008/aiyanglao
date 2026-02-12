import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import graphRoutes from './routes/graph.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API 路由
app.use('/api/graph', graphRoutes);

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'Knowledge Graph API is running',
    datasetIds: process.env.KNOWLEDGE_DATASET_IDS || process.env.KNOWLEDGE_DATASET_ID,
  });
});

// 生产环境：托管前端静态文件
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res, next) => {
  // 不拦截 /api 开头的请求
  if (_req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'));
});

// 错误处理
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: true, message: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Knowledge Graph Server running on http://localhost:${PORT}`);
  const ids = (process.env.KNOWLEDGE_DATASET_IDS || process.env.KNOWLEDGE_DATASET_ID || '').split(',').filter(Boolean);
  console.log(`📊 Dataset IDs (${ids.length}): ${ids.join(', ')}`);
});
