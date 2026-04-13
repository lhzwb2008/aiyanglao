/**
 * 知识库自定义分段：与 cozeDataset.uploadTextDocument 的 chunk_strategy.separator 必须一致。
 * 勿在稿件正文中出现该串。
 */
export const NEWS_CHUNK_SEPARATOR = '\n\n###NEWS_ITEM###\n\n';
