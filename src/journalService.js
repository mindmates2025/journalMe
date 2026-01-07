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

export const updateTask = async (id, updates) => {
  await db.tasks.update(id, updates);
};

export const deleteTask = async (id) => {
  await db.tasks.delete(id);
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
      "Review GATE Control Systems (1 hr)",
      "Adhere strictly to survival budget: ₹" + Math.floor(contextData.survivalBudget),
      "Log all daily spends in the Bank tab",
      "Read one chapter of a Stoic text",
      "15 minutes of cardio for physical discipline"
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