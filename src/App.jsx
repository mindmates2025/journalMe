import React, { useState, useEffect } from 'react';
import { 
  addEntry, getEntries, deleteEntry, 
  addTask, getTasks 
} from './journalService';
import { PenLine, BookOpen, CheckCircle2, Wallet, Trash2, Plus, Search } from 'lucide-react';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('history');
  const [entries, setEntries] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [input, setInput] = useState("");
  const [taskInput, setTaskInput] = useState("");
  const [loading, setLoading] = useState(true);

  // States for filtering
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState("");

  useEffect(() => {
    refreshAllData();
  }, []);

  const refreshAllData = async () => {
    setLoading(true);
    const [entryData, taskData] = await Promise.all([getEntries(), getTasks()]);
    setEntries(entryData);
    setTasks(taskData);
    setLoading(false);
  };

  // Logic to filter entries based on Search and Calendar
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
    await addEntry(input);
    setInput("");
    refreshAllData();
  };

  const handleAddTask = async () => {
    if (!taskInput.trim()) return;
    await addTask(taskInput);
    setTaskInput("");
    refreshAllData();
  };

  const handleDeleteEntry = async (id) => {
    if (window.confirm("Delete this reflection?")) {
      await deleteEntry(id);
      refreshAllData();
    }
  };

  return (
    <div className="app-container">
      <header className="main-header">
        <h1>Journal<span>Me</span></h1>
        <div className="date-pill">{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
      </header>

      <main>
        {/* SCREEN 1: WRITE */}
        {activeTab === 'journal' && (
          <section className="screen fade-in">
            <div className="card">
              <label className="input-label">Practice moderation today...</label>
              <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="What's on your mind?" />
              <button onClick={handleSaveEntry} className="primary-btn"><PenLine size={20} /> Save Reflection</button>
            </div>
            <div className="quote-card">
              <p>"Moderation is the silken string running through the pearl-chain of all virtues."</p>
            </div>
          </section>
        )}

        {/* SCREEN 2: ENTRIES */}
        {activeTab === 'history' && (
          <section className="screen fade-in">
            <div className="section-header-row">
              <h3 className="section-title">Recent Reflections</h3>
              <span className="pill">{filteredEntries.length} Entries</span>
            </div>

            <div className="filter-group">
              <div className="search-box">
                <Search size={18} className="search-icon" />
                <input 
                  type="text" 
                  placeholder="Search thoughts..." 
                  className="search-input"
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
                {filterDate && (
                  <button className="clear-filter-btn" onClick={() => setFilterDate("")}>✕</button>
                )}
              </div>
            </div>

            <div className="entries-list">
              {loading ? (
                <p className="status-msg">Gathering your thoughts...</p>
              ) : filteredEntries.length === 0 ? (
                <div className="empty-state">
                  <p>No reflections found.</p>
                  {(searchTerm || filterDate) && (
                    <button className="text-btn" onClick={() => {setSearchTerm(""); setFilterDate("");}}>
                      Clear all filters
                    </button>
                  )}
                </div>
              ) : (
                filteredEntries.map(entry => (
                  <div key={entry.id} className="card entry-card">
                    <p className="entry-content">{entry.content}</p>
                    <div className="card-divider"></div>
                    <div className="entry-footer">
                      <span className="entry-date">
                        {entry.createdAt?.toDate ? 
                          entry.createdAt.toDate().toLocaleDateString('en-IN', { 
                            day: 'numeric', month: 'short', year: 'numeric' 
                          }) : '3 Jan 2026'}
                      </span>
                      <button 
                        onClick={() => handleDeleteEntry(entry.id)} 
                        className="delete-text-btn"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* SCREEN 3: TASKS */}
        {activeTab === 'todo' && (
          <section className="screen fade-in">
            <h3 className="section-title">Daily Focus</h3>
            <div className="card task-input-card">
              <input 
                value={taskInput} 
                onChange={(e) => setTaskInput(e.target.value)} 
                placeholder="Add a new task..." 
                className="task-input"
              />
              <button onClick={handleAddTask} className="add-task-btn"><Plus size={24} /></button>
            </div>
            <div className="task-list">
              {tasks.map(task => (
                <div key={task.id} className="task-item">
                  <input type="checkbox" checked={task.completed} readOnly />
                  <span>{task.text}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SCREEN 4: BANK */}
        {activeTab === 'bank' && (
          <section className="screen fade-in">
            <div className="card bank-hero">
              <p>Total Balance</p>
              <h2>₹40,000</h2>
            </div>
            <h3 className="section-title">Debt Tracker</h3>
            <div className="debt-stack">
               <DebtItem label="Credit Card 1" amount="59,000" progress={75} />
               <DebtItem label="Credit Card 2" amount="14,000" progress={40} />
               <DebtItem label="Loan" amount="38,000" progress={60} />
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

const DebtItem = ({ label, amount, progress }) => (
  <div className="card debt-card">
    <div className="debt-info">
      <span>{label}</span>
      <strong>₹{amount}</strong>
    </div>
    <div className="progress-bar-bg">
      <div className="progress-fill" style={{ width: `${progress}%` }}></div>
    </div>
  </div>
);

export default App;