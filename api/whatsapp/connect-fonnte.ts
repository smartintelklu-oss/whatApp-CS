// Vercel Serverless Function: Connect Fonnte Gateway
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
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
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

    const rawToken = body?.token;
    if (!rawToken || !String(rawToken).trim()) {
      res.status(400).json({ success: false, error: 'Token API Fonnte wajib diisi.' });
      return;
    }

    const cleanToken = cleanFonnteToken(rawToken);

    // 1. Verify with Fonnte /device endpoint
    const fonnteRes = await fetch('https://api.fonnte.com/device', {
      method: 'POST',
      headers: {
        'Authorization': cleanToken,
      },
      body: new URLSearchParams({ token: cleanToken }),
    });

    const data: any = await fonnteRes.json().catch(() => null);

    if (data?.status === true || data?.device || data?.name || data?.device_status) {
      const displayPhone = data.device ? normalizePhoneNumber(data.device).display : '+62 851-Fonnte';
      const deviceName = data.name || 'Sekolah Digital';
      const quota = data.quota || data.messages || '999';

      res.status(200).json({
        success: true,
        message: `Berhasil terhubung ke Fonnte! Akun: ${deviceName} (${displayPhone})`,
        device: displayPhone,
        name: deviceName,
        quota: String(quota),
        deviceStatus: data.device_status || 'connect',
        gatewayProvider: 'fonnte',
        session: {
          status: 'connected',
          phoneNumber: displayPhone,
          pushName: deviceName,
          gatewayProvider: 'fonnte',
          connectedAt: new Date().toISOString(),
        },
      });
      return;
    }

    // 2. Fallback check /get-devices if account token
    const devicesRes = await fetch('https://api.fonnte.com/get-devices', {
      method: 'POST',
      headers: {
        'Authorization': cleanToken,
      },
      body: new URLSearchParams({ dummy: '1' }),
    });
    const devData: any = await devicesRes.json().catch(() => null);

    if (devData?.status === true && Array.isArray(devData?.data) && devData.data.length > 0) {
      const target = devData.data.find((d: any) => d.status === 'connect') || devData.data[0];
      const displayPhone = target.device ? normalizePhoneNumber(target.device).display : '+62 851-Fonnte';
      const deviceName = target.name || 'Fonnte Device';
      const quota = target.quota || '999';

      res.status(200).json({
        success: true,
        message: `Berhasil terhubung ke Fonnte! Akun: ${deviceName} (${displayPhone})`,
        device: displayPhone,
        name: deviceName,
        quota: String(quota),
        deviceStatus: target.status || 'connect',
        gatewayProvider: 'fonnte',
        session: {
          status: 'connected',
          phoneNumber: displayPhone,
          pushName: deviceName,
          gatewayProvider: 'fonnte',
          connectedAt: new Date().toISOString(),
        },
      });
      return;
    }

    if (body?.force === true || body?.force === 'true') {
      const displayPhone = '+62 851-Fonnte';
      const deviceName = 'Fonnte Device';
      res.status(200).json({
        success: true,
        message: 'Token Fonnte disimpan langsung (Bypass Verifikasi).',
        device: displayPhone,
        name: deviceName,
        quota: 'Aktif',
        deviceStatus: 'connect',
        gatewayProvider: 'fonnte',
        session: {
          status: 'connected',
          phoneNumber: displayPhone,
          pushName: deviceName,
          gatewayProvider: 'fonnte',
          connectedAt: new Date().toISOString(),
        },
      });
      return;
    }

    res.status(400).json({
      success: false,
      error: data?.reason || 'Token Fonnte tidak dikenali atau salah. Periksa kembali token dari menu Device di https://md.fonnte.com/',
      raw: data,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: 'Terjadi kesalahan server saat menghubungi Fonnte: ' + err?.message,
    });
  }
}
