import React, { useState, useEffect } from 'react';
import { 
  addEntry, deleteEntry, subscribeToEntries, subscribeToTasks,
  subscribeToBalance, subscribeToDebts, updateBalance, updateDebtPayment, addDebt, deleteDebt
} from './journalService';
import { PenLine, BookOpen, CheckCircle2, Wallet, Trash2, Plus, Search, CheckCheck, CloudOff } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState('history');
  const [entries, setEntries] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [balance, setBalance] = useState({ total: 0 });
  const [debts, setDebts] = useState([]);

  const [input, setInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState("");

  useEffect(() => {
    setLoading(true);
    const unsubEntries = subscribeToEntries((data) => {
      setEntries(data);
      setLoading(false); 
    });
    const unsubTasks = subscribeToTasks((data) => setTasks(data));
    const unsubBalance = subscribeToBalance((data) => setBalance(data));
    const unsubDebts = subscribeToDebts((data) => setDebts(data));

    return () => {
      unsubEntries();
      unsubTasks();
      unsubBalance();
      unsubDebts();
    };
  }, []);

  const handleEditBalance = async () => {
    const newAmt = prompt("Enter new current balance:", balance.total);
    if (newAmt !== null && !isNaN(newAmt)) {
      await updateBalance(Number(newAmt));
    }
  };

  const handleLogPayment = async (debt) => {
    const pay = prompt(`Payment for ${debt.label}:`, "0");
    if (pay !== null && !isNaN(pay)) {
      const newPaid = (debt.paid || 0) + Number(pay);
      await updateDebtPayment(debt.id, newPaid);
    }
  };

  const handleAddNewDebt = async () => {
    const label = prompt("Debt Name:");
    const total = prompt("Total Amount Owed:");
    if (label && total) {
      await addDebt({
        label,
        total: Number(total),
        paid: 0
      });
    }
  };

  const handleDeleteDebt = async (e, id) => {
    e.stopPropagation(); 
    if (window.confirm("Remove this debt tracker?")) {
      await deleteDebt(id);
    }
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

  const handleSaveEntry = async () => {
    if (!input.trim()) return;
    try {
      await addEntry(input); // Passes the local 'input' state to Firestore
      setInput("");
      setActiveTab('history'); 
    } catch (error) {
      console.error("Failed to add entry:", error);
    }
  };

  const handleDeleteEntry = async (id) => {
    if (window.confirm("Delete this reflection?")) {
      await deleteEntry(id);
    }
  };

  return (
    <div className="app-container">
      <header className="main-header">
        <h1>Journal<span>Me</span></h1>
        <div className="date-pill">
          {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
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
              />
              <button onClick={handleSaveEntry} className="primary-btn">
                <PenLine size={20} /> Save Reflection
              </button>
            </div>
          </section>
        )}

        {activeTab === 'history' && (
          <section className="screen fade-in">
            <div className="section-header-row">
              <h3 className="section-title">Recent Reflections</h3>
              <span className="pill">{filteredEntries.length} Entries</span>
            </div>
            <div className="filter-group">
              <div className="search-box">
                <Search size={18} className="search-icon" style={{position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8'}} />
                <input 
                  type="text" 
                  placeholder="Search thoughts..." 
                  className="search-input"
                  style={{paddingLeft: '40px'}}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="calendar-box">
                <input 
                  type="date" 
                  className="date-filter-input"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                />
              </div>
            </div>
            <div className="entries-list">
              {loading ? (
                <p className="status-msg">Gathering your thoughts...</p>
              ) : (
                filteredEntries.map(entry => (
                  <div key={entry.id} className="card entry-card">
                    <p className="entry-content" style={{lineHeight: '1.6', marginBottom: '16px'}}>{entry.content}</p>
                    <div className="card-divider" style={{height: '1px', background: '#f1f5f9', marginBottom: '12px'}}></div>
                    <div className="entry-footer" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <div className="entry-meta-group" style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                        <span className="entry-date" style={{fontSize: '0.85rem', color: '#64748b', fontWeight: '600'}}>{formatEntryDate(entry.createdAt)}</span>
                        <div className="sync-indicator">
                          {entry.metadata?.hasPendingWrites ? (
                            <div className="sync-tag pending" style={{fontSize: '0.7rem', color: '#94a3b8'}}><CloudOff size={14} /> Saving</div>
                          ) : (
                            <div className="sync-tag synced" style={{fontSize: '0.7rem', color: '#10b981'}}><CheckCheck size={14} /> Synced</div>
                          )}
                        </div>
                      </div>
                      <button onClick={() => handleDeleteEntry(entry.id)} className="delete-text-btn" style={{background: 'none', border: 'none', color: '#ef4444', fontWeight: '600'}}>Delete</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {activeTab === 'bank' && (
          <section className="screen fade-in">
            <div className="bank-hero-card" onClick={handleEditBalance}>
              <div className="hero-content">
                <p className="hero-label">Available Balance</p>
                <h2 className="hero-amount">₹{balance.total.toLocaleString('en-IN')}</h2>
              </div>
              <div className="hero-accent-circle"></div>
            </div>

            <div className="section-header-row" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
              <h3 className="section-title">Debt Progress</h3>
              <button className="add-debt-btn" onClick={handleAddNewDebt}>
                <Plus size={18} /> Add
              </button>
            </div>

            <div className="debt-stack">
              {debts.length === 0 ? (
                <div className="card empty-finance">
                  <p>No debts currently tracked.</p>
                </div>
              ) : (
                debts.map(debt => (
                  <div key={debt.id} className="card debt-item-card" onClick={() => handleLogPayment(debt)}>
                    <div className="debt-header">
                      <span className="debt-name">{debt.label}</span>
                      <span className="debt-remaining-tag">₹{(debt.total - debt.paid).toLocaleString('en-IN')} left</span>
                    </div>
                    <div className="progress-container">
                      <div className="progress-bar-fill" style={{ width: `${Math.min((debt.paid / debt.total) * 100, 100)}%` }}></div>
                    </div>
                    <div className="debt-stats">
                      <span>Paid: ₹{debt.paid.toLocaleString('en-IN')}</span>
                      <span>Goal: ₹{debt.total.toLocaleString('en-IN')}</span>
                    </div>
                    <button className="debt-delete-icon" onClick={(e) => { e.stopPropagation(); handleDeleteDebt(e, debt.id); }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
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