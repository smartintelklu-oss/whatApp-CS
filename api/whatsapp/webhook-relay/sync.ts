// Vercel Serverless Function: Webhook Relay Sync / Manual Pull
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

const DEFAULT_RELAY_UUID = '4ad536af-092d-4362-a70b-4e9dd12c2952';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const uuid = DEFAULT_RELAY_UUID;
    const fetchUrl = `https://webhook.site/token/${uuid}/requests?per_page=15`;

    let processedCount = 0;
    const errors: string[] = [];
    const newMessages: any[] = [];

    try {
      const resp = await fetch(fetchUrl, {
        headers: { 'User-Agent': 'WhatsAppAutomator/2.0' },
        signal: AbortSignal.timeout(6000),
      });

      if (resp.ok) {
        const result: any = await resp.json().catch(() => null);
        if (result && Array.isArray(result.data)) {
          for (const item of result.data) {
            try {
              let payload = item.content;
              if (typeof payload === 'string') {
                try {
                  payload = JSON.parse(payload);
                } catch {
                  try {
                    const params = new URLSearchParams(payload);
                    payload = Object.fromEntries(params.entries());
                  } catch {
                    payload = {};
                  }
                }
              }

              if (payload && typeof payload === 'object') {
                const keys = Object.keys(payload);
                if (keys.length === 1 && keys[0].trim().startsWith('{')) {
                  try {
                    payload = JSON.parse(keys[0]);
                  } catch {}
                }
              }

              if (payload && payload.data && typeof payload.data === 'object') {
                payload = { ...payload, ...payload.data };
              }

              const sender = payload?.sender || payload?.from || payload?.phone;
              const message = payload?.message || payload?.text;
              if (sender && message) {
                processedCount++;
                newMessages.push({
                  sender: String(sender),
                  message: String(message),
                  name: payload.name || payload.pushName,
                  timestamp: item.created_at || new Date().toISOString(),
                });
              }
            } catch {
              // skip malformed
            }
          }
        }
      }
    } catch (e: any) {
      errors.push(e?.message || 'Gagal menghubungi Webhook Relay');
    }

    res.status(200).json({
      success: true,
      processedCount,
      messages: newMessages,
      errors,
      relayConfig: {
        enabled: true,
        uuid,
        publicUrl: `https://webhook.site/${uuid}`,
        lastPolledAt: new Date().toISOString(),
        totalPolledRequests: processedCount,
        autoPollIntervalSec: 2.5,
      },
      stats: {
        totalReceived: processedCount,
        lastReceivedAt: new Date().toISOString(),
        lastProvider: 'fonnte',
        recentLogs: newMessages,
      },
    });
  } catch (err: any) {
    res.status(200).json({
      success: true,
      processedCount: 0,
      errors: [err?.message || 'Unknown error'],
      relayConfig: {
        enabled: true,
        uuid: DEFAULT_RELAY_UUID,
        publicUrl: `https://webhook.site/${DEFAULT_RELAY_UUID}`,
      },
    });
  }
}
