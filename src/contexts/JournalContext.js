// src/contexts/JournalContext.jsx
import React, { createContext, useContext } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, createEntryPrototype } from '../db';

const JournalContext = createContext();

export const JournalProvider = ({ children }) => {
  
  // 1. READ: useLiveQuery makes the UI reactive. 
  // If you add an entry, the list updates instantly without a refresh.
  const entries = useLiveQuery(
    () => db.entries.orderBy('created_at').reverse().toArray()
  );

  // 2. WRITE: Add a new journal entry
  const addEntry = async (content, type, tags = []) => {
    const entry = {
      ...createEntryPrototype(content, type),
      tags
    };
    await db.entries.add(entry);
  };

  // 3. DELETE: Local delete
  const deleteEntry = async (id) => {
    await db.entries.delete(id);
  };

  // 4. SEARCH: Local search is blazing fast (0ms latency)
  const searchEntries = async (query) => {
    if (!query) return [];
    return await db.entries
      .filter(entry => 
        entry.content.toLowerCase().includes(query.toLowerCase()) || 
        entry.tags.includes(query)
      )
      .toArray();
  };

  return (
    <JournalContext.Provider value={{ entries, addEntry, deleteEntry, searchEntries }}>
      {children}
    </JournalContext.Provider>
  );
};

export const useJournal = () => useContext(JournalContext);