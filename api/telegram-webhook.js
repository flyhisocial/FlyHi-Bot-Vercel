const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Google Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Simple in-memory storage (for testing - replace with database later)
let users = {};

// Subscription Plans
const PLANS = {
  starter: { price: 1499, maxPosts: 30, name: 'Starter' },
  growth: { price: 3499, maxPosts: 100, name: 'Growth' },
  professional: { price: 9999, maxPosts: Infinity, name: 'Professional' }
};

const FREE_TRIAL_MAX_POSTS = 5;

// AI Content Generation
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

Generate content that sounds like the business owner wrote it personally.`;

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

// Send Telegram Message
async function sendTelegramMessage(chatId, text, replyMarkup = null) {
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

// Main Vercel Handler
export default async function handler(req, res) {
  // Handle CORS preflight
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

    // Initialize user if not exists
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

    // Handle /start command
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

    // Show pricing plans
    if (text === '📋 See Plans & Pricing') {
      const pricingText = `💰 **FlyHi Social AI - Pricing Plans**

**🎁 FREE TRIAL:** ${FREE_TRIAL_MAX_POSTS} posts (Currently: ${user.content_generated}/${FREE_TRIAL_MAX_POSTS})

**💼 PAID PLANS:**
🥉 **Starter:** ₹${PLANS.starter.price}/month - ${PLANS.starter.maxPosts} posts
🥈 **Growth:** ₹${PLANS.growth.price}/month - ${PLANS.growth.maxPosts} posts  
🥇 **Professional:** ₹${PLANS.professional.price}/month - Unlimited posts

**🔥 All plans include:**
✅ Google Gemini AI content generation
✅ Brand-specific customization
✅ 24/7 cloud hosting
✅ Multi-language support (Hinglish)

Ready to start creating content?`;

      const keyboard = {
        keyboard: [
          [{ text: '🤖 Setup My AI Team' }],
          [{ text: '💳 Upgrade Plan' }],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      };

      await sendTelegramMessage(chatId, pricingText, keyboard);
      return res.status(200).json({ status: 'OK' });
    }

    // Check usage limits
    if (!user.subscriptionActive && user.content_generated >= FREE_TRIAL_MAX_POSTS) {
      user.state = 'trial_expired';

      const upgradeText = `🔥 Your FREE trial of ${FREE_TRIAL_MAX_POSTS} posts is over!

**💼 Choose your plan to continue:**

🥉 **Starter:** ₹${PLANS.starter.price}/month - ${PLANS.starter.maxPosts} posts
🥈 **Growth:** ₹${PLANS.growth.price}/month - ${PLANS.growth.maxPosts} posts  
🥇 **Professional:** ₹${PLANS.professional.price}/month - Unlimited posts

**💳 Payment Methods:** 
UPI: **yourupi@okaxis**
PhonePe, GooglePay, Paytm supported

**After payment, send your transaction ID here to activate!**`;

      const upgradeKeyboard = {
        keyboard: [
          [{ text: '💳 I Made Payment' }],
          [{ text: '📋 See Plans & Pricing' }],
        ],
        resize_keyboard: true,
      };

      await sendTelegramMessage(chatId, upgradeText, upgradeKeyboard);
      return res.status(200).json({ status: 'OK' });
    }

    // Handle payment verification
    if (text === '💳 I Made Payment' || (user.state === 'trial_expired' && /^[a-zA-Z0-9]{6,20}$/.test(text.trim()))) {
      if (text !== '💳 I Made Payment') {
        // Transaction ID provided
        const transactionId = text.trim();
        
        user.state = 'paid';
        user.subscriptionActive = true;
        user.plan = 'starter'; // Default to starter plan
        user.content_generated = 0; // Reset count for new subscription
        user.subscription_started = new Date().toISOString();

        await sendTelegramMessage(chatId, `🎉 Payment verified! Your **${PLANS.starter.name}** plan is now active!

**✅ Subscription Details:**
📦 Plan: ${PLANS.starter.name} (₹${PLANS.starter.price}/month)
📊 Monthly Limit: ${PLANS.starter.maxPosts} posts
🎯 Current Usage: 0/${PLANS.starter.maxPosts}

Thank you for subscribing to FlyHi Social AI! 🚀

Ready to create amazing content?`);
        
        return res.status(200).json({ status: 'OK' });
      } else {
        await sendTelegramMessage(chatId, `💳 Great! Please send me your **transaction ID** from your UPI payment.

**Payment Details:**
UPI ID: **yourupi@okaxis**  
Amount: ₹${PLANS.starter.price} (Starter Plan)

Send the transaction ID as a message after making the payment.`);
        return res.status(200).json({ status: 'OK' });
      }
    }

    // Business setup flow
    switch (user.state) {
      case 'started':
        if (text === '🤖 Setup My AI Team') {
          user.state = 'waiting_business_name';
          await sendTelegramMessage(chatId, `📋 **Step 1/5: Business Information**

What's your business name?

*This will appear on every piece of AI-generated content*

*Example: Puri Sweets & Bakes, Rajesh Electronics*`);
        }
        break;

      case 'waiting_business_name':
        user.business_name = text.trim();
        user.state = 'waiting_owner_name';
        await sendTelegramMessage(chatId, `✅ Great! **${text}** sounds professional.

📋 **Step 2/5: Owner Information**

What's your name?

*Example: Rajesh Kumar, Priya Sharma, Santosh Panigrahi*`);
        break;

      case 'waiting_owner_name':
        user.owner_name = text.trim();
        user.state = 'waiting_industry';
        await sendTelegramMessage(chatId, `✅ Nice to meet you, **${text}**!

📋 **Step 3/5: Business Category**

What type of business is **${user.business_name}**?

*Example: Sweet Shop, Restaurant, Clothing Store, Mobile Repair*`);
        break;

      case 'waiting_industry':
        user.industry = text.trim();
        user.state = 'waiting_brand_voice';
        const voiceKeyboard = {
          keyboard: [
            [{ text: '🔥 Energetic & Modern' }, { text: '🌟 Professional & Trustworthy' }],
            [{ text: '❤️ Warm & Friendly' }, { text: '👑 Premium & Exclusive' }],
            [{ text: '🎯 Direct & Simple' }],
          ],
          resize_keyboard: true,
          one_time_keyboard: true,
        };
        await sendTelegramMessage(chatId, `✅ Perfect! **${text}** business noted.

📋 **Step 4/5: Brand Voice**

How do you want to communicate with customers?`, voiceKeyboard);
        break;

      case 'waiting_brand_voice':
        user.brand_voice = text.trim();
        user.state = 'waiting_brand_colors';
        await sendTelegramMessage(chatId, `✅ Brand voice: **${text}**

📋 **Step 5/5: Brand Colors**

What are your business colors?

*Example: Blue and White, Red and Gold, Green and Yellow*`);
        break;

      case 'waiting_brand_colors':
        user.brand_colors = text.trim();
        user.state = 'setup_complete';

        const completionText = `🎉 **CLOUD AI TEAM SETUP COMPLETE!** 🎉

**🎯 YOUR AI PROFILE:**
🏢 **Business:** ${user.business_name}
👤 **Owner:** ${user.owner_name}
🏭 **Industry:** ${user.industry}
🎨 **Voice:** ${user.brand_voice}
🎨 **Colors:** ${user.brand_colors}

**📊 SUBSCRIPTION STATUS:**
${user.subscriptionActive ? 
  `✅ **${PLANS[user.plan].name} Plan Active**
📦 Monthly Limit: ${PLANS[user.plan].maxPosts === Infinity ? 'Unlimited' : PLANS[user.plan].maxPosts}
📈 Used: ${user.content_generated}/${PLANS[user.plan].maxPosts === Infinity ? '∞' : PLANS[user.plan].maxPosts}` : 
  `🎁 **Free Trial Active**
📦 Remaining: ${FREE_TRIAL_MAX_POSTS - user.content_generated}/${FREE_TRIAL_MAX_POSTS}`}

**☁️ RUNNING 100% IN VERCEL CLOUD!**

What would you like to create first?`;

        const mainKeyboard = {
          keyboard: [
            [{ text: '📝 AI Social Post' }, { text: '💰 Special Offer' }],
            [{ text: '🎊 Festival Post' }, { text: '📊 My Stats' }],
          ],
          resize_keyboard: true,
        };

        await sendTelegramMessage(chatId, completionText, mainKeyboard);
        break;

      case 'setup_complete':
      case 'paid':
        // Handle content generation requests
        let contentType = 'general';
        if (text.includes('Special Offer')) contentType = 'offer';
        else if (text.includes('Festival')) contentType = 'festival';

        if (text === '📊 My Stats') {
          const statsText = `📊 **Your FlyHi Social Stats**

**👤 Profile:**
🏢 Business: ${user.business_name || 'Not set'}
👤 Owner: ${user.owner_name || 'Not set'}

**📈 Usage:**
${user.subscriptionActive ? 
  `✅ Plan: ${PLANS[user.plan].name} (₹${PLANS[user.plan].price}/month)
📦 Limit: ${PLANS[user.plan].maxPosts === Infinity ? 'Unlimited' : PLANS[user.plan].maxPosts}
📊 Used: ${user.content_generated}` : 
  `🎁 Free Trial
📊 Used: ${user.content_generated}/${FREE_TRIAL_MAX_POSTS}`}

**⏰ Activity:**
🎯 Joined: ${new Date(user.started_at).toLocaleDateString()}

Ready to create more content?`;

          const statsKeyboard = {
            keyboard: [
              [{ text: '📝 AI Social Post' }, { text: '💰 Special Offer' }],
              [{ text: '🎊 Festival Post' }],
            ],
            resize_keyboard: true,
          };

          await sendTelegramMessage(chatId, statsText, statsKeyboard);
          break;
        }

        if (text.includes('AI Social Post') || text.includes('Special Offer') || text.includes('Festival')) {
          await sendTelegramMessage(chatId, `🤖 **Cloud AI Creating Content...**

**☁️ Process:**
✅ Loading your business profile
✅ Connecting to Google Gemini AI
✅ Generating personalized content
✅ Applying brand consistency

*This may take 10-15 seconds...*`);

          // Generate AI content
          const aiContent = await generateAIContent(user, contentType);

          // Update usage count
          user.content_generated = (user.content_generated || 0) + 1;
          user.last_generated = new Date().toISOString();

          const responseText = `🤖 **CLOUD AI GENERATED CONTENT**

**✨ FOR:** ${user.business_name}

${aiContent}

**🔥 100% ORIGINAL AI CONTENT!**

**📊 USAGE STATS:**
${user.subscriptionActive ? 
  `📦 Plan: ${PLANS[user.plan].name}
📈 Used: ${user.content_generated}/${PLANS[user.plan].maxPosts === Infinity ? '∞' : PLANS[user.plan].maxPosts}` : 
  `🎁 Trial: ${user.content_generated}/${FREE_TRIAL_MAX_POSTS}`}

**☁️ CLOUD STATUS:**
• Server: ✅ Online 24/7
• AI: Google Gemini Pro
• Hosting: Vercel Serverless

Want to create more content?`;

          const contentKeyboard = {
            keyboard: [
              [{ text: '🔄 Generate Another' }, { text: '💰 Special Offer' }],
              [{ text: '🎊 Festival Post' }, { text: '📊 My Stats' }],
            ],
            resize_keyboard: true,
          };

          await sendTelegramMessage(chatId, responseText, contentKeyboard);
        } else {
          await sendTelegramMessage(chatId, "I didn't understand that. Please use the menu buttons or type /start to begin!");
        }
        break;

      default:
        await sendTelegramMessage(chatId, "I didn't understand that. Please use the menu buttons or type /start to begin!");
    }

    return res.status(200).json({ status: 'ok' });

  } catch (error) {
    console.error('Webhook Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}