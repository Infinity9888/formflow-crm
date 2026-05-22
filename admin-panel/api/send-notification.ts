import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestoreToken } from './_firebase.js';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const FIREBASE_PROJECT_ID = 'universal-leads-test';

async function getDocument(token: string, collection: string, docId: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) return null;
  return res.json();
}

function getFieldValue(doc: any, fieldName: string): string | undefined {
  return doc?.fields?.[fieldName]?.stringValue;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

    const token = await getFirestoreToken();
    if (!token) {
      return res.status(500).json({ error: 'Failed to get auth token' });
    }

    // 1. Fetch client document
    const clientDoc = await getDocument(token, 'clients', clientId);
    if (!clientDoc || clientDoc.error) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const telegramChatId = getFieldValue(clientDoc, 'telegramChatId');
    if (!telegramChatId) {
      return res.status(200).json({ success: true, message: 'No Telegram connected' });
    }

    // 2. Fetch lead document
    const leadDoc = await getDocument(token, 'leads', leadId);
    if (!leadDoc || leadDoc.error) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Security: ensure lead belongs to this client
    const leadClientId = getFieldValue(leadDoc, 'clientId');
    if (leadClientId !== clientId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Security: ensure lead is recent (5 min)
    const createdAt = leadDoc?.fields?.createdAt?.timestampValue || leadDoc?.fields?.createdAt?.stringValue;
    if (createdAt) {
      const leadDate = new Date(createdAt);
      const diffMinutes = (Date.now() - leadDate.getTime()) / 1000 / 60;
      if (diffMinutes > 5) {
        return res.status(403).json({ error: 'Lead too old for notification' });
      }
    }

    // 3. Build message from lead fields
    let messageText = `🚨 *Новая заявка!*\n\n`;
    const fields = leadDoc?.fields || {};
    for (const [key, val] of Object.entries(fields)) {
      if (key !== 'clientId' && key !== 'createdAt' && key !== 'status') {
        const v = (val as any)?.stringValue || (val as any)?.integerValue || '';
        messageText += `*${key}:* ${v}\n`;
      }
    }

    // 4. Send Telegram message
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
