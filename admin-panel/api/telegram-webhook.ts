import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestoreToken, runQuery, patchDocument } from './_firebase';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MAKE_WEBHOOK = 'https://hook.eu1.make.com/v86xzo9djri8nxhglbd71q9ebibsyhly';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message } = req.body || {};

    // Ignore non-text, non-voice messages
    if (!message || (!message.text && !message.voice)) {
      return res.status(200).send('OK');
    }

    const text = message.text ? String(message.text).trim() : '';

    // --- /start COMMAND: Link bot to tenant ---
    if (text.startsWith('/start ')) {
      const secretKey = text.replace('/start ', '').trim();
      const chatId = message.chat.id;

      if (!secretKey) {
        return res.status(200).send('OK');
      }

      const token = await getFirestoreToken();
      if (!token) {
        console.error("Failed to get Firestore token");
        await sendTelegramMessage(chatId, "⚠️ Ошибка сервера. Попробуйте позже.");
        return res.status(200).send('OK');
      }

      // Query Firestore for client with this secretKey
      const results = await runQuery(token, {
        structuredQuery: {
          from: [{ collectionId: 'clients' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'secretKey' },
              op: 'EQUAL',
              value: { stringValue: secretKey }
            }
          },
          limit: 1
        }
      });

      // Check if we found a matching client
      const doc = results?.[0]?.document;
      if (!doc) {
        await sendTelegramMessage(chatId, "❌ Неверный ключ. Бот не привязан ни к одному сайту.");
        return res.status(200).send('OK');
      }

      // Update the client document with telegramChatId
      await patchDocument(token, doc.name, {
        telegramChatId: { stringValue: chatId.toString() }
      });

      await sendTelegramMessage(chatId, "✅ Бот успешно привязан! Теперь вы будете получать уведомления о новых заявках сюда.");
      return res.status(200).send('OK');
    }

    // --- JARVIS AI ROUTING ---
    // Forward non-/start messages to Make.com
    const chatId = message?.chat?.id;
    if (chatId && MAKE_WEBHOOK) {
      const token = await getFirestoreToken();
      if (token) {
        // Find tenant by chatId
        const results = await runQuery(token, {
          structuredQuery: {
            from: [{ collectionId: 'clients' }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'telegramChatId' },
                op: 'EQUAL',
                value: { stringValue: chatId.toString() }
              }
            },
            limit: 1
          }
        });

        const doc = results?.[0]?.document;
        if (doc) {
          // Extract clientId from doc path (last segment)
          const pathParts = doc.name.split('/');
          const tenantId = pathParts[pathParts.length - 1];

          try {
            await fetch(MAKE_WEBHOOK, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tenantId, message })
            });
          } catch (err) {
            console.error("Make Webhook Error:", err);
          }
        }
      }
    }

    return res.status(200).send('OK');
  } catch (error: any) {
    console.error('Telegram Webhook Error:', error?.stack || error);
    return res.status(200).send('OK'); // Always 200 so Telegram doesn't retry
  }
}

async function sendTelegramMessage(chatId: number, text: string) {
  if (!TELEGRAM_BOT_TOKEN) return;
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });
  } catch (error) {
    console.error('Failed to send Telegram message:', error);
  }
}
