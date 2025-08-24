import Link from 'next/link';
import { ShoppingCart, LayoutDashboard, Settings } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white p-6 space-y-6 flex flex-col">
        <div className="flex-shrink-0">
          <h1 className="text-2xl font-bold">My Dashboard</h1>
        </div>

        <nav className="flex-grow">
          <ul className="space-y-2">
            <li>
              <Link href="/dashboard" className="flex items-center gap-3 px-4 py-2 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
                <LayoutDashboard size={20} />
                Home
              </Link>
            </li>
            <li>
              <Link href="/dashboard/grocery" className="flex items-center gap-3 px-4 py-2 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
                <ShoppingCart size={20} />
                Grocery List
              </Link>
            </li>
            <li>
              <Link href="/dashboard/settings" className="flex items-center gap-3 px-4 py-2 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
                <Settings size={20} />
                Settings
              </Link>
            </li>
            {/* Add more links here as you build new features */}
            <li>
              <div className="px-4 py-2 text-gray-500 cursor-not-allowed">
                Other Feature (Coming Soon)
              </div>
            </li>
          </ul>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}