import { CozeAPI, COZE_CN_BASE_URL, type DocumentInfo } from '@coze/api';
import { loadConfig } from './env.js';
import { NEWS_CHUNK_SEPARATOR } from './newsChunk.js';

function getClient(): CozeAPI {
  const config = loadConfig();
  return new CozeAPI({
    token: config.cozeToken,
    baseURL: config.cozeApiBase === 'https://api.coze.cn' ? COZE_CN_BASE_URL : config.cozeApiBase,
    headers: {
      'Agw-Js-Conv': 'str',
    },
  });
}

/** 上传纯文本到知识库（.txt） */
export async function uploadTextDocument(params: {
  datasetId: string;
  fileName: string;
  text: string;
  /** 不传则从 loadConfig() 读取 CHUNK_MAX_TOKENS */
  chunkMaxTokens?: number;
}): Promise<DocumentInfo[]> {
  const cfg = loadConfig();
  const maxTokens = params.chunkMaxTokens ?? cfg.chunkMaxTokens;
  const client = getClient();
  const fileBase64 = Buffer.from(params.text, 'utf-8').toString('base64');
  const created = await client.datasets.documents.create({
    dataset_id: params.datasetId,
    document_bases: [
      {
        name: params.fileName,
        source_info: {
          file_base64: fileBase64,
          file_type: 'txt',
        },
      },
    ],
    // 与 buildCorpus 的 NEWS_CHUNK_SEPARATOR 对齐先按篇切；max_tokens 过大仍会在超长单篇内再切。
    chunk_strategy: {
      chunk_type: 0,
      separator: NEWS_CHUNK_SEPARATOR,
      max_tokens: maxTokens,
      remove_extra_spaces: false,
    },
  });
  return created;
}

/** 分页列出并批量删除，直到知识库内无文档为止 */
export async function deleteAllDocumentsInDataset(datasetId: string): Promise<number> {
  const client = getClient();
  let deleted = 0;
  for (;;) {
    const data = await client.datasets.documents.list({
      dataset_id: datasetId,
      page: 1,
      page_size: 100,
    });
    const infos = data.document_infos || [];
    if (infos.length === 0) break;
    const ids = infos.map((d) => d.document_id);
    await client.datasets.documents.delete({ document_ids: ids });
    deleted += ids.length;
    console.log(`已删除 ${ids.length} 个文件（累计 ${deleted}）…`);
  }
  return deleted;
}
