require('dotenv').config();
const axios = require('axios');

// --- خواندن تنظیمات از فایل .env ---
const SERVER_IP = process.env.SERVER_IP;
const PANEL_USERNAME = process.env.PANEL_USERNAME;
const PANEL_PASSWORD = process.env.PANEL_PASSWORD;
const PANEL_STATIC_TOKEN = process.env.PANEL_STATIC_TOKEN;
const SENDER_NUMBER = process.env.SENDER_NUMBER;

// --- دیکشنری پیام‌های خطا ---
const STATUS_CODE_MESSAGES = {
    0: "موفقیت آمیز", 1: "ارسال تکی انجام شده است.", 2: "ارسال نظیر به نظیر انجام شده است.", 4: "تعداد گیرندگان با تعداد پیامک همخوانی ندارد.", 5: "متن پیامک دارای کلمه (کلمات) فیلتر شده است.", 6: "مجاز به ارسال لینک در متن پیامک نمی باشید.", 7: "لیست گیرندگان خالی است.", 8: "سازمان یافت نشد، یا غیر فعال است، یا احراز هویت نشده، یا ارسال آن غیر فعال است.", 9: "سازمان غیر فعال است.", 10: "سازمان منقضی شده است.", 11: "سازمان جاری یا یکی از سازمان های پدر غیر فعال است، یا احراز هویت نشده، یا ارسال آن ها غیر فعال است.", 12: "سازمان ارسال خارج از بازه مجاز سازمان می باشد.", 13: "کاربر غیر فعال است.", 14: "کاربر منقضی شده است.", 15: "اطلاعات کاربر پیدا نشد، یا احراز هویت انجام نشده، یا ارسال کاربر یا کاربر غیر فعال است.", 16: "سازمان والد منقضی شده است.", 17: "شماره فرستنده معتبر نیست، یا قابلیت ارسال از شما گرفته شده است.", 18: "شماره فرستنده غیر فعال است.", 19: "شماره فرستنده منقضی شده است.", 20: "سرویس ارسال در دسترس نمی باشد.", 21: "خطا در ثبت در صف ارسال.", 22: "لیست گیرندگان با توجه به لیست سیاه خالی است.", 23: "تعداد گیرندگان با توجه با بخش های پیامک بیشتر از 100 است.", 24: "متن پیامک خالی است.", 25: "ناموفق", 26: "تعداد گیرندگان بیشتر از 100 است.", 27: "خطا در ثبت صف", 33: "توکن وارد نشده است.", 34: "توکن یافت نشد، یا اشتباه وارد شده است، یا تایید نشده است.", 35: "آی پی نامعتبر است.", 36: "خطا در حذف بلک لیست ها", 37: "خطا در چک کردن استثناء ها", 38: "خطا در دریافت اطلاعات توکن", 66: "شارژ پنل کافی نمی باشد"
};

// --- توابع کمکی ---
function generateSixDigitCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// --- مرحله ۱: دریافت توکن دسترسی موقت ---
async function getAccessToken() {
    const loginUrl = `http://${SERVER_IP}/User/PanelLogin`;
    console.log(`- مرحله ۱: در حال لاگین به ${loginUrl} ...`);
    try {
        const response = await axios.post(loginUrl, { UserName: PANEL_USERNAME, Password: PANEL_PASSWORD });
        const accessToken = response.data?.AccessToken;
        if (accessToken && accessToken.length > 0) {
            console.log("  ✅ توکن دسترسی موقت دریافت شد.");
            return accessToken;
        } else {
            console.error("  ❌ خطا در لاگین: نام کاربری یا رمز عبور اشتباه است.");
            return null;
        }
    } catch (error) {
        console.error(`  ❌ خطا در ارتباط با سرور هنگام لاگین: ${error.message}`);
        return null;
    }
}

// --- مرحله ۲: ارسال پیامک با کد رندوم ---
async function sendSmsWithToken(accessToken, phoneNumber, code) {
    const sendUrl = `http://${SERVER_IP}/SMS/Send`;
    console.log(`- مرحله ۲: در حال ارسال کد ${code} به شماره ${phoneNumber}...`);
    
    const requestBody = {
        ServerIpAddress: SERVER_IP,
        AccessToken: PANEL_STATIC_TOKEN,
        SenderNumber: SENDER_NUMBER,
        MessageBodies: [code],
        RecipientNumbers:[phoneNumber]
    };
    const headers = { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

    try {
        const response = await axios.post(sendUrl, requestBody, { headers });
        const responseData = response.data;
        const statusCode = responseData?.StatusCode;
        const messageStatus = STATUS_CODE_MESSAGES[statusCode] || `کد وضعیت ناشناخته: ${statusCode}`;

        console.log(`\n--- نتیجه ارسال ---`);
        if (responseData.MessageId > 0 && statusCode < 4) {
            console.log(`✅ موفقیت! MessageId: ${responseData.MessageId}`);
        } else {
            console.error(`❌ شکست!`);
        }
        console.log(`💬 پیام سرور: ${messageStatus}`);
    } catch (error) {
        if (error.response?.status === 401) {
            console.error("❌ خطا: توکن دسترسی موقت (Bearer Token) نامعتبر است.");
        } else {
            console.error(`❌ خطا در ارتباط با سرور هنگام ارسال: ${error.message}`);
        }
    }
}

// --- منطق اصلی برنامه ---
async function main() {
    console.log('=================================================');
    // ۱. بررسی وجود تنظیمات اولیه
    if (!SERVER_IP || !PANEL_USERNAME || !PANEL_PASSWORD || !PANEL_STATIC_TOKEN || !SENDER_NUMBER) {
        console.error('❌ خطا: تنظیمات اصلی در فایل .env کامل نیست. لطفاً فایل را بررسی کنید.');
        return;
    }

    // ۳. اجرای فرآیند ارسال
    const accessToken = await getAccessToken();
    if (accessToken) {
        const randomCode = generateSixDigitCode();
        await sendSmsWithToken(accessToken,"+989919901583", randomCode);
    }
    console.log('=================================================');
}

// --- اجرای برنامه ---
main();
