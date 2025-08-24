import Link from 'next/link';
import { ShoppingCart, LayoutDashboard, Settings, HeartHandshake, LibraryBig, PiggyBank} from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="group w-20 hover:w-64 bg-gray-900 text-white p-4 space-y-6 flex flex-col transition-all duration-300 ease-in-out overflow-hidden">
        <div className="flex-shrink-0 h-16 flex items-center justify-center border-b border-gray-700 mb-6">
          <div className="w-6 flex justify-center group-hover:justify-start transition-all duration-300 ease-out">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-base transition-opacity duration-200">
              MD
            </div>
          </div>
          <h1 className="ml-4 text-2xl font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 overflow-hidden">
            My Dashboard
          </h1>
        </div>

        <nav className="flex-grow">
          <ul className="space-y-3">
            <li>
              <Link href="/dashboard" className="flex items-center px-3 py-3 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white transition-colors group/item">
                <div className="w-full flex items-center">
                  <div className="w-6 flex justify-center group-hover:justify-start transition-all duration-300 ease-out">
                    <LayoutDashboard size={22} className="flex-shrink-0" />
                  </div>
                  <span className="ml-4 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 overflow-hidden">
                    Home
                  </span>
                </div>
              </Link>
            </li>
            <li>
              <Link href="" className="flex items-center px-3 py-3 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white transition-colors group/item">
                <div className="w-full flex items-center">
                  <div className="w-6 flex justify-center group-hover:justify-start transition-all duration-300 ease-out">
                    <LibraryBig size={22} className="flex-shrink-0" />
                  </div>
                  <span className="ml-4 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 overflow-hidden">
                    Education
                  </span>
                </div>
              </Link>
            </li>
            <li>
              <Link href="" className="flex items-center px-3 py-3 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white transition-colors group/item">
                <div className="w-full flex items-center">
                  <div className="w-6 flex justify-center group-hover:justify-start transition-all duration-300 ease-out">
                    <PiggyBank size={22} className="flex-shrink-0" />
                  </div>
                  <span className="ml-4 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 overflow-hidden">
                    Finance
                  </span>
                </div>
              </Link>
            </li>
            <li>
              <Link href="" className="flex items-center px-3 py-3 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white transition-colors group/item">
                <div className="w-full flex items-center">
                  <div className="w-6 flex justify-center group-hover:justify-start transition-all duration-300 ease-out">
                    <HeartHandshake size={22} className="flex-shrink-0" />
                  </div>
                  <span className="ml-4 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 overflow-hidden">
                    Volunteer
                  </span>
                </div>
              </Link>
            </li>
            <li>
              <Link href="/dashboard/grocery" className="flex items-center px-3 py-3 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white transition-colors group/item">
                <div className="w-full flex items-center">
                  <div className="w-6 flex justify-center group-hover:justify-start transition-all duration-300 ease-out">
                    <ShoppingCart size={22} className="flex-shrink-0" />
                  </div>
                  <span className="ml-4 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 overflow-hidden">
                    Grocery List
                  </span>
                </div>
              </Link>
            </li>
            <li>
              <Link href="/dashboard/settings" className="flex items-center px-3 py-3 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white transition-colors group/item">
                <div className="w-full flex items-center">
                  <div className="w-6 flex justify-center group-hover:justify-start transition-all duration-300 ease-out">
                    <Settings size={22} className="flex-shrink-0" />
                  </div>
                  <span className="ml-4 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 overflow-hidden">
                    Settings
                  </span>
                </div>
              </Link>
            </li>
            {/* Add more links here as you build new features */}
            <li>
              <div className="flex items-center px-3 py-3 text-gray-500 cursor-not-allowed">
                <div className="w-full flex items-center">
                  <div className="w-6 flex justify-center group-hover:justify-start transition-all duration-300 ease-out">
                    <div className="w-6 h-6 bg-gray-600 rounded flex-shrink-0"></div>
                  </div>
                  <span className="ml-4 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 overflow-hidden">
                    Other Feature (Coming Soon)
                  </span>
                </div>
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