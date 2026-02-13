#!/bin/bash
# Coze Bot 深度思考检测脚本
# 用法: ./test_bot.sh

cd "$(dirname "$0")/server" || exit 1
source .env 2>/dev/null

BOT_ID="7601102657344110628"
API="https://api.coze.cn"
AUTH="Authorization: Bearer $COZE_API_TOKEN"
UID_VAL="t_$(date +%s)_$$"

# 1. 创建对话
echo "===== 发起对话 (user: $UID_VAL) ====="
CHAT=$(curl -s -X POST "$API/v3/chat" \
  -H "$AUTH" -H "Content-Type: application/json" -H "Agw-Js-Conv: str" \
  -d "{\"bot_id\":\"$BOT_ID\",\"user_id\":\"$UID_VAL\",\"stream\":false,\"additional_messages\":[{\"role\":\"user\",\"content\":\"你好\",\"content_type\":\"text\"}]}")

CHAT_ID=$(echo "$CHAT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
CONV_ID=$(echo "$CHAT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['conversation_id'])" 2>/dev/null)

if [ -z "$CHAT_ID" ]; then
  echo "创建对话失败: $CHAT"
  exit 1
fi

# 2. 轮询等待完成
STATUS="in_progress"
for i in $(seq 1 30); do
  sleep 2
  RETRIEVE=$(curl -s "$API/v3/chat/retrieve?chat_id=$CHAT_ID&conversation_id=$CONV_ID" \
    -H "$AUTH" -H "Content-Type: application/json" -H "Agw-Js-Conv: str")
  STATUS=$(echo "$RETRIEVE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])" 2>/dev/null)
  [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ] && break
done

if [ "$STATUS" != "completed" ]; then
  echo "对话未完成，状态: $STATUS"
  exit 1
fi

# 3. 获取 usage
USAGE_LINE=$(echo "$RETRIEVE" | python3 -c "
import sys,json
u=json.load(sys.stdin)['data']['usage']
rt=u.get('output_tokens_details',{}).get('reasoning_tokens','无')
print(f'reasoning_tokens={rt}, total={u.get(\"token_count\",\"?\")}')" 2>/dev/null)

# 4. 获取消息列表并一次性解析
MSGS=$(curl -s "$API/v3/chat/message/list?chat_id=$CHAT_ID&conversation_id=$CONV_ID" \
  -H "$AUTH" -H "Content-Type: application/json" -H "Agw-Js-Conv: str")

echo "$MSGS" | python3 -c "
import sys, json

msgs = json.load(sys.stdin).get('data', [])

# --- 从 verbose 提取实际模型 ---
for msg in msgs:
    if msg.get('type') != 'verbose' or not msg.get('content'):
        continue
    try:
        parsed = json.loads(msg['content'])
        data_str = parsed.get('data', '')
        if not data_str:
            continue
        inner = json.loads(data_str) if isinstance(data_str, str) else data_str
        ori_req_str = inner.get('ori_req', '')
        if not ori_req_str:
            continue
        ori_req = json.loads(ori_req_str) if isinstance(ori_req_str, str) else ori_req_str
        bot_ctx_str = ori_req.get('scene_context', {}).get('bot_context', '')
        if not bot_ctx_str:
            continue
        bot_ctx = json.loads(bot_ctx_str) if isinstance(bot_ctx_str, str) else bot_ctx_str
        model = bot_ctx.get('agent_schema', {}).get('model', {})
        print(f'[版本] {bot_ctx.get(\"bot_version\", \"?\")}')
        print(f'[实际模型ID] {model.get(\"model_id\", \"?\")}')
        print(f'[temperature] {model.get(\"temperature\", \"?\")}')
        break
    except:
        pass

# --- answer ---
answers = [m for m in msgs if m.get('type') == 'answer' and m.get('role') == 'assistant']
if answers:
    a = answers[0]
    rc = a.get('reasoning_content', '')
    print()
    if rc:
        print(f'[推理] ❌ 有深度思考 ({len(rc)}字)')
        print(f'[推理预览] {rc[:200]}...')
    else:
        print(f'[推理] ✅ 无深度思考')
    print(f'[回复] {a.get(\"content\",\"\")[:200]}')

print(f'[tokens] $USAGE_LINE')
"
