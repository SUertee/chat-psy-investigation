#!/bin/bash

# 危机评估培训实验系统前端部署脚本
# 使用方法：./deploy-client.sh [部署目录]

DEPLOY_DIR=${1:-"/var/www/html/experiment"}

echo "==========================================="
echo "危机评估培训实验系统部署脚本"
echo "==========================================="
echo ""

# 检查是否有root权限
if [[ $EUID -ne 0 ]]; then
   echo "⚠️  警告：没有root权限，可能无法部署到系统目录"
   echo ""
fi

# 创建部署目录
echo "📁 创建部署目录: $DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"

# 复制前端目录
echo "📋 复制 client 前端目录..."
cp -R client "$DEPLOY_DIR/"

# 复制根目录入口
echo "↪️ 复制根目录入口..."
cp index.html "$DEPLOY_DIR/"

# 复制后端目录
echo "🌐 复制 server 后端目录..."
cp -R server "$DEPLOY_DIR/"

# 复制文档
echo "📚 复制项目文档..."
mkdir -p "$DEPLOY_DIR/docs"
cp docs/*.md "$DEPLOY_DIR/docs/"

# 设置权限
echo "🔒 设置文件权限..."
find "$DEPLOY_DIR" -type f \( -name "*.html" -o -name "*.js" -o -name "*.py" -o -name "*.pdf" -o -name "*.md" -o -name "*.json" -o -name "*.txt" \) -exec chmod 644 {} \;
find "$DEPLOY_DIR" -type d -exec chmod 755 {} \;

# 显示部署信息
echo ""
echo "✅ 部署完成！"
echo "==========================================="
echo "部署路径: $DEPLOY_DIR"
echo "测试地址: http://your-server-ip/experiment/client/public/test.html"
echo "实验地址: http://your-server-ip/experiment/client/public/index.html"
echo "==========================================="
echo ""
echo "📖 重要提示："
echo "1. 请确保 client/src/config/config.js 中的前端配置已正确配置"
echo "2. 数据上传服务器需要配置好接收接口"
echo "3. 如需启用配对聊天室，请同时启动 server/FastAPI 后端"
echo "4. 建议使用HTTPS协议保护数据传输"
echo "5. 详细配置说明请查看 docs/README.md"
echo ""
echo "🔧 如需修改前端配置，请编辑: $DEPLOY_DIR/client/src/config/config.js"
