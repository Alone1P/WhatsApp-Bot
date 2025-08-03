# دليل النشر والاستضافة - بوت واتساب

## 🚀 طرق النشر المختلفة

### 1. التشغيل المحلي

#### الطريقة السريعة:
```bash
# استنساخ المشروع
git clone https://github.com/Alone1P/WhatsApp-Bot.git
cd WhatsApp-Bot

# تشغيل البوت
./start.sh
```

#### الطريقة اليدوية:
```bash
# تثبيت تبعيات Node.js
npm install

# إنشاء بيئة Python افتراضية
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# أو
venv\Scripts\activate     # Windows

# تثبيت تبعيات Python
pip install -r requirements.txt

# تشغيل التطبيق
python src/main.py
```

### 2. الاستضافة على Heroku

#### خطوات النشر:

1. **إنشاء حساب Heroku:**
   - اذهب إلى [heroku.com](https://heroku.com)
   - أنشئ حساب جديد أو سجل دخول

2. **تثبيت Heroku CLI:**
   ```bash
   # Linux
   curl https://cli-assets.heroku.com/install.sh | sh
   
   # Windows
   # حمل من: https://devcenter.heroku.com/articles/heroku-cli
   ```

3. **تسجيل الدخول:**
   ```bash
   heroku login
   ```

4. **إنشاء تطبيق Heroku:**
   ```bash
   heroku create your-whatsapp-bot-name
   ```

5. **إضافة Buildpacks:**
   ```bash
   heroku buildpacks:add heroku/nodejs
   heroku buildpacks:add heroku/python
   ```

6. **نشر التطبيق:**
   ```bash
   git push heroku main
   ```

7. **فتح التطبيق:**
   ```bash
   heroku open
   ```

### 3. الاستضافة على Railway

1. **اذهب إلى [railway.app](https://railway.app)**
2. **سجل دخول باستخدام GitHub**
3. **اختر "New Project"**
4. **اختر "Deploy from GitHub repo"**
5. **اختر مستودع WhatsApp-Bot**
6. **Railway سيكتشف التكوين تلقائياً**

### 4. الاستضافة على Render

1. **اذهب إلى [render.com](https://render.com)**
2. **أنشئ حساب جديد**
3. **اختر "New Web Service"**
4. **اربط مستودع GitHub**
5. **استخدم الإعدادات التالية:**
   - **Build Command:** `npm install && pip install -r requirements.txt`
   - **Start Command:** `python src/main.py`

### 5. الاستضافة على VPS

#### متطلبات الخادم:
- Ubuntu 20.04+ أو CentOS 7+
- Node.js 16+
- Python 3.8+
- 1GB RAM على الأقل

#### خطوات التثبيت:

1. **تحديث النظام:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **تثبيت Node.js:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **تثبيت Python:**
   ```bash
   sudo apt install python3 python3-pip python3-venv -y
   ```

4. **استنساخ المشروع:**
   ```bash
   git clone https://github.com/Alone1P/WhatsApp-Bot.git
   cd WhatsApp-Bot
   ```

5. **تثبيت PM2:**
   ```bash
   sudo npm install -g pm2
   ```

6. **تشغيل البوت:**
   ```bash
   ./start.sh
   ```

7. **إعداد PM2 للتشغيل التلقائي:**
   ```bash
   pm2 start src/main.py --name whatsapp-bot --interpreter python3
   pm2 save
   pm2 startup
   ```

## 📱 كيفية ربط البوت بواتساب

### الطريقة الأولى: عبر الواجهة الويب

1. **افتح المتصفح واذهب إلى:**
   - محلياً: `http://localhost:5000`
   - على الخادم: `https://your-app-url.com`

2. **ستظهر لك صفحة بها:**
   - رمز QR كبير ومناسب للهاتف
   - تعليمات واضحة بالعربية
   - حالة الاتصال

3. **اتبع الخطوات المعروضة:**
   - افتح واتساب على هاتفك
   - اذهب إلى الإعدادات > الأجهزة المرتبطة
   - اضغط "ربط جهاز"
   - امسح رمز QR

### الطريقة الثانية: عبر الطرفية

1. **شاهد سجلات البوت:**
   ```bash
   # إذا كنت تستخدم PM2
   pm2 logs whatsapp-bot
   
   # أو إذا كنت تشغل البوت مباشرة
   node bot.js
   ```

2. **سيظهر رمز QR في الطرفية**
3. **امسحه بهاتفك**

## 🔧 إعدادات متقدمة

### متغيرات البيئة:

أنشئ ملف `.env` في المجلد الرئيسي:

```env
# إعدادات الخادم
PORT=5000

# إعدادات البوت
BOT_NAME=بوت واتساب المتقدم
ADMIN_NUMBERS=201234567890,201234567891

# إعدادات الأمان
MAX_WARNINGS=3
MUTE_DURATION_MINUTES=60
CLEANUP_DAYS=2
INACTIVE_DAYS=1

# مفاتيح API (اختيارية)
WEATHER_API_KEY=your_weather_api_key
TRANSLATE_API_KEY=your_translate_api_key
```

### إعداد Nginx (للـ VPS):

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### إعداد SSL مع Let's Encrypt:

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

## 🛠️ استكشاف الأخطاء

### مشاكل شائعة:

#### 1. البوت لا يبدأ:
```bash
# تحقق من السجلات
pm2 logs whatsapp-bot

# أعد تشغيل البوت
pm2 restart whatsapp-bot
```

#### 2. رمز QR لا يظهر:
```bash
# تحقق من حالة الخدمة
curl http://localhost:5000/status

# أعد تشغيل الخدمة
pm2 restart whatsapp-bot
```

#### 3. مشاكل الذاكرة:
```bash
# زيد حد الذاكرة
pm2 start src/main.py --name whatsapp-bot --max-memory-restart 1G
```

#### 4. مشاكل الشبكة:
```bash
# تحقق من المنافذ
netstat -tlnp | grep :5000
netstat -tlnp | grep :3000
```

## 📊 المراقبة والصيانة

### مراقبة الأداء:
```bash
# حالة العمليات
pm2 status

# استخدام الموارد
pm2 monit

# السجلات المباشرة
pm2 logs --lines 100
```

### النسخ الاحتياطي:
```bash
# نسخ احتياطي للبيانات
tar -czf backup-$(date +%Y%m%d).tar.gz .wwebjs_auth/

# استعادة النسخة الاحتياطية
tar -xzf backup-20240101.tar.gz
```

### التحديثات:
```bash
# تحديث الكود
git pull origin main

# إعادة تثبيت التبعيات
npm install
pip install -r requirements.txt

# إعادة تشغيل البوت
pm2 restart whatsapp-bot
```

## 🔒 الأمان

### نصائح الأمان:
1. **لا تشارك ملفات الجلسة** (`.wwebjs_auth/`)
2. **استخدم HTTPS** في الإنتاج
3. **قم بتحديث التبعيات** بانتظام
4. **راقب السجلات** للأنشطة المشبوهة
5. **استخدم جدار حماية** على الخادم

### تأمين الخادم:
```bash
# تحديث النظام
sudo apt update && sudo apt upgrade -y

# تثبيت جدار الحماية
sudo ufw enable
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
```

## 📞 الدعم

إذا واجهت أي مشاكل:
1. راجع هذا الدليل أولاً
2. تحقق من Issues في GitHub
3. افتح Issue جديد مع تفاصيل المشكلة
4. تواصل مع المطور

---

**ملاحظة مهمة:** تأكد من الامتثال لشروط خدمة واتساب عند استخدام البوت.

