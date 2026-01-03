import { db } from "../firebase-config";
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  serverTimestamp,
  onSnapshot
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