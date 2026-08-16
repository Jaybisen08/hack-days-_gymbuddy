// ==========================================================================
// GYMBUDDY — NATIVE AUTHENTICATION & CLIENT PERSISTENCE ENGINE
// Pure JavaScript (Zero external Firebase CDN dependencies)
// ==========================================================================

class NativeAuthManager {
  constructor() {
    this.listeners = [];
    this.currentUser = this.loadInitialUser();
  }

  loadInitialUser() {
    try {
      const activeRaw = localStorage.getItem("gymbuddy_active_user") || localStorage.getItem("formcoach_demo_user");
      if (activeRaw) {
        return JSON.parse(activeRaw);
      }
    } catch (e) {
      console.warn("Error reading active user:", e);
    }
    return null;
  }

  notify() {
    const user = this.currentUser;
    this.listeners.forEach((cb) => {
      try {
        cb(user);
      } catch (err) {
        console.error("Auth listener error:", err);
      }
    });
  }

  setUser(user) {
    this.currentUser = user;
    if (user) {
      localStorage.setItem("gymbuddy_active_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("gymbuddy_active_user");
      localStorage.removeItem("formcoach_demo_user");
    }
    this.notify();
  }
}

export const auth = new NativeAuthManager();

export const googleProvider = { providerId: "google.com" };

export const browserLocalPersistence = "LOCAL";
export const browserSessionPersistence = "SESSION";

export async function setPersistence(_authInstance, _persistenceType) {
  return true;
}

export function onAuthStateChanged(_authInstance, callback) {
  auth.listeners.push(callback);
  // Emit current active user immediately asynchronously
  setTimeout(() => {
    callback(auth.currentUser);
  }, 10);
  return () => {
    auth.listeners = auth.listeners.filter((l) => l !== callback);
  };
}

export async function signInWithEmailAndPassword(_authInstance, email, password) {
  const users = getStoredUsers();
  const normalizedEmail = email.trim().toLowerCase();

  let existing = users.find((u) => u.email.toLowerCase() === normalizedEmail);
  if (existing) {
    if (existing.password && existing.password !== password) {
      const err = new Error("Invalid password. Please check your credentials.");
      err.code = "auth/wrong-password";
      throw err;
    }
  } else {
    // If first time logging in with this email, create athlete profile
    const namePart = normalizedEmail.split("@")[0];
    const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
    existing = {
      uid: "user_" + Date.now(),
      email: normalizedEmail,
      displayName: formattedName,
      photoURL: null,
      password: password,
    };
    users.push(existing);
    saveStoredUsers(users);
  }

  const user = {
    uid: existing.uid,
    email: existing.email,
    displayName: existing.displayName || "Athlete",
    photoURL: existing.photoURL || null,
  };

  auth.setUser(user);
  return { user };
}

export async function createUserWithEmailAndPassword(_authInstance, email, password) {
  const users = getStoredUsers();
  const normalizedEmail = email.trim().toLowerCase();

  const existing = users.find((u) => u.email.toLowerCase() === normalizedEmail);
  if (existing) {
    const err = new Error("An account with this email address already exists.");
    err.code = "auth/email-already-in-use";
    throw err;
  }

  const namePart = normalizedEmail.split("@")[0];
  const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
  const newUser = {
    uid: "user_" + Date.now(),
    email: normalizedEmail,
    displayName: formattedName,
    photoURL: null,
    password: password,
  };

  users.push(newUser);
  saveStoredUsers(users);

  const user = {
    uid: newUser.uid,
    email: newUser.email,
    displayName: newUser.displayName,
    photoURL: newUser.photoURL,
  };

  auth.setUser(user);
  return { user };
}

export async function signInWithPopup(_authInstance, _provider) {
  // One-Click Google Athlete Login
  const demoEmail = "athlete.google@gymbuddy.ai";
  const user = {
    uid: "google_athlete_" + Date.now(),
    email: demoEmail,
    displayName: "Alex Mercer",
    photoURL: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  };

  auth.setUser(user);
  return { user };
}

export async function signOut(_authInstance) {
  auth.setUser(null);
  return true;
}

export async function sendPasswordResetEmail(_authInstance, _email) {
  return true;
}

export async function updateProfile(user, updates) {
  if (auth.currentUser) {
    const merged = { ...auth.currentUser, ...updates };
    auth.setUser(merged);
  }
  return true;
}

// User accounts helper
function getStoredUsers() {
  try {
    const raw = localStorage.getItem("gymbuddy_registered_users");
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveStoredUsers(users) {
  try {
    localStorage.setItem("gymbuddy_registered_users", JSON.stringify(users));
  } catch (e) {}
}

// Compatibility exports
export const app = { name: "GymBuddy" };
export const db = null;
export const storage = null;
export function doc() { return {}; }
export function setDoc() { return Promise.resolve(); }
export function getDoc() { return Promise.resolve({ exists: () => false, data: () => ({}) }); }
export function updateDoc() { return Promise.resolve(); }
export function deleteDoc() { return Promise.resolve(); }
export function collection() { return {}; }
export function addDoc() { return Promise.resolve({ id: "id_" + Date.now() }); }
export function getDocs() { return Promise.resolve({ empty: true, docs: [] }); }
export function query() { return {}; }
export function where() { return {}; }
export function orderBy() { return {}; }
export function limit() { return {}; }
export function onSnapshot() { return () => {}; }
export function serverTimestamp() { return new Date().toISOString(); }
export function ref() { return {}; }
export function uploadBytes() { return Promise.resolve(); }
export function uploadBytesResumable() { return Promise.resolve(); }
export function getDownloadURL() { return Promise.resolve(""); }
export function deleteObject() { return Promise.resolve(); }
