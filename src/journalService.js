import { db } from "../firebase-config";


import { 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  serverTimestamp 
} from "firebase/firestore";

// --- Journal Entries ---
export const addEntry = async (content) => {
  await addDoc(collection(db, "entries"), {
    content,
    createdAt: serverTimestamp(),
  });
};

export const getEntries = async () => {
  const q = query(collection(db, "entries"), orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const deleteEntry = async (id) => {
  await deleteDoc(doc(db, "entries", id));
};

// --- Tasks (Todo List) ---
export const addTask = async (text) => {
  await addDoc(collection(db, "tasks"), {
    text,
    completed: false,
    createdAt: serverTimestamp(),
  });
};

export const getTasks = async () => {
  const q = query(collection(db, "tasks"), orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// --- Finance (Bank) ---
// Note: You can store your static debt values here too for easy updating
export const getBankData = async () => {
  const querySnapshot = await getDocs(collection(db, "finance"));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};