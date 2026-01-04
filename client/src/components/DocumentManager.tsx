import { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  RefreshCw, 
  FileText,
  Globe,
  Upload,
  X,
  Check,
  Clock,
  CheckCircle2,
  XCircle,
  FolderOpen,
  Search
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  getDocuments, 
  uploadDocuments, 
  deleteDocument,
  fileToBase64,
  getFileExtension
} from '../services/api';
import type { Document, DocumentBase } from '../types';

interface Props {
  datasetId: string;
}

const SUPPORTED_EXTENSIONS = ['pdf', 'txt', 'doc', 'docx', 'md'];

export default function DocumentManager({ datasetId }: Props) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadType, setUploadType] = useState<'file' | 'url'>('file');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [webUrl, setWebUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      // 先获取第一页来获取总数
      const firstResponse = await getDocuments(datasetId, { size: 100, page: 1 });
      const total = firstResponse.total || 0;
      let allDocs = firstResponse.document_infos || [];
      
      // 如果有更多页，继续获取
      if (total > 100) {
        const pages = Math.ceil(total / 100);
        for (let page = 2; page <= pages; page++) {
          const pageResponse = await getDocuments(datasetId, { size: 100, page });
          const pageDocs = pageResponse.document_infos || [];
          allDocs = [...allDocs, ...pageDocs];
        }
      }
      
      setDocuments(Array.isArray(allDocs) ? allDocs : []);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '获取文件列表失败';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
    setSelectedIds([]);
  }, [datasetId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      const ext = getFileExtension(file.name);
      if (!SUPPORTED_EXTENSIONS.includes(ext)) {
        toast.error(`不支持的文件格式: ${file.name}`);
        return false;
      }
      return true;
    });

    if (validFiles.length + selectedFiles.length > 10) {
      toast.error('每次最多上传10个文件');
      return;
    }

    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    console.log('handleUpload called, uploadType:', uploadType, 'webUrl:', webUrl, 'webUrl length:', webUrl.length, 'selectedFiles:', selectedFiles.length);
    
    if (uploadType === 'file' && selectedFiles.length === 0) {
      toast.error('请选择要上传的文件');
      return;
    }

    if (uploadType === 'url' && !webUrl.trim()) {
      toast.error('请输入网页URL');
      return;
    }

    setUploading(true);
    try {
      const documentBases: DocumentBase[] = [];

      if (uploadType === 'file') {
        for (const file of selectedFiles) {
          const base64 = await fileToBase64(file);
          const ext = getFileExtension(file.name);
          documentBases.push({
            name: file.name,
            source_info: {
              file_base64: base64,
              file_type: ext,
              document_source: 0
            }
          });
        }
      } else {
        documentBases.push({
          name: webUrl,
          source_info: {
            web_url: webUrl,
            document_source: 1
          }
        });
      }

      console.log('Uploading documents:', documentBases);
      const result = await uploadDocuments(datasetId, {
        document_bases: documentBases,
        format_type: 0
      });
      console.log('Upload result:', result);

      toast.success('文件上传成功');
      setShowUploadModal(false);
      setSelectedFiles([]);
      setWebUrl('');
      fetchDocuments();
    } catch (error: unknown) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : '上传失败';
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm(`确定要删除文件 "${doc.name}" 吗？`)) {
      return;
    }

    try {
      await deleteDocument(doc.document_id);
      toast.success('文件删除成功');
      fetchDocuments();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '删除失败';
      toast.error(errorMessage);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) {
      toast.error('请选择要删除的文件');
      return;
    }

    if (!confirm(`确定要删除选中的 ${selectedIds.length} 个文件吗？`)) {
      return;
    }

    try {
      for (const id of selectedIds) {
        await deleteDocument(id);
      }
      toast.success('批量删除成功');
      setSelectedIds([]);
      fetchDocuments();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '删除失败';
      toast.error(errorMessage);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredDocuments.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredDocuments.map(d => d.document_id));
    }
  };

  const getStatusIcon = (status?: number) => {
    switch (status) {
      case 0:
        return <Clock className="w-4 h-4 text-yellow-400" />;
      case 1:
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 9:
        return <XCircle className="w-4 h-4 text-red-400" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusText = (status?: number) => {
    switch (status) {
      case 0:
        return '处理中';
      case 1:
        return '已完成';
      case 9:
        return '处理失败';
      default:
        return '已完成';
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '-';
    return new Date(timestamp * 1000).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 过滤文档
  const filteredDocuments = documents.filter(doc => 
    doc.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* 头部 */}
        <div className="glass rounded-2xl p-4 md:p-6 mb-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <FolderOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">知识库文件管理</h1>
                <p className="text-sm text-gray-400">共 {documents.length} 个文件</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>上传文件</span>
              </button>
              <button
                onClick={fetchDocuments}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-all"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* 搜索和批量操作 */}
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜索文件..."
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            {selectedIds.length > 0 && (
              <button
                onClick={handleBatchDelete}
                className="flex items-center gap-2 px-3 py-2 bg-red-600/80 hover:bg-red-600 text-white text-sm rounded-lg transition-all"
              >
                <Trash2 className="w-4 h-4" />
                <span>删除 ({selectedIds.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* 文件列表 */}
        <div className="glass rounded-2xl overflow-hidden">
          {loading && documents.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <FileText className="w-12 h-12 mb-4 opacity-50" />
              <p>{searchTerm ? '没有找到匹配的文件' : '暂无文件'}</p>
              {!searchTerm && (
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="mt-4 text-indigo-400 hover:text-indigo-300 text-sm"
                >
                  点击上传第一个文件
                </button>
              )}
            </div>
          ) : (
            <>
              {/* 表头 */}
              <div className="flex items-center gap-3 px-4 py-3 bg-white/5 border-b border-white/10 text-sm text-gray-400">
                <input
                  type="checkbox"
                  checked={selectedIds.length === filteredDocuments.length && filteredDocuments.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-gray-600 bg-transparent text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0"
                />
                <span className="flex-1">文件名</span>
                <span className="w-20 text-center hidden sm:block">状态</span>
                <span className="w-20 text-center hidden md:block">大小</span>
                <span className="w-24 text-center hidden lg:block">更新时间</span>
                <span className="w-10"></span>
              </div>

              {/* 文件列表 */}
              <div className="divide-y divide-white/5 max-h-[60vh] overflow-y-auto">
                {filteredDocuments.map((doc) => (
                  <div
                    key={doc.document_id}
                    className={`group flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors ${
                      selectedIds.includes(doc.document_id) ? 'bg-indigo-600/10' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(doc.document_id)}
                      onChange={() => toggleSelect(doc.document_id)}
                      className="w-4 h-4 rounded border-gray-600 bg-transparent text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0"
                    />
                    
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      doc.source_type === 1 ? 'bg-cyan-500/20' : 'bg-purple-500/20'
                    }`}>
                      {doc.source_type === 1 ? (
                        <Globe className="w-4 h-4 text-cyan-400" />
                      ) : (
                        <FileText className="w-4 h-4 text-purple-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm truncate" title={doc.name}>{doc.name}</p>
                      <p className="text-xs text-gray-500 sm:hidden">
                        {getStatusText(doc.status)} · {formatSize(doc.size)}
                      </p>
                    </div>

                    <div className="w-20 hidden sm:flex items-center justify-center gap-1">
                      {getStatusIcon(doc.status)}
                      <span className="text-xs text-gray-400">{getStatusText(doc.status)}</span>
                    </div>

                    <div className="w-20 text-center text-xs text-gray-400 hidden md:block">
                      {formatSize(doc.size)}
                    </div>

                    <div className="w-24 text-center text-xs text-gray-500 hidden lg:block">
                      {formatDate(doc.update_time)}
                    </div>

                    <button
                      onClick={() => handleDelete(doc)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 上传模态框 */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-dark rounded-2xl p-6 w-full max-w-lg animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-white">上传文件</h3>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedFiles([]);
                  setWebUrl('');
                }}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* 上传类型切换 */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setUploadType('file')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                  uploadType === 'file'
                    ? 'bg-purple-500/20 border-purple-500/50 text-purple-400'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>本地文件</span>
              </button>
              <button
                onClick={() => setUploadType('url')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                  uploadType === 'url'
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                }`}
              >
                <Globe className="w-4 h-4" />
                <span>在线网页</span>
              </button>
            </div>

            {uploadType === 'file' ? (
              <div className="space-y-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center cursor-pointer hover:border-purple-500/50 hover:bg-purple-500/5 transition-all"
                >
                  <Upload className="w-10 h-10 mx-auto mb-3 text-gray-500" />
                  <p className="text-gray-400">点击选择文件</p>
                  <p className="text-sm text-gray-600 mt-1">
                    支持 PDF、TXT、DOC、DOCX、MD，最多10个
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.txt,.doc,.docx,.md"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {selectedFiles.length > 0 && (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-lg"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-purple-400 flex-shrink-0" />
                          <span className="text-sm text-white truncate">{file.name}</span>
                          <span className="text-xs text-gray-500 flex-shrink-0">
                            {formatSize(file.size)}
                          </span>
                        </div>
                        <button
                          onClick={() => removeFile(index)}
                          className="p-1 hover:bg-white/10 rounded"
                        >
                          <X className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-sm text-gray-400 mb-2">网页URL</label>
                <input
                  type="url"
                  value={webUrl}
                  onChange={(e) => setWebUrl(e.target.value)}
                  placeholder="https://example.com/article"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
                <p className="text-xs text-gray-600 mt-2">
                  输入网页URL，系统将自动抓取网页内容
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedFiles([]);
                  setWebUrl('');
                }}
                disabled={uploading}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>{uploading ? '上传中...' : '上传'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

