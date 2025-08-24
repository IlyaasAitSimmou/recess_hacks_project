import React, { useState } from 'react';
import { notesStore, type Note } from '@/lib/notesStore';

interface FileSelectorProps {
  onSelect: (note: Note | null) => void;
}

const FileSelector: React.FC<FileSelectorProps> = ({ onSelect }) => {
  const [selectedNoteId, setSelectedNoteId] = useState<number | 'new' | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const notes = notesStore.getAllNotes();

  const handleSelectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'new') {
      setSelectedNoteId('new');
      onSelect(null);
    } else {
      const note = notes.find((n) => n.id === parseInt(value, 10));
      setSelectedNoteId(note?.id || null);
      onSelect(note || null);
    }
  };

  const handleCreateNewFile = () => {
    if (newFileName.trim()) {
      const newNote = notesStore.createNote(newFileName, '', null);
      setSelectedNoteId(newNote.id);
      onSelect(newNote);
    }
  };

  return (
    <div className="file-selector">
      <label htmlFor="file-select" className="block text-sm font-medium text-gray-700">
        Select a file to edit:
      </label>
      <select
        id="file-select"
        value={selectedNoteId || ''}
        onChange={handleSelectionChange}
        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
      >
        <option value="" disabled>Select a file</option>
        {notes.map((note) => (
          <option key={note.id} value={note.id}>
            {note.title}
          </option>
        ))}
        <option value="new">Create New File</option>
      </select>

      {selectedNoteId === 'new' && (
        <div className="mt-4">
          <label htmlFor="new-file-name" className="block text-sm font-medium text-gray-700">
            New File Name:
          </label>
          <input
            id="new-file-name"
            type="text"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          />
          <button
            onClick={handleCreateNewFile}
            className="mt-2 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Create File
          </button>
        </div>
      )}
    </div>
  );
};

export default FileSelector;
