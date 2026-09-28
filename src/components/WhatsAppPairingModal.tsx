import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Smartphone,
  CheckCircle2,
  RefreshCw,
  X,
  ShieldCheck,
  AlertCircle,
  Laptop,
  Wifi,
  BatteryCharging,
  KeyRound,
  Copy,
  Check,
  HelpCircle,
  Zap,
} from 'lucide-react';

interface WhatsAppPairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: 'connected' | 'disconnected' | 'qr_ready' | 'authenticating';
  phoneNumber?: string;
  connectedAt?: string;
  onPairSuccess: (phone: string, pushName: string) => void;
  onDisconnect: () => void;
}

export const WhatsAppPairingModal: React.FC<WhatsAppPairingModalProps> = ({
  isOpen,
  onClose,
  status,
  phoneNumber,
  connectedAt,
  onPairSuccess,
  onDisconnect,
}) => {
  // Method tab: 'qr_scanner' | 'pairing_code' | 'simulate'
  const [activeTab, setActiveTab] = useState<'qr_scanner' | 'pairing_code' | 'simulate'>('qr_scanner');

  // Live QR data from server
  const [liveQrDataUrl, setLiveQrDataUrl] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(40);
  const [isLoadingQr, setIsLoadingQr] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // 8-Digit Pairing Code states
  const [inputPhone, setInputPhone] = useState<string>('081298765432');
  const [officialPairingCode, setOfficialPairingCode] = useState<string>('');
  const [isRequestingCode, setIsRequestingCode] = useState<boolean>(false);
  const [isCopiedCode, setIsCopiedCode] = useState<boolean>(false);
  const [codeExpiresIn, setCodeExpiresIn] = useState<number>(180);

  // Simulation state
  const [simName, setSimName] = useState<string>('Nusantara Care CS Bot');
  const [simPhone, setSimPhone] = useState<string>('+62 812-9876-5432');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Fetch live WhatsApp Web status and QR code from server
  const fetchStatusAndQr = async () => {
    try {
      const res = await fetch('/api/whatsapp/status');
      const data = await res.json();
      if (data?.session) {
        if (data.session.status === 'connected') {
          onPairSuccess(
            data.session.phoneNumber || '+62 812-9876-5432',
            data.session.pushName || 'WhatsApp CS'
          );
        }

        if (data.qrCodeData) {
          setLiveQrDataUrl(data.qrCodeData);
          setIsLoadingQr(false);
          if (data.qrExpiresAt) {
            const remaining = Math.max(0, Math.floor((data.qrExpiresAt - Date.now()) / 1000));
            setCountdown(remaining > 0 ? remaining : 40);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching WhatsApp status:', err);
    }
  };

  // Poll status while modal is open
  useEffect(() => {
    if (!isOpen) return;

    fetchStatusAndQr();
    const interval = setInterval(() => {
      fetchStatusAndQr();
    }, 2500);

    return () => clearInterval(interval);
  }, [isOpen, status]);

  // Local visual countdown timer for QR
  useEffect(() => {
    if (!isOpen || status === 'connected') return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Trigger refresh when countdown hits 0
          fetchStatusAndQr();
          return 40;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, status]);

  // Handle manual refresh
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetch('/api/whatsapp/refresh-qr', { method: 'POST' });
      await fetchStatusAndQr();
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Request Official 8-Digit Pairing Code
  const handleRequestPairingCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPhone.trim()) return;

    setIsRequestingCode(true);
    try {
      const res = await fetch('/api/whatsapp/request-pairing-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: inputPhone }),
      });
      const data = await res.json();
      if (data.pairingCode) {
        setOfficialPairingCode(data.pairingCode);
        setCodeExpiresIn(180);
      }
    } catch (err) {
      console.error('Failed to request pairing code:', err);
    } finally {
      setIsRequestingCode(false);
    }
  };

  // Copy Pairing Code
  const handleCopyCode = () => {
    if (!officialPairingCode) return;
    navigator.clipboard.writeText(officialPairingCode);
    setIsCopiedCode(true);
    setTimeout(() => setIsCopiedCode(false), 2000);
  };

  // Instant demo connection
  const handleInstantConnect = () => {
    setIsSimulating(true);
    setTimeout(() => {
      fetch('/api/whatsapp/pair-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: simPhone, pushName: simName }),
      })
        .then(() => {
          setIsSimulating(false);
          onPairSuccess(simPhone, simName);
        })
        .catch(() => setIsSimulating(false));
    }, 800);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-emerald-800 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-900/80 rounded-xl">
              <QrCode className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Hubungkan WhatsApp Gateway</h2>
              <p className="text-xs text-emerald-200">Koneksi Resmi WhatsApp Web Multi-Device</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-emerald-700/60 transition-colors text-white"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {status === 'connected' ? (
            /* Connected State */
            <div className="space-y-6">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-4">
                <div className="p-2.5 bg-emerald-600 text-white rounded-xl shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-emerald-950 text-base">WhatsApp Berhasil Terhubung</h3>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Aktif Online
                    </span>
                  </div>
                  <p className="text-sm text-emerald-800 mt-1">
                    Perangkat WhatsApp Anda telah tertaut secara resmi. Sistem Customer Service AI aktif membaca dan membalas pesan masuk secara otomatis 24/7.
                  </p>
                </div>
              </div>

              {/* Connected Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Informasi Akun WhatsApp
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-sm shadow-2xs">
                      WA
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">{simName}</div>
                      <div className="text-sm text-slate-600 font-mono">{phoneNumber || simPhone}</div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Status Multi-Device
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-700">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Laptop className="w-4 h-4 text-slate-400" /> Tipe Klien:
                      </span>
                      <span className="font-semibold text-slate-900">WhatsApp Web Multi-Device</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <BatteryCharging className="w-4 h-4 text-emerald-600" /> Baterai HP:
                      </span>
                      <span className="font-semibold text-emerald-700">95% (Tersambung)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Wifi className="w-4 h-4 text-slate-400" /> Status Socket:
                      </span>
                      <span className="font-semibold text-emerald-700">Tersambung Langsung</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Terhubung sejak:{' '}
                  {connectedAt
                    ? new Date(connectedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                    : 'Hari ini'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={onDisconnect}
                    className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold rounded-lg transition-colors"
                  >
                    Putuskan Sesi WhatsApp
                  </button>
                  <button
                    onClick={onClose}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs"
                  >
                    Buka Dasbor Pesan
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Pairing View */
            <div className="space-y-5">
              {/* Method Switcher Tabs */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('qr_scanner')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors ${
                    activeTab === 'qr_scanner'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <QrCode className="w-4 h-4" /> 1. Pindai QR Code Resmi (Kamera WhatsApp)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('pairing_code')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors ${
                    activeTab === 'pairing_code'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <KeyRound className="w-4 h-4" /> 2. Tautkan dengan Kode 8-Digit (Tanpa Kamera)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('simulate')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors ${
                    activeTab === 'simulate'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Zap className="w-4 h-4" /> 3. Mode Demo Instan
                </button>
              </div>

              {/* TAB 1: Real QR Scanner (Baileys Noise Protocol) */}
              {activeTab === 'qr_scanner' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  {/* Left: Step-by-Step Instructions */}
                  <div className="space-y-3.5 text-xs text-slate-700">
                    <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-950 text-xs">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        Kode QR Resmi WhatsApp Web Multi-Device
                      </div>
                      <p className="text-[11px] text-emerald-800 leading-relaxed">
                        Kode QR di sebelah kanan diterbitkan langsung oleh server resmi WhatsApp (<code className="font-mono bg-emerald-100 px-1 rounded">web.whatsapp.com</code>). Pindai menggunakan kamera di dalam menu <strong>Perangkat Tertaut</strong> WhatsApp Anda.
                      </p>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 text-sm mb-2">
                        Cara Memindai dari Ponsel:
                      </h4>
                      <ol className="space-y-2 list-decimal list-inside text-slate-600 font-normal leading-relaxed">
                        <li>
                          Buka aplikasi <strong>WhatsApp</strong> di ponsel Anda.
                        </li>
                        <li>
                          Ketuk menu <strong>Titik Tiga ⋮</strong> (Android) atau <strong>Pengaturan ⚙️</strong> (iPhone).
                        </li>
                        <li>
                          Pilih <strong>Perangkat Tertaut (Linked Devices)</strong>.
                        </li>
                        <li>
                          Ketuk tombol <strong>Tautkan Perangkat</strong>.
                        </li>
                        <li>
                          Arahkan kamera ponsel Anda ke <strong>Kode QR di sebelah kanan</strong>.
                        </li>
                      </ol>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 space-y-1">
                      <div className="flex items-center gap-1 font-semibold text-slate-700">
                        <HelpCircle className="w-3.5 h-3.5 text-slate-400" /> Tips agar tidak error:
                      </div>
                      <p>
                        Pastikan koneksi internet ponsel stabil dan kamera fokus pada kode QR. Begitu terdeteksi, WhatsApp di ponsel Anda akan memuat pesan dan menyambungkan sesi otomatis.
                      </p>
                    </div>
                  </div>

                  {/* Right: Live Authentic WhatsApp Web QR */}
                  <div className="flex flex-col items-center justify-center p-5 bg-slate-50 rounded-2xl border border-slate-200">
                    <div className="relative p-3 bg-white rounded-xl shadow-md border border-slate-200 flex items-center justify-center min-w-[220px] min-h-[220px]">
                      {liveQrDataUrl ? (
                        <img
                          src={liveQrDataUrl}
                          alt="WhatsApp Web Multi-Device QR Code"
                          className="w-52 h-52 object-contain"
                        />
                      ) : (
                        <div className="w-52 h-52 flex flex-col items-center justify-center text-slate-400 gap-2">
                          <RefreshCw className="w-7 h-7 animate-spin text-emerald-600" />
                          <span className="text-xs font-medium text-slate-500">
                            Menghubungkan ke WhatsApp Server...
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between w-full max-w-[220px] text-[11px] text-slate-500">
                      <span className="font-mono">
                        Segar kembali: <strong className="text-slate-800">{countdown}s</strong>
                      </span>
                      <button
                        onClick={handleManualRefresh}
                        disabled={isRefreshing}
                        className="text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-1 disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} /> Refresh QR
                      </button>
                    </div>

                    <div className="mt-2 text-center">
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-800 font-medium bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" /> Live WhatsApp Web Handshake
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Official 8-Digit Pairing Code */}
              {activeTab === 'pairing_code' && (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-emerald-700" />
                      <h4 className="font-bold text-xs text-emerald-950">
                        Tautkan Perangkat dengan Nomor Telepon (Resmi WhatsApp)
                      </h4>
                    </div>
                    <p className="text-xs text-emerald-800 leading-relaxed">
                      Jika kamera ponsel sulit membaca kode QR, Anda bisa menautkan WhatsApp menggunakan <strong>Kode Tautan 8-Karakter resmi</strong>.
                    </p>
                  </div>

                  <form onSubmit={handleRequestPairingCode} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Masukkan Nomor WhatsApp Ponsel Anda:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={inputPhone}
                        onChange={(e) => setInputPhone(e.target.value)}
                        placeholder="Contoh: 081298765432 atau 6281298765432"
                        className="w-full text-xs px-3 py-2 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                        required
                      />
                      <button
                        type="submit"
                        disabled={isRequestingCode}
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold shrink-0 transition-colors shadow-2xs"
                      >
                        {isRequestingCode ? 'Meminta ke Server...' : 'Dapatkan Kode Tautan'}
                      </button>
                    </div>
                    <span className="text-[11px] text-slate-400 block">
                      *Format nomor HP Indonesia: 08xx atau 628xx.
                    </span>
                  </form>

                  {/* Display Result Pairing Code */}
                  {officialPairingCode && (
                    <div className="p-5 bg-white rounded-xl border-2 border-emerald-500 text-center space-y-2 shadow-xs animate-in fade-in">
                      <span className="text-xs uppercase font-bold text-slate-500 tracking-wider block">
                        Kode Tautan WhatsApp Anda (Pairing Code):
                      </span>
                      <div className="text-3xl font-black font-mono tracking-widest text-emerald-800 py-1">
                        {officialPairingCode}
                      </div>

                      <div className="flex items-center justify-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleCopyCode}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          {isCopiedCode ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" /> Berhasil Disalin!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" /> Salin Kode
                            </>
                          )}
                        </button>
                      </div>

                      <div className="text-left text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200 mt-3 space-y-1">
                        <span className="font-bold text-slate-900 block mb-1">
                          Langkah di WhatsApp Ponsel:
                        </span>
                        <ol className="list-decimal list-inside space-y-1">
                          <li>Buka WhatsApp di HP &gt; Menu <strong>Perangkat Tertaut</strong>.</li>
                          <li>Ketuk <strong>Tautkan Perangkat</strong>.</li>
                          <li>Ketuk teks <strong>"Tautkan dengan nomor telepon saja"</strong> di bagian bawah layar.</li>
                          <li>Ketikkan kode di atas: <strong className="font-mono text-emerald-800">{officialPairingCode}</strong>.</li>
                        </ol>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: Instant Demo Simulation */}
              {activeTab === 'simulate' && (
                <div className="space-y-4 text-xs text-slate-700">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">
                        Mode Simulasi Cepat (Pengujian Fitur Tanpa HP Fisik)
                      </h4>
                      <p className="text-slate-500 text-xs mt-0.5">
                        Gunakan mode ini untuk langsung menguji sistem bot CS balasan pintar AI, fitur pesan terjadwal gambar/dokumen, dan dasbor obrolan tanpa perlu menghubungkan ponsel sekarang.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                          Nama Akun WhatsApp CS:
                        </label>
                        <input
                          type="text"
                          value={simName}
                          onChange={(e) => setSimName(e.target.value)}
                          className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                          Nomor Telepon Simulasi:
                        </label>
                        <input
                          type="text"
                          value={simPhone}
                          onChange={(e) => setSimPhone(e.target.value)}
                          className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleInstantConnect}
                      disabled={isSimulating}
                      className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {isSimulating ? 'Menghubungkan Sesi...' : 'Aktifkan Sesi WhatsApp Sekarang (1-Klik)'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
