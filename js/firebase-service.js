// firebase-service.js

// IMPORTANT: Replace this placeholder config with your actual Firebase project settings.
// Until you do, this app will run gracefully using a LocalStorage fallback.
const firebaseConfig = {
    apiKey: "AIzaSyAESFbvtiUtVXN2ChbAzHYnYEPmVAfMrIA",
    authDomain: "site-casino-9f8cd.firebaseapp.com",
    projectId: "site-casino-9f8cd",
    storageBucket: "site-casino-9f8cd.firebasestorage.app",
    messagingSenderId: "1087913961001",
    appId: "1:1087913961001:web:8d6d512cbbe72691d89e38",
    measurementId: "G-ZEXQP3JW3H"
};

let isFirebaseInitialized = false;
let db = null;
let currentUser = null;

// Mock data initialized from localStorage
let localUsers = JSON.parse(localStorage.getItem('casinoUsers')) || {
    "local_test_user": { username: "DemoUser", balance: 5000 }
};

export async function initFirebase() {
    try {
        if (firebaseConfig.apiKey === "VOTRE_API_KEY") {
            console.warn("⚠️ Firebase non configuré ! Utilisation du mode local fallback (LocalStorage).");
            return false;
        }

        // Import on demand so the app doesn't crash if network is down or config is bad
        const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");
        const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");

        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        isFirebaseInitialized = true;
        console.log("🔥 Firebase initialisé avec succès !");
        return true;
    } catch (e) {
        console.error("Erreur d'initialisation Firebase:", e);
        return false;
    }
}

export async function loginUser(username) {
    if (isFirebaseInitialized) {
        const { doc, getDoc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");

        const userRef = doc(db, "users", username.toLowerCase());
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            currentUser = { id: username.toLowerCase(), maxBalance: 1000, totalInvested: 0, ...userSnap.data() };
            if (currentUser.balance > currentUser.maxBalance) currentUser.maxBalance = currentUser.balance;
        } else {
            currentUser = { id: username.toLowerCase(), username: username, balance: 1000, maxBalance: 1000, totalInvested: 0 };
            await setDoc(userRef, currentUser);
        }
        return currentUser;
    } else {
        const id = username.toLowerCase();
        if (!localUsers[id]) {
            localUsers[id] = { username: username, balance: 1000, maxBalance: 1000, totalInvested: 0 };
            saveLocal();
        }
        currentUser = { id, maxBalance: 1000, totalInvested: 0, ...localUsers[id] };
        if (currentUser.balance > currentUser.maxBalance) currentUser.maxBalance = currentUser.balance;
        return currentUser;
    }
}

export async function updateBalance(amount, isBet = false) {
    if (!currentUser) return;

    currentUser.balance += amount;

    if (isBet && amount < 0) {
        currentUser.totalInvested = (currentUser.totalInvested || 0) + Math.abs(amount);
    }

    if (currentUser.balance > (currentUser.maxBalance || 0)) {
        currentUser.maxBalance = currentUser.balance;
    }

    if (isFirebaseInitialized) {
        const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        const userRef = doc(db, "users", currentUser.id);
        await updateDoc(userRef, { 
            balance: currentUser.balance,
            maxBalance: currentUser.maxBalance,
            totalInvested: currentUser.totalInvested
        });
    } else {
        let freshLocal = JSON.parse(localStorage.getItem('casinoUsers')) || localUsers;
        if (!freshLocal[currentUser.id]) freshLocal[currentUser.id] = {};
        
        freshLocal[currentUser.id].balance = currentUser.balance;
        freshLocal[currentUser.id].maxBalance = currentUser.maxBalance;
        freshLocal[currentUser.id].totalInvested = currentUser.totalInvested;
        localStorage.setItem('casinoUsers', JSON.stringify(freshLocal));
        localUsers = freshLocal;
    }
    return currentUser.balance;
}

export async function resetBalance() {
    if (!currentUser) return;
    
    currentUser.balance = 1000;
    
    if (isFirebaseInitialized) {
        const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        const userRef = doc(db, "users", currentUser.id);
        await updateDoc(userRef, { balance: currentUser.balance });
    } else {
        localUsers[currentUser.id].balance = currentUser.balance;
        saveLocal();
    }
    return currentUser.balance;
}

export async function getLeaderboard(orderByField = "balance") {
    if (!['balance', 'maxBalance', 'totalInvested'].includes(orderByField)) orderByField = 'balance';

    if (isFirebaseInitialized) {
        const { collection, getDocs, query, orderBy, limit } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        const usersRef = collection(db, "users");
        
        // Single field indexes are created automatically in Firestore
        const q = query(usersRef, orderBy(orderByField, "desc"), limit(10));
        const querySnapshot = await getDocs(q);

        const leaderboard = [];
        querySnapshot.forEach((doc) => {
            leaderboard.push(doc.data());
        });
        return leaderboard;
    } else {
        return Object.values(localUsers)
            .sort((a, b) => (b[orderByField] || 0) - (a[orderByField] || 0))
            .slice(0, 10);
    }
}

function saveLocal() {
    localStorage.setItem('casinoUsers', JSON.stringify(localUsers));
}

export function getCurrentUser() {
    return currentUser;
}

export function logout() {
    currentUser = null;
}

export { isFirebaseInitialized, db };
