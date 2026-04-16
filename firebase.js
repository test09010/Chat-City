// ═══════════════════════════════════════════════════════════
//  ChatCity — Firebase Config & Shared Utils v5.0
//  Includes: Admin functions, Ban, Verified Badge, Online tracking
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

const FB_CONFIG = {
  apiKey:            "AIzaSyAVKGyPWWQzEWfwkOwhwXabD3HbuLQz-qA",
  authDomain:        "chatcity-63c68.firebaseapp.com",
  databaseURL:       "https://chatcity-63c68-default-rtdb.firebaseio.com",
  projectId:         "chatcity-63c68",
  storageBucket:     "chatcity-63c68.firebasestorage.app",
  messagingSenderId: "1015529457316",
  appId:             "1:1015529457316:web:2e90bfaacbd515a44208d7"
};

const app  = initializeApp(FB_CONFIG);
const auth = getAuth(app);
const db   = getDatabase(app);
const gProvider = new GoogleAuthProvider();

// ══ CONSTANTS ══
const ADMIN_EMAIL  = 'admin@chatcity.com';
const ADMIN_PASS   = '9999';
const ADMIN_UID    = 'admin_system_001';
// 🔑 VAPID Public Key (from screenshot)
const VAPID_KEY    = 'BOZAB1T7v4ZhpbAFgatdb8PRtimuqCEjr7tYgYZF7UJwJeVTq_gkAq6CgcOF_-GfLUnlwCGIdsqkM8nnpoUXnc';
const VERIFIED_BADGE = 'https://i.ibb.co/W4fjDGmD/32539-removebg-preview.png';
const BACKEND_URL  = 'https://notify-backend-chatcity.onrender.com'; // আপনার রেন্ডার URL এখানে বসাবেন

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

const reportError = async (err, ctx='') => {
  try { await push(ref(db,'admin/errors'),{error:String(err),context:ctx,ts:Date.now(),ua:navigator.userAgent}); } catch {}
};

const SESSION_KEY = 'cc_session';
const saveSession  = (uid,p) => localStorage.setItem(SESSION_KEY,JSON.stringify({uid,passcode:p,ts:Date.now()}));
const getSession   = ()      => { try{return JSON.parse(localStorage.getItem(SESSION_KEY));}catch{return null;} };
const clearSession = ()      => localStorage.removeItem(SESSION_KEY);
const go = (page,data={}) => { sessionStorage.setItem('cc_route',JSON.stringify({page,data})); window.location.href=page; };

const setOnline = async uid => {
  try {
    const r = ref(db,`users/${uid}/online`);
    await set(r,true);
    onDisconnect(r).set(false);
    onDisconnect(ref(db,`users/${uid}/lastSeen`)).set(Date.now());
    await set(ref(db,`users/${uid}/lastVisit`),Date.now());
    // Track daily online time
    const today = new Date().toISOString().slice(0,10);
    const timeRef = ref(db,`users/${uid}/dailyOnline/${today}`);
    onDisconnect(timeRef).cancel(); // will be handled by cloud function, or we can do simple increment here
  } catch(e){}
};

// ══ FCM ══
let _fcmMessaging = null;
const initFCM = async uid => {
  try {
    if(!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const { getMessaging, getToken, onMessage } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging.js');
    _fcmMessaging = getMessaging(app);
    const perm = await Notification.requestPermission();
    if(perm !== 'granted') return;
    const token = await getToken(_fcmMessaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if(token) await set(ref(db,`users/${uid}/fcmToken`), token);
    onMessage(_fcmMessaging, payload => {
      const { title, body } = payload.notification || {};
      if(Notification.permission === 'granted') {
        new Notification(title || 'ChatCity 💬', { body: body || 'New message', icon: 'https://cdn-icons-png.flaticon.com/512/3048/3048122.png' });
      }
    });
  } catch(e){}
};

// ✅ Backend API কল করে পুশ পাঠানো
const sendPushToUser = async (receiverUid, title, body, url='home.html') => {
  try {
    const snap = await get(ref(db,`users/${receiverUid}`));
    const u = snap.val();
    if(!u || u.online) return; // online থাকলে পুশ না
    const token = u.fcmToken;
    if(!token) return;
    await fetch(`${BACKEND_URL}/api/sendPush`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ token, title, body, url })
    });
  } catch(e){}
};

// ══ ADMIN FUNCTIONS ══
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

const getAllUsersDetailed = async () => {
  const snap = await get(ref(db,'users'));
  const users = snap.val() || {};
  return Object.entries(users).map(([uid, u]) => ({
    uid, ...u,
    friendCode: generateUserCode(uid),
    joinDate: u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A',
    passcodeSet: !!u.passcode,
    banned: false // will be fetched separately
  }));
};

// ══ FRIEND CODE ══
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

const createUserSearchIndex = async (uid,user) => {
  try {
    const code=generateUserCode(uid);
    const ni=(user.name||'').toLowerCase().trim();
    const ei=(user.email||'').toLowerCase().trim();
    const nt=ni.split(/\s+/).filter(t=>t.length>0);
    const et=ei.split('@')[0].split(/[\._\-]+/).filter(t=>t.length>0);
    await set(ref(db,`search/users/${uid}`),{ uid,code,name:user.name||'',email:user.email||'',nameIndex:ni,emailIndex:ei,tokens:[...new Set([...nt,...et,ni,ei])],color:user.color,initials:user.initials,photo:user.photo||'',verified:user.verified||false,createdAt:Date.now() });
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

const deleteUserSearchIndex = async uid => { try{await remove(ref(db,`search/users/${uid}`));}catch{} };
const updateUserSearchIndex = async (uid,user) => { await deleteUserSearchIndex(uid); await createUserSearchIndex(uid,user); };

// ══ OFFLINE QUEUE ══
const QUEUE_KEY='cc_msg_queue';
const addToOfflineQueue = (cid,msg) => { try{ const q=JSON.parse(localStorage.getItem(QUEUE_KEY))||{}; if(!q[cid])q[cid]=[]; q[cid].push(msg); localStorage.setItem(QUEUE_KEY,JSON.stringify(q)); }catch{} };
const isAppOnline = ()=>navigator.onLine;

export {
  app, auth, db, gProvider, VAPID_KEY, VERIFIED_BADGE, BACKEND_URL,
  colorFor, initialsOf, chatId, fmtTime, fmtDate, escHtml, toast, reportError,
  saveSession, getSession, clearSession, go, setOnline, isAppOnline,
  initFCM, sendPushToUser,
  generateUserCode, findUserByCode, addFriendByCode,
  createUserSearchIndex, searchUsers, getAllUsers: getAllUsersDetailed,
  deleteUserSearchIndex, updateUserSearchIndex,
  addToOfflineQueue, setVerifiedBadge, banUser, sendSystemMessage, isAdmin,
  ref, set, get, push, onValue, off, remove, update,
  serverTimestamp, onDisconnect, query, orderByChild, equalTo,
  signOut, onAuthStateChanged, updateProfile, updatePassword,
  EmailAuthProvider, reauthenticateWithCredential,
  GoogleAuthProvider, signInWithPopup,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail
};
