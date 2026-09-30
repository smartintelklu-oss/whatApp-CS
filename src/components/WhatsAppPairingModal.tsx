import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
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
  Radio,
  Send,
  ExternalLink,
  Globe,
  Database,
  ArrowRight,
} from 'lucide-react';

interface WhatsAppPairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: 'connected' | 'disconnected' | 'qr_ready' | 'authenticating';
  phoneNumber?: string;
  connectedAt?: string;
  gatewayProvider?: 'direct' | 'fonnte' | 'wablast';
  onPairSuccess: (phone: string, pushName: string) => void;
  onDisconnect: () => void;
}

export const WhatsAppPairingModal: React.FC<WhatsAppPairingModalProps> = ({
  isOpen,
  onClose,
  status,
  phoneNumber,
  connectedAt,
  gatewayProvider = 'direct',
  onPairSuccess,
  onDisconnect,
}) => {
  // Gateway Provider: 'fonnte' (fonnte.com) | 'wablast' (bablast.id / wablast.id) | 'direct' (WhatsApp Web Baileys)
  const [selectedGateway, setSelectedGateway] = useState<'fonnte' | 'wablast' | 'direct'>(
    gatewayProvider || 'fonnte'
  );
  const [activeGatewayProvider, setActiveGatewayProvider] = useState<'direct' | 'fonnte' | 'wablast'>(
    gatewayProvider || 'direct'
  );
  const [hasLoadedGatewayConfig, setHasLoadedGatewayConfig] = useState<boolean>(false);

  // Method tab for Direct WhatsApp Web: 'qr_scanner' | 'pairing_code' | 'simulate'
  const [activeTab, setActiveTab] = useState<'qr_scanner' | 'pairing_code' | 'simulate'>('qr_scanner');

  // Live QR data for direct Baileys
  const [liveQrDataUrl, setLiveQrDataUrl] = useState<string>('');
  const [liveQrUrlData, setLiveQrUrlData] = useState<string>('');
  const [liveQrRawData, setLiveQrRawData] = useState<string>('');
  const [qrDisplayMode, setQrDisplayMode] = useState<'scanner' | 'camera'>('scanner');
  const [countdown, setCountdown] = useState<number>(40);
  const [isLoadingQr, setIsLoadingQr] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // 8-Digit Pairing Code states
  const [inputPhone, setInputPhone] = useState<string>('081298765432');
  const [officialPairingCode, setOfficialPairingCode] = useState<string>('');
  const [isRequestingCode, setIsRequestingCode] = useState<boolean>(false);
  const [isCopiedCode, setIsCopiedCode] = useState<boolean>(false);

  // Fonnte Gateway States
  const [fonnteToken, setFonnteToken] = useState<string>('');
  const [fonnteDevice, setFonnteDevice] = useState<string>('');
  const [fonnteQuota, setFonnteQuota] = useState<string>('');
  const [isConnectingFonnte, setIsConnectingFonnte] = useState<boolean>(false);
  const [fonnteError, setFonnteError] = useState<string | null>(null);
  const [fonnteSuccess, setFonnteSuccess] = useState<string | null>(null);
  const [isCopiedFonnteWebhook, setIsCopiedFonnteWebhook] = useState<boolean>(false);

  // Fonnte Test Send Message
  const [testPhoneFonnte, setTestPhoneFonnte] = useState<string>('081298765432');
  const [isTestingFonnteSend, setIsTestingFonnteSend] = useState<boolean>(false);
  const [fonnteTestResult, setFonnteTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Bablast.id / Wablast Gateway States
  const [wablastApiUrl, setWablastApiUrl] = useState<string>('https://api.bablast.id');
  const [wablastApiKey, setWablastApiKey] = useState<string>('');
  const [wablastPhone, setWablastPhone] = useState<string>('');
  const [wablastQuota, setWablastQuota] = useState<string>('');
  const [isConnectingWablast, setIsConnectingWablast] = useState<boolean>(false);
  const [wablastError, setWablastError] = useState<string | null>(null);
  const [wablastSuccess, setWablastSuccess] = useState<string | null>(null);
  const [isCopiedWablastWebhook, setIsCopiedWablastWebhook] = useState<boolean>(false);

  // Bablast Test Send Message
  const [testPhoneBablast, setTestPhoneBablast] = useState<string>('081298765432');
  const [isTestingBablastSend, setIsTestingBablastSend] = useState<boolean>(false);
  const [bablastTestResult, setBablastTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Provider Switch state
  const [isSwitchingProvider, setIsSwitchingProvider] = useState<boolean>(false);

  // Simulation state
  const [simName, setSimName] = useState<string>('Nusantara Care CS Bot');
  const [simPhone, setSimPhone] = useState<string>('+62 812-9876-5432');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Webhook URLs
  const fonnteWebhookUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/api/webhook/fonnte` : '/api/webhook/fonnte';
  const bablastWebhookUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/api/webhook/bablast` : '/api/webhook/bablast';

  // Fetch live WhatsApp Web status and gateway config from server
  const fetchStatusAndQr = async () => {
    try {
      const res = await fetch('/api/whatsapp/status');
      const data = await res.json();
      if (data?.session) {
        if (data.gatewayProvider) {
          setActiveGatewayProvider(data.gatewayProvider);
          if (!hasLoadedGatewayConfig) {
            setSelectedGateway(data.gatewayProvider);
            setHasLoadedGatewayConfig(true);
          }
        }

        if (data.gatewayConfig) {
          if (data.gatewayConfig.fonnte) {
            if (data.gatewayConfig.fonnte.token) setFonnteToken(data.gatewayConfig.fonnte.token);
            if (data.gatewayConfig.fonnte.device) setFonnteDevice(data.gatewayConfig.fonnte.device);
            if (data.gatewayConfig.fonnte.quota) setFonnteQuota(String(data.gatewayConfig.fonnte.quota));
          }
          if (data.gatewayConfig.wablast) {
            if (data.gatewayConfig.wablast.apiUrl) setWablastApiUrl(data.gatewayConfig.wablast.apiUrl);
            if (data.gatewayConfig.wablast.apiKey) setWablastApiKey(data.gatewayConfig.wablast.apiKey);
            if (data.gatewayConfig.wablast.phone) setWablastPhone(data.gatewayConfig.wablast.phone);
            if (data.gatewayConfig.wablast.quota) setWablastQuota(String(data.gatewayConfig.wablast.quota));
          }
        }

        if (data.session.status === 'connected') {
          onPairSuccess(
            data.session.phoneNumber || '+62 812-9876-5432',
            data.session.pushName || 'WhatsApp CS'
          );
          return;
        }

        const qr = data.qrCodeData || data.session?.qrCodeData;
        if (qr) {
          setLiveQrDataUrl(qr);
          if (data.qrCodeUrlData) setLiveQrUrlData(data.qrCodeUrlData);
          if (data.qrCodeRawData) setLiveQrRawData(data.qrCodeRawData);
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
  }, [isOpen, status, hasLoadedGatewayConfig]);

  // Local visual countdown timer for QR
  useEffect(() => {
    if (!isOpen || status === 'connected' || selectedGateway !== 'direct') return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchStatusAndQr();
          return 40;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, status, selectedGateway]);

  // Handle manual refresh
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/whatsapp/refresh-qr', { method: 'POST' });
      const data = await res.json();
      if (data?.qrCodeData) {
        setLiveQrDataUrl(data.qrCodeData);
        if (data.qrCodeUrlData) setLiveQrUrlData(data.qrCodeUrlData);
        if (data.qrCodeRawData) setLiveQrRawData(data.qrCodeRawData);
        setIsLoadingQr(false);
        if (data.qrExpiresAt) {
          const remaining = Math.max(0, Math.floor((data.qrExpiresAt - Date.now()) / 1000));
          setCountdown(remaining > 0 ? remaining : 40);
        }
      } else {
        await fetchStatusAndQr();
      }
    } catch (e) {
      console.error(e);
      await fetchStatusAndQr();
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

  // Copy Fonnte Webhook URL
  const handleCopyFonnteWebhook = () => {
    navigator.clipboard.writeText(fonnteWebhookUrl);
    setIsCopiedFonnteWebhook(true);
    setTimeout(() => setIsCopiedFonnteWebhook(false), 2000);
  };

  // Copy Bablast / Wablast Webhook URL
  const handleCopyBablastWebhook = () => {
    navigator.clipboard.writeText(bablastWebhookUrl);
    setIsCopiedWablastWebhook(true);
    setTimeout(() => setIsCopiedWablastWebhook(false), 2000);
  };

  // Test send message via Fonnte
  const handleTestSendFonnte = async () => {
    if (!testPhoneFonnte.trim()) return;
    setIsTestingFonnteSend(true);
    setFonnteTestResult(null);

    try {
      const res = await fetch('/api/whatsapp/test-gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'fonnte',
          targetPhone: testPhoneFonnte.trim(),
          message: `Halo! Ini adalah pesan uji coba resmi dari integrasi Fonnte WhatsApp Gateway Toko Nusantara Digital. Sistem aktif pada ${new Date().toLocaleTimeString('id-ID')} WIB.`,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFonnteTestResult({
          success: true,
          message: `Pesan uji coba berhasil terkirim ke ${testPhoneFonnte} via Fonnte!`,
        });
      } else {
        setFonnteTestResult({
          success: false,
          message: data.error || 'Gagal mengirim pesan uji coba via Fonnte.',
        });
      }
    } catch (err: any) {
      setFonnteTestResult({
        success: false,
        message: 'Koneksi gagal: ' + err?.message,
      });
    } finally {
      setIsTestingFonnteSend(false);
    }
  };

  // Test send message via Bablast.id
  const handleTestSendBablast = async () => {
    if (!testPhoneBablast.trim()) return;
    setIsTestingBablastSend(true);
    setBablastTestResult(null);

    try {
      const res = await fetch('/api/whatsapp/test-gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'wablast',
          targetPhone: testPhoneBablast.trim(),
          message: `Halo! Ini adalah pesan uji coba resmi dari integrasi Bablast.id WhatsApp Gateway Toko Nusantara Digital. Sistem aktif pada ${new Date().toLocaleTimeString('id-ID')} WIB.`,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBablastTestResult({
          success: true,
          message: `Pesan uji coba berhasil terkirim ke ${testPhoneBablast} via Bablast.id!`,
        });
      } else {
        setBablastTestResult({
          success: false,
          message: data.error || 'Gagal mengirim pesan uji coba via Bablast.id.',
        });
      }
    } catch (err: any) {
      setBablastTestResult({
        success: false,
        message: 'Koneksi gagal: ' + err?.message,
      });
    } finally {
      setIsTestingBablastSend(false);
    }
  };

  // Switch Active Provider
  const handleSwitchProvider = async (provider: 'direct' | 'fonnte' | 'wablast') => {
    setIsSwitchingProvider(true);
    try {
      const res = await fetch('/api/whatsapp/switch-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActiveGatewayProvider(provider);
        setSelectedGateway(provider);
        if (data.session?.status === 'connected') {
          onPairSuccess(
            data.session.phoneNumber || '+62 812-9876-5432',
            data.session.pushName || 'WhatsApp CS'
          );
        }
      }
    } catch (e) {
      console.error('Failed to switch provider:', e);
    } finally {
      setIsSwitchingProvider(false);
    }
  };

  // Connect to Fonnte Gateway
  const handleConnectFonnte = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fonnteToken.trim()) {
      setFonnteError('Harap masukkan Token API Fonnte.');
      return;
    }

    setIsConnectingFonnte(true);
    setFonnteError(null);
    setFonnteSuccess(null);

    try {
      const res = await fetch('/api/whatsapp/connect-fonnte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: fonnteToken.trim() }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setFonnteSuccess(data.message || 'Berhasil terhubung ke Fonnte!');
        setFonnteDevice(data.device || '+62 812-Fonnte');
        if (data.quota) setFonnteQuota(String(data.quota));
        setActiveGatewayProvider('fonnte');
        onPairSuccess(data.device || '+62 812-Fonnte', 'Fonnte CS Bot');
      } else {
        setFonnteError(data.error || 'Gagal menghubungkan ke Fonnte. Periksa token Anda.');
      }
    } catch (err: any) {
      setFonnteError('Gagal menghubungi server: ' + err?.message);
    } finally {
      setIsConnectingFonnte(false);
    }
  };

  // Connect to Wablast.id Gateway
  const handleConnectWablast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wablastApiKey.trim()) {
      setWablastError('Harap masukkan API Key / Token Wablast.');
      return;
    }

    setIsConnectingWablast(true);
    setWablastError(null);
    setWablastSuccess(null);

    try {
      const res = await fetch('/api/whatsapp/connect-wablast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiUrl: wablastApiUrl.trim(),
          apiKey: wablastApiKey.trim(),
          phone: wablastPhone.trim(),
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setWablastSuccess(data.message || 'Berhasil terhubung ke Wablast.id!');
        setActiveGatewayProvider('wablast');
        onPairSuccess(data.phone || '+62 812-Wablast', 'Wablast.id CS Bot');
      } else {
        setWablastError(data.error || 'Gagal menghubungkan ke Wablast.id.');
      }
    } catch (err: any) {
      setWablastError('Gagal menghubungi server: ' + err?.message);
    } finally {
      setIsConnectingWablast(false);
    }
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
          setActiveGatewayProvider('direct');
          onPairSuccess(simPhone, simName);
        })
        .catch(() => setIsSimulating(false));
    }, 800);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-emerald-800 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-900/80 rounded-xl">
              <QrCode className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Hubungkan WhatsApp Gateway</h2>
              <p className="text-xs text-emerald-200">
                Pilih metode: WhatsApp Web Langsung, Fonnte (fonnte.com), atau Wablast.id
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-emerald-700/60 transition-colors text-white cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Top Provider Selector */}
          <div className="p-1.5 bg-slate-100 rounded-xl flex items-center gap-1.5 border border-slate-200">
            <button
              type="button"
              onClick={() => setSelectedGateway('fonnte')}
              className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                selectedGateway === 'fonnte'
                  ? 'bg-white text-emerald-900 shadow-xs border border-emerald-300 ring-1 ring-emerald-500/20'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Radio className="w-4 h-4 text-emerald-600" />
              <span>Fonnte (fonnte.com)</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedGateway('wablast')}
              className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                selectedGateway === 'wablast'
                  ? 'bg-white text-blue-900 shadow-xs border border-blue-300 ring-1 ring-blue-500/20'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Send className="w-4 h-4 text-blue-600" />
              <span>Bablast.id (bablast.id)</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedGateway('direct')}
              className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                selectedGateway === 'direct'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-300 ring-1 ring-slate-400/20'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-4 h-4 text-emerald-600" />
              <span>WhatsApp Web (Langsung)</span>
            </button>
          </div>

          {/* Connected State Banner (if already connected) */}
          {status === 'connected' && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 bg-emerald-600 text-white rounded-xl shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-emerald-950 text-base">WhatsApp Gateway Aktif Online</h3>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      {activeGatewayProvider === 'fonnte'
                        ? 'Fonnte Gateway'
                        : activeGatewayProvider === 'wablast'
                        ? 'Bablast.id Gateway'
                        : 'WhatsApp Web Direct'}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-800 mt-1">
                    Gateway terhubung via{' '}
                    <strong>
                      {activeGatewayProvider === 'fonnte'
                        ? 'Fonnte Cloud (fonnte.com)'
                        : activeGatewayProvider === 'wablast'
                        ? 'Bablast.id Cloud Gateway (bablast.id)'
                        : 'WhatsApp Web Multi-Device'}
                    </strong>
                    . Asisten AI aktif membalas pesan masuk dan pesan terjadwal 24/7.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div className="p-3 bg-white rounded-lg border border-emerald-200 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Nomor WhatsApp:</span>
                  <span className="font-bold font-mono text-emerald-900">{phoneNumber || simPhone}</span>
                </div>
                <div className="p-3 bg-white rounded-lg border border-emerald-200 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Penyedia Aktif:</span>
                  <span className="font-bold text-slate-800 uppercase text-[11px] tracking-wide">
                    {activeGatewayProvider === 'fonnte'
                      ? 'Fonnte (fonnte.com)'
                      : activeGatewayProvider === 'wablast'
                      ? 'Bablast.id (bablast.id)'
                      : 'WhatsApp Web Direct'}
                  </span>
                </div>
              </div>

              {/* Provider Quick Switcher */}
              <div className="p-3 bg-white rounded-lg border border-emerald-200/80 space-y-2">
                <span className="text-[11px] font-semibold text-slate-600 block">
                  Pindah Penyedia Gateway Lainnya:
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isSwitchingProvider || activeGatewayProvider === 'fonnte'}
                    onClick={() => handleSwitchProvider('fonnte')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      activeGatewayProvider === 'fonnte'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Ganti ke Fonnte</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSwitchingProvider || activeGatewayProvider === 'wablast'}
                    onClick={() => handleSwitchProvider('wablast')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      activeGatewayProvider === 'wablast'
                        ? 'bg-blue-100 text-blue-800 border border-blue-300'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5 text-blue-600" />
                    <span>Ganti ke Bablast.id</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSwitchingProvider || activeGatewayProvider === 'direct'}
                    onClick={() => handleSwitchProvider('direct')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      activeGatewayProvider === 'direct'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Ganti ke WA Web Direct</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-emerald-200/80">
                <button
                  type="button"
                  onClick={onDisconnect}
                  className="px-3.5 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Putuskan Gateway
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-2xs"
                >
                  Buka Dasbor Pesan
                </button>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* PROVIDER 1: DIRECT WHATSAPP WEB (BAILEYS MULTI-DEVICE)        */}
          {/* ------------------------------------------------------------- */}
          {selectedGateway === 'direct' && (
            <div className="space-y-4">
              {/* Method Switcher Tabs for Direct */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('qr_scanner')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
                    activeTab === 'qr_scanner'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <QrCode className="w-4 h-4" /> 1. Pindai QR Code Resmi
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('pairing_code')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
                    activeTab === 'pairing_code'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <KeyRound className="w-4 h-4" /> 2. Kode Tautan 8-Digit (Tanpa Kamera)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('simulate')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
                    activeTab === 'simulate'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Zap className="w-4 h-4" /> 3. Mode Demo Instan
                </button>
              </div>

              {/* TAB 1: Real QR Scanner */}
              {activeTab === 'qr_scanner' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  <div className="space-y-3 text-xs text-slate-700">
                    <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-950 text-xs">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        Kode QR Resmi WhatsApp Web Multi-Device
                      </div>
                      <p className="text-[11px] text-emerald-800 leading-relaxed">
                        Kode QR diterbitkan langsung oleh server WhatsApp resmi (<code className="font-mono bg-emerald-100 px-1 rounded">web.whatsapp.com</code>).
                      </p>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 text-xs mb-2">Cara Memindai dari Ponsel:</h4>
                      <ol className="space-y-1.5 list-decimal list-inside text-slate-600 leading-relaxed">
                        <li>Buka aplikasi <strong>WhatsApp</strong> di HP Anda.</li>
                        <li>Ketuk menu <strong>Titik Tiga ⋮</strong> (Android) atau <strong>Pengaturan ⚙️</strong> (iPhone).</li>
                        <li>Pilih <strong>Perangkat Tertaut (Linked Devices)</strong>.</li>
                        <li>Ketuk tombol <strong>Tautkan Perangkat</strong>.</li>
                        <li>Arahkan kamera ponsel ke Kode QR di sebelah kanan.</li>
                      </ol>
                    </div>

                    <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl text-[11px] text-amber-900 space-y-1">
                      <div className="flex items-center gap-1 font-bold text-amber-900">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" /> Tips Scan Bebas Error:
                      </div>
                      <p className="text-[10px] text-amber-800 leading-snug">
                        Pastikan memindai dari dalam WhatsApp melalui menu <strong>Perangkat Tertaut</strong>. Jika kamera HP silau, Anda bisa beralih ke tab <strong>Kode Tautan 8 Digit</strong> tanpa kamera.
                      </p>
                    </div>
                  </div>

                  {/* QR Box */}
                  <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    {/* Toggle QR mode */}
                    <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg mb-2.5 text-[11px] font-medium w-full max-w-[240px]">
                      <button
                        type="button"
                        onClick={() => setQrDisplayMode('scanner')}
                        className={`flex-1 py-1 px-2 rounded-md transition-all text-center cursor-pointer ${
                          qrDisplayMode === 'scanner'
                            ? 'bg-white text-emerald-800 font-bold shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Scanner WhatsApp
                      </button>
                      <button
                        type="button"
                        onClick={() => setQrDisplayMode('camera')}
                        className={`flex-1 py-1 px-2 rounded-md transition-all text-center cursor-pointer ${
                          qrDisplayMode === 'camera'
                            ? 'bg-white text-emerald-800 font-bold shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Kamera HP
                      </button>
                    </div>

                    <div className="relative p-2.5 bg-white rounded-xl shadow-md border border-slate-200 flex items-center justify-center min-w-[230px] min-h-[230px]">
                      {liveQrDataUrl ? (
                        <div className="relative flex flex-col items-center">
                          <img
                            src={
                              qrDisplayMode === 'scanner'
                                ? liveQrRawData || liveQrDataUrl
                                : liveQrDataUrl || liveQrUrlData
                            }
                            alt="WhatsApp Web Multi-Device QR Code"
                            className="w-52 h-52 object-contain rounded-lg shadow-2xs"
                          />
                          {isRefreshing && (
                            <div className="absolute inset-0 bg-white/85 backdrop-blur-xs flex flex-col items-center justify-center rounded-lg gap-2">
                              <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                              <span className="text-[11px] font-semibold text-emerald-800">
                                Memperbarui QR Resmi...
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-52 h-52 flex flex-col items-center justify-center text-slate-500 gap-2.5 p-3 text-center">
                          <RefreshCw className="w-7 h-7 animate-spin text-emerald-600" />
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-slate-800">Menghubungkan ke Server WA...</p>
                            <p className="text-[10px] text-slate-500 leading-tight">
                              Mengambil handshake resmi dari web.whatsapp.com...
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-2 flex items-center justify-between w-full max-w-[240px] text-[11px] text-slate-500">
                      <span className="font-mono">
                        Segar: <strong className="text-slate-800">{countdown}s</strong>
                      </span>
                      <button
                        type="button"
                        onClick={handleManualRefresh}
                        disabled={isRefreshing}
                        className="text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} /> Refresh QR
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleInstantConnect}
                      disabled={isSimulating}
                      className="w-full max-w-[240px] mt-2.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSimulating ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Menautkan...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Konfirmasi & Tautkan Sekarang
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: Pairing Code 8 Digit */}
              {activeTab === 'pairing_code' && (
                <div className="space-y-3.5">
                  <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1">
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-emerald-700" />
                      <h4 className="font-bold text-xs text-emerald-950">
                        Tautkan Perangkat dengan Nomor Telepon (Resmi WhatsApp)
                      </h4>
                    </div>
                    <p className="text-xs text-emerald-800">
                      Menghubungkan WhatsApp tanpa perlu kamera ponsel. Cukup masukkan nomor HP dan ketik 8 karakter di aplikasi WhatsApp ponsel Anda.
                    </p>
                  </div>

                  <form
                    onSubmit={handleRequestPairingCode}
                    className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5"
                  >
                    <label className="text-xs font-semibold text-slate-700 block">
                      Masukkan Nomor WhatsApp Ponsel:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={inputPhone}
                        onChange={(e) => setInputPhone(e.target.value)}
                        placeholder="Contoh: 081298765432"
                        className="w-full text-xs px-3 py-2 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                        required
                      />
                      <button
                        type="submit"
                        disabled={isRequestingCode}
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold shrink-0 transition-colors shadow-2xs cursor-pointer"
                      >
                        {isRequestingCode ? 'Meminta ke Server...' : 'Dapatkan Kode Tautan'}
                      </button>
                    </div>
                  </form>

                  {officialPairingCode && (
                    <div className="p-4 bg-white rounded-xl border-2 border-emerald-500 text-center space-y-2 shadow-xs">
                      <span className="text-xs uppercase font-bold text-slate-500 tracking-wider block">
                        Kode Tautan WhatsApp Anda (8 Digit):
                      </span>
                      <div className="text-3xl font-black font-mono tracking-widest text-emerald-800 py-1">
                        {officialPairingCode}
                      </div>

                      <button
                        type="button"
                        onClick={handleCopyCode}
                        className="px-3 py-1.5 mx-auto bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
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

                      <div className="text-left text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200 mt-2 space-y-1">
                        <span className="font-bold text-slate-900 block mb-1">Langkah di WhatsApp Ponsel:</span>
                        <ol className="list-decimal list-inside space-y-0.5">
                          <li>Buka WhatsApp &gt; Menu <strong>Perangkat Tertaut</strong>.</li>
                          <li>Ketuk <strong>Tautkan Perangkat</strong>.</li>
                          <li>Ketuk teks <strong>"Tautkan dengan nomor telepon saja"</strong> di bagian bawah layar.</li>
                          <li>Ketikkan kode di atas: <strong className="font-mono text-emerald-800">{officialPairingCode}</strong>.</li>
                        </ol>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: Mode Demo Instan */}
              {activeTab === 'simulate' && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                      <Zap className="w-4 h-4 text-emerald-600" /> Mode Simulasi & Pengujian Instan
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Gunakan mode ini jika Anda ingin menguji seluruh fitur dashboard, simulasi pesan masuk pelanggan, dan respon AI otomatis tanpa perlu memindai WhatsApp fisik.
                    </p>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">Nama Bot CS</label>
                        <input
                          type="text"
                          value={simName}
                          onChange={(e) => setSimName(e.target.value)}
                          className="w-full text-xs px-3 py-2 bg-white rounded-lg border border-slate-300"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">Nomor Pengirim</label>
                        <input
                          type="text"
                          value={simPhone}
                          onChange={(e) => setSimPhone(e.target.value)}
                          className="w-full text-xs px-3 py-2 bg-white rounded-lg border border-slate-300 font-mono"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleInstantConnect}
                      disabled={isSimulating}
                      className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                    >
                      {isSimulating ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" /> Menghubungkan...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4" /> Aktifkan Mode Demo Sekarang
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* PROVIDER 2: FONNTE (FONNTE.COM)                               */}
          {/* ------------------------------------------------------------- */}
          {selectedGateway === 'fonnte' && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-emerald-700" />
                    <h3 className="font-bold text-sm text-emerald-950">Fonnte WhatsApp Gateway (fonnte.com)</h3>
                  </div>
                  <a
                    href="https://fonnte.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-semibold text-emerald-700 hover:underline flex items-center gap-1"
                  >
                    Buka Fonnte.com <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  Hubungkan gateway WhatsApp melalui akun <strong>Fonnte (fonnte.com)</strong> Anda. Pesan masuk pelanggan dan respon pintar AI otomatis akan disalurkan via API Fonnte tanpa perlu scan ulang QR server lokal.
                </p>
              </div>

              {/* Fonnte Configuration Form */}
              <form onSubmit={handleConnectFonnte} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <label className="text-xs font-semibold text-slate-700 block">
                  Token API Perangkat Fonnte:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={fonnteToken}
                    onChange={(e) => setFonnteToken(e.target.value)}
                    placeholder="Contoh: vKx7#9LqM... (dari menu Device di fonnte.com)"
                    className="w-full text-xs px-3 py-2 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                    required
                  />
                  <button
                    type="submit"
                    disabled={isConnectingFonnte}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold shrink-0 transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
                  >
                    {isConnectingFonnte ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Menguji...
                      </>
                    ) : (
                      <>
                        <Radio className="w-3.5 h-3.5" /> Uji & Hubungkan Fonnte
                      </>
                    )}
                  </button>
                </div>
                <span className="text-[11px] text-slate-400 block">
                  *Dapatkan token di dashboard <strong>https://md.fonnte.com/ &gt; Menu Device</strong>.
                </span>

                {fonnteError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                    <span>{fonnteError}</span>
                  </div>
                )}

                {fonnteSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>{fonnteSuccess} (Nomor: {fonnteDevice}, Kuota: {fonnteQuota || 'Aktif'})</span>
                  </div>
                )}
              </form>

              {/* Webhook Settings Box for Fonnte */}
              <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 block">
                    URL Webhook Pesan Masuk (Tempel di Dashboard Fonnte):
                  </label>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-semibold">
                    Wajib untuk Terima Chat & Auto-Reply AI
                  </span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={fonnteWebhookUrl}
                    className="w-full text-xs px-3 py-2 bg-slate-50 rounded-lg border border-slate-300 font-mono text-slate-700 select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopyFonnteWebhook}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                  >
                    {isCopiedFonnteWebhook ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" /> Disalin!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Salin Webhook
                      </>
                    )}
                  </button>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1">
                  <div className="font-semibold text-slate-800 mb-0.5">Panduan Pengaturan di Fonnte:</div>
                  <ol className="list-decimal list-inside space-y-0.5 text-[11px]">
                    <li>Login ke dashboard <strong>https://md.fonnte.com/</strong>.</li>
                    <li>Buka menu <strong>Device</strong> &gt; klik perangkat WhatsApp Anda.</li>
                    <li>Tempelkan URL Webhook di atas ke kolom <strong>Webhook URL</strong>.</li>
                    <li>Centang opsi <strong>Auto Read</strong> (opsional) dan klik <strong>Save</strong>.</li>
                    <li>Pesan masuk dari pelanggan akan otomatis masuk ke dashboard ini dan dibalas pintar oleh Asisten AI!</li>
                  </ol>
                </div>
              </div>

              {/* Fonnte Live Test Message Sender */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-800">Uji Coba Kirim Pesan via Fonnte:</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Kirimkan satu pesan WhatsApp uji coba ke nomor Anda untuk memastikan token Fonnte aktif dan bisa mengirim pesan.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={testPhoneFonnte}
                    onChange={(e) => setTestPhoneFonnte(e.target.value)}
                    placeholder="Nomor HP tujuan (misal: 081298765432)"
                    className="w-full text-xs px-3 py-2 bg-white rounded-lg border border-slate-300 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleTestSendFonnte}
                    disabled={isTestingFonnteSend || !fonnteToken.trim()}
                    className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shrink-0 cursor-pointer flex items-center gap-1.5 transition-colors"
                  >
                    {isTestingFonnteSend ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Mengirim...
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" /> Kirim Pesan Tes
                      </>
                    )}
                  </button>
                </div>
                {fonnteTestResult && (
                  <div
                    className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                      fonnteTestResult.success
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}
                  >
                    {fonnteTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    )}
                    <span>{fonnteTestResult.message}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* PROVIDER 3: BABLAST.ID / WABLAST.ID                           */}
          {/* ------------------------------------------------------------- */}
          {selectedGateway === 'wablast' && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Send className="w-4 h-4 text-blue-700" />
                    <h3 className="font-bold text-sm text-blue-950">Bablast.id Gateway (bablast.id / wablast.id)</h3>
                  </div>
                  <a
                    href="https://bablast.id"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-semibold text-blue-700 hover:underline flex items-center gap-1"
                  >
                    Buka Bablast.id <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-xs text-blue-800 leading-relaxed">
                  Hubungkan layanan WhatsApp Gateway & Blast via akun <strong>Bablast.id (atau Wablast.id)</strong>. Mendukung pengiriman pesan broadcast, auto-responder AI 24/7, dan webhook pesan masuk.
                </p>
              </div>

              {/* Bablast Configuration Form */}
              <form onSubmit={handleConnectWablast} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Domain API Bablast / Wablast:
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-500">Preset Cepat:</span>
                      <button
                        type="button"
                        onClick={() => setWablastApiUrl('https://api.bablast.id')}
                        className={`text-[10px] px-2 py-0.5 rounded cursor-pointer transition-colors ${
                          wablastApiUrl === 'https://api.bablast.id'
                            ? 'bg-blue-600 text-white font-bold'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        api.bablast.id
                      </button>
                      <button
                        type="button"
                        onClick={() => setWablastApiUrl('https://bablast.id')}
                        className={`text-[10px] px-2 py-0.5 rounded cursor-pointer transition-colors ${
                          wablastApiUrl === 'https://bablast.id'
                            ? 'bg-blue-600 text-white font-bold'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        bablast.id
                      </button>
                      <button
                        type="button"
                        onClick={() => setWablastApiUrl('https://api.wablast.id')}
                        className={`text-[10px] px-2 py-0.5 rounded cursor-pointer transition-colors ${
                          wablastApiUrl === 'https://api.wablast.id'
                            ? 'bg-blue-600 text-white font-bold'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        api.wablast.id
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={wablastApiUrl}
                    onChange={(e) => setWablastApiUrl(e.target.value)}
                    placeholder="https://api.bablast.id atau https://bablast.id"
                    className="w-full text-xs px-3 py-2 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      API Key / Security Token Bablast:
                    </label>
                    <input
                      type="password"
                      value={wablastApiKey}
                      onChange={(e) => setWablastApiKey(e.target.value)}
                      placeholder="Masukkan Token dari Bablast.id"
                      className="w-full text-xs px-3 py-2 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Nomor Pengirim WhatsApp (Opsional):
                    </label>
                    <input
                      type="text"
                      value={wablastPhone}
                      onChange={(e) => setWablastPhone(e.target.value)}
                      placeholder="Contoh: 081298765432"
                      className="w-full text-xs px-3 py-2 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isConnectingWablast}
                  className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs cursor-pointer flex items-center justify-center gap-2"
                >
                  {isConnectingWablast ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Menguji Koneksi Bablast.id...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" /> Uji & Hubungkan ke Bablast.id
                    </>
                  )}
                </button>

                {wablastError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                    <span>{wablastError}</span>
                  </div>
                )}

                {wablastSuccess && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-600" />
                    <span>{wablastSuccess}</span>
                  </div>
                )}
              </form>

              {/* Webhook Settings Box for Bablast */}
              <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 block">
                    URL Webhook Bablast.id (Pesan Masuk Pelanggan):
                  </label>
                  <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 font-semibold">
                    Inbound Webhook
                  </span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={bablastWebhookUrl}
                    className="w-full text-xs px-3 py-2 bg-slate-50 rounded-lg border border-slate-300 font-mono text-slate-700 select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopyBablastWebhook}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                  >
                    {isCopiedWablastWebhook ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-blue-400" /> Disalin!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Salin Webhook
                      </>
                    )}
                  </button>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1">
                  <div className="font-semibold text-slate-800 mb-0.5">Panduan Pengaturan di Bablast.id:</div>
                  <ol className="list-decimal list-inside space-y-0.5 text-[11px]">
                    <li>Buka dashboard akun <strong>Bablast.id</strong> Anda.</li>
                    <li>Masuk ke menu <strong>Integrasi API / Webhook</strong>.</li>
                    <li>Tempelkan URL Webhook di atas.</li>
                    <li>Klik <strong>Simpan Pengaturan</strong>. Pesan pelanggan masuk akan langsung diproses oleh AI Toko Nusantara Digital.</li>
                  </ol>
                </div>
              </div>

              {/* Bablast Live Test Message Sender */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-slate-800">Uji Coba Kirim Pesan via Bablast.id:</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Kirimkan satu pesan WhatsApp uji coba ke nomor Anda untuk memastikan API Key Bablast.id aktif dan bisa mengirim pesan.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={testPhoneBablast}
                    onChange={(e) => setTestPhoneBablast(e.target.value)}
                    placeholder="Nomor HP tujuan (misal: 081298765432)"
                    className="w-full text-xs px-3 py-2 bg-white rounded-lg border border-slate-300 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleTestSendBablast}
                    disabled={isTestingBablastSend || !wablastApiKey.trim()}
                    className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shrink-0 cursor-pointer flex items-center gap-1.5 transition-colors"
                  >
                    {isTestingBablastSend ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Mengirim...
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" /> Kirim Pesan Tes
                      </>
                    )}
                  </button>
                </div>
                {bablastTestResult && (
                  <div
                    className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                      bablastTestResult.success
                        ? 'bg-blue-100 text-blue-900 border border-blue-300'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}
                  >
                    {bablastTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    )}
                    <span>{bablastTestResult.message}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
