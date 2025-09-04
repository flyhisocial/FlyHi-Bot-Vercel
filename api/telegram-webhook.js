const { GoogleGenerativeAI } = require('@google/generative-ai');

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

async function generateAIImage(prompt) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-image-beta' }); // hypothetical model name
    const result = await model.generateImage({ prompt, height: 512, width: 512 });
    const response = await result.response;
    return response.imageUrl; // Adjust based on your API response
  } catch (error) {
    console.error('Image Generation Error:', error);
    return null;
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

    // Update keyboard to include image generation button
    const mainKeyboard = {
      keyboard: [
        [{ text: '📝 AI Social Post' }, { text: '🖼️ Generate Image' }],
        [{ text: '💰 Special Offer' }, { text: '🎊 Festival Post' }],
        [{ text: '📊 My Stats' }],
      ],
      resize_keyboard: true,
    };

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
      await sendTelegramMessage(chatId, welcomeText, mainKeyboard);
      return res.status(200).json({ status: 'OK' });
    }

    if (text === '🖼️ Generate Image') {
      user.state = 'waiting_image_prompt';
      await sendTelegramMessage(chatId, 'Please describe the image you want me to generate.');
      return res.status(200).json({ status: 'OK' });
    }

    if (user.state === 'waiting_image_prompt') {
      await sendTelegramMessage(chatId, 'Generating your image, please wait...');
      const imageUrl = await generateAIImage(text);
      if (imageUrl) {
        const sendPhotoUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendPhoto`;
        await fetch(sendPhotoUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, photo: imageUrl }),
        });
      } else {
        await sendTelegramMessage(chatId, 'Sorry, I could not generate the image.');
      }
      user.state = 'setup_complete';
      return res.status(200).json({ status: 'OK' });
    }

    // Existing handlers for other commands...

    // Continue with your existing conversation and state machine handling here...

    return res.status(200).json({ status: 'ok' });

  } catch (error) {
    console.error('Webhook Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
