import React from 'react';
import {
  BarChart3,
  MessageSquare,
  Bot,
  Clock,
  ThumbsUp,
  TrendingUp,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { ScheduledMessage, WhatsAppContact } from '../types';

interface AnalyticsOverviewProps {
  contacts: WhatsAppContact[];
  scheduledMessages: ScheduledMessage[];
  totalAutoReplies: number;
}

export const AnalyticsOverview: React.FC<AnalyticsOverviewProps> = ({
  contacts,
  scheduledMessages,
  totalAutoReplies,
}) => {
  const stats = [
    {
      label: 'Total Pesan Pelanggan',
      value: '1,482',
      sub: '+18.4% minggu ini',
      icon: MessageSquare,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Balasan Pintar AI Terkirim',
      value: `${860 + totalAutoReplies}`,
      sub: '88.5% diselesaikan otomatis',
      icon: Bot,
      color: 'text-emerald-600 bg-emerald-50',
    },
    {
      label: 'Waktu Respon Rata-rata',
      value: '2.4 detik',
      sub: 'Tanpa jeda antrean manual',
      icon: Clock,
      color: 'text-amber-600 bg-amber-50',
    },
    {
      label: 'Tingkat Kepuasan (CSAT)',
      value: '4.9 / 5.0',
      sub: 'Berdasarkan 340 rating',
      icon: ThumbsUp,
      color: 'text-purple-600 bg-purple-50',
    },
  ];

  const intentBreakdown = [
    { label: 'Tanya Produk, Spesifikasi & Stok', percentage: 38, count: 563, color: 'bg-emerald-500' },
    { label: 'Cek Ongkir, Ekspedisi & Status Resi', percentage: 24, count: 355, color: 'bg-blue-500' },
    { label: 'Metode Pembayaran, QRIS & Cicilan', percentage: 18, count: 266, color: 'bg-purple-500' },
    { label: 'Klaim Garansi & Prosedur Retur', percentage: 12, count: 178, color: 'bg-amber-500' },
    { label: 'Sapaan & Pertanyaan Jam Kerja Toko', percentage: 8, count: 120, color: 'bg-slate-400' },
  ];

  const recentLogs = [
    {
      time: 'Baru saja',
      type: 'ai_reply',
      title: 'Smart Auto-Reply ke Budi Santoso',
      desc: 'Menjawab ketersediaan stok Smartphone Pro Max Deep Black dan garansi 1 tahun.',
    },
    {
      time: '12 menit lalu',
      type: 'scheduled',
      title: 'Pesan Terjadwal Divalidasi',
      desc: 'Kampanye "Flash Promo Gajian 25%" siap dieksekusi untuk 420 kontak.',
    },
    {
      time: '35 menit lalu',
      type: 'ai_reply',
      title: 'Penanganan Keluhan Resi ke Siti Rahma',
      desc: 'Mendeteksi intent keterlambatan ekspedisi J&T dan otomatis meneruskan ke tim logistik.',
    },
    {
      time: '1 jam lalu',
      type: 'manual',
      title: 'Lampiran Dokumen Dikirim oleh CS Agen',
      desc: 'Faktur_Penawaran_PT_Wijaya_Tekno.pdf terkirim ke Hendro Wijaya (VIP).',
    },
    {
      time: '2 jam lalu',
      type: 'ai_reply',
      title: 'Smart Auto-Reply ke Dewi Lestari',
      desc: 'Menjelaskan opsi cicilan 0% 12 bulan BCA/Mandiri.',
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-y-auto">
      {/* Header */}
      <div className="px-8 py-6 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 uppercase tracking-wider">
            <BarChart3 className="w-4 h-4" /> Kinerja Layanan Pelanggan
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Dasbor Analitik & Log WhatsApp CS
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Pantau efektivitas balasan pintar otomatis, waktu penanganan pesan, dan distribusi topik pertanyaan pelanggan.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto w-full px-8 py-6 space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((st, i) => {
            const Icon = st.icon;
            return (
              <div
                key={i}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-500">{st.label}</span>
                  <div className={`p-2 rounded-xl ${st.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900 leading-none">
                    {st.value}
                  </div>
                  <div className="text-xs text-emerald-700 font-medium mt-1.5 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> {st.sub}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 2 Cols: Intent Distribution & Recent Activity Logs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Intent Distribution */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                Distribusi Topik & Intent Pelanggan
              </h3>
              <span className="text-[11px] text-slate-400">30 Hari Terakhir</span>
            </div>

            <div className="space-y-3.5">
              {intentBreakdown.map((item, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800">{item.label}</span>
                    <span className="text-slate-500 font-mono">
                      {item.count} pesan ({item.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.color}`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-xs text-emerald-900 flex items-center gap-2 mt-4">
              <Zap className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Gemini AI berhasil mengenali dan menjawab <strong>92.8%</strong> pertanyaan katalog dan stok tanpa eskalasi manual.
              </span>
            </div>
          </div>

          {/* Audit Log / Real-time Activities */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                Log Aktivitas Layanan Pelanggan Real-Time
              </h3>
              <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Live Stream
              </span>
            </div>

            <div className="space-y-3">
              {recentLogs.map((log, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-slate-100 bg-slate-50/60 flex items-start gap-3"
                >
                  <div className="mt-0.5">
                    {log.type === 'ai_reply' && (
                      <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                    )}
                    {log.type === 'scheduled' && (
                      <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                        <Calendar className="w-3.5 h-3.5" />
                      </div>
                    )}
                    {log.type === 'manual' && (
                      <div className="p-1.5 bg-purple-100 text-purple-700 rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-slate-900 truncate">
                        {log.title}
                      </h4>
                      <span className="text-[10px] text-slate-400">{log.time}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      {log.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
