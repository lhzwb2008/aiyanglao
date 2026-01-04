import { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  RefreshCw, 
  Database,
  Image,
  FileText,
  MoreVertical,
  Check,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getDatasets, createDataset, updateDataset, deleteDataset } from '../services/api';
import type { Dataset } from '../types';

interface Props {
  selectedDataset: Dataset | null;
  onSelectDataset: (dataset: Dataset | null) => void;
}

export default function DatasetList({ selectedDataset, onSelectDataset }: Props) {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDataset, setEditingDataset] = useState<Dataset | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  // 表单状态
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState(0);

  const fetchDatasets = async () => {
    setLoading(true);
    try {
      const response = await getDatasets({ page_size: 100 });
      // Coze API 返回格式: { data: { dataset_list: [...] } }
      const data = response.data?.dataset_list || [];
      setDatasets(Array.isArray(data) ? data : []);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '获取知识库列表失败';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  const handleCreate = async () => {
    if (!formName.trim()) {
      toast.error('请输入知识库名称');
      return;
    }

    try {
      await createDataset({
        name: formName,
        description: formDescription,
        format_type: formType
      });
      toast.success('知识库创建成功');
      setShowCreateModal(false);
      resetForm();
      fetchDatasets();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '创建失败';
      toast.error(errorMessage);
    }
  };

  const handleUpdate = async () => {
    if (!editingDataset || !formName.trim()) {
      toast.error('请输入知识库名称');
      return;
    }

    try {
      await updateDataset(editingDataset.dataset_id, {
        name: formName,
        description: formDescription
      });
      toast.success('知识库更新成功');
      setEditingDataset(null);
      resetForm();
      fetchDatasets();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '更新失败';
      toast.error(errorMessage);
    }
  };

  const handleDelete = async (dataset: Dataset) => {
    if (!confirm(`确定要删除知识库 "${dataset.name}" 吗？此操作不可恢复。`)) {
      return;
    }

    try {
      await deleteDataset(dataset.dataset_id);
      toast.success('知识库删除成功');
      if (selectedDataset?.dataset_id === dataset.dataset_id) {
        onSelectDataset(null);
      }
      fetchDatasets();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '删除失败';
      toast.error(errorMessage);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormType(0);
  };

  const openEditModal = (dataset: Dataset) => {
    setEditingDataset(dataset);
    setFormName(dataset.name);
    setFormDescription(dataset.description || '');
    setMenuOpen(null);
  };

  const getTypeIcon = (type: number) => {
    return type === 2 ? (
      <Image className="w-4 h-4 text-pink-400" />
    ) : (
      <FileText className="w-4 h-4 text-blue-400" />
    );
  };

  const getTypeLabel = (type: number) => {
    return type === 2 ? '图片' : '文本';
  };

  return (
    <div>
      {/* 工具栏 */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all btn-glow"
        >
          <Plus className="w-4 h-4" />
          <span>新建</span>
        </button>
        <button
          onClick={fetchDatasets}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>刷新</span>
        </button>
      </div>

      {/* 知识库列表 */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
        {loading && datasets.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
          </div>
        ) : datasets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Database className="w-12 h-12 mb-4 opacity-50" />
            <p>暂无知识库</p>
            <p className="text-sm mt-1">点击"新建"创建第一个知识库</p>
          </div>
        ) : (
          datasets.map((dataset, index) => (
            <div
              key={dataset.dataset_id}
              className={`group relative p-4 rounded-xl cursor-pointer transition-all card-hover animate-slide-in ${
                selectedDataset?.dataset_id === dataset.dataset_id
                  ? 'bg-indigo-600/30 border border-indigo-500/50'
                  : 'bg-white/5 hover:bg-white/10 border border-transparent'
              }`}
              style={{ animationDelay: `${index * 0.05}s` }}
              onClick={() => onSelectDataset(dataset)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    dataset.format_type === 2 ? 'bg-pink-500/20' : 'bg-blue-500/20'
                  }`}>
                    {getTypeIcon(dataset.format_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white truncate">{dataset.name}</h3>
                    <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                      {dataset.description || '暂无描述'}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span className={`px-2 py-0.5 rounded-full ${
                        dataset.format_type === 2 ? 'bg-pink-500/20 text-pink-400' : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {getTypeLabel(dataset.format_type)}
                      </span>
                      {dataset.doc_count !== undefined && (
                        <span>{dataset.doc_count} 个文件</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 操作菜单 */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(menuOpen === dataset.dataset_id ? null : dataset.dataset_id);
                    }}
                    className="p-2 rounded-lg hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreVertical className="w-4 h-4 text-gray-400" />
                  </button>
                  
                  {menuOpen === dataset.dataset_id && (
                    <div className="absolute right-0 top-full mt-1 w-32 py-1 rounded-lg bg-gray-900 border border-gray-700 shadow-xl z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(dataset);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-white/10"
                      >
                        <Edit3 className="w-4 h-4" />
                        <span>编辑</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(null);
                          handleDelete(dataset);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-white/10"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>删除</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 创建/编辑模态框 */}
      {(showCreateModal || editingDataset) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-dark rounded-2xl p-6 w-full max-w-md animate-fade-in">
            <h3 className="text-lg font-medium text-white mb-4">
              {editingDataset ? '编辑知识库' : '新建知识库'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">名称 *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="请输入知识库名称"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-2">描述</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="请输入知识库描述（可选）"
                  rows={3}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                />
              </div>

              {!editingDataset && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">类型</label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setFormType(0)}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                        formType === 0
                          ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                      <span>文本</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormType(2)}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                        formType === 2
                          ? 'bg-pink-500/20 border-pink-500/50 text-pink-400'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      <Image className="w-4 h-4" />
                      <span>图片</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingDataset(null);
                  resetForm();
                }}
                className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
                <span>取消</span>
              </button>
              <button
                onClick={editingDataset ? handleUpdate : handleCreate}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all btn-glow"
              >
                <Check className="w-4 h-4" />
                <span>{editingDataset ? '保存' : '创建'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 点击外部关闭菜单 */}
      {menuOpen && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setMenuOpen(null)}
        />
      )}
    </div>
  );
}

