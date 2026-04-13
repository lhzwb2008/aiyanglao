import { loadConfig } from './env.js';
import { CozeAPI, COZE_CN_BASE_URL } from '@coze/api';

async function main(): Promise<void> {
  const c = loadConfig();
  const client = new CozeAPI({
    token: c.cozeToken,
    baseURL: c.cozeApiBase === 'https://api.coze.cn' ? COZE_CN_BASE_URL : c.cozeApiBase,
    headers: { 'Agw-Js-Conv': 'str' },
  });
  const data = await client.datasets.documents.list({
    dataset_id: c.cozeDatasetId,
    page: 1,
    page_size: 20,
  });
  console.log('total=', data.total);
  for (const d of data.document_infos || []) {
    console.log(d.name, 'id=', d.document_id, 'status=', d.status, 'slice=', d.slice_count, 'size=', d.size);
  }
}

main().catch(console.error);
