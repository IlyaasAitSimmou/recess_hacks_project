import { GoogleGenerativeAI } from '@google/generative-ai';

// Interfaces for the data structures
export interface StoreRecommendationResult {
  success: boolean;
  stores?: NearbyStore[];
  userLocation?: LocationResult;
  error?: string;
}

export interface NearbyStore {
  name: string;
  address: string;
  distance: string;
  type: string;
  rating?: number;
}

export interface LocationResult {
  latitude: number;
  longitude: number;
}

const getAIModel = () => {
  const apiKey = 'AIzaSyB5mlVHMkZAA11UTe8lHGE2WSxeb4AfSPU'
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

async function findNearbyStores(latitude: number, longitude: number): Promise<NearbyStore[]> {
  try {
    const model = getAIModel();
    const prompt = `Based on the coordinates ${latitude}, ${longitude}, suggest 8-10 popular grocery stores, supermarkets, and retail chains that would likely be found in this area.

Return ONLY valid JSON in this format:
[
  {
    "name": "Store Name",
    "address": "Approximate address or area",
    "distance": "0.5 miles",
    "type": "Grocery Store",
    "rating": 4.2
  }
]

Rules:
- Include major chains like Walmart, Target, Kroger, Safeway, Whole Foods, etc.
- Prioritize local chains if you can, otherwise, suggest major chains.
- Estimate realistic distances (0.1-5 miles)
- Include store types: Grocery Store, Supermarket, Department Store, Pharmacy
- Provide realistic ratings (3.0-5.0)
- Consider the geographic region for appropriate chains
- Make addresses realistic for the area`;

    const result = await model.generateContent(prompt);
    const text = await result.response.text();
    const cleaned = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
    
    try {
      const parsed = JSON.parse(cleaned) as NearbyStore[];
      return Array.isArray(parsed) ? parsed : [];
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

Return the store names in order of recommendation (best first), separated by commas.`;
      
      try {
        const result = await model.generateContent(prompt);
        const text = await result.response.text();
        const recommendedOrder = text.trim().split(',').map(s => s.trim());
        
        const reorderedStores = recommendedOrder
          .map(storeName => stores.find(s => s.name.toLowerCase().includes(storeName.toLowerCase())))
          .filter(Boolean) as NearbyStore[];
        
        const finalStores = Array.from(new Set([...reorderedStores, ...stores]));
        
        return {
          success: true,
          stores: finalStores,
          userLocation: location,
        };
      } catch (aiError) {
        console.error('AI ranking failed, using default order:', aiError);
        return { success: true, stores, userLocation: location };
      }
    }
    
    return {
      success: true,
      stores,
      userLocation: location,
    };
  } catch (error) {
    console.error('Error getting item-specific store recommendations:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get store recommendations',
    };
  }
}