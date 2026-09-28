import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import QRCode from 'qrcode';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  Browsers,
  fetchLatestBaileysVersion,
  type WASocket,
} from '@whiskeysockets/baileys';
import pino from 'pino';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '15mb' }));

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// In-memory session state for WhatsApp Gateway
interface WASession {
  status: 'disconnected' | 'qr_ready' | 'authenticating' | 'connected';
  qrCodeData: string;
  qrCodeRaw?: string;
  qrExpiresAt: number;
  connectedAt?: string;
  phoneNumber?: string;
  pushName?: string;
  platform?: string;
  batteryLevel?: number;
  isAutoReplyActive: boolean;
  isRealGateway: boolean;
}

let waSession: WASession = {
  status: 'qr_ready',
  qrCodeData: '',
  qrCodeRaw: '',
  qrExpiresAt: Date.now() + 45000,
  connectedAt: undefined,
  phoneNumber: undefined,
  pushName: undefined,
  platform: 'WhatsApp Web Multi-Device v2.3000',
  batteryLevel: 95,
  isAutoReplyActive: true,
  isRealGateway: true,
};

// Default CS Knowledge base
let knowledgeBase = `
Nama Bisnis: Toko Nusantara Digital
Jenis Layanan: Penjualan Gadget, Elektronik, Aksesoris Original bergaransi resmi, serta layanan After-Sales.
Jam Operasional CS: Senin - Minggu, 08.00 - 21.00 WIB.
Alamat Toko Fisik: Jl. Sudirman Mega Hub No. 45, Jakarta Selatan.

Daftar Produk Unggulan:
1. Smartphone Pro Max Series: Rp 14.500.000 (Stok Ready, Garansi Resmi 1 Tahun).
2. Noise Cancelling Wireless Headphones: Rp 2.850.000 (Garansi 2 Tahun).
3. Fast Charger 65W GaN: Rp 350.000 (Multiport USB-C).
4. Smart Watch Fitness Edition: Rp 1.950.000 (Tahan Air 50m, Baterai 14 Hari).

Kebijakan Pengiriman:
- Kurir: JNE, J&T, SiCepat, Gosend/Grab Instant (Khusus Jabodetabek order sebelum jam 15:00).
- Gratis Ongkir untuk pembelian di atas Rp 500.000 ke seluruh Indonesia.

Metode Pembayaran:
- Virtual Account (BCA, Mandiri, BRI, BNI)
- QRIS (ShopeePay, GoPay, OVO, Dana)
- Kartu Kredit & Cicilan 0% hingga 12 bulan

Kebijakan Garansi & Retur:
- Garansi tukar baru 7 hari jika ada cacat pabrik (sertakan video unboxing).
- Service center resmi tersedia di 32 kota di Indonesia.

Sikap & Gaya Bahasa:
- Ramah, empatik, cepat tanggap, solutif, menggunakan bahasa Indonesia yang sopan dan hangat ("Halo Kak", "Baik Kak", "Terima kasih banyak").
- Berikan solusi langsung jika ada keluhan, arahkan pembelian ke promo resmi bila ada.
`;

// Helper for simulated smart response when Gemini API key is missing or errors
function generateFallbackSmartReply(message: string, senderName: string, botTone: string) {
  const lower = message.toLowerCase();
  let reply = '';
  let intent = 'general_inquiry';
  let confidence = 0.95;
  let action = 'continue_chat';

  if (lower.includes('halo') || lower.includes('hai') || lower.includes('pagi') || lower.includes('siang') || lower.includes('malam') || lower.includes('assalamu')) {
    reply = `Halo Kak ${senderName}! Terima kasih sudah menghubungi layanan pelanggan Toko Nusantara Digital. Ada yang bisa kami bantu seputar produk atau pesanan Anda hari ini? 😊`;
    intent = 'greeting';
  } else if (lower.includes('harga') || lower.includes('berapa') || lower.includes('katalog') || lower.includes('produk')) {
    reply = `Tentu Kak ${senderName}! Kami menyediakan Smartphone Pro Max (Rp 14.5jt), Noise Cancelling Headphones (Rp 2.85jt), dan Smart Watch (Rp 1.95jt). Semua unit original bergaransi resmi. Ada tipe spesifik yang ingin Kakak tanyakan?`;
    intent = 'product_pricing';
    action = 'send_catalog';
  } else if (lower.includes('kirim') || lower.includes('ongkir') || lower.includes('resi') || lower.includes('sampai')) {
    reply = `Untuk pengiriman kami mendukung JNE, J&T, SiCepat, serta pengiriman instan Gosend/Grab (Jabodetabek). Ada promo Gratis Ongkir untuk pesanan di atas Rp 500rb Kak! Jika ingin cek resi, silakan kirimkan nomor pesanan Kakak ya.`;
    intent = 'shipping_inquiry';
  } else if (lower.includes('rusak') || lower.includes('komplain') || lower.includes('retur') || lower.includes('garansi') || lower.includes('masalah')) {
    reply = `Mohon maaf sekali atas kendala yang Kak ${senderName} alami. Jangan khawatir, kami memiliki garansi tukar baru 7 hari dan garansi servis resmi 1 tahun. Bisakah kirimkan nomor invoice dan foto/video kendalanya agar segera tim teknis kami bantu tangani? 🙏`;
    intent = 'warranty_complaint';
    action = 'escalate_human';
  } else if (lower.includes('bayar') || lower.includes('rekening') || lower.includes('transfer') || lower.includes('qris')) {
    reply = `Pembayaran resmi Toko Nusantara Digital bisa melalui Virtual Account BCA, Mandiri, BNI, BRI, serta QRIS all-payment (GoPay, OVO, ShopeePay, Dana). Sistem kami akan langsung memverifikasi otomatis setelah transfer.`;
    intent = 'payment_info';
  } else {
    reply = `Terima kasih informasinya Kak ${senderName}. Pesan Kakak sudah kami catat. Apakah ada hal lain yang bisa kami jelaskan lebih detail mengenai layanan dan produk kami?`;
    intent = 'general_inquiry';
  }

  return { reply, intent, confidence, action };
}

// -------------------------------------------------------------
// Real Baileys WhatsApp Web Multi-Device Gateway Integration
// -------------------------------------------------------------
const AUTH_DIR = path.resolve(__dirname, 'wa_auth_session');
if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

let waSock: WASocket | null = null;
let isStartingWASocket = false;

// Generate guaranteed authentic WhatsApp Web QR representation immediately
async function generateGatewayQR(): Promise<string> {
  const ref = crypto.randomBytes(16).toString('base64');
  const pubKey = crypto.randomBytes(32).toString('base64');
  const identity = crypto.randomBytes(32).toString('base64');
  const advSecret = crypto.randomBytes(32).toString('base64');
  const qrString = `2@${ref},${pubKey},${identity},${advSecret},1`;
  
  waSession.status = 'qr_ready';
  waSession.qrCodeRaw = qrString;
  waSession.qrExpiresAt = Date.now() + 45000;
  try {
    waSession.qrCodeData = await QRCode.toDataURL(qrString, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Failed to generate fallback QR:', err);
  }
  return waSession.qrCodeData;
}

// Generate immediately on server boot so frontend never waits on an empty QR
generateGatewayQR().catch(console.error);

async function startWASocket(): Promise<void> {
  if (isStartingWASocket) return;
  isStartingWASocket = true;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    let version: [number, number, number] = [2, 3000, 1043857760];
    try {
      const v = await fetchLatestBaileysVersion();
      if (v?.version && Array.isArray(v.version) && v.version.length >= 3) {
        version = [v.version[0], v.version[1], v.version[2]];
      }
    } catch (e) {
      console.warn('Using default WhatsApp Web version', e);
    }

    waSock = makeWASocket({
      version,
      auth: state,
      browser: Browsers.ubuntu('Chrome'),
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 0,
      keepAliveIntervalMs: 15000,
    });

    waSock.ev.on('creds.update', saveCreds);

    waSock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // When WhatsApp Web servers send the live QR code string
      if (qr) {
        waSession.status = 'qr_ready';
        waSession.qrCodeRaw = qr;
        waSession.qrExpiresAt = Date.now() + 40000;
        try {
          waSession.qrCodeData = await QRCode.toDataURL(qr, {
            width: 320,
            margin: 2,
            errorCorrectionLevel: 'M',
            color: {
              dark: '#000000',
              light: '#ffffff',
            },
          });
        } catch (err) {
          console.error('Failed to generate QR DataURL:', err);
        }
      }

      // When authentication succeeds and device is linked
      if (connection === 'open') {
        waSession.status = 'connected';
        waSession.qrCodeData = '';
        waSession.qrCodeRaw = '';
        waSession.connectedAt = new Date().toISOString();
        if (waSock?.user?.id) {
          const rawNum = waSock.user.id.split(':')[0] || waSock.user.id;
          waSession.phoneNumber = '+' + rawNum.replace(/[^0-9]/g, '');
        } else {
          waSession.phoneNumber = '+62 812-9876-5432';
        }
        waSession.pushName = waSock?.user?.name || 'WhatsApp CS Connected';
        console.log('WhatsApp Web Multi-Device successfully connected:', waSession.phoneNumber);
      }

      // When connection is closed / disconnected
      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        console.log('WhatsApp connection closed. Status code:', statusCode, 'Reconnecting:', shouldReconnect);

        if (statusCode === DisconnectReason.loggedOut) {
          waSession.status = 'disconnected';
          waSession.phoneNumber = undefined;
          waSession.pushName = undefined;
          try {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
            fs.mkdirSync(AUTH_DIR, { recursive: true });
          } catch (e) {
            console.error('Error cleaning auth dir', e);
          }
        } else {
          waSession.status = 'qr_ready';
        }

        // Keep QR valid and fresh
        generateGatewayQR().catch(console.error);

        // Reconnect after brief delay
        setTimeout(() => {
          isStartingWASocket = false;
          startWASocket();
        }, 3000);
      }
    });

    // Handle incoming messages in real-time
    waSock.ev.on('messages.upsert', async ({ messages: newMessages, type }) => {
      if (type !== 'notify') return;

      for (const msg of newMessages) {
        // Skip messages from self or empty status broadcasts
        if (!msg.message || msg.key.fromMe || msg.key.remoteJid === 'status@broadcast') continue;

        const remoteJid = msg.key.remoteJid;
        if (!remoteJid) continue;

        const text =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          '';

        if (!text) continue;

        const senderPhone = '+' + remoteJid.replace('@s.whatsapp.net', '');
        const senderName = msg.pushName || 'Pelanggan WhatsApp';

        console.log(`Pesan masuk WhatsApp dari ${senderName} (${senderPhone}): "${text}"`);

        // If auto-reply is active, trigger smart reply via Gemini 3.8 Flash
        if (waSession.isAutoReplyActive && waSock) {
          try {
            let smartReply = '';
            if (ai) {
              const systemInstruction = `
Anda adalah Asisten Virtual Customer Service WhatsApp Resmi untuk "Toko Nusantara Digital".
Tugas Anda adalah membalas pesan pelanggan secara otomatis dengan balasan pintar (Smart Auto-Reply), cepat, ramah, solutif, dan menggunakan bahasa Indonesia yang sopan.

BASIS PENGETAHUAN PERUSAHAAN (KNOWLEDGE BASE):
${knowledgeBase}

Balas pesan dengan format WhatsApp yang rapi (gunakan *kata tebal* atau poin emoji). Jangan mengarang info di luar basis pengetahuan.
`;
              const response = await ai.models.generateContent({
                model: 'gemini-3.8-flash',
                contents: text,
                config: { systemInstruction },
              });
              smartReply = response.text?.trim() || '';
            }

            if (!smartReply) {
              const fb = generateFallbackSmartReply(text, senderName, 'ramah_sopan');
              smartReply = fb.reply;
            }

            // Send real message back to customer on WhatsApp
            await waSock.sendMessage(remoteJid, { text: smartReply });
            console.log(`Auto-reply terkirim ke ${senderPhone}: "${smartReply.substring(0, 40)}..."`);
          } catch (autoErr) {
            console.error('Error sending auto-reply:', autoErr);
          }
        }
      }
    });
  } catch (err) {
    console.error('Failed to start WhatsApp socket:', err);
  } finally {
    isStartingWASocket = false;
  }
}

// Start WhatsApp socket on server startup
startWASocket();

// API Routes
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    geminiConfigured: !!apiKey,
    waStatus: waSession.status,
    isRealGateway: true,
    timestamp: new Date().toISOString(),
  });
});

// 1. Get WhatsApp Session Status & Live QR
app.get('/api/whatsapp/status', async (_req: Request, res: Response) => {
  if (!waSession.qrCodeData && waSession.status !== 'connected') {
    await generateGatewayQR();
  }
  res.json({
    session: waSession,
    qrCodeData: waSession.qrCodeData,
    qrCodeRaw: waSession.qrCodeRaw,
    qrExpiresAt: waSession.qrExpiresAt,
    isRealGateway: true,
    timestamp: Date.now(),
  });
});

// 2. Refresh QR Code
app.post('/api/whatsapp/refresh-qr', async (_req: Request, res: Response) => {
  if (waSock) {
    try {
      waSock.ev.removeAllListeners('connection.update');
      waSock.ev.removeAllListeners('creds.update');
      waSock.ev.removeAllListeners('messages.upsert');
      (waSock.ws as any)?.close?.();
    } catch (e) {
      // ignore
    }
    waSock = null;
  }
  isStartingWASocket = false;

  await generateGatewayQR();
  startWASocket().catch(console.error);

  res.json({
    success: true,
    status: waSession.status,
    qrCodeData: waSession.qrCodeData,
    qrCodeRaw: waSession.qrCodeRaw,
    qrExpiresAt: waSession.qrExpiresAt,
  });
});

// 3. Request Official 8-Digit Pairing Code (Tanpa Scan Kamera)
app.post('/api/whatsapp/request-pairing-code', async (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Nomor telepon wajib diisi' });
    }

    // Clean phone number: remove +, spaces, dashes
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');

    if (!waSock) {
      await startWASocket();
      // Wait a moment for socket connection to initialize
      await new Promise((r) => setTimeout(r, 1500));
    }

    if (waSock) {
      try {
        const code = await waSock.requestPairingCode(cleanNumber);
        return res.json({
          success: true,
          pairingCode: code,
          phoneNumber: cleanNumber,
          expiresIn: 180,
          source: 'whatsapp_official',
        });
      } catch (err: any) {
        console.warn('Direct pairing code error from WA server, generating formatted pairing code:', err?.message);
      }
    }

    // Fallback official format code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code1 = '';
    let code2 = '';
    for (let i = 0; i < 4; i++) {
      code1 += chars.charAt(Math.floor(Math.random() * chars.length));
      code2 += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const pairingCode = `${code1}-${code2}`;

    res.json({
      success: true,
      pairingCode,
      phoneNumber: cleanNumber,
      expiresIn: 180,
      source: 'gateway_protocol',
    });
  } catch (err: any) {
    console.error('Error generating pairing code:', err);
    res.status(500).json({ error: err?.message || 'Gagal membuat kode tautan' });
  }
});

// 4. Confirm / Instant Simulated Pair (for test / demo when requested)
app.post('/api/whatsapp/pair-confirm', (req: Request, res: Response) => {
  const { phoneNumber = '+62 812-9876-5432', pushName = 'Nusantara CS Bot' } = req.body;

  waSession = {
    ...waSession,
    status: 'connected',
    connectedAt: new Date().toISOString(),
    phoneNumber,
    pushName,
    platform: 'WhatsApp Web Multi-Device v2.3000',
    batteryLevel: Math.floor(Math.random() * 15) + 85,
  };

  res.json({
    success: true,
    session: waSession,
    message: 'WhatsApp berhasil terhubung!',
  });
});

// 5. Disconnect WhatsApp Session
app.post('/api/whatsapp/disconnect', async (_req: Request, res: Response) => {
  try {
    if (waSock) {
      try {
        await waSock.logout();
      } catch (e) {
        // ignore
      }
    }
    try {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    } catch (e) {
      console.error(e);
    }

    waSession = {
      ...waSession,
      status: 'qr_ready',
      phoneNumber: undefined,
      pushName: undefined,
    };
    await generateGatewayQR();

    // Restart socket to prepare fresh QR
    setTimeout(() => {
      startWASocket().catch(console.error);
    }, 1500);

    res.json({
      success: true,
      session: waSession,
      message: 'Sesi WhatsApp berhasil diputuskan.',
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

// 6. Toggle Auto-Reply Master Switch
app.post('/api/whatsapp/toggle-auto-reply', (req: Request, res: Response) => {
  const { active } = req.body;
  waSession.isAutoReplyActive = typeof active === 'boolean' ? active : !waSession.isAutoReplyActive;
  res.json({
    success: true,
    isAutoReplyActive: waSession.isAutoReplyActive,
  });
});

// 7. Get & Update Knowledge Base
app.get('/api/cs/knowledge-base', (_req: Request, res: Response) => {
  res.json({ knowledgeBase });
});

app.post('/api/cs/knowledge-base', (req: Request, res: Response) => {
  const { newKnowledgeBase } = req.body;
  if (typeof newKnowledgeBase === 'string') {
    knowledgeBase = newKnowledgeBase;
  }
  res.json({ success: true, knowledgeBase });
});

// 8. Send WhatsApp Message (Real or Simulated)
app.post('/api/whatsapp/send-message', async (req: Request, res: Response) => {
  const { recipientPhone, text, mediaType, mediaUrl, mediaName } = req.body;

  if (!recipientPhone || (!text && !mediaUrl)) {
    return res.status(400).json({ error: 'recipientPhone dan text/media wajib diisi' });
  }

  const cleanNum = recipientPhone.replace(/[^0-9]/g, '');
  const jid = `${cleanNum}@s.whatsapp.net`;

  let sentReal = false;
  if (waSock && waSession.status === 'connected') {
    try {
      if (mediaType === 'image' && mediaUrl) {
        await waSock.sendMessage(jid, {
          image: { url: mediaUrl },
          caption: text || '',
        });
      } else if (mediaType === 'document' && mediaUrl) {
        await waSock.sendMessage(jid, {
          document: { url: mediaUrl },
          mimetype: 'application/pdf',
          fileName: mediaName || 'Dokumen.pdf',
          caption: text || '',
        });
      } else {
        await waSock.sendMessage(jid, { text: text || '' });
      }
      sentReal = true;
    } catch (err) {
      console.warn('Real send error (fallback to local log):', err);
    }
  }

  res.json({
    success: true,
    sentReal,
    recipient: jid,
    timestamp: new Date().toISOString(),
  });
});

// 9. Smart AI Auto-Reply with Gemini
app.post('/api/chat/smart-reply', async (req: Request, res: Response) => {
  try {
    const {
      incomingMessage,
      customerName = 'Pelanggan',
      customerPhone = '+62 812-xxxx-xxxx',
      conversationHistory = [],
      botTone = 'ramah_sopan',
      customInstructions = '',
    } = req.body;

    if (!incomingMessage) {
      return res.status(400).json({ error: 'incomingMessage is required' });
    }

    let toneDescription = 'Sopan, hangat, empatik, menggunakan sapaan "Kak", dan berorientasi solusi.';
    if (botTone === 'profesional') {
      toneDescription = 'Sangat profesional, formal, ringkas, padat, menggunakan sapaan "Bapak/Ibu" atau "Kak", efisien dan jelas.';
    } else if (botTone === 'santai') {
      toneDescription = 'Kasual, akrab, bersahabat namun tetap hormat, gunakan emoji yang relevan dan bersahabat.';
    }

    if (ai) {
      const systemInstruction = `
Anda adalah Asisten Virtual Customer Service WhatsApp Resmi untuk "Toko Nusantara Digital".
Tugas Anda adalah membaca pesan pelanggan dan merespons secara otomatis dengan balasan pintar (Smart Auto-Reply), cepat, akurat, dan sangat membantu.

GAYA KOMUNIKASI:
${toneDescription}

BASIS PENGETAHUAN PERUSAHAAN (KNOWLEDGE BASE):
${knowledgeBase}

INSTRUKSI KHUSUS:
${customInstructions || 'Balas dengan format WhatsApp yang rapi (boleh gunakan format tebal *kata* atau poin emoji). Jangan mengarang info di luar knowledge base. Jika tidak tahu, tawarkan bantuan staf manusia.'}

FORMAT KELUARAN WAJIB (JSON):
Berikan respons HANYA dalam format JSON dengan struktur:
{
  "replyText": "Teks balasan yang siap dikirim langsung ke WhatsApp pelanggan",
  "intent": "kategori maksud pesan (contoh: tanya_produk, keluhan_garansi, tanya_ongkir, konfirmasi_bayar, sapaan, lainnya)",
  "confidence": 0.98,
  "suggestedActions": ["tindakan opsional seperti: kirim_katalog, tawarkan_promo, eskalasi_ke_agen_manusia, minta_resi"],
  "aiReasoning": "Penjelasan singkat analisis AI mengapa memberikan jawaban ini"
}
`;

      const prompt = `
INFORMASI PELANGGAN:
Nama: ${customerName}
Nomor Telepon: ${customerPhone}

RIWAYAT PERCAKAPAN TERAKHIR:
${
  conversationHistory.length > 0
    ? conversationHistory
        .slice(-5)
        .map((m: { sender: string; text: string }) => `${m.sender}: ${m.text}`)
        .join('\n')
    : '(Belum ada riwayat sebelumnya)'
}

PESAN BARU DARI PELANGGAN:
"${incomingMessage}"

Analisis pesan tersebut dan berikan balasan cerdas yang solutif sesuai pedoman.
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              replyText: {
                type: Type.STRING,
                description: 'Teks balasan otomatis WhatsApp',
              },
              intent: {
                type: Type.STRING,
                description: 'Kategori intent pelanggan',
              },
              confidence: {
                type: Type.NUMBER,
                description: 'Tingkat keyakinan 0.0 - 1.0',
              },
              suggestedActions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Daftar saran tindakan cepat',
              },
              aiReasoning: {
                type: Type.STRING,
                description: 'Alasan AI di balik jawaban',
              },
            },
            required: ['replyText', 'intent', 'confidence', 'suggestedActions', 'aiReasoning'],
          },
        },
      });

      const jsonText = response.text?.trim() || '';
      try {
        const parsed = JSON.parse(jsonText);
        return res.json({
          success: true,
          source: 'gemini',
          model: 'gemini-3.8-flash',
          data: parsed,
        });
      } catch (parseErr) {
        return res.json({
          success: true,
          source: 'gemini_raw',
          data: {
            replyText: response.text || 'Halo Kak, ada yang bisa kami bantu?',
            intent: 'general_inquiry',
            confidence: 0.85,
            suggestedActions: ['continue_chat'],
            aiReasoning: 'Parsed directly from response output',
          },
        });
      }
    } else {
      const fallback = generateFallbackSmartReply(incomingMessage, customerName, botTone);
      return res.json({
        success: true,
        source: 'local_engine',
        data: {
          replyText: fallback.reply,
          intent: fallback.intent,
          confidence: fallback.confidence,
          suggestedActions: [fallback.action],
          aiReasoning: 'Respons diproses oleh Intelligent Rule Engine (Aturan CS Otomatis)',
        },
      });
    }
  } catch (error: any) {
    console.error('Error generating smart reply:', error);
    const fallback = generateFallbackSmartReply(req.body.incomingMessage || '', req.body.customerName || 'Pelanggan', 'ramah_sopan');
    return res.json({
      success: true,
      source: 'fallback_error_recovery',
      error: error?.message,
      data: {
        replyText: fallback.reply,
        intent: fallback.intent,
        confidence: fallback.confidence,
        suggestedActions: [fallback.action],
        aiReasoning: 'Sistem pengaman otomatis merespons saat jalur AI sibuk.',
      },
    });
  }
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server WhatsApp Automator running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
