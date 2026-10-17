// Vercel Serverless Function: WhatsApp Gateway Status
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Check if token query or header is provided to verify live status with Fonnte
  const authHeader = req.headers['authorization'];
  let fonnteToken = '';
  if (authHeader) {
    fonnteToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  }

  if (fonnteToken) {
    try {
      const fonnteRes = await fetch('https://api.fonnte.com/device', {
        method: 'POST',
        headers: { 'Authorization': fonnteToken },
        body: new URLSearchParams({ token: fonnteToken }),
      });
      const data: any = await fonnteRes.json().catch(() => null);
      if (data?.status === true || data?.device) {
        res.status(200).json({
          session: {
            status: 'connected',
            phoneNumber: data.device || '+62 851-Fonnte',
            pushName: data.name || 'Sekolah Digital',
            gatewayProvider: 'fonnte',
            connectedAt: new Date().toISOString(),
          },
          gatewayProvider: 'fonnte',
          gatewayConfig: {
            fonnte: {
              token: fonnteToken,
              device: data.device,
              quota: data.quota || data.messages || '999',
            },
          },
        });
        return;
      }
    } catch {
      // ignore
    }
  }

  // Default response
  res.status(200).json({
    session: {
      status: 'qr_ready',
      phoneNumber: null,
      pushName: null,
      gatewayProvider: 'fonnte',
      connectedAt: null,
    },
    gatewayProvider: 'fonnte',
    gatewayConfig: {
      fonnte: {
        token: '',
        device: '',
        quota: '',
      },
    },
  });
}
