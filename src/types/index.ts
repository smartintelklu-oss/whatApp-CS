export interface WhatsAppContact {
  id: string;
  name: string;
  phone: string;
  avatar: string;
  statusText?: string;
  unreadCount: number;
  tag: 'Prospek' | 'Pelanggan Baru' | 'Komplain' | 'VIP' | 'Selesai';
  lastMessageTime: string;
  notes?: string;
  totalOrders?: number;
  lifetimeValue?: string;
  isAiAutoReplyEnabled: boolean;
}

export interface WhatsAppMessage {
  id: string;
  contactId: string;
  sender: 'customer' | 'bot' | 'agent';
  senderName: string;
  text: string;
  timestamp: string;
  status: 'sent' | 'delivered' | 'read';
  mediaType?: 'image' | 'document' | 'none';
  mediaUrl?: string;
  mediaName?: string;
  mediaSize?: string;
  isAiGenerated?: boolean;
  aiIntent?: string;
  aiConfidence?: number;
  aiReasoning?: string;
}

export interface ScheduledMessage {
  id: string;
  title: string;
  targetType: 'all' | 'tag' | 'single';
  targetValue: string; // e.g., 'Prospek' or '+62 812-3344-5566'
  messageText: string;
  mediaType: 'none' | 'image' | 'document';
  mediaUrl?: string;
  mediaName?: string;
  mediaSize?: string;
  scheduledTime: string; // ISO string
  status: 'pending' | 'sending' | 'sent' | 'cancelled';
  sentCount: number;
  totalRecipients: number;
  createdAt: string;
  repeat: 'none' | 'daily' | 'weekly';
}

export interface CSBotSettings {
  isAutoReplyActive: boolean;
  botTone: 'ramah_sopan' | 'profesional' | 'santai';
  botName: string;
  responseDelaySec: number;
  outOfHoursOnly: boolean;
  notifyHumanOnEscalation: boolean;
  knowledgeBase: string;
}
