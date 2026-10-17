// Vercel Serverless Function: Webhook Relay Reset / Regenerate
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const resp = await fetch('https://webhook.site/token', {
      method: 'POST',
      headers: { 'User-Agent': 'WhatsAppAutomator/2.0' },
      signal: AbortSignal.timeout(6000),
    });

    if (resp.ok) {
      const data: any = await resp.json();
      res.status(200).json({
        success: true,
        message: 'URL Webhook Relay baru berhasil digenerate!',
        relayConfig: {
          enabled: true,
          uuid: data.uuid,
          publicUrl: `https://webhook.site/${data.uuid}`,
          createdAt: new Date().toISOString(),
          totalPolledRequests: 0,
          autoPollIntervalSec: 2.5,
        },
      });
      return;
    }
  } catch {}

  const host = req.headers['host'] || 'what-app-cs.vercel.app';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  res.status(200).json({
    success: true,
    message: 'Menggunakan URL Webhook bawaan aplikasi.',
    relayConfig: {
      enabled: true,
      uuid: 'direct',
      publicUrl: `${protocol}://${host}/api/webhook/fonnte`,
    },
  });
}
