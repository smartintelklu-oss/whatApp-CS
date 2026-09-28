import React from 'react';
import {
  MessageSquare,
  Calendar,
  BookOpen,
  BarChart3,
  QrCode,
  Zap,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

interface HeaderNavbarProps {
  activeTab: 'inbox' | 'scheduled' | 'knowledge' | 'analytics';
  onTabChange: (tab: 'inbox' | 'scheduled' | 'knowledge' | 'analytics') => void;
  waStatus: 'connected' | 'disconnected' | 'qr_ready' | 'authenticating';
  phoneNumber?: string;
  isAutoReplyActive: boolean;
  onToggleAutoReply: () => void;
  onOpenPairingModal: () => void;
  onOpenSimulatorModal: () => void;
  totalUnread: number;
}

export const HeaderNavbar: React.FC<HeaderNavbarProps> = ({
  activeTab,
  onTabChange,
  waStatus,
  phoneNumber,
  isAutoReplyActive,
  onToggleAutoReply,
  onOpenPairingModal,
  onOpenSimulatorModal,
  totalUnread,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 z-30 shrink-0">
      {/* Top Bar */}
      <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between border-b border-slate-100">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-xs">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm sm:text-base text-slate-900 tracking-tight">
                WhatsApp CS Smart Automator
              </span>
              <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                AI Powered
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              Layanan Pelanggan Otomatis & Balasan Pintar Terjadwal
            </p>
          </div>
        </div>

        {/* Right Status Badges & Controls */}
        <div className="flex items-center gap-2.5">
          {/* WhatsApp Connection Status Badge Button */}
          <button
            onClick={onOpenPairingModal}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors border ${
              waStatus === 'connected'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
            }`}
            title="Klik untuk melihat status koneksi perangkat atau scan QR"
          >
            {waStatus === 'connected' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="hidden sm:inline">WA Terhubung:</span>
                <span className="font-mono text-[11px]">{phoneNumber || '+62 812-9876-5432'}</span>
              </>
            ) : (
              <>
                <QrCode className="w-3.5 h-3.5 text-amber-600" />
                <span>Pindai QR WhatsApp</span>
              </>
            )}
          </button>

          {/* Master Auto-Reply Switch */}
          <button
            onClick={onToggleAutoReply}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
              isAutoReplyActive
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
            }`}
            title="Saklar Utama Balasan Pintar AI Otomatis"
          >
            <Zap className={`w-3.5 h-3.5 ${isAutoReplyActive ? 'text-amber-300' : 'text-slate-400'}`} />
            <span>AI Bot: {isAutoReplyActive ? 'Aktif' : 'Nonaktif'}</span>
          </button>

          {/* Simulate Message Button */}
          <button
            onClick={onOpenSimulatorModal}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
            title="Simulasikan pesan masuk dari WhatsApp pelanggan"
          >
            <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline">Simulasi Pesan</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="px-4 sm:px-6 flex items-center gap-1 overflow-x-auto no-scrollbar">
        <button
          onClick={() => onTabChange('inbox')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors shrink-0 ${
            activeTab === 'inbox'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Dasbor Percakapan</span>
          {totalUnread > 0 && (
            <span className="px-1.5 py-0.2 bg-emerald-600 text-white rounded-full text-[10px] font-bold">
              {totalUnread}
            </span>
          )}
        </button>

        <button
          onClick={() => onTabChange('scheduled')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors shrink-0 ${
            activeTab === 'scheduled'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Pesan Terjadwal (Gambar & Dokumen)</span>
        </button>

        <button
          onClick={() => onTabChange('knowledge')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors shrink-0 ${
            activeTab === 'knowledge'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Knowledge Base & Persona AI</span>
        </button>

        <button
          onClick={() => onTabChange('analytics')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors shrink-0 ${
            activeTab === 'analytics'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Analitik & Log CS</span>
        </button>
      </div>
    </header>
  );
};
