from flask import Flask, render_template, jsonify, send_from_directory
from flask_cors import CORS
import subprocess
import os
import signal
import time
import requests
import threading

app = Flask(__name__)
CORS(app)

# متغيرات عامة
bot_process = None
bot_status = {
    'ready': False,
    'qrCode': None,
    'error': None
}

def start_bot():
    """بدء تشغيل البوت"""
    global bot_process
    try:
        # تشغيل البوت في عملية منفصلة
        bot_process = subprocess.Popen(
            ['node', 'bot.js'],
            cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        print("Bot started successfully")
        return True
    except Exception as e:
        print(f"Error starting bot: {e}")
        return False

def stop_bot():
    """إيقاف البوت"""
    global bot_process
    if bot_process:
        try:
            bot_process.terminate()
            bot_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            bot_process.kill()
        bot_process = None
        print("Bot stopped")

def check_bot_status():
    """فحص حالة البوت"""
    global bot_status
    try:
        # محاولة الاتصال بـ API البوت
        response = requests.get('http://localhost:3000/status', timeout=5)
        if response.status_code == 200:
            data = response.json()
            bot_status.update(data)
            return True
    except:
        pass
    return False

def monitor_bot():
    """مراقبة البوت في الخلفية"""
    while True:
        if bot_process and bot_process.poll() is None:
            check_bot_status()
        time.sleep(3)

@app.route('/')
def index():
    """الصفحة الرئيسية"""
    return send_from_directory('static', 'index.html')

@app.route('/status')
def status():
    """حالة البوت"""
    global bot_status
    
    # إذا لم يكن البوت يعمل، ابدأ تشغيله
    if not bot_process or bot_process.poll() is not None:
        if start_bot():
            time.sleep(2)  # انتظار قصير لبدء البوت
    
    # فحص الحالة
    check_bot_status()
    
    return jsonify(bot_status)

@app.route('/start')
def start():
    """بدء تشغيل البوت"""
    if start_bot():
        return jsonify({'success': True, 'message': 'Bot started'})
    else:
        return jsonify({'success': False, 'message': 'Failed to start bot'})

@app.route('/stop')
def stop():
    """إيقاف البوت"""
    stop_bot()
    return jsonify({'success': True, 'message': 'Bot stopped'})

@app.route('/restart')
def restart():
    """إعادة تشغيل البوت"""
    stop_bot()
    time.sleep(1)
    if start_bot():
        return jsonify({'success': True, 'message': 'Bot restarted'})
    else:
        return jsonify({'success': False, 'message': 'Failed to restart bot'})

@app.route('/qr')
def qr():
    """الحصول على رمز QR"""
    try:
        response = requests.get('http://localhost:3000/qr', timeout=5)
        if response.status_code == 200:
            return response.json()
    except:
        pass
    return jsonify({'qrCode': None})

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

def cleanup():
    """تنظيف الموارد عند الإغلاق"""
    stop_bot()

# تسجيل دالة التنظيف
import atexit
atexit.register(cleanup)

# معالجة إشارات النظام
def signal_handler(signum, frame):
    cleanup()
    exit(0)

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

if __name__ == '__main__':
    # بدء مراقبة البوت في خيط منفصل
    monitor_thread = threading.Thread(target=monitor_bot, daemon=True)
    monitor_thread.start()
    
    # بدء تشغيل البوت
    start_bot()
    
    # تشغيل Flask
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)

