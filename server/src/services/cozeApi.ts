import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';

// 确保在模块加载时就加载环境变量
dotenv.config();

const COZE_API_BASE = 'https://api.coze.cn';

class CozeApiService {
  private client: AxiosInstance;
  private spaceId: string;

  constructor() {
    const token = process.env.COZE_API_TOKEN;
    this.spaceId = process.env.COZE_SPACE_ID || '';

    if (!token) {
      console.warn('⚠️ COZE_API_TOKEN is not set in environment variables');
    } else {
      console.log('✅ COZE_API_TOKEN loaded successfully');
    }

    if (!this.spaceId) {
      console.warn('⚠️ COZE_SPACE_ID is not set in environment variables');
    } else {
      console.log('✅ COZE_SPACE_ID:', this.spaceId);
    }

    this.client = axios.create({
      baseURL: COZE_API_BASE,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Agw-Js-Conv': 'str'
      }
    });

    // 响应拦截器
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('Coze API Error:', error.response?.data || error.message);
        throw error;
      }
    );
  }

  getSpaceId(): string {
    return this.spaceId;
  }

  // ==================== 知识库操作 ====================

  /**
   * 获取知识库列表
   */
  async listDatasets(params?: {
    name?: string;
    format_type?: number;
    page_num?: number;
    page_size?: number;
  }) {
    const response = await this.client.get('/v1/datasets', {
      params: {
        space_id: this.spaceId,
        ...params
      }
    });
    return response.data;
  }

  /**
   * 创建知识库
   */
  async createDataset(data: {
    name: string;
    description?: string;
    format_type?: number; // 0: 文本类型, 2: 图片类型
    icon?: string;
  }) {
    const response = await this.client.post('/v1/datasets', {
      space_id: this.spaceId,
      ...data
    });
    return response.data;
  }

  /**
   * 修改知识库信息
   */
  async updateDataset(datasetId: string, data: {
    name?: string;
    description?: string;
    icon?: string;
  }) {
    const response = await this.client.put(`/v1/datasets/${datasetId}`, data);
    return response.data;
  }

  /**
   * 删除知识库
   */
  async deleteDataset(datasetId: string) {
    const response = await this.client.delete(`/v1/datasets/${datasetId}`);
    return response.data;
  }

  // ==================== 知识库文件操作 ====================

  /**
   * 获取知识库文件列表
   * 注意：这是 POST 请求，参数放在 body 中
   */
  async listDocuments(datasetId: string, params?: {
    page?: number;
    size?: number;
  }) {
    const response = await this.client.post('/open_api/knowledge/document/list', {
      dataset_id: datasetId,
      page: params?.page || 1,
      size: params?.size || 100
    });
    return response.data;
  }

  /**
   * 创建知识库文件（上传文件）
   */
  async createDocument(data: {
    dataset_id: string;
    document_bases: Array<{
      name: string;
      source_info: {
        file_base64?: string;
        file_type?: string;
        web_url?: string;
        document_source: number; // 0: 本地文件, 1: 在线网页, 5: 图片
        source_file_id?: string;
      };
      update_rule?: {
        update_interval?: number;
        update_type?: number;
      };
    }>;
    chunk_strategy?: {
      chunk_type?: number;
      separator?: string;
      max_tokens?: number;
      remove_extra_spaces?: boolean;
      remove_urls_emails?: boolean;
    };
    format_type?: number;
  }) {
    const response = await this.client.post('/open_api/knowledge/document/create', data);
    return response.data;
  }

  /**
   * 删除知识库文件
   */
  async deleteDocument(documentIds: string[]) {
    const response = await this.client.post('/open_api/knowledge/document/delete', {
      document_ids: documentIds
    });
    return response.data;
  }

  /**
   * 查看文件上传进度
   * POST /v1/datasets/{dataset_id}/process
   */
  async getDocumentProgress(datasetId: string, documentIds: string[]) {
    const response = await this.client.post(`/v1/datasets/${datasetId}/process`, {
      document_ids: documentIds
    });
    return response.data;
  }

  /**
   * 更新知识库文件（修改文件名等）
   */
  async updateDocument(documentId: string, data: {
    name?: string;
  }) {
    const response = await this.client.put(`/open_api/knowledge/document/${documentId}`, data);
    return response.data;
  }
}

export const cozeApi = new CozeApiService();
