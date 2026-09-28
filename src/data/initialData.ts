import { WhatsAppContact, WhatsAppMessage, ScheduledMessage, CSBotSettings } from '../types';

export const INITIAL_CONTACTS: WhatsAppContact[] = [
  {
    id: 'c1',
    name: 'Budi Santoso',
    phone: '+62 812-4455-6677',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    unreadCount: 1,
    tag: 'Prospek',
    lastMessageTime: 'Baru saja',
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

export const INITIAL_MESSAGES: Record<string, WhatsAppMessage[]> = {
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
      text: 'Halo Kak Siti Rahmayanti, mohon maaf sekali atas ketidaknyamanannya terkait keterlambatan pengiriman headphone Kakak. 🙏\n\nNomor pesanan *#INV-9821* sudah kami teruskan langsung ke tim logistik ekspedisi untuk dipercepat status pengantarannya hari ini. Kami akan infokan update nomor resi live begitu kurir jalan ya Kak.',
      timestamp: '10:42',
      status: 'read',
      isAiGenerated: true,
      aiIntent: 'keluhan_pengiriman',
      aiConfidence: 0.97,
      aiReasoning: 'Mendeteksi keluhan keterlambatan ekspedisi untuk invoice #INV-9821 dengan empati dan penanganan cepat.',
    },
  ],
  c3: [
    {
      id: 'm3_1',
      contactId: 'c3',
      sender: 'customer',
      senderName: 'Hendro Wijaya',
      text: 'Pak, tolong kirimkan faktur penagihan dan katalog terbaru untuk pengadaan 10 unit charger 65W GaN.',
      timestamp: 'Kemarin 15:30',
      status: 'read',
    },
    {
      id: 'm3_2',
      contactId: 'c3',
      sender: 'agent',
      senderName: 'CS Admin',
      text: 'Siap Pak Hendro! Berikut kami lampirkan dokumen faktur resmi dan katalog produk terbaru untuk perusahaan Bapak.',
      timestamp: 'Kemarin 15:35',
      status: 'read',
      mediaType: 'document',
      mediaName: 'Faktur_Penawaran_PT_Wijaya_Tekno.pdf',
      mediaSize: '1.4 MB',
      mediaUrl: '#',
    },
  ],
  c4: [
    {
      id: 'm4_1',
      contactId: 'c4',
      sender: 'customer',
      senderName: 'Dewi Lestari',
      text: 'Halo kak, apakah pembayaran smart watch bisa cicilan 0% pakai Mandiri atau BCA?',
      timestamp: 'Kemarin 14:10',
      status: 'read',
    },
    {
      id: 'm4_2',
      contactId: 'c4',
      sender: 'bot',
      senderName: 'Asisten CS AI',
      text: 'Halo Kak Dewi! Tentu bisa sekali Kak. Kami mendukung cicilan 0% hingga 12 bulan untuk pemegang Kartu Kredit BCA, Mandiri, BNI, dan BRI. Selain itu bisa juga dengan metode QRIS dan Virtual Account otomatis Kak.',
      timestamp: 'Kemarin 14:11',
      status: 'read',
      isAiGenerated: true,
      aiIntent: 'metode_pembayaran_cicilan',
      aiConfidence: 0.96,
      aiReasoning: 'Menjelaskan opsi cicilan 0% dan metode pembayaran yang tersedia sesuai knowledge base.',
    },
  ],
  c5: [
    {
      id: 'm5_1',
      contactId: 'c5',
      sender: 'customer',
      senderName: 'Ahmad Fauzi',
      text: 'Barang pengganti sudah sampai dan berfungsi normal kak. Terima kasih atas garansi dan pelayanannya yang cepat!',
      timestamp: '23 Sep 16:00',
      status: 'read',
    },
    {
      id: 'm5_2',
      contactId: 'c5',
      sender: 'bot',
      senderName: 'Asisten CS AI',
      text: 'Alhamdulillah, senang mendengarnya Kak Ahmad! Kepuasan pelanggan adalah prioritas utama kami. Jangan ragu menghubungi kami kembali jika butuh bantuan di kemudian hari. Semoga harinya menyenangkan! ✨',
      timestamp: '23 Sep 16:01',
      status: 'read',
      isAiGenerated: true,
      aiIntent: 'apresiasi_pelanggan',
      aiConfidence: 0.99,
      aiReasoning: 'Memberikan penutup ramah atas konfirmasi garansi yang berhasil diselesaikan.',
    },
  ],
};

// Preset Scheduled Messages (Gambar & Dokumen)
export const INITIAL_SCHEDULED_MESSAGES: ScheduledMessage[] = [
  {
    id: 'sch_1',
    title: 'Flash Promo Gajian 25% + Free Ongkir',
    targetType: 'all',
    targetValue: 'Semua Kontak Pelanggan',
    messageText: '🎉 *PROMO SPESIAL GAJIAN NUSANTARA DIGITAL* 🎉\n\nDapatkan diskon hingga 25% untuk seluruh aksesoris gadget original & Free Ongkir ke seluruh wilayah Indonesia! Berlaku s/d akhir bulan ini.\n\nGunakan kode voucher: *GAJIANHEMAT25*',
    mediaType: 'image',
    mediaName: 'Banner_Promo_Gajian_2026.jpg',
    mediaUrl: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&auto=format&fit=crop&q=80',
    mediaSize: '480 KB',
    scheduledTime: new Date(Date.now() + 3600000 * 2).toISOString(), // 2 hours from now
    status: 'pending',
    sentCount: 0,
    totalRecipients: 420,
    createdAt: new Date().toISOString(),
    repeat: 'none',
  },
  {
    id: 'sch_2',
    title: 'E-Katalog Resmi Gadget & Audio Q4',
    targetType: 'tag',
    targetValue: 'Prospek',
    messageText: 'Halo Kak! Terlampir adalah *E-Katalog Resmi Q4 Toko Nusantara Digital* berisi daftar spesifikasi lengkap, harga khusus, dan panduan klaim garansi resmi 2 tahun.\n\nSilakan diunduh untuk referensi Kakak.',
    mediaType: 'document',
    mediaName: 'Katalog_Resmi_Gadget_Nusantara_Q4.pdf',
    mediaSize: '2.8 MB',
    scheduledTime: new Date(Date.now() + 3600000 * 6).toISOString(),
    status: 'pending',
    sentCount: 0,
    totalRecipients: 85,
    createdAt: new Date().toISOString(),
    repeat: 'weekly',
  },
  {
    id: 'sch_3',
    title: 'Reminder Tindak Lanjut Layanan & Kepuasan',
    targetType: 'tag',
    targetValue: 'VIP',
    messageText: 'Yth. Pelanggan Setia Nusantara Digital,\n\nTerima kasih atas kepercayaan Anda bertransaksi bersama kami. Kami senantiasa berkomitmen menghadirkan layanan purna jual terbaik. Butuh bantuan pesanan korporat? CS Prioritas siap melayani.',
    mediaType: 'none',
    scheduledTime: new Date(Date.now() - 3600000 * 24).toISOString(),
    status: 'sent',
    sentCount: 45,
    totalRecipients: 45,
    createdAt: new Date(Date.now() - 3600000 * 26).toISOString(),
    repeat: 'none',
  },
];

export const INITIAL_BOT_SETTINGS: CSBotSettings = {
  isAutoReplyActive: true,
  botTone: 'ramah_sopan',
  botName: 'Nusantara CS AI Assistant',
  responseDelaySec: 2,
  outOfHoursOnly: false,
  notifyHumanOnEscalation: true,
  knowledgeBase: `
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
`,
};

export const QUICK_REPLY_TEMPLATES = [
  {
    title: 'Sapaan Ramah',
    text: 'Halo Kak! Terima kasih sudah menghubungi layanan pelanggan Toko Nusantara Digital. Ada yang bisa kami bantu seputar produk atau pesanan Anda hari ini? 😊',
  },
  {
    title: 'Info Rekening Pembayaran',
    text: 'Untuk pembayaran resmi dapat ditransfer melalui:\n• BCA: 8830-192-881 a/n PT Nusantara Digital Hub\n• Mandiri: 137-00-9988112-0 a/n PT Nusantara Digital Hub\nAtau scan QRIS resmi toko kami. Mohon kirimkan bukti transfer setelah pembayaran ya Kak!',
  },
  {
    title: 'Katalog Produk & Garansi',
    text: 'Semua produk kami 100% Original dan bergaransi resmi. Kami juga menyediakan fasilitas tukar baru 7 hari jika ditemukan kendala pabrik. Katalog lengkap bisa dicek pada dokumen yang kami lampirkan ya Kak.',
  },
  {
    title: 'Jam Buka & Operasional',
    text: 'Layanan pelanggan dan pengiriman kami beroperasi setiap hari Senin s/d Minggu pukul 08.00 - 21.00 WIB. Pesanan sebelum pukul 15.00 WIB dikirim pada hari yang sama.',
  },
  {
    title: 'Eskalasi ke Agen Manusia',
    text: 'Baik Kak, pesan Kakak sudah kami catat dan saat ini sedang kami hubungkan ke Agen CS Senior kami untuk penanganan lebih lanjut secara langsung. Mohon tunggu sebentar ya Kak.',
  },
];
