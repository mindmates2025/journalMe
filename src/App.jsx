import React, { useState, useEffect, useCallback } from 'react';
import { 
  addEntry, deleteEntry, subscribeToEntries, subscribeToTasks,
  subscribeToBalance, subscribeToDebts, updateBalance, updateDebtPayment, addDebt, deleteDebt,
  subscribeToStrategy, updateStrategy 
} from './journalService';
// FIXED: Added RotateCcw to the imports
import { PenLine, BookOpen, CheckCircle2, Wallet, Trash2, Plus, Search, CheckCheck, CloudOff, Target, Calendar, X, TrendingUp, ReceiptText, Clock, Lock, RotateCcw, RefreshCw } from 'lucide-react';
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
  const [refreshing, setRefreshing] = useState(false);
  const [balance, setBalance] = useState({ total: 0 });
  const [debts, setDebts] = useState([]);
  const [strategy, setStrategy] = useState({ 
    dailySpent: 0, 
    expectedIncome: [],
    dailySpendsList: [] 
  });

  const [input, setInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [modalConfig, setModalConfig] = useState({ show: false, type: '', data: null });
  const [modalInput, setModalInput] = useState({ val1: '', val2: '', val3: '' });

  // --- REFRESH LOGIC ---
  const setupSubscriptions = useCallback(() => {
    const unsubEntries = subscribeToEntries((data) => { setEntries(data); setLoading(false); });
    const unsubTasks = subscribeToTasks((data) => setTasks(data));
    const unsubBalance = subscribeToBalance((data) => setBalance(data));
    const unsubDebts = subscribeToDebts((data) => setDebts(data));
    const unsubStrategy = subscribeToStrategy((data) => setStrategy(data));

    return () => {
      unsubEntries(); unsubTasks(); unsubBalance(); unsubDebts(); unsubStrategy();
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    return setupSubscriptions();
  }, [setupSubscriptions]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setupSubscriptions();
    setTimeout(() => setRefreshing(false), 800);
  };

  // Pull-to-refresh touch handlers
  const [touchStart, setTouchStart] = useState(0);
  const handleTouchStart = (e) => setTouchStart(e.targetTouches[0].clientY);
  const handleTouchMove = (e) => {
    const currentTouch = e.targetTouches[0].clientY;
    if (window.scrollY === 0 && currentTouch - touchStart > 150 && !refreshing) {
      handleRefresh();
    }
  };

  // --- MATH ENGINE ---
  const MONTHLY_REPAYMENT_TOTAL = 10813; 
  const REPAYMENT_DAY = 13;
  const RENT_AMOUNT = 10000;
  const RENT_DAY = 11;

  const now = new Date();
  const getDaysUntil = (targetDay) => {
    const today = now.getDate();
    if (today <= targetDay) return targetDay - today + 1;
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return (lastDayOfMonth - today) + targetDay + 1;
  };
  
  const daysTo11th = getDaysUntil(RENT_DAY);
  const daysTo13th = getDaysUntil(REPAYMENT_DAY);

  const deadlineDate = new Date(now.getFullYear(), now.getMonth(), REPAYMENT_DAY);
  const safeIncome = (strategy?.expectedIncome || []).filter(inc => inc.date && new Date(inc.date) <= deadlineDate);
  const totalSafePipeline = safeIncome.reduce((acc, inc) => acc + inc.amount, 0);

  const surplus13th = balance.total + totalSafePipeline - RENT_AMOUNT - MONTHLY_REPAYMENT_TOTAL;
  const dailySurvivalBudget = surplus13th > 0 ? (surplus13th / daysTo13th) : 0;
  const remainingSurvivalToday = Math.max(0, dailySurvivalBudget - (strategy?.dailySpent || 0));

  const totalDebtBalance = debts.reduce((acc, d) => acc + (d.total - (d.paid || 0)), 0);
  const netPosition = balance.total - totalDebtBalance;

  // --- HANDLERS ---
  const handleSaveEntry = async () => {
    if (!input.trim()) return;
    await addEntry(input);
    setInput("");
    setActiveTab('history');
  };

  const openModal = (type, data = null) => {
    setModalConfig({ show: true, type, data });
    setModalInput({ val1: '', val2: '', val3: new Date().toISOString().split('T')[0] });
  };

  const handleModalSubmit = async () => {
    const { type, data } = modalConfig;
    const { val1, val2, val3 } = modalInput;

    if (type === 'balance' && val1) await updateBalance(Number(val1));
    if (type === 'payment' && val1) await updateDebtPayment(data.id, (data.paid || 0) + Number(val1));
    
    if (type === 'logSpend' && val1 && val2) {
      const amount = Number(val2);
      await updateStrategy({ 
        dailySpent: (strategy.dailySpent || 0) + amount,
        dailySpendsList: [...(strategy.dailySpendsList || []), { label: val1, amount, id: Date.now() }]
      });
      await updateBalance(balance.total - amount);
    }
    
    if (type === 'addIncome' && val1 && val2) {
      await updateStrategy({ expectedIncome: [...(strategy.expectedIncome || []), { label: val1, amount: Number(val2), date: val3, id: Date.now() }] });
    }
    setModalConfig({ show: false, type: '', data: null });
  };

  const filteredEntries = entries.filter(entry => {
    const matchesSearch = entry.content.toLowerCase().includes(searchTerm.toLowerCase());
    let matchesDate = true;
    if (filterDate && entry.createdAt) {
      const dateObj = entry.createdAt.toDate ? entry.createdAt.toDate() : new Date(entry.createdAt);
      const entryDateString = dateObj.toISOString().split('T')[0]; 
      matchesDate = entryDateString === filterDate;
    }
    return matchesSearch && matchesDate;
  });

  return (
    <div 
      className={`app-container ${refreshing ? 'refreshing-blur' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      {refreshing && (
        <div className="pull-refresh-indicator">
          <RefreshCw className="spin-icon" size={20} />
          <span>Syncing...</span>
        </div>
      )}

      {modalConfig.show && (
        <div className="modal-overlay">
          <div className="modal-content fade-in">
            <div className="modal-header"><h3>{modalConfig.type}</h3><button onClick={() => setModalConfig({show:false})} className="close-btn"><X size={20} /></button></div>
            <div className="modal-body">
              <input type={['addIncome', 'logSpend'].includes(modalConfig.type) ? 'text' : 'number'} placeholder="Label" value={modalInput.val1} onChange={(e) => setModalInput({...modalInput, val1: e.target.value})} />
              <input type="number" placeholder="Amount (₹)" value={modalInput.val2} onChange={(e) => setModalInput({...modalInput, val2: e.target.value})} style={{marginTop: '12px'}} />
              {modalConfig.type === 'addIncome' && <input type="date" value={modalInput.val3} onChange={(e) => setModalInput({...modalInput, val3: e.target.value})} style={{marginTop: '12px'}} />}
            </div>
            <button className="primary-btn" onClick={handleModalSubmit} style={{marginTop: '20px'}}>Confirm</button>
          </div>
        </div>
      )}

      <header className="main-header">
        <h1>Journal<span>Me</span></h1>
        <div className="date-pill">Due in {daysTo13th}d</div>
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
            <div className="section-header-row"><h3 className="section-title">History</h3><span className="pill">{filteredEntries.length} Entries</span></div>
            
            <div className="filter-group" style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
              <div className="search-box" style={{flex:1, position:'relative'}}>
                <Search size={18} style={{position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'#94a3b8'}} />
                <input type="text" placeholder="Search..." className="search-input" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{paddingLeft:'40px', width:'100%'}} />
              </div>
              <div className="calendar-box" style={{position:'relative', display:'flex', alignItems:'center'}}>
                <input type="date" className="date-filter-input safari-fix" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
                {filterDate && (
                  <button onClick={() => setFilterDate("")} className="clear-btn-overlay">
                    <RotateCcw size={16} />
                  </button>
                )}
              </div>
            </div>

            <div className="entries-list">
              {filteredEntries.map(entry => (
                <div key={entry.id} className="card entry-card">
                  <p>{entry.content}</p>
                  <div className="entry-footer" style={{display:'flex', justifyContent:'space-between', marginTop:'10px'}}>
                    <span style={{fontSize:'0.7rem', color:'#64748b'}}>{formatEntryDate(entry.createdAt)}</span>
                    <button onClick={() => deleteEntry(entry.id)} style={{color:'#ef4444', background:'none', border:'none', fontSize:'0.7rem', fontWeight:'600'}}>Delete</button>
                  </div>
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
            </div>

            <div className="card strategy-card" style={{marginTop:'20px'}}>
              <div className="jail-grid" style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
                 <div style={{textAlign:'center'}}><span>Rent (11th)</span><p className="text-primary">₹{Math.ceil(RENT_AMOUNT/daysTo11th)}</p></div>
                 <div style={{textAlign:'center'}}><span>Debt (13th)</span><p className="text-danger">₹{Math.ceil(MONTHLY_REPAYMENT_TOTAL/daysTo13th)}</p></div>
              </div>
              <div style={{textAlign:'center'}}>
                <span className="pill-label">Survival Limit Today</span>
                <h1 style={{fontSize:'3rem', color:'#10b981'}}>₹{Math.floor(remainingSurvivalToday)}</h1>
              </div>
              <button className="log-action-btn" onClick={() => openModal('logSpend')} style={{width:'100%', marginTop:'20px'}}><Plus size={16} /> Log Spend</button>
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