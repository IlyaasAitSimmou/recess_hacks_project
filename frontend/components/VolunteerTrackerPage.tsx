'use client';

import React, { useState } from 'react';
import { useSupabaseStore } from '../lib/useSupabaseStore';

// Defines the structure for a single volunteer entry.
interface VolunteerEntry {
  id: string;
  user_id: string;
  date: string;
  organization: string;
  hours: number;
}

// Main component for the volunteer hour tracker application.
export default function VolunteerTrackerPage() {
  // Use the centralized store hook instead of local state and localStorage effects.
  const { volunteerEntries, addVolunteerEntry, updateVolunteerEntry, deleteVolunteerEntry, loading } = useSupabaseStore();

  // State for the form inputs.
  const [date, setDate] = useState('');
  const [organization, setOrganization] = useState('');
  const [hours, setHours] = useState('');
  // State to track if an entry is being edited.
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  // Handles form submission for both adding new entries and updating existing ones.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !organization || !hours) {
      alert('Please fill out all fields.');
      return;
    }

    const newHours = parseFloat(hours);
    if (isNaN(newHours) || newHours <= 0) {
      alert('Please enter a valid number of hours.');
      return;
    }

    if (editingEntryId) {
      // Logic to update an existing entry using the hook.
      const entryToUpdate: VolunteerEntry = volunteerEntries.find(e => e.id === editingEntryId)!;
      updateVolunteerEntry({
        ...entryToUpdate,
        date,
        organization,
        hours: newHours,
      });
      setEditingEntryId(null);
    } else {
      // Logic to add a new entry using the hook.
      addVolunteerEntry({
        date,
        organization,
        hours: newHours,
      });
    }
    
    // Clear the form fields after submission.
    setDate('');
    setOrganization('');
    setHours('');
  };

  // Pre-populates the form with data from the entry to be edited.
  const handleEdit = (entry: VolunteerEntry) => {
    setEditingEntryId(entry.id);
    setDate(entry.date);
    setOrganization(entry.organization);
    setHours(entry.hours.toString());
  };

  // Removes an entry from the list based on its ID using the hook.
  const handleDelete = (id: string) => {
    deleteVolunteerEntry(id);
  };

  // Calculates the total hours by summing up all entries from the hook's state.
  const totalHours = volunteerEntries.reduce((sum, entry) => sum + entry.hours, 0);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <p className="text-gray-500">Loading volunteer hours...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 min-h-screen p-8 font-sans">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-6 md:p-10">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">Volunteer Hour Tracker</h1>
        
        {/* Form to log or edit hours */}
        <form onSubmit={handleSubmit} className="space-y-4 mb-8">
          <h2 className="text-xl font-semibold text-gray-700">
            {editingEntryId ? 'Edit Entry' : 'Log New Hours'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                id="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="organization" className="block text-sm font-medium text-gray-700 mb-1">Organization</label>
              <input
                type="text"
                id="organization"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="e.g., Local Food Bank"
                required
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="hours" className="block text-sm font-medium text-gray-700 mb-1">Hours</label>
              <input
                type="number"
                id="hours"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="e.g., 3.5"
                step="0.5"
                min="0.5"
                required
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white font-semibold py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            {editingEntryId ? 'Update Hours' : 'Add Entry'}
          </button>
        </form>

        {/* Total Hours Summary */}
        <div className="bg-blue-50 rounded-lg p-4 mb-8 text-center border border-blue-200">
          <h2 className="text-lg font-semibold text-blue-800">Total Volunteer Hours</h2>
          <p className="text-4xl font-extrabold text-blue-600">{totalHours.toFixed(1)}</p>
        </div>

        {/* List of logged volunteer entries */}
        <div className="overflow-x-auto">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Logged Entries</h2>
          {volunteerEntries.length === 0 ? (
            <p className="text-gray-500 text-center">No hours logged yet. Add your first entry above!</p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 rounded-lg overflow-hidden shadow-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organization</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {volunteerEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{entry.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{entry.organization}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{entry.hours.toFixed(1)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(entry)}
                        className="text-indigo-600 hover:text-indigo-900 mr-4 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="text-red-600 hover:text-red-900 transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
