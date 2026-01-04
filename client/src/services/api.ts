import axios from 'axios';
import type { 
  Dataset, 
  Document, 
  DatasetListResponse,
  DocumentListResponse,
  ApiResponse,
  CreateDatasetRequest,
  UploadDocumentRequest
} from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// 响应拦截器
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.message || error.message || '请求失败';
    return Promise.reject(new Error(message));
  }
);

// ==================== 知识库 API ====================

/**
 * 获取知识库列表
 */
export async function getDatasets(params?: {
  name?: string;
  format_type?: number;
  page_num?: number;
  page_size?: number;
}): Promise<DatasetListResponse> {
  return api.get('/datasets', { params });
}

/**
 * 创建知识库
 */
export async function createDataset(data: CreateDatasetRequest): Promise<ApiResponse<Dataset>> {
  return api.post('/datasets', data);
}

/**
 * 修改知识库信息
 */
export async function updateDataset(
  id: string, 
  data: Partial<CreateDatasetRequest>
): Promise<ApiResponse<Dataset>> {
  return api.put(`/datasets/${id}`, data);
}

/**
 * 删除知识库
 */
export async function deleteDataset(id: string): Promise<ApiResponse<void>> {
  return api.delete(`/datasets/${id}`);
}

// ==================== 知识库文件 API ====================

/**
 * 获取知识库文件列表
 */
export async function getDocuments(
  datasetId: string,
  params?: { page?: number; size?: number }
): Promise<DocumentListResponse> {
  return api.get(`/datasets/${datasetId}/documents`, { params });
}

/**
 * 上传文件到知识库
 */
export async function uploadDocuments(
  datasetId: string,
  data: UploadDocumentRequest
): Promise<ApiResponse<{ document_infos: Document[] }>> {
  return api.post(`/datasets/${datasetId}/documents`, data);
}

/**
 * 删除知识库文件
 */
export async function deleteDocument(id: string): Promise<ApiResponse<void>> {
  return api.delete(`/documents/${id}`);
}

/**
 * 批量删除知识库文件
 */
export async function batchDeleteDocuments(ids: string[]): Promise<ApiResponse<void>> {
  return api.post('/documents/batch-delete', { document_ids: ids });
}

/**
 * 获取文件上传进度
 */
export async function getDocumentProgress(
  ids: string[]
): Promise<ApiResponse<{ documents: Document[] }>> {
  return api.get('/documents/progress', { 
    params: { document_ids: ids.join(',') } 
  });
}

/**
 * 将文件转换为 Base64
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // 移除 data:xxx;base64, 前缀
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
}

/**
 * 获取文件扩展名
 */
export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}
