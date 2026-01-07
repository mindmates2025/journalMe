import { db } from "../firebase-config";
import { 
  collection, doc, setDoc, updateDoc, addDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp 
} from "firebase/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- 1. JOURNAL ENTRIES ---
export const subscribeToEntries = (callback) => {
  const q = query(collection(db, "entries"), orderBy("createdAt", "desc"));
  return onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
    const entries = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data(),
      metadata: doc.metadata 
    }));
    callback(entries);
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

// --- 2. TASKS (TODO LIST) ---
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

export const addTask = async (taskObject) => {
  await addDoc(collection(db, "tasks"), {
    ...taskObject,
    createdAt: serverTimestamp(),
  });
};

export const updateTask = async (id, updates) => {
  const taskRef = doc(db, "tasks", id);
  await updateDoc(taskRef, updates);
};

export const deleteTask = async (id) => {
  await deleteDoc(doc(db, "tasks", id));
};

// --- 3. FINANCE OPERATIONS ---
export const subscribeToBalance = (callback) => {
  return onSnapshot(doc(db, "finance", "balance"), (doc) => {
    if (doc.exists()) {
      callback(doc.data());
    } else {
      callback({ total: 0 }); 
    }
  });
};

export const subscribeToDebts = (callback) => {
  const q = query(collection(db, "finance_debts"), orderBy("label", "asc"));
  return onSnapshot(q, (snapshot) => {
    const debts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(debts);
  });
};

export const addDebt = async (debtData) => {
  await addDoc(collection(db, "finance_debts"), debtData);
};

export const updateBalance = async (newTotal) => {
  const docRef = doc(db, "finance", "balance");
  await setDoc(docRef, { total: newTotal }, { merge: true });
};

export const updateDebtPayment = async (debtId, newPaidAmount) => {
  const debtRef = doc(db, "finance_debts", debtId);
  await updateDoc(debtRef, { paid: newPaidAmount });
};

export const deleteDebt = async (debtId) => {
  await deleteDoc(doc(db, "finance_debts", debtId));
};

export const subscribeToStrategy = (callback) => {
  const docRef = doc(db, "finance", "strategy");
  return onSnapshot(docRef, (doc) => {
    if (doc.exists()) {
      callback(doc.data());
    } else {
      callback({ dailySpent: 0, upcomingPayments: [], expectedIncome: [], dailySpendsList: [] });
    }
  });
};

export const updateStrategy = async (newData) => {
  const docRef = doc(db, "finance", "strategy");
  await setDoc(docRef, newData, { merge: true });
};

// --- 4. AI PLANNING ---
export const generateAIPlan = async (contextData) => {
  const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_KEY;
  const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

  try {
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
    // This finds the part of the text between [ and ] to ignore thinking/prose
    const arrayMatch = content.match(/\[.*\]/s);
    if (!arrayMatch) throw new Error("No JSON array found in response");

    const taskArray = JSON.parse(arrayMatch[0]);

    if (!Array.isArray(taskArray)) throw new Error("Response is not an array");
    
    return taskArray;

  } catch (error) {
    console.error("AI Plan Error:", error);
    // Reliable fallback tasks so the app never crashes
    return [
      "Review GATE Control Systems (1 hr)",
      "Adhere strictly to survival budget: ₹" + contextData.survivalBudget,
      "Log all daily spends in the Bank tab",
      "Read one chapter of a Stoic text",
      "15 minutes of cardio for physical discipline"
    ];
  }
};


// --- AI USAGE TRACKER ---
export const getAiUsage = async () => {
  const apiKey = import.meta.env.VITE_OPENROUTER_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/key", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      }
    });

    if (!response.ok) throw new Error("Failed to fetch usage data");
    
    const { data } = await response.json();
    return {
      daily: data.usage_daily || 0,
      isFreeTier: data.is_free_tier, // true if < $10 credits purchased
      limit: data.is_free_tier ? 50 : 1000 // OpenRouter's official daily limits
    };
  } catch (error) {
    console.error("Usage Tracking Error:", error);
    return null;
  }
};