import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut, updateProfile, EmailAuthProvider, reauthenticateWithCredential, updatePassword, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import { getDatabase, ref, get, set, push, update, remove, onValue, off, onDisconnect } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js';

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyAVKGyPWWQzEWfwkOwhwXabD3HbuLQz-qA",
  authDomain: "chatcity-63c68.firebaseapp.com",
  databaseURL: "https://chatcity-63c68-default-rtdb.firebaseio.com",
  projectId: "chatcity-63c68",
  storageBucket: "chatcity-63c68.appspot.com",
  messagingSenderId: "961766102206",
  appId: "1:961766102206:web:e8f0f8c7b8e3d5c4a2b1c0"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const gProvider = new GoogleAuthProvider();

// ✅ PROPER EXPORTS
export { ref, get, set, push, update, remove, onValue, off, onDisconnect };
export { updateProfile, EmailAuthProvider, reauthenticateWithCredential, updatePassword };
export { onAuthStateChanged, signOut, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail };

const VAPID_KEY = 'BOZAB1T7v4ZhpbAFgatdb8PRtimuqCEjr7tYgYZF7UJwJeVTq_gkAq6CgcOF_-GfLUnlwCGIdsqkM8nnpoUXnc';
const BACKEND_URL = 'https://notify-backend-chatcity.onrender.com';
export const ADMIN_UID = 'admin_system_001';
export const ADMIN_EMAIL = 'admin@chatcity.com';

// ── Utilities ──
export const colorFor = uid => {
  const colors = ['#7c6eff', '#ff6b9d', '#2dd4a0', '#f7c94b', '#ff5370'];
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = ((hash << 5) - hash) + uid.charCodeAt(i);
  return colors[Math.abs(hash) % colors.length];
};

export const initialsOf = name => {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
};

export const chatId = (uid1, uid2) => [uid1, uid2].sort().join('__');

export const fmtTime = ts => {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
};

export const fmtDate = ts => new Date(ts).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

export const escHtml = str => {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(str).replace(/[&<>"']/g, m => map[m]);
};

// ✅ FIXED VERIFIED BADGE
export const VERIFIED_BADGE = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%232dd4a0"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>';

// ── Session ──
const SESSION_KEY = 'cc_session';

export const saveSession = (uid, passcode) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ uid, passcode, ts: Date.now() }));
};

export const getSession = () => {
  const sess = localStorage.getItem(SESSION_KEY);
  return sess ? JSON.parse(sess) : null;
};

export const clearSession = () => localStorage.removeItem(SESSION_KEY);

// ── Navigation & Toast ──
export const go = path => { window.location.href = path; };

export const toast = (msg, type = 'info') => {
  const el = document.getElementById('toast') || document.createElement('div');
  if (!el.id) { el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.className = 'show';
  setTimeout(() => el.classList.remove('show'), 3000);
};

// ── Online Status ──
export const setOnline = async uid => {
  const userRef = ref(db, `users/${uid}`);
  await set(userRef, { online: true, lastSeen: Date.now() }, { merge: true });
  onDisconnect(userRef).set({ online: false, lastSeen: Date.now() }, { merge: true });
};

// ── FCM Init ──
export const initFCM = async uid => {
  console.log('🔔 [FCM] Initializing for:', uid);
  
  try {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return;
    
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    
    if (Notification.permission !== 'granted') return;

    try {
      await navigator.serviceWorker.register('firebase-messaging-sw.js');
      console.log('✅ [FCM] Service Worker registered');
    } catch (e) {
      console.warn('⚠️ [FCM] SW error:', e.message);
    }

    const { getMessaging, getToken, onMessage } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging.js');
    const messaging = getMessaging(app);

    try {
      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: await navigator.serviceWorker.ready
      });

      if (token) {
        console.log('✅ [FCM] Token:', token.substring(0, 20) + '...');
        await set(ref(db, `users/${uid}/fcmToken`), token);

        onMessage(messaging, payload => {
          if (payload.notification) {
            const { title, body } = payload.notification;
            if (Notification.permission === 'granted') {
              new Notification(title, {
                body,
                icon: 'https://cdn-icons-png.flaticon.com/512/3048/3048122.png',
                badge: 'https://cdn-icons-png.flaticon.com/512/3048/3048122.png',
                tag: 'chatcity-notification',
                requireInteraction: false
              });
            }
          }
        });
      }
    } catch (e) {
      console.error('❌ [FCM] Token error:', e.message);
    }
  } catch (e) {
    console.error('❌ [FCM] Error:', e);
  }
};

// ── Send Push ──
export const sendPushToUser = async (receiverUid, title, body, url = 'home.html') => {
  try {
    const snap = await get(ref(db, `users/${receiverUid}`));
    const u = snap.val();
    if (!u?.fcmToken) return;

    const response = await fetch(`${BACKEND_URL}/api/sendPush`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: u.fcmToken, title, body, url })
    });

    if (response.ok) {
      console.log('✅ [PUSH] Sent');
    }
  } catch (e) {
    console.error('❌ [PUSH] Error:', e.message);
  }
};

// ── Admin ──
export const isAdmin = async uid => {
  try {
    const snap = await get(ref(db, `users/${uid}`));
    if (snap.val()?.email === ADMIN_EMAIL) return true;
    const adminSnap = await get(ref(db, `admins/${uid}`));
    return adminSnap.val() === true;
  } catch {
    return false;
  }
};

// ── User Functions ──
export const generateUserCode = uid => uid.substring(0, 8).toUpperCase();

export const createUserSearchIndex = async (uid, userData) => {
  const code = generateUserCode(uid);
  await set(ref(db, `users/${uid}`), {
    ...userData,
    friendCode: code,
    searchIndex: (userData.name || '').toLowerCase()
  });
};

export const updateUserSearchIndex = async (uid, userData) => {
  const code = generateUserCode(uid);
  await set(ref(db, `users/${uid}/friendCode`), code);
};

export const validateEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const findUserByCode = async code => {
  const snap = await get(ref(db, 'users'));
  let found = null;
  snap.forEach(child => {
    if (generateUserCode(child.key) === code.toUpperCase()) {
      found = { uid: child.key, ...child.val() };
    }
  });
  return found;
};

export const addFriendByCode = async (myUid, code) => {
  const user = await findUserByCode(code);
  if (!user) throw new Error('User not found');
  if (user.uid === myUid) throw new Error('Cannot add yourself');
  
  await set(ref(db, `users/${myUid}/contacts/${user.uid}`), true);
  await set(ref(db, `users/${user.uid}/contacts/${myUid}`), true);
  return user;
};

export const getAllUsers = async () => {
  const snap = await get(ref(db, 'users'));
  const users = [];
  snap.forEach(child => {
    users.push({ uid: child.key, ...child.val() });
  });
  return users;
};

export const searchUsers = async q => {
  const snap = await get(ref(db, 'users'));
  const results = [];
  snap.forEach(child => {
    const u = child.val();
    if ((u.name || '').toLowerCase().includes(q.toLowerCase()) || 
        (u.email || '').toLowerCase().includes(q.toLowerCase())) {
      results.push({ uid: child.key, ...u });
    }
  });
  return results;
};

export const setVerifiedBadge = async (uid, verified) => {
  await set(ref(db, `users/${uid}/verified`), verified);
};

export const banUser = async (uid, ban) => {
  await set(ref(db, `admin/banned/${uid}`), ban);
};

export const sendSystemMessage = async (fromUid, toUid, text) => {
  const cid = chatId(fromUid, toUid);
  const r = push(ref(db, `chats/${cid}/messages`));
  await set(r, {
    id: r.key,
    senderId: fromUid,
    text,
    ts: Date.now(),
    type: 'text',
    seen: false
  });
};

// ── Offline Queue ──
let offlineQueue = [];

export const isAppOnline = () => navigator.onLine;

export const addToOfflineQueue = (chatId, payload) => {
  offlineQueue.push({ chatId, payload, ts: Date.now() });
  localStorage.setItem('cc_offline_queue', JSON.stringify(offlineQueue));
};

export const flushOfflineQueue = async chatId => {
  const saved = localStorage.getItem('cc_offline_queue');
  if (!saved) return;
  
  try {
    offlineQueue = JSON.parse(saved);
    for (const item of offlineQueue) {
      if (item.chatId === chatId) {
        const r = push(ref(db, `chats/${item.chatId}/messages`));
        await set(r, { ...item.payload, id: r.key });
      }
    }
    offlineQueue = offlineQueue.filter(q => q.chatId !== chatId);
    localStorage.setItem('cc_offline_queue', JSON.stringify(offlineQueue));
  } catch (e) {
    console.error('Queue error:', e);
  }
};
