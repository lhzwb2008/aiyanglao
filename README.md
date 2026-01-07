# 知识库文件管理

通过 URL 访问和管理 Coze 知识库中的文件。

## 访问方式

```
http://{服务器地址}:{端口}/{知识库ID}
```

### 示例

```
http://192.168.1.100:5173/7588493565027942463
```

将 `7588493565027942463` 替换为你要管理的知识库 ID。

### 获取知识库 ID

在 Coze 平台打开知识库页面，URL 中 `knowledge` 后的数字即为知识库 ID：

```
https://www.coze.cn/space/xxx/knowledge/7588493565027942463
                                        └── 知识库 ID ──┘
```

## iframe 嵌入

```html
<iframe 
  src="http://192.168.1.100:5173/7588493565027942463" 
  width="100%" 
  height="600"
  frameborder="0"
></iframe>
```

## 功能说明

| 功能 | 说明 |
|------|------|
| 查看文件 | 显示知识库中所有文件，支持搜索 |
| 上传文件 | 支持本地文件（PDF/TXT/DOC/DOCX/MD）和在线网页 |
| 删除文件 | 支持单个删除和批量删除 |

## 部署配置

### 环境变量

编辑 `server/.env`：

```env
COZE_API_TOKEN=your_token    # Coze 个人访问令牌
COZE_SPACE_ID=your_space_id  # 工作空间 ID
PORT=3001                    # 后端端口
```

### 启动服务

```bash
npm run install:all   # 安装依赖
npm run dev           # 启动服务
```

服务启动后，前端默认运行在 `5173` 端口。
