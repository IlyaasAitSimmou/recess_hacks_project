import { GoogleGenerativeAI } from '@google/generative-ai';

// Interfaces for the data structures
export interface StoreRecommendationResult {
  success: boolean;
  stores?: NearbyStore[];
  userLocation?: LocationResult;
  fuelAnalysis?: FuelAnalysis;
  error?: string;
}

export interface NearbyStore {
  name: string;
  address: string;
  distance: string;
  distanceValue: number; // in miles for calculations
  type: string;
  rating?: number;
  fuelEfficiency?: FuelEfficiencyData;
}

export interface LocationResult {
  latitude: number;
  longitude: number;
}

export interface FuelAnalysis {
  mostFuelEfficient: NearbyStore;
  closestStore: NearbyStore;
  bestOverall: NearbyStore;
  explanation: string;
  totalFuelSavings?: string;
  assumptions: {
    vehicleMPG: number;
    fuelPrice: number;
    roundTrip: boolean;
  };
}

export interface FuelEfficiencyData {
  fuelCost: number;
  fuelUsed: number; // in gallons
  co2Emissions: number; // in pounds
  recommendation: 'Best Fuel Choice' | 'Good Choice' | 'Consider Alternatives';
  explanation: string;
}

// NOTE: It is not recommended to hardcode API keys in client-side code for production.
const getAIModel = () => {
  const apiKey = 'AIzaSyC8JNEmloWLWydsvbd4W9rFZZOBu-1IOQU';
  if (!apiKey) {
    throw new Error('Google API Key is not set in environment variables.');
  }
  const ai = new GoogleGenerativeAI(apiKey);
  return ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
};

async function getCurrentLocation(): Promise<LocationResult | null> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported by this browser.'));
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        console.error('Geolocation error:', error);
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  });
}

// Calculate fuel efficiency data for each store
function calculateFuelEfficiency(
  distanceInMiles: number,
  vehicleMPG: number = 25,
  fuelPricePerGallon: number = 3.50
): FuelEfficiencyData {
  const roundTripDistance = distanceInMiles * 2;
  const fuelUsed = roundTripDistance / vehicleMPG;
  const fuelCost = fuelUsed * fuelPricePerGallon;
  const co2Emissions = fuelUsed * 19.6; // pounds of CO2 per gallon of gasoline

  let recommendation: 'Best Fuel Choice' | 'Good Choice' | 'Consider Alternatives';
  let explanation: string;

  if (distanceInMiles <= 1) {
    recommendation = 'Best Fuel Choice';
    explanation = `Excellent choice! Very close distance means minimal fuel consumption and emissions.`;
  } else if (distanceInMiles <= 3) {
    recommendation = 'Good Choice';
    explanation = `Good balance of convenience and fuel efficiency for a moderate distance.`;
  } else {
    recommendation = 'Consider Alternatives';
    explanation = `Consider combining this trip with other errands or choosing closer alternatives to maximize fuel efficiency.`;
  }

  return {
    fuelCost: Math.round(fuelCost * 100) / 100,
    fuelUsed: Math.round(fuelUsed * 100) / 100,
    co2Emissions: Math.round(co2Emissions * 10) / 10,
    recommendation,
    explanation
  };
}

// Generate comprehensive fuel analysis
function generateFuelAnalysis(stores: NearbyStore[]): FuelAnalysis | undefined {
  if (stores.length === 0) return undefined;

  const closestStore = stores.reduce((closest, store) => 
    store.distanceValue < closest.distanceValue ? store : closest
  );

  const mostFuelEfficient = stores.reduce((best, store) => 
    (store.fuelEfficiency?.fuelCost || Infinity) < (best.fuelEfficiency?.fuelCost || Infinity) ? store : best
  );

  // Best overall considers both fuel cost and store rating
  const bestOverall = stores.reduce((best, store) => {
    const currentScore = (store.rating || 3) / (store.fuelEfficiency?.fuelCost || 1);
    const bestScore = (best.rating || 3) / (best.fuelEfficiency?.fuelCost || 1);
    return currentScore > bestScore ? store : best;
  });

  const totalFuelSavings = stores.length > 1 ? 
    `Choosing ${mostFuelEfficient.name} over the furthest option saves $${
      Math.max(...stores.map(s => s.fuelEfficiency?.fuelCost || 0)) - (mostFuelEfficient.fuelEfficiency?.fuelCost || 0)
    } in fuel costs.` : undefined;

  const explanation = `
    **Fuel Efficiency Analysis:**
    
    🏆 **Most Fuel Efficient**: ${mostFuelEfficient.name} - Only $${mostFuelEfficient.fuelEfficiency?.fuelCost} in fuel costs
    📍 **Closest Store**: ${closestStore.name} - Just ${closestStore.distance} away
    ⭐ **Best Overall Value**: ${bestOverall.name} - Great balance of distance, fuel cost, and store quality
    
    **Recommendations:**
    • Consider ${mostFuelEfficient.name} to minimize fuel expenses
    • ${closestStore.name} offers the shortest drive time
    • For the best shopping experience with reasonable fuel costs, choose ${bestOverall.name}
    
    **Environmental Impact**: Choosing closer stores can reduce your CO2 emissions by up to ${
      Math.max(...stores.map(s => s.fuelEfficiency?.co2Emissions || 0)) - 
      Math.min(...stores.map(s => s.fuelEfficiency?.co2Emissions || 0))
    } pounds per trip.
  `.trim();

  return {
    mostFuelEfficient,
    closestStore,
    bestOverall,
    explanation,
    totalFuelSavings,
    assumptions: {
      vehicleMPG: 25,
      fuelPrice: 3.50,
      roundTrip: true
    }
  };
}

/**
 * Uses Nominatim to reverse geocode coordinates to an address,
 * then uses a Generative AI model to find nearby stores based on that address.
 * NOTE: The Nominatim Usage Policy must be followed.
 */
async function findNearbyStores(latitude: number, longitude: number): Promise<NearbyStore[]> {
  try {
    // 1. Use Nominatim for reverse geocoding to get a human-readable address.
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`;
    const nominatimResponse = await fetch(nominatimUrl, {
      headers: {
        // You MUST provide a User-Agent to comply with the Nominatim Usage Policy.
        'User-Agent': 'YourAppName/1.0 (your-contact-email@example.com)'
      }
    });

    if (!nominatimResponse.ok) {
      throw new Error(`Nominatim API failed with status: ${nominatimResponse.status}`);
    }

    const nominatimData = await nominatimResponse.json();
    const address = nominatimData.display_name || 'an unknown location';

    console.log('Nominatim reverse geocoding result:', address);

    // 2. Use the Generative AI model with the real-world address for a more focused prompt.
    const model = getAIModel();
    const prompt = `Based on the location "${address}", suggest 8-10 popular grocery stores, supermarkets, and retail chains that would likely be found in this area.

Return ONLY valid JSON in this format:
[
  {
    "name": "Store Name",
    "address": "Approximate address or area",
    "distance": "0.5 miles",
    "distanceValue": 0.5,
    "type": "Grocery Store",
    "rating": 4.2
  }
]

Rules:
- Include major chains like Walmart, Target, Kroger, Safeway, Whole Foods, etc.
- Prioritize local chains if you can, otherwise, suggest major chains.
- Estimate realistic distances (0.1-5 miles) and provide both string and numeric values
- Include store types: Grocery Store, Supermarket, Department Store, Pharmacy
- Provide realistic ratings (3.0-5.0)
- Consider the geographic region for appropriate chains
- Make addresses realistic for the area
- Ensure distanceValue matches the distance string (e.g., "1.2 miles" = 1.2)`;

    const result = await model.generateContent(prompt);
    const text = await result.response.text();
    const cleaned = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
    
    try {
      const parsed = JSON.parse(cleaned) as NearbyStore[];
      if (!Array.isArray(parsed)) return [];
      
      // Add fuel efficiency calculations to each store
      return parsed.map(store => ({
        ...store,
        fuelEfficiency: calculateFuelEfficiency(store.distanceValue || 1)
      }));
    } catch {
      console.error('Failed to parse store suggestions:', text);
      return [];
    }
  } catch (error) {
    console.error('Error finding nearby stores:', error);
    return [];
  }
}

export async function getStoreRecommendationsForItems(items: string[]): Promise<StoreRecommendationResult> {
  try {
    console.log('🗺️ Getting user location...');
    const location = await getCurrentLocation();
    
    if (!location) {
      return {
        success: false,
        error: 'Unable to get user location. Please enable location services.',
      };
    }

    console.log('📍 Location obtained:', location);
    console.log('🏪 Finding nearby stores...');
    
    const stores = await findNearbyStores(location.latitude, location.longitude);
    
    if (items.length > 0 && stores.length > 0) {
      const model = getAIModel();
      const itemsList = items.join(', ');
      const storesList = stores.map(s => `${s.name} (${s.type})`).join(', ');
      
      const prompt = `Given these shopping items: ${itemsList}

And these nearby stores: ${storesList}

Rank the stores from best to worst for finding these specific items. Consider:
- Store type and typical inventory
- Likelihood of having these items
- Price competitiveness
- Quality for these product categories
- Fuel efficiency (closer stores are preferable)

Return the store names in order of recommendation (best first), separated by commas.`;
      
      try {
        const result = await model.generateContent(prompt);
        const text = await result.response.text();
        const recommendedOrder = text.trim().split(',').map(s => s.trim());
        
        const reorderedStores = recommendedOrder
          .map(storeName => stores.find(s => s.name.toLowerCase().includes(storeName.toLowerCase())))
          .filter(Boolean) as NearbyStore[];
        
        const finalStores = Array.from(new Set([...reorderedStores, ...stores]));
        const fuelAnalysis = generateFuelAnalysis(finalStores);
        
        return {
          success: true,
          stores: finalStores,
          userLocation: location,
          fuelAnalysis,
        };
      } catch (aiError) {
        console.error('AI ranking failed, using default order:', aiError);
        const fuelAnalysis = generateFuelAnalysis(stores);
        return { 
          success: true, 
          stores, 
          userLocation: location,
          fuelAnalysis,
        };
      }
    }
    
    const fuelAnalysis = generateFuelAnalysis(stores);
    
    return {
      success: true,
      stores,
      userLocation: location,
      fuelAnalysis,
    };
  } catch (error) {
    console.error('Error getting item-specific store recommendations:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get store recommendations',
    };
  }
}