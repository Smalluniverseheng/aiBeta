#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json, re, time, uuid, os, requests
from flask import Flask, request, Response, jsonify

app = Flask(__name__)

UPSTREAM_URL = "https://chatjimmy.ai/api/chat"
UPSTREAM_HEADERS = {
    "Content-Type": "application/json",
    "Origin": "https://chatjimmy.ai",
    "Referer": "https://chatjimmy.ai/",
    "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36"
}

MEMORY_FILE = os.path.expanduser("~/chatjimmy_memory.json")
MAX_TOKENS = 5000

SYSTEM_PROMPT = """你是小宇宙，由第三方科技研发的AI助手。你基于Taalas HC1芯片驱动，推理速度极快。
重要提醒：由于演示接口限制，我的上下文记忆能力有限（约5000 tokens），长对话可能会遗忘 earlier 内容，请谅解。"""

VALID_KEYS = {
    "sk-cj-6650d67fe260394b221ff44972ead742",
    "sk-cj-79d8cbe13fe9c7b3dfcc9cad26e72842",
    "sk-cj-cb2fc1c23ac3273ce7db2f7e8ff68e46",
    "sk-cj-dd9194a645ff1cfb34b4f1ca86af3e5d",
    "sk-cj-7e3693eb92b163ee247ee9139106a435",
    "sk-cj-ef5dead92349c84c7be541e1ba21c318",
    "sk-cj-4cfe4e50d975f728a88df9db11358aee",
    "sk-cj-5a3fe9a70fbc2233ec01594af5c2aebf",
    "sk-cj-12c2bf7476b93d7e5e171bf58160b3c8",
    "sk-cj-0239622f6c126c6a1f8aaa80d961263c"
}

def check_auth():
    auth = request.headers.get("Authorization", "")
    key = auth[7:].strip() if auth.startswith("Bearer ") else auth.strip()
    return key in VALID_KEYS

def estimate_tokens(text):
    return int(len(text) * 0.6) if text else 0

def truncate_messages(messages, reserve_tokens):
    total = 0
    result = []
    for msg in reversed(messages):
        tok = estimate_tokens(msg.get("content", ""))
        if total + tok > reserve_tokens:
            break
        result.append(msg)
        total += tok
    return list(reversed(result))

def parse_stats(text):
    match = re.search(r'<\|stats\|>([\s\S]+?)<\|/stats\|>', text)
    if match:
        try: stats = json.loads(match.group(1))
        except: stats = {}
        content = text[:match.start()].strip()
    else:
        content = text.strip()
        stats = {}
    return content, stats

def make_chunk(cid, created, model, content, finish=None):
    return {
        "id": cid, "object": "chat.completion.chunk", "created": created, "model": model,
        "choices": [{"index": 0, "delta": {"content": content} if content else {}, "finish_reason": finish}]
    }

def make_usage(stats):
    return {
        "prompt_tokens": stats.get("prefill_tokens", 0),
        "completion_tokens": stats.get("decode_tokens", 0),
        "total_tokens": stats.get("total_tokens", 0)
    }

def load_memories():
    if not os.path.exists(MEMORY_FILE): return []
    try:
        with open(MEMORY_FILE, 'r', encoding='utf-8') as f:
            return json.load(f).get("memories", [])
    except: return []

def save_memories(memories):
    with open(MEMORY_FILE, 'w', encoding='utf-8') as f:
        json.dump({"memories": memories}, f, ensure_ascii=False, indent=2)

def extract_memory(text):
    match = re.search(r'\[记忆\](.*?)(?:\n|$)', text)
    return match.group(1).strip() if match else None

def build_system_prompt(with_memories=True):
    base = SYSTEM_PROMPT
    if with_memories:
        memories = load_memories()
        if memories:
            recent = memories[-8:]
            mem_text = "\n".join([f"- {m['content']}" for m in recent])
            base += f"\n\n【历史记忆】\n{mem_text}"
    return base

def call_chatjimmy(messages, with_memories=True):
    system_parts, chat_msgs = [], []
    for m in messages:
        if m.get("role") == "system": system_parts.append(m.get("content", ""))
        else: chat_msgs.append({"role": m.get("role", "user"), "content": m.get("content", "")})
    if not system_parts: system_parts = [build_system_prompt(with_memories)]
    sys_text = "\n".join(system_parts)
    sys_tokens = estimate_tokens(sys_text)
    reserve = MAX_TOKENS - sys_tokens - 200
    if reserve < 500: reserve = 500
    chat_msgs = truncate_messages(chat_msgs, reserve)
    payload = {
        "messages": chat_msgs,
        "chatOptions": {"selectedModel": "llama3.1-8B", "systemPrompt": sys_text, "topK": 8},
        "attachment": None
    }
    resp = requests.post(UPSTREAM_URL, headers=UPSTREAM_HEADERS, json=payload, timeout=120)
    resp.raise_for_status()
    text = resp.text
    content, stats = parse_stats(text)
    return content, stats

def deep_think(user_content):
    start = time.time()
    sys_prompt = build_system_prompt(with_memories=True)
    r1, _ = call_chatjimmy([{"role": "system", "content": sys_prompt}, {"role": "user", "content": user_content}], with_memories=False)
    reflect = "请严格检查你刚才的回答，找出以下问题：\n1. 是否有事实性错误或遗漏？\n2. 是否有逻辑漏洞或表述不清？\n3. 是否可以更简洁或更详细？\n4. 是否有更好的表达方式？\n\n请列出所有发现的问题，并说明如何改进。"
    r2, _ = call_chatjimmy([{"role": "system", "content": sys_prompt}, {"role": "user", "content": user_content}, {"role": "assistant", "content": r1}, {"role": "user", "content": reflect}], with_memories=False)
    check = f"基于以上反思，请判断：\n1. 如果问题已经很少或没有，回复STOP\n2. 如果还有明显改进空间，回复CONTINUE并简要说明理由\n\n反思结果：{r2}"
    r3, _ = call_chatjimmy([{"role": "system", "content": sys_prompt}, {"role": "user", "content": user_content}, {"role": "assistant", "content": r1}, {"role": "user", "content": reflect}, {"role": "assistant", "content": r2}, {"role": "user", "content": check}], with_memories=False)
    need_continue = "CONTINUE" in r3.upper() and "STOP" not in r3.upper()
    if not need_continue:
        final = r1
        thinking = f"🔍 第1轮：分析用户意图，生成初稿\n⚠️ 第2轮：自检潜在问题\n✅ 第3轮：判断问题较少，直接输出初稿\n（共3轮深度思考，耗时{time.time()-start:.1f}秒）"
        rounds = 3
    else:
        final_prompt = "基于你刚才发现的问题，重新给出一份优化后的最终回答。\n要求：修正所有问题，保持结构清晰，直接输出最终内容。\n并在回答末尾单独添加一行：[记忆] 一句话总结本次对话的关键信息（如用户偏好、需求等）。"
        r4, _ = call_chatjimmy([{"role": "system", "content": sys_prompt}, {"role": "user", "content": user_content}, {"role": "assistant", "content": r1}, {"role": "user", "content": reflect}, {"role": "assistant", "content": r2}, {"role": "user", "content": final_prompt}], with_memories=False)
        final = r4
        thinking = f"🔍 第1轮：分析用户意图，生成初稿\n⚠️ 第2轮：自检潜在问题\n🔄 第3轮：判断需继续优化\n✨ 第4轮：整合改进，生成终稿\n（共4轮深度思考，耗时{time.time()-start:.1f}秒）"
        rounds = 4
    memory = extract_memory(final)
    if memory:
        memories = load_memories()
        memories.append({"timestamp": time.strftime("%Y-%m-%d %H:%M:%S"), "content": memory, "rounds": rounds})
        if len(memories) > 20: memories = memories[-20:]
        save_memories(memories)
        final = re.sub(r'\[记忆\].*?(?:\n|$)', '', final, flags=re.DOTALL).strip()
    return final, thinking, rounds

@app.route("/v1/models", methods=["GET"])
def list_models():
    if not check_auth(): return jsonify({"error": {"message": "Invalid API Key", "type": "auth_error"}}), 401
    return jsonify({"object": "list", "data": [
        {"id": "llama3.1-8B", "object": "model", "created": 1690000000, "owned_by": "taalas"},
        {"id": "llama3.1-8B-deep", "object": "model", "created": 1690000000, "owned_by": "taalas"}
    ]})

@app.route("/v1/chat/completions", methods=["POST"])
def chat_completions():
    if not check_auth(): return jsonify({"error": {"message": "Invalid API Key", "type": "auth_error"}}), 401
    body = request.get_json(force=True)
    stream = body.get("stream", False)
    model = body.get("model", "llama3.1-8B")
    messages = body.get("messages", [])
    is_deep = model.endswith("-deep") or model.endswith("-thinking")
    try:
        if is_deep:
            user_msg = ""
            for m in reversed(messages):
                if m.get("role") == "user":
                    user_msg = m.get("content", "")
                    break
            if not user_msg: user_msg = "请继续"
            final_answer, thinking_text, rounds = deep_think(user_msg)
            full_response = f"```thinking\n{thinking_text}\n```\n\n{final_answer}"
            if stream:
                def event_stream():
                    cid = f"chatcmpl-{uuid.uuid4().hex[:12]}"
                    created = int(time.time())
                    chunks = re.split(r'([，。！？；：,.!?;:\s]+)', full_response)
                    merged, buf = [], ""
                    for c in chunks:
                        buf += c
                        if len(buf) >= 6: merged.append(buf); buf = ""
                    if buf: merged.append(buf)
                    for chunk in merged:
                        if not chunk: continue
                        yield f"data: {json.dumps(make_chunk(cid, created, model, chunk), ensure_ascii=False)}\n\n"
                    end = make_chunk(cid, created, model, "", "stop")
                    end["usage"] = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
                    yield f"data: {json.dumps(end, ensure_ascii=False)}\n\n"
                    yield "data: [DONE]\n\n"
                return Response(event_stream(), mimetype="text/event-stream", headers={"Cache-Control": "no-cache"})
            else:
                return jsonify({"id": f"chatcmpl-{uuid.uuid4().hex[:12]}", "object": "chat.completion", "created": int(time.time()), "model": model, "choices": [{"index": 0, "message": {"role": "assistant", "content": full_response}, "finish_reason": "stop"}], "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}})
        else:
            system_parts, chat_msgs = [], []
            for m in messages:
                if m.get("role") == "system": system_parts.append(m.get("content", ""))
                else: chat_msgs.append({"role": m.get("role", "user"), "content": m.get("content", "")})
            if not system_parts: system_parts = [build_system_prompt(with_memories=True)]
            sys_text = "\n".join(system_parts)
            sys_tokens = estimate_tokens(sys_text)
            reserve = MAX_TOKENS - sys_tokens - 200
            if reserve < 500: reserve = 500
            chat_msgs = truncate_messages(chat_msgs, reserve)
            payload = {"messages": chat_msgs, "chatOptions": {"selectedModel": "llama3.1-8B", "systemPrompt": sys_text, "topK": 8}, "attachment": None}
            resp = requests.post(UPSTREAM_URL, headers=UPSTREAM_HEADERS, json=payload, timeout=120, stream=True)
            resp.raise_for_status()
            if stream:
                def event_stream():
                    cid = f"chatcmpl-{uuid.uuid4().hex[:12]}"
                    created = int(time.time())
                    buf, in_stats, stats_buf = "", False, ""
                    for chunk in resp.iter_content(chunk_size=1024):
                        if not chunk: continue
                        for ch in chunk.decode('utf-8', errors='replace'):
                            if not in_stats:
                                buf += ch
                                if buf.endswith("<|stats|>"):
                                    in_stats = True
                                    c = buf[:-9]
                                    if c: yield f"data: {json.dumps(make_chunk(cid, created, model, c), ensure_ascii=False)}\n\n"
                                    buf = ""
                            else:
                                stats_buf += ch
                                if stats_buf.endswith("<|/stats|>"):
                                    raw = stats_buf[:-10]
                                    try: stats = json.loads(raw)
                                    except: stats = {}
                                    end = make_chunk(cid, created, model, "", "stop")
                                    end["usage"] = make_usage(stats)
                                    yield f"data: {json.dumps(end, ensure_ascii=False)}\n\n"
                                    yield "data: [DONE]\n\n"
                                    return
                    if buf: yield f"data: {json.dumps(make_chunk(cid, created, model, buf), ensure_ascii=False)}\n\n"
                    end = make_chunk(cid, created, model, "", "stop")
                    end["usage"] = make_usage({})
                    yield f"data: {json.dumps(end, ensure_ascii=False)}\n\n"
                    yield "data: [DONE]\n\n"
                return Response(event_stream(), mimetype="text/event-stream", headers={"Cache-Control": "no-cache"})
            else:
                raw_text = resp.text
                content, stats = parse_stats(raw_text)
                return jsonify({"id": f"chatcmpl-{uuid.uuid4().hex[:12]}", "object": "chat.completion", "created": int(time.time()), "model": model, "choices": [{"index": 0, "message": {"role": "assistant", "content": content}, "finish_reason": stats.get("done_reason", "stop")}], "usage": make_usage(stats)})
    except Exception as e:
        return jsonify({"error": {"message": str(e), "type": "upstream_error"}}), 502

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "proxy": "chatjimmy-https", "mode": "dual", "keys": 10})

if __name__ == "__main__":
    print("=" * 60)
    print("[ChatJimmy Proxy] 小宇宙 AI 代理已启动")
    print("监听地址: 0.0.0.0:4100 (HTTPS)")
    print("快速模式: llama3.1-8B")
    print("深度模式: llama3.1-8B-deep")
    print("=" * 60)
    import os
    app.run(host="0.0.0.0", port=4100, threaded=True, ssl_context=(os.path.expanduser("~/cert.pem"), os.path.expanduser("~/key.pem")))
