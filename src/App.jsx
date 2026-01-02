import React, { useState, useEffect } from 'react';
import { addEntry, getEntries, deleteEntry } from './journalService';
import './App.css';

function App() {
  const [entries, setEntries] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchJournal();
  }, []);

  const fetchJournal = async () => {
    setLoading(true);
    try {
      const data = await getEntries();
      setEntries(data);
    } catch (error) {
      console.error("Error fetching entries:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!input.trim() || isSaving) return;
    setIsSaving(true);
    await addEntry(input);
    setInput("");
    await fetchJournal();
    setIsSaving(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this reflection?")) {
      await deleteEntry(id);
      fetchJournal();
    }
  };

  return (
    <div className="app-wrapper">
      <div className="container">
        <header className="app-header">
          <div className="logo-section">
            <h1>Journal<span>Me</span></h1>
            <p className="subtitle">Reflections for 2026</p>
          </div>
          <div className="status-badge">
            {entries.length} {entries.length === 1 ? 'Entry' : 'Entries'}
          </div>
        </header>

        <main className="content">
          {/* Entry Section */}
          <section className="input-area">
            <label>Practice moderation today. What's on your mind?</label>
            <textarea 
              placeholder="Write your thoughts here..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button 
              onClick={handleSave} 
              className="save-btn" 
              disabled={!input.trim() || isSaving}
            >
              {isSaving ? "Saving..." : "Save Reflection"}
            </button>
          </section>

          <hr className="divider" />

          {/* List Section */}
          <section className="history">
            <h3>Recent Reflections</h3>
            {loading && entries.length === 0 ? (
              <div className="loader">Gathering your thoughts...</div>
            ) : entries.length === 0 ? (
              <div className="empty-state">No entries yet. Start your journey today.</div>
            ) : (
              <div className="entry-grid">
                {entries.map(entry => (
                  <div key={entry.id} className="entry-card">
                    <p className="entry-content">{entry.content}</p>
                    <div className="entry-footer">
                      <span className="entry-date">
                        {entry.createdAt?.toDate ? entry.createdAt.toDate().toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        }) : 'Just now'}
                      </span>
                      <button onClick={() => handleDelete(entry.id)} className="delete-btn">
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;