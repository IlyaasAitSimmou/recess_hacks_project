// hooks/useSupabaseStore.ts
'use client';

import { createClient } from '@supabase/supabase-js';
import { useState, useEffect } from 'react';

// Initialize Supabase client using environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Define data interfaces for type safety
interface GroceryItem {
  id: string;
  user_id: string;
  item_name: string;
  is_completed: boolean;
}

interface VolunteerEntry {
  id: string;
  user_id: string;
  date: string;
  organization: string;
  hours: number;
}

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
export const useSupabaseStore = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // State for Grocery and Volunteer features
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [volunteerEntries, setVolunteerEntries] = useState<VolunteerEntry[]>([]);
  
  // State for Notes feature
  const [folders, setFolders] = useState<Folder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);

  // Set up auth listener on component mount to fetch user data
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (session) {
          fetchData(session.user.id);
        } else {
          // Clear all state if the user logs out
          setGroceryItems([]);
          setVolunteerEntries([]);
          setFolders([]);
          setNotes([]);
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  // Function to fetch all user-specific data from Supabase
  const fetchData = async (userId: string) => {
    setLoading(true);
    
    // Fetch Grocery items
    const { data: groceryData, error: groceryError } = await supabase
      .from('grocery_items')
      .select('*')
      .eq('user_id', userId);
    if (groceryData) setGroceryItems(groceryData);
    if (groceryError) console.error('Error fetching grocery items:', groceryError);

    // Fetch Volunteer entries
    const { data: volunteerData, error: volunteerError } = await supabase
      .from('volunteer_entries')
      .select('*')
      .eq('user_id', userId);
    if (volunteerData) setVolunteerEntries(volunteerData);
    if (volunteerError) console.error('Error fetching volunteer entries:', volunteerError);

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
  
  // --- Grocery Item Functions (unchanged from last interaction) ---
  const addGroceryItem = async (itemName: string) => {
    if (!session?.user) return;
    const { data, error } = await supabase
      .from('grocery_items')
      .insert({ user_id: session.user.id, item_name: itemName, is_completed: false })
      .select();
    if (error) console.error('Error adding grocery item:', error);
    if (data) setGroceryItems((prev) => [...prev, ...data]);
  };
  
  const toggleGroceryItem = async (id: string, isCompleted: boolean) => {
    const { error } = await supabase
      .from('grocery_items')
      .update({ is_completed: isCompleted })
      .eq('id', id);
    if (error) console.error('Error updating grocery item:', error);
    setGroceryItems((prev) => prev.map((item) => item.id === id ? { ...item, is_completed: isCompleted } : item));
  };
  
  const deleteGroceryItem = async (id: string) => {
    const { error } = await supabase
      .from('grocery_items')
      .delete()
      .eq('id', id);
    if (error) console.error('Error deleting grocery item:', error);
    setGroceryItems((prev) => prev.filter((item) => item.id !== id));
  };
  
  // --- Volunteer Entry Functions (unchanged from last interaction) ---
  const addVolunteerEntry = async (entry: Omit<VolunteerEntry, 'id' | 'user_id'>) => {
    if (!session?.user) return;
    const { data, error } = await supabase
      .from('volunteer_entries')
      .insert({ ...entry, user_id: session.user.id })
      .select();
    if (error) console.error('Error adding volunteer entry:', error);
    if (data) setVolunteerEntries((prev) => [...prev, ...data]);
  };
  
  const updateVolunteerEntry = async (entry: VolunteerEntry) => {
    const { error } = await supabase
      .from('volunteer_entries')
      .update({ date: entry.date, organization: entry.organization, hours: entry.hours })
      .eq('id', entry.id);
    if (error) console.error('Error updating volunteer entry:', error);
    setVolunteerEntries((prev) => prev.map((item) => item.id === entry.id ? entry : item));
  };
  
  const deleteVolunteerEntry = async (id: string) => {
    const { error } = await supabase
      .from('volunteer_entries')
      .delete()
      .eq('id', id);
    if (error) console.error('Error deleting volunteer entry:', error);
    setVolunteerEntries((prev) => prev.filter((item) => item.id !== id));
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

  const deleteNote = async (noteId: string) => {
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', noteId);
    if (error) console.error('Error deleting note:', error);
    setNotes((prev) => prev.filter(n => n.id !== noteId));
  };

  const deleteFolder = async (folderId: string) => {
    // Delete all notes and sub-folders within the folder first to avoid foreign key constraints
    await supabase.from('notes').delete().eq('folder_id', folderId);
    await supabase.from('folders').delete().eq('parent_id', folderId);

    const { error } = await supabase
      .from('folders')
      .delete()
      .eq('id', folderId);
    if (error) console.error('Error deleting folder:', error);
    setFolders((prev) => prev.filter(f => f.id !== folderId));
    setNotes((prev) => prev.filter(n => n.folder_id !== folderId));
  };

  return {
    loading,
    // Grocery & Volunteer
    groceryItems,
    addGroceryItem,
    toggleGroceryItem,
    deleteGroceryItem,
    volunteerEntries,
    addVolunteerEntry,
    updateVolunteerEntry,
    deleteVolunteerEntry,
    // Notes & Folders
    folders,
    notes,
    createFolder,
    createNote,
    updateNote,
    deleteNote,
    deleteFolder,
  };
};
