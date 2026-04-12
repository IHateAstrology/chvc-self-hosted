#!/bin/bash
# CHVC — Nginx + SSL + Firewall Setup
# Run after deploy.sh once you have your subdomain ready.
# Usage: bash setup-nginx.sh chvc.yourdomain.com
set -e

SUBDOMAIN="${1:-YOUR_SUBDOMAIN_HERE}"

echo ""
echo "======================================================"
echo "  CHVC — Nginx + Firewall Setup"
echo "  Subdomain: ${SUBDOMAIN}"
echo "======================================================"
echo ""

# ── UFW Firewall ──────────────────────────────────────────
echo "[1/4] Configuring UFW firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
echo "      Firewall rules: SSH(22), HTTP(80), HTTPS(443) — enabled."

# ── Nginx ─────────────────────────────────────────────────
echo "[2/4] Installing Nginx..."
apt-get install -y -qq nginx

# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Write the proxy config
cat > /etc/nginx/sites-available/chvc << NGINXCONF
server {
    listen 80;
    server_name ${SUBDOMAIN};

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    location / {
        proxy_pass http://localhost:3060;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINXCONF

ln -sf /etc/nginx/sites-available/chvc /etc/nginx/sites-enabled/chvc
nginx -t && systemctl reload nginx
echo "      Nginx configured and running."

# ── Certbot / SSL ─────────────────────────────────────────
echo "[3/4] Installing Certbot..."
apt-get install -y -qq certbot python3-certbot-nginx
echo "      Certbot ready. Run this when DNS is pointing to this server:"
echo ""
echo "      certbot --nginx -d ${SUBDOMAIN} --non-interactive --agree-tos -m admin@${SUBDOMAIN}"
echo ""

# ── Done ─────────────────────────────────────────────────
echo "[4/4] Done!"
echo ""
echo "======================================================"
echo "  Next steps:"
echo ""
echo "  1. Point your DNS A record:"
echo "     ${SUBDOMAIN}  ->  87.99.146.54"
echo ""
echo "  2. Wait ~5 min for DNS to propagate, then run:"
echo "     certbot --nginx -d ${SUBDOMAIN} --non-interactive --agree-tos -m admin@${SUBDOMAIN}"
echo ""
echo "  3. Your app will be live at:"
echo "     https://${SUBDOMAIN}"
echo "======================================================"
