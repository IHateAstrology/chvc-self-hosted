#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# CHVC Server — Full Nginx + SSL + Firewall Setup
# Configures reverse proxy for BOTH services:
#   stormewilliams.com       → port 3015 (personal website)
#   chvc.stormewilliams.com  → port 3060 (Crystal PM Assistant)
#
# Usage: bash setup-nginx.sh stormewilliams.com
# ─────────────────────────────────────────────────────────────────
set -e

DOMAIN="${1:-stormewilliams.com}"
CHVC_SUB="chvc.${DOMAIN}"

echo ""
echo "======================================================"
echo "  Nginx + Firewall Setup"
echo "  Main domain : ${DOMAIN}"
echo "  CHVC sub    : ${CHVC_SUB}"
echo "======================================================"
echo ""

# ── UFW Firewall ──────────────────────────────────────────
echo "[1/5] Configuring UFW firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
echo "      Rules active: SSH(22) HTTP(80) HTTPS(443)"

# ── Install Nginx + Certbot ───────────────────────────────
echo "[2/5] Installing Nginx and Certbot..."
apt-get update -qq
apt-get install -y -qq nginx certbot python3-certbot-nginx
systemctl enable nginx
systemctl start nginx
rm -f /etc/nginx/sites-enabled/default

# ── Personal Website config (stormewilliams.com) ─────────
echo "[3/5] Configuring Nginx for ${DOMAIN}..."
cat > /etc/nginx/sites-available/stormweb << NGINXCONF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    location / {
        proxy_pass http://localhost:3015;
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

# ── CHVC Assistant config (chvc.stormewilliams.com) ──────
echo "[4/5] Configuring Nginx for ${CHVC_SUB}..."
cat > /etc/nginx/sites-available/chvc << NGINXCONF
server {
    listen 80;
    server_name ${CHVC_SUB};

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

ln -sf /etc/nginx/sites-available/stormweb /etc/nginx/sites-enabled/stormweb
ln -sf /etc/nginx/sites-available/chvc /etc/nginx/sites-enabled/chvc
nginx -t && systemctl reload nginx
echo "      Nginx configured and running for both services."

# ── Done ─────────────────────────────────────────────────
echo ""
echo "[5/5] Setup complete!"
echo ""
echo "======================================================"
echo "  Both services are configured and ready."
echo ""
echo "  Once DNS is pointing to 87.99.146.54, run this"
echo "  to get free SSL for BOTH domains at once:"
echo ""
echo "  certbot --nginx \\"
echo "    -d ${DOMAIN} -d www.${DOMAIN} -d ${CHVC_SUB} \\"
echo "    --non-interactive --agree-tos \\"
echo "    -m your@email.com"
echo ""
echo "  Services:"
echo "    http://${DOMAIN}       → Personal website (port 3015)"
echo "    http://${CHVC_SUB}  → Crystal PM Assistant (port 3060)"
echo "======================================================"
