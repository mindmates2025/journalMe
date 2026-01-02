import React, { useState, useEffect } from 'react';
import { addEntry, getEntries, deleteEntry } from './journalService';
import './App.css';

function App() {
  const [entries, setEntries] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJournal();
  }, []);

  const fetchJournal = async () => {
    setLoading(true);
    const data = await getEntries();
    setEntries(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!input.trim()) return;
    await addEntry(input);
    setInput("");
    fetchJournal();
  };

  return (
    <div className="container">
      <header>
        <h1>JournalMe</h1>
        <p>Reflections for 2026</p>
      </header>

      <main>
        {/* Entry Section */}
        <section className="input-area">
          <textarea 
            placeholder="Practice moderation today. What's on your mind?"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button onClick={handleSave} className="save-btn">Save Reflection</button>
        </section>

        {/* List Section */}
        <section className="history">
          {loading ? <p>Loading entries...</p> : entries.map(entry => (
            <div key={entry.id} className="entry-card">
              <p>{entry.content}</p>
              <div className="entry-footer">
                <span>{entry.createdAt?.toDate().toLocaleDateString()}</span>
                <button onClick={() => {deleteEntry(entry.id); fetchJournal();}} className="delete-link">Delete</button>
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}

export default App;