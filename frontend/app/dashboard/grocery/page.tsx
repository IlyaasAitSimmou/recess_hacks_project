'use client';

import { useState } from 'react';
import { getStoreRecommendationsForItems, StoreRecommendationResult } from '@/lib/grocery';
import GroceryListForm from '@/components/GroceryListForm';
import StoreLocator from '@/components/StoreLocator';

export default function GroceryPage() {
  const [recommendations, setRecommendations] = useState<StoreRecommendationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (items: string[]) => {
    if (items.length === 0) {
      setError('Please add at least one item to your grocery list.');
      setRecommendations(null);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const storeResult = await getStoreRecommendationsForItems(items);
      setRecommendations(storeResult);

      if (!storeResult.success) {
        setError(storeResult.error || 'Failed to get store recommendations.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-center text-primary-600">Smart Grocery List & Store Locator</h1>
      
      <GroceryListForm onGenerate={handleGenerate} loading={loading} />

      {loading && (
        <div className="flex justify-center items-center h-40">
          <p className="text-gray-500 animate-pulse">
            Getting your location and finding the best stores...
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      )}

      {!loading && recommendations && (
        <StoreLocator recommendations={recommendations} />
      )}
    </div>
  );
}