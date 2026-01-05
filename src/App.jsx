import React, { useState, useEffect } from 'react';
import { 
  addEntry, deleteEntry, subscribeToEntries, subscribeToTasks,
  subscribeToBalance, subscribeToDebts, updateBalance, updateDebtPayment, addDebt, deleteDebt,
  subscribeToStrategy, updateStrategy 
} from './journalService';
import { PenLine, BookOpen, CheckCircle2, Wallet, Trash2, Plus, Search, CheckCheck, CloudOff, Target, Calendar, X, TrendingUp, ReceiptText } from 'lucide-react';
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

function App() {
  const [activeTab, setActiveTab] = useState('bank');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState({ total: 0 });
  const [debts, setDebts] = useState([]);
  
  // Strategy state now includes 'dailySpendsList' for granular tracking
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
  const [modalInput, setModalInput] = useState({ val1: '', val2: '' });

  useEffect(() => {
    setLoading(true);
    const unsubEntries = subscribeToEntries((data) => { setEntries(data); setLoading(false); });
    const unsubBalance = subscribeToBalance((data) => setBalance(data));
    const unsubDebts = subscribeToDebts((data) => setDebts(data));
    const unsubStrategy = subscribeToStrategy((data) => setStrategy(data));

    return () => {
      unsubEntries();
      unsubBalance();
      unsubDebts();
      unsubStrategy();
    };
  }, []);

  // --- MATH ENGINE ---
  const totalDebtAmount = debts.reduce((acc, d) => acc + (d.total - (d.paid || 0)), 0);
  const totalUpcomingBills = (strategy?.upcomingPayments || []).reduce((acc, bill) => acc + bill.amount, 0);
  const totalExpectedIncome = (strategy?.expectedIncome || []).reduce((acc, inc) => acc + inc.amount, 0);
  
  const targetDate = new Date("2026-03-31"); 
  const daysRemaining = Math.max(1, Math.ceil((targetDate - new Date()) / (1000 * 60 * 60 * 24)));
  
  const netPosition = balance.total - totalDebtAmount;
  const dailyRepaymentTarget = totalDebtAmount > 0 ? (totalDebtAmount / daysRemaining) : 0;
  
  const dailySurvivalBudget = Math.max(0, (balance.total + totalExpectedIncome - totalUpcomingBills) / daysRemaining);
  // Using persisted total 'dailySpent' or calculating it from the list
  const remainingSurvivalToday = Math.max(0, dailySurvivalBudget - (strategy?.dailySpent || 0));
  const progressToDebtFree = totalDebtAmount === 0 ? 100 : Math.min(100, (balance.total / totalDebtAmount) * 100);

  const openModal = (type, data = null) => {
    setModalConfig({ show: true, type, data });
    setModalInput({ val1: '', val2: '' });
  };

  const handleModalSubmit = async () => {
    const { type, data } = modalConfig;
    const { val1, val2 } = modalInput;

    if (type === 'balance' && val1) await updateBalance(Number(val1));
    if (type === 'payment' && val1) await updateDebtPayment(data.id, (data.paid || 0) + Number(val1));
    if (type === 'newDebt' && val1 && val2) await addDebt({ label: val1, total: Number(val2), paid: 0 });
    
    // STRATEGY UPDATES
    if (type === 'logSpend' && val1 && val2) {
      const newSpendItem = { label: val1, amount: Number(val2), id: Date.now() };
      await updateStrategy({ 
        dailySpent: (strategy.dailySpent || 0) + Number(val2),
        dailySpendsList: [...(strategy.dailySpendsList || []), newSpendItem]
      });
    }
    if (type === 'addBill' && val1 && val2) {
      await updateStrategy({ upcomingPayments: [...(strategy.upcomingPayments || []), { label: val1, amount: Number(val2) }] });
    }
    if (type === 'addIncome' && val1 && val2) {
      await updateStrategy({ expectedIncome: [...(strategy.expectedIncome || []), { label: val1, amount: Number(val2) }] });
    }
    
    setModalConfig({ show: false, type: '', data: null });
  };

  const handleDeleteSpendItem = async (itemId, amount) => {
    const newList = strategy.dailySpendsList.filter(item => item.id !== itemId);
    await updateStrategy({ 
      dailySpent: strategy.dailySpent - amount,
      dailySpendsList: newList
    });
  };

  const handleSaveEntry = async () => {
    if (!input.trim()) return;
    await addEntry(input);
    setInput("");
    setActiveTab('history');
  };

  const filteredEntries = entries.filter(entry => {
    const matchesSearch = entry.content.toLowerCase().includes(searchTerm.toLowerCase());
    let matchesDate = true;
    if (filterDate && entry.createdAt?.toDate) {
      const entryDate = entry.createdAt.toDate().toISOString().split('T')[0];
      matchesDate = entryDate === filterDate;
    }
    return matchesSearch && matchesDate;
  });

  return (
    <div className="app-container">
      {modalConfig.show && (
        <div className="modal-overlay">
          <div className="modal-content fade-in">
            <div className="modal-header">
              <h3>{modalConfig.type === 'logSpend' ? 'Log New Expenditure' : modalConfig.type}</h3>
              <button onClick={() => setModalConfig({show:false})} className="close-btn"><X size={20} /></button>
            </div>
            <div className="modal-body">
              <input 
                type={['newDebt', 'addBill', 'addIncome', 'logSpend'].includes(modalConfig.type) ? 'text' : 'number'}
                placeholder={modalConfig.type === 'logSpend' ? "What did you buy?" : "Label / Name"}
                value={modalInput.val1}
                onChange={(e) => setModalInput({...modalInput, val1: e.target.value})}
              />
              {['newDebt', 'addBill', 'addIncome', 'logSpend'].includes(modalConfig.type) && (
                <input 
                  type="number"
                  placeholder="Amount (₹)"
                  value={modalInput.val2}
                  onChange={(e) => setModalInput({...modalInput, val2: e.target.value})}
                  style={{marginTop: '12px'}}
                />
              )}
            </div>
            <button className="primary-btn" onClick={handleModalSubmit} style={{marginTop: '20px'}}>Confirm</button>
          </div>
        </div>
      )}

      <header className="main-header">
        <h1>Journal<span>Me</span></h1>
        <div className="date-pill">{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
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
            <div className="section-header-row"><h3 className="section-title">Recent Reflections</h3><span className="pill">{filteredEntries.length} Entries</span></div>
            <div className="filter-group" style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
              <div className="search-box" style={{flex:2, position:'relative'}}>
                <Search size={18} style={{position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'#94a3b8'}} />
                <input type="text" placeholder="Search thoughts..." className="search-input" style={{paddingLeft:'40px'}} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <div className="calendar-box" style={{flex:1}}><input type="date" className="date-filter-input" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} /></div>
            </div>
            <div className="entries-list">
              {loading ? <p className="status-msg">Gathering thoughts...</p> : filteredEntries.map(entry => (
                <div key={entry.id} className="card entry-card">
                  <p className="entry-content">{entry.content}</p>
                  <div className="entry-footer" style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'12px'}}>
                    <span className="entry-date" style={{fontSize:'0.85rem', color:'#64748b'}}>{formatEntryDate(entry.createdAt)}</span>
                    <button onClick={() => deleteEntry(entry.id)} className="delete-text-btn" style={{color:'#ef4444', background:'none', border:'none', fontWeight:'600'}}>Delete</button>
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
                <h2 className="hero-amount">{netPosition >= 0 ? `+₹${netPosition.toLocaleString('en-IN')}` : `-₹${Math.abs(netPosition).toLocaleString('en-IN')}`}</h2>
                <p className="hero-subtitle">Balance: ₹{balance.total.toLocaleString('en-IN')}</p>
              </div>
              <div className="hero-accent-circle"></div>
            </div>

            <h3 className="section-title">Daily Strategy</h3>
            <div className="card strategy-card">
              <div className="strategy-grid">
                <div className="strategy-item">
                  <span className="strat-label">Repayment/Day</span>
                  <p className="strat-value text-danger">₹{Math.ceil(dailyRepaymentTarget).toLocaleString('en-IN')}</p>
                </div>
                <div className="strategy-divider"></div>
                <div className="strategy-item">
                  <span className="strat-label">Survival Limit</span>
                  <p className="strat-value text-success">₹{Math.floor(remainingSurvivalToday).toLocaleString('en-IN')}</p>
                </div>
              </div>

              {/* INCOME PIPELINE */}
              <div className="income-pipeline-section">
                <div className="pipeline-header"><span className="pill-label">Income Pipeline</span><strong className="text-success">+₹{totalExpectedIncome.toLocaleString('en-IN')}</strong></div>
                <div className="pipeline-list">
                  {(strategy?.expectedIncome || []).map((inc, i) => (
                    <div key={i} className="pipeline-item"><span>{inc.label}</span><strong>₹{inc.amount.toLocaleString('en-IN')}</strong></div>
                  ))}
                </div>
                <button className="log-action-btn income-btn" onClick={() => openModal('addIncome')}><TrendingUp size={14} /> Expected Payment</button>
              </div>

              {/* GRANULAR DAILY SPENDS LIST */}
              <div className="spend-sub-section">
                <div className="spend-meta">
                  <div className="spend-pill">
                    <span className="pill-label">Survival Floor</span>
                    <strong>₹{Math.floor(dailySurvivalBudget).toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="spend-pill spent">
                    <span className="pill-label">Spent Today</span>
                    <strong>₹{(strategy?.dailySpent || 0).toLocaleString('en-IN')}</strong>
                  </div>
                </div>

                <div className="daily-items-list">
                  {(strategy?.dailySpendsList || []).length === 0 ? (
                    <p className="empty-msg">No spends logged today.</p>
                  ) : (
                    strategy.dailySpendsList.map((item) => (
                      <div key={item.id} className="spend-item-row">
                        <div className="item-info">
                           <ReceiptText size={14} />
                           <span>{item.label}</span>
                        </div>
                        <div className="item-actions">
                          <strong>₹{item.amount}</strong>
                          <button onClick={() => handleDeleteSpendItem(item.id, item.amount)} className="item-del-btn"><X size={12}/></button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <button className="log-action-btn" onClick={() => openModal('logSpend')}>
                   <Plus size={14} /> Log Spend
                </button>
              </div>

              <div className="action-buttons-row">
                <button className="mini-action-btn alt" onClick={() => openModal('addBill')}><Calendar size={14} /> Add Bill</button>
                <button className="mini-action-btn" onClick={() => updateStrategy({ dailySpent: 0, dailySpendsList: [] })}>Reset Day</button>
              </div>
            </div>

            <div className="section-header-row" style={{marginTop:'24px', display:'flex', justifyContent:'space-between'}}>
                <h3>Active Debts</h3>
                <button onClick={() => openModal('newDebt')} className="add-debt-btn"><Plus size={16}/> Add</button>
            </div>
            <div className="debt-stack">
              {debts.map(debt => (
                <div key={debt.id} className="card debt-item-card" onClick={() => openModal('payment', debt)}>
                  <div className="debt-header"><span>{debt.label}</span><span className="debt-remaining-tag">₹{(debt.total - (debt.paid || 0)).toLocaleString('en-IN')} left</span></div>
                  <div className="progress-container"><div className="progress-bar-fill" style={{ width: `${Math.min(((debt.paid || 0) / debt.total) * 100, 100)}%` }}></div></div>
                  <div className="debt-stats"><span>Paid: ₹{(debt.paid || 0).toLocaleString('en-IN')}</span><span>Goal: ₹{debt.total.toLocaleString('en-IN')}</span></div>
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
  <button className={`nav-btn ${active ? 'active' : ''}`} onClick={onClick}>
    {React.cloneElement(icon, { size: 24 })}
    <span>{label}</span>
  </button>
);

export default App;