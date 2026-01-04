import { Router, Request, Response } from 'express';
import { cozeApi } from '../services/cozeApi.js';

const router = Router();

/**
 * 获取知识库列表
 * GET /api/datasets
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { name, format_type, page_num, page_size } = req.query;
    
    const result = await cozeApi.listDatasets({
      name: name as string,
      format_type: format_type ? Number(format_type) : undefined,
      page_num: page_num ? Number(page_num) : 1,
      page_size: page_size ? Number(page_size) : 20
    });
    
    console.log('📋 Datasets API Response:', JSON.stringify(result, null, 2));
    
    res.json(result);
  } catch (error: any) {
    console.error('❌ Datasets API Error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: true,
      message: error.response?.data?.msg || error.message
    });
  }
});

/**
 * 创建知识库
 * POST /api/datasets
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, format_type, icon } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: true, message: '知识库名称不能为空' });
    }
    
    const result = await cozeApi.createDataset({
      name,
      description,
      format_type: format_type || 0,
      icon
    });
    
    res.json(result);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      error: true,
      message: error.response?.data?.msg || error.message
    });
  }
});

/**
 * 修改知识库信息
 * PUT /api/datasets/:id
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, icon } = req.body;
    
    const result = await cozeApi.updateDataset(id, {
      name,
      description,
      icon
    });
    
    res.json(result);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      error: true,
      message: error.response?.data?.msg || error.message
    });
  }
});

/**
 * 删除知识库
 * DELETE /api/datasets/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await cozeApi.deleteDataset(id);
    
    res.json(result);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      error: true,
      message: error.response?.data?.msg || error.message
    });
  }
});

/**
 * 获取知识库文件列表
 * GET /api/datasets/:id/documents
 */
router.get('/:id/documents', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { page, size } = req.query;
    
    const result = await cozeApi.listDocuments(id, {
      page: page ? Number(page) : 1,
      size: size ? Number(size) : 100
    });
    
    console.log('📄 Documents API Response:', JSON.stringify(result, null, 2));
    
    res.json(result);
  } catch (error: any) {
    console.error('❌ Documents API Error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: true,
      message: error.response?.data?.msg || error.message
    });
  }
});

/**
 * 上传文件到知识库
 * POST /api/datasets/:id/documents
 */
router.post('/:id/documents', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { document_bases, chunk_strategy, format_type } = req.body;
    
    if (!document_bases || !Array.isArray(document_bases) || document_bases.length === 0) {
      return res.status(400).json({ error: true, message: '请提供要上传的文件信息' });
    }
    
    if (document_bases.length > 10) {
      return res.status(400).json({ error: true, message: '每次最多上传10个文件' });
    }
    
    const result = await cozeApi.createDocument({
      dataset_id: id,
      document_bases,
      chunk_strategy,
      format_type
    });
    
    res.json(result);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      error: true,
      message: error.response?.data?.msg || error.message
    });
  }
});

export default router;

