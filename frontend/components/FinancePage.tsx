import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { DollarSign, TrendingUp, Target, ShoppingCart, PlusCircle, AlertCircle, BookOpen, Coffee, Car, Home, Calendar, Save, TrendingDown, Settings, ArrowRight, User, Wallet, Tag, CheckCircle } from 'lucide-react';
import { useSupabaseStore } from '../lib/useSupabaseStore'; // Adjust path as needed

const FinancePage = () => {
  // Get Supabase store functions and data
  const {
    loading,
    session,
    userProfile,
    spendingEntries,
    budgets,
    createOrUpdateUserProfile,
    addSpendingEntry: addSpendingEntryToDb,
    createMultipleBudgets,
    resetAllFinanceData
  } = useSupabaseStore();

  // Onboarding state
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [showSettings, setShowSettings] = useState(false);

  // Local onboarding form data
  const [onboardingProfile, setOnboardingProfile] = useState({
    name: '',
    monthly_budget: '',
    selected_categories: [],
    savings_goal: '',
    income_source: ''
  });

  // New entry form state
  const [newEntry, setNewEntry] = useState({
    date: new Date().toISOString().split('T')[0],
    category: '',
    amount: '',
    description: ''
  });

  // Available categories with icons and descriptions
  const availableCategories = [
    { name: 'Food', icon: Coffee, description: 'Groceries, dining, snacks', defaultBudget: 400 },
    { name: 'Transportation', icon: Car, description: 'Gas, bus passes, rideshare', defaultBudget: 150 },
    { name: 'Books & Supplies', icon: BookOpen, description: 'Textbooks, materials, software', defaultBudget: 200 },
    { name: 'Entertainment', icon: Home, description: 'Movies, games, social activities', defaultBudget: 100 },
    { name: 'Shopping', icon: ShoppingCart, description: 'Clothes, personal items', defaultBudget: 150 },
    { name: 'Health & Fitness', icon: Target, description: 'Gym, healthcare, supplements', defaultBudget: 80 },
    { name: 'Housing', icon: Home, description: 'Rent, utilities, dorm fees', defaultBudget: 800 },
    { name: 'Personal Care', icon: User, description: 'Haircuts, cosmetics, hygiene', defaultBudget: 60 }
  ];

  // Check if user is onboarded (has a profile)
  const isOnboarded = userProfile !== null;

  // Onboarding functions
  const handleCategoryToggle = (categoryName) => {
    const updatedCategories = onboardingProfile.selected_categories.includes(categoryName)
      ? onboardingProfile.selected_categories.filter(cat => cat !== categoryName)
      : [...onboardingProfile.selected_categories, categoryName];
    
    setOnboardingProfile({ ...onboardingProfile, selected_categories: updatedCategories });
  };

  const completeOnboarding = async () => {
    if (onboardingProfile.name && onboardingProfile.monthly_budget && onboardingProfile.selected_categories.length > 0) {
      // Create user profile
      await createOrUpdateUserProfile({
        name: onboardingProfile.name,
        monthly_budget: parseFloat(onboardingProfile.monthly_budget),
        selected_categories: onboardingProfile.selected_categories,
        savings_goal: onboardingProfile.savings_goal ? parseFloat(onboardingProfile.savings_goal) : null,
        income_source: onboardingProfile.income_source
      });

      // Create initial budgets
      const monthlyBudget = parseFloat(onboardingProfile.monthly_budget);
      const weeklyBudget = monthlyBudget / 4.33; // Average weeks per month
      
      const totalDefaultBudgets = onboardingProfile.selected_categories.reduce((sum, categoryName) => {
        const category = availableCategories.find(cat => cat.name === categoryName);
        return sum + (category ? category.defaultBudget : 100);
      }, 0);

      const initialBudgets = onboardingProfile.selected_categories.map((categoryName) => {
        const category = availableCategories.find(cat => cat.name === categoryName);
        const proportionalBudget = category ? (category.defaultBudget / totalDefaultBudgets) * weeklyBudget : weeklyBudget / onboardingProfile.selected_categories.length;
        
        return {
          category: categoryName,
          budgeted: Math.round(proportionalBudget),
          period: 'weekly',
          icon: category ? category.icon.name : 'Target'
        };
      });
      
      await createMultipleBudgets(initialBudgets);
    }
  };

  const resetOnboarding = async () => {
    await resetAllFinanceData();
    setOnboardingStep(1);
    setOnboardingProfile({
      name: '',
      monthly_budget: '',
      selected_categories: [],
      savings_goal: '',
      income_source: ''
    });
    setShowSettings(false);
  };

  // Helper function to get week number
  const getWeekNumber = (date) => {
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - startOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
  };

  // Get current week spending
  const getCurrentWeekSpending = () => {
    const currentWeek = getWeekNumber(new Date());
    return spendingEntries.filter(entry => {
      const entryWeek = getWeekNumber(new Date(entry.date));
      return entryWeek === currentWeek;
    });
  };

  // Add spending entry
  const addSpendingEntry = async () => {
    if (newEntry.category && newEntry.amount && newEntry.date) {
      await addSpendingEntryToDb({
        date: newEntry.date,
        category: newEntry.category,
        amount: parseFloat(newEntry.amount),
        description: newEntry.description || `${newEntry.category} purchase`
      });
      
      setNewEntry({
        date: new Date().toISOString().split('T')[0],
        category: '',
        amount: '',
        description: ''
      });
    }
  };

  // Get spending by category for current week
  const getSpendingByCategory = () => {
    const currentWeekSpending = getCurrentWeekSpending();
    const categoryTotals = {};
    
    currentWeekSpending.forEach(entry => {
      categoryTotals[entry.category] = (categoryTotals[entry.category] || 0) + entry.amount;
    });

    const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff88', '#ff0088', '#888888', '#ffbb28'];
    
    return Object.entries(categoryTotals).map(([category, amount], index) => ({
      name: category,
      value: amount,
      color: colors[index % colors.length]
    }));
  };

  // Calculate budget vs actual for current week
  const getBudgetComparison = () => {
    const currentWeekSpending = getCurrentWeekSpending();
    const spendingByCategory = {};
    
    currentWeekSpending.forEach(entry => {
      spendingByCategory[entry.category] = (spendingByCategory[entry.category] || 0) + entry.amount;
    });

    return budgets.map(budget => {
      // Find the corresponding icon component
      const categoryData = availableCategories.find(cat => cat.name === budget.category);
      const IconComponent = categoryData ? categoryData.icon : Target;
      
      return {
        ...budget,
        spent: spendingByCategory[budget.category] || 0,
        icon: IconComponent
      };
    });
  };

  // Calculate totals
  const currentWeekSpending = getCurrentWeekSpending();
  const totalSpentThisWeek = currentWeekSpending.reduce((sum, entry) => sum + entry.amount, 0);
  const totalBudget = budgets.reduce((sum, budget) => sum + budget.budgeted, 0);
  const remainingBudget = totalBudget - totalSpentThisWeek;

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your finance data...</p>
        </div>
      </div>
    );
  }

  // Show login prompt if no session
  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <DollarSign className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Welcome to Finance Tracker</h2>
          <p className="text-gray-600 mb-6">Please log in to start tracking your finances</p>
          <div className="text-sm text-gray-500">
            Your finance data will be securely stored and synced across all your devices.
          </div>
        </div>
      </div>
    );
  }

  // Onboarding UI
  if (!isOnboarded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-2xl">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex justify-between text-sm text-gray-500 mb-2">
              <span>Step {onboardingStep} of 3</span>
              <span>{Math.round((onboardingStep / 3) * 100)}% Complete</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(onboardingStep / 3) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Step 1: Personal Info */}
          {onboardingStep === 1 && (
            <div className="text-center">
              <div className="mb-6">
                <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="h-8 w-8 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Your Finance Tracker!</h2>
                <p className="text-gray-600">Let's get to know you better to personalize your experience</p>
              </div>

              <div className="space-y-4">
                <div>
                  <input
                    type="text"
                    placeholder="What's your name?"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg"
                    value={onboardingProfile.name}
                    onChange={(e) => setOnboardingProfile({...onboardingProfile, name: e.target.value})}
                  />
                </div>

                <div>
                  <select
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg"
                    value={onboardingProfile.income_source}
                    onChange={(e) => setOnboardingProfile({...onboardingProfile, income_source: e.target.value})}
                  >
                    <option value="">What's your main income source?</option>
                    <option value="part-time-job">Part-time job</option>
                    <option value="parents">Parents/Family support</option>
                    <option value="scholarships">Scholarships/Financial aid</option>
                    <option value="savings">Personal savings</option>
                    <option value="multiple">Multiple sources</option>
                  </select>
                </div>

                <button
                  onClick={() => setOnboardingStep(2)}
                  disabled={!onboardingProfile.name}
                  className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  Continue <ArrowRight className="ml-2 h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Budget */}
          {onboardingStep === 2 && (
            <div className="text-center">
              <div className="mb-6">
                <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Wallet className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Set Your Monthly Budget</h2>
                <p className="text-gray-600">How much money do you have available to spend each month?</p>
              </div>

              <div className="space-y-6">
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 h-6 w-6 text-gray-400" />
                  <input
                    type="number"
                    placeholder="1500"
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-xl font-semibold"
                    value={onboardingProfile.monthly_budget}
                    onChange={(e) => setOnboardingProfile({...onboardingProfile, monthly_budget: e.target.value})}
                  />
                </div>

                <div>
                  <input
                    type="number"
                    placeholder="Monthly savings goal (optional)"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                    value={onboardingProfile.savings_goal}
                    onChange={(e) => setOnboardingProfile({...onboardingProfile, savings_goal: e.target.value})}
                  />
                </div>

                <div className="flex space-x-4">
                  <button
                    onClick={() => setOnboardingStep(1)}
                    className="flex-1 bg-gray-200 text-gray-800 py-3 px-6 rounded-lg hover:bg-gray-300"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setOnboardingStep(3)}
                    disabled={!onboardingProfile.monthly_budget}
                    className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    Continue <ArrowRight className="ml-2 h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Categories */}
          {onboardingStep === 3 && (
            <div>
              <div className="mb-6 text-center">
                <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Tag className="h-8 w-8 text-purple-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose Your Spending Categories</h2>
                <p className="text-gray-600">Select the categories you typically spend money on</p>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {availableCategories.map((category) => {
                  const IconComponent = category.icon;
                  const isSelected = onboardingProfile.selected_categories.includes(category.name);
                  
                  return (
                    <div
                      key={category.name}
                      onClick={() => handleCategoryToggle(category.name)}
                      className={`cursor-pointer p-4 border-2 rounded-lg transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 shadow-md'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center mb-2">
                        <IconComponent className={`h-5 w-5 mr-2 ${
                          isSelected ? 'text-blue-600' : 'text-gray-600'
                        }`} />
                        <span className={`font-medium ${
                          isSelected ? 'text-blue-900' : 'text-gray-900'
                        }`}>
                          {category.name}
                        </span>
                        {isSelected && <CheckCircle className="h-4 w-4 text-blue-600 ml-auto" />}
                      </div>
                      <p className="text-xs text-gray-500">{category.description}</p>
                    </div>
                  );
                })}
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={() => setOnboardingStep(2)}
                  className="flex-1 bg-gray-200 text-gray-800 py-3 px-6 rounded-lg hover:bg-gray-300"
                >
                  Back
                </button>
                <button
                  onClick={completeOnboarding}
                  disabled={onboardingProfile.selected_categories.length === 0}
                  className="flex-1 bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Start Tracking!
                </button>
              </div>

              <p className="text-sm text-gray-500 text-center mt-4">
                Selected {onboardingProfile.selected_categories.length} categories
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Settings Modal
  if (showSettings) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Current Settings */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Profile</h3>
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="font-medium text-gray-900">Name: {userProfile.name}</p>
                    <p className="text-gray-600">Monthly Budget: ${userProfile.monthly_budget}</p>
                    <p className="text-gray-600">Income Source: {userProfile.income_source}</p>
                    {userProfile.savings_goal && (
                      <p className="text-gray-600">Savings Goal: ${userProfile.savings_goal}</p>
                    )}
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Active Categories:</h4>
                    <div className="flex flex-wrap gap-2">
                      {userProfile.selected_categories?.map(cat => (
                        <span key={cat} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>
                <div className="space-y-4">
                  <button
                    onClick={resetOnboarding}
                    className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Reset All Data & Start Over
                  </button>
                  
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h4 className="font-medium text-yellow-800 mb-2">⚠️ Reset Warning</h4>
                    <p className="text-sm text-yellow-700">
                      This will delete all your spending entries, budgets, and profile data from the database. 
                      You'll need to go through setup again.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main Dashboard
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header with Settings */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome back, {userProfile.name}! 👋
            </h1>
            <p className="text-gray-600">Track your spending and reach your financial goals</p>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </button>
        </div>

        {/* Add Spending Entry */}
        <div className="bg-white p-6 rounded-lg shadow-sm border mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Add New Expense</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <input
              type="date"
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={newEntry.date}
              onChange={(e) => setNewEntry({...newEntry, date: e.target.value})}
            />
            <select
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={newEntry.category}
              onChange={(e) => setNewEntry({...newEntry, category: e.target.value})}
            >
              <option value="">Select Category</option>
              {userProfile.selected_categories?.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Amount ($)"
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={newEntry.amount}
              onChange={(e) => setNewEntry({...newEntry, amount: e.target.value})}
            />
            <input
              type="text"
              placeholder="Description (optional)"
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={newEntry.description}
              onChange={(e) => setNewEntry({...newEntry, description: e.target.value})}
            />
            <button
              onClick={addSpendingEntry}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center"
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              Add Expense
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Weekly Budget</p>
                <p className="text-2xl font-semibold text-gray-900">${totalBudget.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Spent This Week</p>
                <p className="text-2xl font-semibold text-gray-900">${totalSpentThisWeek.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className={`p-2 rounded-lg ${remainingBudget >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                <Target className={`h-6 w-6 ${remainingBudget >= 0 ? 'text-green-600' : 'text-red-600'}`} />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Remaining</p>
                <p className={`text-2xl font-semibold ${remainingBudget >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${remainingBudget.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Calendar className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Monthly Budget</p>
                <p className="text-2xl font-semibold text-gray-900">${userProfile.monthly_budget}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Spending Breakdown Circle Chart */}
          <div className="lg:col-span-2">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">This Week's Spending Breakdown</h2>
              {getSpendingByCategory().length > 0 ? (
                <div className="flex items-center justify-between">
                  <ResponsiveContainer width="60%" height={300}>
                    <PieChart>
                      <Pie
                        data={getSpendingByCategory()}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={120}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {getSpendingByCategory().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`$${value.toFixed(2)}`, 'Amount']} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-3">
                    {getSpendingByCategory().map((item, index) => (
                      <div key={index} className="flex items-center">
                        <div 
                          className="w-4 h-4 rounded-full mr-3" 
                          style={{ backgroundColor: item.color }}
                        ></div>
                        <div>
                          <p className="font-medium text-gray-900">{item.name}</p>
                          <p className="text-sm text-gray-600">${item.value.toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="bg-gray-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Target className="h-12 w-12 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No spending data yet</h3>
                  <p className="text-gray-500">Add your first expense above to see your spending breakdown</p>
                </div>
              )}
            </div>
          </div>

          {/* Budget Progress */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Budget Progress</h2>
            <div className="space-y-4">
              {getBudgetComparison().map((budget) => {
                const percentage = budget.budgeted > 0 ? (budget.spent / budget.budgeted) * 100 : 0;
                const IconComponent = budget.icon;
                
                return (
                  <div key={budget.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <IconComponent className="h-5 w-5 text-gray-600 mr-2" />
                        <h4 className="font-medium text-gray-900">{budget.category}</h4>
                      </div>
                      <span className="text-sm text-gray-500">${budget.spent.toFixed(2)} / ${budget.budgeted}</span>
                    </div>
                    
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                      <div
                        className={`h-2 rounded-full ${
                          percentage > 100 ? 'bg-red-500' : 
                          percentage > 80 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      ></div>
                    </div>
                    
                    <div className="flex justify-between text-sm">
                      <span className={`font-medium ${
                        percentage > 100 ? 'text-red-600' : 
                        percentage > 80 ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                        {percentage.toFixed(1)}% used
                      </span>
                      <span className="text-gray-600">
                        ${Math.max(0, budget.budgeted - budget.spent).toFixed(2)} left
                      </span>
                    </div>
                  </div>
                );
              })}
              
              {budgets.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500">Your budget categories will appear here</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="mt-8 bg-white p-6 rounded-lg shadow-sm border">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Transactions</h2>
          {currentWeekSpending.length === 0 ? (
            <div className="text-center py-8">
              <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No transactions this week</h3>
              <p className="text-gray-500">Start by adding your first expense above</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentWeekSpending.slice(-6).reverse().map(entry => (
                <div key={entry.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{entry.description}</h4>
                      <p className="text-sm text-gray-500 mt-1">
                        {entry.category} • {new Date(entry.date).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="font-semibold text-gray-900 ml-4">${entry.amount.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Savings Goal Progress */}
        {userProfile.savings_goal && (
          <div className="mt-8 bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Savings Goal Progress</h3>
                <p className="text-gray-600">
                  Monthly Goal: ${userProfile.savings_goal} | 
                  Potential Savings This Week: ${remainingBudget > 0 ? remainingBudget.toFixed(2) : '0.00'}
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">
                  {remainingBudget > 0 && userProfile.savings_goal ? 
                    Math.min(100, Math.round((remainingBudget * 4.33 / parseFloat(userProfile.savings_goal)) * 100)) : 0}%
                </div>
                <p className="text-sm text-gray-500">On track</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinancePage;