import { Router, Request, Response } from 'express';
import { cozeApi } from '../services/cozeApi.js';

const router = Router();

/**
 * 删除知识库文件
 * DELETE /api/documents/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await cozeApi.deleteDocument([id]);
    
    res.json(result);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      error: true,
      message: error.response?.data?.msg || error.message
    });
  }
});

/**
 * 批量删除知识库文件
 * POST /api/documents/batch-delete
 */
router.post('/batch-delete', async (req: Request, res: Response) => {
  try {
    const { document_ids } = req.body;
    
    if (!document_ids || !Array.isArray(document_ids) || document_ids.length === 0) {
      return res.status(400).json({ error: true, message: '请提供要删除的文件ID' });
    }
    
    const result = await cozeApi.deleteDocument(document_ids);
    
    res.json(result);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      error: true,
      message: error.response?.data?.msg || error.message
    });
  }
});

/**
 * 查看文件上传进度
 * POST /api/documents/progress
 */
router.post('/progress', async (req: Request, res: Response) => {
  try {
    const { dataset_id, document_ids } = req.body;
    
    if (!dataset_id) {
      return res.status(400).json({ error: true, message: '请提供知识库ID' });
    }
    
    if (!document_ids || !Array.isArray(document_ids) || document_ids.length === 0) {
      return res.status(400).json({ error: true, message: '请提供文件ID' });
    }
    
    const result = await cozeApi.getDocumentProgress(dataset_id, document_ids);
    
    res.json(result);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      error: true,
      message: error.response?.data?.msg || error.message
    });
  }
});

/**
 * 更新文件信息
 * PUT /api/documents/:id
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    const result = await cozeApi.updateDocument(id, { name });
    
    res.json(result);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      error: true,
      message: error.response?.data?.msg || error.message
    });
  }
});

export default router;

