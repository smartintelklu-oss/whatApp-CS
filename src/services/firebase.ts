import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDocFromServer,
  getDoc,
  collection,
  getDocs,
  setDoc,
  onSnapshot,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with specific database ID if configured
export const db =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };
  console.warn('[Firestore Operation Error]:', JSON.stringify(errInfo));
}

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

// Fetch all contacts from Firestore
export async function fetchFirestoreContacts(): Promise<any[]> {
  const path = 'contacts';
  try {
    const colRef = collection(db, path);
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return [];
  }
}

// Real-time listener for contacts across all connected devices
export function subscribeToContacts(callback: (contacts: any[]) => void): () => void {
  const path = 'contacts';
  try {
    const colRef = collection(db, path);
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const contactList = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        callback(contactList);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
    return unsubscribe;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return () => {};
  }
}

// Save contact to Firestore (accessible to all devices)
export async function saveFirestoreContact(contact: any): Promise<void> {
  if (!contact || !contact.id) return;
  const path = `contacts/${contact.id}`;
  try {
    const docRef = doc(db, 'contacts', String(contact.id));
    await setDoc(
      docRef,
      {
        id: String(contact.id),
        name: String(contact.name || 'Pelanggan'),
        phone: String(contact.phone || ''),
        avatar: contact.avatar || '',
        unreadCount: Number(contact.unreadCount || 0),
        lastMessage: String(contact.lastMessage || ''),
        lastMessageTime: String(contact.lastMessageTime || new Date().toISOString()),
        status: String(contact.status || contact.tag || 'Baru'),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// Real-time listener for messages in a contact conversation
export function subscribeToMessages(
  contactId: string,
  callback: (messages: any[]) => void
): () => void {
  if (!contactId) return () => {};
  const path = `contacts/${contactId}/messages`;
  try {
    const colRef = collection(db, 'contacts', String(contactId), 'messages');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const msgs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        callback(msgs);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
    return unsubscribe;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return () => {};
  }
}

// Save individual message to Firestore
export async function saveFirestoreMessage(contactId: string, message: any): Promise<void> {
  if (!contactId || !message || !message.id) return;
  const path = `contacts/${contactId}/messages/${message.id}`;
  try {
    const docRef = doc(db, 'contacts', String(contactId), 'messages', String(message.id));
    await setDoc(
      docRef,
      {
        id: String(message.id),
        contactId: String(contactId),
        text: String(message.text || ''),
        sender: String(message.sender || 'agent'),
        timestamp: String(message.timestamp || new Date().toISOString()),
        status: String(message.status || 'sent'),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// Fetch global gateway configuration from Firestore
export async function fetchFirestoreGatewayConfig(): Promise<any | null> {
  const path = 'gateway_config/current';
  try {
    const docRef = doc(db, 'gateway_config', 'current');
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      return snapshot.data();
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return null;
  }
}

// Real-time listener for global gateway configuration (token & device sync across devices)
export function subscribeToGatewayConfig(callback: (config: any) => void): () => void {
  const path = 'gateway_config/current';
  try {
    const docRef = doc(db, 'gateway_config', 'current');
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          callback(snapshot.data());
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
    return unsubscribe;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return () => {};
  }
}

// Persist global gateway configuration and token to Firestore
export async function saveFirestoreGatewayConfig(config: {
  activeProvider?: string;
  fonnteToken?: string;
  deviceName?: string;
  devicePhone?: string;
  quota?: string;
}): Promise<void> {
  if (!config) return;
  const path = 'gateway_config/current';
  try {
    const docRef = doc(db, 'gateway_config', 'current');
    const payload: Record<string, any> = {
      activeProvider: String(config.activeProvider || 'fonnte'),
      updatedAt: new Date().toISOString(),
    };
    if (config.fonnteToken !== undefined) {
      payload.fonnteToken = String(config.fonnteToken);
    }
    if (config.deviceName !== undefined) {
      payload.deviceName = String(config.deviceName);
    }
    if (config.devicePhone !== undefined) {
      payload.devicePhone = String(config.devicePhone);
    }
    if (config.quota !== undefined) {
      payload.quota = String(config.quota);
    }

    await setDoc(docRef, payload, { merge: true });
    console.log('[Firestore] Gateway config & token persisted successfully:', payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// Backward compatibility alias
export async function syncGatewayConfigToFirestore(config: any): Promise<void> {
  return saveFirestoreGatewayConfig({
    activeProvider: config?.activeProvider || 'fonnte',
    fonnteToken: config?.fonnteToken || config?.token || config?.fonnte?.token,
    deviceName: config?.deviceName || config?.name || config?.fonnte?.device,
    devicePhone: config?.devicePhone || config?.phone || config?.fonnte?.device,
    quota: config?.quota ? String(config.quota) : undefined,
  });
}

export default app;
