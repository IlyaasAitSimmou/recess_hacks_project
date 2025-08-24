'use client';

import { useState, useEffect } from 'react';
import { Cloud, Sun, Droplet } from 'lucide-react';

export default function WeatherWidget() {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWeather = async () => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(async (position) => {
          const { latitude, longitude } = position.coords;
          // Hardcoded API Key for testing as requested
          const apiKey = '2f44e3ebd486dd0e43ec12eb74f56c51';
          const url = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=metric`;

          try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.cod !== 200) {
              setError(`Error fetching weather: ${data.message}`);
              setLoading(false);
              return;
            }

            setWeather(data);
            setLoading(false);
          } catch (error) {
            console.error('Failed to fetch weather data:', error);
            setError("An unexpected error occurred while fetching weather.");
            setLoading(false);
          }
        }, (geoError) => {
          console.error('Geolocation permission denied or error:', geoError);
          setError("Geolocation permission denied. Unable to get weather.");
          setLoading(false);
        });
      } else {
        setError("Geolocation not supported by this browser.");
        setLoading(false);
      }
    };
    fetchWeather();
  }, []);

  if (loading) return <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">Loading weather...</div>;
  if (error) return <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 text-red-500">{error}</div>;
  if (!weather) return null;

  const { main, weather: weatherInfo } = weather as any;
  const icon = weatherInfo[0].main === 'Rain' ? <Droplet size={40} className="text-blue-400" /> :
               weatherInfo[0].main === 'Clear' ? <Sun size={40} className="text-yellow-400" /> :
               <Cloud size={40} className="text-gray-400" />;

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 flex items-center gap-4">
      {icon}
      <div>
        <h3 className="text-lg font-semibold">Weather</h3>
        <p className="text-xl font-bold text-gray-800">{main.temp.toFixed(1)}°C</p>
        <p className="text-sm text-gray-500">{weatherInfo[0].description}</p>
      </div>
    </div>
  );
}