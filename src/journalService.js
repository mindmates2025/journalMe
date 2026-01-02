import { db } from "../firebase-config";

import { 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  serverTimestamp 
} from "firebase/firestore";

const journalCollection = collection(db, "entries");

// CREATE: Save a new journal entry
export const addEntry = async (content) => {
  try {
    await addDoc(journalCollection, {
      content,
      createdAt: serverTimestamp(), // Use server time for consistency
    });
  } catch (error) {
    console.error("Error adding entry: ", error);
  }
};

// READ: Fetch all entries ordered by newest first
export const getEntries = async () => {
  const q = query(journalCollection, orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

// DELETE: Remove an entry
export const deleteEntry = async (id) => {
  const entryDoc = doc(db, "entries", id);
  await deleteDoc(entryDoc);
};