import React, { useState, useEffect } from 'react';
import FarmerView from './components/FarmerView';
import DriverView from './components/DriverView';
import ImpactReports from './components/ImpactReports';
import { User, Truck, Sprout, BarChart3, Globe, LogIn, LogOut } from 'lucide-react';
import { auth } from './firebase';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

type ViewMode = 'farmer' | 'driver' | 'reports';

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('farmer');
  const [user, setUser] = useState<FirebaseUser | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err: any) {
      if (err.code === 'auth/cancelled-popup-request' || err.code === 'auth/popup-closed-by-user') {
        console.log("Login popup closed or cancelled");
        return;
      }
      console.error("Login failed", err);
    }
  };

  const handleLogout = () => signOut(auth);

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col font-sans text-slate-900 overflow-x-hidden">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-zinc-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="bg-primary p-2 rounded-xl text-white shadow-lg shadow-primary/20">
            <Sprout size={24} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Crop-to-Kitchen</h1>
            <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] leading-none">Smart Supply Chain</p>
          </div>
        </div>

        <nav className="flex bg-zinc-100 p-1.5 rounded-2xl border border-zinc-200">
          <button 
            onClick={() => setViewMode('farmer')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${
              viewMode === 'farmer' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <User size={18} />
            <span>Farmer Portal</span>
          </button>
          <button 
            onClick={() => setViewMode('driver')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${
              viewMode === 'driver' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Truck size={18} />
            <span>Logistics Hub</span>
          </button>
          <button 
            onClick={() => setViewMode('reports')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${
              viewMode === 'reports' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <BarChart3 size={18} />
            <span>Visual Reports</span>
          </button>
        </nav>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-900 leading-none">{user.displayName}</p>
                <p className="text-[10px] text-slate-400 font-medium">{user.email}</p>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 bg-zinc-100 rounded-xl text-slate-400 hover:text-slate-900 transition-colors"
                title="Sign Out"
              >
                <LogOut size={20} />
              </button>
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20"
            >
              <LogIn size={18} />
              <span className="hidden sm:inline">Sign In</span>
            </button>
          )}

          <div className="hidden lg:flex items-center gap-6 border-l border-zinc-200 pl-6 ml-2">
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">SDG Impact Target</p>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-black tracking-tight">02 ZERO HUNGER</span>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-black tracking-tight">12 CONSUMPTION</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow">
        <div className="max-w-7xl mx-auto p-6 md:p-10">
          {viewMode === 'farmer' && <FarmerView />}
          {viewMode === 'driver' && <DriverView />}
          {viewMode === 'reports' && <ImpactReports />}
        </div>
      </main>

      {/* Footer / Status */}
      <footer className="bg-slate-900 text-white/50 py-10 px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-4">
            <div className="bg-white/10 p-4 rounded-full">
              <Globe size={24} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Solution Challenge 2026</p>
              <p className="text-xs">Connecting rural farmers to urban kitchens via Gemini AI.</p>
            </div>
          </div>
          <div className="flex items-center gap-10">
            <div className="text-center md:text-right">
              <p className="text-xs font-bold text-white uppercase tracking-widest mb-1">Infrastructure</p>
              <p className="text-xs">Firebase + Google Maps + Gemini 1.5 Flash</p>
            </div>
            <div className="hidden sm:flex gap-2">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse delay-75" />
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse delay-150" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
