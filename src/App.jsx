import React, { useState, useEffect } from 'react';
import { 
  addEntry, deleteEntry, subscribeToEntries, subscribeToTasks,
  subscribeToBalance, subscribeToDebts, updateBalance, updateDebtPayment, addDebt, deleteDebt,
  subscribeToStrategy, updateStrategy 
} from './journalService';
import { PenLine, BookOpen, CheckCircle2, Wallet, Trash2, Plus, Search, CheckCheck, CloudOff, Target, Calendar, X, TrendingUp, ReceiptText, Clock, Lock, RotateCcw, RefreshCw } from 'lucide-react';
import './App.css';import './App.css';

const formatEntryDate = (date) => {
  if (!date) return "Just now";
  const d = date.toDate ? date.toDate() : new Date(date);
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
  const [activeTab, setActiveTab] = useState('bank');
  const [entries, setEntries] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState({ total: 0 });
  const [debts, setDebts] = useState([]);
  const [strategy, setStrategy] = useState({ 
    dailySpent: 0, 
    upcomingPayments: [], 
    expectedIncome: [],
    dailySpendsList: [] 
  });

  const [input, setInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [modalConfig, setModalConfig] = useState({ show: false, type: '', data: null });
  const [modalInput, setModalInput] = useState({ val1: '', val2: '', val3: '' });

  useEffect(() => {
    setLoading(true);
    const unsubEntries = subscribeToEntries((data) => { setEntries(data); setLoading(false); });
    const unsubTasks = subscribeToTasks((data) => setTasks(data));
    const unsubBalance = subscribeToBalance((data) => setBalance(data));
    const unsubDebts = subscribeToDebts((data) => setDebts(data));
    const unsubStrategy = subscribeToStrategy((data) => setStrategy(data));

    return () => {
      unsubEntries();
      unsubTasks();
      unsubBalance();
      unsubDebts();
      unsubStrategy();
    };
  }, []);

  // --- 1. FIXED COMMITMENTS ---
  const MONTHLY_REPAYMENT_TOTAL = 10813; 
  const REPAYMENT_DAY = 13;
  const RENT_AMOUNT = 10000; // Standard Rent placeholder
  const RENT_DAY = 11; // MODIFIED: Now paid on the 11th

  // --- 2. LIQUIDITY MATH ENGINE ---
  const now = new Date();
  const getDaysUntil = (targetDay) => {
    const today = now.getDate();
    if (today <= targetDay) return targetDay - today + 1;
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return (lastDayOfMonth - today) + targetDay + 1;
  };
  
  const daysTo11th = getDaysUntil(RENT_DAY);
  const daysTo13th = getDaysUntil(REPAYMENT_DAY);

  // Filter Pipeline: Only include money that arrives before the respective deadlines
  const rentDeadlineDate = new Date(now.getFullYear(), now.getMonth(), RENT_DAY);
  const repaymentDeadlineDate = new Date(now.getFullYear(), now.getMonth(), REPAYMENT_DAY);

  const incomeBefore11th = (strategy?.expectedIncome || []).filter(inc => inc.date && new Date(inc.date) <= rentDeadlineDate);
  const incomeBefore13th = (strategy?.expectedIncome || []).filter(inc => inc.date && new Date(inc.date) <= repaymentDeadlineDate);

  const totalSafePipeline = incomeBefore13th.reduce((acc, inc) => acc + inc.amount, 0);

  // Liquidity Check: Ensure both Rent (11th) and Repayment (13th) are covered
  const surplus11th = balance.total + incomeBefore11th.reduce((acc, inc) => acc + inc.amount, 0) - RENT_AMOUNT;
  const surplus13th = balance.total + totalSafePipeline - RENT_AMOUNT - MONTHLY_REPAYMENT_TOTAL;

  // If we are short for EITHER deadline, survival limit is 0
  const isLiquidityShort = surplus11th < 0 || surplus13th < 0;
  
  const dailySurvivalBudget = !isLiquidityShort ? (surplus13th / daysTo13th) : 0;
  const remainingSurvivalToday = Math.max(0, dailySurvivalBudget - (strategy?.dailySpent || 0));

  const totalDebtBalance = debts.reduce((acc, d) => acc + (d.total - (d.paid || 0)), 0);
  const netPosition = balance.total - totalDebtBalance;

  // --- HANDLERS ---
  const openModal = (type, data = null) => {
    setModalConfig({ show: true, type, data });
    setModalInput({ val1: '', val2: '', val3: new Date().toISOString().split('T')[0] });
  };

  const handleModalSubmit = async () => {
    const { type, data } = modalConfig;
    const { val1, val2, val3 } = modalInput;

    // 1. Balance Update
    if (type === 'balance' && val1) await updateBalance(Number(val1));
    
    // 2. Debt Payment
    if (type === 'payment' && val1) await updateDebtPayment(data.id, (data.paid || 0) + Number(val1));
    
    // 3. New Debt
    if (type === 'newDebt' && val1 && val2) await addDebt({ label: val1, total: Number(val2), paid: 0 });
    
    // 4. Log Spend (MODIFIED TO SUBTRACT FROM BALANCE)
    if (type === 'logSpend' && val1 && val2) {
      const spendAmount = Number(val2);
      
      // Update Strategy (Daily List)
      await updateStrategy({ 
        dailySpent: (strategy.dailySpent || 0) + spendAmount,
        dailySpendsList: [...(strategy.dailySpendsList || []), { label: val1, amount: spendAmount, id: Date.now() }]
      });

      // Update Actual Liquid Cash Balance
      const newBalance = balance.total - spendAmount;
      await updateBalance(newBalance);
    }

    // 5. Add Income
    if (type === 'addIncome' && val1 && val2) {
      await updateStrategy({ 
        expectedIncome: [...(strategy.expectedIncome || []), { label: val1, amount: Number(val2), date: val3, id: Date.now() }] 
      });
    }
    
    setModalConfig({ show: false, type: '', data: null });
  };

  const handleSaveEntry = async () => {
    if (!input.trim()) return;
    await addEntry(input);
    setInput("");
    setActiveTab('history');
  };

 

  // --- UPDATED FILTER LOGIC ---
  const filteredEntries = entries.filter(entry => {
    const matchesSearch = entry.content.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!filterDate) return matchesSearch;

    const dateObj = entry.createdAt?.toDate ? entry.createdAt.toDate() : new Date(entry.createdAt);
    
    // Format to local YYYY-MM-DD for comparison with the input value
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const entryDateString = `${year}-${month}-${day}`;
    
    return matchesSearch && entryDateString === filterDate;
  });

  return (
    <div className="app-container">
      {modalConfig.show && (
        <div className="modal-overlay">
          <div className="modal-content fade-in">
            <div className="modal-header"><h3>{modalConfig.type}</h3><button onClick={() => setModalConfig({show:false})} className="close-btn"><X size={20} /></button></div>
            <div className="modal-body">
              <input type={['newDebt', 'addIncome', 'logSpend'].includes(modalConfig.type) ? 'text' : 'number'} placeholder="Label / Name" value={modalInput.val1} onChange={(e) => setModalInput({...modalInput, val1: e.target.value})} />
              {['newDebt', 'addIncome', 'logSpend'].includes(modalConfig.type) && <input type="number" placeholder="₹ Amount" value={modalInput.val2} onChange={(e) => setModalInput({...modalInput, val2: e.target.value})} style={{marginTop: '12px'}} />}
              {modalConfig.type === 'addIncome' && <div style={{marginTop: '12px'}}><label className="pill-label">Expected Date:</label><input type="date" value={modalInput.val3} onChange={(e) => setModalInput({...modalInput, val3: e.target.value})} /></div>}
            </div>
            <button className="primary-btn" onClick={handleModalSubmit} style={{marginTop: '20px'}}>Confirm</button>
          </div>
        </div>
      )}

      <header className="main-header">
        <h1>Journal<span>Me</span></h1>
        <div className="date-pill">Rent in {daysTo11th}d</div>
      </header>

      <main>
        {activeTab === 'journal' && (
          <section className="screen fade-in">
            <div className="card">
              <label className="input-label" style={{display: 'block', marginBottom: '16px', fontWeight: '600'}}>Practice moderation today...</label>
              <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="What's on your mind?" />
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

    <div className="filter-group" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
      {/* Search Input */}
      <div className="search-box" style={{ flex: 2, position: 'relative' }}>
        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', zIndex: 1 }} />
        <input 
          type="text" 
          placeholder="Search thoughts..." 
          className="search-input" 
          style={{ paddingLeft: '40px', width: '100%' }} 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
        />
      </div>

      {/* Safari-Optimized Date Filter */}
      <div className="calendar-box" style={{ flex: 1.5, position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input 
          type="date" 
          className="date-filter-input safari-date-fix" 
          value={filterDate} 
          onChange={(e) => setFilterDate(e.target.value)} 
          placeholder="Filter Date"
          required
          style={{ 
            width: '100%', 
            paddingRight: filterDate ? '35px' : '10px',
            appearance: 'none', // Force Safari to allow custom styling
            WebkitAppearance: 'none',
            minHeight: '40px',
            color: '#1e293b', // Explicitly set color for Safari
            backgroundColor: '#f1f5f9' // Explicitly set background
          }}
        />
        {/* Manual Reset Button for Safari/Mobile users */}
        {filterDate && (
          <button 
            onClick={() => setFilterDate("")} 
            style={{ 
              position: 'absolute', 
              right: '8px', 
              background: '#fee2e2', 
              border: 'none', 
              borderRadius: '50%', 
              width: '24px',
              height: '24px',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 2
            }}
          >
            <RotateCcw size={14} style={{ color: '#ef4444' }} />
          </button>
        )}
      </div>
    </div>

    <div className="entries-list">
      {loading ? (
        <p className="status-msg">Gathering thoughts...</p>
      ) : filteredEntries.length === 0 ? (
        <div className="card empty-state" style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
          <p>No reflections found.</p>
        </div>
      ) : (
        filteredEntries.map(entry => (
          <div key={entry.id} className="card entry-card">
            <p className="entry-content">{entry.content}</p>
            <div className="entry-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{formatEntryDate(entry.createdAt)}</span>
              <button onClick={() => deleteEntry(entry.id)} className="delete-text-btn" style={{ color: '#ef4444', background: 'none', border: 'none', fontWeight: '600', fontSize: '0.85rem' }}>
                Delete
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  </section>
)}
        {activeTab === 'todo' && (
          <section className="screen fade-in">
             <h3 className="section-title">Daily Tasks</h3>
             <div className="card empty-state"><p>No tasks for today. Stay focused!</p></div>
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

            <h3 className="section-title">Daily Strategy</h3>
            <div className="card strategy-card">
              <div className="jail-grid" style={{display:'flex', justifyContent:'space-between', background:'#f8fafc', padding:'12px', borderRadius:'12px', marginBottom:'20px', border:'1px solid #e2e8f0'}}>
                <div className="jail-item" style={{textAlign:'center', flex:1}}>
                  <span className="strat-label">Rent Jail (11th)</span>
                  <p className="strat-value text-primary" style={{fontWeight:'800'}}>₹{Math.ceil(RENT_AMOUNT / daysTo11th).toLocaleString('en-IN')}</p>
                  <small style={{fontSize:'0.6rem'}}>Daily Set Aside</small>
                </div>
                <div style={{width:'1px', background:'#e2e8f0'}}></div>
                <div className="jail-item" style={{textAlign:'center', flex:1}}>
                  <span className="strat-label">Installment (13th)</span>
                  <p className="strat-value text-danger" style={{fontWeight:'800'}}>₹{Math.ceil(MONTHLY_REPAYMENT_TOTAL / daysTo13th).toLocaleString('en-IN')}</p>
                  <small style={{fontSize:'0.6rem'}}>Daily Set Aside</small>
                </div>
              </div>

              <div className="survival-hero" style={{textAlign:'center', marginBottom:'24px'}}>
                <span className="pill-label">Survival Limit Today</span>
                <h1 style={{fontSize:'2.5rem', fontWeight:'900', color: !isLiquidityShort ? '#10b981' : '#ef4444'}}>
                    ₹{Math.floor(remainingSurvivalToday).toLocaleString('en-IN')}
                </h1>
                {isLiquidityShort && <small className="text-danger">⚠️ Cash Shortage for upcoming Deadlines</small>}
              </div>

              <div className="income-pipeline-section">
                <div className="pipeline-header"><span className="pill-label">Income Pipeline (Before 13th)</span><strong className="text-success">+₹{totalSafePipeline.toLocaleString('en-IN')}</strong></div>
                <div className="pipeline-list">
                  {incomeBefore13th.map((inc) => (
                    <div key={inc.id} style={{display:'flex', justifyContent:'space-between', fontSize:'0.75rem', marginBottom:'4px'}}>
                      <div className="item-info"><Clock size={12} style={{marginRight:'4px'}}/><span>{inc.label} ({formatPipelineDate(inc.date)})</span></div>
                      <strong>₹{inc.amount.toLocaleString('en-IN')}</strong>
                    </div>
                  ))}
                </div>
                <button className="log-action-btn income-btn" onClick={() => openModal('addIncome')}><TrendingUp size={14} /> Expected Payment</button>
              </div>

              <div className="spend-sub-section" style={{marginTop:'12px', background:'#f8fafc', padding:'12px', borderRadius:'12px'}}>
                <div className="spend-meta" style={{display:'flex', justifyContent:'space-between', marginBottom:'10px'}}>
                   <span>Daily Floor: <strong>₹{Math.floor(dailySurvivalBudget)}</strong></span>
                   <span>Spent: <strong>₹{strategy.dailySpent}</strong></span>
                </div>
                {strategy.dailySpendsList?.map((item) => (
                    <div key={item.id} style={{display:'flex', justifyContent:'space-between', fontSize:'0.8rem', padding:'4px 0'}}>
                      <div className="item-info"><ReceiptText size={14} style={{marginRight:'4px'}}/><span>{item.label}</span></div>
                      <div className="item-actions"><strong>₹{item.amount}</strong><button onClick={() => handleDeleteSpendItem(item.id, item.amount)} className="item-del-btn" style={{marginLeft:'4px', border:'none', background:'none'}}><X size={12}/></button></div>
                    </div>
                ))}
                <button className="log-action-btn" onClick={() => openModal('logSpend')} style={{marginTop:'10px'}}><Plus size={14} /> Log Spend</button>
              </div>
              <button className="mini-action-btn" onClick={() => updateStrategy({ dailySpent: 0, dailySpendsList: [] })} style={{marginTop:'10px', width:'100%'}}>Reset Day</button>
            </div>

            <div className="section-header-row" style={{marginTop:'24px', display:'flex', justifyContent:'space-between'}}>
                <h3>Active Debts</h3>
                <button onClick={() => openModal('newDebt')} className="add-debt-btn"><Plus size={16}/> Add New Tracker</button>
            </div>
            <div className="debt-stack">
              {debts.map(debt => (
                <div key={debt.id} className="card debt-item-card" onClick={() => openModal('payment', debt)}>
                  <div className="debt-header" style={{display:'flex', justifyContent:'space-between'}}><strong>{debt.label}</strong><span className="debt-remaining-tag">₹{(debt.total - (debt.paid || 0)).toLocaleString('en-IN')} left</span></div>
                  <div className="progress-container" style={{height:'6px', background:'#f1f5f9', borderRadius:'3px', margin:'10px 0'}}>
                    <div style={{width:`${((debt.paid || 0) / debt.total) * 100}%`, height:'100%', background:'#8b5cf6', borderRadius:'3px'}}></div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <nav className="bottom-nav">
        <NavBtn icon={<PenLine />} label="Write" active={activeTab === 'journal'} onClick={() => setActiveTab('journal')} />
        <NavBtn icon={<BookOpen />} label="Entries" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
        <NavBtn icon={<CheckCircle2 />} label="Tasks" active={activeTab === 'todo'} onClick={() => setActiveTab('todo')} />
        <NavBtn icon={<Wallet />} label="Bank" active={activeTab === 'bank'} onClick={() => setActiveTab('bank')} />
      </nav>
    </div>
  );
}

const NavBtn = ({ icon, label, active, onClick }) => (
  <button className={`nav-btn ${active ? 'active' : ''}`} onClick={onClick}>{React.cloneElement(icon, { size: 24 })}<span>{label}</span></button>
);

export default App;