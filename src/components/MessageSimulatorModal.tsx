import React, { useState } from 'react';
import { Send, Smartphone, Sparkles, X, User, MessageSquareText } from 'lucide-react';
import { WhatsAppContact } from '../types';

interface MessageSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: WhatsAppContact[];
  activeContactId: string;
  onSimulateIncoming: (contactId: string, messageText: string, customContact?: { name: string; phone: string }) => void;
}

const PRESET_SCENARIOS = [
  {
    label: 'Tanya Produk & Ketersediaan',
    category: 'Sales',
    text: 'Halo CS, apakah Smartphone Pro Max warna Deep Black masih ready stock? Ada garansi resmi berapa tahun ya?',
  },
  {
    label: 'Tanya Biaya Kirim & Ekspedisi',
    category: 'Pengiriman',
    text: 'Bisa kirim pakai Gosend Instant ke Jakarta Selatan hari ini kak? Ada promo gratis ongkir minimal belanja berapa?',
  },
  {
    label: 'Keluhan Barang & Garansi',
    category: 'Komplain',
    text: 'Halo kak, charger 65W GaN yang saya terima kemarin sepertinya tidak mengisi daya dengan cepat. Bagaimana prosedur klaim garansi tukar barunya?',
  },
  {
    label: 'Metode Pembayaran & Cicilan',
    category: 'Pembayaran',
    text: 'Apakah bisa pembayaran cicilan 0% pakai kartu kredit BCA atau Mandiri? Kalau pakai QRIS limitnya berapa?',
  },
  {
    label: 'Minta Nomor Rekening Resmi',
    category: 'Transaksi',
    text: 'Kak, saya mau langsung transfer untuk pesanan Smart Watch Fitness Edition. Minta nomor rekening BCA resmi toko ya.',
  },
  {
    label: 'Pertanyaan Alamat Toko Fisik',
    category: 'Toko',
    text: 'Apakah toko punya cabang fisik di Jakarta? Jam berapa toko buka kalau saya mau beli langsung di tempat?',
  },
];

export const MessageSimulatorModal: React.FC<MessageSimulatorModalProps> = ({
  isOpen,
  onClose,
  contacts,
  activeContactId,
  onSimulateIncoming,
}) => {
  const [selectedContactId, setSelectedContactId] = useState<string>(activeContactId || contacts[0]?.id || 'c1');
  const [customSenderMode, setCustomSenderMode] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>('Andi Pratama');
  const [customPhone, setCustomPhone] = useState<string>('+62 813-7788-9900');
  const [messageText, setMessageText] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    if (customSenderMode) {
      onSimulateIncoming('new_custom', messageText.trim(), {
        name: customName.trim() || 'Pelanggan Baru',
        phone: customPhone.trim() || '+62 812-3456-7890',
      });
    } else {
      onSimulateIncoming(selectedContactId, messageText.trim());
    }

    setMessageText('');
    onClose();
  };

  const handleApplyPreset = (presetText: string) => {
    setMessageText(presetText);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 rounded-lg text-white">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-lg leading-tight">Simulasi Pesan WhatsApp Masuk</h2>
              <p className="text-xs text-slate-300">Uji coba kemampuan respon otomatis balasan pintar AI</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors text-slate-300 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Sender Switcher */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-2">
              Pilih Pengirim Pesan (Pelanggan):
            </label>
            <div className="flex items-center gap-2 mb-3">
              <button
                type="button"
                onClick={() => setCustomSenderMode(false)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  !customSenderMode
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Kontak Tersimpan
              </button>
              <button
                type="button"
                onClick={() => setCustomSenderMode(true)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  customSenderMode
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                + Nomor Baru (Pelanggan Asing)
              </button>
            </div>

            {!customSenderMode ? (
              <select
                value={selectedContactId}
                onChange={(e) => setSelectedContactId(e.target.value)}
                className="w-full text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone}) - Tag: {c.tag}
                  </option>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">Nama Pelanggan:</label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Contoh: Maya Anggraini"
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">Nomor WhatsApp:</label>
                  <input
                    type="text"
                    value={customPhone}
                    onChange={(e) => setCustomPhone(e.target.value)}
                    placeholder="+62 8xx-xxxx-xxxx"
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Quick Preset Buttons */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Contoh Skenario Pertanyaan Pelanggan:
              </span>
              <span className="text-[11px] text-slate-400">Klik untuk isi otomatis</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_SCENARIOS.map((scenario, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(scenario.text)}
                  className="text-left p-2.5 rounded-lg border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 transition-all text-xs group"
                >
                  <div className="font-semibold text-slate-800 group-hover:text-emerald-700 truncate">
                    {scenario.label}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5">
                    {scenario.text}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Message Input */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Isi Pesan WhatsApp yang Dikirim:
            </label>
            <div className="relative">
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={3}
                placeholder="Tulis pesan dari pelanggan di sini..."
                className="w-full text-sm p-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                required
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Saat dikirim, sistem WhatsApp Web akan menangkap pesan ini dan Asisten AI akan merespons secara real-time.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={!messageText.trim()}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Send className="w-3.5 h-3.5" /> Kirim Pesan & Trigger Balasan Pintar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
