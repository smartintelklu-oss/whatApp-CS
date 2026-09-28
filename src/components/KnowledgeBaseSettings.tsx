import React, { useState } from 'react';
import {
  BookOpen,
  Bot,
  Sparkles,
  Save,
  Check,
  Send,
  Zap,
  ShieldAlert,
  Clock,
  MessageSquare,
  HelpCircle,
  Sliders,
} from 'lucide-react';
import { CSBotSettings } from '../types';

interface KnowledgeBaseSettingsProps {
  settings: CSBotSettings;
  onSaveSettings: (newSettings: CSBotSettings) => void;
}

export const KnowledgeBaseSettings: React.FC<KnowledgeBaseSettingsProps> = ({
  settings,
  onSaveSettings,
}) => {
  const [currentSettings, setCurrentSettings] = useState<CSBotSettings>(settings);
  const [isSaved, setIsSaved] = useState(false);

  // Live Playground Test State
  const [testQuestion, setTestQuestion] = useState('Apakah ada diskon untuk pembelian 5 unit smartphone?');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    replyText: string;
    intent: string;
    confidence: number;
    aiReasoning: string;
  } | null>(null);

  const handleSave = () => {
    onSaveSettings(currentSettings);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleRunTest = async () => {
    if (!testQuestion.trim()) return;
    setIsTesting(true);

    try {
      const res = await fetch('/api/chat/smart-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incomingMessage: testQuestion,
          customerName: 'Pelanggan Uji Coba',
          customerPhone: '+62 812-9988-7766',
          botTone: currentSettings.botTone,
          customInstructions: 'Jawab sesuai knowledge base perusahaan saat ini.',
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setTestResult(json.data);
      }
    } catch (err) {
      console.error('Failed to test smart reply', err);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-y-auto">
      {/* Header */}
      <div className="px-8 py-6 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 uppercase tracking-wider">
              <Bot className="w-4 h-4" /> Konfigurasi AI & Basis Pengetahuan
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">
              Aturan Balasan Pintar & Knowledge Base
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Atur bagaimana Asisten Gemini AI memahami informasi toko, produk, kebijakan retur, dan gaya bahasa saat membalas pesan WhatsApp.
            </p>
          </div>

          <button
            onClick={handleSave}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-xs transition-colors"
          >
            {isSaved ? (
              <>
                <Check className="w-4 h-4" /> Tersimpan!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Simpan Perubahan
              </>
            )}
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto w-full px-8 py-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Knowledge Base & Bot Persona Settings */}
          <div className="lg:col-span-2 space-y-6">
            {/* Persona & Tone Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
              <div className="flex items-center gap-2 text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
                <Sliders className="w-4 h-4 text-emerald-600" /> Pengaturan Gaya Bahasa & Perilaku Bot
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tone Selector */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    Gaya Bahasa CS (Persona Tone):
                  </label>
                  <select
                    value={currentSettings.botTone}
                    onChange={(e) =>
                      setCurrentSettings({
                        ...currentSettings,
                        botTone: e.target.value as any,
                      })
                    }
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="ramah_sopan">Ramah, Sopan & Empatik (Standar CS)</option>
                    <option value="profesional">Profesional & Formal (B2B)</option>
                    <option value="santai">Kasual & Akrab (Gen-Z & Komunitas)</option>
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Mempengaruhi pemilihan sapaan (*Kak*, *Bapak/Ibu*) dan penggunaan emoji.
                  </p>
                </div>

                {/* Delay Response */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    Jeda Waktu Mengetik (Typing Delay):
                  </label>
                  <select
                    value={currentSettings.responseDelaySec}
                    onChange={(e) =>
                      setCurrentSettings({
                        ...currentSettings,
                        responseDelaySec: parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value={0}>Instan (0 detik)</option>
                    <option value={2}>Alami (2 detik) - Disarankan</option>
                    <option value={4}>Santai (4 detik)</option>
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Menampilkan status "sedang mengetik..." sebelum mengirim balasan.
                  </p>
                </div>
              </div>

              {/* Switches */}
              <div className="space-y-3 pt-2">
                <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                  <div>
                    <div className="text-xs font-semibold text-slate-800">
                      Aktifkan Balasan Pintar Otomatis (Master Switch)
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Izinkan AI merespons pesan WhatsApp masuk secara mandiri.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={currentSettings.isAutoReplyActive}
                    onChange={(e) =>
                      setCurrentSettings({
                        ...currentSettings,
                        isAutoReplyActive: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-emerald-600 rounded-sm focus:ring-emerald-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                  <div>
                    <div className="text-xs font-semibold text-slate-800">
                      Notifikasi Eskalasi ke Agen Manusia
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Kirimkan alert ketika ada keluhan sensitif atau permintaan agen manusia.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={currentSettings.notifyHumanOnEscalation}
                    onChange={(e) =>
                      setCurrentSettings({
                        ...currentSettings,
                        notifyHumanOnEscalation: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-emerald-600 rounded-sm focus:ring-emerald-500"
                  />
                </label>
              </div>
            </div>

            {/* Knowledge Base Editor */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-base font-bold text-slate-900">
                  <BookOpen className="w-4 h-4 text-emerald-600" /> Basis Pengetahuan (Knowledge Base)
                </div>
                <span className="text-[11px] text-slate-400">
                  Didukung oleh Gemini 3.8 Flash
                </span>
              </div>

              <p className="text-xs text-slate-500">
                Tuliskan informasi lengkap mengenai toko Anda: produk, harga, nomor rekening resmi, kurir pengiriman, ketentuan garansi, dan jam kerja. AI akan selalu mengacu pada data ini.
              </p>

              <textarea
                value={currentSettings.knowledgeBase}
                onChange={(e) =>
                  setCurrentSettings({
                    ...currentSettings,
                    knowledgeBase: e.target.value,
                  })
                }
                rows={16}
                className="w-full text-xs font-mono p-4 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed resize-y"
                placeholder="Tuliskan basis pengetahuan toko di sini..."
              />
            </div>
          </div>

          {/* Right Col: Sandbox & Live Testing Drawer */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs sticky top-6 space-y-4">
              <div className="flex items-center gap-2 text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
                <Sparkles className="w-4 h-4 text-amber-500" /> Uji Coba Balasan Pintar (Sandbox)
              </div>

              <p className="text-xs text-slate-500">
                Uji langsung bagaimana Gemini merespons pertanyaan pelanggan berdasarkan knowledge base yang Anda tulis di samping.
              </p>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Pertanyaan Uji Coba:
                </label>
                <div className="space-y-2">
                  <textarea
                    value={testQuestion}
                    onChange={(e) => setTestQuestion(e.target.value)}
                    rows={3}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Ketik pertanyaan pelanggan..."
                  />
                  <button
                    onClick={handleRunTest}
                    disabled={isTesting || !testQuestion.trim()}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition-colors disabled:opacity-50"
                  >
                    {isTesting ? (
                      'Memproses dengan Gemini...'
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5" /> Jalankan Tes AI
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Test Result Display */}
              {testResult && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-700">Hasil Analisis AI:</span>
                    <span className="text-emerald-700 font-mono font-semibold">
                      Keyakinan: {(testResult.confidence * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">INTENT TERDETEKSI:</span>
                    <span className="text-xs font-medium text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {testResult.intent}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">DRAFT JAWABAN WHATSAPP:</span>
                    <div className="text-xs p-3 bg-emerald-50 text-emerald-950 rounded-lg border border-emerald-200 whitespace-pre-wrap font-sans">
                      {testResult.replyText}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">ALASAN REKOMENDASI AI:</span>
                    <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded border border-slate-200">
                      {testResult.aiReasoning}
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Prompts Suggestions */}
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[11px] font-semibold text-slate-600 block mb-2">
                  Pertanyaan Populer untuk Dites:
                </span>
                <div className="space-y-1.5">
                  {[
                    'Apakah ada garansi jika headphone rusak dalam 3 hari?',
                    'Bisa bayar pakai transfer Bank Mandiri?',
                    'Berapa harga fast charger 65W GaN dan ongkir ke Surabaya?',
                  ].map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => setTestQuestion(q)}
                      className="w-full text-left text-[11px] text-slate-600 hover:text-emerald-700 p-1.5 rounded hover:bg-slate-100 transition-colors truncate block"
                    >
                      • {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
