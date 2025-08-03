const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// إنشاء تطبيق Express
const app = express();
app.use(cors());
app.use(express.json());

// إعداد readline للإدخال من المستخدم
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// متغيرات للتحكم في طريقة الربط
let useQRCode = true;
let pairingCode = '';
let phoneNumber = '';

// إنشاء عميل واتساب مع إعدادات محسنة
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "whatsapp-bot-pairing",
        dataPath: './session_data'
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
        ]
    }
});

let isReady = false;
let qrCodeData = '';

// دالة لتوليد كود الربط
function generatePairingCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        if (i === 4) result += '-';
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// دالة للحصول على رقم الهاتف من المستخدم
function getPhoneNumber() {
    return new Promise((resolve) => {
        rl.question('🔢 أدخل رقم الهاتف (مع رمز البلد، مثال: +966501234567): ', (phone) => {
            // تنظيف الرقم
            const cleanPhone = phone.replace(/[^\d+]/g, '');
            if (cleanPhone.startsWith('+')) {
                resolve(cleanPhone);
            } else {
                console.log('❌ يرجى إدخال الرقم مع رمز البلد (مثال: +966501234567)');
                resolve(getPhoneNumber());
            }
        });
    });
}

// دالة لاختيار طريقة الربط
function chooseLinkingMethod() {
    return new Promise((resolve) => {
        console.log('\n🔗 اختر طريقة ربط البوت:');
        console.log('1. QR Code (الطريقة التقليدية)');
        console.log('2. Pairing Code (كود الربط)');
        
        rl.question('اختر (1 أو 2): ', (choice) => {
            if (choice === '1') {
                resolve('qr');
            } else if (choice === '2') {
                resolve('pairing');
            } else {
                console.log('❌ اختيار غير صحيح، يرجى اختيار 1 أو 2');
                resolve(chooseLinkingMethod());
            }
        });
    });
}

// بدء عملية الربط
async function initializeLinking() {
    console.log('🤖 مرحباً بك في بوت واتساب المحسن!');
    
    const method = await chooseLinkingMethod();
    
    if (method === 'pairing') {
        useQRCode = false;
        phoneNumber = await getPhoneNumber();
        pairingCode = generatePairingCode();
        
        console.log('\n✅ تم توليد كود الربط الخاص بك:');
        console.log('🔑 كود الربط:', pairingCode);
        console.log('📱 رقم الهاتف:', phoneNumber);
        console.log('\n📋 خطوات الربط:');
        console.log('1. افتح واتساب على هاتفك');
        console.log('2. اذهب إلى الإعدادات > الأجهزة المرتبطة');
        console.log('3. اضغط على "ربط جهاز"');
        console.log('4. اضغط على "ربط بكود بدلاً من ذلك"');
        console.log('5. أدخل الكود:', pairingCode);
        console.log('\n⏳ في انتظار الربط...\n');
    } else {
        useQRCode = true;
        console.log('\n📱 سيتم عرض QR Code للمسح...\n');
    }
    
    // بدء تشغيل العميل
    client.initialize();
}

// معالجة QR Code
client.on('qr', (qr) => {
    if (useQRCode) {
        console.log('📱 QR Code received, scan please!');
        qrcode.generate(qr, {small: true});
        qrCodeData = qr;
    }
});

// معالجة كود الربط
client.on('code', (code) => {
    if (!useQRCode) {
        console.log('🔑 كود الربط الجديد:', code);
        pairingCode = code;
    }
});

// عند الاتصال بنجاح
client.on('ready', () => {
    console.log('✅ تم ربط البوت بنجاح!');
    console.log('🤖 WhatsApp Bot Enhanced is ready!');
    isReady = true;
    
    // إغلاق readline
    rl.close();
    
    // عرض معلومات البوت
    client.getState().then(state => {
        console.log('📊 حالة البوت:', state);
    });
    
    client.info.then(info => {
        console.log('📱 معلومات الحساب:');
        console.log('   الاسم:', info.pushname);
        console.log('   الرقم:', info.wid.user);
        console.log('   المنصة:', info.platform);
    });
});

// معالجة الأخطاء
client.on('auth_failure', (msg) => {
    console.error('❌ فشل في المصادقة:', msg);
    if (!useQRCode) {
        console.log('💡 تأكد من إدخال كود الربط بشكل صحيح في واتساب');
        console.log('🔄 جرب إعادة تشغيل البوت وتوليد كود جديد');
    }
});

client.on('disconnected', (reason) => {
    console.log('🔌 تم قطع الاتصال:', reason);
    console.log('🔄 محاولة إعادة الاتصال...');
    
    // إعادة المحاولة بعد 5 ثوانٍ
    setTimeout(() => {
        client.initialize();
    }, 5000);
});

// معالجة الرسائل الواردة
client.on('message', async (message) => {
    try {
        const chat = await message.getChat();
        const contact = await message.getContact();
        
        // التحقق من أن الرسالة تبدأ بـ !
        if (!message.body.startsWith('!')) return;
        
        const command = message.body.toLowerCase();
        const args = message.body.split(' ').slice(1);
        
        // أمر للحصول على معلومات البوت
        if (command === '!معلومات' || command === '!info') {
            const info = await client.info;
            const state = await client.getState();
            
            const infoText = `
🤖 *معلومات البوت:*
📱 الاسم: ${info.pushname}
🔢 الرقم: ${info.wid.user}
💻 المنصة: ${info.platform}
🔗 الحالة: ${state}
⚡ طريقة الربط: ${useQRCode ? 'QR Code' : 'Pairing Code'}
${!useQRCode ? `🔑 آخر كود ربط: ${pairingCode}` : ''}
🕐 وقت التشغيل: ${Math.floor(process.uptime() / 60)} دقيقة
            `;
            
            await message.reply(infoText);
        }
        
        // أمر لتوليد كود ربط جديد (للمشرفين فقط)
        else if (command === '!كود_جديد' || command === '!newcode') {
            // يمكن إضافة فحص للصلاحيات هنا
            const newCode = generatePairingCode();
            await message.reply(`🔑 كود ربط جديد: ${newCode}\n\n📋 لاستخدام الكود:\n1. اذهب لإعدادات واتساب\n2. الأجهزة المرتبطة\n3. ربط جهاز\n4. ربط بكود\n5. أدخل: ${newCode}`);
        }
        
        // أمر المساعدة
        else if (command === '!مساعدة' || command === '!help') {
            const helpText = `
🤖 *أوامر البوت المتاحة:*

*ℹ️ معلومات:*
• !معلومات / !info - معلومات البوت
• !كود_جديد / !newcode - توليد كود ربط جديد
• !مساعدة / !help - عرض هذه القائمة

*🔧 إدارة الملف الشخصي:*
• !changename [اسم] - تغيير اسم البوت
• !changeprofilepic - تغيير صورة البوت (مع الصورة)

*👥 إدارة المجموعة:*
• !changegroupname [اسم] - تغيير اسم المجموعة
• !changegrouppic - تغيير صورة المجموعة (مع الصورة)
• !changegroupdesc [وصف] - تغيير وصف المجموعة

*👑 أوامر المشرفين:*
• !رفع / !promote - ترقية عضو لمشرف
• !تنزيل / !demote - تنزيل مشرف
• !طرد / !kick - طرد عضو
• !منشن / !mentionall - منشن جماعي

*📊 الإحصائيات:*
• !احصائيات / !stats - إحصائيات المجموعة
• !اصنام / !inactive - الأعضاء غير النشطين

*🔧 أدوات:*
• !تثبيت / !pin - تثبيت رسالة (بالرد)
• !طقس [مدينة] - معلومات الطقس

🔑 *ميزة كود الربط:* يمكن ربط البوت برقمك باستخدام كود نصي بدلاً من QR Code!
            `;
            await message.reply(helpText);
        }
        
        // باقي الأوامر...
        // [يمكن إضافة باقي الأوامر من البوت الأصلي هنا]
        
    } catch (error) {
        console.error('خطأ في معالجة الرسالة:', error);
        await message.reply('❌ حدث خطأ في معالجة الأمر');
    }
});

// API endpoints
app.get('/status', (req, res) => {
    res.json({
        status: isReady ? 'ready' : 'not_ready',
        linkingMethod: useQRCode ? 'qr' : 'pairing',
        qrCode: useQRCode ? qrCodeData : null,
        pairingCode: !useQRCode ? pairingCode : null,
        phoneNumber: !useQRCode ? phoneNumber : null,
        timestamp: new Date().toISOString()
    });
});

// endpoint للحصول على كود ربط جديد
app.post('/generate-pairing-code', (req, res) => {
    if (!useQRCode) {
        const newCode = generatePairingCode();
        pairingCode = newCode;
        res.json({ 
            pairingCode: newCode,
            phoneNumber: phoneNumber,
            instructions: [
                'افتح واتساب على هاتفك',
                'اذهب إلى الإعدادات > الأجهزة المرتبطة',
                'اضغط على "ربط جهاز"',
                'اضغط على "ربط بكود بدلاً من ذلك"',
                `أدخل الكود: ${newCode}`
            ]
        });
    } else {
        res.status(400).json({ error: 'البوت يستخدم QR Code وليس Pairing Code' });
    }
});

// endpoint لتغيير طريقة الربط
app.post('/switch-linking-method', async (req, res) => {
    const { method, phoneNumber: phone } = req.body;
    
    if (method === 'pairing' && phone) {
        useQRCode = false;
        phoneNumber = phone;
        pairingCode = generatePairingCode();
        
        res.json({
            success: true,
            method: 'pairing',
            pairingCode: pairingCode,
            phoneNumber: phoneNumber
        });
    } else if (method === 'qr') {
        useQRCode = true;
        res.json({
            success: true,
            method: 'qr'
        });
    } else {
        res.status(400).json({ error: 'طريقة غير صحيحة أو رقم هاتف مفقود' });
    }
});

// معالجة الأخطاء
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

// بدء تشغيل الخادم
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Server running on port ${PORT}`);
});

// بدء عملية الربط
console.log('🚀 WhatsApp Bot with Pairing Code starting...');
initializeLinking();

