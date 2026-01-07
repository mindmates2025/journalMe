// src/db.js
import Dexie from 'dexie';

export const db = new Dexie('StoicJournalDB');

// CHANGE HERE: We changed .version(1) to .version(2)
// This forces the browser to upgrade the database structure
db.version(2).stores({
  // Added 'createdAt' to the index list
  entries: '++id, date, content, createdAt', 
  
  tasks: '++id, label, completed, category, createdAt',
  
  // Single row tables (we'll use ID 'main')
  balance: 'id, total', 
  strategy: 'id', 
  
  debts: '++id, label, total, paid',
  
  // AI Usage Tracking
  usage: 'date, count' 
});

// Seed initial data if empty
db.on('populate', () => {
  db.balance.add({ id: 'main', total: 0 });
  db.strategy.add({ 
    id: 'main', 
    dailySpent: 0, 
    dailySpendsList: [], 
    expectedIncome: [], 
    upcomingPayments: [] 
  });
});