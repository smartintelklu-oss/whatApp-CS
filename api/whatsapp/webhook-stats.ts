// Vercel Serverless Function: Webhook Diagnostics & Stats
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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const host = req.headers['host'] || 'what-app-cs.vercel.app';
  const protocol = host.includes('localhost') ? 'http' : 'https';

  const directUrl = `${protocol}://${host}/api/webhook/fonnte`;
  const relayUrl = `https://webhook.site/${DEFAULT_RELAY_UUID}`;

  res.status(200).json({
    success: true,
    fonnteWebhookUrl: directUrl,
    directWebhookUrl: directUrl,
    relayWebhookUrl: relayUrl,
    bablastWebhookUrl: `${protocol}://${host}/api/webhook/bablast`,
    activeProvider: 'fonnte',
    relayConfig: {
      enabled: true,
      uuid: DEFAULT_RELAY_UUID,
      publicUrl: relayUrl,
      directUrl: directUrl,
      autoPollIntervalSec: 2.5,
    },
    stats: {
      totalReceived: 0,
      lastReceivedAt: null,
      lastSender: null,
      lastMessage: null,
      lastProvider: 'fonnte',
      recentLogs: [],
    },
  });
}
