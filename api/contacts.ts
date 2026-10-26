// Vercel Serverless Function: Contacts CRUD via Cloud Firestore
import type { IncomingMessage, ServerResponse } from 'http';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
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

  // GET: Fetch all contacts from Firestore
  if (req.method === 'GET') {
    try {
      const colRef = collection(firestore, 'contacts');
      const snap = await getDocs(colRef);
      const contacts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      res.status(200).json({ contacts });
      return;
    } catch (err: any) {
      console.warn('[Contacts API] Error reading contacts:', err?.message);
      res.status(200).json({ contacts: [] });
      return;
    }
  }

  // POST: Create or update contact in Firestore
  if (req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { name, phone, tag = 'Pelanggan Baru', notes = '', isAiAutoReplyEnabled = true } = body;
      if (!name || !phone) {
        res.status(400).json({ error: 'Nama dan nomor telepon wajib diisi' });
        return;
      }

      const cleanDigits = phone.replace(/[^0-9]/g, '');
      const contactId = body.id || 'cust_' + (cleanDigits || Date.now());
      const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

      const contactData = {
        id: contactId,
        name: String(name),
        phone: String(phone),
        avatar:
          body.avatar ||
          `https://images.unsplash.com/photo-${1534528741775 + Math.floor(Math.random() * 1000)}?w=150&auto=format&fit=crop&q=80`,
        unreadCount: Number(body.unreadCount || 0),
        tag: String(tag),
        status: String(tag),
        lastMessage: body.lastMessage || '',
        lastMessageTime: body.lastMessageTime || timeStr,
        notes: String(notes),
        totalOrders: Number(body.totalOrders || 0),
        lifetimeValue: String(body.lifetimeValue || 'Rp 0'),
        isAiAutoReplyEnabled: Boolean(isAiAutoReplyEnabled),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(firestore, 'contacts', contactId), contactData, { merge: true });

      res.status(200).json({
        success: true,
        contact: contactData,
      });
      return;
    } catch (err: any) {
      console.error('[Contacts API] Error saving contact:', err);
      res.status(500).json({ error: err?.message || 'Gagal menyimpan kontak' });
      return;
    }
  }

  res.status(405).json({ error: 'Method Not Allowed' });
}
