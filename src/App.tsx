import React, { useState, useEffect } from 'react';
import {
  INITIAL_CONTACTS,
  INITIAL_MESSAGES,
  INITIAL_SCHEDULED_MESSAGES,
  INITIAL_BOT_SETTINGS,
} from './data/initialData';
import { WhatsAppContact, WhatsAppMessage, ScheduledMessage, CSBotSettings } from './types';
import { HeaderNavbar } from './components/HeaderNavbar';
import { ChatInboxView } from './components/ChatInboxView';
import { ScheduledMessagesView } from './components/ScheduledMessagesView';
import { KnowledgeBaseSettings } from './components/KnowledgeBaseSettings';
import { AnalyticsOverview } from './components/AnalyticsOverview';
import { WhatsAppPairingModal } from './components/WhatsAppPairingModal';
import { MessageSimulatorModal } from './components/MessageSimulatorModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<'inbox' | 'scheduled' | 'knowledge' | 'analytics'>('inbox');
  const [contacts, setContacts] = useState<WhatsAppContact[]>(INITIAL_CONTACTS);
  const [messages, setMessages] = useState<Record<string, WhatsAppMessage[]>>(INITIAL_MESSAGES);
  const [activeContactId, setActiveContactId] = useState<string>('c1');
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>(INITIAL_SCHEDULED_MESSAGES);
  const [botSettings, setBotSettings] = useState<CSBotSettings>(INITIAL_BOT_SETTINGS);

  // WhatsApp connection state
  const [waStatus, setWaStatus] = useState<'connected' | 'disconnected' | 'qr_ready' | 'authenticating'>('qr_ready');
  const [waPhone, setWaPhone] = useState<string>('+62 812-9876-5432');
  const [connectedAt, setConnectedAt] = useState<string>(new Date().toISOString());

  // Sync contacts, messages, and WhatsApp status with central server (Shared across all devices)
  const syncServerData = () => {
    fetch('/api/contacts')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.contacts) && data.contacts.length > 0) {
          setContacts(data.contacts);
        }
      })
      .catch((err) => console.error('Failed to sync contacts:', err));

    fetch('/api/messages')
      .then((res) => res.json())
      .then((data) => {
        if (data?.messages && typeof data.messages === 'object') {
          setMessages(data.messages);
        }
      })
      .catch((err) => console.error('Failed to sync messages:', err));

    fetch('/api/whatsapp/status')
      .then((res) => res.json())
      .then((data) => {
        if (data?.session) {
          setWaStatus(data.session.status);
          if (data.session.phoneNumber) setWaPhone(data.session.phoneNumber);
          if (data.session.connectedAt) setConnectedAt(data.session.connectedAt);
        }
      })
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    syncServerData();

    // Auto-sync every 3 seconds so incoming messages & contacts appear across all devices in real-time
    const interval = setInterval(syncServerData, 3000);
    return () => clearInterval(interval);
  }, []);

  // Modals state
  const [isPairingModalOpen, setIsPairingModalOpen] = useState<boolean>(false);
  const [isSimulatorModalOpen, setIsSimulatorModalOpen] = useState<boolean>(false);
  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false);
  const [totalAutoReplies, setTotalAutoReplies] = useState<number>(0);

  // Total unread count across contacts
  const totalUnread = contacts.reduce((sum, c) => sum + c.unreadCount, 0);

  // Background ticker for scheduled messages
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setScheduledMessages((prev) =>
        prev.map((item) => {
          if (item.status === 'pending' && new Date(item.scheduledTime).getTime() <= now) {
            // Execute scheduled message into chat
            handleExecuteScheduledMessage(item);
            return {
              ...item,
              status: 'sent',
              sentCount: item.totalRecipients,
            };
          }
          return item;
        })
      );
    }, 5000);

    return () => clearInterval(interval);
  }, [contacts]);

  // When a scheduled message fires or is triggered manually
  const handleExecuteScheduledMessage = (item: ScheduledMessage) => {
    const targetContacts =
      item.targetType === 'all'
        ? contacts
        : item.targetType === 'tag'
        ? contacts.filter((c) => c.tag === item.targetValue)
        : contacts.filter((c) => c.id === item.targetValue || c.phone === item.targetValue);

    const recipients = targetContacts.length > 0 ? targetContacts : [contacts[0]];

    recipients.forEach((contact) => {
      if (!contact) return;
      handleSendMessage(contact.id, item.messageText, 'agent', {
        mediaType: item.mediaType,
        mediaUrl: item.mediaUrl,
        mediaName: item.mediaName,
        mediaSize: item.mediaSize,
      });
    });
  };

  // Instant trigger for scheduled message test
  const handleInstantTriggerSchedule = (item: ScheduledMessage) => {
    handleExecuteScheduledMessage(item);
    setScheduledMessages((prev) =>
      prev.map((m) => (m.id === item.id ? { ...m, status: 'sent', sentCount: m.totalRecipients } : m))
    );
  };

  // Add new scheduled message
  const handleAddSchedule = (newSchedule: Omit<ScheduledMessage, 'id' | 'createdAt' | 'sentCount' | 'status'>) => {
    const item: ScheduledMessage = {
      ...newSchedule,
      id: 'sch_' + Date.now(),
      status: 'pending',
      sentCount: 0,
      createdAt: new Date().toISOString(),
    };
    setScheduledMessages((prev) => [item, ...prev]);
  };

  // Delete scheduled message
  const handleDeleteSchedule = (id: string) => {
    setScheduledMessages((prev) => prev.filter((m) => m.id !== id));
  };

  // Add contact to server and local state (Available across all devices)
  const handleAddContact = async (contactData: {
    name: string;
    phone: string;
    tag: 'Prospek' | 'Pelanggan Baru' | 'Komplain' | 'VIP' | 'Selesai';
    notes?: string;
    isAiAutoReplyEnabled: boolean;
  }) => {
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactData),
      });
      const data = await res.json();
      if (data.success && data.contact) {
        setContacts((prev) => {
          const filtered = prev.filter((c) => c.id !== data.contact.id);
          return [data.contact, ...filtered];
        });
        setActiveContactId(data.contact.id);
        setActiveTab('inbox');
        return data.contact;
      }
    } catch (err) {
      console.error('Error adding contact:', err);
    }
  };

  // Send message manually from agent or bot (Real WhatsApp Delivery)
  const handleSendMessage = (
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
  ) => {
    const tempId = 'msg_' + Date.now();
    const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const targetContact = contacts.find((c) => c.id === contactId);

    const tempMsg: WhatsAppMessage = {
      id: tempId,
      contactId,
      sender,
      senderName: sender === 'bot' ? 'Asisten CS AI' : 'CS Admin',
      text,
      timestamp: timeStr,
      status: 'sent',
      mediaType: options?.mediaType || 'none',
      mediaUrl: options?.mediaUrl,
      mediaName: options?.mediaName,
      mediaSize: options?.mediaSize,
      isAiGenerated: options?.isAiGenerated,
      aiIntent: options?.aiIntent,
      aiConfidence: options?.aiConfidence,
      aiReasoning: options?.aiReasoning,
    };

    // Optimistic UI update
    setMessages((prev) => ({
      ...prev,
      [contactId]: [...(prev[contactId] || []), tempMsg],
    }));

    // Update contact preview
    setContacts((prev) =>
      prev.map((c) =>
        c.id === contactId
          ? {
              ...c,
              lastMessageTime: timeStr,
              unreadCount: 0,
            }
          : c
      )
    );

    // Call server to send through WhatsApp Web gateway and persist
    fetch('/api/whatsapp/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactId,
        recipientPhone: targetContact?.phone,
        text,
        mediaType: options?.mediaType || 'none',
        mediaUrl: options?.mediaUrl,
        mediaName: options?.mediaName,
        mediaSize: options?.mediaSize,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.message) {
          // Replace temp message with server confirmed message
          setMessages((prev) => ({
            ...prev,
            [contactId]: [
              ...(prev[contactId] || []).filter((m) => m.id !== tempId),
              data.message,
            ],
          }));
        }
      })
      .catch((err) => {
        console.error('Failed to send message via gateway:', err);
      });
  };

  // Simulate Incoming Message from a customer
  const handleSimulateIncoming = async (
    contactId: string,
    messageText: string,
    customContact?: { name: string; phone: string }
  ) => {
    let targetContactId = contactId;

    // If new customer
    if (contactId === 'new_custom' && customContact) {
      const newId = 'cust_' + Date.now();
      const newContact: WhatsAppContact = {
        id: newId,
        name: customContact.name,
        phone: customContact.phone,
        avatar: `https://images.unsplash.com/photo-${1534528741775 + Math.floor(Math.random() * 1000)}?w=150&auto=format&fit=crop&q=80`,
        unreadCount: 1,
        tag: 'Prospek',
        lastMessageTime: 'Baru saja',
        notes: 'Pelanggan baru dari simulasi pesan WhatsApp.',
        totalOrders: 0,
        lifetimeValue: 'Rp 0',
        isAiAutoReplyEnabled: true,
      };

      setContacts((prev) => [newContact, ...prev]);
      targetContactId = newId;
    }

    setActiveContactId(targetContactId);
    setActiveTab('inbox');

    const customerObj = contacts.find((c) => c.id === targetContactId) || {
      name: customContact?.name || 'Pelanggan',
      phone: customContact?.phone || '+62 812-xxxx-xxxx',
      isAiAutoReplyEnabled: true,
    };

    const incomingMsg: WhatsAppMessage = {
      id: 'in_' + Date.now(),
      contactId: targetContactId,
      sender: 'customer',
      senderName: customerObj.name,
      text: messageText,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      status: 'read',
    };

    setMessages((prev) => ({
      ...prev,
      [targetContactId]: [...(prev[targetContactId] || []), incomingMsg],
    }));

    setContacts((prev) =>
      prev.map((c) =>
        c.id === targetContactId
          ? {
              ...c,
              lastMessageTime: incomingMsg.timestamp,
            }
          : c
      )
    );

    // Smart Auto-Reply Trigger
    if (botSettings.isAutoReplyActive && customerObj.isAiAutoReplyEnabled && waStatus === 'connected') {
      setIsAiGenerating(true);

      const delayMs = (botSettings.responseDelaySec || 2) * 1000;

      setTimeout(async () => {
        try {
          const currentList = messages[targetContactId] || [];
          const history = currentList.slice(-5).map((m) => ({
            sender: m.sender === 'customer' ? customerObj.name : 'CS',
            text: m.text,
          }));

          const res = await fetch('/api/chat/smart-reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              incomingMessage: messageText,
              customerName: customerObj.name,
              customerPhone: customerObj.phone,
              conversationHistory: history,
              botTone: botSettings.botTone,
              customInstructions: 'Berikan jawaban ramah, solutif, sesuai knowledge base Toko Nusantara Digital.',
            }),
          });

          const json = await res.json();
          const smartReplyData = json.data;

          if (smartReplyData?.replyText) {
            handleSendMessage(targetContactId, smartReplyData.replyText, 'bot', {
              isAiGenerated: true,
              aiIntent: smartReplyData.intent,
              aiConfidence: smartReplyData.confidence,
              aiReasoning: smartReplyData.aiReasoning,
            });
            setTotalAutoReplies((prev) => prev + 1);
          }
        } catch (err) {
          console.error('Failed to trigger smart reply', err);
          handleSendMessage(
            targetContactId,
            `Halo Kak ${customerObj.name}, terima kasih sudah menghubungi Toko Nusantara Digital. Ada yang bisa kami bantu seputar produk atau pesanan Anda hari ini? 😊`,
            'bot',
            { isAiGenerated: true, aiIntent: 'general_greeting' }
          );
        } finally {
          setIsAiGenerating(false);
        }
      }, delayMs);
    }
  };

  // Toggle AI auto reply for a single contact
  const handleToggleContactAi = (contactId: string) => {
    setContacts((prev) =>
      prev.map((c) =>
        c.id === contactId
          ? {
              ...c,
              isAiAutoReplyEnabled: !c.isAiAutoReplyEnabled,
            }
          : c
      )
    );
  };

  // Toggle master bot auto reply switch
  const handleToggleAutoReply = () => {
    const nextState = !botSettings.isAutoReplyActive;
    setBotSettings((prev) => ({ ...prev, isAutoReplyActive: nextState }));

    fetch('/api/whatsapp/toggle-auto-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: nextState }),
    }).catch((e) => console.error(e));
  };

  // QR Pairing success handler
  const handlePairSuccess = (phone: string, pushName: string) => {
    setWaStatus('connected');
    setWaPhone(phone);
    setConnectedAt(new Date().toISOString());

    fetch('/api/whatsapp/pair-confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: phone, pushName }),
    }).catch((e) => console.error(e));
  };

  // Disconnect handler
  const handleDisconnect = () => {
    setWaStatus('disconnected');
    fetch('/api/whatsapp/disconnect', { method: 'POST' }).catch((e) => console.error(e));
  };

  // Select contact handler (resets unread count)
  const handleSelectContact = (contactId: string) => {
    setActiveContactId(contactId);
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, unreadCount: 0 } : c))
    );
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 font-sans">
      {/* Top Navigation & Status Bar */}
      <HeaderNavbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        waStatus={waStatus}
        phoneNumber={waPhone}
        isAutoReplyActive={botSettings.isAutoReplyActive}
        onToggleAutoReply={handleToggleAutoReply}
        onOpenPairingModal={() => setIsPairingModalOpen(true)}
        onOpenSimulatorModal={() => setIsSimulatorModalOpen(true)}
        totalUnread={totalUnread}
      />

      {/* Main View Area */}
      <main className="flex-1 flex overflow-hidden">
        {activeTab === 'inbox' && (
          <ChatInboxView
            contacts={contacts}
            messages={messages}
            activeContactId={activeContactId}
            onSelectContact={handleSelectContact}
            onSendMessage={handleSendMessage}
            onSimulateIncomingOpen={() => setIsSimulatorModalOpen(true)}
            isAiGenerating={isAiGenerating}
            botSettings={botSettings}
            onToggleContactAi={handleToggleContactAi}
            onAddContact={handleAddContact}
            waStatus={waStatus}
            onOpenPairingModal={() => setIsPairingModalOpen(true)}
          />
        )}

        {activeTab === 'scheduled' && (
          <ScheduledMessagesView
            scheduledMessages={scheduledMessages}
            contacts={contacts}
            onAddSchedule={handleAddSchedule}
            onDeleteSchedule={handleDeleteSchedule}
            onInstantTrigger={handleInstantTriggerSchedule}
          />
        )}

        {activeTab === 'knowledge' && (
          <KnowledgeBaseSettings
            settings={botSettings}
            onSaveSettings={(newSettings) => setBotSettings(newSettings)}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsOverview
            contacts={contacts}
            scheduledMessages={scheduledMessages}
            totalAutoReplies={totalAutoReplies}
          />
        )}
      </main>

      {/* WhatsApp QR Pairing Modal */}
      <WhatsAppPairingModal
        isOpen={isPairingModalOpen}
        onClose={() => setIsPairingModalOpen(false)}
        status={waStatus}
        phoneNumber={waPhone}
        connectedAt={connectedAt}
        onPairSuccess={handlePairSuccess}
        onDisconnect={handleDisconnect}
      />

      {/* Live WhatsApp Message Simulator Modal */}
      <MessageSimulatorModal
        isOpen={isSimulatorModalOpen}
        onClose={() => setIsSimulatorModalOpen(false)}
        contacts={contacts}
        activeContactId={activeContactId}
        onSimulateIncoming={handleSimulateIncoming}
      />
    </div>
  );
}
