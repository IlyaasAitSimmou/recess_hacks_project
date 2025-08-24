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

// Finance tracking interfaces
interface UserProfile {
  id: string;
  name: string | null;
  monthly_budget: number | null;
  selected_categories: string[] | null;
  savings_goal: number | null;
  income_source: string | null;
  updated_at: string;
}

interface SpendingEntry {
  id: string;
  user_id: string;
  created_at: string;
  date: string;
  category: string;
  amount: number;
  description: string | null;
}

interface Budget {
  id: string;
  user_id: string;
  created_at: string;
  category: string;
  budgeted: number;
  period: string;
  icon: string | null;
}

// The custom hook that centralizes all data logic
export const useSupabaseStore = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // State for existing features
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [volunteerEntries, setVolunteerEntries] = useState<VolunteerEntry[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);

  // State for finance tracking
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [spendingEntries, setSpendingEntries] = useState<SpendingEntry[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);

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
          setUserProfile(null);
          setSpendingEntries([]);
          setBudgets([]);
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  // Function to fetch all user-specific data from Supabase
  const fetchData = async (userId: string) => {
    setLoading(true);
    
    // Fetch existing data (Grocery, Volunteer, Notes)
    const { data: groceryData, error: groceryError } = await supabase
      .from('grocery_items')
      .select('*')
      .eq('user_id', userId);
    if (groceryData) setGroceryItems(groceryData);
    if (groceryError) console.error('Error fetching grocery items:', groceryError);

    const { data: volunteerData, error: volunteerError } = await supabase
      .from('volunteer_entries')
      .select('*')
      .eq('user_id', userId);
    if (volunteerData) setVolunteerEntries(volunteerData);
    if (volunteerError) console.error('Error fetching volunteer entries:', volunteerError);

    const { data: folderData, error: folderError } = await supabase
      .from('folders')
      .select('*')
      .eq('user_id', userId);
    if (folderData) setFolders(folderData);
    if (folderError) console.error('Error fetching folders:', folderError);
      
    const { data: noteData, error: noteError } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId);
    if (noteData) setNotes(noteData);
    if (noteError) console.error('Error fetching notes:', noteError);

    // Fetch finance data
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (profileData) setUserProfile(profileData);
    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Error fetching user profile:', profileError);
    }

    const { data: spendingData, error: spendingError } = await supabase
      .from('spending_entries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (spendingData) setSpendingEntries(spendingData);
    if (spendingError) console.error('Error fetching spending entries:', spendingError);

    const { data: budgetData, error: budgetError } = await supabase
      .from('budgets')
      .select('*')
      .eq('user_id', userId);
    if (budgetData) setBudgets(budgetData);
    if (budgetError) console.error('Error fetching budgets:', budgetError);

    setLoading(false);
  };
  
  // --- Existing Functions (Grocery, Volunteer, Notes) ---
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

  // --- Finance Functions ---
  const createOrUpdateUserProfile = async (profileData: Omit<UserProfile, 'id' | 'updated_at'>) => {
    if (!session?.user) return;
    
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert({ 
        id: session.user.id, 
        ...profileData,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating/updating user profile:', error);
      return null;
    }
    
    if (data) {
      setUserProfile(data);
      return data;
    }
  };

  const addSpendingEntry = async (entryData: Omit<SpendingEntry, 'id' | 'user_id' | 'created_at'>) => {
    if (!session?.user) return;
    
    const { data, error } = await supabase
      .from('spending_entries')
      .insert({ 
        user_id: session.user.id,
        ...entryData
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error adding spending entry:', error);
      return null;
    }
    
    if (data) {
      setSpendingEntries((prev) => [data, ...prev]);
      return data;
    }
  };

  const updateSpendingEntry = async (entryId: string, updates: Partial<SpendingEntry>) => {
    const { data, error } = await supabase
      .from('spending_entries')
      .update(updates)
      .eq('id', entryId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating spending entry:', error);
      return null;
    }
    
    if (data) {
      setSpendingEntries((prev) => prev.map(entry => entry.id === entryId ? data : entry));
      return data;
    }
  };

  const deleteSpendingEntry = async (entryId: string) => {
    const { error } = await supabase
      .from('spending_entries')
      .delete()
      .eq('id', entryId);
    
    if (error) {
      console.error('Error deleting spending entry:', error);
      return false;
    }
    
    setSpendingEntries((prev) => prev.filter(entry => entry.id !== entryId));
    return true;
  };

  const createBudget = async (budgetData: Omit<Budget, 'id' | 'user_id' | 'created_at'>) => {
    if (!session?.user) return;
    
    const { data, error } = await supabase
      .from('budgets')
      .insert({ 
        user_id: session.user.id,
        ...budgetData
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating budget:', error);
      return null;
    }
    
    if (data) {
      setBudgets((prev) => [...prev, data]);
      return data;
    }
  };

  const updateBudget = async (budgetId: string, updates: Partial<Budget>) => {
    const { data, error } = await supabase
      .from('budgets')
      .update(updates)
      .eq('id', budgetId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating budget:', error);
      return null;
    }
    
    if (data) {
      setBudgets((prev) => prev.map(budget => budget.id === budgetId ? data : budget));
      return data;
    }
  };

  const deleteBudget = async (budgetId: string) => {
    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('id', budgetId);
    
    if (error) {
      console.error('Error deleting budget:', error);
      return false;
    }
    
    setBudgets((prev) => prev.filter(budget => budget.id !== budgetId));
    return true;
  };

  const createMultipleBudgets = async (budgetsData: Omit<Budget, 'id' | 'user_id' | 'created_at'>[]) => {
    if (!session?.user) return;
    
    const budgetsWithUserId = budgetsData.map(budget => ({
      user_id: session.user.id,
      ...budget
    }));
    
    const { data, error } = await supabase
      .from('budgets')
      .insert(budgetsWithUserId)
      .select();
    
    if (error) {
      console.error('Error creating multiple budgets:', error);
      return null;
    }
    
    if (data) {
      setBudgets((prev) => [...prev, ...data]);
      return data;
    }
  };

  const resetAllFinanceData = async () => {
    if (!session?.user) return;
    
    // Delete all finance-related data for the user
    await supabase.from('spending_entries').delete().eq('user_id', session.user.id);
    await supabase.from('budgets').delete().eq('user_id', session.user.id);
    await supabase.from('user_profiles').delete().eq('id', session.user.id);
    
    // Clear local state
    setUserProfile(null);
    setSpendingEntries([]);
    setBudgets([]);
  };

  return {
    loading,
    session,
    
    // Existing features
    groceryItems,
    addGroceryItem,
    toggleGroceryItem,
    deleteGroceryItem,
    volunteerEntries,
    addVolunteerEntry,
    updateVolunteerEntry,
    deleteVolunteerEntry,
    folders,
    notes,
    createFolder,
    createNote,
    updateNote,
    deleteNote,
    deleteFolder,
    
    // Finance features
    userProfile,
    spendingEntries,
    budgets,
    createOrUpdateUserProfile,
    addSpendingEntry,
    updateSpendingEntry,
    deleteSpendingEntry,
    createBudget,
    updateBudget,
    deleteBudget,
    createMultipleBudgets,
    resetAllFinanceData,
  };
};