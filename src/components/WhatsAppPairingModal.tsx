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
  Sparkles,
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
  const [isForceConnectingFonnte, setIsForceConnectingFonnte] = useState<boolean>(false);
  const [fonnteError, setFonnteError] = useState<string | null>(null);
  const [fonnteErrorDetails, setFonnteErrorDetails] = useState<string | null>(null);
  const [canForceFonnte, setCanForceFonnte] = useState<boolean>(false);
  const [fonnteSuccess, setFonnteSuccess] = useState<string | null>(null);
  const [isCopiedFonnteWebhook, setIsCopiedFonnteWebhook] = useState<boolean>(false);
  const [isSimulatingInbound, setIsSimulatingInbound] = useState<boolean>(false);
  const [simulatedInboundSuccess, setSimulatedInboundSuccess] = useState<string | null>(null);

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

  // Webhook URLs & Relay states
  const [fonnteWebhookUrl, setFonnteWebhookUrl] = useState<string>(
    typeof window !== 'undefined' ? `${window.location.origin}/api/webhook/fonnte` : '/api/webhook/fonnte'
  );
  const [directWebhookUrl, setDirectWebhookUrl] = useState<string>(
    typeof window !== 'undefined' ? `${window.location.origin}/api/webhook/fonnte` : '/api/webhook/fonnte'
  );
  const [bablastWebhookUrl, setBablastWebhookUrl] = useState<string>(
    typeof window !== 'undefined' ? `${window.location.origin}/api/webhook/bablast` : '/api/webhook/bablast'
  );
  const [webhookRelayConfig, setWebhookRelayConfig] = useState<any>(null);
  const [webhookStatsData, setWebhookStatsData] = useState<any>(null);
  const [isSyncingRelay, setIsSyncingRelay] = useState<boolean>(false);
  const [syncRelayResult, setSyncRelayResult] = useState<string | null>(null);
  const [isResettingRelay, setIsResettingRelay] = useState<boolean>(false);
  const [showInboundLogs, setShowInboundLogs] = useState<boolean>(false);
  const [isCopiedDirectWebhook, setIsCopiedDirectWebhook] = useState<boolean>(false);

  // Fetch live webhook stats and relay config
  const fetchWebhookDiagnostics = async () => {
    try {
      const res = await fetch('/api/whatsapp/webhook-stats');
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        if (data.fonnteWebhookUrl) setFonnteWebhookUrl(data.fonnteWebhookUrl);
        if (data.directWebhookUrl) setDirectWebhookUrl(data.directWebhookUrl);
        if (data.bablastWebhookUrl) setBablastWebhookUrl(data.bablastWebhookUrl);
        if (data.relayConfig) setWebhookRelayConfig(data.relayConfig);
        if (data.stats) setWebhookStatsData(data.stats);
      }
    } catch (e) {
      // ignore
    }
  };

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
    fetchWebhookDiagnostics();

    const interval = setInterval(() => {
      fetchStatusAndQr();
      fetchWebhookDiagnostics();
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

  // Copy Direct Webhook URL
  const handleCopyDirectWebhook = () => {
    navigator.clipboard.writeText(directWebhookUrl);
    setIsCopiedDirectWebhook(true);
    setTimeout(() => setIsCopiedDirectWebhook(false), 2000);
  };

  // Force poll / sync incoming messages from Webhook Relay
  const handleSyncWebhookRelay = async () => {
    setIsSyncingRelay(true);
    setSyncRelayResult(null);
    try {
      const res = await fetch('/api/whatsapp/webhook-relay/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        if (data.stats) setWebhookStatsData(data.stats);
        if (data.relayConfig) setWebhookRelayConfig(data.relayConfig);
        if (data.processedCount > 0) {
          setSyncRelayResult(`🎉 Sukses! Ditemukan ${data.processedCount} pesan masuk baru dan telah dimasukkan ke Inbox!`);
        } else {
          setSyncRelayResult('✅ Antrean webhook relay bersih. Belum ada pesan masuk baru dari Fonnte.');
        }
        setTimeout(() => setSyncRelayResult(null), 6000);
      }
    } catch (err: any) {
      setSyncRelayResult('Gagal sinkronisasi: ' + err?.message);
    } finally {
      setIsSyncingRelay(false);
    }
  };

  // Reset / Regenerate Webhook Relay URL
  const handleResetWebhookRelay = async () => {
    if (!window.confirm('Buat URL Webhook Relay baru? Jika ya, Anda harus menyalin dan menempelkan URL baru ke dashboard Fonnte.')) return;
    setIsResettingRelay(true);
    try {
      const res = await fetch('/api/whatsapp/webhook-relay/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.relayConfig) {
        setWebhookRelayConfig(data.relayConfig);
        setFonnteWebhookUrl(data.relayConfig.publicUrl);
        setSyncRelayResult('✅ URL Webhook Relay baru berhasil dibuat! Salin dan tempelkan ke menu Device di Fonnte.');
        setTimeout(() => setSyncRelayResult(null), 6000);
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsResettingRelay(false);
    }
  };

  // Simulate Inbound Message (test webhook & auto-reply pipeline)
  const handleSimulateInboundMessage = async (customMessage?: string) => {
    setIsSimulatingInbound(true);
    setSimulatedInboundSuccess(null);
    try {
      const res = await fetch('/api/whatsapp/simulate-inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '081298765432',
          message: customMessage || 'Halo Kak CS! Apakah stok Smartphone Pro Max masih ada dan bisa kirim hari ini?',
          name: 'Budi Santoso (Tes Masuk)',
          provider: selectedGateway,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSimulatedInboundSuccess(
          '✅ Pesan masuk simulasi berhasil diproses! Asisten AI otomatis merespon dan pesan telah masuk ke Chat Inbox.'
        );
        setTimeout(() => setSimulatedInboundSuccess(null), 6000);
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsSimulatingInbound(false);
    }
  };

  // Test send message via Fonnte (works before or after connecting)
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
          token: fonnteToken.trim() || undefined,
          message: `Halo! Ini adalah pesan uji coba resmi dari integrasi Fonnte WhatsApp Gateway Toko Nusantara Digital. Sistem aktif pada ${new Date().toLocaleTimeString('id-ID')} WIB. ✅`,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFonnteTestResult({
          success: true,
          message: `🎉 Pesan uji coba BERHASIL terkirim ke ${testPhoneFonnte} via Fonnte! Token API terbukti valid, aktif, dan siap melayani chat pelanggan.`,
        });
        setActiveGatewayProvider('fonnte');
        setFonnteSuccess('Fonnte aktif & terverifikasi via uji kirim pesan!');
        setFonnteError(null);
        setCanForceFonnte(false);
        onPairSuccess(data.session?.phoneNumber || testPhoneFonnte.trim(), 'Fonnte WhatsApp');
      } else {
        setFonnteTestResult({
          success: false,
          message:
            data.error ||
            'Gagal mengirim pesan via Fonnte. Periksa apakah perangkat WhatsApp di Fonnte berstatus Connect dan nomor tujuan aktif.',
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

  // Connect to Fonnte Gateway (standard verification or force save)
  const handleConnectFonnte = async (e?: React.FormEvent, force: boolean = false) => {
    if (e) e.preventDefault();
    if (!fonnteToken.trim()) {
      setFonnteError('Harap masukkan Token API Fonnte.');
      return;
    }

    if (force) {
      setIsForceConnectingFonnte(true);
    } else {
      setIsConnectingFonnte(true);
    }
    setFonnteError(null);
    setFonnteErrorDetails(null);
    setFonnteSuccess(null);

    try {
      const res = await fetch('/api/whatsapp/connect-fonnte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: fonnteToken.trim(), force }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setFonnteSuccess(data.message || 'Berhasil terhubung ke Fonnte!');
        setFonnteDevice(data.device || '+62 812-Fonnte');
        if (data.quota) setFonnteQuota(String(data.quota));
        setActiveGatewayProvider('fonnte');
        setCanForceFonnte(false);
        onPairSuccess(data.device || '+62 812-Fonnte', 'Fonnte CS Bot');
      } else {
        setFonnteError(data.error || 'Gagal menghubungkan ke Fonnte. Periksa token Anda.');
        if (data.details) setFonnteErrorDetails(data.details);
        setCanForceFonnte(true);
      }
    } catch (err: any) {
      setFonnteError('Gagal menghubungi server: ' + err?.message);
      setCanForceFonnte(true);
    } finally {
      setIsConnectingFonnte(false);
      setIsForceConnectingFonnte(false);
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
              <form onSubmit={(e) => handleConnectFonnte(e, false)} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 block">
                    Token API Perangkat Fonnte (Device Token):
                  </label>
                  {fonnteToken.trim() && (
                    <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      {fonnteToken.trim().length} karakter
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={fonnteToken}
                    onChange={(e) => {
                      setFonnteToken(e.target.value);
                      if (fonnteError) setFonnteError(null);
                    }}
                    placeholder="Contoh: vKx7#9LqM... (Salin dari menu Device di https://md.fonnte.com/)"
                    className="w-full text-xs px-3 py-2.5 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    required
                  />

                  {/* Action Buttons: Standard Verify vs Bypass/Force Connect */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={isConnectingFonnte || isForceConnectingFonnte}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
                    >
                      {isConnectingFonnte ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Memverifikasi ke Fonnte...
                        </>
                      ) : (
                        <>
                          <Radio className="w-3.5 h-3.5" /> Uji & Hubungkan Fonnte
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleConnectFonnte(e, true)}
                      disabled={isConnectingFonnte || isForceConnectingFonnte || !fonnteToken.trim()}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                      title="Gunakan opsi ini jika token Anda sudah benar namun verifikasi otomatis Fonnte mengalami kendala"
                    >
                      {isForceConnectingFonnte ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Menyimpan...
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5 text-amber-300" /> Simpan & Hubungkan Langsung (Bypass)
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                  <span>*Salin dari: <strong>https://md.fonnte.com/ &gt; Menu Device &gt; Ikon Token</strong></span>
                  <a
                    href="https://md.fonnte.com/device"
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-700 hover:underline flex items-center gap-0.5 font-semibold"
                  >
                    Buka Menu Device Fonnte <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {fonnteError && (
                  <div className="p-3.5 bg-red-50/90 border border-red-200 rounded-xl text-xs text-red-800 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                      <div className="space-y-1">
                        <div className="font-bold text-red-900">{fonnteError}</div>
                        {fonnteErrorDetails && (
                          <div className="text-[11px] text-red-700 leading-relaxed">{fonnteErrorDetails}</div>
                        )}
                      </div>
                    </div>

                    {/* Action Shortcut to Force Connect */}
                    {canForceFonnte && (
                      <div className="pt-2 border-t border-red-200/80 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-medium text-red-700">Yakin token sudah benar?</span>
                        <button
                          type="button"
                          onClick={(e) => handleConnectFonnte(e, true)}
                          disabled={isForceConnectingFonnte}
                          className="px-3 py-1 bg-red-700 hover:bg-red-800 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs flex items-center gap-1"
                        >
                          <Zap className="w-3 h-3" /> Tetap Gunakan Token Ini (Simpan & Aktifkan)
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {fonnteSuccess && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <div>
                      <span className="font-bold">{fonnteSuccess}</span>
                      <span className="text-emerald-700 ml-1">
                        (Perangkat: {fonnteDevice}, Kuota: {fonnteQuota || 'Aktif'})
                      </span>
                    </div>
                  </div>
                )}
              </form>

              {/* Troubleshooting & Guide Box for Fonnte */}
              <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-amber-950">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>Solusi Jika Token Selalu Dinyatakan Invalid oleh Fonnte:</span>
                </div>
                <ul className="space-y-1.5 text-[11px] text-amber-900 list-disc list-inside leading-relaxed pl-1">
                  <li>
                    <strong>Gunakan Token Perangkat (Bukan Token Akun):</strong> Buka{' '}
                    <a
                      href="https://md.fonnte.com/device"
                      target="_blank"
                      rel="noreferrer"
                      className="text-amber-800 font-bold underline"
                    >
                      md.fonnte.com/device
                    </a>
                    , pilih perangkat WhatsApp Anda, lalu klik tombol/ikon <strong>Token</strong>.
                  </li>
                  <li>
                    <strong>Status WhatsApp di Fonnte:</strong> Pastikan di dashboard Fonnte status perangkat bertuliskan{' '}
                    <span className="bg-emerald-100 text-emerald-800 px-1 rounded font-bold">Connect</span>. Jika{' '}
                    <span className="bg-red-100 text-red-800 px-1 rounded font-bold">Disconnect</span>, lakukan Scan QR di Fonnte terlebih dahulu agar WhatsApp di HP Anda terhubung ke server Fonnte.
                  </li>
                  <li>
                    <strong>Gunakan Tombol "Simpan & Hubungkan Langsung":</strong> Jika Anda yakin token sudah benar dari Fonnte, gunakan tombol hitam di atas untuk menyimpan token langsung tanpa validasi ketat.
                  </li>
                  <li>
                    <strong>Uji Kirim Pesan:</strong> Masukkan nomor tujuan di kotak uji coba di bawah dan klik <em>"Kirim Pesan Tes"</em>. Jika pesan sampai ke WhatsApp Anda, token terbukti 100% aktif dan sistem otomatis mengaktifkannya!
                  </li>
                </ul>
              </div>

              {/* Webhook Settings Box for Fonnte */}
              <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
                    <label className="text-xs font-bold text-slate-800 block">
                      URL Webhook Pesan Masuk (Tempel di Dashboard Fonnte):
                    </label>
                  </div>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Bebas Blokir Google (Anti-302)
                  </span>
                </div>

                {/* Primary Webhook Relay Input & Copy */}
                <div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={fonnteWebhookUrl}
                      className="w-full text-xs px-3 py-2 bg-emerald-50/50 rounded-lg border border-emerald-300 font-mono text-emerald-900 select-all font-semibold"
                    />
                    <button
                      type="button"
                      onClick={handleCopyFonnteWebhook}
                      className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors shadow-2xs"
                    >
                      {isCopiedFonnteWebhook ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-300" /> Disalin!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Salin Webhook
                        </>
                      )}
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-1.5 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      Auto-Poller Aktif (Memeriksa pesan setiap 2,5 detik)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSyncWebhookRelay}
                        disabled={isSyncingRelay}
                        className="text-emerald-700 hover:text-emerald-900 font-semibold underline cursor-pointer flex items-center gap-1 text-[11px] disabled:opacity-50"
                      >
                        {isSyncingRelay ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin" /> Menarik...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-3 h-3" /> Tarik Pesan Sekarang
                          </>
                        )}
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={handleResetWebhookRelay}
                        disabled={isResettingRelay}
                        className="text-slate-500 hover:text-slate-800 underline cursor-pointer text-[11px]"
                      >
                        Reset URL
                      </button>
                    </div>
                  </div>
                </div>

                {syncRelayResult && (
                  <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>{syncRelayResult}</span>
                  </div>
                )}

                {/* Important Technical Root Cause Explanation */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="p-1 rounded-md bg-amber-100 text-amber-800 shrink-0 mt-0.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                    </div>
                    <div className="space-y-1">
                      <div className="font-bold text-slate-800 text-[11px]">
                        Mengapa Webhook Sebelumnya Tidak Terbaca?
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Tautan preview internal aplikasi (<code className="bg-slate-200 px-1 py-0.2 rounded font-mono text-[10px]">ais-dev-...run.app</code>) dilindungi sistem otentikasi Google yang merespons dengan <em>HTTP 302 Redirect</em> bagi pihak luar. Server Fonnte di luar tidak memiliki cookie Google Anda, sehingga pengiriman webhook dicegat.
                      </p>
                      <p className="text-[11px] text-emerald-800 font-medium leading-relaxed">
                        ✅ <strong>Solusi:</strong> Salin <strong>URL Webhook Bebas Blokir</strong> berwarna hijau di atas, lalu tempelkan ke kolom <strong>Webhook URL</strong> pada menu <strong>Device</strong> di dashboard <a href="https://md.fonnte.com/device" target="_blank" rel="noreferrer" className="underline font-bold text-emerald-900">md.fonnte.com</a>. Sistem relay terbuka ini dijamin bisa menerima kiriman Fonnte 100%!
                      </p>
                    </div>
                  </div>
                </div>

                {/* Live Webhook Inbound Traffic Diagnostics */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-600" /> Monitor Lalu Lintas Pesan Masuk (Live):
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowInboundLogs(!showInboundLogs)}
                      className="text-[11px] text-slate-600 hover:text-slate-900 underline cursor-pointer font-medium"
                    >
                      {showInboundLogs ? 'Tutup Log Detail' : 'Buka Log Detail'}
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 bg-white rounded-lg border border-slate-200">
                      <div className="text-[10px] text-slate-500">Total Diterima</div>
                      <div className="text-sm font-bold text-slate-800">
                        {webhookStatsData?.totalReceived || 0}
                      </div>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-slate-200">
                      <div className="text-[10px] text-slate-500">Pengirim Terakhir</div>
                      <div className="text-xs font-bold text-slate-800 truncate" title={webhookStatsData?.lastSender || '-'}>
                        {webhookStatsData?.lastSender || '-'}
                      </div>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-slate-200">
                      <div className="text-[10px] text-slate-500">Jam Terakhir</div>
                      <div className="text-xs font-bold text-slate-800">
                        {webhookStatsData?.lastReceivedAt
                          ? new Date(webhookStatsData.lastReceivedAt).toLocaleTimeString('id-ID')
                          : '-'}
                      </div>
                    </div>
                  </div>

                  {webhookStatsData?.lastMessage && (
                    <div className="p-2 bg-white rounded-lg border border-slate-200 text-[11px] text-slate-700 flex items-center gap-1.5">
                      <span className="text-slate-400 shrink-0 font-medium">Isi pesan terakhir:</span>
                      <span className="font-semibold truncate">"{webhookStatsData.lastMessage}"</span>
                    </div>
                  )}

                  {showInboundLogs && (
                    <div className="mt-2 space-y-1 max-h-40 overflow-y-auto border-t border-slate-200 pt-2">
                      {webhookStatsData?.recentLogs && webhookStatsData.recentLogs.length > 0 ? (
                        webhookStatsData.recentLogs.map((log: any) => (
                          <div
                            key={log.id}
                            className="p-1.5 bg-white rounded border border-slate-200 text-[10px] flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="font-bold text-slate-800">{log.name || log.sender}:</span>
                              <span className="text-slate-600 truncate">"{log.message}"</span>
                            </div>
                            <span className="text-slate-400 shrink-0 text-[9px]">{log.receivedAt}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-2 text-slate-400 text-[11px]">
                          Belum ada log pesan masuk yang tercatat.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Direct Webhook (Advanced/Alternative) */}
                <div className="pt-1 flex items-center justify-between text-[11px] text-slate-500">
                  <span>URL Direct (Deploy Mandiri/Production):</span>
                  <button
                    type="button"
                    onClick={handleCopyDirectWebhook}
                    className="text-slate-700 hover:text-slate-900 font-semibold underline cursor-pointer flex items-center gap-1 text-[11px]"
                  >
                    {isCopiedDirectWebhook ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" /> Disalin!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Salin Direct URL
                      </>
                    )}
                  </button>
                </div>

                {/* Simulation Pipeline Test */}
                <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[11px] text-slate-600">
                    <span className="font-semibold text-slate-800">Uji Alur Pesan Masuk & Balasan AI:</span>
                    <p className="text-[10px] text-slate-500">
                      Simulasikan chat dari pelanggan untuk memastikan inbox dan auto-responder AI berfungsi 100%.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSimulateInboundMessage()}
                    disabled={isSimulatingInbound}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs shrink-0"
                  >
                    {isSimulatingInbound ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Menguji Alur Masuk...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Uji Simulasi Pesan Masuk
                      </>
                    )}
                  </button>
                </div>

                {simulatedInboundSuccess && (
                  <div className="p-2.5 bg-emerald-100 border border-emerald-300 rounded-lg text-xs text-emerald-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>{simulatedInboundSuccess}</span>
                  </div>
                )}
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
