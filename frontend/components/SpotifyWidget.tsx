import { Music } from 'lucide-react';

export default function SpotifyWidget() {
  const embedUrl = "https://open.spotify.com/embed/playlist/37i9dQZF1E8OQy1d1kHn6Q?utm_source=generator"; // Example URL

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
      <div className="flex items-center gap-2 mb-4">
        <Music size={24} className="text-green-500" />
        <h3 className="text-lg font-semibold">Spotify Player</h3>
      </div>
      <div className="aspect-w-1 aspect-h-1 w-full">
        <iframe
          className="rounded-lg"
          src={embedUrl}
          width="100%"
          height="100%"
          allow="encrypted-media"
          title="Spotify Embed"
        ></iframe>
      </div>
    </div>
  );
}