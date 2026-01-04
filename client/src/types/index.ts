// 知识库类型
export interface Dataset {
  dataset_id: string;
  name: string;
  description?: string;
  format_type: number; // 0: 文本类型, 2: 图片类型
  icon?: string;
  icon_url?: string;
  doc_count?: number;
  create_time?: number;
  update_time?: number;
  status?: number;
  slice_count?: number;
  file_list?: string[];
}

// 知识库文件类型
export interface Document {
  document_id: string;
  name: string;
  char_count?: number;
  slice_count?: number;
  create_time?: number;
  update_time?: number;
  status?: number; // 0: 处理中, 1: 处理完成, 9: 处理失败
  source_type?: number; // 0: 本地文件, 1: 在线网页
  type?: string;
  size?: number;
  hit_count?: number;
  format_type?: number;
  web_url?: string;
  preview_tos_url?: string;
}

// Coze API 知识库列表响应
export interface DatasetListResponse {
  code?: number;
  msg?: string;
  data?: {
    total_count?: number;
    dataset_list?: Dataset[];
  };
}

// Coze API 文件列表响应
export interface DocumentListResponse {
  code?: number;
  msg?: string;
  document_infos?: Document[];
  total?: number;
}

// 通用 API 响应类型
export interface ApiResponse<T> {
  code?: number;
  msg?: string;
  data?: T;
  error?: boolean;
  message?: string;
}

// 分页响应
export interface PaginatedResponse<T> {
  total?: number;
  total_count?: number;
  data?: T[];
  dataset_list?: T[];
  document_infos?: T[];
}

// 上传文件的源信息
export interface SourceInfo {
  file_base64?: string;
  file_type?: string;
  web_url?: string;
  document_source: number; // 0: 本地文件, 1: 在线网页, 5: 图片
  source_file_id?: string;
}

// 文件上传基础信息
export interface DocumentBase {
  name: string;
  source_info: SourceInfo;
  update_rule?: {
    update_interval?: number;
    update_type?: number;
  };
}

// 分段策略
export interface ChunkStrategy {
  chunk_type?: number; // 0: 自动分段, 1: 自定义
  separator?: string;
  max_tokens?: number;
  remove_extra_spaces?: boolean;
  remove_urls_emails?: boolean;
}

// 创建知识库请求
export interface CreateDatasetRequest {
  name: string;
  description?: string;
  format_type?: number;
  icon?: string;
}

// 上传文件请求
export interface UploadDocumentRequest {
  document_bases: DocumentBase[];
  chunk_strategy?: ChunkStrategy;
  format_type?: number;
}
