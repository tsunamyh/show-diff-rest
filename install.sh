#!/bin/bash

# ============================================
# Show-Diff-Rest Installation Script
# برای Ubuntu 22.04 LTS
# ============================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Functions
print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
    exit 1
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    print_error "این اسکریپت باید به عنوان root اجرا شود! (sudo bash install.sh)"
fi

print_header "🚀 خوش آمدید به نصب Show-Diff-Rest"

# Get user inputs
read -p "▶ دامین شما (مثال: example.com): " DOMAIN
if [[ -z "$DOMAIN" ]]; then
    print_error "دامین خالی است!"
fi

read -p "▶ ایمیل برای Certbot: " EMAIL
if [[ -z "$EMAIL" ]]; then
    print_error "ایمیل خالی است!"
fi

read -p "▶ GitHub Repository URL: " REPO_URL
if [[ -z "$REPO_URL" ]]; then
    print_error "Repository خالی است!"
fi

read -p "▶ پورت Node.js (پیشفرض: 3000): " NODE_PORT
NODE_PORT=${NODE_PORT:-3000}

INSTALL_PATH="/var/www/show-diff-rest"

echo ""
print_info "تنظیمات نهایی:"
echo "  • دامین: $DOMAIN"
echo "  • ایمیل: $EMAIL"
echo "  • Repository: $REPO_URL"
echo "  • پورت: $NODE_PORT"
echo "  • مسیر: $INSTALL_PATH"
echo ""

read -p "▶ ادامه دهم؟ (y/n): " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
    print_error "نصب لغو شد"
fi

# ============================================
# 1. Update System
# ============================================
print_header "1️⃣ بروزرسانی سیستم"
apt update -qq
apt upgrade -y -qq
print_success "سیستم بروزرسانی شد"

# ============================================
# 2. Install Node.js
# ============================================
print_header "2️⃣ نصب Node.js"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
    apt install -y nodejs -qq > /dev/null 2>&1
    print_success "Node.js $(node -v) نصب شد"
else
    print_success "Node.js $(node -v) قبلاً نصب است"
fi

# ============================================
# 3. Install pnpm
# ============================================
print_header "3️⃣ نصب pnpm"
if ! command -v pnpm &> /dev/null; then
    npm install -g pnpm -q > /dev/null 2>&1
    print_success "pnpm نصب شد"
else
    print_success "pnpm قبلاً نصب است"
fi

# ============================================
# 4. Install PM2
# ============================================
print_header "4️⃣ نصب PM2"
npm install -g pm2 -q > /dev/null 2>&1
print_success "PM2 نصب شد"

# ============================================
# 5. Create Installation Directory
# ============================================
print_header "5️⃣ آماده‌سازی مسیر نصب"
if [ -d "$INSTALL_PATH/.git" ]; then
    print_info "پروژه قبلاً وجود دارد،업데이트می‌شود..."
    cd "$INSTALL_PATH"
    git pull origin main -q > /dev/null 2>&1
else
    mkdir -p "$INSTALL_PATH"
    cd "$INSTALL_PATH"
    git clone "$REPO_URL" . > /dev/null 2>&1
fi
print_success "مسیر آماده شد: $INSTALL_PATH"

# ============================================
# 6. Install Dependencies
# ============================================
print_header "6️⃣ نصب وابستگی‌ها"
pnpm install > /dev/null 2>&1
print_success "Dependencies نصب شد"

# ============================================
# 7. Build Project
# ============================================
print_header "7️⃣ کامپایل پروژه"
npm run build > /dev/null 2>&1
print_success "پروژه کامپایل شد"

# ============================================
# 8. Install Apache
# ============================================
print_header "8️⃣ نصب Apache و Modules"
apt install -y apache2 certbot python3-certbot-apache -qq > /dev/null 2>&1

a2enmod proxy > /dev/null 2>&1
a2enmod proxy_http > /dev/null 2>&1
a2enmod proxy_wstunnel > /dev/null 2>&1
a2enmod rewrite > /dev/null 2>&1
a2enmod ssl > /dev/null 2>&1
a2enmod headers > /dev/null 2>&1

print_success "Apache و Modules نصب شد"

# ============================================
# 9. Create Apache Virtual Host
# ============================================
print_header "9️⃣ تنظیم Virtual Host"

APACHE_CONF="/etc/apache2/sites-available/show-diff-rest.conf"

cat > "$APACHE_CONF" << EOF
<VirtualHost *:80>
    ServerName $DOMAIN
    ServerAlias www.$DOMAIN
    
    RewriteEngine On
    RewriteRule ^(.*)$ https://%{HTTP_HOST}\$1 [R=301,L]
    
    ErrorLog \${APACHE_LOG_DIR}/show-diff-rest-error.log
    CustomLog \${APACHE_LOG_DIR}/show-diff-rest-access.log combined
</VirtualHost>

<VirtualHost *:443>
    ServerName $DOMAIN
    ServerAlias www.$DOMAIN
    ServerAdmin $EMAIL

    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/$DOMAIN/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/$DOMAIN/privkey.pem
    
    SSLProtocol -all +TLSv1.2 +TLSv1.3
    SSLCipherSuite ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256

    ProxyPreserveHost On
    ProxyPass / http://localhost:$NODE_PORT/
    ProxyPassReverse / http://localhost:$NODE_PORT/

    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/(.*) "ws://localhost:$NODE_PORT/\$1" [P,L]

    RequestHeader set X-Forwarded-Proto "https"
    RequestHeader set X-Forwarded-Host "%{HTTP_HOST}s"
    RequestHeader set X-Real-IP "%{REMOTE_ADDR}s"

    Header set X-Content-Type-Options "nosniff"
    Header set X-Frame-Options "SAMEORIGIN"
    Header set X-XSS-Protection "1; mode=block"

    ErrorLog \${APACHE_LOG_DIR}/show-diff-rest-error.log
    CustomLog \${APACHE_LOG_DIR}/show-diff-rest-access.log combined
</VirtualHost>
EOF

a2dissite 000-default.conf > /dev/null 2>&1 || true
a2ensite show-diff-rest.conf > /dev/null 2>&1

if ! apache2ctl configtest 2>&1 | grep -q "Syntax OK"; then
    print_error "Apache config خطا دارد!"
fi

print_success "Virtual Host تنظیم شد"

# ============================================
# 10. Get SSL Certificate
# ============================================
print_header "🔟 دریافت SSL Certificate"

if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    certbot certonly --apache -d "$DOMAIN" -d "www.$DOMAIN" --email "$EMAIL" --agree-tos --non-interactive > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        print_success "SSL Certificate دریافت شد"
    else
        print_warning "SSL دریافت نشد - بعداً سعی کنید:"
        echo "   certbot certonly --apache -d $DOMAIN"
    fi
else
    print_success "SSL Certificate قبلاً وجود دارد"
fi

# ============================================
# 11. Restart Apache
# ============================================
print_header "1️⃣1️⃣ فعال‌سازی Apache"
systemctl restart apache2
systemctl enable apache2 > /dev/null 2>&1
print_success "Apache فعال شد"

# ============================================
# 12. Setup PM2
# ============================================
print_header "1️⃣2️⃣ تنظیم PM2"
cd "$INSTALL_PATH"
pm2 delete show-diff-rest > /dev/null 2>&1 || true
pm2 start "npm start" --name "show-diff-rest" --cwd "$INSTALL_PATH" > /dev/null 2>&1
pm2 startup systemd -u root --hp /root > /dev/null 2>&1
pm2 save > /dev/null 2>&1
print_success "PM2 تنظیم شد"

# ============================================
# 13. Auto Renewal
# ============================================
print_header "1️⃣3️⃣ تنظیم Auto Renewal"
systemctl enable certbot.timer > /dev/null 2>&1
systemctl start certbot.timer > /dev/null 2>&1
print_success "Auto Renewal فعال شد"

# ============================================
# 14. Firewall
# ============================================
print_header "1️⃣4️⃣ تنظیم Firewall"
if command -v ufw &> /dev/null; then
    ufw allow 22/tcp > /dev/null 2>&1
    ufw allow 80/tcp > /dev/null 2>&1
    ufw allow 443/tcp > /dev/null 2>&1
    print_success "Firewall تنظیم شد"
fi

# ============================================
# Final Summary
# ============================================
print_header "✅ نصب کامل شد!"

echo ""
echo -e "${GREEN}🎉 پروژه شما آماده است!${NC}"
echo ""
echo -e "${BLUE}📍 دسترسی:${NC}"
echo "   https://$DOMAIN"
echo ""
echo -e "${BLUE}📊 دستورات مفید:${NC}"
echo "   pm2 status              # وضعیت"
echo "   pm2 logs show-diff-rest # مشاهده لاگ‌ها"
echo "   pm2 restart show-diff-rest"
echo ""
echo -e "${BLUE}📋 لاگ‌های Apache:${NC}"
echo "   tail -f /var/log/apache2/show-diff-rest-error.log"
echo ""

sleep 15

print_info "بررسی وضعیت..."

if systemctl is-active --quiet apache2; then
    print_success "Apache: فعال ✓"
else
    print_warning "Apache: غیرفعال ✗"
fi

if pm2 list 2>&1 | grep -q "show-diff-rest"; then
    print_success "Node.js: فعال ✓"
else
    print_warning "Node.js: غیرفعال ✗"
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}نصب موفقیت‌آمیز بود! 🚀${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
