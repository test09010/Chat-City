// ═══════════════════════════════════════════════════════════
//  ChatCity — Firebase Config & Shared Utils (Complete)
// ═══════════════════════════════════════════════════════════

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile, updatePassword,
  EmailAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import {
  getDatabase, ref, set, get, push, onValue, off, remove, update,
  serverTimestamp, onDisconnect, query, orderByChild, equalTo
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js';

// ═══════════════════════════════════════════════════════════
// FIREBASE CONFIG
// ═══════════════════════════════════════════════════════════
const FB_CONFIG = {
  apiKey:            "AIzaSyAVKGyPWWQzEWfwkOwhwXabD3HbuLQz-qA",
  authDomain:        "chatcity-63c68.firebaseapp.com",
  databaseURL:       "https://chatcity-63c68-default-rtdb.firebaseio.com",
  projectId:         "chatcity-63c68",
  storageBucket:     "chatcity-63c68.firebasestorage.app",
  messagingSenderId: "1015529457316",
  appId:             "1:1015529457316:web:2e90bfaacbd515a44208d7"
};

const app = initializeApp(FB_CONFIG);
const auth = getAuth(app);
const db = getDatabase(app);
const gProvider = new GoogleAuthProvider();

console.log('🔥 ChatCity Firebase Initialized:', app.name);

// ═══════════════════════════════════════════════════════════
// CONSTANTS & UTILS
// ═══════════════════════════════════════════════════════════
const ADMIN_EMAIL  = 'admin@chatcity.com';
const ADMIN_UID    = 'admin_system_001';
const VAPID_KEY    = 'BOZAB1T7v4ZhpbAFgatdb8PRtimuqCEjr7tYgYZF7UJwJeVTq_gkAq6CgcOF_-GfLUnlwCGIdsqkM8nnpoUXnc';
const VERIFIED_BADGE = 'https://i.ibb.co/W4fjDGmD/32539-removebg-preview.png';
const BACKEND_URL  = 'https://notify-backend-chatcity.onrender.com';

const COLORS = ['#7c6eff','#ff6b9d','#2dd4a0','#f7c94b','#60a5fa','#fb923c','#c084fc','#34d399'];
const colorFor   = uid => { let h=0; for(const c of uid) h=(h*31+c.charCodeAt(0))%COLORS.length; return COLORS[h]; };
const initialsOf = name => { if(!name) return '?'; const p=name.trim().split(/\s+/); return p.length>=2?(p[0][0]+p[p.length-1][0]).toUpperCase():name[0].toUpperCase(); };
const chatId     = (a,b) => [a,b].sort().join('__');

const fmtTime = ts => { const d=new Date(ts); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; };
const fmtDate = ts => { const d=new Date(ts),now=new Date(); if(d.toDateString()===now.toDateString()) return 'Today'; const y=new Date(now); y.setDate(now.getDate()-1); if(d.toDateString()===y.toDateString()) return 'Yesterday'; return d.toLocaleDateString('en-GB',{day:'numeric',month:'short'}); };
const escHtml = s => s?.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')??'';

let _toastTimer;
const toast = (msg, type='') => {
  const el = document.getElementById('toast'); if(!el) return;
  el.textContent = type==='error'?'⚠ '+msg : type==='ok'?'✓ '+msg : msg;
  el.style.background = type==='error'?'#ff5370' : type==='ok'?'#2dd4a0' : '';
  el.style.color = '#fff';
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(()=>el.classList.remove('show'), 3000);
};

// ═══════════════════════════════════════════════════════════
// SESSION & NAVIGATION
// ═══════════════════════════════════════════════════════════
const SESSION_KEY = 'cc_session';
const saveSession  = (uid,p) => localStorage.setItem(SESSION_KEY,JSON.stringify({uid,passcode:p,ts:Date.now()}));
const getSession   = ()      => { try{return JSON.parse(localStorage.getItem(SESSION_KEY));}catch{return null;} };
const clearSession = ()      => localStorage.removeItem(SESSION_KEY);
const go = (page) => { window.location.href = page; };
// গ্লোবালি এক্সপোজ (জরুরি)
window.go = go;

const setOnline = async uid => {
  try {
    const r = ref(db,`users/${uid}/online`);
    await set(r,true);
    onDisconnect(r).set(false);
    onDisconnect(ref(db,`users/${uid}/lastSeen`)).set(Date.now());
  } catch(e){}
};

const isAppOnline = ()=>navigator.onLine;

// ═══════════════════════════════════════════════════════════
// FCM & PUSH NOTIFICATIONS (initFCM added)
// ═══════════════════════════════════════════════════════════
const initFCM = async (uid) => {
  try {
    if(!('serviceWorker' in navigator)) return console.warn('No SW support');
    // নোটিফিকেশন পারমিশন চাওয়া
    if(Notification.permission === 'default') await Notification.requestPermission();
    if(Notification.permission !== 'granted') return;

    const { getMessaging, getToken } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging.js');
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if(token) {
      await set(ref(db,`users/${uid}/fcmToken`), token);
      console.log('📱 FCM Token registered');
    }
  } catch(e) { console.warn('FCM init error:', e); }
};

const sendPushToUser = async (receiverUid, title, body, url='home.html') => {
  try {
    const snap = await get(ref(db,`users/${receiverUid}`));
    const u = snap.val();
    if(!u || u.online) return;
    const token = u.fcmToken;
    if(!token) return;
    await fetch(`${BACKEND_URL}/api/sendPush`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ token, title, body, url })
    });
  } catch(e){}
};

// ═══════════════════════════════════════════════════════════
// FRIEND CODE & SEARCH
// ═══════════════════════════════════════════════════════════
const generateUserCode = uid => {
  try {
    let hash=0;
    for(let i=0;i<uid.length;i++){ const c=uid.charCodeAt(i); hash=((hash<<5)-hash)+c; hash=hash&hash; }
    const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code='',num=Math.abs(hash);
    for(let i=0;i<6;i++){ code+=chars[num%chars.length]; num=Math.floor(num/chars.length); }
    let cs=0; for(let i=0;i<code.length;i++) cs+=code.charCodeAt(i);
    return code+(cs%10);
  } catch { return 'ERROR01'; }
};

const createUserSearchIndex = async (uid,user) => {
  try {
    const code=generateUserCode(uid);
    const ni=(user.name||'').toLowerCase().trim();
    const ei=(user.email||'').toLowerCase().trim();
    await set(ref(db,`search/users/${uid}`),{ uid,code,name:user.name||'',email:user.email||'',nameIndex:ni,emailIndex:ei,color:user.color,initials:user.initials,photo:user.photo||'',verified:user.verified||false });
  } catch(e){}
};

const searchUsers = async (query,excludeUid=null) => {
  if(!query) return [];
  const q=query.toLowerCase().trim();
  const snap=await get(ref(db,'search/users'));
  const users=snap.val()||{};
  return Object.values(users).filter(u=>{
    if(!u||excludeUid&&u.uid===excludeUid) return false;
    return (u.nameIndex?.includes(q) || u.emailIndex?.includes(q) || u.code?.toLowerCase()===q);
  }).slice(0,50);
};

const getAllUsers = async () => {
  const snap=await get(ref(db,'users'));
  const users=snap.val()||{};
  return Object.entries(users).map(([uid,u])=>({uid,...u,friendCode:generateUserCode(uid),joinDate:u.createdAt?new Date(u.createdAt).toLocaleDateString():'N/A'}));
};

const deleteUserSearchIndex = async uid => { try{await remove(ref(db,`search/users/${uid}`));}catch{} };
const updateUserSearchIndex = async (uid,user) => { await deleteUserSearchIndex(uid); await createUserSearchIndex(uid,user); };

const findUserByCode = async code => {
  const snap=await get(ref(db,'search/users'));
  const users=snap.val()||{};
  for(const [uid,u] of Object.entries(users)) if(u?.code===code?.toUpperCase()) return {uid,...u};
  return null;
};

const addFriendByCode = async (myUid,code) => {
  const user=await findUserByCode(code);
  if(!user) throw new Error('User code not found');
  if(user.uid===myUid) throw new Error('Cannot add yourself');
  await set(ref(db,`users/${myUid}/contacts/${user.uid}`),true);
  await set(ref(db,`users/${user.uid}/contacts/${myUid}`),true);
  return {success:true,user};
};

// ═══════════════════════════════════════════════════════════
// ADMIN FUNCTIONS
// ═══════════════════════════════════════════════════════════
const setVerifiedBadge = async (uid, verified) => {
  await set(ref(db,`users/${uid}/verified`), verified);
  await set(ref(db,`search/users/${uid}/verified`), verified);
};

const banUser = async (uid, banned=true) => {
  await set(ref(db,`admin/banned/${uid}`), banned);
};

const sendSystemMessage = async (fromAdminUid, targetUid, text) => {
  const cid = chatId(fromAdminUid, targetUid);
  const r = push(ref(db,`chats/${cid}/messages`));
  await set(r, { id:r.key, senderId:fromAdminUid, text, ts:Date.now(), type:'text', seen:false, isAdmin:true });
};

const isAdmin = async (uid) => {
  if(uid === ADMIN_UID) return true;
  const snap = await get(ref(db,`admins/${uid}`));
  return snap.val() === true;
};

// ═══════════════════════════════════════════════════════════
// VALIDATION & OFFLINE
// ═══════════════════════════════════════════════════════════
const validateEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

const addToOfflineQueue = (cid, msg) => {
  try {
    const q = JSON.parse(localStorage.getItem('cc_msg_queue')||'{}');
    if(!q[cid]) q[cid]=[];
    q[cid].push(msg);
    localStorage.setItem('cc_msg_queue', JSON.stringify(q));
  } catch {}
};

// ═══════════════════════════════════════════════════════════
// EXPORTS (সব কিছু এক্সপোর্ট করা হলো)
// ═══════════════════════════════════════════════════════════
export {
  app, auth, db, gProvider, VAPID_KEY, VERIFIED_BADGE, BACKEND_URL,
  colorFor, initialsOf, chatId, fmtTime, fmtDate, escHtml, toast,
  saveSession, getSession, clearSession, go, setOnline, isAppOnline,
  initFCM, sendPushToUser,                                     // ✅ FCM ফাংশন
  generateUserCode, findUserByCode, addFriendByCode,
  createUserSearchIndex, searchUsers, getAllUsers,
  deleteUserSearchIndex, updateUserSearchIndex,
  addToOfflineQueue, setVerifiedBadge, banUser, sendSystemMessage, isAdmin,
  validateEmail,
  ref, set, get, push, onValue, off, remove, update,
  serverTimestamp, onDisconnect, query, orderByChild, equalTo,
  signOut, onAuthStateChanged, updateProfile, updatePassword,
  EmailAuthProvider, reauthenticateWithCredential,
  GoogleAuthProvider, signInWithPopup,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail
};
