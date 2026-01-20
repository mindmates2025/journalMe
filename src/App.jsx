import React, { useState, useEffect } from 'react';
import { 
  addEntry, deleteEntry, subscribeToEntries, subscribeToTasks,
  subscribeToBalance, subscribeToDebts, updateBalance, updateDebtPayment, addDebt, deleteDebt,
  subscribeToStrategy, updateStrategy,
  addTask, updateTask, deleteTask,
  generateAIPlan,
  getAiUsage,
  exportData, importData,
  subscribeToGoals, addGoal, toggleGoal, deleteGoal,
  subscribeToScore, processDailyReset,
  subscribeToRecurring, addRecurring, deleteRecurring
} from './journalService';
import { 
  PenLine, BookOpen, CheckCircle2, Wallet, Trash2, Plus, Search, 
  CheckCheck, Target, X, TrendingUp, ReceiptText, Clock, RotateCcw, 
  Sparkles, RefreshCw, Edit2, Check,
  Download, Upload , Telescope, Calendar, Flag, Trophy , Settings
} from 'lucide-react';
import InstallPwa from './InstallPwa'; // <--- NEW IMPORT
import './App.css';

// --- HELPER FUNCTIONS ---

const formatEntryDate = (date) => {
  if (!date) return "Just now";
  
  // Handle Firebase Timestamp or Standard JS Date/String
  const d = date && typeof date.toDate === 'function' ? date.toDate() : new Date(date);
  
  // Validate Date
  if (isNaN(d.getTime())) return "Just now";

  const now = new Date();
  const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const diffInDays = Math.floor((nowDate - dDate) / (1000 * 60 * 60 * 24));
  
  if (diffInDays === 0) return "Today";
  if (diffInDays === 1) return "Yesterday";
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatPipelineDate = (dateStr) => {
  if (!dateStr) return "TBD";
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

function App() {
  // --- STATE MANAGEMENT ---
  const [activeTab, setActiveTab] = useState('journal');
  const [entries, setEntries] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // AI State
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiUsage, setAiUsage] = useState({ daily: 0, limit: 50 });

  // Financial State
  const [balance, setBalance] = useState({ total: 0 });
  const [debts, setDebts] = useState([]);
  const [strategy, setStrategy] = useState({ 
    dailySpent: 0, 
    upcomingPayments: [], 
    expectedIncome: [],
    dailySpendsList: [] 
  });

  // UI State
  const [input, setInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [modalConfig, setModalConfig] = useState({ show: false, type: '', data: null });
  const [modalInput, setModalInput] = useState({ val1: '', val2: '', val3: '' });


  const [goals, setGoals] = useState([]);

  const [score, setScore] = useState(100);

  const [recurring, setRecurring] = useState([]);

  // --- INITIALIZATION ---

  const refreshAiUsage = async () => {
    try {
      const stats = await getAiUsage();
      if (stats) setAiUsage(stats);
    } catch (err) {
      console.error("Usage fetch failed:", err);
    }
  };

  useEffect(() => {
    setLoading(true);
    
    // Subscriptions (Safe-guarded)
    const unsubEntries = subscribeToEntries ? subscribeToEntries((data) => { setEntries(data); setLoading(false); }) : () => {};
    const unsubTasks = subscribeToTasks ? subscribeToTasks((data) => setTasks(data)) : () => {};
    const unsubBalance = subscribeToBalance ? subscribeToBalance((data) => setBalance(data)) : () => {};
    const unsubDebts = subscribeToDebts ? subscribeToDebts((data) => setDebts(data)) : () => {};
    const unsubStrategy = subscribeToStrategy ? subscribeToStrategy((data) => setStrategy(data)) : () => {};
    const unsubGoals = subscribeToGoals ? subscribeToGoals(setGoals) : () => {}; // <--- NEW SUB
    const unsubScore = subscribeToScore(setScore);
    const unsubRecurring = subscribeToRecurring(setRecurring);
    
    refreshAiUsage(); 

    processDailyReset().then((wasReset) => {
      if(wasReset) alert("New Day Started. Tasks cleared. Points deducted for incomplete tasks.");
    });

    return () => {
      if (unsubEntries) unsubEntries();
      if (unsubTasks) unsubTasks();
      if (unsubBalance) unsubBalance();
      if (unsubDebts) unsubDebts();
      if (unsubStrategy) unsubStrategy();
      if (unsubGoals) unsubGoals();
      unsubScore();
      unsubRecurring();
    };
  }, []);

  // --- DYNAMIC FINANCIAL CALCULATIONS ---
  const now = new Date();
  
  // Helper to calculate days until a specific day of the month
  const getDaysUntil = (targetDay) => {
    const today = now.getDate();
    if (today <= targetDay) return targetDay - today + 1;
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return (lastDayOfMonth - today) + targetDay + 1;
  };

  // --- FINANCIAL CALCULATIONS (Place BEFORE return) ---
  
  // 1. Recurring Bills (Jails)
  const jailItems = recurring.map(item => {
    const daysLeft = getDaysUntil(item.dayOfMonth);
    const dailyCost = Math.ceil(item.amount / daysLeft);
    return { ...item, daysLeft, dailyCost };
  });

  const sortedBills = [...jailItems].sort((a, b) => a.daysLeft - b.daysLeft);
  const nextBill = sortedBills[0]; // Needed for Header

  // 2. Debt & Net Position
  const totalDebtBalance = debts.reduce((acc, d) => acc + (d.total - (d.paid || 0)), 0);
  const netPosition = balance.total - totalDebtBalance; // <--- DEFINED HERE

  // 3. Survival Budget Calculation
  // Calculate total monthly liability dynamically
  const totalMonthlyLiability = recurring.reduce((acc, item) => acc + item.amount, 0);
  
  // Liquidity Check: Do we have enough for the NEXT bill?
  const surplusForNextBill = nextBill ? (balance.total - nextBill.amount) : balance.total;
  const isLiquidityShort = surplusForNextBill < 0;

  // Simple Daily Budget: (Balance - Next Bill) / Days to Next Bill
  // If no bills, just divide balance by 30
  const dailySurvivalBudget = nextBill 
    ? (Math.max(0, balance.total - nextBill.amount) / nextBill.daysLeft) 
    : (balance.total / 30);

  const remainingSurvivalToday = Math.max(0, dailySurvivalBudget - (strategy?.dailySpent || 0));

  // 4. Income Pipelines
  const repaymentDeadlineDate = new Date(now.getFullYear(), now.getMonth(), 13); // Defaulting to 13th for pipeline split
  const incomeBefore13th = (strategy?.expectedIncome || []).filter(inc => inc.date && new Date(inc.date) <= repaymentDeadlineDate);
  const incomeAfter13th = (strategy?.expectedIncome || []).filter(inc => inc.date && new Date(inc.date) > repaymentDeadlineDate);
  const totalSafePipeline = incomeBefore13th.reduce((acc, inc) => acc + Number(inc.amount), 0);
  // --- HANDLERS ---

  const handleSaveEntry = async () => {
    if (!input.trim()) return;
    try {
      await addEntry(input);
      setInput("");
      setActiveTab('history');
    } catch (error) {
      alert("Failed to save entry locally. check console.");
      console.error(error);
    }
  };

  const handleAddTask = async (label) => {
    if (!label || !label.trim()) return;
    await addTask({ label: label.trim(), completed: false, category: 'discipline' });
  };

  const handleToggleTask = async (task) => {
    await updateTask(task.id, { completed: !task.completed });
  };

  const handleDeleteTask = async (id) => {
    if (window.confirm("Delete this discipline?")) await deleteTask(id); 
  };

  const handleGenerateAiPlan = async () => {
    if (isAiLoading) return;

    if (aiUsage.daily >= aiUsage.limit) {
      alert(`Daily AI limit reached (${aiUsage.daily}/${aiUsage.limit}). Reset happens at 00:00 UTC.`);
      return;
    }

    setIsAiLoading(true);
    try {
      const contextData = {
        netPosition: netPosition,
        survivalBudget: remainingSurvivalToday,
        recentEntries: entries.slice(0, 3).map(e => e.content),
      };
      
      const aiTasks = await generateAIPlan(contextData);
      
      if (aiTasks && Array.isArray(aiTasks)) {
        for (const taskLabel of aiTasks) {
          await addTask({ label: taskLabel, completed: false, category: 'ai-generated' });
        }
        await refreshAiUsage(); // Update counter instantly
      }
    } catch (error) {
      console.error("AI Generation failed:", error);
      alert("AI Plan failed. Check your connection.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleDeleteSpendItem = async (itemId, amount) => {
    const updatedList = strategy.dailySpendsList.filter(item => item.id !== itemId);
    await updateStrategy({
      dailySpent: Math.max(0, (strategy.dailySpent || 0) - amount),
      dailySpendsList: updatedList
    });
    await updateBalance(balance.total + amount);
  };

  // --- INCOME HANDLERS ---
  const handleClearIncome = async (incomeId, amount) => {
    if(!window.confirm(`Add ₹${amount} to Liquid Cash and clear this payment?`)) return;
    const newList = strategy.expectedIncome.filter(i => i.id !== incomeId);
    await updateStrategy({ expectedIncome: newList });
    await updateBalance(balance.total + Number(amount));
  };

  const handleDeleteIncome = async (incomeId) => {
    if(!window.confirm("Remove this expected payment?")) return;
    const newList = strategy.expectedIncome.filter(i => i.id !== incomeId);
    await updateStrategy({ expectedIncome: newList });
  };

  // --- MODAL HANDLERS ---
  const openModal = (type, data = null) => {
    setModalConfig({ show: true, type, data });
    if (type === 'editIncome' && data) {
      setModalInput({ val1: data.label, val2: data.amount, val3: data.date });
    } else {
      setModalInput({ val1: '', val2: '', val3: new Date().toISOString().split('T')[0] });
    }
  };

  const handleModalSubmit = async () => {
    const { type, data } = modalConfig;
    const { val1, val2, val3 } = modalInput;

    if (type === 'balance' && val1) await updateBalance(Number(val1));
    if (type === 'payment' && val1) await updateDebtPayment(data.id, (data.paid || 0) + Number(val1));
    if (type === 'newDebt' && val1 && val2) await addDebt({ label: val1, total: Number(val2), paid: 0 });
    
    if (type === 'logSpend' && val1 && val2) {
      const spendAmount = Number(val2);
      await updateStrategy({ 
        dailySpent: (strategy.dailySpent || 0) + spendAmount,
        dailySpendsList: [...(strategy.dailySpendsList || []), { label: val1, amount: spendAmount, id: Date.now() }]
      });
      await updateBalance(balance.total - spendAmount);
    }

    if (type === 'addIncome' && val1 && val2) {
      await updateStrategy({ 
        expectedIncome: [...(strategy.expectedIncome || []), { label: val1, amount: Number(val2), date: val3, id: Date.now() }] 
      });
    }

    if (type === 'editIncome' && val1 && val2) {
      const newList = strategy.expectedIncome.map(inc => 
        inc.id === data.id ? { ...inc, label: val1, amount: Number(val2), date: val3 } : inc
      );
      await updateStrategy({ expectedIncome: newList });
    }
    if (type === 'addRecurring' && val1 && val2 && val3) {
      await addRecurring(val1, val2, val3); // Label, Amount, Day
    }
    
    setModalConfig({ show: false, type: '', data: null });
  };

  const handleAddGoal = async (horizon) => {
  const input = document.getElementById('goalInput');
  if(!input.value.trim()) return;
  await addGoal(input.value.trim(), horizon);
  input.value = '';
};

  const filteredEntries = entries.filter(entry => entry.content.toLowerCase().includes(searchTerm.toLowerCase()));
  // --- Calculation Logic (Place this before return) ---
  
  // --- RENDER ---
  return (
    <div className="app-container">
      
      <InstallPwa /> {/* --- ADDED HERE: Custom Install Banner --- */}

      {modalConfig.show && (
        <div className="modal-overlay">
          <div className="modal-content fade-in">
            <div className="modal-header">
                <h3>{modalConfig.type}</h3>
                <button onClick={() => setModalConfig({show:false})} className="close-btn"><X size={20} /></button>
            </div>
            <div className="modal-body">
              <input 
                type={['newDebt', 'addIncome', 'logSpend', 'editIncome'].includes(modalConfig.type) ? 'text' : 'number'} 
                placeholder="Label / Name" 
                autoFocus
                value={modalInput.val1} 
                onChange={(e) => setModalInput({...modalInput, val1: e.target.value})} 
              />
              {['newDebt', 'addIncome', 'logSpend', 'editIncome'].includes(modalConfig.type) && 
                <input type="number" placeholder="₹ Amount" value={modalInput.val2} onChange={(e) => setModalInput({...modalInput, val2: e.target.value})} style={{marginTop: '12px'}} />
              }
              {['addIncome', 'editIncome'].includes(modalConfig.type) && 
                <div style={{marginTop: '12px'}}>
                    <label className="pill-label">Date:</label>
                    <input type="date" value={modalInput.val3} onChange={(e) => setModalInput({...modalInput, val3: e.target.value})} />
                </div>
              }
              {modalConfig.type === 'addRecurring' && (
                <>
                   <input type="text" placeholder="Bill Name (e.g. Rent)" autoFocus value={modalInput.val1} onChange={(e) => setModalInput({...modalInput, val1: e.target.value})} />
                   <input type="number" placeholder="Amount (₹)" value={modalInput.val2} onChange={(e) => setModalInput({...modalInput, val2: e.target.value})} style={{marginTop: '12px'}} />
                   <div style={{marginTop: '12px'}}>
                     <label className="pill-label">Due Day (1-31):</label>
                     <input type="number" min="1" max="31" value={modalInput.val3} onChange={(e) => setModalInput({...modalInput, val3: e.target.value})} />
                   </div>
                </>
              )}
            </div>
            <button className="primary-btn" onClick={handleModalSubmit} style={{marginTop: '20px'}}>Confirm</button>
          </div>
        </div>
      )}

      <header className="main-header">
        <div>
           <h1 style={{margin:0, fontSize:'1.5rem'}}>Journal<span>Me</span></h1>
           
           {/* DYNAMIC BILL PILL */}
           <div className="date-pill">
             {nextBill ? (
               <>{nextBill.label} in {nextBill.daysLeft}d</>
             ) : (
               <>No Upcoming Bills</>
             )}
           </div>
        </div>

        {/* SCORE DISPLAY */}
        <div className="score-pill" style={{
            background: score < 50 ? '#fee2e2' : '#dcfce7', 
            color: score < 50 ? '#ef4444' : '#166534',
            padding: '8px 12px', borderRadius: '20px', 
            fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px',
            boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
        }}>
           <Trophy size={16} />
           {score}
        </div>
      </header>

      <main>
        {activeTab === 'journal' && (
          <section className="screen fade-in">
            <div className="card">
              <label className="input-label" style={{display: 'block', marginBottom: '16px', fontWeight: '600'}}>Practice moderation today...</label>
              <textarea 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                placeholder="What's on your mind?" 
                autoFocus
              />
              <button onClick={handleSaveEntry} className="primary-btn"><PenLine size={20} /> Save Reflection</button>
            </div>
          </section>
        )}

        {activeTab === 'history' && (
          <section className="screen fade-in">
            <div className="section-header-row">
              <h3 className="section-title">History</h3>
              <span className="pill">{filteredEntries.length} Entries</span>
            </div>

            {/* --- BACKUP CONTROLS --- */}
            <div className="backup-controls" style={{display: 'flex', gap: '10px', marginBottom: '16px'}}>
              <button 
                onClick={exportData}
                style={{flex:1, padding:'10px', background:'#e2e8f0', border:'none', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', fontWeight:'600', fontSize:'0.8rem', color:'#334155', cursor: 'pointer'}}
              >
                <Download size={16}/> Backup
              </button>
              
              <label style={{flex:1, padding:'10px', background:'#e2e8f0', border:'none', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', fontWeight:'600', fontSize:'0.8rem', color:'#334155', cursor:'pointer'}}>
                <Upload size={16}/> Restore
                <input 
                  type="file" 
                  accept=".json" 
                  style={{display:'none'}} 
                  onChange={async (e) => {
                    if(e.target.files[0]) {
                      if(window.confirm("This will OVERWRITE all current data. Continue?")) {
                        await importData(e.target.files[0]);
                        alert("Data restored successfully!");
                        window.location.reload();
                      }
                    }
                  }}
                />
              </label>
            </div>
            {/* --------------------------- */}

            <div className="filter-group" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <div className="search-box" style={{ flex: 2, position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', zIndex: 1 }} />
                <input type="text" placeholder="Search thoughts..." className="search-input" style={{ paddingLeft: '40px', width: '100%' }} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>
            <div className="entries-list">
              {loading ? <p className="status-msg">Gathering thoughts...</p> : filteredEntries.map(entry => (
                <div key={entry.id} className="card entry-card">
                  <p className="entry-content">{entry.content}</p>
                  <div className="entry-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{formatEntryDate(entry.createdAt || entry.date)}</span>
                    <button onClick={() => deleteEntry(entry.id)} className="delete-text-btn" style={{ color: '#ef4444', background: 'none', border: 'none', fontWeight: '600' }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'todo' && (
          <section className="screen fade-in">
            <div className="section-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <h3 className="section-title" style={{ marginBottom: 0 }}>Daily Discipline</h3>
                <span style={{ fontSize: '0.65rem', color: aiUsage.daily >= aiUsage.limit ? '#ef4444' : '#64748b', fontWeight: '800' }}>
                   AI: {aiUsage.daily}/{aiUsage.limit} REQ TODAY
                </span>
              </div>
              <button onClick={handleGenerateAiPlan} disabled={isAiLoading} className="ai-plan-btn" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '700', fontSize: '0.85rem', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)', cursor: isAiLoading ? 'wait' : 'pointer' }}>
                {isAiLoading ? <RefreshCw className="spin" size={16} /> : <Sparkles size={16} />}
                {isAiLoading ? "Planning..." : "AI Plan"}
              </button>
            </div>
            <div className="card task-input-card" style={{ marginBottom: '24px', padding: '12px' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Target size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input type="text" placeholder="Set a new intention..." className="search-input" style={{ paddingLeft: '40px', width: '100%' }} onKeyDown={(e) => { if (e.key === 'Enter') { handleAddTask(e.target.value); e.target.value = ''; } }} />
              </div>
            </div>
            <div className="task-list">
              {[...tasks].filter(t => !t.isArchived).sort((a, b) => a.completed - b.completed).map(task => (
                <div key={task.id} className={`card task-card ${task.completed ? 'completed' : ''}`} onClick={() => handleToggleTask(task)} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '16px', marginBottom: '12px', borderLeft: task.completed ? '4px solid #e2e8f0' : '4px solid #8b5cf6', opacity: task.completed ? 0.7 : 1 }}>
                  <div className={`check-circle ${task.completed ? 'checked' : ''}`} style={{ width: '24px', height: '24px', borderRadius: '50%', border: task.completed ? 'none' : '2px solid #cbd5e1', background: task.completed ? '#10b981' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {task.completed && <CheckCheck size={14} color="white" />}
                  </div>
                  <span style={{ flex: 1, textDecoration: task.completed ? 'line-through' : 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {task.category === 'ai-generated' && <Sparkles size={14} color="#8b5cf6" />}
                    {task.label}
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }} style={{ background: 'none', border: 'none', color: '#fca5a5' }}><Trash2 size={18} /></button>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'bank' && (
          <section className="screen fade-in">
            <div className="bank-hero-card" onClick={() => openModal('balance')}>
              <div className="hero-content">
                <p className="hero-label">Net Financial Position</p>
                <h2 className="hero-amount">₹{netPosition.toLocaleString('en-IN')}</h2>
                <p className="hero-subtitle">Liquid Cash: ₹{balance.total.toLocaleString('en-IN')}</p>
              </div>
              <div className="hero-accent-circle"></div>
            </div>

            <div className="section-header-row" style={{marginTop:'24px', justifyContent:'space-between'}}>
               <h3 className="section-title">Liquidity Jails</h3>
               <button onClick={() => openModal('addRecurring')} style={{background:'none', border:'none', color:'#64748b'}}>
                 <Settings size={18} />
               </button>
            </div>

            <div className="card strategy-card" style={{ marginBottom: '16px', padding:'0' }}>
              <div className="jail-grid" style={{ 
                  display: 'grid', 
                  gridTemplateColumns: `repeat(${recurring.length > 0 ? recurring.length : 1}, 1fr)`, 
                  background: '#f8fafc', 
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden'
              }}>
                {recurring.length === 0 ? (
                  <p style={{padding:'12px', textAlign:'center', fontSize:'0.8rem', color:'#94a3b8'}}>No recurring bills set.</p>
                ) : (
                  jailItems.map((item, index) => (
                    <div key={item.id} style={{ 
                        textAlign: 'center', 
                        padding:'12px', 
                        borderRight: index < jailItems.length -1 ? '1px solid #e2e8f0' : 'none' 
                    }}>
                      <div style={{display:'flex', justifyContent:'center', alignItems:'center', gap:'4px'}}>
                         <span className="strat-label" style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>
                           {item.label} ({item.daysLeft}d)
                         </span>
                         {/* Optional delete button for cleanup */}
                         <button onClick={() => { if(confirm('Delete bill?')) deleteRecurring(item.id) }} style={{border:'none', background:'none', padding:0, color:'#cbd5e1', cursor:'pointer'}}><X size={10}/></button>
                      </div>
                      <p className={`strat-value ${item.dailyCost > 2000 ? 'text-danger' : 'text-primary'}`} style={{ fontWeight: '800', margin: '4px 0 0' }}>
                        ₹{item.dailyCost.toLocaleString('en-IN')}/d
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <h3 className="section-title">Survival Strategy</h3>
            <div className="card strategy-card">
              <div className="survival-hero" style={{ textAlign: 'center', marginBottom: '24px' }}>
                <span className="pill-label">Daily Survival Budget</span>
                <h1 style={{ fontSize: '2.5rem', fontWeight: '900', color: !isLiquidityShort ? '#10b981' : '#ef4444' }}>
                  ₹{Math.floor(remainingSurvivalToday).toLocaleString('en-IN')}
                </h1>
                {isLiquidityShort && <small className="text-danger" style={{ fontWeight: '700' }}>⚠️ Cash Shortage for Jails</small>}
              </div>

              {/* INCOME PIPELINE - BEFORE 13TH */}
              <div className="income-pipeline-section">
                <div className="pipeline-header" style={{ marginBottom: '10px' }}>
                  <span className="pill-label" style={{ background: '#dcfce7', color: '#166534' }}>Safe Pipeline (Before 13th)</span>
                  <strong className="text-success">+₹{totalSafePipeline.toLocaleString('en-IN')}</strong>
                </div>
                <div className="pipeline-list">
                  {incomeBefore13th.map((inc) => (
                    <div key={inc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px dashed #e2e8f0' }}>
                      <div className="item-info">
                        <Clock size={12} style={{ marginRight: '4px' }} />
                        <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{inc.label}</span>
                        <div style={{ fontSize: '0.65rem', color: '#64748b' }}>{formatPipelineDate(inc.date)}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '0.9rem' }}>₹{Number(inc.amount).toLocaleString('en-IN')}</strong>
                        <button onClick={() => handleClearIncome(inc.id, inc.amount)} className="action-icon-btn text-success"><Check size={16} /></button>
                        <button onClick={() => openModal('editIncome', inc)} className="action-icon-btn text-primary"><Edit2 size={14} /></button>
                        <button onClick={() => handleDeleteIncome(inc.id)} className="action-icon-btn text-danger"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* INCOME PIPELINE - AFTER 13TH */}
              <div className="income-pipeline-section" style={{ marginTop: '20px', opacity: 0.8 }}>
                <div className="pipeline-header" style={{ marginBottom: '10px' }}>
                  <span className="pill-label" style={{ background: '#f1f5f9', color: '#475569' }}>Future Pipeline (After 13th)</span>
                </div>
                <div className="pipeline-list">
                  {incomeAfter13th.map((inc) => (
                    <div key={inc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px dashed #e2e8f0' }}>
                      <div className="item-info">
                        <span style={{ fontSize: '0.85rem' }}>{inc.label}</span>
                        <div style={{ fontSize: '0.65rem', color: '#64748b' }}>{formatPipelineDate(inc.date)}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '0.9rem' }}>₹{Number(inc.amount).toLocaleString('en-IN')}</strong>
                        <button onClick={() => handleClearIncome(inc.id, inc.amount)} className="action-icon-btn text-success"><Check size={16} /></button>
                        <button onClick={() => openModal('editIncome', inc)} className="action-icon-btn text-primary"><Edit2 size={14} /></button>
                        <button onClick={() => handleDeleteIncome(inc.id)} className="action-icon-btn text-danger"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="log-action-btn income-btn" onClick={() => openModal('addIncome')} style={{ marginTop: '15px' }}><TrendingUp size={14} /> Expect Payment</button>
              </div>

              <div className="spend-sub-section" style={{ marginTop: '20px', background: '#f8fafc', padding: '12px', borderRadius: '12px' }}>
                <div className="spend-meta" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.8rem' }}>
                  <span>Daily Floor: <strong>₹{Math.floor(dailySurvivalBudget)}</strong></span>
                  <span>Spent: <strong>₹{strategy.dailySpent}</strong></span>
                </div>
                {strategy.dailySpendsList?.map((item) => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '4px 0' }}>
                    <div className="item-info"><ReceiptText size={14} style={{ marginRight: '4px' }} /><span>{item.label}</span></div>
                    <div className="item-actions"><strong>₹{item.amount}</strong><button onClick={() => handleDeleteSpendItem(item.id, item.amount)} style={{ marginLeft: '4px', border: 'none', background: 'none' }}><X size={12} /></button></div>
                  </div>
                ))}
                <button className="log-action-btn" onClick={() => openModal('logSpend')} style={{ marginTop: '10px', width: '100%' }}><Plus size={14} /> Log Spend</button>
              </div>
            </div>

            <div className="section-header-row" style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between' }}>
              <h3>Active Debts</h3>
              <button onClick={() => openModal('newDebt')} className="add-debt-btn"><Plus size={16} /> Add New</button>
            </div>
            <div className="debt-stack">
              {debts.map(debt => (
                <div key={debt.id} className="card debt-item-card" onClick={() => openModal('payment', debt)}>
                  <div className="debt-header" style={{ display: 'flex', justifyContent: 'space-between' }}><strong>{debt.label}</strong><span>₹{(debt.total - (debt.paid || 0)).toLocaleString('en-IN')} left</span></div>
                  <div className="progress-container" style={{ height: '6px', background: '#f1f5f9', borderRadius: '3px', margin: '10px 0' }}>
                    <div style={{ width: `${((debt.paid || 0) / debt.total) * 100}%`, height: '100%', background: '#8b5cf6', borderRadius: '3px' }}></div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'vision' && (
          <section className="screen fade-in">
             <div className="section-header-row">
              <h3 className="section-title">Strategic Vision</h3>
            </div>
            
            {/* --- NEW: PROGRESS DASHBOARD --- */}
            <div className="card" style={{marginBottom: '20px', padding: '16px'}}>
              <h4 style={{marginTop:0, marginBottom:'16px', fontSize:'0.9rem', color:'#64748b', display:'flex', alignItems:'center', gap:'8px'}}>
                 <TrendingUp size={16}/> Goal Velocity
              </h4>
              
              <ProgressBar 
                label="Weekly Sprints" 
                total={goals.filter(g => g.horizon === 'weekly').length} 
                completed={goals.filter(g => g.horizon === 'weekly' && g.completed).length}
                color="#6366f1" // Indigo
              />
              
              <ProgressBar 
                label="Monthly Milestones" 
                total={goals.filter(g => g.horizon === 'monthly').length} 
                completed={goals.filter(g => g.horizon === 'monthly' && g.completed).length}
                color="#ec4899" // Pink
              />
              
              <ProgressBar 
                label="Yearly Resolution" 
                total={goals.filter(g => g.horizon === 'yearly').length} 
                completed={goals.filter(g => g.horizon === 'yearly' && g.completed).length}
                color="#eab308" // Yellow
              />
            </div>
            {/* GOAL INPUT SECTION */}
            <div className="card" style={{marginBottom: '20px', padding: '16px'}}>
               <h4 style={{marginTop:0, marginBottom:'12px', fontSize:'0.9rem', color:'#64748b'}}>Set New Target</h4>
               <div style={{display:'flex', gap:'8px', marginBottom:'10px'}}>
                 <input 
                   type="text" 
                   id="goalInput"
                   placeholder="Achieve what?" 
                   className="search-input"
                   style={{flex:1, paddingLeft:'12px'}} 
                 />
               </div>
               <div style={{display:'flex', gap:'8px'}}>
                 <button className="goal-tag-btn week" onClick={() => handleAddGoal('weekly')}>+ This Week</button>
                 <button className="goal-tag-btn month" onClick={() => handleAddGoal('monthly')}>+ This Month</button>
                 <button className="goal-tag-btn year" onClick={() => handleAddGoal('yearly')}>+ This Year</button>
               </div>
            </div>

            {/* WEEKLY GOALS */}
            <GoalSection 
              title="Weekly Focus" 
              icon={<Clock size={18} color="#6366f1"/>} 
              goals={goals.filter(g => g.horizon === 'weekly')} 
              onToggle={toggleGoal} 
              onDelete={deleteGoal}
            />

            {/* MONTHLY GOALS */}
            <GoalSection 
              title="Monthly Targets" 
              icon={<Calendar size={18} color="#ec4899"/>} 
              goals={goals.filter(g => g.horizon === 'monthly')} 
              onToggle={toggleGoal} 
              onDelete={deleteGoal}
            />

            {/* YEARLY GOALS */}
            <GoalSection 
              title="Yearly Resolutions" 
              icon={<Flag size={18} color="#eab308"/>} 
              goals={goals.filter(g => g.horizon === 'yearly')} 
              onToggle={toggleGoal} 
              onDelete={deleteGoal}
            />
          </section>
        )}
      </main>

      <nav className="bottom-nav">
        <NavBtn icon={<PenLine />} label="Write" active={activeTab === 'journal'} onClick={() => setActiveTab('journal')} />
        <NavBtn icon={<BookOpen />} label="Entries" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
        <NavBtn icon={<CheckCircle2 />} label="Tasks" active={activeTab === 'todo'} onClick={() => setActiveTab('todo')} />
        <NavBtn icon={<Wallet />} label="Bank" active={activeTab === 'bank'} onClick={() => setActiveTab('bank')} />
        <NavBtn icon={<Telescope />} label="Vision" active={activeTab === 'vision'} onClick={() => setActiveTab('vision')} />
      </nav>
    </div>
  );
}

const NavBtn = ({ icon, label, active, onClick }) => (
  <button className={`nav-btn ${active ? 'active' : ''}`} onClick={onClick}>{React.cloneElement(icon, { size: 24 })}<span>{label}</span></button>
);

export default App;


const GoalSection = ({ title, icon, goals, onToggle, onDelete }) => (
  <div style={{marginBottom: '24px'}}>
    <div style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px', paddingLeft:'4px'}}>
      {icon}
      <h4 style={{margin:0, fontSize:'1rem', fontWeight:'700'}}>{title}</h4>
      <span className="pill" style={{fontSize:'0.7rem'}}>{goals.filter(g => !g.completed).length} left</span>
    </div>
    
    {goals.length === 0 && <p style={{fontSize:'0.8rem', color:'#94a3b8', fontStyle:'italic', marginLeft:'30px'}}>No targets set yet.</p>}

    <div className="goal-list">
      {goals.map(g => (
        <div key={g.id} className={`card goal-card ${g.completed ? 'completed' : ''}`} onClick={() => onToggle(g.id, g.completed)}>
           <div className={`check-circle ${g.completed ? 'checked' : ''}`}>
             {g.completed && <Check size={12} color="white"/>}
           </div>
           <span style={{flex:1, textDecoration: g.completed ? 'line-through' : 'none', color: g.completed ? '#94a3b8' : '#1e293b'}}>
             {g.label}
           </span>
           <button onClick={(e) => {e.stopPropagation(); onDelete(g.id)}} style={{background:'none', border:'none', color:'#cbd5e1'}}>
             <X size={16}/>
           </button>
        </div>
      ))}
    </div>
  </div>
);


const ProgressBar = ({ label, total, completed, color }) => {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  return (
    <div style={{marginBottom: '12px'}}>
      <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.75rem', fontWeight:'600', marginBottom:'4px', color:'#475569'}}>
        <span>{label}</span>
        <span>{percentage}% ({completed}/{total})</span>
      </div>
      <div style={{width:'100%', height:'8px', background:'#e2e8f0', borderRadius:'4px', overflow:'hidden'}}>
        <div style={{
           width: `${percentage}%`, 
           height:'100%', 
           background: color, 
           borderRadius:'4px',
           transition: 'width 0.5s ease-in-out'
        }}></div>
      </div>
    </div>
  );
};