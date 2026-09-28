import React, { useState, useRef } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Image as ImageIcon,
  FileText,
  Send,
  CheckCircle2,
  Trash2,
  AlertCircle,
  Users,
  Repeat,
  Sparkles,
  Download,
  Eye,
  X,
  Upload,
  FolderOpen,
  Camera,
} from 'lucide-react';
import { ScheduledMessage, WhatsAppContact } from '../types';

interface ScheduledMessagesViewProps {
  scheduledMessages: ScheduledMessage[];
  contacts: WhatsAppContact[];
  onAddSchedule: (schedule: Omit<ScheduledMessage, 'id' | 'createdAt' | 'sentCount' | 'status'>) => void;
  onDeleteSchedule: (id: string) => void;
  onInstantTrigger: (schedule: ScheduledMessage) => void;
}

const PRESET_MEDIA_IMAGES = [
  {
    title: 'Banner Promo Gajian Hemat 25%',
    url: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&auto=format&fit=crop&q=80',
    name: 'Banner_Gajian_Hemat_25.jpg',
    size: '480 KB',
  },
  {
    title: 'Poster Peluncuran Smartphone Pro Max',
    url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&auto=format&fit=crop&q=80',
    name: 'Poster_Smartphone_Pro_Max.jpg',
    size: '620 KB',
  },
  {
    title: 'Audio Noise Cancelling Showcase',
    url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
    name: 'Headphones_Wireless_ANC.jpg',
    size: '510 KB',
  },
];

const PRESET_MEDIA_DOCS = [
  {
    title: 'E-Katalog Resmi Gadget & Audio Q4',
    name: 'Katalog_Resmi_Nusantara_Q4.pdf',
    size: '2.8 MB',
    url: '#',
  },
  {
    title: 'Daftar Harga Grosir & Pricelist Korporat',
    name: 'Pricelist_B2B_Nusantara_Digital.pdf',
    size: '1.2 MB',
    url: '#',
  },
  {
    title: 'Buku Panduan Garansi & Pusat Servis Resmi',
    name: 'Panduan_Klaim_Garansi_32Kota.pdf',
    size: '850 KB',
    url: '#',
  },
];

export const ScheduledMessagesView: React.FC<ScheduledMessagesViewProps> = ({
  scheduledMessages,
  contacts,
  onAddSchedule,
  onDeleteSchedule,
  onInstantTrigger,
}) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'sent'>('all');

  // Form states
  const [title, setTitle] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'tag' | 'single'>('all');
  const [targetValue, setTargetValue] = useState('Semua Kontak');
  const [messageText, setMessageText] = useState('');
  const [mediaType, setMediaType] = useState<'none' | 'image' | 'document'>('image');
  const [mediaUrl, setMediaUrl] = useState<string | undefined>(PRESET_MEDIA_IMAGES[0].url);
  const [mediaName, setMediaName] = useState<string | undefined>(PRESET_MEDIA_IMAGES[0].name);
  const [mediaSize, setMediaSize] = useState<string | undefined>(PRESET_MEDIA_IMAGES[0].size);
  const [scheduledDateTime, setScheduledDateTime] = useState(() => {
    const d = new Date(Date.now() + 3600000 * 2);
    return d.toISOString().slice(0, 16);
  });
  const [repeat, setRepeat] = useState<'none' | 'daily' | 'weekly'>('none');
  const [totalRecipients, setTotalRecipients] = useState(120);

  // File input refs for opening device gallery / file manager
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  // Handle image selected from device gallery / camera
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formattedSize =
      file.size > 1024 * 1024
        ? (file.size / (1024 * 1024)).toFixed(1) + ' MB'
        : Math.round(file.size / 1024) + ' KB';

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setMediaType('image');
        setMediaUrl(event.target.result as string);
        setMediaName(file.name);
        setMediaSize(formattedSize);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Handle document selected from device storage
  const handleDocumentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formattedSize =
      file.size > 1024 * 1024
        ? (file.size / (1024 * 1024)).toFixed(1) + ' MB'
        : Math.round(file.size / 1024) + ' KB';

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setMediaType('document');
        setMediaUrl(event.target.result as string);
        setMediaName(file.name);
        setMediaSize(formattedSize);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleOpenCreateModal = () => {
    // Reset to sensible defaults
    setTitle('Promo Spesial Weekend & Free Ongkir');
    setTargetType('all');
    setTargetValue('Semua Kontak Pelanggan');
    setTotalRecipients(contacts.length > 0 ? contacts.length * 25 : 150);
    setMessageText(
      '🎉 *PROMO SPESIAL AKHIR PEKAN!* 🎉\n\nDapatkan ekstra cashback hingga 15% dan gratis ongkir ke seluruh Indonesia. Gunakan voucher *WEEKENDHEMAT* saat checkout.\n\nHubungi CS kami jika butuh bantuan pemesanan!'
    );
    setMediaType('image');
    setMediaUrl(PRESET_MEDIA_IMAGES[0].url);
    setMediaName(PRESET_MEDIA_IMAGES[0].name);
    setMediaSize(PRESET_MEDIA_IMAGES[0].size);
    setIsCreateModalOpen(true);
  };

  const handleTargetTypeChange = (type: 'all' | 'tag' | 'single') => {
    setTargetType(type);
    if (type === 'all') {
      setTargetValue('Semua Kontak Pelanggan');
      setTotalRecipients(450);
    } else if (type === 'tag') {
      setTargetValue('Prospek');
      setTotalRecipients(85);
    } else {
      setTargetValue('+62 812-4455-6677');
      setTotalRecipients(1);
    }
  };

  // Trigger opening device gallery directly when selecting "Pilih Gambar"
  const handleSelectImageMedia = () => {
    setMediaType('image');
    // Immediate synchronous call to open native device gallery / file picker
    imageInputRef.current?.click();
  };

  // Trigger opening device document picker directly
  const handleSelectDocumentMedia = () => {
    setMediaType('document');
    documentInputRef.current?.click();
  };

  // Text-only mode
  const handleSelectNoneMedia = () => {
    setMediaType('none');
    setMediaUrl(undefined);
    setMediaName(undefined);
    setMediaSize(undefined);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !messageText.trim()) return;

    onAddSchedule({
      title: title.trim(),
      targetType,
      targetValue,
      messageText: messageText.trim(),
      mediaType,
      mediaUrl: mediaType !== 'none' ? mediaUrl : undefined,
      mediaName: mediaType !== 'none' ? mediaName : undefined,
      mediaSize: mediaType !== 'none' ? mediaSize : undefined,
      scheduledTime: new Date(scheduledDateTime).toISOString(),
      totalRecipients,
      repeat,
    });

    setIsCreateModalOpen(false);
  };

  const filteredMessages = scheduledMessages.filter((msg) => {
    if (filterTab === 'pending') return msg.status === 'pending';
    if (filterTab === 'sent') return msg.status === 'sent';
    return true;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-y-auto">
      {/* Top Banner / Actions */}
      <div className="px-8 py-6 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 uppercase tracking-wider">
              <Calendar className="w-4 h-4" /> Pengiriman Otomatis Terjadwal
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">
              Jadwal Pesan & Broadcast WhatsApp
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Kirim promosi, katalog, faktur tagihan, gambar, atau dokumen PDF secara otomatis pada waktu yang ditentukan.
            </p>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" /> Buat Pesan Terjadwal Baru
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto w-full px-8 py-6 space-y-6">
        {/* Filter Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 p-1 bg-slate-200/80 rounded-lg">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filterTab === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua Jadwal ({scheduledMessages.length})
            </button>
            <button
              onClick={() => setFilterTab('pending')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filterTab === 'pending'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Menunggu Pengiriman ({scheduledMessages.filter((m) => m.status === 'pending').length})
            </button>
            <button
              onClick={() => setFilterTab('sent')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filterTab === 'sent'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Riwayat Terkirim ({scheduledMessages.filter((m) => m.status === 'sent').length})
            </button>
          </div>

          <div className="text-xs text-slate-500">
            Dikelola dengan WhatsApp Cloud API Worker
          </div>
        </div>

        {/* Scheduled List Cards */}
        {filteredMessages.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800">Belum Ada Pesan Terjadwal</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
              Jadwalkan pesan otomatis berupa gambar promo atau dokumen PDF untuk pelanggan Anda sekarang.
            </p>
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors"
            >
              + Buat Jadwal Baru
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredMessages.map((item) => {
              const isPast = new Date(item.scheduledTime).getTime() <= Date.now();
              const scheduledDateFormatted = new Date(item.scheduledTime).toLocaleString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between hover:border-slate-300 transition-all"
                >
                  <div className="p-5">
                    {/* Top Row: Tag & Status */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-900">
                            {item.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.targetValue}</span>
                          <span aria-hidden="true">·</span>
                          <span>{item.totalRecipients} Penerima</span>
                        </div>
                      </div>

                      {item.status === 'sent' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Terkirim
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                          <Clock className="w-3.5 h-3.5" /> Menunggu Jadwal
                        </span>
                      )}
                    </div>

                    {/* Media Attachment Badge/Preview */}
                    {item.mediaType === 'image' && item.mediaUrl && (
                      <div className="mb-3 rounded-xl overflow-hidden border border-slate-200 relative group max-h-40 bg-slate-100">
                        <img
                          src={item.mediaUrl}
                          alt={item.mediaName || 'Media'}
                          className="w-full h-36 object-cover"
                        />
                        <div className="absolute bottom-2 left-2 right-2 bg-black/60 backdrop-blur-xs text-white text-[11px] px-2 py-1 rounded-md flex items-center justify-between">
                          <span className="flex items-center gap-1 truncate">
                            <ImageIcon className="w-3 h-3" /> {item.mediaName}
                          </span>
                          <span className="text-slate-300 shrink-0">{item.mediaSize}</span>
                        </div>
                      </div>
                    )}

                    {item.mediaType === 'document' && (
                      <div className="mb-3 p-3 bg-red-50/70 border border-red-200 rounded-xl flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 truncate">
                          <div className="p-2 bg-red-600 text-white rounded-lg">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="truncate">
                            <div className="text-xs font-semibold text-slate-900 truncate">
                              {item.mediaName}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Dokumen PDF Resmi · {item.mediaSize}
                            </div>
                          </div>
                        </div>
                        <span className="text-xs font-medium text-red-700 bg-white px-2 py-1 rounded border border-red-200 shrink-0">
                          PDF
                        </span>
                      </div>
                    )}

                    {/* Message Preview Text */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700 line-clamp-3 whitespace-pre-wrap font-sans">
                      {item.messageText}
                    </div>

                    {/* Schedule Timing info */}
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Waktu: <strong className="text-slate-800">{scheduledDateFormatted}</strong></span>
                      </div>
                      {item.repeat !== 'none' && (
                        <div className="flex items-center gap-1 text-slate-600">
                          <Repeat className="w-3 h-3 text-emerald-600" />
                          <span className="capitalize">{item.repeat === 'daily' ? 'Harian' : 'Mingguan'}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">
                      {item.status === 'sent'
                        ? `Sukses terkirim (${item.sentCount}/${item.totalRecipients})`
                        : `Otomatis dieksekusi saat jadwal tiba`}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {item.status === 'pending' && (
                        <button
                          onClick={() => onInstantTrigger(item)}
                          title="Kirim sekarang untuk pengujian cepat"
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shadow-2xs"
                        >
                          <Send className="w-3 h-3" /> Tes Kirim Sekarang
                        </button>
                      )}
                      <button
                        onClick={() => onDeleteSchedule(item.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Hapus jadwal"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Create Scheduled Message */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 my-8">
            <div className="flex items-center justify-between px-6 py-4 bg-emerald-700 text-white">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                <h2 className="font-semibold text-base">Buat Pesan WhatsApp Terjadwal</h2>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 text-white hover:bg-emerald-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Permanent hidden file inputs so ref is always mounted and ready */}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageFileChange}
              />
              <input
                ref={documentInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx"
                className="hidden"
                onChange={handleDocumentFileChange}
              />

              {/* Campaign Title */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nama Kampanye / Pengingat:
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Flash Sale Akhir Bulan & Katalog Produk"
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              {/* Target Audience */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Target Penerima Pesan:
                </label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => handleTargetTypeChange('all')}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-colors ${
                      targetType === 'all'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-semibold'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Semua Kontak
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTargetTypeChange('tag')}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-colors ${
                      targetType === 'tag'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-semibold'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Berdasarkan Tag
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTargetTypeChange('single')}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-colors ${
                      targetType === 'single'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-semibold'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Nomor Tertentu
                  </button>
                </div>

                {targetType === 'tag' && (
                  <select
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="Prospek">Segmen: Prospek (Calon Pembeli)</option>
                    <option value="Pelanggan Baru">Segmen: Pelanggan Baru</option>
                    <option value="VIP">Segmen: Pelanggan VIP / Korporat</option>
                    <option value="Komplain">Segmen: Pelanggan Butuh Follow Up</option>
                  </select>
                )}

                {targetType === 'single' && (
                  <input
                    type="text"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    placeholder="+62 812-xxxx-xxxx"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                )}
              </div>

              {/* Media Attachment Selector (Gambar atau Dokumen) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Lampiran Media (Gambar atau Dokumen):
                  </label>
                  <span className="text-[11px] text-emerald-700 font-medium">
                    {mediaType === 'image'
                      ? '📸 Mode Gambar Galeri Aktif'
                      : mediaType === 'document'
                      ? '📄 Mode Dokumen Aktif'
                      : 'Hanya Teks'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={handleSelectImageMedia}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      mediaType === 'image'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-semibold shadow-xs ring-1 ring-emerald-500'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-emerald-600" /> Pilih Gambar (Galeri)
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectDocumentMedia}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      mediaType === 'document'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-semibold shadow-xs ring-1 ring-emerald-500'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-red-600" /> Pilih Dokumen (PDF)
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectNoneMedia}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      mediaType === 'none'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-semibold shadow-xs'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Hanya Teks
                  </button>
                </div>

                {/* Image Section: Device Gallery Picker + Preview + Presets */}
                {mediaType === 'image' && (
                  <div className="space-y-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    {/* Primary Interactive Box to Open Device Gallery */}
                    <div
                      onClick={() => imageInputRef.current?.click()}
                      className="cursor-pointer flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 bg-white rounded-xl border-2 border-dashed border-emerald-400 hover:border-emerald-600 hover:bg-emerald-50/30 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <Camera className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition-colors flex items-center gap-1.5">
                            <span>Pilih Gambar dari Galeri Perangkat</span>
                            <span className="px-1.5 py-0.2 text-[10px] font-semibold bg-emerald-100 text-emerald-800 rounded">
                              Galeri
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Buka galeri ponsel / folder laptop Anda (JPG, PNG, WEBP, GIF)
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          imageInputRef.current?.click();
                        }}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-colors shrink-0 cursor-pointer"
                      >
                        <FolderOpen className="w-3.5 h-3.5" /> Buka Galeri Perangkat
                      </button>
                    </div>

                    {/* Active Selected Image Preview */}
                    {mediaUrl && (
                      <div className="p-2.5 bg-white rounded-xl border border-emerald-200 flex items-center justify-between gap-3 shadow-2xs">
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={mediaUrl}
                            alt={mediaName || 'Preview'}
                            className="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Foto dari Galeri Terpilih
                              </span>
                            </div>
                            <div className="text-xs font-bold text-slate-900 truncate mt-0.5">
                              {mediaName || 'Gambar Terpilih'}
                            </div>
                            <div className="text-[11px] text-emerald-700 font-medium">
                              Ukuran: {mediaSize || 'Foto'} · Siap Dikirim ke WhatsApp
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => imageInputRef.current?.click()}
                            className="px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <FolderOpen className="w-3 h-3" /> Ganti Foto
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMediaUrl(undefined);
                              setMediaName(undefined);
                              setMediaSize(undefined);
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                            title="Hapus gambar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Preset Banner Templates */}
                    <div className="pt-1">
                      <span className="text-[11px] font-semibold text-slate-600 block mb-1.5">
                        Atau Pilih Contoh Banner Promosi Siap Pakai:
                      </span>
                      <div className="grid grid-cols-3 gap-2">
                        {PRESET_MEDIA_IMAGES.map((img, i) => (
                          <div
                            key={i}
                            onClick={() => {
                              setMediaUrl(img.url);
                              setMediaName(img.name);
                              setMediaSize(img.size);
                            }}
                            className={`relative rounded-lg overflow-hidden border cursor-pointer group transition-all ${
                              mediaUrl === img.url
                                ? 'ring-2 ring-emerald-600 border-transparent shadow-xs'
                                : 'border-slate-200 hover:opacity-90'
                            }`}
                          >
                            <img src={img.url} alt={img.title} className="w-full h-16 object-cover" />
                            <div className="p-1 bg-white text-[10px] font-medium text-slate-800 truncate">
                              {img.title}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Document Section: Device Document Picker + Preview + Presets */}
                {mediaType === 'document' && (
                  <div className="space-y-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    {/* Primary Button to Open Device File Picker */}
                    <div
                      onClick={() => documentInputRef.current?.click()}
                      className="cursor-pointer flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white rounded-xl border-2 border-dashed border-red-300 hover:border-red-500 hover:bg-red-50/20 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-50 text-red-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 group-hover:text-red-700 transition-colors">
                            Pilih Dokumen dari Perangkat
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Buka file dari memori ponsel / laptop (PDF, Word, Excel)
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          documentInputRef.current?.click();
                        }}
                        className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-colors shrink-0 cursor-pointer"
                      >
                        <FolderOpen className="w-3.5 h-3.5" /> Buka Dokumen Perangkat
                      </button>
                    </div>

                    {/* Active Selected Document Preview */}
                    {mediaName && (
                      <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3 shadow-2xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-2 bg-red-600 text-white rounded-lg shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 truncate">
                              {mediaName}
                            </div>
                            <div className="text-[11px] text-red-700 font-medium">
                              Ukuran: {mediaSize || 'Dokumen'} · Siap Dilampirkan
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => documentInputRef.current?.click()}
                            className="px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors"
                          >
                            Ganti File
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMediaUrl(undefined);
                              setMediaName(undefined);
                              setMediaSize(undefined);
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                            title="Hapus dokumen"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Preset Document Templates */}
                    <div className="pt-1">
                      <span className="text-[11px] font-semibold text-slate-600 block mb-1.5">
                        Atau Pilih Contoh Dokumen PDF Resmi:
                      </span>
                      <div className="space-y-1.5">
                        {PRESET_MEDIA_DOCS.map((doc, i) => (
                          <div
                            key={i}
                            onClick={() => {
                              setMediaName(doc.name);
                              setMediaSize(doc.size);
                              setMediaUrl('#');
                            }}
                            className={`p-2 rounded-lg border flex items-center justify-between text-xs cursor-pointer transition-all ${
                              mediaName === doc.name
                                ? 'bg-red-50/80 border-red-400 text-red-950 font-semibold shadow-2xs'
                                : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-red-600" />
                              <span>{doc.title}</span>
                            </div>
                            <span className="text-[11px] text-slate-400">{doc.size}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Message Content */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Pesan Teks / Caption WhatsApp:
                </label>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  rows={4}
                  placeholder="Tulis pesan lengkap dengan format WhatsApp (gunakan *kata* untuk tebal)..."
                  className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans"
                  required
                />
              </div>

              {/* Schedule Timing & Repeat */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Tanggal & Jam Eksekusi:
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledDateTime}
                    onChange={(e) => setScheduledDateTime(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Pengulangan Jadwal:
                  </label>
                  <select
                    value={repeat}
                    onChange={(e) => setRepeat(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="none">Sekali Saja</option>
                    <option value="daily">Setiap Hari (Harian)</option>
                    <option value="weekly">Setiap Minggu (Mingguan)</option>
                  </select>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  <Calendar className="w-3.5 h-3.5" /> Jadwalkan Pesan Sekarang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
