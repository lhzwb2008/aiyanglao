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
