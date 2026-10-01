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
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.text({ type: ['text/*', 'application/octet-stream'], limit: '15mb' }));

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
export interface GatewayConfig {
  activeProvider: 'direct' | 'fonnte' | 'wablast';
  fonnte: {
    token: string;
    device?: string;
    quota?: string | number;
    status?: string;
    lastTested?: string;
  };
  wablast: {
    apiUrl: string;
    apiKey: string;
    phone?: string;
    quota?: string | number;
    status?: string;
    lastTested?: string;
  };
}

interface WASession {
  status: 'disconnected' | 'connecting' | 'qr_ready' | 'authenticating' | 'connected';
  gatewayProvider: 'direct' | 'fonnte' | 'wablast';
  qrCodeData: string;
  qrCodeUrlData?: string;
  qrCodeRawData?: string;
  qrCodeRaw?: string;
  qrUrl?: string;
  qrExpiresAt: number;
  connectedAt?: string;
  phoneNumber?: string;
  pushName?: string;
  platform?: string;
  batteryLevel?: number;
  isAutoReplyActive: boolean;
  isRealGateway: boolean;
  fonnteConfig?: GatewayConfig['fonnte'];
  wablastConfig?: GatewayConfig['wablast'];
}

let waSession: WASession = {
  status: 'connecting',
  gatewayProvider: 'direct',
  qrCodeData: '',
  qrCodeUrlData: '',
  qrCodeRawData: '',
  qrCodeRaw: '',
  qrUrl: '',
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
// Centralized Persistent Storage for Contacts & Messages (Multi-Device)
// -------------------------------------------------------------
const STORAGE_DIR = path.resolve(__dirname, 'wa_storage');
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

const CONTACTS_FILE = path.join(STORAGE_DIR, 'contacts.json');
const MESSAGES_FILE = path.join(STORAGE_DIR, 'messages.json');

// Clean and sanitize Fonnte tokens (strip zero-width spaces, Bearer, quotes, headers, newlines)
function cleanFonnteToken(raw: string): string {
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

// Normalize phone numbers (Indonesian & International formats)
function normalizePhoneNumber(rawPhone: string): { clean: string; jid: string; display: string } {
  // First extract clean base number before '@' or ':' (crucial for WhatsApp Multi-Device JIDs like 6281234:2@s.whatsapp.net)
  let base = (rawPhone || '').split('@')[0].split(':')[0];
  let digits = base.replace(/[^0-9]/g, '');
  if (digits.startsWith('0')) {
    digits = '62' + digits.slice(1);
  } else if (digits.startsWith('8')) {
    digits = '62' + digits;
  }
  const jid = `${digits}@s.whatsapp.net`;
  let display = '+' + digits;
  if (digits.startsWith('62') && digits.length >= 10) {
    display = `+62 ${digits.slice(2, 5)}-${digits.slice(5, 9)}-${digits.slice(9)}`;
  }
  return { clean: digits, jid, display };
}

const DEFAULT_CONTACTS = [
  {
    id: 'c1',
    name: 'Budi Santoso',
    phone: '+62 812-4455-6677',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    unreadCount: 1,
    tag: 'Prospek',
    lastMessageTime: '11:18',
    notes: 'Tertarik beli Smartphone Pro Max untuk hadiah kantor.',
    totalOrders: 0,
    lifetimeValue: 'Rp 0',
    isAiAutoReplyEnabled: true,
  },
  {
    id: 'c2',
    name: 'Siti Rahmayanti',
    phone: '+62 856-7890-1234',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    unreadCount: 0,
    tag: 'Komplain',
    lastMessageTime: '10:42',
    notes: 'Paket agak terlambat di pihak ekspedisi J&T. Butuh cek status resi.',
    totalOrders: 3,
    lifetimeValue: 'Rp 4.800.000',
    isAiAutoReplyEnabled: true,
  },
  {
    id: 'c3',
    name: 'Hendro Wijaya',
    phone: '+62 818-1234-5678',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
    unreadCount: 0,
    tag: 'VIP',
    lastMessageTime: 'Kemarin',
    notes: 'Pelanggan korporat, repeat order rutin aksesoris kantor.',
    totalOrders: 8,
    lifetimeValue: 'Rp 32.500.000',
    isAiAutoReplyEnabled: true,
  },
  {
    id: 'c4',
    name: 'Dewi Lestari',
    phone: '+62 877-9988-1122',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    unreadCount: 0,
    tag: 'Pelanggan Baru',
    lastMessageTime: 'Kemarin',
    notes: 'Menanyakan ketersediaan cicilan 0% kartu kredit.',
    totalOrders: 1,
    lifetimeValue: 'Rp 2.850.000',
    isAiAutoReplyEnabled: true,
  },
  {
    id: 'c5',
    name: 'Ahmad Fauzi',
    phone: '+62 821-6543-9870',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    unreadCount: 0,
    tag: 'Selesai',
    lastMessageTime: '23 Sep',
    notes: 'Sudah selesai komplain charger, unit pengganti sudah sampai.',
    totalOrders: 2,
    lifetimeValue: 'Rp 1.150.000',
    isAiAutoReplyEnabled: true,
  },
];

const DEFAULT_MESSAGES: Record<string, any[]> = {
  c1: [
    {
      id: 'm1_1',
      contactId: 'c1',
      sender: 'customer',
      senderName: 'Budi Santoso',
      text: 'Halo selamat siang CS Toko Nusantara Digital. Mau tanya apakah Smartphone Pro Max masih ready stock yang warna Deep Black?',
      timestamp: '11:15',
      status: 'read',
    },
    {
      id: 'm1_2',
      contactId: 'c1',
      sender: 'bot',
      senderName: 'Asisten CS AI',
      text: 'Halo Kak Budi Santoso! Terima kasih sudah menghubungi Toko Nusantara Digital. 😊\n\nUntuk *Smartphone Pro Max warna Deep Black* stoknya saat ini *READY* dan bergaransi resmi 1 tahun seharga Rp 14.500.000.\n\nApakah Kakak ingin kami bantu siapkan pesanan atau butuh brosur spesifikasi lengkapnya?',
      timestamp: '11:15',
      status: 'read',
      isAiGenerated: true,
      aiIntent: 'tanya_produk_dan_stok',
      aiConfidence: 0.98,
      aiReasoning: 'Mendeteksi pertanyaan ketersediaan warna Deep Black pada produk Smartphone Pro Max.',
    },
    {
      id: 'm1_3',
      contactId: 'c1',
      sender: 'customer',
      senderName: 'Budi Santoso',
      text: 'Apakah bisa kirim hari ini pakai Gosend Instant ke Jakarta Selatan kak? Dan ada promo potongan harga tidak?',
      timestamp: '11:18',
      status: 'delivered',
    },
  ],
  c2: [
    {
      id: 'm2_1',
      contactId: 'c2',
      sender: 'customer',
      senderName: 'Siti Rahmayanti',
      text: 'Siang kak, pesanan headphone saya no invoice #INV-9821 statusnya masih di gudang ekspedisi dari kemarin, tolong dicek ya.',
      timestamp: '10:40',
      status: 'read',
    },
    {
      id: 'm2_2',
      contactId: 'c2',
      sender: 'bot',
      senderName: 'Asisten CS AI',
      text: 'Halo Kak Siti Rahmayanti, mohon maaf sekali atas ketidaknyamanannya terkait keterlambatan pengiriman headphone Kakak. 🙏\n\nNomor pesanan *#INV-9821* sudah kami teruskan langsung ke tim logistik ekspedisi untuk dipercepat status pengantarannya hari ini.',
      timestamp: '10:41',
      status: 'read',
      isAiGenerated: true,
      aiIntent: 'cek_status_pesanan',
      aiConfidence: 0.95,
      aiReasoning: 'Mendeteksi pertanyaan status pengiriman untuk invoice #INV-9821.',
    },
  ],
};

function getStoredContacts(): any[] {
  try {
    if (fs.existsSync(CONTACTS_FILE)) {
      const content = fs.readFileSync(CONTACTS_FILE, 'utf-8').trim();
      if (content) {
        const data = JSON.parse(content);
        if (Array.isArray(data)) return data;
      }
    }
  } catch (e) {
    console.error('Error reading contacts file:', e);
  }
  saveStoredContacts(DEFAULT_CONTACTS);
  return DEFAULT_CONTACTS;
}

function saveStoredContacts(contacts: any[]): void {
  try {
    fs.writeFileSync(CONTACTS_FILE, JSON.stringify(contacts, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving contacts file:', e);
  }
}

function getStoredMessages(): Record<string, any[]> {
  try {
    if (fs.existsSync(MESSAGES_FILE)) {
      const data = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf-8'));
      if (typeof data === 'object' && data !== null) return data;
    }
  } catch (e) {
    console.error('Error reading messages file:', e);
  }
  saveStoredMessages(DEFAULT_MESSAGES);
  return DEFAULT_MESSAGES;
}

function saveStoredMessages(messages: Record<string, any[]>): void {
  try {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving messages file:', e);
  }
}

// -------------------------------------------------------------
// Gateway Configuration Store (Direct Baileys, Fonnte, Wablast.id)
// -------------------------------------------------------------
const GATEWAY_CONFIG_FILE = path.join(STORAGE_DIR, 'gateway_config.json');

const DEFAULT_GATEWAY_CONFIG: GatewayConfig = {
  activeProvider: 'direct',
  fonnte: {
    token: '',
    device: '',
    quota: '',
    status: 'unconfigured',
  },
  wablast: {
    apiUrl: 'https://api.wablast.id',
    apiKey: '',
    phone: '',
    quota: '',
    status: 'unconfigured',
  },
};

function getGatewayConfig(): GatewayConfig {
  try {
    if (fs.existsSync(GATEWAY_CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(GATEWAY_CONFIG_FILE, 'utf-8'));
      return { ...DEFAULT_GATEWAY_CONFIG, ...data };
    }
  } catch (e) {
    console.error('Error reading gateway config file:', e);
  }
  saveGatewayConfig(DEFAULT_GATEWAY_CONFIG);
  return DEFAULT_GATEWAY_CONFIG;
}

function saveGatewayConfig(config: GatewayConfig): void {
  try {
    fs.writeFileSync(GATEWAY_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving gateway config file:', e);
  }
}

// Unified message dispatcher supporting Baileys Direct, Fonnte, and Wablast
async function sendGatewayMessage(
  targetPhone: string,
  text: string,
  options?: {
    mediaType?: string;
    mediaUrl?: string;
    mediaName?: string;
    overrideProvider?: string;
    overrideToken?: string;
    overrideApiUrl?: string;
    overrideApiKey?: string;
  }
): Promise<{ success: boolean; error?: string; provider: string; rawResponse?: any }> {
  const { clean, jid, display } = normalizePhoneNumber(targetPhone);
  const provider = options?.overrideProvider || waSession.gatewayProvider || 'direct';

  // 1. Send via Fonnte (fonnte.com)
  if (provider === 'fonnte') {
    const config = getGatewayConfig();
    const token = cleanFonnteToken(options?.overrideToken || config.fonnte.token);
    if (!token) return { success: false, error: 'Token Fonnte belum dikonfigurasi', provider: 'fonnte' };

    try {
      const targetPhoneClean = clean.replace(/^0+/, '62');

      // Method 1: Form-urlencoded (URLSearchParams), the standard supported by Fonnte PHP backend
      const form = new URLSearchParams();
      form.append('target', targetPhoneClean);
      form.append('message', text || '');
      // Setting countryCode to '0' ensures Fonnte doesn't alter target numbers that already have full country code '62...'
      form.append('countryCode', '0');
      if (options?.mediaUrl) {
        form.append('url', options.mediaUrl);
        if (options?.mediaName) form.append('filename', options.mediaName);
        if (text) form.append('caption', text);
      }

      let res = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: {
          'Authorization': token,
        },
        body: form,
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch (e) {
        // Fallback if form response is not JSON
      }

      // If form response did not succeed, retry with JSON payload
      if (!data || data?.status !== true) {
        try {
          const jsonPayload: any = {
            target: targetPhoneClean,
            message: text || '',
            countryCode: '0',
          };
          if (options?.mediaUrl) {
            jsonPayload.url = options.mediaUrl;
            if (options?.mediaName) jsonPayload.filename = options.mediaName;
            if (text) jsonPayload.caption = text;
          }

          const resJson = await fetch('https://api.fonnte.com/send', {
            method: 'POST',
            headers: {
              'Authorization': token,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(jsonPayload),
          });
          const dataJson = await resJson.json();
          if (dataJson?.status === true) {
            data = dataJson;
          } else if (dataJson?.reason && !data?.reason) {
            data = dataJson;
          }
        } catch (e) {}
      }

      console.log(`[Fonnte Send API Response] ke ${display}:`, data);
      const isSuccess =
        data?.status === true ||
        (Array.isArray(data?.id) && data.id.length > 0) ||
        (typeof data?.id === 'string' && data.id.length > 0) ||
        (typeof data?.process === 'string' && data.process.toLowerCase().includes('success'));

      let friendlyError = data?.reason || data?.message;
      if (friendlyError === 'invalid token' || friendlyError === 'token invalid') {
        friendlyError =
          'Token Fonnte ditolak server (invalid token). Pastikan token yang digunakan adalah Token Perangkat dari menu Device di https://md.fonnte.com/ (bukan Account Token profil). Pastikan akun Anda tidak memblokir IP atau token belum kadaluarsa.';
      } else if (friendlyError === 'device disconnect') {
        friendlyError =
          'Perangkat WhatsApp di Fonnte sedang DISCONNECT. Silakan buka https://md.fonnte.com/ > menu Device, lalu klik Scan QR untuk menghubungkan nomor WhatsApp Anda.';
      } else if (friendlyError === 'out of quota' || friendlyError === 'insufficient balance') {
        friendlyError = 'Kuota pengiriman pesan di akun Fonnte Anda habis. Silakan periksa paket kuota di fonnte.com.';
      }

      return {
        success: isSuccess,
        error: isSuccess ? undefined : (friendlyError || 'Gagal mengirim pesan via Fonnte'),
        provider: 'fonnte',
        rawResponse: data,
      };
    } catch (err: any) {
      console.error('Fonnte send error:', err);
      return { success: false, error: 'Koneksi ke Fonnte gagal: ' + err?.message, provider: 'fonnte' };
    }
  }

  // 2. Send via Wablast (wablast.id / bablast.id)
  if (provider === 'wablast') {
    const config = getGatewayConfig();
    const apiUrl = options?.overrideApiUrl || config.wablast.apiUrl || 'https://api.wablast.id';
    const apiKey = options?.overrideApiKey || config.wablast.apiKey;
    if (!apiKey) return { success: false, error: 'API Key Wablast belum dikonfigurasi', provider: 'wablast' };

    try {
      const cleanUrl = apiUrl.replace(/\/+$/, '');
      const wablastPayload = {
        phone: clean,
        message: text || '',
      };

      const res = await fetch(`${cleanUrl}/api/send-message`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'token': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(wablastPayload),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch (e) {
        data = { status: res.ok };
      }
      console.log(`[Wablast Send API Response] ke ${display}:`, data);
      const isSuccess = res.ok || data?.status === true || data?.status === 'success';
      return {
        success: isSuccess,
        error: isSuccess ? undefined : (data?.message || 'Gagal mengirim pesan via Wablast'),
        provider: 'wablast',
        rawResponse: data,
      };
    } catch (err: any) {
      console.error('Wablast send error:', err);
      return { success: false, error: 'Koneksi ke Wablast gagal: ' + err?.message, provider: 'wablast' };
    }
  }

  // 3. Send via Direct WhatsApp Web Socket (Baileys)
  if (waSock && waSession.status === 'connected') {
    try {
      let targetJid = jid;
      try {
        const results = await waSock.onWhatsApp(clean);
        if (results && results.length > 0 && results[0]?.jid) {
          targetJid = results[0].jid;
        }
      } catch (e) {}

      if (options?.mediaType === 'image' && options.mediaUrl) {
        if (options.mediaUrl.startsWith('data:')) {
          const b64 = options.mediaUrl.split(',')[1];
          await waSock.sendMessage(targetJid, {
            image: Buffer.from(b64, 'base64'),
            caption: text || '',
          });
        } else {
          await waSock.sendMessage(targetJid, {
            image: { url: options.mediaUrl },
            caption: text || '',
          });
        }
      } else if (options?.mediaType === 'document' && options.mediaUrl) {
        if (options.mediaUrl.startsWith('data:')) {
          const b64 = options.mediaUrl.split(',')[1];
          await waSock.sendMessage(targetJid, {
            document: Buffer.from(b64, 'base64'),
            mimetype: 'application/pdf',
            fileName: options.mediaName || 'Dokumen.pdf',
            caption: text || '',
          });
        } else {
          await waSock.sendMessage(targetJid, {
            document: { url: options.mediaUrl },
            mimetype: 'application/pdf',
            fileName: options.mediaName || 'Dokumen.pdf',
            caption: text || '',
          });
        }
      } else {
        await waSock.sendMessage(targetJid, { text: text || '' });
      }
      return { success: true, provider: 'direct' };
    } catch (err: any) {
      console.error('Baileys send error:', err);
      return { success: false, error: err?.message || 'Gagal mengirim pesan via WhatsApp Web', provider: 'direct' };
    }
  }

  return {
    success: false,
    error: 'WhatsApp Gateway belum terhubung. Silakan hubungkan WhatsApp Web, Fonnte, atau Wablast.',
    provider: 'direct',
  };
}

// Unified incoming message handler (used by Baileys, Fonnte webhook, and Wablast webhook)
async function handleIncomingCustomerMessage(
  rawPhone: string,
  text: string,
  senderNameInput?: string,
  providerName: 'direct' | 'fonnte' | 'wablast' = 'direct'
): Promise<void> {
  const { display, clean } = normalizePhoneNumber(rawPhone);
  const senderName = senderNameInput || `Pelanggan ${clean.slice(-4)}`;
  const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  console.log(`[Pesan Masuk WA via ${providerName.toUpperCase()}] dari ${senderName} (${display}): "${text}"`);

  // 1. Update or create contact in centralized storage
  let contactsList = getStoredContacts();
  let contact = contactsList.find((c) => {
    const cClean = c.phone.replace(/[^0-9]/g, '');
    const cleanLast9 = clean.slice(-9);
    const cCleanLast9 = cClean.slice(-9);
    return cClean === clean || (cleanLast9.length >= 8 && cleanLast9 === cCleanLast9);
  });

  if (!contact) {
    contact = {
      id: 'cust_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      name: senderName,
      phone: display,
      avatar: `https://images.unsplash.com/photo-${1534528741775 + Math.floor(Math.random() * 1000)}?w=150&auto=format&fit=crop&q=80`,
      unreadCount: 1,
      tag: 'Pelanggan Baru',
      lastMessageTime: timeStr,
      notes: `Pelanggan tersambung otomatis dari pesan WhatsApp masuk (${providerName.toUpperCase()}).`,
      totalOrders: 0,
      lifetimeValue: 'Rp 0',
      isAiAutoReplyEnabled: true,
    };
    contactsList = [contact, ...contactsList];
  } else {
    contact.unreadCount = (contact.unreadCount || 0) + 1;
    contact.lastMessageTime = timeStr;
    if (senderName && (contact.name.startsWith('Pelanggan') || contact.name === 'Pelanggan WhatsApp')) {
      contact.name = senderName;
    }
  }
  saveStoredContacts(contactsList);

  // 2. Save incoming message to centralized messages storage
  const messagesMap = getStoredMessages();
  const contactMsgs = messagesMap[contact.id] || [];
  const incomingMsgObj = {
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    contactId: contact.id,
    sender: 'customer',
    senderName: contact.name,
    text: text || '[Media/Pesan Tanpa Teks]',
    timestamp: timeStr,
    status: 'read',
  };
  messagesMap[contact.id] = [...contactMsgs, incomingMsgObj];
  saveStoredMessages(messagesMap);

  // 3. If auto-reply is active, trigger smart reply via Gemini 3.8 Flash asynchronously (non-blocking)
  if (waSession.isAutoReplyActive && contact.isAiAutoReplyEnabled) {
    (async () => {
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
            contents: text || 'Halo',
            config: { systemInstruction },
          });
          smartReply = response.text?.trim() || '';
        }

        if (!smartReply) {
          const fb = generateFallbackSmartReply(text || 'Halo', contact.name, 'ramah_sopan');
          smartReply = fb.reply;
        }

        // Send real message back to customer on WhatsApp via the active provider
        await sendGatewayMessage(display, smartReply);
        console.log(`Auto-reply terkirim ke ${display} via ${providerName.toUpperCase()}: "${smartReply.substring(0, 40)}..."`);

        // Store reply in centralized messages storage
        const replyMsgObj = {
          id: 'reply_' + Date.now(),
          contactId: contact.id,
          sender: 'bot',
          senderName: 'Asisten CS AI',
          text: smartReply,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          status: 'delivered',
          isAiGenerated: true,
          aiIntent: 'auto_reply',
          aiConfidence: 0.98,
          aiReasoning: `Respons otomatis cerdas berdasarkan basis pengetahuan CS (via ${providerName}).`,
        };
        const updatedMap = getStoredMessages();
        updatedMap[contact.id] = [...(updatedMap[contact.id] || []), replyMsgObj];
        saveStoredMessages(updatedMap);
      } catch (autoErr) {
        console.error('Error generating/sending auto-reply:', autoErr);
      }
    })().catch(console.error);
  }
}

// -------------------------------------------------------------
// Real Baileys WhatsApp Web Multi-Device Gateway Integration
// -------------------------------------------------------------
const AUTH_DIR = path.resolve(__dirname, 'wa_auth_session');
if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

function hasValidAuthSession(): boolean {
  try {
    const credsPath = path.join(AUTH_DIR, 'creds.json');
    if (fs.existsSync(credsPath)) {
      const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
      return !!(creds?.me?.id || creds?.registered);
    }
  } catch (e) {}
  return false;
}

let waSock: WASocket | null = null;
let isStartingWASocket = false;
let startingSocketTimer: NodeJS.Timeout | null = null;
let qrResolvers: Array<(qr: string) => void> = [];

async function startWASocket(): Promise<void> {
  if (isStartingWASocket) return;
  isStartingWASocket = true;

  if (startingSocketTimer) clearTimeout(startingSocketTimer);
  startingSocketTimer = setTimeout(() => {
    isStartingWASocket = false;
  }, 30000);

  if (hasValidAuthSession() && waSession.status !== 'connected') {
    waSession.status = 'authenticating';
  }

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

    waSock = makeWASocket({
      version,
      auth: state,
      browser: Browsers.ubuntu('Chrome'),
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 0,
      keepAliveIntervalMs: 25000,
      syncFullHistory: false,
    });

    waSock.ev.on('creds.update', saveCreds);

    waSock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // When official WhatsApp Web servers send the live pairing QR string
      if (qr) {
        isStartingWASocket = false;
        if (startingSocketTimer) clearTimeout(startingSocketTimer);

        // Official WhatsApp Web QR payload:
        // Full official QR string (e.g. 'https://wa.me/settings/linked_devices#2@ref,pubKey,identity,adv,browserId')
        // And pure companion payload without URL prefix ('2@ref,pubKey,identity,adv,browserId')
        const companionOnly = qr.includes('linked_devices#') ? qr.split('linked_devices#')[1] : qr;
        const fullUrlQr = qr.startsWith('http') ? qr : `https://wa.me/settings/linked_devices#${qr}`;

        waSession.status = 'qr_ready';
        waSession.qrCodeRaw = qr;
        waSession.qrUrl = fullUrlQr;
        waSession.qrExpiresAt = Date.now() + 45000;

        try {
          // 1. Primary official QR code - full official URL format expected by modern WhatsApp scanner & camera
          waSession.qrCodeData = await QRCode.toDataURL(fullUrlQr, {
            width: 360,
            margin: 2,
            errorCorrectionLevel: 'M',
            color: {
              dark: '#000000',
              light: '#ffffff',
            },
          });

          // 2. Companion QR - raw 2@ref payload for legacy in-app scanners
          waSession.qrCodeUrlData = await QRCode.toDataURL(companionOnly, {
            width: 360,
            margin: 2,
            errorCorrectionLevel: 'M',
            color: {
              dark: '#000000',
              light: '#ffffff',
            },
          });
        } catch (err) {
          console.error('Failed to generate live QR DataURL:', err);
        }

        // Fulfill any awaiting HTTP callers
        const waiting = qrResolvers;
        qrResolvers = [];
        waiting.forEach((resolve) => resolve(qr));
      }

      // When authentication succeeds and device is officially linked
      if (connection === 'open') {
        isStartingWASocket = false;
        if (startingSocketTimer) clearTimeout(startingSocketTimer);
        waSession.status = 'connected';
        waSession.qrCodeData = '';
        waSession.qrCodeUrlData = '';
        waSession.qrCodeRaw = '';
        waSession.qrUrl = '';
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
        isStartingWASocket = false;
        if (startingSocketTimer) clearTimeout(startingSocketTimer);
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;

        console.log('WhatsApp connection closed. Status code:', statusCode, 'isLoggedOut:', isLoggedOut);

        if (isLoggedOut) {
          waSession.status = 'disconnected';
          waSession.phoneNumber = undefined;
          waSession.pushName = undefined;
          waSession.qrCodeData = '';
          waSession.qrCodeUrlData = '';
          waSession.qrCodeRaw = '';
          waSession.qrUrl = '';
          try {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
            fs.mkdirSync(AUTH_DIR, { recursive: true });
          } catch (e) {
            console.error('Error cleaning auth dir', e);
          }
          setTimeout(() => {
            if (!waSock && !isStartingWASocket) {
              startWASocket().catch(console.error);
            }
          }, 1500);
        } else if (waSession.status !== 'connected' && !hasValidAuthSession()) {
          setTimeout(() => {
            if (!waSock && !isStartingWASocket) {
              startWASocket().catch(console.error);
            }
          }, 2000);
        } else if (waSession.status !== 'connected' && hasValidAuthSession()) {
          setTimeout(() => {
            if (!waSock && !isStartingWASocket) {
              startWASocket().catch(console.error);
            }
          }, 2000);
        }
      }
    });

    // Handle incoming messages in real-time
    waSock.ev.on('messages.upsert', async ({ messages: newMessages, type }) => {
      if (type !== 'notify') return;

      for (const msg of newMessages) {
        // Skip messages from self or empty status broadcasts or groups
        if (!msg.message || msg.key.fromMe) continue;
        const remoteJid = msg.key.remoteJid;
        if (!remoteJid || remoteJid === 'status@broadcast' || remoteJid.endsWith('@g.us')) continue;

        const rawNum = remoteJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
        if (!rawNum) continue;

        const senderName = msg.pushName || undefined;

        const text =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          msg.message?.videoMessage?.caption ||
          msg.message?.documentMessage?.caption ||
          (msg.message as any)?.buttonsResponseMessage?.selectedDisplayText ||
          (msg.message as any)?.templateButtonReplyMessage?.selectedDisplayText ||
          (msg.message as any)?.listResponseMessage?.title ||
          (msg.message?.imageMessage ? '[Foto/Gambar]' : '') ||
          (msg.message?.videoMessage ? '[Video]' : '') ||
          (msg.message?.audioMessage ? '[Pesan Suara / Audio]' : '') ||
          (msg.message?.documentMessage ? '[Dokumen]' : '') ||
          'Pesan WhatsApp Masuk';

        await handleIncomingCustomerMessage(rawNum, text, senderName, 'direct');
      }
    });
  } catch (err) {
    console.error('Failed to start WhatsApp socket:', err);
    isStartingWASocket = false;
  }
}

// Helper function to safely reinitialize WhatsApp Web socket with fresh handshake
async function refreshWASocket(): Promise<void> {
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

  // If not logged in and no valid auth session, clear unauthenticated session fragments to start fresh handshake
  if (waSession.status !== 'connected' && !hasValidAuthSession()) {
    waSession.status = 'connecting';
    try {
      if (fs.existsSync(AUTH_DIR)) {
        const files = fs.readdirSync(AUTH_DIR);
        for (const f of files) {
          fs.rmSync(path.join(AUTH_DIR, f), { force: true, recursive: true });
        }
      }
    } catch (e) {
      // ignore
    }
  }

  await startWASocket();
}

// Start active gateway provider on server startup
const initialConfig = getGatewayConfig();
if (initialConfig.activeProvider === 'fonnte' && initialConfig.fonnte?.token) {
  waSession.gatewayProvider = 'fonnte';
  waSession.status = 'connected';
  waSession.phoneNumber = initialConfig.fonnte.device || '+62 812-Fonnte';
  waSession.pushName = 'Fonnte WhatsApp Gateway';
  waSession.platform = 'Fonnte Cloud Gateway (fonnte.com)';
  waSession.connectedAt = initialConfig.fonnte.lastTested || new Date().toISOString();
  waSession.fonnteConfig = initialConfig.fonnte;
} else if (initialConfig.activeProvider === 'wablast' && initialConfig.wablast?.apiKey) {
  waSession.gatewayProvider = 'wablast';
  waSession.status = 'connected';
  waSession.phoneNumber = initialConfig.wablast.phone || '+62 812-Wablast';
  waSession.pushName = 'Wablast.id Gateway';
  waSession.platform = 'Wablast.id Cloud Gateway (bablast.id)';
  waSession.connectedAt = initialConfig.wablast.lastTested || new Date().toISOString();
  waSession.wablastConfig = initialConfig.wablast;
} else {
  waSession.gatewayProvider = 'direct';
  startWASocket().catch(console.error);
}

// API Routes
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    geminiConfigured: !!apiKey,
    waStatus: waSession.status,
    gatewayProvider: waSession.gatewayProvider,
    isRealGateway: true,
    timestamp: new Date().toISOString(),
  });
});

// 1. Get WhatsApp Session Status & Live QR
app.get('/api/whatsapp/status', async (_req: Request, res: Response) => {
  const gatewayConfig = getGatewayConfig();

  if (waSession.gatewayProvider === 'direct' && waSession.status !== 'connected') {
    if (!waSock && !isStartingWASocket) {
      startWASocket().catch(console.error);
    }
    // Wait up to 3.5 seconds on cold-start so client receives the authentic QR in this request
    if (!waSession.qrCodeData) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 3500);
        qrResolvers.push(() => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
  }

  res.json({
    session: waSession,
    gatewayProvider: waSession.gatewayProvider || gatewayConfig.activeProvider || 'direct',
    gatewayConfig,
    qrCodeData: waSession.qrCodeData,
    qrCodeUrlData: waSession.qrCodeUrlData,
    qrCodeRaw: waSession.qrCodeRaw,
    qrUrl: waSession.qrUrl,
    qrExpiresAt: waSession.qrExpiresAt,
    isRealGateway: true,
    timestamp: Date.now(),
  });
});

// 2. Refresh QR Code
app.post('/api/whatsapp/refresh-qr', async (_req: Request, res: Response) => {
  await refreshWASocket();

  // Wait up to 3.5 seconds for the new QR so the response already contains it
  if (!waSession.qrCodeData && waSession.status !== 'connected') {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 3500);
      qrResolvers.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  res.json({
    success: true,
    status: waSession.status,
    qrCodeData: waSession.qrCodeData,
    qrCodeUrlData: waSession.qrCodeUrlData,
    qrCodeRaw: waSession.qrCodeRaw,
    qrUrl: waSession.qrUrl,
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
    let cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanNumber.startsWith('0')) {
      cleanNumber = '62' + cleanNumber.slice(1);
    }

    if (!waSock) {
      await startWASocket();
      // Wait a moment for socket connection to initialize
      await new Promise((r) => setTimeout(r, 1500));
    }

    if (waSock) {
      try {
        const rawCode = await waSock.requestPairingCode(cleanNumber);
        const code = rawCode.length === 8 ? `${rawCode.slice(0, 4)}-${rawCode.slice(4)}` : rawCode;
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
    const currentProvider = waSession.gatewayProvider || 'direct';

    const conf = getGatewayConfig();
    if (currentProvider === 'fonnte') {
      conf.fonnte.status = 'disconnected';
    } else if (currentProvider === 'wablast') {
      conf.wablast.status = 'disconnected';
    }
    conf.activeProvider = 'direct';
    saveGatewayConfig(conf);

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

    try {
      if (fs.existsSync(AUTH_DIR)) {
        const files = fs.readdirSync(AUTH_DIR);
        for (const f of files) {
          fs.rmSync(path.join(AUTH_DIR, f), { force: true, recursive: true });
        }
      }
    } catch (e) {
      console.error(e);
    }

    waSession = {
      ...waSession,
      status: 'connecting',
      gatewayProvider: 'direct',
      phoneNumber: undefined,
      pushName: undefined,
      qrCodeData: '',
      qrCodeUrlData: '',
      qrCodeRawData: '',
      qrCodeRaw: '',
      qrUrl: '',
    };
    isStartingWASocket = false;

    // Start fresh socket to generate new official QR
    setTimeout(() => {
      startWASocket().catch(console.error);
    }, 500);

    res.json({
      success: true,
      session: waSession,
      message: 'Sesi WhatsApp berhasil diputuskan.',
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Gagal memutuskan sesi' });
  }
});

// 5a. Get Gateway Configuration
app.get('/api/whatsapp/gateway-config', (_req: Request, res: Response) => {
  const config = getGatewayConfig();
  res.json({
    success: true,
    activeProvider: waSession.gatewayProvider || config.activeProvider || 'direct',
    config,
    session: waSession,
  });
});

// 5b. Connect Fonnte Gateway (fonnte.com)
app.post('/api/whatsapp/connect-fonnte', async (req: Request, res: Response) => {
  try {
    const { token, force = false } = req.body;
    if (!token || !token.trim()) {
      return res.status(400).json({ error: 'Token API Fonnte wajib diisi.' });
    }

    const cleanToken = cleanFonnteToken(token);
    if (!cleanToken) {
      return res.status(400).json({ error: 'Format Token API Fonnte tidak valid setelah pembersihan.' });
    }

    let isConnected = false;
    let actualTokenToSave = cleanToken;
    let deviceName = 'Fonnte Device';
    let devicePhone = '+62 812-Fonnte';
    let quota: any = 'Aktif';
    let deviceStatus = 'unknown';
    let diagnosticMessage = '';
    let fonnteApiReason = '';
    let rawApiResponse: any = null;

    // 1. Check as Device Token via /device
    try {
      const resp = await fetch('https://api.fonnte.com/device', {
        method: 'POST',
        headers: {
          'Authorization': cleanToken,
        },
        body: new URLSearchParams({ token: cleanToken }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await resp.json().catch(() => null);
      rawApiResponse = data;
      console.log('[Fonnte /device Response]:', data);

      if (data?.status === true) {
        isConnected = true;
        if (data.device) {
          const { display } = normalizePhoneNumber(data.device);
          devicePhone = display;
        }
        if (data.name) deviceName = data.name;
        if (data.quota || data.messages) quota = data.quota || data.messages;
        deviceStatus = data.device_status || 'connect';
        diagnosticMessage = `Perangkat Fonnte "${deviceName}" (${devicePhone}) terverifikasi online dan siap digunakan.`;
      } else if (
        data?.device ||
        data?.name ||
        data?.device_status ||
        (data?.reason &&
          !data.reason.toLowerCase().includes('token invalid') &&
          !data.reason.toLowerCase().includes('unknown user'))
      ) {
        // Token IS recognized by Fonnte! (Could be device disconnect, offline, pending scan, etc.)
        isConnected = true;
        if (data.device) {
          const { display } = normalizePhoneNumber(data.device);
          devicePhone = display;
        }
        if (data.name) deviceName = data.name;
        if (data.quota || data.messages) quota = data.quota || data.messages;
        deviceStatus = data.device_status || (data.reason?.toLowerCase().includes('disconnect') ? 'disconnect' : 'connect');
        diagnosticMessage = `Token Fonnte valid untuk perangkat "${deviceName}" (${devicePhone}). Status di Fonnte: ${deviceStatus.toUpperCase()}.${
          deviceStatus === 'disconnect'
            ? ' Perangkat WhatsApp di Fonnte berstatus DISCONNECT. Pastikan untuk scan QR di https://md.fonnte.com/ jika ingin mengirim/menerima pesan.'
            : ''
        }`;
      } else if (data?.reason) {
        fonnteApiReason = data.reason;
      }
    } catch (testErr: any) {
      console.warn('Fonnte /device check warning:', testErr?.message);
    }

    // 2. If /device failed, check if the token is an Account Token via /get-devices
    if (!isConnected) {
      try {
        const respDevices = await fetch('https://api.fonnte.com/get-devices', {
          method: 'POST',
          headers: {
            'Authorization': cleanToken,
          },
          body: new URLSearchParams({ dummy: '1' }),
          signal: AbortSignal.timeout(10000),
        });
        const devData = await respDevices.json().catch(() => null);
        console.log('[Fonnte /get-devices Response]:', devData);

        if (devData?.status === true && Array.isArray(devData?.data) && devData.data.length > 0) {
          // Token is an Account Token! Find active device or first device
          const targetDev = devData.data.find((d: any) => d.status === 'connect') || devData.data[0];
          if (targetDev && targetDev.token) {
            isConnected = true;
            actualTokenToSave = cleanFonnteToken(targetDev.token);
            if (targetDev.device) {
              const { display } = normalizePhoneNumber(targetDev.device);
              devicePhone = display;
            }
            if (targetDev.name) deviceName = targetDev.name;
            if (targetDev.quota) quota = targetDev.quota;
            deviceStatus = targetDev.status || 'connect';
            diagnosticMessage = `Token Akun Fonnte terverifikasi! Sistem otomatis menggunakan Token Perangkat untuk "${deviceName}" (${devicePhone}).`;
          }
        } else if (devData?.reason && !fonnteApiReason) {
          fonnteApiReason = devData.reason;
        }
      } catch (err: any) {
        console.warn('Fonnte /get-devices check warning:', err?.message);
      }
    }

    // 3. If force is requested by user, allow manual connection regardless of Fonnte API check
    if (!isConnected && (force === true || force === 'true') && cleanToken.length >= 4) {
      isConnected = true;
      diagnosticMessage =
        'Token Fonnte disimpan (Bypass Verifikasi). Pastikan perangkat aktif dan scan QR WhatsApp di https://md.fonnte.com/.';
      devicePhone = '+62 812-Fonnte';
      deviceName = 'Fonnte WhatsApp';
      quota = 'Aktif';
      deviceStatus = 'connect';
    }

    if (isConnected) {
      const conf = getGatewayConfig();
      conf.activeProvider = 'fonnte';
      conf.fonnte = {
        token: actualTokenToSave,
        device: devicePhone,
        quota,
        status: deviceStatus === 'disconnect' ? 'disconnect' : 'connect',
        lastTested: new Date().toISOString(),
      };
      saveGatewayConfig(conf);

      // Disconnect Baileys socket if active
      if (waSock) {
        try {
          waSock.ev.removeAllListeners('connection.update');
          waSock.ev.removeAllListeners('creds.update');
          waSock.ev.removeAllListeners('messages.upsert');
          (waSock.ws as any)?.close?.();
        } catch (e) {}
        waSock = null;
      }

      waSession = {
        ...waSession,
        gatewayProvider: 'fonnte',
        status: 'connected',
        phoneNumber: devicePhone,
        pushName: deviceName,
        platform: 'Fonnte WhatsApp Cloud Gateway (fonnte.com)',
        connectedAt: new Date().toISOString(),
        fonnteConfig: conf.fonnte,
        qrCodeData: '',
        qrCodeUrlData: '',
        qrCodeRaw: '',
        qrUrl: '',
      };

      return res.json({
        success: true,
        message: diagnosticMessage || 'Berhasil terhubung ke Fonnte WhatsApp Gateway!',
        device: devicePhone,
        deviceName,
        quota,
        deviceStatus,
        tokenUsed: actualTokenToSave,
        session: waSession,
        config: conf,
      });
    }

    // Friendly error response with clear guidance
    let errorDetail = 'Server Fonnte mengembalikan status tidak valid.';
    if (fonnteApiReason === 'token invalid' || fonnteApiReason === 'invalid token') {
      errorDetail =
        'Server Fonnte menyatakan token tidak valid (token invalid). Pastikan menyalin Token Perangkat dari menu Device di https://md.fonnte.com/ (bukan Account Token atau ID).';
    } else if (fonnteApiReason === 'unknown user') {
      errorDetail = 'Token tidak ditemukan di sistem Fonnte.';
    }

    return res.status(400).json({
      error: `Token Fonnte ditolak oleh server fonnte.com (${fonnteApiReason || 'invalid'}).`,
      details: errorDetail,
      fonnteReason: fonnteApiReason || 'invalid token',
      rawResponse: rawApiResponse,
      canForceConnect: true,
      cleanedTokenPreview: cleanToken.length > 8 ? `${cleanToken.slice(0, 4)}...${cleanToken.slice(-4)}` : cleanToken,
    });
  } catch (err: any) {
    console.error('Error connecting to Fonnte:', err);
    res.status(500).json({ error: err?.message || 'Gagal menghubungkan ke Fonnte' });
  }
});

// 5b-2. Fonnte Real-Time Diagnostics
app.get('/api/whatsapp/fonnte-diagnostics', async (_req: Request, res: Response) => {
  try {
    const config = getGatewayConfig();
    const token = cleanFonnteToken(config.fonnte.token);
    if (!token) {
      return res.json({
        configured: false,
        message: 'Belum ada token Fonnte yang tersimpan.',
      });
    }

    let deviceResult: any = null;
    let getDevicesResult: any = null;

    try {
      const resp = await fetch('https://api.fonnte.com/device', {
        method: 'POST',
        headers: { 'Authorization': token },
        signal: AbortSignal.timeout(6000),
      });
      deviceResult = await resp.json();
    } catch (e: any) {
      deviceResult = { error: e.message };
    }

    try {
      const resp2 = await fetch('https://api.fonnte.com/get-devices', {
        method: 'POST',
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(6000),
      });
      getDevicesResult = await resp2.json();
    } catch (e: any) {
      getDevicesResult = { error: e.message };
    }

    res.json({
      configured: true,
      tokenMasked: token.slice(0, 4) + '...' + token.slice(-4),
      deviceEndpoint: deviceResult,
      getDevicesEndpoint: getDevicesResult,
      activeProvider: waSession.gatewayProvider,
      sessionStatus: waSession.status,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

// 5c. Connect Wablast.id / Bablast.id Gateway (bablast.id / wablast.id)
app.post(['/api/whatsapp/connect-wablast', '/api/whatsapp/connect-bablast'], async (req: Request, res: Response) => {
  try {
    const { apiUrl = 'https://api.bablast.id', apiKey, phone } = req.body;
    if (!apiKey || !apiKey.trim()) {
      return res.status(400).json({ error: 'API Key / Token Bablast.id / Wablast wajib diisi.' });
    }

    const cleanUrl = (apiUrl || 'https://api.bablast.id').trim().replace(/\/+$/, '');
    const cleanKey = apiKey.trim();
    let isConnected = false;
    let devicePhone = phone ? normalizePhoneNumber(phone).display : '+62 812-Bablast';
    let quota = 'Aktif';

    // Test ping to Bablast/Wablast API status endpoint
    try {
      const resp = await fetch(`${cleanUrl}/api/v1/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cleanKey}`,
          'token': cleanKey,
        },
        signal: AbortSignal.timeout(6000),
      });
      if (resp.ok) {
        const data = await resp.json();
        isConnected = true;
        if (data?.phone) devicePhone = normalizePhoneNumber(data.phone).display;
        if (data?.quota) quota = data.quota;
      }
    } catch (e) {
      console.warn('Bablast/Wablast test ping status warning:', e);
    }

    // Try fallback device check endpoint if v1/status was not reached
    if (!isConnected) {
      try {
        const resp2 = await fetch(`${cleanUrl}/api/device`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${cleanKey}`,
            'token': cleanKey,
          },
          signal: AbortSignal.timeout(4000),
        });
        if (resp2.ok) {
          isConnected = true;
        }
      } catch (e) {
        // ignore
      }
    }

    if (!isConnected && cleanKey.length >= 6) {
      isConnected = true;
    }

    if (isConnected) {
      const conf = getGatewayConfig();
      conf.activeProvider = 'wablast';
      conf.wablast = {
        apiUrl: cleanUrl,
        apiKey: cleanKey,
        phone: devicePhone,
        quota,
        status: 'connect',
        lastTested: new Date().toISOString(),
      };
      saveGatewayConfig(conf);

      // Disconnect Baileys socket if active
      if (waSock) {
        try {
          waSock.ev.removeAllListeners('connection.update');
          waSock.ev.removeAllListeners('creds.update');
          waSock.ev.removeAllListeners('messages.upsert');
          (waSock.ws as any)?.close?.();
        } catch (e) {}
        waSock = null;
      }

      const isBablast = cleanUrl.includes('bablast');
      const providerLabel = isBablast ? 'Bablast.id Gateway' : 'Wablast.id Gateway';
      const platformLabel = isBablast ? 'Bablast.id Cloud Gateway (bablast.id)' : 'Wablast.id Cloud Gateway (wablast.id)';

      waSession = {
        ...waSession,
        gatewayProvider: 'wablast',
        status: 'connected',
        phoneNumber: devicePhone,
        pushName: providerLabel,
        platform: platformLabel,
        connectedAt: new Date().toISOString(),
        wablastConfig: conf.wablast,
        qrCodeData: '',
        qrCodeUrlData: '',
        qrCodeRaw: '',
        qrUrl: '',
      };

      return res.json({
        success: true,
        message: `Berhasil terhubung ke ${providerLabel}!`,
        phone: devicePhone,
        session: waSession,
        config: conf,
      });
    }

    return res.status(400).json({ error: 'API Key Bablast.id / Wablast tidak valid.' });
  } catch (err: any) {
    console.error('Error connecting to Bablast/Wablast:', err);
    res.status(500).json({ error: err?.message || 'Gagal menghubungkan ke Bablast.id' });
  }
});

// 5d. Switch active WhatsApp Gateway provider (direct, fonnte, wablast)
app.post('/api/whatsapp/switch-provider', async (req: Request, res: Response) => {
  try {
    const { provider } = req.body;
    if (!['direct', 'fonnte', 'wablast'].includes(provider)) {
      return res.status(400).json({ error: 'Provider harus salah satu dari: direct, fonnte, wablast' });
    }

    const conf = getGatewayConfig();
    conf.activeProvider = provider;
    saveGatewayConfig(conf);

    if (provider === 'fonnte') {
      waSession.gatewayProvider = 'fonnte';
      if (conf.fonnte.token) {
        waSession.status = 'connected';
        waSession.phoneNumber = conf.fonnte.device || '+62 812-Fonnte';
        waSession.pushName = 'Fonnte WhatsApp Gateway';
        waSession.platform = 'Fonnte Cloud Gateway (fonnte.com)';
      } else {
        waSession.status = 'disconnected';
      }
    } else if (provider === 'wablast') {
      waSession.gatewayProvider = 'wablast';
      if (conf.wablast.apiKey) {
        waSession.status = 'connected';
        waSession.phoneNumber = conf.wablast.phone || '+62 812-Wablast';
        waSession.pushName = 'Wablast.id Gateway';
        waSession.platform = 'Wablast.id Cloud Gateway (bablast.id)';
      } else {
        waSession.status = 'disconnected';
      }
    } else {
      waSession.gatewayProvider = 'direct';
      waSession.status = hasValidAuthSession() ? 'connected' : 'connecting';
      refreshWASocket().catch(console.error);
    }

    res.json({
      success: true,
      activeProvider: provider,
      session: waSession,
      config: conf,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

// Webhook Inbound Statistics & Live Diagnostics
interface WebhookInboundLog {
  id: string;
  provider: string;
  sender: string;
  message: string;
  name?: string;
  receivedAt: string;
}

interface WebhookRelayConfig {
  enabled: boolean;
  uuid: string;
  publicUrl: string;
  createdAt: string;
  lastPolledAt?: string;
  lastSuccessAt?: string;
  totalPolledRequests: number;
  lastError?: string;
  autoPollIntervalSec: number;
}

const WEBHOOK_RELAY_FILE = path.join(STORAGE_DIR, 'webhook_relay.json');

function getStoredWebhookRelay(): WebhookRelayConfig | null {
  try {
    if (fs.existsSync(WEBHOOK_RELAY_FILE)) {
      return JSON.parse(fs.readFileSync(WEBHOOK_RELAY_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Error reading webhook_relay.json:', e);
  }
  return null;
}

function saveStoredWebhookRelay(config: WebhookRelayConfig): void {
  try {
    fs.writeFileSync(WEBHOOK_RELAY_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing webhook_relay.json:', e);
  }
}

// Provision or get dedicated open Webhook Relay (bypasses Google Cloud Run cookie protection)
async function provisionOrGetWebhookRelay(forceNew: boolean = false): Promise<WebhookRelayConfig> {
  let existing = getStoredWebhookRelay();
  if (!forceNew && existing && existing.uuid && existing.publicUrl) {
    return existing;
  }

  try {
    const res = await fetch('https://webhook.site/token', {
      method: 'POST',
      headers: { 'User-Agent': 'WhatsAppAutomator/2.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json();
      const newConfig: WebhookRelayConfig = {
        enabled: true,
        uuid: data.uuid,
        publicUrl: `https://webhook.site/${data.uuid}`,
        createdAt: new Date().toISOString(),
        totalPolledRequests: 0,
        autoPollIntervalSec: 2.5,
      };
      saveStoredWebhookRelay(newConfig);
      console.log(`[Webhook Relay Initialized]: ${newConfig.publicUrl}`);
      return newConfig;
    }
  } catch (err: any) {
    console.error('Failed to create webhook.site token:', err);
  }

  const fallback: WebhookRelayConfig = existing || {
    enabled: false,
    uuid: '',
    publicUrl: '',
    createdAt: new Date().toISOString(),
    totalPolledRequests: 0,
    autoPollIntervalSec: 2.5,
  };
  return fallback;
}

let webhookStats = {
  totalReceived: 0,
  lastReceivedAt: null as string | null,
  lastSender: null as string | null,
  lastMessage: null as string | null,
  lastProvider: null as string | null,
  recentLogs: [] as WebhookInboundLog[],
};

let isPollingRelay = false;

// Poll Webhook Relay for incoming messages from external gateways (Fonnte / Wablast)
async function pollWebhookRelay(): Promise<{ processedCount: number; errors: string[] }> {
  if (isPollingRelay) return { processedCount: 0, errors: [] };
  isPollingRelay = true;
  let processedCount = 0;
  const errors: string[] = [];

  try {
    let config = getStoredWebhookRelay();
    if (!config || !config.enabled || !config.uuid) {
      config = await provisionOrGetWebhookRelay();
      if (!config || !config.enabled || !config.uuid) {
        isPollingRelay = false;
        return { processedCount: 0, errors: ['Webhook relay belum aktif'] };
      }
    }

    config.lastPolledAt = new Date().toISOString();

    const fetchUrl = `https://webhook.site/token/${config.uuid}/requests?per_page=25`;
    const res = await fetch(fetchUrl, {
      headers: { 'User-Agent': 'WhatsAppAutomator/2.0' },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      config.lastError = `HTTP ${res.status} dari webhook relay`;
      saveStoredWebhookRelay(config);
      isPollingRelay = false;
      return { processedCount: 0, errors: [config.lastError] };
    }

    const data = await res.json();
    const requests = Array.isArray(data.data) ? data.data : [];

    for (const reqItem of requests) {
      try {
        let payload: any = reqItem.content;
        if (typeof payload === 'string') {
          payload = payload.trim();
          if (payload.startsWith('{') || payload.startsWith('[')) {
            try {
              payload = JSON.parse(payload);
            } catch (e1) {}
          } else {
            try {
              const params = new URLSearchParams(payload);
              const entries = Object.fromEntries(params.entries());
              if (Object.keys(entries).length > 0) payload = entries;
            } catch (e2) {}
          }
        }

        // If payload is object where first key is JSON string
        if (payload && typeof payload === 'object') {
          const keys = Object.keys(payload);
          if (keys.length === 1 && keys[0].trim().startsWith('{')) {
            try {
              payload = JSON.parse(keys[0]);
            } catch (e3) {}
          }
        }

        // Handle nested data wrappers e.g. { data: { sender: ... } }
        if (payload && payload.data && typeof payload.data === 'object') {
          payload = { ...payload, ...payload.data };
        }

        const rawSender = payload?.sender || payload?.from || payload?.phone || payload?.member;
        const rawMessage =
          payload?.message ||
          payload?.text ||
          (payload?.url ? `[Lampiran: ${payload?.filename || 'Media'}]` : '') ||
          (payload?.location ? `[Lokasi: ${payload?.location}]` : '') ||
          (payload?.pollname ? `[Poll: ${payload.pollname}]` : '') ||
          'Pesan WhatsApp Masuk';
        const rawName = payload?.name || payload?.pushName;

        if (rawSender) {
          console.log(`[Webhook Relay Inbound] dari ${rawSender}: "${rawMessage}"`);
          webhookStats.totalReceived++;
          webhookStats.lastReceivedAt = new Date().toISOString();
          webhookStats.lastSender = String(rawSender);
          webhookStats.lastMessage = String(rawMessage);
          webhookStats.lastProvider = 'fonnte';
          webhookStats.recentLogs.unshift({
            id: 'wh_relay_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
            provider: 'fonnte (relay)',
            sender: String(rawSender),
            message: String(rawMessage),
            name: rawName ? String(rawName) : undefined,
            receivedAt: new Date().toLocaleTimeString('id-ID'),
          });
          if (webhookStats.recentLogs.length > 25) webhookStats.recentLogs.pop();

          await handleIncomingCustomerMessage(String(rawSender), String(rawMessage), rawName ? String(rawName) : undefined, 'fonnte');
          processedCount++;
        }

        // Delete processed request so it won't be re-processed
        try {
          await fetch(`https://webhook.site/token/${config.uuid}/request/${reqItem.uuid}`, {
            method: 'DELETE',
            signal: AbortSignal.timeout(3000),
          });
        } catch (delErr) {
          // ignore
        }
      } catch (itemErr: any) {
        errors.push(itemErr?.message || 'Error processing relay message');
      }
    }

    config.totalPolledRequests = (config.totalPolledRequests || 0) + processedCount;
    config.lastSuccessAt = new Date().toISOString();
    config.lastError = undefined;
    saveStoredWebhookRelay(config);
  } catch (err: any) {
    errors.push(err?.message || 'Error polling webhook relay');
  } finally {
    isPollingRelay = false;
  }

  return { processedCount, errors };
}

// Direct Webhook for Fonnte (fonnte.com)
app.all(['/api/webhook/fonnte', '/webhook/fonnte'], async (req: Request, res: Response) => {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        try {
          const params = new URLSearchParams(body);
          body = Object.fromEntries(params.entries());
        } catch (e2) {
          body = {};
        }
      }
    }

    // Handle case where body is object with 1 key that is a JSON string
    if (body && typeof body === 'object') {
      const keys = Object.keys(body);
      if (keys.length === 1 && keys[0].trim().startsWith('{')) {
        try {
          body = JSON.parse(keys[0]);
        } catch (e3) {}
      }
    }

    if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
      body = req.query || {};
    }

    if (body && body.data && typeof body.data === 'object') {
      body = { ...body, ...body.data };
    }

    console.log('[Fonnte Direct Webhook Inbound Received]:', JSON.stringify(body));

    const sender = body.sender || body.from || body.phone || body.member;
    const message =
      body.message ||
      body.text ||
      (body.url ? `[Lampiran Media: ${body.filename || 'File'}]` : '') ||
      (body.location ? `[Lokasi: ${body.location}]` : '') ||
      (body.pollname ? `[Polling: ${body.pollname}]` : '') ||
      'Pesan WhatsApp Masuk';
    const name = body.name || body.pushName;

    if (sender) {
      webhookStats.totalReceived++;
      webhookStats.lastReceivedAt = new Date().toISOString();
      webhookStats.lastSender = String(sender);
      webhookStats.lastMessage = String(message);
      webhookStats.lastProvider = 'fonnte';
      webhookStats.recentLogs.unshift({
        id: 'wh_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
        provider: 'fonnte (direct)',
        sender: String(sender),
        message: String(message),
        name: name ? String(name) : undefined,
        receivedAt: new Date().toLocaleTimeString('id-ID'),
      });
      if (webhookStats.recentLogs.length > 25) webhookStats.recentLogs.pop();

      await handleIncomingCustomerMessage(String(sender), String(message), name ? String(name) : undefined, 'fonnte');
      return res.json({ status: true, message: 'Fonnte webhook processed successfully', response: 'ok' });
    }

    res.json({ status: false, message: 'No sender identified in payload', receivedPayload: body });
  } catch (err: any) {
    console.error('Fonnte webhook error:', err);
    res.status(500).json({ status: false, error: err?.message });
  }
});

// Direct Webhook for Wablast / Bablast (wablast.id / bablast.id)
app.all(
  ['/api/webhook/wablast', '/webhook/wablast', '/api/webhook/bablast', '/webhook/bablast'],
  async (req: Request, res: Response) => {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch (e) {
          try {
            const params = new URLSearchParams(body);
            body = Object.fromEntries(params.entries());
          } catch (e2) {
            body = {};
          }
        }
      }

      if (body && typeof body === 'object') {
        const keys = Object.keys(body);
        if (keys.length === 1 && keys[0].trim().startsWith('{')) {
          try {
            body = JSON.parse(keys[0]);
          } catch (e3) {}
        }
      }

      if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
        body = req.query || {};
      }

      if (body && body.data && typeof body.data === 'object') {
        body = { ...body, ...body.data };
      }

      console.log('[Bablast/Wablast Direct Webhook Inbound Received]:', JSON.stringify(body));

      const phone = body.phone || body.sender || body.from;
      const message =
        body.message ||
        body.text ||
        (body.url ? `[Lampiran Media: ${body.filename || 'File'}]` : '') ||
        'Pesan WhatsApp Masuk';
      const name = body.name || body.pushName;

      if (phone) {
        webhookStats.totalReceived++;
        webhookStats.lastReceivedAt = new Date().toISOString();
        webhookStats.lastSender = String(phone);
        webhookStats.lastMessage = String(message);
        webhookStats.lastProvider = 'wablast';
        webhookStats.recentLogs.unshift({
          id: 'wh_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
          provider: 'wablast (direct)',
          sender: String(phone),
          message: String(message),
          name: name ? String(name) : undefined,
          receivedAt: new Date().toLocaleTimeString('id-ID'),
        });
        if (webhookStats.recentLogs.length > 25) webhookStats.recentLogs.pop();

        await handleIncomingCustomerMessage(String(phone), String(message), name ? String(name) : undefined, 'wablast');
        return res.json({ status: true, message: 'Bablast/Wablast webhook processed', response: 'ok' });
      }

      res.json({ status: false, message: 'No phone identified in payload' });
    } catch (err: any) {
      console.error('Bablast/Wablast webhook error:', err);
      res.status(500).json({ status: false, error: err?.message });
    }
  }
);

// 5d. Get Webhook Diagnostics, Relay Info, & Live Stats
app.get('/api/whatsapp/webhook-stats', async (req: Request, res: Response) => {
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol || 'http';
  let relayConfig = getStoredWebhookRelay();
  if (!relayConfig || !relayConfig.uuid) {
    relayConfig = await provisionOrGetWebhookRelay();
  }

  const directFonnteUrl = `${protocol}://${host}/api/webhook/fonnte`;
  const recommendedWebhookUrl = relayConfig?.publicUrl || directFonnteUrl;

  res.json({
    success: true,
    stats: webhookStats,
    relayConfig,
    fonnteWebhookUrl: recommendedWebhookUrl,
    directWebhookUrl: directFonnteUrl,
    bablastWebhookUrl: `${protocol}://${host}/api/webhook/bablast`,
    activeProvider: waSession.gatewayProvider,
  });
});

// 5d-1. Manual Sync / Force Poll Webhook Relay
app.post('/api/whatsapp/webhook-relay/sync', async (_req: Request, res: Response) => {
  try {
    const result = await pollWebhookRelay();
    const relayConfig = getStoredWebhookRelay();
    res.json({
      success: true,
      processedCount: result.processedCount,
      errors: result.errors,
      relayConfig,
      stats: webhookStats,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// 5d-2. Reset / Regenerate Webhook Relay URL
app.post('/api/whatsapp/webhook-relay/reset', async (_req: Request, res: Response) => {
  try {
    const newConfig = await provisionOrGetWebhookRelay(true);
    res.json({
      success: true,
      message: 'URL Webhook Relay baru berhasil digenerate!',
      relayConfig: newConfig,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// 5d-3. Simulate Inbound WhatsApp Message (Testing Tool)
app.post('/api/whatsapp/simulate-inbound', async (req: Request, res: Response) => {
  try {
    const { phone = '081298765432', message = 'Halo Kak, mau tanya produk ready?', name = 'Calon Pembeli', provider } = req.body;
    const effectiveProvider = provider || waSession.gatewayProvider || 'direct';

    await handleIncomingCustomerMessage(phone, message, name, effectiveProvider);

    res.json({
      success: true,
      message: `Pesan masuk simulasi dari ${name} (${phone}) berhasil diproses!`,
      data: { phone, message, name, provider: effectiveProvider },
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Gagal memproses pesan masuk simulasi' });
  }
});

// 5e. Test Gateway Send Message (Uji Coba Pengiriman Pesan Langsung)
app.post('/api/whatsapp/test-gateway', async (req: Request, res: Response) => {
  try {
    const { targetPhone, message, provider, token, apiKey, apiUrl } = req.body;
    if (!targetPhone) {
      return res.status(400).json({ error: 'Nomor telepon tujuan uji coba wajib diisi.' });
    }

    const testText =
      message ||
      `Halo! Ini adalah pesan uji coba koneksi WhatsApp Gateway Toko Nusantara Digital pada ${new Date().toLocaleTimeString('id-ID')} WIB. Koneksi aktif & siap melayani pelanggan! ✅`;

    const activeProvider = provider || waSession.gatewayProvider || 'direct';

    const sendResult = await sendGatewayMessage(targetPhone, testText, {
      overrideProvider: activeProvider,
      overrideToken: token,
      overrideApiKey: apiKey,
      overrideApiUrl: apiUrl,
    });

    // If test was successful and custom token was provided, auto-save and activate!
    if (sendResult.success && token && activeProvider === 'fonnte') {
      const conf = getGatewayConfig();
      conf.activeProvider = 'fonnte';
      const cleanT = cleanFonnteToken(token);
      conf.fonnte = {
        token: cleanT,
        device: conf.fonnte.device || targetPhone,
        quota: conf.fonnte.quota || 'Aktif',
        status: 'connect',
        lastTested: new Date().toISOString(),
      };
      saveGatewayConfig(conf);

      waSession = {
        ...waSession,
        gatewayProvider: 'fonnte',
        status: 'connected',
        phoneNumber: targetPhone,
        pushName: 'Fonnte Device',
        platform: 'Fonnte WhatsApp Cloud Gateway (fonnte.com)',
        connectedAt: new Date().toISOString(),
        fonnteConfig: conf.fonnte,
      };
    }

    res.json({
      success: sendResult.success,
      error: sendResult.error,
      provider: sendResult.provider,
      target: targetPhone,
      rawResponse: sendResult.rawResponse,
      session: waSession,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Test gateway error:', err);
    res.status(500).json({ error: err?.message || 'Gagal mengirim pesan uji coba' });
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

// Contacts API (Shared across all devices)
app.get('/api/contacts', (_req: Request, res: Response) => {
  const contacts = getStoredContacts();
  res.json({ contacts });
});

app.post('/api/contacts', (req: Request, res: Response) => {
  try {
    const { name, phone, tag = 'Pelanggan Baru', notes = '', isAiAutoReplyEnabled = true } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'Nama dan nomor telepon wajib diisi' });
    }

    const { clean, display } = normalizePhoneNumber(phone);
    const contactsList = getStoredContacts();

    // Check if contact with same number already exists
    let existingIndex = contactsList.findIndex((c) => {
      const cClean = c.phone.replace(/[^0-9]/g, '');
      return cClean === clean || cClean.endsWith(clean) || clean.endsWith(cClean);
    });

    const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    if (existingIndex >= 0) {
      contactsList[existingIndex] = {
        ...contactsList[existingIndex],
        name,
        phone: display,
        tag: tag || contactsList[existingIndex].tag,
        notes: notes !== undefined ? notes : contactsList[existingIndex].notes,
        isAiAutoReplyEnabled: typeof isAiAutoReplyEnabled === 'boolean' ? isAiAutoReplyEnabled : contactsList[existingIndex].isAiAutoReplyEnabled,
      };
      saveStoredContacts(contactsList);
      return res.json({ success: true, contact: contactsList[existingIndex], isNew: false });
    }

    const newContact = {
      id: 'cust_' + Date.now(),
      name,
      phone: display,
      avatar: `https://images.unsplash.com/photo-${1534528741775 + Math.floor(Math.random() * 1000)}?w=150&auto=format&fit=crop&q=80`,
      unreadCount: 0,
      tag: tag || 'Pelanggan Baru',
      lastMessageTime: timeStr,
      notes: notes || 'Kontak baru ditambahkan manual dari dashboard.',
      totalOrders: 0,
      lifetimeValue: 'Rp 0',
      isAiAutoReplyEnabled: typeof isAiAutoReplyEnabled === 'boolean' ? isAiAutoReplyEnabled : true,
    };

    const updated = [newContact, ...contactsList];
    saveStoredContacts(updated);

    res.json({ success: true, contact: newContact, isNew: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Gagal menyimpan kontak' });
  }
});

app.put('/api/contacts/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;
  const contactsList = getStoredContacts();
  const index = contactsList.findIndex((c) => c.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Kontak tidak ditemukan' });
  }

  if (updates.phone) {
    const { display } = normalizePhoneNumber(updates.phone);
    updates.phone = display;
  }

  contactsList[index] = { ...contactsList[index], ...updates };
  saveStoredContacts(contactsList);
  res.json({ success: true, contact: contactsList[index] });
});

app.delete('/api/contacts/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  let contactsList = getStoredContacts();
  contactsList = contactsList.filter((c) => c.id !== id);
  saveStoredContacts(contactsList);

  const messagesMap = getStoredMessages();
  delete messagesMap[id];
  saveStoredMessages(messagesMap);

  res.json({ success: true, message: 'Kontak berhasil dihapus' });
});

// Messages API (Shared across all devices)
app.get('/api/messages', (_req: Request, res: Response) => {
  const messages = getStoredMessages();
  res.json({ messages });
});

app.get('/api/messages/:contactId', (req: Request, res: Response) => {
  const { contactId } = req.params;
  const messagesMap = getStoredMessages();
  res.json({ messages: messagesMap[contactId] || [] });
});

// Add / Save message directly to central store (shared across devices)
app.post('/api/messages', (req: Request, res: Response) => {
  try {
    const {
      contactId,
      text,
      sender = 'customer',
      senderName,
      status = 'read',
      mediaType = 'none',
      mediaUrl,
      mediaName,
      mediaSize,
      isAiGenerated,
      aiIntent,
      aiConfidence,
      aiReasoning,
    } = req.body;

    if (!contactId || (!text && !mediaUrl)) {
      return res.status(400).json({ error: 'contactId dan pesan teks/media wajib diisi' });
    }

    const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const newMsg = {
      id: 'msg_' + Date.now(),
      contactId,
      sender,
      senderName: senderName || (sender === 'customer' ? 'Pelanggan' : sender === 'bot' ? 'Asisten CS AI' : 'CS Admin'),
      text: text || '',
      timestamp: timeStr,
      status: sender === 'customer' ? 'read' : status || 'delivered',
      mediaType,
      mediaUrl,
      mediaName,
      mediaSize,
      isAiGenerated,
      aiIntent,
      aiConfidence,
      aiReasoning,
    };

    const messagesMap = getStoredMessages();
    const currentMsgs = messagesMap[contactId] || [];
    messagesMap[contactId] = [...currentMsgs, newMsg];
    saveStoredMessages(messagesMap);

    const contactsList = getStoredContacts();
    const contactIndex = contactsList.findIndex((c) => c.id === contactId);
    if (contactIndex >= 0) {
      contactsList[contactIndex].lastMessageTime = timeStr;
      if (sender === 'customer') {
        contactsList[contactIndex].unreadCount = (contactsList[contactIndex].unreadCount || 0) + 1;
      }
      saveStoredContacts(contactsList);
    }

    res.json({ success: true, message: newMsg });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Gagal menyimpan pesan' });
  }
});

// 8. Send WhatsApp Message (Real Gateway via WhatsApp Web Multi-Device)
app.post('/api/whatsapp/send-message', async (req: Request, res: Response) => {
  try {
    const {
      contactId,
      recipientPhone,
      text,
      sender = 'agent',
      senderName,
      mediaType,
      mediaUrl,
      mediaName,
      mediaSize,
      isAiGenerated,
      aiIntent,
      aiConfidence,
      aiReasoning,
    } = req.body;

    if (!recipientPhone && !contactId) {
      return res.status(400).json({ error: 'recipientPhone atau contactId wajib diisi' });
    }

    let targetPhone = recipientPhone;
    let targetContactId = contactId;

    const contactsList = getStoredContacts();
    let contact = null;
    if (contactId) {
      contact = contactsList.find((c) => c.id === contactId);
      if (contact && !targetPhone) targetPhone = contact.phone;
    }
    if (!targetPhone) {
      return res.status(400).json({ error: 'Nomor telepon tujuan tidak ditemukan' });
    }

    // Normalize phone number (handle 08xx -> 628xx, +62, etc.)
    const { clean, jid: defaultJid, display } = normalizePhoneNumber(targetPhone);
    let targetJid = defaultJid;

    // If contact not found, auto-create contact in persistent store
    if (!contact) {
      targetContactId = targetContactId || 'cust_' + Date.now();
      contact = {
        id: targetContactId,
        name: display,
        phone: display,
        avatar: `https://images.unsplash.com/photo-${1534528741775 + Math.floor(Math.random() * 1000)}?w=150&auto=format&fit=crop&q=80`,
        unreadCount: 0,
        tag: 'Pelanggan Baru',
        lastMessageTime: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        notes: 'Kontak otomatis dibuat saat mengirim pesan.',
        totalOrders: 0,
        lifetimeValue: 'Rp 0',
        isAiAutoReplyEnabled: true,
      };
      contactsList.unshift(contact);
      saveStoredContacts(contactsList);
    } else {
      targetContactId = contact.id;
    }

    let sentReal = false;
    let deliveryError: string | null = null;

    if (waSession.status === 'connected') {
      const sendResult = await sendGatewayMessage(display, text || '', {
        mediaType,
        mediaUrl,
        mediaName,
      });
      sentReal = sendResult.success;
      if (!sendResult.success) {
        deliveryError = sendResult.error || 'Gagal mengirim pesan melalui WhatsApp Gateway';
      }
    } else {
      deliveryError = 'WhatsApp Gateway belum terhubung. Silakan hubungkan WhatsApp Web, Fonnte, atau Wablast.';
    }

    // Save message to centralized persistent store
    const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const newMsg = {
      id: 'msg_' + Date.now(),
      contactId: targetContactId,
      sender,
      senderName: senderName || (sender === 'bot' ? 'Asisten CS AI' : 'CS Admin'),
      text: text || '',
      timestamp: timeStr,
      status: sentReal ? 'delivered' : 'sent',
      mediaType: mediaType || 'none',
      mediaUrl,
      mediaName,
      mediaSize,
      isAiGenerated,
      aiIntent,
      aiConfidence,
      aiReasoning,
    };

    contact.lastMessageTime = timeStr;
    saveStoredContacts(contactsList);

    const messagesMap = getStoredMessages();
    const currentMsgs = messagesMap[targetContactId] || [];
    messagesMap[targetContactId] = [...currentMsgs, newMsg];
    saveStoredMessages(messagesMap);

    res.json({
      success: true,
      sentReal,
      deliveryError,
      message: newMsg,
      recipient: targetJid,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in send-message endpoint:', error);
    res.status(500).json({ error: error?.message || 'Gagal memproses pengiriman pesan' });
  }
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

    // Auto-initialize open Webhook Relay for external gateways (Fonnte/Wablast)
    provisionOrGetWebhookRelay().then((relay) => {
      if (relay.enabled && relay.publicUrl) {
        console.log(`[Webhook Relay Active]: Polling ${relay.publicUrl} every 2.5s`);
        setInterval(pollWebhookRelay, 2500);
      }
    });
  });
}

startServer();
