// Vercel Serverless Function: WhatsApp Gateway Status
import type { IncomingMessage, ServerResponse } from 'http';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
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

// Initialize Firestore for persistent gateway configuration
const fbApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const firestore =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(fbApp, firebaseConfig.firestoreDatabaseId)
    : getFirestore(fbApp);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 1. First check if a token was saved in Cloud Firestore
  let savedConfig: any = null;
  try {
    const configSnap = await getDoc(doc(firestore, 'gateway_config', 'current'));
    if (configSnap.exists()) {
      savedConfig = configSnap.data();
    }
  } catch (err: any) {
    console.warn('[Status API] Error reading gateway_config from Firestore:', err?.message);
  }

  // 2. Also check Authorization header as fallback
  const authHeader = req.headers['authorization'];
  let headerToken = '';
  if (authHeader) {
    headerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  }

  const effectiveToken = savedConfig?.fonnteToken || headerToken || '';

  if (effectiveToken) {
    const activeProvider = savedConfig?.activeProvider || 'fonnte';
    const deviceName = savedConfig?.deviceName || 'Fonnte WhatsApp Gateway';
    const devicePhone = savedConfig?.devicePhone || '+62 851-3366-6949';
    const quota = savedConfig?.quota ? String(savedConfig.quota) : '1000';
    const updatedAt = savedConfig?.updatedAt || new Date().toISOString();

    res.status(200).json({
      session: {
        status: 'connected',
        phoneNumber: devicePhone,
        pushName: deviceName,
        gatewayProvider: activeProvider,
        connectedAt: updatedAt,
        platform: 'Fonnte WhatsApp Cloud Gateway (fonnte.com)',
        fonnteConfig: {
          token: effectiveToken,
          device: devicePhone,
          quota,
          status: 'connect',
        },
      },
      gatewayProvider: activeProvider,
      gatewayConfig: {
        activeProvider,
        fonnte: {
          token: effectiveToken,
          device: devicePhone,
          quota,
          status: 'connect',
        },
      },
    });
    return;
  }

  // Fallback: Disconnected / QR ready state
  res.status(200).json({
    session: {
      status: 'disconnected',
      phoneNumber: null,
      pushName: null,
      gatewayProvider: 'fonnte',
      connectedAt: null,
    },
    gatewayProvider: 'fonnte',
    gatewayConfig: {
      activeProvider: 'fonnte',
      fonnte: {
        token: '',
        device: '',
        quota: '',
      },
    },
  });
}
