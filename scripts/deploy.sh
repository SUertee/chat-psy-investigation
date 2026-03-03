#!/bin/bash

# 危机评估培训实验系统部署脚本
# 使用方法：./deploy.sh [部署目录]

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

# 复制前端静态资源
echo "📋 复制前端文件到部署目录..."
cp -R public "$DEPLOY_DIR/"

# 复制前端源码
echo "🧠 复制前端源码..."
cp -R src "$DEPLOY_DIR/"

# 复制根目录入口
echo "↪️ 复制根目录入口..."
cp index.html "$DEPLOY_DIR/"

# 复制后端代理
echo "🌐 复制代理接口..."
cp -R server "$DEPLOY_DIR/"

# 复制文档
echo "📚 复制项目文档..."
mkdir -p "$DEPLOY_DIR/docs"
cp docs/*.md "$DEPLOY_DIR/docs/"

# 设置权限
echo "🔒 设置文件权限..."
find "$DEPLOY_DIR" -type f \( -name "*.html" -o -name "*.js" -o -name "*.php" -o -name "*.pdf" -o -name "*.md" \) -exec chmod 644 {} \;
find "$DEPLOY_DIR" -type d -exec chmod 755 {} \;

# 显示部署信息
echo ""
echo "✅ 部署完成！"
echo "==========================================="
echo "部署路径: $DEPLOY_DIR"
echo "测试地址: http://your-server-ip/experiment/public/test.html"
echo "实验地址: http://your-server-ip/experiment/public/index.html"
echo "==========================================="
echo ""
echo "📖 重要提示："
echo "1. 请确保 src/config/config.js 中的API密钥已正确配置"
echo "2. 数据上传服务器需要配置好接收接口"
echo "3. 建议使用HTTPS协议保护数据传输"
echo "4. 详细配置说明请查看 docs/README.md"
echo ""
echo "🔧 如需修改配置，请编辑: $DEPLOY_DIR/src/config/config.js"
