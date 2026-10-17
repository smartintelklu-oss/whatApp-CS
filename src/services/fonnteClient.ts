// Direct Client-Side Fonnte Gateway Service
// Allows seamless WhatsApp connection and messaging directly from the browser,
// providing 100% compatibility for Vercel, Cloud Run, Netlify, and static deployments.

export interface FonnteSession {
  token: string;
  device: string;
  name: string;
  quota: string;
  deviceStatus: string;
  connectedAt: string;
}

const STORAGE_KEY = 'cs_fonnte_gateway_session';

export function cleanFonnteToken(raw: string): string {
  if (!raw) return '';
  let token = String(raw)
    // Remove zero-width spaces, non-breaking spaces, BOM, and direction marks
    .replace(/[\u200B-\u200D\uFEFF\u00A0\u202A-\u202E]/g, '')
    .trim();

  // Strip code syntax like `$token = "xyz";` or `const token = 'xyz'`
  token = token.replace(/^(?:const|let|var|\$)?\s*(?:token|apiKey|authorization|fonnteToken)?\s*[:=]\s*/i, '');

  // Strip HTTP header prefixes like `Authorization:`, `Bearer `, `Token:`, `apikey:`
  token = token.replace(/^(?:authorization|auth|apikey|api_key|token|bearer)\s*[:=\s]+/i, '');
  token = token.replace(/^bearer\s+/i, '');

  // Strip wrapping quotes and trailing semicolon or trailing comma
  token = token.replace(/^["'`]|["'`]$/g, '').replace(/[;,\s]+$/g, '').trim();

  // Remove newline, carriage returns, tabs
  token = token.replace(/[\r\n\t]/g, '');

  return token.trim();
}

export function normalizePhoneNumber(rawPhone: string): { clean: string; display: string } {
  let base = (rawPhone || '').split('@')[0].split(':')[0];
  let digits = base.replace(/[^0-9]/g, '');
  if (digits.startsWith('0')) {
    digits = '62' + digits.slice(1);
  } else if (digits.startsWith('8')) {
    digits = '62' + digits;
  }
  let display = '+' + digits;
  if (digits.startsWith('62') && digits.length >= 10) {
    display = `+62 ${digits.slice(2, 5)}-${digits.slice(5, 9)}-${digits.slice(9)}`;
  }
  return { clean: digits, display };
}

export async function validateFonnteTokenDirect(rawToken: string): Promise<{
  success: boolean;
  token: string;
  device?: string;
  name?: string;
  quota?: string;
  deviceStatus?: string;
  error?: string;
  details?: string;
}> {
  const token = cleanFonnteToken(rawToken);
  if (!token) {
    return { success: false, token: '', error: 'Token API Fonnte kosong atau format tidak valid.' };
  }

  // 1. Try /device endpoint
  try {
    const res = await fetch('https://api.fonnte.com/device', {
      method: 'POST',
      headers: {
        'Authorization': token,
      },
      body: new URLSearchParams({ token }),
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (
        data &&
        (data.status === true ||
          data.device ||
          data.name ||
          data.device_status ||
          (data.reason &&
            !data.reason.toLowerCase().includes('token invalid') &&
            !data.reason.toLowerCase().includes('unknown user') &&
            !data.reason.toLowerCase().includes('invalid token')))
      ) {
        const deviceDisplay = data.device ? normalizePhoneNumber(data.device).display : '+62 851-Fonnte';
        const name = data.name || 'Sekolah Digital';
        const quota = String(data.quota || data.messages || '999');
        const deviceStatus = data.device_status || (data.status ? 'connect' : (data.reason?.toLowerCase().includes('disconnect') ? 'disconnect' : 'connect'));

        return {
          success: true,
          token,
          device: deviceDisplay,
          name,
          quota,
          deviceStatus,
          details: deviceStatus === 'disconnect' ? 'Perangkat valid di Fonnte namun berstatus Disconnect. Silakan scan QR di md.fonnte.com jika ingin mengirim/menerima pesan.' : undefined,
        };
      } else if (data?.reason) {
        // If reason is token invalid, try /get-devices before giving up
        if (!data.reason.toLowerCase().includes('invalid') && !data.reason.toLowerCase().includes('unknown user')) {
          return {
            success: false,
            token,
            error: `Fonnte menolak token: ${data.reason}`,
          };
        }
      }
    }
  } catch (err: any) {
    console.warn('[Fonnte Client] Direct /device failed:', err?.message);
  }

  // 2. Try /get-devices endpoint (in case token is an Account/Global Token)
  try {
    const res = await fetch('https://api.fonnte.com/get-devices', {
      method: 'POST',
      headers: {
        'Authorization': token,
      },
      body: new URLSearchParams({ dummy: '1' }),
    });

    if (res.ok) {
      const devData = await res.json().catch(() => null);
      if (devData?.status === true && Array.isArray(devData?.data) && devData.data.length > 0) {
        const target = devData.data.find((d: any) => d.status === 'connect') || devData.data[0];
        const actualToken = cleanFonnteToken(target.token || token);
        const deviceDisplay = target.device ? normalizePhoneNumber(target.device).display : '+62 851-Fonnte';
        return {
          success: true,
          token: actualToken,
          device: deviceDisplay,
          name: target.name || 'Fonnte Multi-Device',
          quota: String(target.quota || '999'),
          deviceStatus: target.status || 'connect',
        };
      }
    }
  } catch (err: any) {
    console.warn('[Fonnte Client] Direct /get-devices failed:', err?.message);
  }

  return {
    success: false,
    token,
    error: 'Token Fonnte tidak valid atau perangkat belum terdaftar di Fonnte. Periksa token Anda di md.fonnte.com.',
  };
}

export async function sendFonnteMessageDirect(
  token: string,
  targetPhone: string,
  message: string,
  mediaUrl?: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  const cleanToken = cleanFonnteToken(token);
  if (!cleanToken) {
    return { success: false, error: 'Token Fonnte tidak tersedia.' };
  }

  const { clean } = normalizePhoneNumber(targetPhone);
  if (!clean) {
    return { success: false, error: 'Nomor telepon tujuan tidak valid.' };
  }

  try {
    const bodyParams = new URLSearchParams();
    bodyParams.append('target', clean);
    bodyParams.append('message', message);
    if (mediaUrl) {
      bodyParams.append('url', mediaUrl);
    }

    const res = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': cleanToken,
      },
      body: bodyParams,
    });

    const data = await res.json().catch(() => null);
    if (res.ok && data?.status === true) {
      return { success: true, data };
    } else {
      return {
        success: false,
        error: data?.reason || data?.detail || 'Gagal mengirim pesan melalui Fonnte API.',
        data,
      };
    }
  } catch (err: any) {
    return { success: false, error: 'Gagal menghubungi Fonnte API: ' + (err?.message || err) };
  }
}

export function saveFonnteSession(session: FonnteSession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    localStorage.setItem('wa_gateway_provider', 'fonnte');
  } catch (e) {
    console.error('Failed to save Fonnte session to localStorage:', e);
  }
}

export function getFonnteSession(): FonnteSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearFonnteSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    if (localStorage.getItem('wa_gateway_provider') === 'fonnte') {
      localStorage.removeItem('wa_gateway_provider');
    }
  } catch (e) {
    console.error('Failed to clear Fonnte session from localStorage:', e);
  }
}
