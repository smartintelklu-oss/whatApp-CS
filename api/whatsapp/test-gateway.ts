// Vercel Serverless Function: Test Gateway
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

function cleanFonnteToken(raw: any): string {
  if (!raw) return '';
  let token = String(raw)
    .replace(/[\u200B-\u200D\uFEFF\u00A0\u202A-\u202E]/g, '')
    .trim();
  token = token.replace(/^(?:const|let|var|\$)?\s*(?:token|apiKey|authorization|fonnteToken)?\s*[:=]\s*/i, '');
  token = token.replace(/^(?:authorization|auth|apikey|api_key|token|bearer)\s*[:=\s]+/i, '');
  token = token.replace(/^bearer\s+/i, '');
  token = token.replace(/^["'`]|["'`]$/g, '').replace(/[;,\s]+$/g, '').trim();
  token = token.replace(/[\r\n\t]/g, '');
  return token.trim();
}

function normalizePhoneNumber(rawPhone: string): { clean: string; display: string } {
  let base = (rawPhone || '').split('@')[0].split(':')[0];
  let digits = base.replace(/[^0-9]/g, '');
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  else if (digits.startsWith('8')) digits = '62' + digits;
  let display = '+' + digits;
  if (digits.startsWith('62') && digits.length >= 10) {
    display = `+62 ${digits.slice(2, 5)}-${digits.slice(5, 9)}-${digits.slice(9)}`;
  }
  return { clean: digits, display };
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
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // continue
      }
    }

    const { provider = 'fonnte', targetPhone, token, message } = body || {};
    const cleanToken = cleanFonnteToken(token);

    if (!targetPhone || !cleanToken) {
      res.status(400).json({ success: false, error: 'targetPhone dan token wajib diisi.' });
      return;
    }

    const { clean } = normalizePhoneNumber(targetPhone);
    const bodyParams = new URLSearchParams();
    bodyParams.append('target', clean);
    bodyParams.append('message', message || 'Uji coba koneksi Fonnte berhasil!');

    const fonnteRes = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: { 'Authorization': cleanToken },
      body: bodyParams,
    });

    const data: any = await fonnteRes.json().catch(() => null);

    if (fonnteRes.ok && data?.status === true) {
      res.status(200).json({
        success: true,
        message: 'Pesan uji coba berhasil terkirim melalui Fonnte!',
        fonnteResponse: data,
      });
      return;
    }

    res.status(400).json({
      success: false,
      error: data?.reason || data?.detail || 'Gagal mengirim pesan uji coba via Fonnte.',
      raw: data,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Internal Error' });
  }
}
