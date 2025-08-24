'use client';

import React, { useState, useEffect } from 'react';
import { AuthService, AuthUser } from '@/lib/auth';
import Login from '@/components/Login';
import SignUp from '@/components/SignUp';
import { LogOut, User, MessageCircle } from 'lucide-react';

type AuthView = 'login' | 'signup';

const HomePage = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authView, setAuthView] = useState<AuthView>('login');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      try {
        const { user } = await AuthService.getCurrentUser();
        setUser(user);
      } catch (error) {
        console.error('Session check error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Listen for auth state changes
    const { data: { subscription } } = AuthService.onAuthStateChange((user) => {
      setUser(user);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuthSuccess = (user: AuthUser) => {
    setUser(user);
  };

  const handleLogout = async () => {
    try {
      await AuthService.signOut();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Loading screen
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <MessageCircle className="mx-auto h-12 w-12 text-blue-500 mb-4 animate-spin" />
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  // Show auth forms if not logged in
  if (!user) {
    if (authView === 'login') {
      return (
        <Login 
          onSuccess={handleAuthSuccess}
          onSwitchToSignUp={() => setAuthView('signup')}
        />
      );
    } else {
      return (
        <SignUp 
          onSuccess={handleAuthSuccess}
          onSwitchToLogin={() => setAuthView('login')}
        />
      );
    }
  }

  // Dashboard for authenticated users
  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <MessageCircle className="h-8 w-8 text-blue-500" />
            <h1 className="text-xl font-bold text-white">Chat App</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-gray-300">
              <User size={18} />
              <span>{user.username || user.email}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-white transition duration-200"
            >
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <MessageCircle className="mx-auto h-16 w-16 text-blue-500 mb-6" />
          <h2 className="text-2xl font-bold text-white mb-4">Welcome to Chat App!</h2>
          <p className="text-gray-400 mb-6">
            You're successfully logged in as <span className="text-blue-400">{user.username}</span>
          </p>
          
          <div className="bg-gray-700 rounded-lg p-6 max-w-md mx-auto">
            <h3 className="text-lg font-semibold text-white mb-3">User Information</h3>
            <div className="space-y-2 text-left">
              <div className="flex justify-between">
                <span className="text-gray-400">ID:</span>
                <span className="text-white text-sm font-mono">{user.id.substring(0, 8)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Email:</span>
                <span className="text-white">{user.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Username:</span>
                <span className="text-white">{user.username}</span>
              </div>
            </div>
          </div>

          <p className="text-gray-500 mt-6 text-sm">
            This is where your chat interface would go. The authentication system is now ready!
          </p>
        </div>
      </div>
    </div>
  );
};

export default HomePage;