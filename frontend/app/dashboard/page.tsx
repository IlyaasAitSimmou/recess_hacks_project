'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SimpleNotesExplorer from '../../components/SimpleNotesExplorer';
import RichTextEditor from '../../components/RichTextEditor';
import AIChatbot from '../../components/AIChatbot';
import FinancePage from '../../components/FinancePage';
import GroceryPage from '../dashboard/grocery/page';
import VolunteerTrackerPage from '../../components/VolunteerTrackerPage';

import { notesStore } from '@/lib/notesStore';
import { LibraryBig, PiggyBank, ShoppingCart, HeartHandshake, Menu, Bot, X, LogOut } from 'lucide-react';

interface Note {
  id: number;
  title: string;
  content: string;
  folder_id: number | null;
  created_at: string;
  updated_at: string;
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
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabs = [
    { id: 'education', label: 'Education', icon: LibraryBig },
    { id: 'finance', label: 'Finance', icon: PiggyBank },
    { id: 'grocery', label: 'Grocery', icon: ShoppingCart },
    { id: 'volunteer', label: 'Volunteer', icon: HeartHandshake },
  ];

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    const userEmail = localStorage.getItem('email');
    
    if (!token) {
      router.push('/login');
      return;
    }

    setEmail(userEmail || '');
    setLoading(false);
  }, [router]);

  // Select note from deep link (?noteId=123)
  useEffect(() => {
    const idStr = searchParams?.get('noteId');
    if (!idStr) return;
    const id = Number(idStr);
    if (!Number.isFinite(id)) return;
    const note = notesStore.findNoteById(id as number);
    if (note) setCurrentNote(note);
  }, [searchParams]);

  const handleSelectNote = (note: Note) => {
    setCurrentNote(note);
  };

  const handleSelectFolder = (folderId: number | null) => {
    setCurrentFolderId(folderId);
    setCurrentNote(null);
  };

  const handleSaveNote = (content: string) => {
    if (currentNote) {
  notesStore.updateNote(currentNote.id, { content });
  const fresh = notesStore.findNoteById(currentNote.id);
  if (fresh) setCurrentNote(fresh);
    }
  };

  // Add refresh function for AI-created notes
  const handleNotesRefresh = () => {
    if (currentNote) {
      const fresh = notesStore.findNoteById(currentNote.id);
      if (fresh) setCurrentNote(fresh);
    } else {
      // Force explorer refresh indirectly
      setCurrentFolderId((prev) => (prev === null ? 0 : null));
      setTimeout(() => setCurrentFolderId((prev) => (prev === 0 ? null : prev)), 0);
    }
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
                className="mr-4 p-2 rounded-md text-gray-900 hover:text-black hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-black">Welcome, {email}</span>
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
          <div className="border-b border-gray-200 bg-white px-6 py-3 flex-shrink-0 shadow-sm">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('education')}
                className={`flex items-center space-x-2 whitespace-nowrap py-2 px-3 border-b-2 font-medium text-sm transition ${
                  activeTab === 'education'
                    ? 'border-indigo-500 text-indigo-600 bg-gray-50'
                    : 'border-transparent text-gray-900 hover:text-black hover:border-gray-300'
                }`}
              >
                <LibraryBig className="h-5 w-5" />
                <span>Education</span>
              </button>

              <button
                onClick={() => setActiveTab('finance')}
                className={`flex items-center space-x-2 whitespace-nowrap py-2 px-3 border-b-2 font-medium text-sm transition ${
                  activeTab === 'finance'
                    ? 'border-indigo-500 text-indigo-600 bg-gray-50'
                    : 'border-transparent text-gray-900 hover:text-black hover:border-gray-300'
                }`}
              >
                <PiggyBank className="h-5 w-5" />
                <span>Finance</span>
              </button>

              <button
                onClick={() => setActiveTab('grocery')}
                className={`flex items-center space-x-2 whitespace-nowrap py-2 px-3 border-b-2 font-medium text-sm transition ${
                  activeTab === 'grocery'
                    ? 'border-indigo-500 text-indigo-600 bg-gray-50'
                    : 'border-transparent text-gray-900 hover:text-black hover:border-gray-300'
                }`}
              >
                <ShoppingCart className="h-5 w-5" />
                <span>Grocery</span>
              </button>

              <button
                onClick={() => setActiveTab('volunteer')}
                className={`flex items-center space-x-2 whitespace-nowrap py-2 px-3 border-b-2 font-medium text-sm transition ${
                  activeTab === 'volunteer'
                    ? 'border-indigo-500 text-indigo-600 bg-gray-50'
                    : 'border-transparent text-gray-900 hover:text-black hover:border-gray-300'
                }`}
              >
                <HeartHandshake className="h-5 w-5" />
                <span>Volunteer</span>
              </button>
            </nav>
          </div>
        )}


        {/* Tab Content - Full width and height */}
        {activeTab === 'education' && (
          <div className="flex-1 flex overflow-hidden force-text-black">
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
          <div className="flex-1 overflow-hidden force-text-black">
            <FinancePage />
          </div>
        )}
        
        {activeTab === 'grocery' && (
          <div className="flex-1 overflow-hidden force-text-black">
            <GroceryPage />
          </div>
        )}

        {activeTab === 'volunteer' && (
          <div className="flex-1 overflow-hidden force-text-black">
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

