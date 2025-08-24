'use client';
import { useState } from 'react';
import { getStoreRecommendationsForItems, StoreRecommendationResult } from '@/lib/grocery';
import GroceryListForm from '@/components/GroceryListForm';
import StoreLocator from '@/components/StoreLocator';

// Enhanced Store Card Component with Fuel Analysis
const StoreCard = ({ store, index }: { store: any; index: number }) => {
  const getFuelBadge = (recommendation: string) => {
    switch (recommendation) {
      case 'Best Fuel Choice':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Good Choice':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-orange-100 text-orange-800 border-orange-200';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-xl font-semibold text-gray-800">{store.name}</h3>
          <p className="text-gray-600 text-sm">{store.type}</p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-blue-600">#{index + 1}</span>
          {store.rating && (
            <p className="text-yellow-500 text-sm">⭐ {store.rating}/5.0</p>
          )}
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="flex items-center text-gray-700">
          <span className="w-5 h-5 mr-2">📍</span>
          <span className="text-sm">{store.address}</span>
        </div>
        
        <div className="flex items-center text-gray-700">
          <span className="w-5 h-5 mr-2">🚗</span>
          <span className="text-sm font-medium">{store.distance}</span>
        </div>

        {store.fuelEfficiency && (
          <div className="bg-gray-50 rounded-lg p-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-800 flex items-center">
                <span className="mr-2">⛽</span>
                Fuel Analysis
              </h4>
              <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getFuelBadge(store.fuelEfficiency.recommendation)}`}>
                {store.fuelEfficiency.recommendation}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Fuel Cost:</span>
                <p className="font-semibold text-green-600">${store.fuelEfficiency.fuelCost}</p>
              </div>
              <div>
                <span className="text-gray-600">Fuel Used:</span>
                <p className="font-semibold">{store.fuelEfficiency.fuelUsed} gal</p>
              </div>
              <div>
                <span className="text-gray-600">CO₂ Emissions:</span>
                <p className="font-semibold text-orange-600">{store.fuelEfficiency.co2Emissions} lbs</p>
              </div>
              <div>
                <span className="text-gray-600">Round Trip:</span>
                <p className="font-semibold">{(store.distanceValue * 2).toFixed(1)} miles</p>
              </div>
            </div>
            
            <p className="text-xs text-gray-600 mt-2 italic">
              {store.fuelEfficiency.explanation}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// Fuel Analysis Summary Component
const FuelAnalysisSummary = ({ fuelAnalysis }: { fuelAnalysis: any }) => {
  return (
    <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6 border border-green-200">
      <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
        <span className="mr-2">⛽</span>
        Smart Fuel Analysis
      </h2>
      
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-green-500">
          <h3 className="font-semibold text-green-700 mb-2">🏆 Most Fuel Efficient</h3>
          <p className="font-bold text-lg">{fuelAnalysis.mostFuelEfficient.name}</p>
          <p className="text-sm text-gray-600">${fuelAnalysis.mostFuelEfficient.fuelEfficiency?.fuelCost} fuel cost</p>
        </div>
        
        <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-blue-500">
          <h3 className="font-semibold text-blue-700 mb-2">📍 Closest Store</h3>
          <p className="font-bold text-lg">{fuelAnalysis.closestStore.name}</p>
          <p className="text-sm text-gray-600">{fuelAnalysis.closestStore.distance} away</p>
        </div>
        
        <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-purple-500">
          <h3 className="font-semibold text-purple-700 mb-2">⭐ Best Overall</h3>
          <p className="font-bold text-lg">{fuelAnalysis.bestOverall.name}</p>
          <p className="text-sm text-gray-600">Best value & efficiency</p>
        </div>
      </div>
      
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="prose prose-sm max-w-none">
          <div className="whitespace-pre-line text-gray-700">
            {fuelAnalysis.explanation}
          </div>
        </div>
        
        {fuelAnalysis.totalFuelSavings && (
          <div className="mt-4 p-3 bg-green-100 rounded-lg border border-green-200">
            <p className="text-green-800 font-medium">💰 {fuelAnalysis.totalFuelSavings}</p>
          </div>
        )}
        
        <div className="mt-4 text-xs text-gray-500 border-t pt-3">
          <p><strong>Assumptions:</strong> {fuelAnalysis.assumptions.vehicleMPG} MPG vehicle, ${fuelAnalysis.assumptions.fuelPrice}/gallon, round trip included</p>
        </div>
      </div>
    </div>
  );
};

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
    <div className="p-8 space-y-8 max-w-6xl mx-auto">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-primary-600 mb-2">
          Smart Grocery List & Store Locator
        </h1>
        <p className="text-gray-600">Find the best stores with fuel-efficient recommendations</p>
      </div>
            
      <GroceryListForm onGenerate={handleGenerate} loading={loading} />

      {loading && (
        <div className="flex justify-center items-center h-40">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-500">
              🗺️ Getting your location and finding the best stores...
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Analyzing fuel efficiency and store options
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg" role="alert">
          <div className="flex items-center">
            <span className="mr-2">❌</span>
            <div>
              <p className="font-bold">Error</p>
              <p>{error}</p>
            </div>
          </div>
        </div>
      )}

      {!loading && recommendations && recommendations.success && (
        <div className="space-y-6">
          {/* Fuel Analysis Summary */}
          {recommendations.fuelAnalysis && (
            <FuelAnalysisSummary fuelAnalysis={recommendations.fuelAnalysis} />
          )}
          
          {/* Store Recommendations */}
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
              <span className="mr-2">🏪</span>
              Recommended Stores
              <span className="ml-2 text-sm font-normal text-gray-500">
                (Ranked by relevance & fuel efficiency)
              </span>
            </h2>
            
            <div className="grid gap-4">
              {recommendations.stores?.map((store, index) => (
                <StoreCard key={`${store.name}-${index}`} store={store} index={index} />
              ))}
            </div>
          </div>
          
          {/* Environmental Impact */}
          {recommendations.stores && recommendations.stores.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-800 mb-2 flex items-center">
                <span className="mr-2">🌱</span>
                Environmental Impact
              </h3>
              <p className="text-green-700 text-sm">
                By choosing fuel-efficient shopping trips, you're helping reduce carbon emissions. 
                The closest store saves approximately{' '}
                {recommendations.stores[0]?.fuelEfficiency?.co2Emissions ? 
                  Math.max(...recommendations.stores.map(s => s.fuelEfficiency?.co2Emissions || 0)) - 
                  Math.min(...recommendations.stores.map(s => s.fuelEfficiency?.co2Emissions || 0))
                  : 0
                } pounds of CO₂ compared to the furthest option.
              </p>
            </div>
          )}
          
          {/* Legacy StoreLocator Component */}
          <div className="pt-6 border-t">
            <StoreLocator recommendations={recommendations} />
          </div>
        </div>
      )}
    </div>
  );
}