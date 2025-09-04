const { GoogleGenerativeAI } = require('@google/generative-ai');

// Dynamic import of node-fetch to support ESM in CommonJS
let fetch;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

let users = {};

const PLANS = {
  starter: { price: 1499, maxPosts: 30, name: 'Starter' },
  growth: { price: 3499, maxPosts: 100, name: 'Growth' },
  professional: { price: 9999, maxPosts: Infinity, name: 'Professional' },
};

const FREE_TRIAL_MAX_POSTS = 5;

async function generateAIContent(businessData, contentType = 'general') {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const prompt = `Create an engaging ${contentType} social media post for ${businessData.business_name}, a ${businessData.industry} business in India.
Business Details:
- Name: ${businessData.business_name}
- Industry: ${businessData.industry}
- Owner: ${businessData.owner_name}
- Brand Voice: ${businessData.brand_voice}
- Colors: ${businessData.brand_colors}
Requirements:
1. Write in Hinglish (Hindi + English mix) for Indian audience
2. Include 8-12 relevant hashtags
3. Add emojis naturally
4. Include clear call-to-action
5. Keep it 150-200 words
6. Make it authentic and engaging
Generate content that should be accurate to the brand type and a brand needs for promotion.`;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('AI Generation Error:', error);
    return `🌟 ${businessData.business_name} - Quality You Can Trust! 🌟
✨ Experience the difference with our premium ${businessData.industry}
🎯 Trusted by families across the city
📞 Contact us today for the best deals!
Visit us and see why customers choose ${businessData.business_name}!
#quality #${businessData.business_name.toLowerCase().replace(/ /g, '')} #trusted #local`;
  }
}

async function sendTelegramMessage(chatId, text, replyMarkup = null) {
  if (!fetch) {
    fetch = (await import('node-fetch')).default;
  }

  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const body = {
    chat_id: chatId,
    text: text,
    parse_mode: 'Markdown',
  };
  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await response.json();
  } catch (error) {
    console.error('Telegram API Error:', error);
    return null;
  }
}

export default async function handler(req, res) {
  if (!fetch) {
    fetch = (await import('node-fetch')).default;
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ status: 'ok' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const update = req.body;
    if (!update.message) {
      return res.status(200).json({ status: 'no message' });
    }
    const message = update.message;
    const chatId = message.chat.id;
    const userId = message.from.id;
    const text = message.text || '';
    const firstName = message.from.first_name || 'Friend';

    if (!users[userId]) {
      users[userId] = {
        id: userId,
        first_name: firstName,
        started_at: new Date().toISOString(),
        state: 'started',
        content_generated: 0,
        subscriptionActive: false,
        plan: 'free_trial',
      };
    }

    let user = users[userId];

    if (text === '/start') {
      user.state = 'started';
      user.first_name = firstName;
      const welcomeText = `🚀 Welcome ${firstName} to FlyHi Social - Cloud AI Platform!
🔥 **100% CLOUD POWERED:**
✅ **Google Gemini AI** - Unlimited content
✅ **Serverless hosting** - Always online  
✅ **No PC required** - Runs in the cloud
✅ **Professional branding** - Logo integration
🎁 **FREE TRIAL:** ${FREE_TRIAL_MAX_POSTS} AI posts to get started!
Ready to setup your cloud AI team? 👇`;
      const keyboard = {
        keyboard: [
          [{ text: '🤖 Setup My AI Team' }],
          [{ text: '📋 See Plans & Pricing' }],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      };
      await sendTelegramMessage(chatId, welcomeText, keyboard);
      return res.status(200).json({ status: 'OK' });
    }

    // ... (the rest of your existing switch case and logic goes here, unchanged)

    return res.status(200).json({ status: 'ok' });

  } catch (error) {
    console.error('Webhook Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
