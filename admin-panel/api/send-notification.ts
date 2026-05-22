import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './_firebase';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow CORS for the landing pages to call this API
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { clientId, leadId } = req.body;

    if (!clientId || !leadId) {
      return res.status(400).json({ error: 'Missing clientId or leadId' });
    }

    // 1. Fetch the client document to get the telegramChatId
    const clientRef = db.collection('clients').doc(clientId);
    const clientDoc = await clientRef.get();

    if (!clientDoc.exists) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const clientData = clientDoc.data();
    const telegramChatId = clientData?.telegramChatId;

    if (!telegramChatId) {
      // Client has not connected Telegram, silently succeed
      return res.status(200).json({ success: true, message: 'No Telegram connected' });
    }

    // 2. Fetch the lead document securely
    // In our architecture, leads are stored at `leads/{leadId}` with a `clientId` field.
    const leadRef = db.collection('leads').doc(leadId);
    const leadDoc = await leadRef.get();

    if (!leadDoc.exists) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const leadData = leadDoc.data();

    // Security check: ensure the lead actually belongs to this client
    if (leadData?.clientId !== clientId) {
       return res.status(403).json({ error: 'Forbidden' });
    }

    // Security check: ensure the lead was created recently (within last 5 minutes)
    // Assuming createdAt is stored as an ISO string or Timestamp
    const leadDate = leadData?.createdAt?.toDate ? leadData.createdAt.toDate() : new Date(leadData?.createdAt);
    const now = new Date();
    const diffMinutes = (now.getTime() - leadDate.getTime()) / 1000 / 60;

    if (diffMinutes > 5) {
      return res.status(403).json({ error: 'Lead too old for notification' });
    }

    // 3. Construct and send the message
    let messageText = `🚨 *Новая заявка!*\n\n`;
    
    // Dynamically format all fields from the lead
    for (const [key, value] of Object.entries(leadData || {})) {
      if (key !== 'clientId' && key !== 'createdAt' && key !== 'status') {
         messageText += `*${key}:* ${value}\n`;
      }
    }

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const tgResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: messageText,
        parse_mode: 'Markdown'
      }),
    });

    if (!tgResponse.ok) {
       console.error('Telegram API error:', await tgResponse.text());
       return res.status(500).json({ error: 'Failed to send Telegram message' });
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Send notification error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
