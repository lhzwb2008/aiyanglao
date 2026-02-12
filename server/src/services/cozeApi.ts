import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const COZE_API_BASE = 'https://api.coze.cn';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class CozeApiService {
  private client: AxiosInstance;
  private spaceId: string;
  private datasetIds: string[];
  private botId: string;

  constructor() {
    const token = process.env.COZE_API_TOKEN;
    this.spaceId = process.env.COZE_SPACE_ID || '';
    this.botId = process.env.COZE_BOT_ID || '';

    // 支持多知识库：逗号分隔
    const idsRaw = process.env.KNOWLEDGE_DATASET_IDS || process.env.KNOWLEDGE_DATASET_ID || '';
    this.datasetIds = idsRaw.split(',').map(s => s.trim()).filter(Boolean);

    if (!token) {
      console.warn('COZE_API_TOKEN is not set');
    }
    if (this.datasetIds.length === 0) {
      console.warn('KNOWLEDGE_DATASET_IDS is not set');
    }
    if (!this.botId) {
      console.warn('COZE_BOT_ID is not set');
    }

    this.client = axios.create({
      baseURL: COZE_API_BASE,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Agw-Js-Conv': 'str',
      },
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('Coze API Error:', error.response?.data || error.message);
        throw error;
      }
    );
  }

  /** 获取所有配置的知识库 ID 列表 */
  getDatasetIds(): string[] {
    return [...this.datasetIds];
  }

  getSpaceId(): string {
    return this.spaceId;
  }

  /** 列出指定知识库的文档 */
  async listDocuments(datasetId: string, params?: { page?: number; size?: number }) {
    const response = await this.client.post('/open_api/knowledge/document/list', {
      dataset_id: datasetId,
      page: params?.page || 1,
      size: params?.size || 100,
    });
    return response.data;
  }

  async downloadDocumentContent(webUrl: string): Promise<string> {
    try {
      const response = await axios.get(webUrl, {
        timeout: 30000,
        responseType: 'text',
      });
      return response.data;
    } catch (err: any) {
      console.error('Failed to download document:', err.message);
      return '';
    }
  }

  async callLLM(systemPrompt: string, userMessage: string): Promise<string> {
    const chatResponse = await this.client.post('/v3/chat', {
      bot_id: this.botId,
      user_id: 'knowledge_graph_extractor',
      stream: false,
      additional_messages: [
        {
          role: 'user',
          content: systemPrompt + '\n\n' + userMessage,
          content_type: 'text',
        },
      ],
    });

    const chatData = chatResponse.data?.data;
    if (!chatData?.id || !chatData?.conversation_id) {
      throw new Error('Failed to initiate chat: ' + JSON.stringify(chatResponse.data));
    }

    const chatId = chatData.id;
    const conversationId = chatData.conversation_id;

    let status = chatData.status;
    let retries = 0;
    const maxRetries = 60;

    while (status !== 'completed' && status !== 'failed' && retries < maxRetries) {
      await sleep(2000);
      retries++;

      const retrieveResponse = await this.client.get('/v3/chat/retrieve', {
        params: { chat_id: chatId, conversation_id: conversationId },
      });
      status = retrieveResponse.data?.data?.status;
    }

    if (status !== 'completed') {
      throw new Error('Chat did not complete, status: ' + status);
    }

    const messagesResponse = await this.client.get('/v3/chat/message/list', {
      params: { chat_id: chatId, conversation_id: conversationId },
    });

    const messages = messagesResponse.data?.data || [];
    const answerMessage = messages.find(
      (msg: any) => msg.type === 'answer' && msg.role === 'assistant'
    );

    return answerMessage?.content || '';
  }
}

export const cozeApi = new CozeApiService();
