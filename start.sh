#!/bin/bash

echo "🚀 بدء تشغيل بوت واتساب..."

# تثبيت تبعيات Node.js
echo "📦 تثبيت تبعيات Node.js..."
npm install

# تثبيت تبعيات Python
echo "🐍 تثبيت تبعيات Python..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

source venv/bin/activate
pip install -r requirements.txt

# تشغيل التطبيق
echo "▶️ تشغيل التطبيق..."
python src/main.py

