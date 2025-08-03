const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// إنشاء تطبيق Express
const app = express();
app.use(cors());
app.use(express.json());

// متغيرات البوت
let isReady = false;
let pairingCode = '';
let phoneNumber = '';
let isWaitingForPairing = false;

// إنشاء عميل واتساب مع إعدادات محسنة
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "whatsapp-bot-pairing-only",
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

// قاعدة بيانات محسنة مع حفظ في الملفات
class BotDatabase {
    constructor() {
        this.dataDir = './bot_data';
        this.ensureDataDir();
        this.groupData = new Map();
        this.userWarnings = new Map();
        this.scheduledMessages = [];
        this.polls = new Map();
        this.reminders = [];
        this.rateLimits = new Map();
        this.loadData();
    }

    ensureDataDir() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
    }

    loadData() {
        try {
            // تحميل بيانات المجموعات
            const groupDataPath = path.join(this.dataDir, 'groups.json');
            if (fs.existsSync(groupDataPath)) {
                const data = JSON.parse(fs.readFileSync(groupDataPath, 'utf8'));
                this.groupData = new Map(Object.entries(data));
            }

            // تحميل التحذيرات
            const warningsPath = path.join(this.dataDir, 'warnings.json');
            if (fs.existsSync(warningsPath)) {
                const data = JSON.parse(fs.readFileSync(warningsPath, 'utf8'));
                this.userWarnings = new Map(Object.entries(data));
            }

            console.log('✅ تم تحميل البيانات المحفوظة');
        } catch (error) {
            console.error('❌ خطأ في تحميل البيانات:', error);
        }
    }

    saveData() {
        try {
            // حفظ بيانات المجموعات
            const groupDataObj = Object.fromEntries(this.groupData);
            fs.writeFileSync(
                path.join(this.dataDir, 'groups.json'),
                JSON.stringify(groupDataObj, null, 2)
            );

            // حفظ التحذيرات
            const warningsObj = Object.fromEntries(this.userWarnings);
            fs.writeFileSync(
                path.join(this.dataDir, 'warnings.json'),
                JSON.stringify(warningsObj, null, 2)
            );
        } catch (error) {
            console.error('❌ خطأ في حفظ البيانات:', error);
        }
    }

    getGroupData(chatId) {
        if (!this.groupData.has(chatId)) {
            this.groupData.set(chatId, {
                rules: '',
                welcomeMessage: '',
                antiSpam: false,
                linkFilter: false,
                lastActivity: {},
                mutedUsers: {},
                settings: {
                    autoDelete: false,
                    welcomeEnabled: true,
                    rulesEnabled: true
                }
            });
            this.saveData();
        }
        return this.groupData.get(chatId);
    }

    updateLastActivity(chatId, userId) {
        const data = this.getGroupData(chatId);
        data.lastActivity[userId] = new Date().toISOString();
        this.saveData();
    }

    checkRateLimit(userId) {
        const now = Date.now();
        if (!this.rateLimits.has(userId)) {
            this.rateLimits.set(userId, { count: 1, resetTime: now + 60000 });
            return true;
        }

        const limit = this.rateLimits.get(userId);
        if (now > limit.resetTime) {
            limit.count = 1;
            limit.resetTime = now + 60000;
            return true;
        }

        if (limit.count >= 10) {
            return false;
        }

        limit.count++;
        return true;
    }
}

const db = new BotDatabase();

// حفظ البيانات كل 5 دقائق
setInterval(() => {
    db.saveData();
}, 5 * 60 * 1000);

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

// دالة لبدء عملية الربط
async function startPairingProcess(phone) {
    phoneNumber = phone.replace(/[^\d+]/g, '');
    
    if (!phoneNumber.startsWith('+')) {
        throw new Error('رقم الهاتف يجب أن يبدأ بـ + ورمز البلد');
    }
    
    pairingCode = generatePairingCode();
    isWaitingForPairing = true;
    
    console.log('\n🔑 تم توليد كود الربط:');
    console.log('📱 رقم الهاتف:', phoneNumber);
    console.log('🔐 كود الربط:', pairingCode);
    console.log('\n📋 خطوات الربط:');
    console.log('1. افتح واتساب على هاتفك');
    console.log('2. اذهب إلى الإعدادات > الأجهزة المرتبطة');
    console.log('3. اضغط على "ربط جهاز"');
    console.log('4. اضغط على "ربط بكود بدلاً من ذلك"');
    console.log('5. أدخل الكود:', pairingCode);
    console.log('\n⏳ في انتظار الربط...\n');
    
    // بدء تشغيل العميل
    client.initialize();
    
    return {
        phoneNumber: phoneNumber,
        pairingCode: pairingCode,
        instructions: [
            'افتح واتساب على هاتفك',
            'اذهب إلى الإعدادات > الأجهزة المرتبطة',
            'اضغط على "ربط جهاز"',
            'اضغط على "ربط بكود بدلاً من ذلك"',
            `أدخل الكود: ${pairingCode}`
        ]
    };
}

// تجاهل QR Code تماماً
client.on('qr', (qr) => {
    // لا نفعل شيء مع QR Code
    console.log('🚫 تم تجاهل QR Code - نستخدم Pairing Code فقط');
});

// معالجة كود الربط
client.on('code', (code) => {
    console.log('🔑 كود الربط المُحدث:', code);
    pairingCode = code;
});

// عند الاتصال بنجاح
client.on('ready', () => {
    console.log('✅ تم ربط البوت بنجاح!');
    console.log('🤖 WhatsApp Bot (Pairing Code Only) is ready!');
    isReady = true;
    isWaitingForPairing = false;
    
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
    console.log('💡 تأكد من إدخال كود الربط بشكل صحيح في واتساب');
    console.log('🔄 يمكنك توليد كود جديد عبر API أو إعادة تشغيل البوت');
    isWaitingForPairing = false;
});

client.on('disconnected', (reason) => {
    console.log('🔌 تم قطع الاتصال:', reason);
    console.log('🔄 محاولة إعادة الاتصال...');
    isReady = false;
    
    // إعادة المحاولة بعد 5 ثوانٍ
    setTimeout(() => {
        if (phoneNumber) {
            client.initialize();
        }
    }, 5000);
});

// دالة للتحقق من صلاحيات المشرف
async function isAdmin(chat, userId) {
    try {
        const participant = chat.participants.find(p => p.id._serialized === userId);
        return participant && participant.isAdmin;
    } catch (error) {
        console.error('خطأ في التحقق من الصلاحيات:', error);
        return false;
    }
}

// معالجة الرسائل الواردة
client.on('message', async (message) => {
    try {
        const chat = await message.getChat();
        const contact = await message.getContact();
        const userId = contact.id._serialized;
        
        // تسجيل النشاط
        if (chat.isGroup) {
            db.updateLastActivity(chat.id._serialized, userId);
        }
        
        // التحقق من أن الرسالة تبدأ بـ .
        if (!message.body.startsWith('.')) return;
        
        // فحص معدل الاستخدام
        if (!db.checkRateLimit(userId)) {
            await message.reply('⚠️ تم تجاوز الحد المسموح من الأوامر. يرجى الانتظار دقيقة.');
            return;
        }
        
        const command = message.body.toLowerCase();
        const args = message.body.split(' ').slice(1);
        
        // أمر للحصول على معلومات البوت
        if (command === '.معلومات' || command === '.info') {
            const info = await client.info;
            const state = await client.getState();
            
            const infoText = `
🤖 *معلومات البوت:*
📱 الاسم: ${info.pushname}
🔢 الرقم: ${info.wid.user}
💻 المنصة: ${info.platform}
🔗 الحالة: ${state}
⚡ طريقة الربط: Pairing Code فقط
🔑 آخر كود ربط: ${pairingCode}
📱 رقم الربط: ${phoneNumber}
🕐 وقت التشغيل: ${Math.floor(process.uptime() / 60)} دقيقة
            `;
            
            await message.reply(infoText);
        }
        
        // أمر لتوليد كود ربط جديد
        else if (command === '.كود_جديد' || command === '.newcode') {
            const newCode = generatePairingCode();
            pairingCode = newCode;
            await message.reply(`🔑 كود ربط جديد: ${newCode}\n\n📋 لاستخدام الكود:\n1. اذهب لإعدادات واتساب\n2. الأجهزة المرتبطة\n3. ربط جهاز\n4. ربط بكود\n5. أدخل: ${newCode}`);
        }
        
        // أمر المساعدة
        else if (command === '.مساعدة' || command === '.help') {
            const helpText = `
🤖 *أوامر البوت المتاحة:*

*ℹ️ معلومات:*
• .معلومات / .info - معلومات البوت
• .كود_جديد / .newcode - توليد كود ربط جديد
• .مساعدة / .help - عرض هذه القائمة

*🔧 إدارة الملف الشخصي:*
• .changename [اسم] - تغيير اسم البوت
• .changeprofilepic - تغيير صورة البوت (مع الصورة)

*👥 إدارة المجموعة:*
• .changegroupname [اسم] - تغيير اسم المجموعة
• .changegrouppic - تغيير صورة المجموعة (مع الصورة)
• .changegroupdesc [وصف] - تغيير وصف المجموعة

*👑 أوامر المشرفين:*
• .رفع / .promote - ترقية عضو لمشرف (بالرد)
• .تنزيل / .demote - تنزيل مشرف (بالرد)
• .طرد / .kick - طرد عضو (بالرد)
• .منشن / .mentionall - منشن جماعي
• .تصفية / .cleanup - طرد الأعضاء غير النشطين

*📊 الإحصائيات:*
• .احصائيات / .stats - إحصائيات المجموعة
• .اصنام / .inactive - الأعضاء غير النشطين

*🔧 أدوات:*
• .تثبيت / .pin - تثبيت رسالة (بالرد)
• .الغاء_تثبيت / .unpin - إلغاء تثبيت (بالرد)
• .طقس [مدينة] - معلومات الطقس

*⚠️ التحذيرات:*
• .تحذير / .warn - إعطاء تحذير (بالرد)
• .عرض_تحذيرات / .warnings - عرض تحذيرات العضو

🔑 *ميزة خاصة:* هذا البوت يستخدم كود الربط فقط - لا حاجة لـ QR Code!
📝 *ملاحظة:* جميع الأوامر تبدأ بنقطة (.) بدلاً من علامة التعجب لسهولة الاستخدام!
            `;
            await message.reply(helpText);
        }
        
        // أوامر تغيير الملف الشخصي للبوت
        else if (command.startsWith('.changename ')) {
            const newName = message.body.substring(12);
            try {
                await client.setDisplayName(newName);
                await message.reply(`✅ تم تغيير اسم البوت إلى: ${newName}`);
            } catch (error) {
                await message.reply('❌ فشل في تغيير الاسم. تأكد من الصلاحيات.');
                console.error('Error changing name:', error);
            }
        }
        
        // تغيير صورة الملف الشخصي للبوت
        else if (command === '.changeprofilepic' && message.hasMedia) {
            try {
                const media = await message.downloadMedia();
                await client.setProfilePicture(media);
                await message.reply('✅ تم تغيير صورة الملف الشخصي');
            } catch (error) {
                await message.reply('❌ فشل في تغيير صورة الملف الشخصي');
                console.error('Error changing profile picture:', error);
            }
        }
        
        // أوامر المجموعات
        else if (chat.isGroup) {
            const data = db.getGroupData(chat.id._serialized);
            const userIsAdmin = await isAdmin(chat, userId);
            
            // تغيير اسم المجموعة
            if (command.startsWith('.changegroupname ')) {
                if (!userIsAdmin) {
                    await message.reply('❌ هذا الأمر متاح للمشرفين فقط');
                    return;
                }
                
                const newGroupName = message.body.substring(17);
                try {
                    await chat.setSubject(newGroupName);
                    await message.reply(`✅ تم تغيير اسم المجموعة إلى: ${newGroupName}`);
                } catch (error) {
                    await message.reply('❌ فشل في تغيير اسم المجموعة. تأكد من الصلاحيات.');
                }
            }
            
            // رفع/تنزيل بالرد على الرسالة
            else if (command === '.رفع' || command === '.promote') {
                if (!userIsAdmin) {
                    await message.reply('❌ هذا الأمر متاح للمشرفين فقط');
                    return;
                }
                
                if (message.hasQuotedMsg) {
                    const quotedMsg = await message.getQuotedMessage();
                    const quotedContact = await quotedMsg.getContact();
                    try {
                        await chat.promoteParticipants([quotedContact.id._serialized]);
                        await message.reply(`✅ تم ترقية @${quotedContact.number} لمشرف`);
                    } catch (error) {
                        await message.reply('❌ فشل في ترقية العضو');
                    }
                }
            }
            
            else if (command === '.تنزيل' || command === '.demote') {
                if (!userIsAdmin) {
                    await message.reply('❌ هذا الأمر متاح للمشرفين فقط');
                    return;
                }
                
                if (message.hasQuotedMsg) {
                    const quotedMsg = await message.getQuotedMessage();
                    const quotedContact = await quotedMsg.getContact();
                    try {
                        await chat.demoteParticipants([quotedContact.id._serialized]);
                        await message.reply(`✅ تم تنزيل @${quotedContact.number} من الإشراف`);
                    } catch (error) {
                        await message.reply('❌ فشل في تنزيل المشرف');
                    }
                }
            }
            
            // طرد بالرد على الرسالة
            else if (command === '.طرد' || command === '.kick') {
                if (!userIsAdmin) {
                    await message.reply('❌ هذا الأمر متاح للمشرفين فقط');
                    return;
                }
                
                if (message.hasQuotedMsg) {
                    const quotedMsg = await message.getQuotedMessage();
                    const quotedContact = await quotedMsg.getContact();
                    try {
                        await chat.removeParticipants([quotedContact.id._serialized]);
                        await message.reply(`✅ تم طرد @${quotedContact.number}`);
                    } catch (error) {
                        await message.reply('❌ فشل في طرد العضو');
                    }
                }
            }
            
            // منشن جماعي
            else if (command === '.منشن' || command === '.mentionall') {
                if (!userIsAdmin) {
                    await message.reply('❌ هذا الأمر متاح للمشرفين فقط');
                    return;
                }
                
                try {
                    const participants = chat.participants;
                    let mentions = [];
                    let text = '📢 منشن جماعي:\n';
                    
                    for (let participant of participants) {
                        const contact = await client.getContactById(participant.id._serialized);
                        mentions.push(contact);
                        text += `@${contact.number} `;
                    }
                    
                    await chat.sendMessage(text, { mentions });
                } catch (error) {
                    await message.reply('❌ فشل في المنشن الجماعي');
                }
            }
            
            // إحصائيات المجموعة
            else if (command === '.احصائيات' || command === '.stats') {
                try {
                    const participants = chat.participants;
                    const admins = participants.filter(p => p.isAdmin).length;
                    const members = participants.length - admins;
                    
                    const statsMessage = `
📊 *إحصائيات المجموعة:*
👥 إجمالي الأعضاء: ${participants.length}
👑 المشرفين: ${admins}
👤 الأعضاء: ${members}
📅 تاريخ الإنشاء: ${chat.createdAt ? new Date(chat.createdAt * 1000).toLocaleDateString('ar-EG') : 'غير متاح'}
                    `;
                    await message.reply(statsMessage);
                } catch (error) {
                    await message.reply('❌ فشل في عرض الإحصائيات');
                }
            }
        }
        
    } catch (error) {
        console.error('خطأ في معالجة الرسالة:', error);
        await message.reply('❌ حدث خطأ في معالجة الأمر');
    }
});

// API endpoints
app.get('/status', (req, res) => {
    res.json({
        status: isReady ? 'ready' : (isWaitingForPairing ? 'waiting_for_pairing' : 'not_initialized'),
        linkingMethod: 'pairing_only',
        pairingCode: pairingCode,
        phoneNumber: phoneNumber,
        isWaitingForPairing: isWaitingForPairing,
        timestamp: new Date().toISOString()
    });
});

// endpoint لبدء عملية الربط
app.post('/start-pairing', async (req, res) => {
    try {
        const { phoneNumber: phone } = req.body;
        
        if (!phone) {
            return res.status(400).json({ error: 'رقم الهاتف مطلوب' });
        }
        
        if (isReady) {
            return res.status(400).json({ error: 'البوت مربوط بالفعل' });
        }
        
        const result = await startPairingProcess(phone);
        res.json(result);
        
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// endpoint للحصول على كود ربط جديد
app.post('/generate-pairing-code', (req, res) => {
    if (!phoneNumber) {
        return res.status(400).json({ error: 'لم يتم تعيين رقم هاتف بعد' });
    }
    
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
});

// endpoint لإعادة تشغيل البوت
app.post('/restart', (req, res) => {
    res.json({ message: 'إعادة تشغيل البوت...' });
    
    setTimeout(() => {
        process.exit(0);
    }, 1000);
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
    console.log(`📱 لبدء عملية الربط، أرسل POST request إلى: http://localhost:${PORT}/start-pairing`);
    console.log(`📋 مع البيانات: {"phoneNumber": "+966501234567"}`);
});

console.log('🚀 WhatsApp Bot (Pairing Code Only) starting...');
console.log('🔑 هذا البوت يستخدم كود الربط فقط - لا حاجة لـ QR Code!');
console.log('📱 استخدم API لبدء عملية الربط أو قم بتعديل الكود لإدخال الرقم مباشرة');

