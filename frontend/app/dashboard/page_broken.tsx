'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SimpleNotesExplorer from '../../components/SimpleNotesExplorer';
import RichTextEditor from '../../components/RichTextEditor';
import AIChatbot from '../../components/AIChatbot';
import FinancePage from '../../components/FinancePage';
import GroceryPage from '../dashboard/grocery/page';
import VolunteerTrackerPage from '../../components/VolunteerTrackerPage';

interface Note {
  id: number;
  title: string;
  content: string;
  folder_id: number | null;
  created_at: string;
  updated_at: string;
}

interface Folder {
  id: number;
  name: string;
  parent_id: number | null;
  created_at: string;
}

// For compatibility with NotesExplorer that expects string IDs
interface NotesExplorerNote {
  id: string;
  title: string;
  content: string;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
}

export default function Dashboard() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('education');
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Add states for all notes and folders
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [allFolders, setAllFolders] = useState<Folder[]>([]);
  
  const router = useRouter();

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    const userEmail = localStorage.getItem('email');
    
    if (!token) {
      router.push('/');
      return;
    }

    setEmail(userEmail || '');
    setLoading(false);
    
    // Fetch all notes and folders for AI context
    fetchAllData();
  }, [router]);

  const fetchAllData = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      // Fetch notes
      const notesResponse = await fetch('http://localhost:5001/api/notes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      // Fetch folders
      const foldersResponse = await fetch('http://localhost:5001/api/folders', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (notesResponse.ok && foldersResponse.ok) {
        const notesData = await notesResponse.json();
        const foldersData = await foldersResponse.json();
        
        setAllNotes(notesData.notes || []);
        setAllFolders(foldersData.folders || []);
      }
    } catch (error) {
      console.error('Error fetching all data:', error);
    }
  };
      return;
    }

    setEmail(userEmail || '');
    setLoading(false);
  }, [router]);

  const handleSelectNote = (note: Note) => {
    setCurrentNote(note);
  };

  const handleSelectFolder = (folderId: number | null) => {
    setCurrentFolderId(folderId);
    setCurrentNote(null);
  };

  const handleSaveNote = (content: string) => {
    if (currentNote) {
      setCurrentNote({
        ...currentNote,
        content: content,
        updated_at: new Date().toISOString()
      });
    }
  };

  // Add refresh function for AI-created notes
  const handleNotesRefresh = () => {
    // This will trigger a re-render of NotesExplorer which will fetch fresh data
    setCurrentNote(null);
    // Force a refresh by changing the key or triggering a state update
    // The NotesExplorer useEffect will automatically refetch when currentFolderId changes or on mount
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('token');
      
      await fetch('http://localhost:5001/api/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      localStorage.removeItem('token');
      localStorage.removeItem('email');
      
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
      localStorage.removeItem('token');
      localStorage.removeItem('email');
      router.push('/login');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-white shadow flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="mr-4 p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Welcome, {email}</span>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Tab Navigation - Collapsible */}
        {!isSidebarCollapsed && (
          <div className="border-b border-gray-200 bg-white px-6 py-3 flex-shrink-0">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('education')}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'education'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📚 Education
              </button>
              <button
                onClick={() => setActiveTab('finance')}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'finance'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                💰 Finance
              </button>
              <button
                onClick={() => setActiveTab('grocery')}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'grocery'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                🛒 Grocery
              </button>
              <button
                onClick={() => setActiveTab('volunteer')}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'volunteer'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                🤝 Volunteer
              </button>
            </nav>
          </div>
        )}

        {/* Tab Content - Full width and height */}
        {activeTab === 'education' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Notes Explorer Sidebar - Collapsible */}
            <div className={`${isSidebarCollapsed ? 'w-0' : 'w-80'} flex-shrink-0 bg-gray-50 border-r border-gray-200 overflow-hidden transition-all duration-300 ease-in-out`}>
              <div className={`w-80 h-full overflow-y-auto ${isSidebarCollapsed ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}>
                <SimpleNotesExplorer
                  onSelectNote={handleSelectNote}
                  onSelectFolder={handleSelectFolder}
                  currentFolderId={currentFolderId}
                />
              </div>
            </div>

            {/* Main Editor Area */}
            <div className="flex-1 min-w-0 overflow-auto bg-white relative">
              <RichTextEditor
                note={currentNote}
                onSave={handleSaveNote}
              />
            </div>
            
            {/* AI Chatbot Toggle Button */}
            <div className="absolute bottom-4 right-4 z-50">
              <button
                onClick={() => setIsChatbotOpen(!isChatbotOpen)}
                className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg transition-colors ${
                  isChatbotOpen ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isChatbotOpen ? '✕' : '🤖'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'finance' && (
          <div className="flex-1 overflow-hidden">
            <FinancePage />
          </div>
        )}
        
        {activeTab === 'grocery' && (
          <div className="flex-1 overflow-hidden">
            <GroceryPage />
          </div>
        )}

        {activeTab === 'volunteer' && (
          <div className="flex-1 overflow-hidden">
            <VolunteerTrackerPage />
          </div>
        )}
      </main>

      <AIChatbot
        currentNote={currentNote}
        isOpen={isChatbotOpen}
        onClose={() => setIsChatbotOpen(false)}
        onNoteUpdate={handleNotesRefresh}
      />
    </div>
  );
}
