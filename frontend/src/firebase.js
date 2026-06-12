// Firebase authentication wrapper with mock fallback
// Let's create an elegant developer experience that works instantly

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
};

const isFirebaseConfigured = firebaseConfig.apiKey && firebaseConfig.apiKey !== "";

// Fully functional mock auth that maps state to local storage
const mockAuth = {
  currentUser: null,
  
  onAuthStateChanged(callback) {
    // Check if user is stored in local storage
    const storedUser = localStorage.getItem("medicare_user");
    if (storedUser) {
      this.currentUser = JSON.parse(storedUser);
    } else {
      // Default logged in user (Gowthami)
      this.currentUser = {
        uid: "gowthami-12345",
        email: "gowthami@example.com",
        displayName: "Gowthami",
        photoURL: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=faces"
      };
      localStorage.setItem("medicare_user", JSON.stringify(this.currentUser));
    }
    callback(this.currentUser);
    return () => {}; // unsubscriber
  },

  async signInWithEmailAndPassword(email, password) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    const user = {
      uid: "user-" + Math.random().toString(36).substring(2, 9),
      email: email,
      displayName: email.split("@")[0],
      photoURL: ""
    };
    this.currentUser = user;
    localStorage.setItem("medicare_user", JSON.stringify(user));
    localStorage.setItem("medicare_token", "MT:testuser1.tokenhash12345");
    return { user };
  },

  async createUserWithEmailAndPassword(email, password) {
    await new Promise(resolve => setTimeout(resolve, 800));
    const user = {
      uid: "user-" + Math.random().toString(36).substring(2, 9),
      email: email,
      displayName: email.split("@")[0],
      photoURL: ""
    };
    this.currentUser = user;
    localStorage.setItem("medicare_user", JSON.stringify(user));
    return { user };
  },

  async signOut() {
    this.currentUser = null;
    localStorage.removeItem("medicare_user");
    localStorage.removeItem("medicare_token");
    window.location.reload();
  }
};

export const auth = isFirebaseConfigured ? {
  // If user configures actual firebase, they can plug in actual initialization
  currentUser: null,
  onAuthStateChanged: () => {},
  signInWithEmailAndPassword: () => {},
  createUserWithEmailAndPassword: () => {},
  signOut: () => {},
} : mockAuth;

export const firebaseStatus = isFirebaseConfigured ? "configured" : "development_mock";
