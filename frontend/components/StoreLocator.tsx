import { StoreRecommendationResult } from '@/lib/grocery';
import { MapPin, ShoppingCart, Star } from 'lucide-react';

interface StoreLocatorProps {
  recommendations: StoreRecommendationResult;
}

export default function StoreLocator({ recommendations }: StoreLocatorProps) {
  if (!recommendations.stores || recommendations.stores.length === 0) {
    return <p className="text-center text-gray-500">No stores found near your location.</p>;
  }

  const { stores, userLocation } = recommendations;

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
      <h2 className="text-2xl font-semibold mb-4 text-center">Recommended Stores Near You</h2>
      <p className="text-sm text-center text-gray-500 mb-6">
        Based on your list and location ({userLocation?.latitude.toFixed(4)}, {userLocation?.longitude.toFixed(4)})
      </p>
      <ul className="space-y-4">
        {stores.map((store, index) => (
          <li key={store.name + index} className="flex items-start gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors">
            <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 bg-primary-100 text-primary-600 rounded-full font-bold text-lg">
              {index + 1}
            </div>
            <div className="flex-grow">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">{store.name}</h3>
                <span className="text-sm text-primary-500 font-medium bg-primary-50 px-2 py-0.5 rounded-full">
                  {store.type}
                </span>
              </div>
              <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                <MapPin size={16} /> {store.address} ({store.distance})
              </p>
              <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                <Star size={16} className="text-yellow-400" fill="currentColor" />
                <span>{store.rating?.toFixed(1) || 'N/A'} rating</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}