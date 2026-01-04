import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import datasetRoutes from './routes/datasets.js';
import documentRoutes from './routes/documents.js';

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API 路由
app.use('/api/datasets', datasetRoutes);
app.use('/api/documents', documentRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Coze Knowledge Manager API is running' });
});

// 错误处理中间件
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({ 
    error: true, 
    message: err.message || 'Internal Server Error' 
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📚 Coze Knowledge Manager API ready`);
});

