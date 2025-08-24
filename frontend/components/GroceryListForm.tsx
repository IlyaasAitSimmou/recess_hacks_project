'use client';

import React, { useState } from 'react';
import { useSupabaseStore } from '../lib/useSupabaseStore';

interface GroceryListFormProps {
  onGenerate?: (items: string[]) => void;
  loading?: boolean;
}

export default function GroceryListForm({ onGenerate, loading: externalLoading }: GroceryListFormProps) {
  const { groceryItems, addGroceryItem, toggleGroceryItem, deleteGroceryItem, loading } = useSupabaseStore();
  const [newItem, setNewItem] = useState('');

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (newItem.trim()) {
      addGroceryItem(newItem.trim());
      setNewItem('');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <p className="text-gray-500">Loading grocery list...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">Grocery List</h1>

      <form onSubmit={handleAddItem} className="mb-6 flex">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Add a new item..."
          className="flex-1 p-3 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white p-3 rounded-r-lg hover:bg-blue-700 transition-colors"
        >
          Add Item
        </button>
      </form>

      <ul className="bg-white rounded-lg shadow-md divide-y divide-gray-200">
        {groceryItems.map((item) => (
          <li key={item.id} className="flex items-center justify-between p-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={item.is_completed}
                onChange={() => toggleGroceryItem(item.id, !item.is_completed)}
                className="form-checkbox h-5 w-5 text-blue-600 rounded"
              />
              <span className={`ml-3 text-lg ${item.is_completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                {item.item_name}
              </span>
            </label>
            <button
              onClick={() => deleteGroceryItem(item.id)}
              className="text-red-500 hover:text-red-700 transition-colors"
              aria-label="Delete item"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
      {groceryItems.length === 0 && (
        <p className="text-center text-gray-500 mt-4">Your grocery list is empty. Add an item to get started!</p>
      )}

      {/* Store Recommendations Button */}
      {onGenerate && groceryItems.length > 0 && (
        <div className="mt-6 text-center">
          <button
            onClick={() => onGenerate(groceryItems.map(item => item.item_name))}
            disabled={externalLoading}
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {externalLoading ? 'Finding Stores...' : 'Find Best Stores'}
          </button>
        </div>
      )}
    </div>
  );
}
