// Vercel Serverless Function: Direct Webhook for Fonnte (fonnte.com)
import type { IncomingMessage, ServerResponse } from 'http';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

interface VercelRequest extends IncomingMessage {
  body: any;
  query: Record<string, string>;
}

interface VercelResponse extends ServerResponse {
  status: (code: number) => VercelResponse;
  json: (data: any) => void;
  send: (data: any) => void;
}

// In-memory buffer for recent webhook payloads within serverless container lifecycle
export const recentWebhookMessages: any[] = [];

// Initialize Firestore for cloud persistence across all webhooks
const fbApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const firestore =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(fbApp, firebaseConfig.firestoreDatabaseId)
    : getFirestore(fbApp);

function cleanJsonString(str: string): string {
  return str.replace(/^\uFEFF/, '').trim();
}

async function parseBody(req: VercelRequest): Promise<any> {
  // 1. If req.body is already a Buffer
  if (req.body && Buffer.isBuffer(req.body)) {
    const text = cleanJsonString(req.body.toString('utf-8'));
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      try {
        const params = new URLSearchParams(text);
        return Object.fromEntries(params.entries());
      } catch {
        return {};
      }
    }
  }

  // 2. If req.body is already an object
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  // 3. If req.body is a string
  if (typeof req.body === 'string' && req.body.trim()) {
    const text = cleanJsonString(req.body);
    try {
      return JSON.parse(text);
    } catch {
      try {
        const params = new URLSearchParams(text);
        const entries = Object.fromEntries(params.entries());
        if (Object.keys(entries).length > 0) return entries;
      } catch {}
    }
  }

  // 4. If stream ended
  if ((req as any).readableEnded || (req as any).complete) {
    return {};
  }

  // 5. Read stream
  return new Promise((resolve) => {
    let raw = '';
    const timeout = setTimeout(() => {
      if (raw.trim()) {
        try {
          resolve(JSON.parse(cleanJsonString(raw)));
          return;
        } catch {
          try {
            const params = new URLSearchParams(raw);
            resolve(Object.fromEntries(params.entries()));
            return;
          } catch {}
        }
      }
      resolve({});
    }, 600);

    req.on('data', (chunk) => {
      raw += typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
    });

    req.on('end', () => {
      clearTimeout(timeout);
      if (!raw.trim()) return resolve({});
      const cleaned = cleanJsonString(raw);
      try {
        resolve(JSON.parse(cleaned));
      } catch {
        try {
          const params = new URLSearchParams(cleaned);
          resolve(Object.fromEntries(params.entries()));
        } catch {
          resolve({});
        }
      }
    });

    req.on('error', () => {
      clearTimeout(timeout);
      resolve({});
    });
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS & Security Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // GET request: health-check, status & recent message logs
  if (req.method === 'GET') {
    res.status(200).json({
      status: true,
      response: 'ok',
      message: 'Fonnte webhook endpoint is active and ready to receive incoming WhatsApp messages.',
      timestamp: new Date().toISOString(),
      recentCount: recentWebhookMessages.length,
      messages: recentWebhookMessages.slice(0, 20),
    });
    return;
  }

  const startTime = Date.now();

  try {
    let body = await parseBody(req);

    // Case: body is an object where first key is a raw JSON string
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const keys = Object.keys(body);
      if (keys.length === 1 && keys[0].trim().startsWith('{')) {
        try {
          body = JSON.parse(keys[0]);
        } catch {}
      }
    }

    // Fallback to query params
    if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
      body = req.query || {};
    }

    // Handle nested data wrappers (e.g. { data: { sender: ... } })
    if (body && body.data) {
      if (typeof body.data === 'string') {
        try {
          body = { ...body, ...JSON.parse(body.data) };
        } catch {}
      } else if (typeof body.data === 'object') {
        body = { ...body, ...body.data };
      }
    }

    // Identify sender: support standard Fonnte parameters
    const rawSender =
      body.sender || body.from || body.phone || body.member || body.target || body.wa_id;
    const sender = rawSender !== undefined && rawSender !== null ? String(rawSender).trim() : '';

    // Identify message content
    const message =
      body.message ||
      body.text ||
      (body.url ? `[Lampiran Media: ${body.filename || 'File'}]` : '') ||
      (body.location ? `[Lokasi: ${body.location}]` : '') ||
      (body.pollname ? `[Polling: ${body.pollname}${body.choices ? ` - ${body.choices}` : ''}]` : '') ||
      (body.choices ? `[Pilihan Polling: ${body.choices}]` : '') ||
      (sender ? 'Pesan WhatsApp Masuk' : '');

    const name = body.name || body.pushName || body.pushname || body.senderName;
    const device = body.device ? String(body.device) : undefined;

    if (sender) {
      const cleanDigits = sender.replace(/[^0-9]/g, '');
      const displayPhone = sender.startsWith('+') ? sender : '+' + sender;
      const contactId = 'cust_' + (cleanDigits || Date.now());
      const msgId = 'wh_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const timeNow = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      const customerName = name ? String(name) : `Pelanggan ${cleanDigits.slice(-4) || 'WhatsApp'}`;

      const entry = {
        id: msgId,
        sender,
        message: String(message),
        name: customerName,
        device,
        location: body.location || undefined,
        url: body.url || undefined,
        receivedAt: new Date().toISOString(),
      };

      recentWebhookMessages.unshift(entry);
      if (recentWebhookMessages.length > 50) recentWebhookMessages.pop();

      console.log(
        `[Fonnte Webhook] [INBOUND] ${sender} (${customerName}): "${message}" [${Date.now() - startTime}ms]`
      );

      // CRITICAL FOR SERVERLESS: Must await Firestore writes so Vercel does not freeze execution before writes complete!
      try {
        await Promise.all([
          setDoc(
            doc(firestore, 'contacts', contactId),
            {
              id: contactId,
              name: customerName,
              phone: displayPhone,
              avatar: `https://images.unsplash.com/photo-${1534528741775 + Math.floor(Math.random() * 1000)}?w=150&auto=format&fit=crop&q=80`,
              unreadCount: 1,
              lastMessage: String(message),
              lastMessageTime: timeNow,
              status: 'Pelanggan Baru',
              notes: 'Pesan masuk dari Fonnte WhatsApp Gateway.',
              totalOrders: 0,
              lifetimeValue: 'Rp 0',
              isAiAutoReplyEnabled: true,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          ),
          setDoc(
            doc(firestore, 'contacts', contactId, 'messages', msgId),
            {
              id: msgId,
              contactId,
              text: String(message),
              sender: 'customer',
              senderName: customerName,
              timestamp: timeNow,
              status: 'read',
            },
            { merge: true }
          ),
        ]);
        console.log(`[Fonnte Webhook] [FIRESTORE SYNC OK] Saved contacts/${contactId}/messages/${msgId}`);
      } catch (fsErr: any) {
        console.error('[Fonnte Webhook] [FIRESTORE SYNC ERROR]:', fsErr?.message);
      }

      // Check if Smart Auto-reply can be sent back to WhatsApp via Fonnte
      try {
        const configSnap = await getDoc(doc(firestore, 'gateway_config', 'current'));
        if (configSnap.exists()) {
          const cfg = configSnap.data();
          const fonnteToken = cfg.fonnteToken;
          if (fonnteToken && cleanDigits.length >= 8) {
            const replyText = `Halo Kak ${customerName}! Terima kasih sudah menghubungi kami. Pesan Anda telah kami terima dan tim CS kami akan segera membantu Anda. 😊`;
            const replyMsgId = 'reply_' + Date.now();

            // Send via Fonnte API
            const sendParams = new URLSearchParams({
              target: cleanDigits,
              message: replyText,
            });

            await fetch('https://api.fonnte.com/send', {
              method: 'POST',
              headers: { Authorization: fonnteToken },
              body: sendParams,
              signal: AbortSignal.timeout(3000),
            })
              .then((r) => r.json())
              .then(async (sendRes) => {
                if (sendRes?.status === true) {
                  // Save auto-reply to Firestore
                  await setDoc(
                    doc(firestore, 'contacts', contactId, 'messages', replyMsgId),
                    {
                      id: replyMsgId,
                      contactId,
                      text: replyText,
                      sender: 'bot',
                      senderName: 'Asisten CS AI',
                      timestamp: timeNow,
                      status: 'delivered',
                      isAiGenerated: true,
                    },
                    { merge: true }
                  );
                }
              })
              .catch(() => {});
          }
        }
      } catch {}

      // Return instant success response to Fonnte
      res.status(200).json({
        status: true,
        response: 'ok',
        message: 'Fonnte webhook processed successfully',
        data: entry,
      });
      return;
    }

    // Ping or device status update from Fonnte
    res.status(200).json({
      status: true,
      response: 'ok',
      message: 'Fonnte ping/status received successfully',
      receivedPayload: body,
    });
  } catch (err: any) {
    console.error('[Fonnte Webhook Error]:', err?.message);
    res.status(200).json({
      status: true,
      response: 'ok',
      warning: err?.message,
    });
  }
}
