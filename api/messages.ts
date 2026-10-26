// Vercel Serverless Function: Messages CRUD via Cloud Firestore
import type { IncomingMessage, ServerResponse } from 'http';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, getDocs } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

interface VercelRequest extends IncomingMessage {
  body: any;
  query: Record<string, string>;
}

interface VercelResponse extends ServerResponse {
  status: (code: number) => VercelResponse;
  json: (data: any) => void;
  send: (data: any) => void;
}

const fbApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const firestore =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(fbApp, firebaseConfig.firestoreDatabaseId)
    : getFirestore(fbApp);

async function parseBody(req: VercelRequest): Promise<any> {
  if (req.body && typeof req.body === 'object') return req.body;
  if (req.body && typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
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

  // GET: Fetch messages grouped by contactId
  if (req.method === 'GET') {
    try {
      const contactsSnap = await getDocs(collection(firestore, 'contacts'));
      const messagesMap: Record<string, any[]> = {};

      await Promise.all(
        contactsSnap.docs.map(async (contactDoc) => {
          try {
            const msgsSnap = await getDocs(
              collection(firestore, 'contacts', contactDoc.id, 'messages')
            );
            if (!msgsSnap.empty) {
              messagesMap[contactDoc.id] = msgsSnap.docs.map((d) => ({
                id: d.id,
                ...d.data(),
              }));
            }
          } catch {}
        })
      );

      res.status(200).json({ messages: messagesMap });
      return;
    } catch (err: any) {
      console.warn('[Messages API] Error fetching messages:', err?.message);
      res.status(200).json({ messages: {} });
      return;
    }
  }

  // POST: Save individual message to contact thread
  if (req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { contactId, text, sender = 'agent' } = body;
      if (!contactId || !text) {
        res.status(400).json({ error: 'contactId and text are required' });
        return;
      }

      const msgId = body.id || 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const timeStr = body.timestamp || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

      const msgData = {
        id: msgId,
        contactId: String(contactId),
        text: String(text),
        sender: String(sender),
        senderName: body.senderName || (sender === 'bot' ? 'Asisten CS AI' : sender === 'customer' ? 'Pelanggan' : 'CS Admin'),
        timestamp: timeStr,
        status: body.status || 'delivered',
        mediaType: body.mediaType || 'none',
        mediaUrl: body.mediaUrl || null,
        isAiGenerated: Boolean(body.isAiGenerated),
      };

      await setDoc(doc(firestore, 'contacts', String(contactId), 'messages', msgId), msgData, {
        merge: true,
      });

      // Also update contact's lastMessage
      await setDoc(
        doc(firestore, 'contacts', String(contactId)),
        {
          lastMessage: String(text),
          lastMessageTime: timeStr,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      res.status(200).json({ success: true, message: msgData });
      return;
    } catch (err: any) {
      console.error('[Messages API] Error saving message:', err);
      res.status(500).json({ error: err?.message || 'Gagal menyimpan pesan' });
      return;
    }
  }

  res.status(405).json({ error: 'Method Not Allowed' });
}
