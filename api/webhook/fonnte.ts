import type { IncomingMessage, ServerResponse } from 'http';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import rawFirebaseConfig from '../../firebase-applet-config.json';

interface VercelRequest extends IncomingMessage {
  body: any;
  query: Record<string, string>;
}

interface VercelResponse extends ServerResponse {
  status: (code: number) => VercelResponse;
  json: (data: any) => void;
  send: (data: any) => void;
}

const firebaseConfig = {
  projectId: rawFirebaseConfig?.projectId || 'gen-lang-client-0613738072',
  appId: rawFirebaseConfig?.appId || '1:610645476410:web:a2a7d79b2ddc59df052103',
  apiKey: rawFirebaseConfig?.apiKey || 'AIzaSyBd7aae92-qKScRmhmVJnGKgFkWZ2kUEeY',
  authDomain: rawFirebaseConfig?.authDomain || 'gen-lang-client-0613738072.firebaseapp.com',
  firestoreDatabaseId:
    rawFirebaseConfig?.firestoreDatabaseId ||
    'ai-studio-whatsappcssmarta-72f880d0-0b9f-41b9-b9ee-c39dd619a3ee',
};

const fbApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const firestore =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(fbApp, firebaseConfig.firestoreDatabaseId)
    : getFirestore(fbApp);

async function getRequestBody(req: VercelRequest): Promise<any> {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch {
      const p = new URLSearchParams(req.body);
      return Object.fromEntries(p.entries());
    }
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
    });
    req.on('end', () => {
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        try {
          const p = new URLSearchParams(raw);
          resolve(Object.fromEntries(p.entries()));
        } catch {
          resolve({});
        }
      }
    });
    req.on('error', () => resolve({}));
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    res.status(200).json({ status: true, response: 'ok', message: 'Webhook endpoint siap menerima pesan Fonnte.' });
    return;
  }

  try {
    const body = await getRequestBody(req);
    const rawSender = body.sender || body.from || body.phone || body.member;
    const message = body.message || body.text || 'Pesan WhatsApp Masuk';
    const name = body.name || body.pushName || '';

    // Cegah loop jika pesan berasal dari sistem/bot sendiri
    if (body.from_me === true || body.fromMe === true) {
      res.status(200).json({ status: true, message: 'Pesan keluar diabaikan' });
      return;
    }

    if (rawSender) {
      const cleanDigits = String(rawSender).replace(/[^0-9]/g, '');
      const contactId = 'cust_' + cleanDigits;
      const msgId = 'wh_' + Date.now();
      const timeNow = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      const customerName = name || `Pelanggan ${cleanDigits.slice(-4)}`;

      // Simpan langsung ke Firestore
      await setDoc(
        doc(firestore, 'contacts', contactId),
        {
          id: contactId,
          name: customerName,
          phone: '+' + cleanDigits,
          unreadCount: 1,
          lastMessage: String(message),
          lastMessageTime: timeNow,
          status: 'Pelanggan Baru',
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      await setDoc(
        doc(firestore, 'contacts', contactId, 'messages', msgId),
        {
          id: msgId,
          contactId,
          text: String(message),
          sender: 'customer',
          timestamp: timeNow,
          status: 'read',
        },
        { merge: true }
      );

      // Berikan respons HTTP 200 ke Fonnte
      res.status(200).json({ status: true, response: 'ok', message: 'Inbox berhasil diproses' });
      return;
    }

    res.status(200).json({ status: true, response: 'ok', message: 'Ping diterima' });
  } catch (err: any) {
    console.error('Webhook error:', err?.message);
    res.status(200).json({ status: true, error: err?.message });
  }
}