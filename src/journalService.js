import { db } from "../firebase-config";
import { 
  collection, doc, updateDoc, addDoc, deleteDoc, onSnapshot, query, orderBy 
} from "firebase/firestore";


// --- Journal Entries with Real-time Caching ---
// Instead of a one-time fetch, we use a listener
export const subscribeToEntries = (callback) => {
  const q = query(collection(db, "entries"), orderBy("createdAt", "desc"));
  
  // onSnapshot is smart: it checks local cache first, then only fetches 
  // updates from the server. This drastically reduces your read count.
  return onSnapshot(q, (snapshot) => {
    const entries = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    }));
    callback(entries);
  }, (error) => {
    console.error("Firestore Error:", error);
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

// --- Tasks (Todo List) with Real-time Caching ---
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

// --- Finance (Bank) ---
export const subscribeToBankData = (callback) => {
  return onSnapshot(collection(db, "finance"), (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(data);
  });
};


// --- Finance (Bank) Real-time Subscription ---
export const subscribeToFinance = (callback) => {
  const collectionRef = collection(db, "finance");
  
  // Using onSnapshot to keep your bank data updated with 0-cost caching
  return onSnapshot(collectionRef, (snapshot) => {
    const data = snapshot.docs.reduce((acc, doc) => {
      acc[doc.id] = doc.data();
      return acc;
    }, {});
    callback(data);
  });
};

// Function to update a specific debt payment or balance
export const updateFinanceRecord = async (docId, newData) => {
  const docRef = doc(db, "finance", docId);
  await updateDoc(docRef, newData);
};



// --- FINANCE CRUD OPERATIONS ---

// 1. READ: Subscribe to Balance
export const subscribeToBalance = (callback) => {
  return onSnapshot(doc(db, "finance", "balance"), (doc) => {
    if (doc.exists()) {
      callback(doc.data());
    } else {
      callback({ total: 0 }); // Default if doc doesn't exist
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
  // debtData: { label: "Car Loan", total: 500000, paid: 0, amount: 500000 }
  await addDoc(collection(db, "finance_debts"), debtData);
};

// 4. UPDATE: Update Balance or Debt Payment
export const updateBalance = async (newTotal) => {
  await updateDoc(doc(db, "finance", "balance"), { total: newTotal });
};

export const updateDebtPayment = async (debtId, newPaidAmount) => {
  const debtRef = doc(db, "finance_debts", debtId);
  await updateDoc(debtRef, { paid: newPaidAmount });
};

// 5. DELETE: Remove a Debt
export const deleteDebt = async (debtId) => {
  await deleteDoc(doc(db, "finance_debts", debtId));
};