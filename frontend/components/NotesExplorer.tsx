'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Global variables provided by the environment
// Note: In this environment, we'll use a placeholder URL and key for demonstration.
// In a real application, you would configure these with your actual Supabase credentials.
const supabaseUrl = 'https://your-project-id.supabase.co';
const supabaseKey = 'your-public-anon-key';
const supabase = createClient(supabaseUrl, supabaseKey);

// Define data interfaces for type safety
interface Folder {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
}

interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
}

// The custom hook that centralizes all data logic
// This is the hook you provided, adapted to a single file.
export const useSupabaseStore = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // State for Notes & Folders
  const [folders, setFolders] = useState<Folder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);

  // Set up auth listener on component mount to fetch user data
  useEffect(() => {
    // This part would be used to handle authentication in a full app.
    // Since we're in a self-contained environment, we'll assume a session.
    // In a production app, you would handle user sign-in here.
    const mockUser = { id: 'mock-user-123' };
    setSession({ user: mockUser });
    fetchData(mockUser.id);
  }, []);

  // Function to fetch all user-specific data from Supabase
  const fetchData = async (userId: string) => {
    setLoading(true);
    
    // Fetch all folders for the user
    const { data: folderData, error: folderError } = await supabase
      .from('folders')
      .select('*')
      .eq('user_id', userId);
    if (folderData) setFolders(folderData);
    if (folderError) console.error('Error fetching folders:', folderError);
      
    // Fetch all notes for the user
    const { data: noteData, error: noteError } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId);
    if (noteData) setNotes(noteData);
    if (noteError) console.error('Error fetching notes:', noteError);

    setLoading(false);
  };
  
  // --- Notes & Folders Functions ---
  const createFolder = async (name: string, parent_id: string | null) => {
    if (!session?.user) return;
    const { data, error } = await supabase
      .from('folders')
      .insert({ user_id: session.user.id, name, parent_id })
      .select();
    if (error) {
      console.error('Error creating folder:', error);
      return null;
    }
    if (data) {
      setFolders((prev) => [...prev, ...data]);
      return data[0];
    }
  };

  const createNote = async (title: string, folder_id: string | null) => {
    if (!session?.user) return;
    const { data, error } = await supabase
      .from('notes')
      .insert({ user_id: session.user.id, title, folder_id, content: '' })
      .select();
    if (error) {
      console.error('Error creating note:', error);
      return null;
    }
    if (data) {
      setNotes((prev) => [...prev, ...data]);
      return data[0];
    }
  };

  const updateNote = async (noteId: string, updates: Partial<Note>) => {
    const { data, error } = await supabase
      .from('notes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', noteId)
      .select();
    if (error) console.error('Error updating note:', error);
    if (data) setNotes((prev) => prev.map(n => n.id === noteId ? data[0] : n));
  };
  
  return {
    loading,
    folders,
    notes,
    createFolder,
    createNote,
    updateNote,
  };
};

// NotesEditor component (mock)
interface NotesEditorProps {
  note: Note | null;
  onSave: (content: string) => void;
}

const NotesEditor = ({ note, onSave }: NotesEditorProps) => {
  const [content, setContent] = useState(note?.content || '');

  useEffect(() => {
    setContent(note?.content || '');
  }, [note]);

  if (!note) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-100">
        <p className="text-gray-500 text-lg">Select a note to start editing.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 bg-white shadow-md">
      <div className="border-b border-gray-200 pb-2 mb-2">
        <h2 className="text-xl font-bold text-gray-800">{note.title}</h2>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={() => onSave(content)}
        className="flex-1 w-full p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 resize-none"
        placeholder="Start writing..."
      />
    </div>
  );
};


// NotesExplorer component, now using the Supabase hook
interface NotesExplorerProps {
  onSelectNote: (note: Note) => void;
  onSelectFolder: (folderId: string | null) => void;
  currentFolderId: string | null;
}

const NotesExplorer = ({ onSelectNote, onSelectFolder, currentFolderId }: NotesExplorerProps) => {
  const { folders, notes, createFolder, createNote, loading } = useSupabaseStore();
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [showNewNoteModal, setShowNewNoteModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newNoteTitle, setNewNoteTitle] = useState('');

  const currentFolders = folders.filter(folder => folder.parent_id === currentFolderId);
  const currentNotes = notes.filter(note => note.folder_id === currentFolderId);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    await createFolder(newFolderName, currentFolderId);
    setNewFolderName('');
    setShowNewFolderModal(false);
  };

  const handleCreateNote = async () => {
    if (!newNoteTitle.trim()) return;
    const newNote = await createNote(newNoteTitle, currentFolderId);
    if (newNote) {
      onSelectNote(newNote);
    }
    setNewNoteTitle('');
    setShowNewNoteModal(false);
  };

  if (loading) {
    return <div className="p-4 text-center text-gray-500">Loading notes and folders...</div>;
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 border-r border-gray-200">
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Notes Explorer</h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowNewFolderModal(true)}
              className="p-1 text-gray-500 hover:text-gray-700"
              title="New Folder"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-folder-plus"><path d="M19 20a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h4a2 2 0 0 1 2 2v13z"/><line x1="12" x2="12" y1="10" y2="16"/><line x1="9" x2="15" y1="13" y2="13"/></svg>
            </button>
            <button
              onClick={() => setShowNewNoteModal(true)}
              className="p-1 text-gray-500 hover:text-gray-700"
              title="New Note"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-file-plus"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="12" x2="12" y1="18" y2="12"/><line x1="9" x2="15" y1="15" y2="15"/></svg>
            </button>
          </div>
        </div>

        <div className="flex items-center text-sm text-gray-600">
          <button
            onClick={() => onSelectFolder(null)}
            className="hover:text-gray-900 transition-colors"
          >
            <span className="mr-1">📁</span> Root
          </button>
          {currentFolderId && (
            <span className="mx-1"> / {folders.find(f => f.id === currentFolderId)?.name || 'Current Folder'}</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {currentFolders.map(folder => (
          <div
            key={folder.id}
            onClick={() => onSelectFolder(folder.id)}
            className="flex items-center p-2 hover:bg-gray-100 rounded-lg cursor-pointer mb-1 transition-colors"
          >
            <span className="mr-2">📁</span>
            <span className="truncate">{folder.name}</span>
          </div>
        ))}

        {currentNotes.map(note => (
          <div
            key={note.id}
            onClick={() => onSelectNote(note)}
            className="flex items-center p-2 hover:bg-gray-100 rounded-lg cursor-pointer mb-1 transition-colors"
          >
            <span className="mr-2">📄</span>
            <div className="flex-1 min-w-0">
              <div className="truncate font-medium text-sm">{note.title}</div>
              <div className="text-xs text-gray-500">
                {new Date(note.updated_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        ))}

        {(currentFolders.length === 0 && currentNotes.length === 0) && (
          <p className="text-center text-gray-500 mt-4">This folder is empty. Create a new folder or note to get started.</p>
        )}
      </div>

      {showNewFolderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96 shadow-xl">
            <h3 className="font-semibold mb-4 text-lg">New Folder</h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="w-full px-4 py-2 border border-gray-300 rounded-md mb-4 focus:ring-blue-500 focus:border-blue-500"
              onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowNewFolderModal(false)}
                className="px-4 py-2 text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewNoteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96 shadow-xl">
            <h3 className="font-semibold mb-4 text-lg">New Note</h3>
            <input
              type="text"
              value={newNoteTitle}
              onChange={(e) => setNewNoteTitle(e.target.value)}
              placeholder="Note title"
              className="w-full px-4 py-2 border border-gray-300 rounded-md mb-4 focus:ring-blue-500 focus:border-blue-500"
              onKeyPress={(e) => e.key === 'Enter' && handleCreateNote()}
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowNewNoteModal(false)}
                className="px-4 py-2 text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNote}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Main App component
export default function App() {
  const { notes, folders, loading, updateNote } = useSupabaseStore();
  
  // State for the main application
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  
  // Handle note selection and folder navigation
  const handleSelectNote = (note: Note) => {
    setCurrentNote(note);
  };

  const handleSelectFolder = (folderId: string | null) => {
    setCurrentFolderId(folderId);
    setCurrentNote(null); // Deselect note when changing folders
  };

  const handleSaveNote = async (content: string) => {
    if (currentNote) {
      await updateNote(currentNote.id, { content: content, updated_at: new Date().toISOString() });
      // The updateNote hook also updates the local state, so we don't need to manually update it here.
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen bg-gray-100">Loading...</div>;
  }

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      {/* Notes Explorer Pane */}
      <div className="w-1/4 h-full">
        <NotesExplorer
          onSelectNote={handleSelectNote}
          onSelectFolder={handleSelectFolder}
          currentFolderId={currentFolderId}
        />
      </div>

      {/* Notes Editor Pane */}
      <div className="w-3/4 h-full">
        <NotesEditor
          note={currentNote}
          onSave={handleSaveNote}
        />
      </div>
    </div>
  );
}
