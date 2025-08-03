module.exports = {
  apps: [{
    name: 'whatsapp-bot-enhanced',
    script: 'bot_improved.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    // إعادة التشغيل التلقائي في حالة الفشل
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s',
    // مراقبة الذاكرة والمعالج
    monitoring: true,
    // إعدادات إضافية للاستقرار
    kill_timeout: 5000,
    listen_timeout: 8000,
    shutdown_with_message: true
  }]
};

