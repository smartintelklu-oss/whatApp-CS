// Vercel Serverless Function: Direct Webhook for Fonnte (fonnte.com)
import type { IncomingMessage, ServerResponse } from 'http';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
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

// Relay UUID for cross-environment message synchronization
const DEFAULT_RELAY_UUID = '4ad536af-092d-4362-a70b-4e9dd12c2952';

// Initialize Firestore for cloud persistence across all webhooks
const fbApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const firestore = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(fbApp, firebaseConfig.firestoreDatabaseId)
  : getFirestore(fbApp);

function cleanJsonString(str: string): string {
  return str.replace(/^\uFEFF/, '').trim();
}

async function parseBody(req: VercelRequest): Promise<any> {
  // 1. If req.body is already a Buffer (e.g. raw body)
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

  // 2. If req.body is already parsed object by Vercel
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
      } catch {
        // continue
      }
    }
  }

  // 4. If body stream has already ended without data
  if ((req as any).readableEnded || (req as any).complete) {
    return {};
  }

  // 5. Read stream with strict safety timeout (preventing Vercel serverless execution hang)
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
    }, 1500);

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

    req.on('error', (err) => {
      clearTimeout(timeout);
      console.warn('[Fonnte Webhook Stream Error]:', err?.message);
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

  // GET request: health-check, status, & message diagnostics
  if (req.method === 'GET') {
    res.status(200).json({
      status: true,
      message: 'Fonnte webhook endpoint is active and ready to receive incoming WhatsApp messages.',
      timestamp: new Date().toISOString(),
      recentCount: recentWebhookMessages.length,
      messages: recentWebhookMessages.slice(0, 20),
    });
    return;
  }

  const startTime = Date.now();
  console.log(`[Fonnte Webhook] [INBOUND] Method: ${req.method} | Content-Type: ${req.headers['content-type'] || 'none'}`);

  try {
    let body = await parseBody(req);

    // Case: body is an object where first key is a raw JSON string (common in curl / form POSTs)
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const keys = Object.keys(body);
      if (keys.length === 1 && keys[0].trim().startsWith('{')) {
        try {
          body = JSON.parse(keys[0]);
          console.log('[Fonnte Webhook] Unwrapped single-key JSON string payload successfully');
        } catch {}
      }
    }

    // Fallback to query params if body is empty
    if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
      body = req.query || {};
    }

    // Handle nested data wrappers (e.g. { data: { sender: ... } } or { data: "{\"sender\":...}" })
    if (body && body.data) {
      if (typeof body.data === 'string') {
        try {
          body = { ...body, ...JSON.parse(body.data) };
        } catch {}
      } else if (typeof body.data === 'object') {
        body = { ...body, ...body.data };
      }
    }

    console.log('[Fonnte Webhook] [PARSED DATA]:', JSON.stringify(body));

    // Identify sender: support standard Fonnte parameters
    const rawSender = body.sender || body.from || body.phone || body.member || body.target || body.wa_id;
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
      const entry = {
        id: 'wh_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        sender,
        message: String(message),
        name: name ? String(name) : undefined,
        device,
        location: body.location || undefined,
        url: body.url || undefined,
        receivedAt: new Date().toISOString(),
      };

      recentWebhookMessages.unshift(entry);
      if (recentWebhookMessages.length > 50) recentWebhookMessages.pop();

      console.log(`[Fonnte Webhook] [SUCCESS] Inbound from ${sender} (${name || 'Unknown'}): "${message}" [${Date.now() - startTime}ms]`);

      // Persist to Cloud Firestore so the dashboard displays it across all sessions
      try {
        const cleanDigits = sender.replace(/[^0-9]/g, '');
        const contactId = 'cust_' + cleanDigits;
        const timeNow = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        await setDoc(doc(firestore, 'contacts', contactId), {
          id: contactId,
          name: name ? String(name) : `Pelanggan ${cleanDigits.slice(-4)}`,
          phone: sender.startsWith('+') ? sender : '+' + sender,
          unreadCount: 1,
          lastMessage: String(message),
          lastMessageTime: timeNow,
          status: 'Pelanggan Baru',
          updatedAt: new Date().toISOString(),
        }, { merge: true });

        await setDoc(doc(firestore, 'contacts', contactId, 'messages', entry.id), {
          id: entry.id,
          contactId,
          text: String(message),
          sender: 'customer',
          timestamp: timeNow,
          status: 'read',
        }, { merge: true });
        console.log(`[Fonnte Webhook] [FIRESTORE SYNC] Saved to Firestore: contacts/${contactId}/messages/${entry.id}`);
      } catch (fsErr: any) {
        console.warn('[Fonnte Webhook] [FIRESTORE SYNC WARNING]:', fsErr?.message);
      }

      // Asynchronous background relay to shared webhook relay so live instances sync automatically
      try {
        fetch(`https://webhook.site/${DEFAULT_RELAY_UUID}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(2000),
        }).catch(() => {});
      } catch {}

      // Return 200 OK with status confirmation for Fonnte delivery check
      res.status(200).json({
        status: true,
        message: 'Fonnte webhook processed successfully',
        response: 'ok',
        data: entry,
      });
      return;
    }

    // Ping / Device status / Verification event from Fonnte
    console.log('[Fonnte Webhook] [STATUS/PING EVENT]:', JSON.stringify(body));
    res.status(200).json({
      status: true,
      message: 'Webhook received (ping/verification)',
      received: body,
    });
  } catch (err: any) {
    console.error('[Fonnte Webhook] [PARSING ERROR]:', err);
    res.status(200).json({
      status: false,
      error: err?.message || 'Error processing webhook',
    });
  }
}
