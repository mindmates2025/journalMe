// src/db.js
import Dexie from 'dexie';

export const db = new Dexie('StoicJournalDB');

// CHANGE HERE: We changed .version(1) to .version(2)
// This forces the browser to upgrade the database structure
db.version(3).stores({
  entries: '++id, date, content, createdAt', 
  tasks: '++id, label, completed, category, createdAt',
  
  // NEW: Goals Table
  // horizon = 'weekly', 'monthly', 'yearly'
  goals: '++id, label, horizon, completed, createdAt',

  balance: 'id, total', 
  strategy: 'id', 
  debts: '++id, label, total, paid',
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