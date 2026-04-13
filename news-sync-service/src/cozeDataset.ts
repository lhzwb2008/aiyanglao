import { CozeAPI, COZE_CN_BASE_URL, type DocumentInfo } from '@coze/api';
import { loadConfig } from './env.js';

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
}): Promise<DocumentInfo[]> {
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
    chunk_strategy: {
      chunk_type: 0,
      separator: '\n\n',
      max_tokens: 800,
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
