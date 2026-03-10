#!/bin/bash
# 在 VM 上运行，为后端配置 HTTPS（Nginx + Let's Encrypt）。
# 使用前：域名已做 A 记录指向本机公网 IP；GCP 防火墙已放行 80、443。
# 用法：sudo bash setup-https-on-vm.sh
# 或：API_DOMAIN=api.你的域名.com CERTBOT_EMAIL=you@example.com sudo -E bash setup-https-on-vm.sh

set -e
API_DOMAIN="${API_DOMAIN:-}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"

if [[ -z "$API_DOMAIN" ]]; then
  echo "请设置域名，例如: API_DOMAIN=api.yourdomain.com bash setup-https-on-vm.sh"
  echo "或运行前执行: export API_DOMAIN=api.yourdomain.com"
  exit 1
fi

echo "==> 域名: $API_DOMAIN"
export DEBIAN_FRONTEND=noninteractive
echo "==> 安装 nginx、certbot..."
apt-get update -qq
apt-get install -y -qq nginx certbot python3-certbot-nginx

echo "==> 申请证书（Let's Encrypt）..."
if [[ -n "$CERTBOT_EMAIL" ]]; then
  certbot --nginx -d "$API_DOMAIN" --non-interactive --agree-tos -m "$CERTBOT_EMAIL"
else
  certbot --nginx -d "$API_DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email
fi

echo "==> 请手动在 Nginx 中加入反代到 3000："
echo "  1. 编辑: sudo nano /etc/nginx/sites-available/default"
echo "  2. 在 listen 443 ssl 所在的 server { } 内加入以下 location 块："
echo ""
echo "  location / {"
echo "    proxy_pass http://127.0.0.1:3000;"
echo "    proxy_http_version 1.1;"
echo "    proxy_set_header Host \$host;"
echo "    proxy_set_header X-Real-IP \$remote_addr;"
echo "    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;"
echo "    proxy_set_header X-Forwarded-Proto \$scheme;"
echo "  }"
echo ""
echo "  3. 保存后执行: sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "==> GCP 防火墙请放行 80、443（若未放行）。"
echo "==> 完成后用浏览器访问: https://$API_DOMAIN/health"
echo "==> 在 Zendesk App 中将 Backend URL 设为: https://$API_DOMAIN"
