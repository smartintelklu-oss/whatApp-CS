import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Send,
  Sparkles,
  Paperclip,
  CheckCheck,
  Check,
  Bot,
  User,
  Image as ImageIcon,
  FileText,
  Phone,
  MoreVertical,
  Clock,
  Zap,
  Info,
  ChevronRight,
  Download,
  Smile,
  ShieldCheck,
  Sliders,
  X,
  MessageSquarePlus,
  UserPlus,
  AlertTriangle,
} from 'lucide-react';
import { WhatsAppContact, WhatsAppMessage, CSBotSettings } from '../types';
import { QUICK_REPLY_TEMPLATES } from '../data/initialData';

interface ChatInboxViewProps {
  contacts: WhatsAppContact[];
  messages: Record<string, WhatsAppMessage[]>;
  activeContactId: string;
  onSelectContact: (contactId: string) => void;
  onSendMessage: (
    contactId: string,
    text: string,
    sender: 'agent' | 'bot',
    options?: {
      mediaType?: 'image' | 'document' | 'none';
      mediaUrl?: string;
      mediaName?: string;
      mediaSize?: string;
      isAiGenerated?: boolean;
      aiIntent?: string;
      aiConfidence?: number;
      aiReasoning?: string;
    }
  ) => void;
  onSimulateIncomingOpen: () => void;
  isAiGenerating: boolean;
  botSettings: CSBotSettings;
  onToggleContactAi: (contactId: string) => void;
  onAddContact?: (contact: {
    name: string;
    phone: string;
    tag: 'Prospek' | 'Pelanggan Baru' | 'Komplain' | 'VIP' | 'Selesai';
    notes?: string;
    isAiAutoReplyEnabled: boolean;
  }) => Promise<any> | void;
  waStatus?: 'connected' | 'disconnected' | 'qr_ready' | 'authenticating';
  onOpenPairingModal?: () => void;
}

export const ChatInboxView: React.FC<ChatInboxViewProps> = ({
  contacts,
  messages,
  activeContactId,
  onSelectContact,
  onSendMessage,
  onSimulateIncomingOpen,
  isAiGenerating,
  botSettings,
  onToggleContactAi,
  onAddContact,
  waStatus,
  onOpenPairingModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [inputText, setInputText] = useState('');
  const [showRightDrawer, setShowRightDrawer] = useState(true);
  const [showTemplatesDropdown, setShowTemplatesDropdown] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);

  // Add Contact Modal State
  const [isAddContactModalOpen, setIsAddContactModalOpen] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactTag, setNewContactTag] = useState<'Prospek' | 'Pelanggan Baru' | 'Komplain' | 'VIP' | 'Selesai'>('Prospek');
  const [newContactNotes, setNewContactNotes] = useState('');
  const [newContactAi, setNewContactAi] = useState(true);
  const [isSavingContact, setIsSavingContact] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatImageInputRef = useRef<HTMLInputElement>(null);
  const chatDocInputRef = useRef<HTMLInputElement>(null);

  const activeContact = contacts.find((c) => c.id === activeContactId) || contacts[0];
  const activeMessages = activeContact ? messages[activeContact.id] || [] : [];

  // Auto-scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages, isAiGenerating]);

  // Handle device image selection for chat
  const handleChatImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeContact) return;

    const formattedSize =
      file.size > 1024 * 1024
        ? (file.size / (1024 * 1024)).toFixed(1) + ' MB'
        : Math.round(file.size / 1024) + ' KB';

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        onSendMessage(
          activeContact.id,
          `Berikut lampiran foto: ${file.name}`,
          'agent',
          {
            mediaType: 'image',
            mediaUrl: event.target.result as string,
            mediaName: file.name,
            mediaSize: formattedSize,
          }
        );
      }
    };
    reader.readAsDataURL(file);
    setShowAttachMenu(false);
    e.target.value = '';
  };

  // Handle device document selection for chat
  const handleChatDocSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeContact) return;

    const formattedSize =
      file.size > 1024 * 1024
        ? (file.size / (1024 * 1024)).toFixed(1) + ' MB'
        : Math.round(file.size / 1024) + ' KB';

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        onSendMessage(
          activeContact.id,
          `Berikut terlampir dokumen: ${file.name}`,
          'agent',
          {
            mediaType: 'document',
            mediaUrl: event.target.result as string,
            mediaName: file.name,
            mediaSize: formattedSize,
          }
        );
      }
    };
    reader.readAsDataURL(file);
    setShowAttachMenu(false);
    e.target.value = '';
  };

  // Handle manual send
  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activeContact) return;

    onSendMessage(activeContact.id, inputText.trim(), 'agent');
    setInputText('');
    setShowTemplatesDropdown(false);
    setShowAttachMenu(false);
  };

  // Generate Smart Draft with Gemini
  const handleGenerateSmartReply = async () => {
    if (!activeContact) return;
    setIsGeneratingDraft(true);

    try {
      const history = activeMessages.slice(-5).map((m) => ({
        sender: m.sender === 'customer' ? activeContact.name : 'CS',
        text: m.text,
      }));

      const lastCustomerMsg =
        [...activeMessages].reverse().find((m) => m.sender === 'customer')?.text ||
        'Halo CS, saya butuh bantuan.';

      const res = await fetch('/api/chat/smart-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incomingMessage: lastCustomerMsg,
          customerName: activeContact.name,
          customerPhone: activeContact.phone,
          conversationHistory: history,
          botTone: botSettings.botTone,
        }),
      });

      const json = await res.json();
      if (json.success && json.data?.replyText) {
        setInputText(json.data.replyText);
      }
    } catch (err) {
      console.error('Failed to generate smart reply', err);
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  // Attach sample image
  const handleAttachImage = () => {
    if (!activeContact) return;
    onSendMessage(
      activeContact.id,
      'Berikut kami lampirkan gambar voucher promo dan detail produk pesanan Kakak:',
      'agent',
      {
        mediaType: 'image',
        mediaUrl: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&auto=format&fit=crop&q=80',
        mediaName: 'Voucher_Promo_25.jpg',
        mediaSize: '480 KB',
      }
    );
    setShowAttachMenu(false);
  };

  // Attach sample PDF document
  const handleAttachDocument = () => {
    if (!activeContact) return;
    onSendMessage(
      activeContact.id,
      'Terlampir dokumen resmi E-Katalog & Panduan Garansi Toko Nusantara Digital:',
      'agent',
      {
        mediaType: 'document',
        mediaName: 'Katalog_Resmi_Gadget_Nusantara.pdf',
        mediaSize: '2.8 MB',
        mediaUrl: '#',
      }
    );
    setShowAttachMenu(false);
  };

  // Filter contacts
  const filteredContacts = contacts.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm);
    if (!matchesSearch) return false;
    if (filterTag === 'all') return true;
    if (filterTag === 'unread') return c.unreadCount > 0;
    return c.tag === filterTag;
  });

  return (
    <div className="flex-1 flex h-full overflow-hidden bg-white">
      {/* 1. Left Sidebar: Contacts List */}
      <div className="w-80 sm:w-96 border-r border-slate-200 flex flex-col bg-white shrink-0">
        {/* Search & Actions Bar */}
        <div className="p-3.5 border-b border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider truncate">
              Pelanggan ({contacts.length})
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setIsAddContactModalOpen(true)}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-semibold rounded-lg flex items-center gap-1 transition-all shadow-2xs cursor-pointer"
                title="Tambah nomor kontak pelanggan baru ke semua perangkat"
              >
                <UserPlus className="w-3.5 h-3.5" /> Tambah Kontak
              </button>
              <button
                onClick={onSimulateIncomingOpen}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors border border-slate-200 cursor-pointer"
                title="Simulasikan pesan masuk dari pelanggan"
              >
                <MessageSquarePlus className="w-3.5 h-3.5" /> Uji Chat
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nama atau nomor WhatsApp..."
              className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Tag Filter Segmented Controls */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar text-xs">
            <button
              onClick={() => setFilterTag('all')}
              className={`px-2.5 py-1 rounded-md shrink-0 transition-colors ${
                filterTag === 'all'
                  ? 'bg-slate-900 text-white font-medium'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setFilterTag('unread')}
              className={`px-2.5 py-1 rounded-md shrink-0 transition-colors ${
                filterTag === 'unread'
                  ? 'bg-emerald-600 text-white font-medium'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Belum Dibaca
            </button>
            <button
              onClick={() => setFilterTag('Prospek')}
              className={`px-2.5 py-1 rounded-md shrink-0 transition-colors ${
                filterTag === 'Prospek'
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Prospek
            </button>
            <button
              onClick={() => setFilterTag('Komplain')}
              className={`px-2.5 py-1 rounded-md shrink-0 transition-colors ${
                filterTag === 'Komplain'
                  ? 'bg-amber-600 text-white font-medium'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Komplain
            </button>
            <button
              onClick={() => setFilterTag('VIP')}
              className={`px-2.5 py-1 rounded-md shrink-0 transition-colors ${
                filterTag === 'VIP'
                  ? 'bg-purple-600 text-white font-medium'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              VIP
            </button>
          </div>
        </div>

        {/* Contacts Scrollable List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filteredContacts.map((contact) => {
            const isSelected = contact.id === activeContactId;
            const contactMessages = messages[contact.id] || [];
            const lastMsg = contactMessages[contactMessages.length - 1];

            return (
              <div
                key={contact.id}
                onClick={() => onSelectContact(contact.id)}
                className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
                  isSelected ? 'bg-emerald-50/70 border-l-4 border-emerald-600' : 'hover:bg-slate-50'
                }`}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <img
                    src={contact.avatar}
                    alt={contact.name}
                    className="w-11 h-11 rounded-full object-cover border border-slate-200"
                  />
                  {contact.isAiAutoReplyEnabled && (
                    <span
                      title="AI Auto-Reply Aktif"
                      className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-600 text-white rounded-full flex items-center justify-center text-[9px] shadow-xs"
                    >
                      <Zap className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-slate-900 truncate">
                      {contact.name}
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {lastMsg ? lastMsg.timestamp : contact.lastMessageTime}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs text-slate-500 truncate">
                      {lastMsg
                        ? (lastMsg.sender === 'agent' ? 'Anda: ' : lastMsg.sender === 'bot' ? '🤖 AI: ' : '') +
                          lastMsg.text
                        : 'Belum ada pesan.'}
                    </p>

                    {contact.unreadCount > 0 && (
                      <span className="w-4 h-4 bg-emerald-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center shrink-0">
                        {contact.unreadCount}
                      </span>
                    )}
                  </div>

                  {/* Tag & Phone as clean unboxed text */}
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1">
                    <span>{contact.phone}</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        contact.tag === 'Komplain'
                          ? 'text-amber-700 font-medium'
                          : contact.tag === 'VIP'
                          ? 'text-purple-700 font-medium'
                          : contact.tag === 'Prospek'
                          ? 'text-blue-700 font-medium'
                          : 'text-slate-600'
                      }
                    >
                      {contact.tag}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Center: Chat Thread */}
      {activeContact ? (
        <div className="flex-1 flex flex-col h-full bg-[#efeae2] relative min-w-0">
          {/* Subtle WhatsApp doodle background overlay */}
          <div
            className="absolute inset-0 opacity-15 pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(#000 1px, transparent 1px)`,
              backgroundSize: '20px 20px',
            }}
          />

          {/* Active Contact Header */}
          <div className="relative z-10 px-5 py-3 bg-white border-b border-slate-200 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-3">
              <img
                src={activeContact.avatar}
                alt={activeContact.name}
                className="w-10 h-10 rounded-full object-cover border border-slate-200"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-slate-900 leading-tight">
                    {activeContact.name}
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {activeContact.phone}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Online · WhatsApp Mobile</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-700 font-medium">Tag: {activeContact.tag}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {waStatus === 'connected' ? (
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                  WA Terhubung
                </span>
              ) : (
                <button
                  onClick={onOpenPairingModal}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 cursor-pointer"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  Tautkan WA
                </button>
              )}

              {/* Contact AI Toggle */}
              <button
                onClick={() => onToggleContactAi(activeContact.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                  activeContact.isAiAutoReplyEnabled
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                }`}
                title="Aktifkan atau nonaktifkan respon otomatis AI untuk kontak ini"
              >
                <Zap className="w-3.5 h-3.5 text-emerald-600" />
                {activeContact.isAiAutoReplyEnabled ? 'Auto-Reply: ON' : 'Auto-Reply: OFF'}
              </button>

              {/* Toggle Info Drawer */}
              <button
                onClick={() => setShowRightDrawer(!showRightDrawer)}
                className={`p-2 rounded-lg border transition-colors ${
                  showRightDrawer
                    ? 'bg-slate-100 border-slate-300 text-slate-800'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
                title="Buka/Tutup Ringkasan Pelanggan"
              >
                <Sliders className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Warning Banner if WhatsApp Disconnected */}
          {waStatus !== 'connected' && (
            <div className="relative z-10 px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between text-xs text-amber-900 gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Perhatian:</strong> WhatsApp belum terhubung. Pesan Anda tersimpan di sistem, namun belum terkirim ke ponsel pelanggan sampai sesi WhatsApp ditautkan.
                </span>
              </div>
              <button
                onClick={onOpenPairingModal}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold shrink-0 cursor-pointer shadow-2xs"
              >
                Tautkan WA
              </button>
            </div>
          )}

          {/* Messages Feed */}
          <div className="relative z-10 flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5">
            {/* Encryption notice */}
            <div className="text-center my-2">
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 bg-amber-50 border border-amber-200/60 px-3 py-1 rounded-lg shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                Pesan dienkripsi end-to-end melalui WhatsApp Business Gateway.
              </span>
            </div>

            {activeMessages.map((msg) => {
              const isMe = msg.sender === 'agent' || msg.sender === 'bot';

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group`}
                >
                  <div
                    className={`relative max-w-[85%] sm:max-w-[70%] rounded-2xl p-3 shadow-xs ${
                      isMe
                        ? 'bg-[#d9fdd3] text-slate-900 rounded-tr-xs'
                        : 'bg-white text-slate-900 rounded-tl-xs'
                    }`}
                  >
                    {/* Bot / Agent Badge */}
                    {msg.sender === 'bot' && (
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-md mb-1.5 w-fit">
                        <Sparkles className="w-3 h-3 text-emerald-600" /> Dibalas Otomatis oleh Gemini AI
                        {msg.aiIntent && (
                          <span className="text-emerald-700 font-normal">
                            · [{msg.aiIntent}]
                          </span>
                        )}
                      </div>
                    )}

                    {/* Image Attachment */}
                    {msg.mediaType === 'image' && msg.mediaUrl && (
                      <div className="mb-2 rounded-xl overflow-hidden cursor-pointer">
                        <img
                          src={msg.mediaUrl}
                          alt={msg.mediaName || 'Media'}
                          onClick={() => setSelectedImagePreview(msg.mediaUrl!)}
                          className="w-full max-h-60 object-cover hover:opacity-95 transition-opacity"
                        />
                        <div className="text-[10px] text-slate-600 pt-1 flex items-center justify-between">
                          <span>{msg.mediaName}</span>
                          <span>{msg.mediaSize}</span>
                        </div>
                      </div>
                    )}

                    {/* Document Attachment */}
                    {msg.mediaType === 'document' && (
                      <div className="mb-2 p-2.5 bg-white/80 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 truncate">
                          <div className="p-2 bg-red-600 text-white rounded-lg">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="truncate">
                            <div className="text-xs font-semibold text-slate-900 truncate">
                              {msg.mediaName}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Dokumen PDF · {msg.mediaSize}
                            </div>
                          </div>
                        </div>
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            alert(`Simulasi: Mengunduh file ${msg.mediaName}`);
                          }}
                          className="p-1.5 text-slate-600 hover:text-emerald-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors shrink-0"
                          title="Unduh Dokumen"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}

                    {/* Message Text */}
                    <div className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed font-sans">
                      {msg.text}
                    </div>

                    {/* Footer Info: Timestamp & Ticks */}
                    <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 mt-1">
                      <span>{msg.timestamp}</span>
                      {isMe && (
                        <span>
                          {msg.status === 'read' ? (
                            <span title="Dibaca di WhatsApp Pelanggan">
                              <CheckCheck className="w-3.5 h-3.5 text-blue-500 inline" />
                            </span>
                          ) : msg.status === 'delivered' ? (
                            <span title="Tersampaikan ke WhatsApp Pelanggan">
                              <CheckCheck className="w-3.5 h-3.5 text-slate-400 inline" />
                            </span>
                          ) : (
                            <span title="Terkirim dari Sistem">
                              <Check className="w-3.5 h-3.5 text-slate-400 inline" />
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* AI Reasoning Tooltip / Footnote if present */}
                  {msg.aiReasoning && (
                    <span className="text-[10px] text-slate-500 px-1 mt-0.5 italic">
                      Analisis AI: {msg.aiReasoning}
                    </span>
                  )}
                </div>
              );
            })}

            {/* AI Typing Indicator */}
            {isAiGenerating && (
              <div className="flex items-start">
                <div className="bg-white rounded-2xl rounded-tl-xs px-4 py-2.5 shadow-xs flex items-center gap-2">
                  <Bot className="w-4 h-4 text-emerald-600 animate-pulse" />
                  <span className="text-xs text-slate-600 font-medium">
                    Asisten AI sedang menyusun balasan pintar...
                  </span>
                  <div className="flex gap-1 ml-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"></span>
                    <span
                      className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"
                      style={{ animationDelay: '0.15s' }}
                    ></span>
                    <span
                      className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"
                      style={{ animationDelay: '0.3s' }}
                    ></span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Templates Drawer / Dropdown */}
          {showTemplatesDropdown && (
            <div className="relative z-20 px-4 py-2 bg-slate-50 border-t border-slate-200">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-700">
                  Pilih Templat Cepat (Quick Reply):
                </span>
                <button
                  onClick={() => setShowTemplatesDropdown(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {QUICK_REPLY_TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputText(tmpl.text);
                      setShowTemplatesDropdown(false);
                    }}
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:border-emerald-500 text-xs font-medium text-slate-700 rounded-lg shrink-0 transition-colors shadow-2xs"
                  >
                    {tmpl.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Attach Menu Dropdown */}
          {showAttachMenu && (
            <div className="relative z-20 px-4 py-2 bg-slate-100 border-t border-slate-200 flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-700">Lampirkan ke WhatsApp:</span>
              <button
                onClick={handleAttachImage}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:border-emerald-600 text-xs font-medium rounded-lg flex items-center gap-1.5 text-slate-700 shadow-2xs"
              >
                <ImageIcon className="w-3.5 h-3.5 text-emerald-600" /> Gambar Promosi (Voucher/Banner)
              </button>
              <button
                onClick={handleAttachDocument}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:border-emerald-600 text-xs font-medium rounded-lg flex items-center gap-1.5 text-slate-700 shadow-2xs"
              >
                <FileText className="w-3.5 h-3.5 text-red-600" /> Dokumen Resmi (PDF Katalog/Invoice)
              </button>
              <button
                onClick={() => setShowAttachMenu(false)}
                className="ml-auto text-xs text-slate-400 hover:text-slate-600"
              >
                Tutup
              </button>
            </div>
          )}

          {/* Bottom Chat Input Form */}
          <div className="relative z-10 p-3 bg-white border-t border-slate-200">
            <form onSubmit={handleSend} className="flex items-center gap-2">
              {/* Attachment Button */}
              <button
                type="button"
                onClick={() => setShowAttachMenu(!showAttachMenu)}
                className={`p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors ${
                  showAttachMenu ? 'bg-slate-100 text-emerald-700' : ''
                }`}
                title="Lampirkan Gambar atau Dokumen"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              {/* Quick Template Button */}
              <button
                type="button"
                onClick={() => setShowTemplatesDropdown(!showTemplatesDropdown)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  showTemplatesDropdown
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
                title="Buka Templat Jawaban Cepat"
              >
                Templat CS
              </button>

              {/* Text Input */}
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ketik balasan untuk pelanggan..."
                className="flex-1 text-xs sm:text-sm px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />

              {/* AI Draft Suggestion Button */}
              <button
                type="button"
                onClick={handleGenerateSmartReply}
                disabled={isGeneratingDraft}
                className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0"
                title="Generate draft balasan dengan Gemini AI"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span className="hidden sm:inline">
                  {isGeneratingDraft ? 'Memikirkan...' : 'Draft Balasan Pintar'}
                </span>
              </button>

              {/* Send Button */}
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="p-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl transition-colors shadow-xs shrink-0"
                title="Kirim pesan"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 text-slate-400 p-8">
          <Bot className="w-12 h-12 mb-3 text-slate-300" />
          <h3 className="text-base font-semibold text-slate-700">Pilih Percakapan Pelanggan</h3>
          <p className="text-xs text-slate-500 mt-1">
            Pilih kontak di sebelah kiri untuk melihat pesan dan riwayat auto-reply.
          </p>
        </div>
      )}

      {/* 3. Right Sidebar: Customer Dossier & AI Smart Reply Assistant */}
      {showRightDrawer && activeContact && (
        <div className="w-80 border-l border-slate-200 bg-white p-5 flex flex-col overflow-y-auto space-y-5 shrink-0">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Profil Pelanggan
            </span>
            <button
              onClick={() => setShowRightDrawer(false)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Contact summary */}
          <div className="text-center">
            <img
              src={activeContact.avatar}
              alt={activeContact.name}
              className="w-16 h-16 rounded-full object-cover mx-auto border-2 border-slate-200 mb-2"
            />
            <h4 className="font-bold text-sm text-slate-900">{activeContact.name}</h4>
            <p className="text-xs text-slate-500 font-mono">{activeContact.phone}</p>
            <div className="mt-2 inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800">
              Kategori: {activeContact.tag}
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
            <div>
              <div className="text-[10px] text-slate-400 uppercase">Total Pesanan</div>
              <div className="text-sm font-bold text-slate-900">
                {activeContact.totalOrders ?? 1}x
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase">Nilai Belanja</div>
              <div className="text-xs font-bold text-emerald-700 mt-0.5">
                {activeContact.lifetimeValue ?? 'Rp 1.500.000'}
              </div>
            </div>
          </div>

          {/* Internal Notes */}
          <div>
            <span className="text-xs font-semibold text-slate-700 block mb-1">
              Catatan Khusus CS:
            </span>
            <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed">
              {activeContact.notes || 'Belum ada catatan khusus untuk pelanggan ini.'}
            </div>
          </div>

          {/* Smart AI Assistant Box for this contact */}
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              Status Auto-Reply Kontak
            </div>

            <p className="text-xs text-emerald-800">
              {activeContact.isAiAutoReplyEnabled
                ? 'AI aktif membaca dan membalas pertanyaan pelanggan ini secara otomatis.'
                : 'Auto-reply dijeda. Kontak ini ditangani langsung oleh CS manusia.'}
            </p>

            <button
              onClick={() => onToggleContactAi(activeContact.id)}
              className={`w-full py-2 px-3 text-xs font-semibold rounded-lg transition-colors shadow-2xs ${
                activeContact.isAiAutoReplyEnabled
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {activeContact.isAiAutoReplyEnabled
                ? 'Alihkan ke CS Manusia (Pause AI)'
                : 'Aktifkan Kembali Auto-Reply AI'}
            </button>
          </div>

          {/* Quick Actions */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <span className="text-xs font-semibold text-slate-700 block mb-1">
              Tindakan Cepat:
            </span>
            <button
              onClick={handleAttachDocument}
              className="w-full text-left p-2.5 bg-slate-50 hover:bg-slate-100 rounded-lg text-xs font-medium text-slate-800 flex items-center justify-between border border-slate-200 transition-colors"
            >
              <span className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-red-600" /> Kirim PDF E-Katalog
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
            <button
              onClick={handleAttachImage}
              className="w-full text-left p-2.5 bg-slate-50 hover:bg-slate-100 rounded-lg text-xs font-medium text-slate-800 flex items-center justify-between border border-slate-200 transition-colors"
            >
              <span className="flex items-center gap-2">
                <ImageIcon className="w-3.5 h-3.5 text-emerald-600" /> Kirim Banner Promo Gajian
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>
      )}

      {/* Lightbox Image Preview Modal */}
      {selectedImagePreview && (
        <div
          onClick={() => setSelectedImagePreview(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <div className="relative max-w-3xl max-h-[85vh]">
            <img
              src={selectedImagePreview}
              alt="Pratinjau Gambar"
              className="max-w-full max-h-[85vh] object-contain rounded-xl"
            />
            <button
              onClick={() => setSelectedImagePreview(null)}
              className="absolute -top-3 -right-3 p-1.5 bg-white text-slate-900 rounded-full shadow-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Tambah Pelanggan Baru Modal (Syncs Across All Devices) */}
      {isAddContactModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-emerald-800 text-white">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-900/80 rounded-xl">
                  <UserPlus className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">Tambah Pelanggan Baru</h3>
                  <p className="text-[11px] text-emerald-200">Tersinkronisasi otomatis ke semua perangkat</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddContactModalOpen(false)}
                className="p-1 rounded-lg hover:bg-emerald-700/60 text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newContactName.trim() || !newContactPhone.trim()) return;
                setIsSavingContact(true);
                try {
                  if (onAddContact) {
                    await onAddContact({
                      name: newContactName.trim(),
                      phone: newContactPhone.trim(),
                      tag: newContactTag,
                      notes: newContactNotes.trim(),
                      isAiAutoReplyEnabled: newContactAi,
                    });
                  }
                  setIsAddContactModalOpen(false);
                  setNewContactName('');
                  setNewContactPhone('');
                  setNewContactNotes('');
                } catch (err) {
                  console.error(err);
                } finally {
                  setIsSavingContact(false);
                }
              }}
              className="p-5 space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Pelanggan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  placeholder="Contoh: Hendra Setiawan"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor WhatsApp <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                  placeholder="Contoh: 081234567890 atau +62 812-3456-7890"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Nomor dengan awalan 08... akan otomatis dikonversi ke format resmi +62... agar pesan dapat sampai ke WhatsApp pelanggan.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kategori / Tag
                  </label>
                  <select
                    value={newContactTag}
                    onChange={(e) => setNewContactTag(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Prospek">Prospek</option>
                    <option value="Pelanggan Baru">Pelanggan Baru</option>
                    <option value="VIP">VIP</option>
                    <option value="Komplain">Komplain</option>
                    <option value="Selesai">Selesai</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={newContactAi}
                      onChange={(e) => setNewContactAi(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs font-semibold text-slate-700">Auto-Reply AI Aktif</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Pelanggan (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={newContactNotes}
                  onChange={(e) => setNewContactNotes(e.target.value)}
                  placeholder="Informasi kebutuhan, riwayat tanya produk, dll..."
                  className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddContactModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingContact}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-lg text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  {isSavingContact ? 'Menyimpan...' : 'Simpan & Sinkronkan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
