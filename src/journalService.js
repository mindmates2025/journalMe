import { db } from "../firebase-config";
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  addDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp 
} from "firebase/firestore";

// --- Journal Entries with Real-time Caching ---
export const subscribeToEntries = (callback) => {
  const q = query(collection(db, "entries"), orderBy("createdAt", "desc"));
  return onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
    const entries = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data(),
      metadata: doc.metadata 
    }));
    callback(entries);
  });
};

export const addEntry = async (content) => {
  await addDoc(collection(db, "entries"), {
    content,
    createdAt: serverTimestamp(),
  });
};

export const deleteEntry = async (id) => {
  await deleteDoc(doc(db, "entries", id));
};

// --- Tasks (Todo List) ---
export const subscribeToTasks = (callback) => {
  const q = query(collection(db, "tasks"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    }));
    callback(tasks);
  });
};

export const addTask = async (text) => {
  await addDoc(collection(db, "tasks"), {
    text,
    completed: false,
    createdAt: serverTimestamp(),
  });
};

// --- FINANCE CRUD OPERATIONS ---

// 1. READ: Subscribe to Balance
export const subscribeToBalance = (callback) => {
  // Listen specifically to the 'balance' document inside 'finance'
  return onSnapshot(doc(db, "finance", "balance"), (doc) => {
    if (doc.exists()) {
      callback(doc.data());
    } else {
      callback({ total: 0 }); 
    }
  });
};

// 2. READ: Subscribe to Debts (Real-time)
export const subscribeToDebts = (callback) => {
  const q = query(collection(db, "finance_debts"), orderBy("label", "asc"));
  return onSnapshot(q, (snapshot) => {
    const debts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(debts);
  });
};

// 3. CREATE: Add a new Debt
export const addDebt = async (debtData) => {
  await addDoc(collection(db, "finance_debts"), debtData);
};

// 4. UPDATE: Update Balance (FIXED: Uses setDoc to create the collection if missing)
export const updateBalance = async (newTotal) => {
  const docRef = doc(db, "finance", "balance");
  // setDoc will create the 'finance' collection and 'balance' doc automatically
  await setDoc(docRef, { total: newTotal }, { merge: true });
};

export const updateDebtPayment = async (debtId, newPaidAmount) => {
  const debtRef = doc(db, "finance_debts", debtId);
  await updateDoc(debtRef, { paid: newPaidAmount });
};

// 5. DELETE: Remove a Debt
export const deleteDebt = async (debtId) => {
  await deleteDoc(doc(db, "finance_debts", debtId));
};