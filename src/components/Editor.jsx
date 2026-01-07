// src/components/Editor.jsx
import React, { useState } from 'react';
import { useJournal } from '../contexts/JournalContext';

const Editor = () => {
  const [text, setText] = useState('');
  const { addEntry } = useJournal();

  const handleSave = async () => {
    if(!text) return;
    
    // Saves instantly to browser DB. No network request.
    await addEntry(text, 'freestyle', ['dev', 'stoic']);
    setText('');
    alert("Saved to device!"); 
  };

  return (
    <div className="p-4">
      <textarea 
        className="w-full h-32 p-2 border rounded"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What is blocking you today?"
      />
      <button 
        onClick={handleSave}
        className="mt-2 bg-black text-white px-4 py-2 rounded"
      >
        Save Locally
      </button>
    </div>
  );
};