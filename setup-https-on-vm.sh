#!/bin/bash
# 在 VM 上运行，为后端配置 HTTPS（Nginx + Let's Encrypt），并自动反代到 3000。
# 使用前：域名已做 A 记录指向本机公网 IP；GCP 防火墙已放行 80、443。
# 用法：API_DOMAIN=api.你的域名.com CERTBOT_EMAIL=you@example.com sudo -E bash setup-https-on-vm.sh

set -e
API_DOMAIN="${API_DOMAIN:-}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"

if [[ -z "$API_DOMAIN" ]]; then
  echo "请设置域名，例如: API_DOMAIN=api.yourdomain.com CERTBOT_EMAIL=you@example.com sudo -E bash setup-https-on-vm.sh"
  exit 1
fi

echo "==> 域名: $API_DOMAIN"
export DEBIAN_FRONTEND=noninteractive
echo "==> 安装 nginx、certbot..."
apt-get update -qq
apt-get install -y -qq nginx certbot python3-certbot-nginx

echo "==> 创建 Nginx 配置（反代到 3000）..."
SITE_FILE="/etc/nginx/sites-available/cs-agent-api"
cat > "$SITE_FILE" << NGINX_CONF
server {
    listen 80;
    server_name $API_DOMAIN;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX_CONF
ln -sf "$SITE_FILE" /etc/nginx/sites-enabled/cs-agent-api 2>/dev/null || true
nginx -t && systemctl reload nginx

echo "==> 申请证书（Let's Encrypt）..."
if [[ -n "$CERTBOT_EMAIL" ]]; then
  certbot --nginx -d "$API_DOMAIN" --non-interactive --agree-tos -m "$CERTBOT_EMAIL"
else
  certbot --nginx -d "$API_DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email
fi

echo ""
echo "==> 完成。请验证: curl https://$API_DOMAIN/health"
echo "==> 在 Zendesk App 中将 Backend URL 改为: https://$API_DOMAIN"