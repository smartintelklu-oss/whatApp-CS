import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer, collection, getDocs, setDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with specific database ID if configured
export const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export const auth = getAuth(app);

// Test connection on boot per Firebase skill guidelines
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Please check your Firebase configuration or network status.');
    }
  }
}
testConnection();

// Helpers for Firestore data sync
export async function fetchFirestoreContacts(): Promise<any[]> {
  try {
    const colRef = collection(db, 'contacts');
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('Error fetching contacts from Firestore:', err);
    return [];
  }
}

export async function saveFirestoreContact(contact: any): Promise<void> {
  if (!contact || !contact.id) return;
  try {
    const docRef = doc(db, 'contacts', String(contact.id));
    await setDoc(docRef, {
      id: String(contact.id),
      name: String(contact.name || 'Pelanggan'),
      phone: String(contact.phone || ''),
      avatar: contact.avatar || '',
      unreadCount: Number(contact.unreadCount || 0),
      lastMessage: String(contact.lastMessage || ''),
      lastMessageTime: String(contact.lastMessageTime || new Date().toISOString()),
      status: String(contact.status || 'Baru'),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.error('Error saving contact to Firestore:', err);
  }
}

export async function saveFirestoreMessage(contactId: string, message: any): Promise<void> {
  if (!contactId || !message || !message.id) return;
  try {
    const docRef = doc(db, 'contacts', String(contactId), 'messages', String(message.id));
    await setDoc(docRef, {
      id: String(message.id),
      contactId: String(contactId),
      text: String(message.text || ''),
      sender: String(message.sender || 'agent'),
      timestamp: String(message.timestamp || new Date().toISOString()),
      status: String(message.status || 'sent'),
    }, { merge: true });
  } catch (err) {
    console.error('Error saving message to Firestore:', err);
  }
}

export async function syncGatewayConfigToFirestore(config: any): Promise<void> {
  if (!config) return;
  try {
    const docRef = doc(db, 'gateway_config', 'current');
    await setDoc(docRef, {
      activeProvider: String(config.activeProvider || 'fonnte'),
      deviceName: String(config.deviceName || ''),
      devicePhone: String(config.devicePhone || ''),
      quota: String(config.quota || ''),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.error('Error saving gateway config to Firestore:', err);
  }
}

export default app;
