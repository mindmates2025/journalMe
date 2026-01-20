// src/journalService.js
import { db } from './db';
import { liveQuery } from 'dexie';

// --- 1. JOURNAL ENTRIES ---
export const subscribeToEntries = (callback) => {
  // Observes the local DB. Updates UI automatically when data changes.
  const observable = liveQuery(() => db.entries.orderBy('createdAt').reverse().toArray());
  const subscription = observable.subscribe(callback);
  return () => subscription.unsubscribe();
};

export const addEntry = async (content) => {
  await db.entries.add({
    content,
    createdAt: new Date(), // Standard JS Date instead of Firebase Timestamp
    date: new Date().toISOString()
  });
};

export const deleteEntry = async (id) => {
  await db.entries.delete(id);
};

// --- 2. TASKS (TODO LIST) ---
export const subscribeToTasks = (callback) => {
  const observable = liveQuery(() => db.tasks.orderBy('createdAt').reverse().toArray());
  const subscription = observable.subscribe(callback);
  return () => subscription.unsubscribe();
};

export const addTask = async (taskObject) => {
  await db.tasks.add({
    ...taskObject,
    createdAt: new Date(),
  });
};

// MODIFY existing 'updateTask'
export const updateTask = async (id, updates) => {
  // Check if we are completing it for the first time
  if (updates.completed === true) {
    await updateScore(5); // +5 for finishing
  }
  // Check if un-completing (oops moment)
  if (updates.completed === false) {
    await updateScore(-5); // Revert points
  }
  await db.tasks.update(id, updates);
};

export const deleteTask = async (id) => {
  // 1. Get the task first to check its status
  const task = await db.tasks.get(id);
  // -2 for deleting (Giving up)
  if (task) {
    // Only penalize if the task was NOT completed (i.e., giving up)
    if (!task.completed) {
      await updateScore(-2); 
    }
    // If task.completed is true, we do NOTHING to the score. 
    // You keep your +5 reward because you earned it.
    
    await db.tasks.delete(id);
  }
};

// --- 3. FINANCE OPERATIONS ---

// Balance is a single row with id='main'
export const subscribeToBalance = (callback) => {
  const observable = liveQuery(async () => {
    const doc = await db.balance.get('main');
    return doc || { total: 0 };
  });
  const subscription = observable.subscribe(callback);
  return () => subscription.unsubscribe();
};

export const subscribeToDebts = (callback) => {
  const observable = liveQuery(() => db.debts.toArray());
  const subscription = observable.subscribe(callback);
  return () => subscription.unsubscribe();
};

export const addDebt = async (debtData) => {
  await db.debts.add(debtData);
};

export const updateBalance = async (newTotal) => {
  // 'put' acts like upsert (insert or update)
  await db.balance.put({ id: 'main', total: newTotal });
};

export const updateDebtPayment = async (debtId, newPaidAmount) => {
  await db.debts.update(debtId, { paid: newPaidAmount });
};

export const deleteDebt = async (debtId) => {
  await db.debts.delete(debtId);
};

// Strategy is a single row with id='main'
export const subscribeToStrategy = (callback) => {
  const observable = liveQuery(async () => {
    const doc = await db.strategy.get('main');
    return doc || { dailySpent: 0, upcomingPayments: [], expectedIncome: [], dailySpendsList: [] };
  });
  const subscription = observable.subscribe(callback);
  return () => subscription.unsubscribe();
};

export const updateStrategy = async (newData) => {
  const current = await db.strategy.get('main') || {};
  // Simulate Firebase { merge: true }
  await db.strategy.put({ ...current, ...newData, id: 'main' });
};

// --- 4. AI PLANNING (LOCAL FIRST) ---
export const generateAIPlan = async (contextData) => {
  const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_KEY;
  const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

  try {
    // 1. Check Usage Limit Locally First
    const usage = await getAiUsage();
    if (usage.daily >= usage.limit) {
      throw new Error("Daily AI Limit Reached");
    }

    // 2. Call API
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.origin,
        "X-Title": "JournalMe PWA"
      },
      body: JSON.stringify({
        "model": "xiaomi/mimo-v2-flash:free",
        "messages": [
          {
            "role": "system",
            "content": "You are a Stoic Executive Coach. Return ONLY a JSON array of 5 strings. Format: [\"Task 1\", \"Task 2\", ...]. No other text or markdown."
          },
          {
            "role": "user",
            "content": `Financials: Net ₹${contextData.netPosition}, Survival Budget ₹${contextData.survivalBudget}. Recent Thoughts: ${contextData.recentEntries.join(" | ")}. Goals: GATE Instrumentation prep, PSU prep (NRL/SAIL), CC debt repayment. Generate 5 tasks.`
          }
        ]
      })
    });

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "";

    // --- SMART EXTRACTION logic ---
    const arrayMatch = content.match(/\[.*\]/s);
    if (!arrayMatch) throw new Error("No JSON array found in response");

    const taskArray = JSON.parse(arrayMatch[0]);

    if (!Array.isArray(taskArray)) throw new Error("Response is not an array");
    
    // 3. Track usage locally
    await incrementAiUsage();

    return taskArray;

  } catch (error) {
    console.error("AI Plan Error:", error);
    // Reliable fallback tasks so the app never crashes
    return [
      "Review your daily survival budget in the Bank tab", // Directs them to your specific app feature
      "Practice Premeditatio Malorum: What could go wrong today?", // Stoic theme
      "Identify the one task you are avoiding and do it first", // General Productivity
      "Log your current mental state in the Journal", // App feature
      "Take a 10-minute walk to clear your mind" // Wellness
    ];
  }
};


// --- AI USAGE TRACKER (LOCAL) ---
export const incrementAiUsage = async () => {
  const today = new Date().toISOString().split('T')[0];
  
  // Use Dexie transaction to be safe
  await db.transaction('rw', db.usage, async () => {
    const entry = await db.usage.get(today);
    if (entry) {
      await db.usage.update(today, { count: entry.count + 1 });
    } else {
      await db.usage.add({ date: today, count: 1 });
    }
  });
};

export const getAiUsage = async () => {
  const today = new Date().toISOString().split('T')[0];
  try {
    const entry = await db.usage.get(today);
    return {
      daily: entry ? entry.count : 0,
      limit: 50 
    };
  } catch (error) {
    console.error("Usage fetch error:", error);
    return { daily: 0, limit: 50 };
  }
};


// --- BACKUP & RESTORE ---

export const performBackup = async () => {
  try {
    const allData = {
      entries: await db.entries.toArray(),
      tasks: await db.tasks.toArray(),
      debts: await db.debts.toArray(),
      balance: await db.balance.toArray(),
      strategy: await db.strategy.toArray(),
      usage: await db.usage.toArray(),
      backupDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(allData)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    a.download = `JournalMe_AutoBackup_${dateStr}.json`;
    a.click();
    
    // Mark today as backed up
    localStorage.setItem('lastAutoBackup', dateStr);
    return true;
  } catch (err) {
    console.error("Backup failed", err);
    return false;
  }
};

// Wrapper for manual button click
export const exportData = () => {
  performBackup();
};

export const importData = async (file) => {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        await db.transaction('rw', db.entries, db.tasks, db.debts, db.balance, db.strategy, db.usage, async () => {
          await db.entries.clear(); await db.tasks.clear(); await db.debts.clear();
          await db.balance.clear(); await db.strategy.clear(); await db.usage.clear();
          
          if(data.entries) await db.entries.bulkAdd(data.entries);
          if(data.tasks) await db.tasks.bulkAdd(data.tasks);
          if(data.debts) await db.debts.bulkAdd(data.debts);
          if(data.balance) await db.balance.bulkAdd(data.balance);
          if(data.strategy) await db.strategy.bulkAdd(data.strategy);
          if(data.usage) await db.usage.bulkAdd(data.usage);
        });
        resolve(true);
      } catch (err) { reject(err); }
    };
    reader.readAsText(file);
  });
};


// --- GOALS (VISION) ---

export const subscribeToGoals = (callback) => {
  // Sort by created date, newest first
  const observable = liveQuery(() => db.goals.orderBy('createdAt').reverse().toArray());
  const subscription = observable.subscribe(callback);
  return () => subscription.unsubscribe();
};

export const addGoal = async (label, horizon) => {
  // horizon must be: 'weekly', 'monthly', or 'yearly'
  await db.goals.add({
    label,
    horizon, 
    completed: false,
    createdAt: new Date()
  });
};

export const toggleGoal = async (id, currentStatus) => {
  await db.goals.update(id, { completed: !currentStatus });
};

export const deleteGoal = async (id) => {
  await db.goals.delete(id);
};


// --- GAMIFICATION HELPERS ---

export const subscribeToScore = (callback) => {
  const observable = liveQuery(async () => {
    const g = await db.gamification.get('main');
    return g ? g.points : 100;
  });
  const subscription = observable.subscribe(callback);
  return () => subscription.unsubscribe();
};

const updateScore = async (amount) => {
  await db.transaction('rw', db.gamification, async () => {
    const g = await db.gamification.get('main');
    const current = g ? g.points : 100;
    await db.gamification.put({ id: 'main', points: current + amount });
  });
};


// --- THE MIDNIGHT JUDGE (Day Reset) ---

export const processDailyReset = async () => {
  const today = new Date().toISOString().split('T')[0];
  const lastRun = localStorage.getItem('lastDailyReset');

  // Only run if we haven't run it today yet
  if (lastRun !== today) {
    console.log("Running Daily Reset logic...");
    
    await db.transaction('rw', db.tasks, db.gamification, async () => {
      // 1. Find active tasks (not archived)
      const activeTasks = await db.tasks.filter(t => !t.isArchived).toArray();
      
      let penalty = 0;
      
      for (const task of activeTasks) {
        if (!task.completed) {
          penalty += 5; // -5 per failure
        }
        // Archive ALL tasks from yesterday (Clear the board)
        await db.tasks.update(task.id, { isArchived: true });
      }

      // 2. Apply Penalty
      if (penalty > 0) {
        const g = await db.gamification.get('main');
        const current = g ? g.points : 100;
        await db.gamification.put({ id: 'main', points: current - penalty });
        // Optional: Log a journal entry about the failure?
      }
    });

    localStorage.setItem('lastDailyReset', today);
    return true; // Return true to tell UI to show a summary toast
  }
  return false;
};


// --- RECURRING EXPENSES (JAILS) ---

export const subscribeToRecurring = (callback) => {
  const observable = liveQuery(() => db.recurring.orderBy('dayOfMonth').toArray());
  const subscription = observable.subscribe(callback);
  return () => subscription.unsubscribe();
};

export const addRecurring = async (label, amount, dayOfMonth) => {
  await db.recurring.add({ label, amount: Number(amount), dayOfMonth: Number(dayOfMonth) });
};

export const deleteRecurring = async (id) => {
  await db.recurring.delete(id);
};