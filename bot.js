const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// إنشاء تطبيق Express
const app = express();
app.use(cors());
app.use(express.json());

// إنشاء عميل واتساب
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "whatsapp-bot"
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
            '--disable-gpu'
        ]
    }
});

let isReady = false;
let qrCodeData = '';

// قاعدة بيانات بسيطة في الذاكرة
const groupData = new Map();
const userWarnings = new Map();
const scheduledMessages = [];
const polls = new Map();
const reminders = [];

// عرض رمز QR للمصادقة
client.on('qr', (qr) => {
    console.log('QR Code received, scan please!');
    qrcode.generate(qr, {small: true});
    qrCodeData = qr;
});

// عند الاتصال بنجاح
client.on('ready', () => {
    console.log('WhatsApp Bot is ready!');
    isReady = true;
    
    // بدء مراقبة الرسائل المجدولة والتذكيرات
    setInterval(checkScheduledMessages, 60000); // كل دقيقة
    setInterval(checkReminders, 60000); // كل دقيقة
});

// دالة للحصول على معلومات المجموعة
function getGroupData(chatId) {
    if (!groupData.has(chatId)) {
        groupData.set(chatId, {
            rules: '',
            welcomeMessage: '',
            antiSpam: false,
            linkFilter: false,
            lastActivity: new Map(),
            mutedUsers: new Map()
        });
    }
    return groupData.get(chatId);
}

// دالة للتحقق من الرسائل المجدولة
async function checkScheduledMessages() {
    const now = new Date();
    for (let i = scheduledMessages.length - 1; i >= 0; i--) {
        const msg = scheduledMessages[i];
        if (now >= msg.time) {
            try {
                const chat = await client.getChatById(msg.chatId);
                await chat.sendMessage(msg.message);
                scheduledMessages.splice(i, 1);
            } catch (error) {
                console.error('Error sending scheduled message:', error);
            }
        }
    }
}

// دالة للتحقق من التذكيرات
async function checkReminders() {
    const now = new Date();
    for (let i = reminders.length - 1; i >= 0; i--) {
        const reminder = reminders[i];
        if (now >= reminder.time) {
            try {
                const chat = await client.getChatById(reminder.chatId);
                await chat.sendMessage(`🔔 تذكير: ${reminder.message}`);
                reminders.splice(i, 1);
            } catch (error) {
                console.error('Error sending reminder:', error);
            }
        }
    }
}

// دالة للحصول على معلومات الطقس (مبسطة)
async function getWeather(city) {
    // هنا يمكن إضافة API حقيقي للطقس
    return `🌤️ الطقس في ${city}: مشمس، 25°C`;
}

// دالة للترجمة (مبسطة)
async function translateText(text, targetLang) {
    // هنا يمكن إضافة API حقيقي للترجمة
    return `[ترجمة إلى ${targetLang}]: ${text}`;
}

// معالجة الرسائل الواردة
client.on('message', async (message) => {
    try {
        const chat = await message.getChat();
        const contact = await message.getContact();
        
        // تسجيل النشاط
        if (chat.isGroup) {
            const data = getGroupData(chat.id._serialized);
            data.lastActivity.set(contact.id._serialized, new Date());
        }
        
        // التحقق من أن الرسالة تبدأ بـ !
        if (!message.body.startsWith('!')) return;
        
        const command = message.body.toLowerCase();
        const args = message.body.split(' ').slice(1);
        
        // أوامر تغيير الملف الشخصي للبوت
        if (command.startsWith('!changename ')) {
            const newName = message.body.substring(12);
            try {
                await client.setDisplayName(newName);
                await message.reply(`✅ تم تغيير اسم البوت إلى: ${newName}`);
            } catch (error) {
                await message.reply('❌ فشل في تغيير الاسم');
                console.error('Error changing name:', error);
            }
        }
        
        // تغيير صورة الملف الشخصي للبوت
        else if (command === '!changeprofilepic' && message.hasMedia) {
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
            const data = getGroupData(chat.id._serialized);
            
            // تغيير اسم المجموعة
            if (command.startsWith('!changegroupname ')) {
                const newGroupName = message.body.substring(17);
                try {
                    await chat.setSubject(newGroupName);
                    await message.reply(`✅ تم تغيير اسم المجموعة إلى: ${newGroupName}`);
                } catch (error) {
                    await message.reply('❌ فشل في تغيير اسم المجموعة');
                }
            }
            
            // تغيير صورة المجموعة
            else if (command === '!changegrouppic' && message.hasMedia) {
                try {
                    const media = await message.downloadMedia();
                    await chat.setPicture(media);
                    await message.reply('✅ تم تغيير صورة المجموعة');
                } catch (error) {
                    await message.reply('❌ فشل في تغيير صورة المجموعة');
                }
            }
            
            // تغيير وصف المجموعة
            else if (command.startsWith('!changegroupdesc ')) {
                const newDescription = message.body.substring(17);
                try {
                    await chat.setDescription(newDescription);
                    await message.reply(`✅ تم تغيير وصف المجموعة`);
                } catch (error) {
                    await message.reply('❌ فشل في تغيير وصف المجموعة');
                }
            }
            
            // رفع/تنزيل بالرد على الرسالة
            else if (command === '!رفع' || command === '!promote') {
                if (message.hasQuotedMsg) {
                    const quotedMsg = await message.getQuotedMessage();
                    const quotedContact = await quotedMsg.getContact();
                    try {
                        await chat.promoteParticipants([quotedContact.id._serialized]);
                        await message.reply(`✅ تم ترقية @${quotedContact.number} لمشرف`);
                    } catch (error) {
                        await message.reply('❌ فشل في ترقية العضو');
                    }
                } else if (args[0]) {
                    const phoneNumber = args[0].replace(/\D/g, '');
                    try {
                        await chat.promoteParticipants([`${phoneNumber}@c.us`]);
                        await message.reply(`✅ تم ترقية ${phoneNumber} لمشرف`);
                    } catch (error) {
                        await message.reply('❌ فشل في ترقية العضو');
                    }
                }
            }
            
            else if (command === '!تنزيل' || command === '!demote') {
                if (message.hasQuotedMsg) {
                    const quotedMsg = await message.getQuotedMessage();
                    const quotedContact = await quotedMsg.getContact();
                    try {
                        await chat.demoteParticipants([quotedContact.id._serialized]);
                        await message.reply(`✅ تم تنزيل @${quotedContact.number} من الإشراف`);
                    } catch (error) {
                        await message.reply('❌ فشل في تنزيل المشرف');
                    }
                } else if (args[0]) {
                    const phoneNumber = args[0].replace(/\D/g, '');
                    try {
                        await chat.demoteParticipants([`${phoneNumber}@c.us`]);
                        await message.reply(`✅ تم تنزيل ${phoneNumber} من الإشراف`);
                    } catch (error) {
                        await message.reply('❌ فشل في تنزيل المشرف');
                    }
                }
            }
            
            // طرد بالرد على الرسالة
            else if (command === '!طرد' || command === '!kick') {
                if (message.hasQuotedMsg) {
                    const quotedMsg = await message.getQuotedMessage();
                    const quotedContact = await quotedMsg.getContact();
                    try {
                        await chat.removeParticipants([quotedContact.id._serialized]);
                        await message.reply(`✅ تم طرد @${quotedContact.number}`);
                    } catch (error) {
                        await message.reply('❌ فشل في طرد العضو');
                    }
                } else if (args[0]) {
                    const phoneNumber = args[0].replace(/\D/g, '');
                    try {
                        await chat.removeParticipants([`${phoneNumber}@c.us`]);
                        await message.reply(`✅ تم طرد ${phoneNumber}`);
                    } catch (error) {
                        await message.reply('❌ فشل في طرد العضو');
                    }
                }
            }
            
            // منشن جماعي
            else if (command === '!منشن' || command === '!mentionall') {
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
            
            // تثبيت الرسائل
            else if (command === '!تثبيت' || command === '!pin') {
                if (message.hasQuotedMsg) {
                    try {
                        const quotedMsg = await message.getQuotedMessage();
                        await quotedMsg.pin();
                        await message.reply('✅ تم تثبيت الرسالة');
                    } catch (error) {
                        await message.reply('❌ فشل في تثبيت الرسالة');
                    }
                }
            }
            
            // إلغاء تثبيت
            else if (command === '!الغاء_تثبيت' || command === '!unpin') {
                if (message.hasQuotedMsg) {
                    try {
                        const quotedMsg = await message.getQuotedMessage();
                        await quotedMsg.unpin();
                        await message.reply('✅ تم إلغاء تثبيت الرسالة');
                    } catch (error) {
                        await message.reply('❌ فشل في إلغاء التثبيت');
                    }
                }
            }
            
            // تصفية (طرد من لم يرسل رسالة منذ يومين)
            else if (command === '!تصفية' || command === '!cleanup') {
                try {
                    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
                    const participants = chat.participants;
                    let removedCount = 0;
                    
                    for (let participant of participants) {
                        const lastActivity = data.lastActivity.get(participant.id._serialized);
                        if (!lastActivity || lastActivity < twoDaysAgo) {
                            try {
                                await chat.removeParticipants([participant.id._serialized]);
                                removedCount++;
                            } catch (error) {
                                console.error('Error removing inactive member:', error);
                            }
                        }
                    }
                    
                    await message.reply(`✅ تم طرد ${removedCount} عضو غير نشط`);
                } catch (error) {
                    await message.reply('❌ فشل في التصفية');
                }
            }
            
            // أصنام (منشن من لم يرسل رسالة منذ يوم)
            else if (command === '!اصنام' || command === '!inactive') {
                try {
                    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                    const participants = chat.participants;
                    let mentions = [];
                    let text = '🗿 الأصنام (غير نشطين منذ يوم):\n';
                    
                    for (let participant of participants) {
                        const lastActivity = data.lastActivity.get(participant.id._serialized);
                        if (!lastActivity || lastActivity < oneDayAgo) {
                            const contact = await client.getContactById(participant.id._serialized);
                            mentions.push(contact);
                            text += `@${contact.number} `;
                        }
                    }
                    
                    if (mentions.length > 0) {
                        await chat.sendMessage(text, { mentions });
                    } else {
                        await message.reply('✅ جميع الأعضاء نشطين!');
                    }
                } catch (error) {
                    await message.reply('❌ فشل في عرض الأصنام');
                }
            }
            
            // إحصائيات المجموعة
            else if (command === '!احصائيات' || command === '!stats') {
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
            
            // ترحيب تلقائي
            else if (command.startsWith('!ترحيب ') || command.startsWith('!welcome ')) {
                const welcomeMsg = message.body.substring(command.startsWith('!ترحيب') ? 8 : 9);
                data.welcomeMessage = welcomeMsg;
                await message.reply('✅ تم تعيين رسالة الترحيب');
            }
            
            // قواعد المجموعة
            else if (command.startsWith('!قواعد ') || command.startsWith('!rules ')) {
                const rules = message.body.substring(command.startsWith('!قواعد') ? 7 : 7);
                data.rules = rules;
                await message.reply('✅ تم حفظ قواعد المجموعة');
            }
            
            else if (command === '!عرض_قواعد' || command === '!showrules') {
                if (data.rules) {
                    await message.reply(`📋 *قواعد المجموعة:*\n${data.rules}`);
                } else {
                    await message.reply('❌ لم يتم تعيين قواعد للمجموعة');
                }
            }
            
            // نظام التحذيرات
            else if (command === '!تحذير' || command === '!warn') {
                if (message.hasQuotedMsg) {
                    const quotedMsg = await message.getQuotedMessage();
                    const quotedContact = await quotedMsg.getContact();
                    const userId = quotedContact.id._serialized;
                    
                    if (!userWarnings.has(userId)) {
                        userWarnings.set(userId, 0);
                    }
                    
                    const warnings = userWarnings.get(userId) + 1;
                    userWarnings.set(userId, warnings);
                    
                    await message.reply(`⚠️ تم إعطاء تحذير لـ @${quotedContact.number}\nعدد التحذيرات: ${warnings}/3`);
                    
                    if (warnings >= 3) {
                        try {
                            await chat.removeParticipants([userId]);
                            userWarnings.delete(userId);
                            await message.reply(`🚫 تم طرد @${quotedContact.number} بعد 3 تحذيرات`);
                        } catch (error) {
                            await message.reply('❌ فشل في طرد العضو');
                        }
                    }
                }
            }
            
            // كتم مؤقت
            else if (command.startsWith('!كتم ') || command.startsWith('!mute ')) {
                if (message.hasQuotedMsg && args[0]) {
                    const quotedMsg = await message.getQuotedMessage();
                    const quotedContact = await quotedMsg.getContact();
                    const duration = parseInt(args[0]) || 60; // دقائق
                    const muteUntil = new Date(Date.now() + duration * 60 * 1000);
                    
                    data.mutedUsers.set(quotedContact.id._serialized, muteUntil);
                    await message.reply(`🔇 تم كتم @${quotedContact.number} لمدة ${duration} دقيقة`);
                }
            }
            
            // جدولة رسالة
            else if (command.startsWith('!جدولة ') || command.startsWith('!schedule ')) {
                const parts = message.body.split(' ');
                if (parts.length >= 3) {
                    const time = parts[1]; // HH:MM
                    const msg = parts.slice(2).join(' ');
                    
                    const [hours, minutes] = time.split(':').map(Number);
                    const scheduleTime = new Date();
                    scheduleTime.setHours(hours, minutes, 0, 0);
                    
                    if (scheduleTime <= new Date()) {
                        scheduleTime.setDate(scheduleTime.getDate() + 1);
                    }
                    
                    scheduledMessages.push({
                        chatId: chat.id._serialized,
                        message: msg,
                        time: scheduleTime
                    });
                    
                    await message.reply(`⏰ تم جدولة الرسالة للساعة ${time}`);
                }
            }
            
            // استطلاع رأي
            else if (command.startsWith('!استطلاع ') || command.startsWith('!poll ')) {
                const pollText = message.body.substring(command.startsWith('!استطلاع') ? 10 : 6);
                const pollId = Date.now().toString();
                
                polls.set(pollId, {
                    question: pollText,
                    votes: { yes: 0, no: 0 },
                    voters: new Set()
                });
                
                await message.reply(`📊 *استطلاع رأي:*\n${pollText}\n\nللتصويت:\n✅ !نعم ${pollId}\n❌ !لا ${pollId}`);
            }
            
            // التصويت
            else if (command.startsWith('!نعم ') || command.startsWith('!yes ')) {
                const pollId = args[0];
                if (polls.has(pollId)) {
                    const poll = polls.get(pollId);
                    const voterId = contact.id._serialized;
                    
                    if (!poll.voters.has(voterId)) {
                        poll.votes.yes++;
                        poll.voters.add(voterId);
                        await message.reply('✅ تم تسجيل صوتك: نعم');
                    } else {
                        await message.reply('❌ لقد صوتت مسبقاً');
                    }
                }
            }
            
            else if (command.startsWith('!لا ') || command.startsWith('!no ')) {
                const pollId = args[0];
                if (polls.has(pollId)) {
                    const poll = polls.get(pollId);
                    const voterId = contact.id._serialized;
                    
                    if (!poll.voters.has(voterId)) {
                        poll.votes.no++;
                        poll.voters.add(voterId);
                        await message.reply('❌ تم تسجيل صوتك: لا');
                    } else {
                        await message.reply('❌ لقد صوتت مسبقاً');
                    }
                }
            }
            
            // نتائج الاستطلاع
            else if (command.startsWith('!نتائج ') || command.startsWith('!results ')) {
                const pollId = args[0];
                if (polls.has(pollId)) {
                    const poll = polls.get(pollId);
                    const total = poll.votes.yes + poll.votes.no;
                    
                    await message.reply(`📊 *نتائج الاستطلاع:*\n${poll.question}\n\n✅ نعم: ${poll.votes.yes} (${total > 0 ? Math.round(poll.votes.yes/total*100) : 0}%)\n❌ لا: ${poll.votes.no} (${total > 0 ? Math.round(poll.votes.no/total*100) : 0}%)\n\nإجمالي الأصوات: ${total}`);
                }
            }
            
            // تذكير
            else if (command.startsWith('!تذكير ') || command.startsWith('!remind ')) {
                const parts = message.body.split(' ');
                if (parts.length >= 3) {
                    const time = parts[1]; // HH:MM
                    const reminderText = parts.slice(2).join(' ');
                    
                    const [hours, minutes] = time.split(':').map(Number);
                    const reminderTime = new Date();
                    reminderTime.setHours(hours, minutes, 0, 0);
                    
                    if (reminderTime <= new Date()) {
                        reminderTime.setDate(reminderTime.getDate() + 1);
                    }
                    
                    reminders.push({
                        chatId: chat.id._serialized,
                        message: reminderText,
                        time: reminderTime
                    });
                    
                    await message.reply(`⏰ تم تعيين تذكير للساعة ${time}`);
                }
            }
            
            // الطقس
            else if (command.startsWith('!طقس ') || command.startsWith('!weather ')) {
                const city = args.join(' ');
                const weather = await getWeather(city);
                await message.reply(weather);
            }
            
            // ترجمة
            else if (command.startsWith('!ترجم ') || command.startsWith('!translate ')) {
                if (message.hasQuotedMsg && args[0]) {
                    const quotedMsg = await message.getQuotedMessage();
                    const translation = await translateText(quotedMsg.body, args[0]);
                    await message.reply(translation);
                }
            }
            
            // ألعاب بسيطة
            else if (command === '!حجر' || command === '!rock') {
                const choices = ['حجر', 'ورقة', 'مقص'];
                const botChoice = choices[Math.floor(Math.random() * choices.length)];
                const userChoice = 'حجر';
                
                let result = '';
                if (botChoice === userChoice) result = 'تعادل!';
                else if (botChoice === 'مقص') result = 'فزت!';
                else result = 'خسرت!';
                
                await message.reply(`🎮 أنت: ${userChoice}\n🤖 البوت: ${botChoice}\n${result}`);
            }
            
            // مكافحة السبام
            else if (command === '!مكافحة_سبام' || command === '!antispam') {
                data.antiSpam = !data.antiSpam;
                await message.reply(`${data.antiSpam ? '✅ تم تفعيل' : '❌ تم إلغاء'} مكافحة السبام`);
            }
            
            // فلترة الروابط
            else if (command === '!فلترة_روابط' || command === '!linkfilter') {
                data.linkFilter = !data.linkFilter;
                await message.reply(`${data.linkFilter ? '✅ تم تفعيل' : '❌ تم إلغاء'} فلترة الروابط`);
            }
        }
        
        // أمر المساعدة
        else if (command === '!help' || command === '!مساعدة') {
            const helpMessage = `
🤖 *أوامر البوت المتاحة:*

*أوامر الملف الشخصي:*
• !changename [الاسم] - تغيير اسم البوت
• !changeprofilepic - تغيير صورة البوت

*أوامر المجموعات الأساسية:*
• !changegroupname [الاسم] - تغيير اسم المجموعة
• !changegrouppic - تغيير صورة المجموعة
• !changegroupdesc [الوصف] - تغيير وصف المجموعة

*إدارة الأعضاء:*
• !رفع / !promote - ترقية لمشرف (بالرد أو ذكر الرقم)
• !تنزيل / !demote - تنزيل من الإشراف
• !طرد / !kick - طرد عضو
• !منشن / !mentionall - منشن جماعي
• !تصفية / !cleanup - طرد غير النشطين (يومين)
• !اصنام / !inactive - عرض غير النشطين (يوم)

*إدارة الرسائل:*
• !تثبيت / !pin - تثبيت رسالة (بالرد)
• !الغاء_تثبيت / !unpin - إلغاء تثبيت

*الإحصائيات والمعلومات:*
• !احصائيات / !stats - إحصائيات المجموعة
• !ترحيب [رسالة] - تعيين رسالة ترحيب
• !قواعد [النص] - حفظ قواعد المجموعة
• !عرض_قواعد / !showrules - عرض القواعد

*نظام التحذيرات:*
• !تحذير / !warn - إعطاء تحذير (بالرد)
• !كتم [دقائق] / !mute - كتم مؤقت

*الجدولة والتذكيرات:*
• !جدولة [HH:MM] [رسالة] - جدولة رسالة
• !تذكير [HH:MM] [نص] - تعيين تذكير

*الاستطلاعات:*
• !استطلاع [سؤال] - إنشاء استطلاع
• !نعم [ID] / !لا [ID] - التصويت
• !نتائج [ID] - عرض النتائج

*الترفيه والخدمات:*
• !طقس [مدينة] - معلومات الطقس
• !ترجم [لغة] - ترجمة (بالرد على رسالة)
• !حجر - لعبة حجر ورقة مقص

*الأمان:*
• !مكافحة_سبام - تفعيل/إلغاء مكافحة السبام
• !فلترة_روابط - تفعيل/إلغاء فلترة الروابط

*أوامر عامة:*
• !help / !مساعدة - عرض هذه الرسالة
• !status - حالة البوت
            `;
            await message.reply(helpMessage);
        }
        
        // حالة البوت
        else if (command === '!status') {
            const info = client.info;
            const statusMessage = `
🤖 *حالة البوت:*
• الحالة: متصل ✅
• الاسم: ${info.pushname || 'غير محدد'}
• الرقم: ${info.wid.user}
• المنصة: ${info.platform}
• الرسائل المجدولة: ${scheduledMessages.length}
• التذكيرات: ${reminders.length}
• الاستطلاعات النشطة: ${polls.size}
            `;
            await message.reply(statusMessage);
        }
        
        // فحص الكتم والسبام
        if (chat.isGroup) {
            const data = getGroupData(chat.id._serialized);
            const userId = contact.id._serialized;
            
            // فحص الكتم
            if (data.mutedUsers.has(userId)) {
                const muteUntil = data.mutedUsers.get(userId);
                if (new Date() < muteUntil) {
                    await message.delete();
                    return;
                } else {
                    data.mutedUsers.delete(userId);
                }
            }
            
            // فحص فلترة الروابط
            if (data.linkFilter && (message.body.includes('http') || message.body.includes('www.'))) {
                await message.delete();
                await message.reply('🚫 الروابط غير مسموحة في هذه المجموعة');
                return;
            }
        }
        
    } catch (error) {
        console.error('Error processing message:', error);
        await message.reply('❌ حدث خطأ في معالجة الأمر');
    }
});

// ترحيب الأعضاء الجدد
client.on('group_join', async (notification) => {
    try {
        const chat = await notification.getChat();
        const data = getGroupData(chat.id._serialized);
        
        if (data.welcomeMessage) {
            await chat.sendMessage(`🎉 ${data.welcomeMessage}`);
        }
    } catch (error) {
        console.error('Error sending welcome message:', error);
    }
});

// API endpoints
app.get('/status', (req, res) => {
    res.json({
        ready: isReady,
        qrCode: qrCodeData,
        scheduledMessages: scheduledMessages.length,
        reminders: reminders.length,
        polls: polls.size
    });
});

app.get('/qr', (req, res) => {
    if (qrCodeData) {
        res.json({ qrCode: qrCodeData });
    } else {
        res.json({ message: 'No QR code available' });
    }
});

// بدء تشغيل البوت
client.initialize();

// بدء تشغيل الخادم
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Bot server running on port ${PORT}`);
});

// معالجة إغلاق التطبيق
process.on('SIGINT', async () => {
    console.log('Shutting down bot...');
    await client.destroy();
    process.exit(0);
});

