import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './_firebase';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message } = req.body;

    // Check if the message contains text
    if (!message || !message.text) {
      return res.status(200).send('OK'); // Return 200 so Telegram doesn't retry
    }

    const text = message.text.trim();

    // Look for the /start command with the payload (secretKey)
    if (text.startsWith('/start ')) {
      const secretKey = text.replace('/start ', '').trim();
      const chatId = message.chat.id;

      if (!secretKey) {
        return res.status(200).send('OK');
      }

      // Find the client with this secret key
      const clientsRef = db.collection('clients');
      const snapshot = await clientsRef.where('secretKey', '==', secretKey).get();

      if (snapshot.empty) {
        await sendTelegramMessage(chatId, "❌ Неверный ключ. Бот не привязан ни к одному сайту.");
        return res.status(200).send('OK');
      }

      // There should be exactly one matching client
      const clientDoc = snapshot.docs[0];
      
      // Update the client document with the telegramChatId
      await clientDoc.ref.update({
        telegramChatId: chatId.toString()
      });

      await sendTelegramMessage(chatId, "✅ Бот успешно привязан! Теперь вы будете получать уведомления о новых заявках сюда.");
      return res.status(200).send('OK');
    }

    return res.status(200).send('OK');
  } catch (error) {
    console.error('Telegram Webhook Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

async function sendTelegramMessage(chatId: number, text: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
      }),
    });
  } catch (error) {
    console.error('Failed to send Telegram message:', error);
  }
}
