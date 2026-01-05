import React, { useState, useEffect } from 'react';
import { 
  addEntry, deleteEntry, subscribeToEntries, subscribeToTasks,
  subscribeToBalance, subscribeToDebts, updateBalance, updateDebtPayment, addDebt, deleteDebt,
  subscribeToStrategy, updateStrategy 
} from './journalService';
import { PenLine, BookOpen, CheckCircle2, Wallet, Trash2, Plus, Search, CheckCheck, CloudOff, Target, Calendar, X, TrendingUp, ReceiptText, Clock, Lock } from 'lucide-react';
import './App.css';

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
  const MONTHLY_REPAYMENT_TOTAL = 10683; // 4835 + 4013 + 1835
  const RENT_AMOUNT = 15000; // Change this to your actual rent
  const REPAYMENT_DAY = 13;
  const RENT_DUE_DAY = 1;

  // --- 2. DEADLINE MATH ENGINE ---
  const getDaysUntil = (targetDay) => {
    const now = new Date();
    const today = now.getDate();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    if (today <= targetDay) return targetDay - today + 1;
    return (lastDay - today) + targetDay + 1;
  };

  const daysTo13th = getDaysUntil(REPAYMENT_DAY);
  const daysToRent = getDaysUntil(RENT_DUE_DAY);

  // Daily "Jail" (Money to lock away daily for deadlines)
  const dailyRepaymentJail = MONTHLY_REPAYMENT_TOTAL / daysTo13th;
  const dailyRentJail = RENT_AMOUNT / daysToRent;

  // Survival budget accounts for current cash + incoming freelance pipeline
  const totalExpectedIncome = (strategy?.expectedIncome || []).reduce((acc, inc) => acc + inc.amount, 0);
  const dailySurvivalBudget = Math.max(0, (balance.total + totalExpectedIncome - (MONTHLY_REPAYMENT_TOTAL + RENT_AMOUNT)) / 30);
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

    if (type === 'balance' && val1) await updateBalance(Number(val1));
    if (type === 'payment' && val1) await updateDebtPayment(data.id, (data.paid || 0) + Number(val1));
    if (type === 'newDebt' && val1 && val2) await addDebt({ label: val1, total: Number(val2), paid: 0 });
    
    if (type === 'logSpend' && val1 && val2) {
      await updateStrategy({ 
        dailySpent: (strategy.dailySpent || 0) + Number(val2),
        dailySpendsList: [...(strategy.dailySpendsList || []), { label: val1, amount: Number(val2), id: Date.now() }]
      });
    }
    if (type === 'addIncome' && val1 && val2) {
      await updateStrategy({ expectedIncome: [...(strategy.expectedIncome || []), { label: val1, amount: Number(val2), date: val3, id: Date.now() }] });
    }
    
    setModalConfig({ show: false, type: '', data: null });
  };

  const handleSaveEntry = async () => {
    if (!input.trim()) return;
    await addEntry(input);
    setInput("");
    setActiveTab('history');
  };

  const filteredEntries = entries.filter(entry => {
    const matchesSearch = entry.content.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="app-container">
      {modalConfig.show && (
        <div className="modal-overlay">
          <div className="modal-content fade-in">
            <div className="modal-header"><h3>{modalConfig.type}</h3><button onClick={() => setModalConfig({show:false})} className="close-btn"><X size={20} /></button></div>
            <div className="modal-body">
              <input type={['addIncome', 'logSpend', 'newDebt'].includes(modalConfig.type) ? 'text' : 'number'} placeholder="Name / Amount" value={modalInput.val1} onChange={(e) => setModalInput({...modalInput, val1: e.target.value})} />
              {['addIncome', 'logSpend', 'newDebt'].includes(modalConfig.type) && <input type="number" placeholder="₹ Amount" value={modalInput.val2} onChange={(e) => setModalInput({...modalInput, val2: e.target.value})} style={{marginTop: '12px'}} />}
              {modalConfig.type === 'addIncome' && <div style={{marginTop: '12px'}}><label className="pill-label">Date:</label><input type="date" value={modalInput.val3} onChange={(e) => setModalInput({...modalInput, val3: e.target.value})} /></div>}
            </div>
            <button className="primary-btn" onClick={handleModalSubmit} style={{marginTop: '20px'}}>Confirm</button>
          </div>
        </div>
      )}

      <header className="main-header">
        <h1>Journal<span>Me</span></h1>
        <div className="date-pill">13th Due: {daysTo13th}d</div>
      </header>

      <main>
        {activeTab === 'journal' && (
          <section className="screen fade-in">
            <div className="card">
              <label className="input-label" style={{display: 'block', marginBottom: '16px', fontWeight: '600'}}>Moderation is the key...</label>
              <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="What's on your mind?" />
              <button onClick={handleSaveEntry} className="primary-btn"><PenLine size={20} /> Save Reflection</button>
            </div>
          </section>
        )}

        {activeTab === 'history' && (
          <section className="screen fade-in">
            <div className="section-header-row"><h3 className="section-title">History</h3><span className="pill">{filteredEntries.length}</span></div>
            <input type="text" placeholder="Search..." className="search-input" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{marginBottom:'20px'}}/>
            <div className="entries-list">
              {filteredEntries.map(entry => (
                <div key={entry.id} className="card entry-card"><p>{entry.content}</p><span className="entry-date" style={{fontSize:'0.75rem', color:'#64748b'}}>{formatEntryDate(entry.createdAt)}</span></div>
              ))}
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
                  <span className="strat-label">Repayment Jail</span>
                  <p className="strat-value text-danger" style={{fontWeight:'800'}}>₹{Math.ceil(dailyRepaymentJail).toLocaleString('en-IN')}</p>
                  <small style={{fontSize:'0.6rem'}}>Until 13th</small>
                </div>
                <div style={{width:'1px', background:'#e2e8f0'}}></div>
                <div className="jail-item" style={{textAlign:'center', flex:1}}>
                  <span className="strat-label">Rent Jail</span>
                  <p className="strat-value text-primary" style={{fontWeight:'800'}}>₹{Math.ceil(dailyRentJail).toLocaleString('en-IN')}</p>
                  <small style={{fontSize:'0.6rem'}}>Until 1st</small>
                </div>
              </div>

              <div className="survival-hero" style={{textAlign:'center', marginBottom:'24px'}}>
                <span className="pill-label">Survival Limit Today</span>
                <h1 style={{fontSize:'2.5rem', fontWeight:'900', color:'#10b981'}}>₹{Math.floor(remainingSurvivalToday).toLocaleString('en-IN')}</h1>
              </div>

              <div className="income-pipeline-section">
                <div className="pipeline-header"><span className="pill-label">Income Pipeline</span><strong className="text-success">+₹{totalExpectedIncome.toLocaleString('en-IN')}</strong></div>
                <div className="pipeline-list">
                  {(strategy?.expectedIncome || []).map((inc) => (
                    <div key={inc.id} style={{display:'flex', justifyContent:'space-between', fontSize:'0.75rem', marginBottom:'4px'}}>
                      <span>{inc.label} ({formatPipelineDate(inc.date)})</span>
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
                      <span>{item.label}</span><strong>₹{item.amount}</strong>
                    </div>
                ))}
                <button className="log-action-btn" onClick={() => openModal('logSpend')} style={{marginTop:'10px'}}><Plus size={14} /> Log Spend</button>
              </div>
              <button className="mini-action-btn" onClick={() => updateStrategy({ dailySpent: 0, dailySpendsList: [] })} style={{marginTop:'10px', width:'100%'}}>Reset Day</button>
            </div>

            <h3 className="section-title" style={{marginTop:'24px'}}>Active Debts</h3>
            <div className="debt-stack">
              {debts.map(debt => (
                <div key={debt.id} className="card debt-item-card" onClick={() => openModal('payment', debt)}>
                  <div className="debt-header" style={{display:'flex', justifyContent:'space-between'}}><strong>{debt.label}</strong><span className="debt-remaining-tag">₹{(debt.total - (debt.paid || 0)).toLocaleString('en-IN')} left</span></div>
                  <div className="progress-container" style={{height:'6px', background:'#f1f5f9', borderRadius:'3px', margin:'10px 0'}}>
                    <div style={{width:`${((debt.paid || 0) / debt.total) * 100}%`, height:'100%', background:'#8b5cf6', borderRadius:'3px'}}></div>
                  </div>
                </div>
              ))}
              <button onClick={() => openModal('newDebt')} className="add-debt-btn" style={{width:'100%', marginTop:'10px'}}><Plus size={16}/> Add New Tracker</button>
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