// src/db.js
import Dexie from 'dexie';

export const db = new Dexie('StoicJournalDB');


// BUMP TO VERSION 5
db.version(5).stores({
  entries: '++id, date, content, createdAt', 
  tasks: '++id, label, completed, category, createdAt, isArchived',
  goals: '++id, label, horizon, completed, createdAt',
  gamification: 'id, points',
  
  // Existing single-row tables
  balance: 'id, total', 
  strategy: 'id', 
  debts: '++id, label, total, paid',
  usage: 'date, count',

  // NEW: Recurring Expenses (Jails)
  recurring: '++id, label, amount, dayOfMonth' 
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
  db.gamification.add({ id: 'main', points: 100 });
  db.recurring.bulkAdd([
    { label: "Rent", amount: 10000, dayOfMonth: 11 },
    { label: "EMI", amount: 10813, dayOfMonth: 13 }
  ]);
});