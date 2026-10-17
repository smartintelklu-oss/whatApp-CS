// Vercel Serverless Function: Direct Webhook for Fonnte (fonnte.com)
import type { IncomingMessage, ServerResponse } from 'http';

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

async function parseBody(req: VercelRequest): Promise<any> {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch {
      try {
        const params = new URLSearchParams(req.body);
        return Object.fromEntries(params.entries());
      } catch {
        return {};
      }
    }
  }

  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        try {
          const params = new URLSearchParams(raw);
          resolve(Object.fromEntries(params.entries()));
        } catch {
          resolve({});
        }
      }
    });
    req.on('error', () => resolve({}));
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS & Security Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // GET request: health-check or status
  if (req.method === 'GET') {
    res.status(200).json({
      status: true,
      message: 'Fonnte webhook endpoint is active and ready to receive incoming WhatsApp messages.',
      timestamp: new Date().toISOString(),
      recentCount: recentWebhookMessages.length,
    });
    return;
  }

  try {
    let body = await parseBody(req);

    if (body && typeof body === 'object') {
      const keys = Object.keys(body);
      if (keys.length === 1 && keys[0].trim().startsWith('{')) {
        try {
          body = JSON.parse(keys[0]);
        } catch {}
      }
    }

    if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
      body = req.query || {};
    }

    if (body && body.data && typeof body.data === 'object') {
      body = { ...body, ...body.data };
    }

    const sender = body.sender || body.from || body.phone || body.member;
    const message =
      body.message ||
      body.text ||
      (body.url ? `[Lampiran Media: ${body.filename || 'File'}]` : '') ||
      (body.location ? `[Lokasi: ${body.location}]` : '') ||
      'Pesan WhatsApp Masuk';
    const name = body.name || body.pushName;

    if (sender) {
      const entry = {
        id: 'wh_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        sender: String(sender),
        message: String(message),
        name: name ? String(name) : undefined,
        device: body.device ? String(body.device) : undefined,
        receivedAt: new Date().toISOString(),
      };
      recentWebhookMessages.unshift(entry);
      if (recentWebhookMessages.length > 50) recentWebhookMessages.pop();

      // Return 200 OK so Fonnte marks delivery as successful
      res.status(200).json({
        status: true,
        message: 'Fonnte webhook processed successfully',
        response: 'ok',
        data: entry,
      });
      return;
    }

    res.status(200).json({
      status: true,
      message: 'Webhook received (ping/verification)',
      received: body,
    });
  } catch (err: any) {
    console.error('Error handling Fonnte webhook:', err);
    res.status(200).json({ status: false, error: err?.message || 'Error processing webhook' });
  }
}
