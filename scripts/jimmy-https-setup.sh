#!/bin/bash
# ChatJimmy HTTPS 代理 - 一键安装
# 从 GitHub 下载执行

set -e

echo "========================================"
echo "  ChatJimmy HTTPS 代理安装器"
echo "========================================"

# 1. 安装依赖
echo "[1/3] 检查依赖..."
if ! command -v python &> /dev/null; then
    echo "   安装 Python..."
    pkg update -y
    pkg install python -y
fi
pip install flask requests -q 2>/dev/null || pip install flask requests --quiet

# 2. 生成证书
echo "[2/3] 生成 HTTPS 证书..."
IP=$(ip addr 2>/dev/null | grep 'inet ' | grep -v '127.0.0.1' | awk '{print $2}' | cut -d/ -f1 | head -n 1)
[ -z "$IP" ] && IP="192.168.31.95"
openssl req -x509 -newkey rsa:2048 -keyout ~/key.pem -out ~/cert.pem -days 365 -nodes -subj "/CN=$IP" 2>/dev/null

# 3. 下载代理脚本
echo "[3/3] 下载代理脚本..."
curl -fsSL "https://raw.githubusercontent.com/Smalluniverseheng/aiBeta/main/scripts/chatjimmy_proxy.py" -o ~/chatjimmy_proxy.py

# 4. 启动
echo ""
echo "启动代理..."
nohup python ~/chatjimmy_proxy.py > ~/chatjimmy.log 2>&1 &
echo $! > ~/chatjimmy.pid
sleep 2

echo ""
echo "========================================"
echo "✅ HTTPS 代理已启动"
echo ""
echo "📡 地址: https://$IP:4100/v1"
echo ""
echo "📱 ThirdHub 配置:"
echo "   接口地址: https://$IP:4100/v1"
echo "   API Key:  sk-cj-6650d67fe260394b221ff44972ead742"
echo "   模型:     llama3.1-8B (快速) / llama3.1-8B-deep (深度)"
echo ""
echo "⚠️  手机B浏览器先访问 https://$IP:4100/health"
echo "   提示'不安全'时点'高级'→'继续'"
echo "========================================"

# 保存重启脚本
cat > ~/chatjimmy_start.sh << 'EOF'
#!/bin/bash
kill $(cat ~/chatjimmy.pid 2>/dev/null) 2>/dev/null
sleep 1
nohup python ~/chatjimmy_proxy.py > ~/chatjimmy.log 2>&1 &
echo $! > ~/chatjimmy.pid
echo "服务已重启"
EOF
chmod +x ~/chatjimmy_start.sh
