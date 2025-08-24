import { Youtube } from 'lucide-react';

export default function YouTubeWidget() {
  // Replace this URL with the embed URL of any YouTube video
  const videoUrl = "https://www.youtube.com/embed/dQw4w9WgXcQ?si=b_r88s4pB2bH_lCg";

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
      <div className="flex items-center gap-2 mb-4">
        <Youtube size={24} className="text-red-500" />
        <h3 className="text-lg font-semibold">YouTube Player</h3>
      </div>
      <div className="aspect-w-16 aspect-h-9 w-full">
        <iframe
          className="rounded-lg"
          width="100%"
          height="auto"
          src={videoUrl}
          title="YouTube video player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        ></iframe>
      </div>
    </div>
  );
}