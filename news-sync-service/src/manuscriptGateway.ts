import axios from 'axios';

export interface ManuscriptItem {
  id: string;
  title: string;
  publishAt: string;
  url?: string;
  content?: string;
  source?: string;
  sourceName?: string;
  analysis?: {
    summary?: string;
    classification?: string;
    tags?: string[];
  };
}

interface LoginResponse {
  code: number;
  data?: { token?: string };
}

interface QueryResponse {
  code: number;
  data?: {
    total?: string;
    page?: number;
    size?: number;
    data?: ManuscriptItem[];
  };
}

export async function gatewayLogin(loginUrl: string, username: string, password: string): Promise<string> {
  const { data } = await axios.post<LoginResponse>(
    loginUrl,
    { username, password },
    { headers: { 'Content-Type': 'application/json' }, timeout: 60000 }
  );
  const token = data.data?.token;
  if (!token) {
    throw new Error(`网关登录失败: ${JSON.stringify(data)}`);
  }
  return token;
}

export async function queryManuscripts(params: {
  queryUrl: string;
  token: string;
  beginAt: string;
  endAt: string;
  mediaTypes: string[];
  mediaLevels: string[];
  page: number;
  size: number;
}): Promise<QueryResponse['data']> {
  const { data } = await axios.post<QueryResponse>(
    params.queryUrl,
    {
      beginAt: params.beginAt,
      endAt: params.endAt,
      mediaType: params.mediaTypes,
      mediaLevels: params.mediaLevels,
      orderBy: 'publishAt',
      size: params.size,
      page: params.page,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.token}`,
      },
      timeout: 120000,
    }
  );
  if (data.code !== 200) {
    throw new Error(`ods/query 失败: ${JSON.stringify(data)}`);
  }
  return data.data;
}

export function formatDateTime(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}
