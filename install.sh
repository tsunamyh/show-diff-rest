#!/bin/bash

# ============================================
# Show-Diff-Rest Installation Script
# Ubuntu 22.04 LTS
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
    echo -e "${GREEN}[OK] $1${NC}"
}

print_error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

print_warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

print_info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    print_error "This script must be run as root! (sudo bash install.sh)"
fi

print_header "Welcome to Show-Diff-Rest Installation"

# Get user inputs
read -p "Enter your domain (e.g., example.com): " DOMAIN
if [[ -z "$DOMAIN" ]]; then
    print_error "Domain cannot be empty!"
fi

read -p "Enter email for Certbot: " EMAIL
if [[ -z "$EMAIL" ]]; then
    print_error "Email cannot be empty!"
fi

# Repository URL (hardcoded)
REPO_URL="https://github.com/tsunamyh/show-diff-rest.git"

read -p "Enter Node.js port (default: 3000): " NODE_PORT
NODE_PORT=${NODE_PORT:-3000}

INSTALL_PATH="/var/www/show-diff-rest"

echo ""
print_info "Configuration:"
echo "  - Domain: $DOMAIN"
echo "  - Email: $EMAIL"
echo "  - Repository: $REPO_URL"
echo "  - Port: $NODE_PORT"
echo "  - Path: $INSTALL_PATH"
echo ""

read -p "Continue? (y/n): " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
    echo -e "${RED}[CANCELLED] Installation cancelled${NC}"
    exit 1
fi

# ============================================
# 1. Update System
# ============================================
print_header "Step 1: Update System"
apt update -qq
apt upgrade -y -qq
print_success "System updated"

# ============================================
# 2. Install Node.js
# ============================================
print_header "Step 2: Install Node.js"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
    apt install -y nodejs -qq > /dev/null 2>&1
    print_success "Node.js $(node -v) installed"
else
    print_success "Node.js $(node -v) already installed"
fi

# ============================================
# 3. Install pnpm
# ============================================
print_header "Step 3: Install pnpm"
if ! command -v pnpm &> /dev/null; then
    npm install -g pnpm -q > /dev/null 2>&1
    print_success "pnpm installed"
else
    print_success "pnpm already installed"
fi

# ============================================
# 4. Install PM2
# ============================================
print_header "Step 4: Install PM2"
npm install -g pm2 -q > /dev/null 2>&1
print_success "PM2 installed"

# ============================================
# 5. Create Installation Directory
# ============================================
print_header "Step 5: Prepare Installation Directory"
if [ -d "$INSTALL_PATH/.git" ]; then
    print_info "Project already exists, updating..."
    cd "$INSTALL_PATH"
    git pull origin main -q > /dev/null 2>&1
else
    mkdir -p "$INSTALL_PATH"
    cd "$INSTALL_PATH"
    git clone "$REPO_URL" . > /dev/null 2>&1
fi
print_success "Directory prepared: $INSTALL_PATH"

# ============================================
# 6. Install Dependencies
# ============================================
print_header "Step 6: Install Dependencies"
pnpm install > /dev/null 2>&1
print_success "Dependencies installed"

# ============================================
# 7. Build Project
# ============================================
print_header "Step 7: Build Project"
npm run build > /dev/null 2>&1
print_success "Project built"

# ============================================
# 8. Install Apache
# ============================================
print_header "Step 8: Install Apache and Modules"
apt install -y apache2 certbot python3-certbot-apache -qq > /dev/null 2>&1

a2enmod proxy > /dev/null 2>&1
a2enmod proxy_http > /dev/null 2>&1
a2enmod proxy_wstunnel > /dev/null 2>&1
a2enmod rewrite > /dev/null 2>&1
a2enmod ssl > /dev/null 2>&1
a2enmod headers > /dev/null 2>&1

print_success "Apache and modules installed"

# ============================================
# 9. Create Apache Virtual Host
# ============================================
print_header "Step 9: Configure Virtual Host"

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
    print_error "Apache config error!"
fi

print_success "Virtual Host configured"

# ============================================
# 10. Get SSL Certificate
# ============================================
print_header "Step 10: Get SSL Certificate"

if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    certbot certonly --apache -d "$DOMAIN" -d "www.$DOMAIN" --email "$EMAIL" --agree-tos --non-interactive > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        print_success "SSL Certificate obtained"
    else
        print_warning "SSL failed - try later: certbot certonly --apache -d $DOMAIN"
    fi
else
    print_success "SSL Certificate already exists"
fi

# ============================================
# 11. Restart Apache
# ============================================
print_header "Step 11: Enable Apache"
systemctl restart apache2
systemctl enable apache2 > /dev/null 2>&1
print_success "Apache enabled"

# ============================================
# 12. Setup PM2
# ============================================
print_header "Step 12: Setup PM2"
cd "$INSTALL_PATH"
pm2 delete show-diff-rest > /dev/null 2>&1 || true
pm2 start "npm start" --name "show-diff-rest" --cwd "$INSTALL_PATH" > /dev/null 2>&1
pm2 startup systemd -u root --hp /root > /dev/null 2>&1
pm2 save > /dev/null 2>&1
print_success "PM2 configured"

# ============================================
# 13. Auto Renewal
# ============================================
print_header "Step 13: Setup Auto Renewal"
systemctl enable certbot.timer > /dev/null 2>&1
systemctl start certbot.timer > /dev/null 2>&1
print_success "Auto renewal enabled"

# ============================================
# 14. Firewall
# ============================================
print_header "Step 14: Configure Firewall"
if command -v ufw &> /dev/null; then
    ufw allow 22/tcp > /dev/null 2>&1
    ufw allow 80/tcp > /dev/null 2>&1
    ufw allow 443/tcp > /dev/null 2>&1
    print_success "Firewall configured"
fi

# ============================================
# Final Summary
# ============================================
print_header "Installation Complete!"

echo ""
echo -e "${GREEN}Success! Your project is ready!${NC}"
echo ""
echo -e "${BLUE}Access:${NC}"
echo "   https://$DOMAIN"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo "   pm2 status              # Check status"
echo "   pm2 logs show-diff-rest # View logs"
echo "   pm2 restart show-diff-rest"
echo ""
echo -e "${BLUE}Apache Logs:${NC}"
echo "   tail -f /var/log/apache2/show-diff-rest-error.log"
echo ""

sleep 15

print_info "Checking status..."

if systemctl is-active --quiet apache2; then
    print_success "Apache: RUNNING"
else
    print_warning "Apache: NOT RUNNING"
fi

if pm2 list 2>&1 | grep -q "show-diff-rest"; then
    print_success "Node.js: RUNNING"
else
    print_warning "Node.js: NOT RUNNING"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Installation Successful! Enjoy!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
