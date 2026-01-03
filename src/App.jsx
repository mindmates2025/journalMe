import React, { useState, useEffect } from 'react';
import { addEntry, getEntries, deleteEntry } from './journalService';
import { 
  PenLine, 
  BookOpen, 
  CheckCircle2, 
  Wallet, 
  Plus, 
  Trash2, 
  TrendingDown 
} from 'lucide-react';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('journal');
  const [entries, setEntries] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);

  // Financial State (Mock data - you can connect this to a service later)
  const [balance, setBalance] = useState(40000);
  const [debts, setDebts] = useState([
    { id: 1, name: 'Credit Card 1', amount: 59000 },
    { id: 2, name: 'Credit Card 2', amount: 14000 },
    { id: 3, name: 'Loan', amount: 38000 },
  ]);

  useEffect(() => {
    fetchJournal();
  }, []);

  const fetchJournal = async () => {
    setLoading(true);
    const data = await getEntries();
    setEntries(data);
    setLoading(false);
  };

  const handleSaveEntry = async () => {
    if (!input.trim()) return;
    await addEntry(input);
    setInput("");
    setActiveTab('history'); // Switch to history to see the new entry
    fetchJournal();
  };

  return (
    <div className="app-container">
      {/* Dynamic Header */}
      <header className="main-header">
        <h1>Journal<span>Me</span></h1>
        <div className="date-pill">{new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</div>
      </header>

      <main className="view-content">
        {/* SCREEN 1: JOURNAL INPUT */}
        {activeTab === 'journal' && (
          <section className="screen fade-in">
            <div className="card input-card">
              <label>What's on your mind?</label>
              <textarea 
                placeholder="Practice moderation today..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <button onClick={handleSaveEntry} className="primary-btn">
                <PenLine size={18} /> Save Reflection
              </button>
            </div>
            <div className="quote-card">
              <p>"Moderation is the silken string running through the pearl-chain of all virtues."</p>
            </div>
          </section>
        )}

        {/* SCREEN 2: ALL ENTRIES */}
        {activeTab === 'history' && (
          <section className="screen fade-in">
            <h3>Recent Reflections</h3>
            <div className="entry-list">
              {loading ? <p>Loading...</p> : entries.map(entry => (
                <div key={entry.id} className="entry-card">
                  <p>{entry.content}</p>
                  <div className="entry-meta">
                    <span>{entry.createdAt?.toDate().toLocaleDateString()}</span>
                    <button onClick={() => {deleteEntry(entry.id); fetchJournal();}} className="icon-btn delete">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SCREEN 3: TODO LIST */}
        {activeTab === 'todo' && (
          <section className="screen fade-in">
            <h3>Daily Focus</h3>
            <div className="todo-input-group">
              <input type="text" placeholder="Add a new task..." />
              <button className="add-btn"><Plus size={20} /></button>
            </div>
            <div className="todo-list">
              <div className="todo-item">
                <input type="checkbox" />
                <span>Practice 30 mins of coding</span>
              </div>
              <div className="todo-item">
                <input type="checkbox" />
                <span>No unnecessary spending today</span>
              </div>
            </div>
          </section>
        )}

        {/* SCREEN 4: PERSONAL BANK */}
        {activeTab === 'bank' && (
          <section className="screen fade-in">
            <div className="bank-hero">
              <span className="label">Total Balance</span>
              <h2 className="balance-amt">₹{balance.toLocaleString()}</h2>
            </div>
            
            <div className="debt-section">
              <div className="section-header">
                <h3>Debt Tracker</h3>
                <TrendingDown size={18} className="text-red" />
              </div>
              {debts.map(debt => (
                <div key={debt.id} className="debt-card">
                  <div className="debt-info">
                    <span className="debt-name">{debt.name}</span>
                    <span className="debt-amt">₹{debt.amount.toLocaleString()}</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{width: '60%'}}></div>
                  </div>
                </div>
              ))}
            </div>

            <button className="primary-btn outline mt-4">Add Transaction</button>
          </section>
        )}
      </main>

      {/* BOTTOM NAVIGATION */}
      <nav className="bottom-nav">
        <button 
          className={activeTab === 'journal' ? 'active' : ''} 
          onClick={() => setActiveTab('journal')}
        >
          <PenLine size={24} />
          <span>Write</span>
        </button>
        <button 
          className={activeTab === 'history' ? 'active' : ''} 
          onClick={() => setActiveTab('history')}
        >
          <BookOpen size={24} />
          <span>Entries</span>
        </button>
        <button 
          className={activeTab === 'todo' ? 'active' : ''} 
          onClick={() => setActiveTab('todo')}
        >
          <CheckCircle2 size={24} />
          <span>Tasks</span>
        </button>
        <button 
          className={activeTab === 'bank' ? 'active' : ''} 
          onClick={() => setActiveTab('bank')}
        >
          <Wallet size={24} />
          <span>Bank</span>
        </button>
      </nav>
    </div>
  );
}

export default App;