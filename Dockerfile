# استخدام Node.js الرسمي
FROM node:18-alpine

# تثبيت المتطلبات الأساسية
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    curl

# إعداد Puppeteer لاستخدام Chromium المثبت
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# إنشاء مجلد التطبيق
WORKDIR /app

# نسخ ملفات package
COPY package*.json ./

# تثبيت التبعيات
RUN npm ci --only=production && npm cache clean --force

# نسخ ملفات التطبيق
COPY . .

# إنشاء المجلدات المطلوبة
RUN mkdir -p session_data bot_data logs

# تعيين الصلاحيات
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 && \
    chown -R nextjs:nodejs /app

USER nextjs

# فتح المنفذ
EXPOSE 3000

# تشغيل التطبيق
CMD ["node", "bot_improved.js"]

