require('dotenv').config();
const axios = require('axios');
const readline = require('readline');

// --- Configuration ---
// تمام تنظیمات از فایل .env خوانده می‌شوند
const API_URL = process.env.API_URL || 'http://217.20.252.203/api/v1/rest/sms/pattern-send';
const API_TOKEN = process.env.API_TOKEN;
const SENDER_NUMBER = process.env.SENDER_NUMBER;
const PATTERN_ID = process.env.PATTERN_ID;

// --- Helper Functions ---

function translateError(error) {
    if (error.response) {
        const status = error.response.status;
        if (status === 400) return "درخواست ارسالی نامعتبر است (400).";
        if (status === 401) return "توکن احراز هویت اشتباه یا منقضی شده است (401).";
        if (status >= 500) return `خطای داخلی در سرور رخ داده است (${status}).`;
    } else if (error.request) {
        return "پاسخی از سرور دریافت نشد. شبکه یا آدرس سرویس را بررسی کنید.";
    }
    return `خطای ناشناخته: ${error.message}`;
}

function generateSixDigitCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationCode(phoneNumber, code) {
    const payload = {
        from: SENDER_NUMBER,
        recipients: [phoneNumber],
        message: { code: code },
        patternId: PATTERN_ID,
        type: 0
    };

    // در این سرویس، توکن در هدر username ارسال می‌شود
    const headers = {
        'username': API_TOKEN, 
        'Content-Type': 'application/json',
    };

    console.log(`\n🚀 در حال ارسال کد ${code} به شماره ${phoneNumber}...`);
    console.log(`   (از طرف: ${SENDER_NUMBER})`);

    try {
        const response = await axios.post(API_URL, payload, { headers, timeout: 15000 });
        console.log('✅ پیامک با موفقیت ارسال شد!');
        console.log(`💬 پاسخ سرور: ${JSON.stringify(response.data, null, 2)}`);
    } catch (error) {
        const friendlyError = translateError(error);
        console.error(`❌ خطا در ارسال پیامک: ${friendlyError}`);
    }
}

// --- Main Application Logic (CLI) ---

function startCli() {
    if (!API_TOKEN || !SENDER_NUMBER) {
        console.error('❌ خطا: توکن (API_TOKEN) یا شماره فرستنده (SENDER_NUMBER) در فایل .env تعریف نشده است.');
        process.exit(1);
    }

    console.log('✅ برنامه آماده ارسال پیامک است.');
    console.log(`   - فرستنده: ${SENDER_NUMBER}`);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.setPrompt('\n📲 شماره موبایل گیرنده را وارد کنید (یا exit برای خروج): ');
    rl.prompt();

    rl.on('line', async (line) => {
        const phoneNumber = line.trim();
        if (phoneNumber.toLowerCase() === 'exit') {
            rl.close();
            return;
        }

        if (!/^(\+98|0)?9\d{9}$/.test(phoneNumber)) {
            console.warn('   ⚠️ شماره موبایل وارد شده نامعتبر است. لطفاً دوباره تلاش کنید.');
        } else {
            const code = generateSixDigitCode();
            await sendVerificationCode(phoneNumber, code);
        }
        
        rl.prompt();
    }).on('close', () => {
        console.log('\n👋 برنامه بسته شد.');
        process.exit(0);
    });
}

// Run the CLI
startCli();
