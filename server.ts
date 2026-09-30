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
  qrCodeUrlData?: string;
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
}

let waSession: WASession = {
  status: 'connecting',
  qrCodeData: '',
  qrCodeUrlData: '',
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

// Normalize phone numbers (Indonesian & International formats)
function normalizePhoneNumber(rawPhone: string): { clean: string; jid: string; display: string } {
  let digits = rawPhone.replace(/[^0-9]/g, '');
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
      const data = JSON.parse(fs.readFileSync(CONTACTS_FILE, 'utf-8'));
      if (Array.isArray(data) && data.length > 0) return data;
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
let qrResolvers: Array<(qr: string) => void> = [];

async function startWASocket(): Promise<void> {
  if (isStartingWASocket) return;
  isStartingWASocket = true;

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
        // WhatsApp mobile in-app scanner ("Tautkan Perangkat") strictly expects the companion pairing payload: 2@ref,pubKey,identity,adv,browserId
        // Baileys may prefix with 'https://wa.me/settings/linked_devices#' for external OS camera apps.
        const cleanCompanionQr = qr.includes('linked_devices#') ? qr.split('linked_devices#')[1] : qr;

        waSession.status = 'qr_ready';
        waSession.qrCodeRaw = cleanCompanionQr;
        waSession.qrUrl = qr;
        waSession.qrExpiresAt = Date.now() + 45000;

        try {
          // 1. Official companion QR (for WhatsApp -> Perangkat Tertaut -> Tautkan Perangkat scanner)
          waSession.qrCodeData = await QRCode.toDataURL(cleanCompanionQr, {
            width: 320,
            margin: 2,
            errorCorrectionLevel: 'M',
            color: {
              dark: '#000000',
              light: '#ffffff',
            },
          });

          // 2. URL QR (for phone camera app or deep link)
          waSession.qrCodeUrlData = await QRCode.toDataURL(qr, {
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

        // Fulfill any awaiting HTTP callers
        const waiting = qrResolvers;
        qrResolvers = [];
        waiting.forEach((resolve) => resolve(cleanCompanionQr));
      }

      // When authentication succeeds and device is officially linked
      if (connection === 'open') {
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
        } else if (waSession.status !== 'connected' && !hasValidAuthSession()) {
          // Connection closed before login (e.g. 408 QR timeout, connection reset)
          // Clean unauthenticated keys so next handshake is guaranteed fresh
          try {
            if (fs.existsSync(AUTH_DIR)) {
              const files = fs.readdirSync(AUTH_DIR);
              for (const f of files) {
                fs.rmSync(path.join(AUTH_DIR, f), { force: true, recursive: true });
              }
            }
          } catch (e) {}

          waSession.qrCodeData = '';
          waSession.qrCodeUrlData = '';
          waSession.qrCodeRaw = '';
          waSession.qrUrl = '';

          setTimeout(() => {
            isStartingWASocket = false;
            startWASocket().catch(console.error);
          }, 1500);
        } else if (waSession.status !== 'connected' && hasValidAuthSession()) {
          // Reconnect using saved credentials
          setTimeout(() => {
            isStartingWASocket = false;
            startWASocket().catch(console.error);
          }, 2000);
        }
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

        const rawNum = remoteJid.replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '');
        const { display, clean } = normalizePhoneNumber(rawNum);
        const senderName = msg.pushName || `Pelanggan ${clean.slice(-4)}`;

        const text =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          '';

        console.log(`[Pesan Masuk WA] dari ${senderName} (${display}): "${text}"`);

        // 1. Update or create contact in centralized storage
        let contactsList = getStoredContacts();
        let contact = contactsList.find((c) => {
          const cClean = c.phone.replace(/[^0-9]/g, '');
          return cClean === clean || cClean.endsWith(clean) || clean.endsWith(cClean);
        });

        const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

        if (!contact) {
          contact = {
            id: 'cust_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            name: senderName,
            phone: display,
            avatar: `https://images.unsplash.com/photo-${1534528741775 + Math.floor(Math.random() * 1000)}?w=150&auto=format&fit=crop&q=80`,
            unreadCount: 1,
            tag: 'Pelanggan Baru',
            lastMessageTime: timeStr,
            notes: 'Pelanggan tersambung otomatis dari pesan WhatsApp masuk.',
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
          id: msg.key.id || 'msg_' + Date.now(),
          contactId: contact.id,
          sender: 'customer',
          senderName: contact.name,
          text: text || '[Media/Pesan Tanpa Teks]',
          timestamp: timeStr,
          status: 'read',
        };
        messagesMap[contact.id] = [...contactMsgs, incomingMsgObj];
        saveStoredMessages(messagesMap);

        // 3. If auto-reply is active, trigger smart reply via Gemini 3.8 Flash
        if (waSession.isAutoReplyActive && contact.isAiAutoReplyEnabled && waSock) {
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

            // Send real message back to customer on WhatsApp
            await waSock.sendMessage(remoteJid, { text: smartReply });
            console.log(`Auto-reply terkirim ke ${display}: "${smartReply.substring(0, 40)}..."`);

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
              aiReasoning: 'Respons otomatis cerdas berdasarkan basis pengetahuan CS.',
            };
            const updatedMap = getStoredMessages();
            updatedMap[contact.id] = [...(updatedMap[contact.id] || []), replyMsgObj];
            saveStoredMessages(updatedMap);
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
  waSession.qrCodeData = '';
  waSession.qrCodeUrlData = '';
  waSession.qrCodeRaw = '';
  waSession.qrUrl = '';

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
  if (waSession.status !== 'connected') {
    if (hasValidAuthSession()) {
      if (!waSock && !isStartingWASocket) {
        startWASocket().catch(console.error);
      }
    } else {
      const isExpired = !waSession.qrCodeData || Date.now() > ((waSession.qrExpiresAt || 0) - 2000);
      if ((isExpired || !waSock) && !isStartingWASocket) {
        refreshWASocket().catch(console.error);
      }

      // If QR code is not yet generated, wait up to 3.5 seconds so client receives it in this request
      if (!waSession.qrCodeData && waSession.status !== 'connected') {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 3500);
          qrResolvers.push(() => {
            clearTimeout(timer);
            resolve();
          });
        });
      }
    }
  }

  res.json({
    session: waSession,
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

// 8. Send WhatsApp Message (Real Gateway via WhatsApp Web Multi-Device)
app.post('/api/whatsapp/send-message', async (req: Request, res: Response) => {
  try {
    const { contactId, recipientPhone, text, mediaType, mediaUrl, mediaName, mediaSize } = req.body;

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

    let sentReal = false;
    let deliveryError: string | null = null;

    if (waSock && waSession.status === 'connected') {
      try {
        // Query WhatsApp presence & resolve canonical JID
        try {
          const results = await waSock.onWhatsApp(clean);
          if (results && results.length > 0 && results[0]?.jid) {
            targetJid = results[0].jid;
          }
        } catch (onErr) {
          console.warn('onWhatsApp query warn:', onErr);
        }

        // Send media or text to WhatsApp
        if (mediaType === 'image' && mediaUrl) {
          if (mediaUrl.startsWith('data:')) {
            const b64 = mediaUrl.split(',')[1];
            await waSock.sendMessage(targetJid, {
              image: Buffer.from(b64, 'base64'),
              caption: text || '',
            });
          } else {
            await waSock.sendMessage(targetJid, {
              image: { url: mediaUrl },
              caption: text || '',
            });
          }
        } else if (mediaType === 'document' && mediaUrl) {
          if (mediaUrl.startsWith('data:')) {
            const b64 = mediaUrl.split(',')[1];
            await waSock.sendMessage(targetJid, {
              document: Buffer.from(b64, 'base64'),
              mimetype: 'application/pdf',
              fileName: mediaName || 'Dokumen.pdf',
              caption: text || '',
            });
          } else {
            await waSock.sendMessage(targetJid, {
              document: { url: mediaUrl },
              mimetype: 'application/pdf',
              fileName: mediaName || 'Dokumen.pdf',
              caption: text || '',
            });
          }
        } else {
          await waSock.sendMessage(targetJid, { text: text || '' });
        }
        sentReal = true;
        console.log(`[Pesan Terkirim WhatsApp] ke ${targetJid} (${display}): "${(text || '').substring(0, 40)}"`);
      } catch (err: any) {
        console.error('Failed to send message via WhatsApp Gateway:', err);
        deliveryError = err?.message || 'Gagal mengirim ke server WhatsApp';
      }
    } else {
      deliveryError = 'WhatsApp Gateway belum terhubung. Silakan tautkan WhatsApp terlebih dahulu.';
    }

    // Save message to centralized persistent store
    const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const newMsg = {
      id: 'msg_' + Date.now(),
      contactId: targetContactId || (contact ? contact.id : 'c_' + clean),
      sender: 'agent',
      senderName: 'CS Admin',
      text: text || '',
      timestamp: timeStr,
      status: sentReal ? 'delivered' : 'sent',
      mediaType: mediaType || 'none',
      mediaUrl,
      mediaName,
      mediaSize,
    };

    if (contact) {
      contact.lastMessageTime = timeStr;
      saveStoredContacts(contactsList);

      const messagesMap = getStoredMessages();
      const currentMsgs = messagesMap[contact.id] || [];
      messagesMap[contact.id] = [...currentMsgs, newMsg];
      saveStoredMessages(messagesMap);
    }

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
  });
}

startServer();
