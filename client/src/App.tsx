import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import DocumentManager from './components/DocumentManager';

function App() {
  const [datasetId, setDatasetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 优先从 URL 路径中获取 knowledge_id（格式：/7588493565027942463）
    const pathMatch = window.location.pathname.match(/^\/(\d+)\/?$/);
    if (pathMatch) {
      setDatasetId(pathMatch[1]);
      return;
    }

    // 其次从 URL 参数中获取
    const params = new URLSearchParams(window.location.search);
    const knowledgeId = params.get('knowledge_id') || params.get('dataset_id');
    
    if (knowledgeId) {
      setDatasetId(knowledgeId);
    } else {
      setError('缺少必要参数：knowledge_id');
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      <Toaster 
        position="top-center"
        toastOptions={{
          style: {
            background: 'rgba(30, 27, 75, 0.95)',
            color: '#fff',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            backdropFilter: 'blur(10px)',
            fontSize: '14px',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      
      {error ? (
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="glass rounded-2xl p-8 max-w-md text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">参数错误</h2>
            <p className="text-gray-400 mb-4">{error}</p>
            <div className="text-left bg-black/30 rounded-lg p-4 text-sm space-y-3">
              <div>
                <p className="text-gray-500 mb-1">方式一（推荐）：</p>
                <code className="text-indigo-400 break-all">
                  {window.location.origin}/知识库ID
                </code>
              </div>
              <div>
                <p className="text-gray-500 mb-1">方式二：</p>
                <code className="text-indigo-400 break-all">
                  {window.location.origin}/?knowledge_id=知识库ID
                </code>
              </div>
            </div>
          </div>
        </div>
      ) : datasetId ? (
        <DocumentManager datasetId={datasetId} />
      ) : (
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

export default App;
