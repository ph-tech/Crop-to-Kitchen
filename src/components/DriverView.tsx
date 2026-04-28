import React, { useEffect, useState } from 'react';
import { Truck, Package, Clock, Navigation2, RefreshCcw, MapPin, CheckCircle2, TrendingUp, Info, Loader2, Flag, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import MapComponent from './MapComponent';
import { findAndCreatePools } from '../services/logisticsService';
import { collection, query, where, onSnapshot, writeBatch, doc, Timestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';

export default function DriverView() {
  const [pools, setPools] = useState<any[]>([]);
  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activePool, setActivePool] = useState<any>(null);
  const [isInMission, setIsInMission] = useState(false);
  const [completedWaypoints, setCompletedWaypoints] = useState<string[]>([]);
  const [activeWaypointIndex, setActiveWaypointIndex] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    // Reset mission state when active pool changes
    setCompletedWaypoints([]);
    setActiveWaypointIndex(0);
  }, [activePool?.id]);

  useEffect(() => {
    const poolsPath = 'pools';
    const qPools = query(collection(db, poolsPath), where('status', '==', 'active'));
    
    const unsubscribePools = onSnapshot(qPools, (snapshot) => {
      const poolsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPools(poolsData);
      // Auto-set the active pool to the first one ONLY IF no pool is currently active and not in mission
      if (!isInMission) {
        setActivePool((current: any) => (current ? poolsData.find(p => p.id === current.id) || poolsData[0] : poolsData[0]));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, poolsPath);
    });

    const subsPath = 'submissions';
    const qSubs = query(collection(db, subsPath), where('status', '==', 'pending_pickup'));
    
    const unsubscribeSubs = onSnapshot(qSubs, (snapshot) => {
      const subsData = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        lat: (doc.data() as any).location?.lat, 
        lng: (doc.data() as any).location?.lng,
        label: (doc.data() as any).crop_type,
        ...(doc.data() as any) 
      }));
      setPendingSubmissions(subsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, subsPath);
    });

    return () => {
      unsubscribePools();
      unsubscribeSubs();
    };
  }, [isInMission]);

  const toggleWaypoint = (label: string) => {
    setCompletedWaypoints(prev => 
      prev.includes(label) ? prev.filter(w => w !== label) : [...prev, label]
    );
  };

  const handleArrival = async (label: string) => {
    setIsVerifying(true);
    // Simulate AI verification scan
    setTimeout(() => {
      toggleWaypoint(label);
      setIsVerifying(false);
      if (activeWaypointIndex < (activePool?.locations.length || 0) - 1) {
        setActiveWaypointIndex(prev => prev + 1);
      }
    }, 1500);
  };

  // Combined markers for the map: Currently active pool + all pending submissions
  const allMarkers = [
    ...(activePool ? activePool.locations : []),
    ...pendingSubmissions
  ].filter(m => typeof m.lat === 'number' && typeof m.lng === 'number');

  const handleAcceptPool = async () => {
    if (!activePool) return;
    setLoading(true);
    try {
      // Launch Google Maps navigation
      const coords = activePool.locations.map((loc: any) => `${loc.lat},${loc.lng}`).join('/');
      const mapsUrl = `https://www.google.com/maps/dir/${coords}`;
      window.open(mapsUrl, '_blank');
      
      // Enter Mission Mode in the app
      setIsInMission(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteMission = async () => {
    if (!activePool) return;
    if (completedWaypoints.length < activePool.locations.length) {
       if (!confirm("Some waypoints haven't been marked as collected. Finalize mission anyway?")) return;
    }
    setLoading(true);
    try {
      const batch = writeBatch(db);
      
      // 1. Mark pool as completed
      batch.update(doc(db, 'pools', activePool.id), { 
        status: 'completed',
        completedAt: Timestamp.now()
      });

      // 2. Mark all submissions in the pool as collected
      activePool.submissionIds.forEach((id: string) => {
        batch.update(doc(db, 'submissions', id), { 
          status: 'collected',
          collectedAt: Timestamp.now()
        });
      });

      await batch.commit();
      setIsInMission(false);
      setActivePool(null);
      setCompletedWaypoints([]);
    } catch (err) {
      console.error("Failed to complete mission:", err);
      alert("Error finalizing mission. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handlePoolCrops = async () => {
    setLoading(true);
    try {
      await findAndCreatePools();
    } catch (err) {
      console.error(err);
      alert("Failed to optimize loops: " + (err instanceof Error ? err.message : ""));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full min-h-[600px] relative">
      {/* Auth & Mission Overlays */}
      <AnimatePresence>
        {!auth.currentUser && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[60] bg-white/40 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center rounded-3xl"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-slate-950 text-white p-10 rounded-[2.5rem] shadow-2xl shadow-slate-950/40 space-y-6 max-w-sm border border-white/10"
            >
              <div className="p-4 bg-primary/20 rounded-full w-fit mx-auto border border-primary/30">
                <Truck size={32} className="text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black uppercase tracking-tight">Hub Restricted</h3>
                <p className="text-[10px] text-white/40 leading-relaxed uppercase tracking-[0.2em] font-black">
                  Credential Verification Required
                </p>
              </div>
              <p className="text-xs text-white/60 leading-relaxed font-medium">
                To access live logistics clusters and optimize pickup loops, please sign in with your <span className="text-primary font-bold">Logistics ID</span>.
              </p>
            </motion.div>
          </motion.div>
        )}

        {isInMission && activePool && (
          <motion.div 
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            exit={{ y: -100 }}
            className="absolute top-0 left-0 right-0 z-40 p-4"
          >
            <div className="bg-slate-900/95 backdrop-blur-xl text-white p-6 rounded-3xl shadow-2xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-6 max-w-5xl mx-auto">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center animate-pulse">
                  <Navigation2 size={24} className="fill-current rotate-45" />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">Mission Active</h3>
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest leading-none">
                    Loop #{activePool.id.slice(-4)} • {completedWaypoints.length}/{activePool.locations.length} Collected
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    const coords = activePool.locations.map((loc: any) => `${loc.lat},${loc.lng}`).join('/');
                    window.open(`https://www.google.com/maps/dir/${coords}`, '_blank');
                  }}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  Sync Maps
                </button>
                <button 
                  onClick={handleCompleteMission}
                  disabled={loading}
                  className="px-6 py-2 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : 'Finalize Hub'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar - Pool Control */}
      <aside className="w-full lg:w-96 flex flex-col gap-6">
        <div className="space-y-4">
          {isInMission && activePool ? (
            <div className="dashboard-card p-6 bg-slate-50 border-primary rounded-[2rem] space-y-6">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Waypoint Checklist</h4>
              <div className="space-y-3">
                {activePool.locations.map((loc: any, i: number) => (
                  <div 
                    key={i} 
                    onClick={() => toggleWaypoint(loc.label)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-4 ${
                      completedWaypoints.includes(loc.label) 
                        ? 'bg-emerald-50 border-emerald-100' 
                        : 'bg-white border-zinc-100 hover:border-primary/50 shadow-sm'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${
                      completedWaypoints.includes(loc.label) ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white'
                    }`}>
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <p className={`text-xs font-black uppercase tracking-tight ${completedWaypoints.includes(loc.label) ? 'text-emerald-700 line-through opacity-60' : 'text-slate-900'}`}>
                        {loc.label} Harvest
                      </p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                        {completedWaypoints.includes(loc.label) ? 'Pickup Verified' : 'Awaiting Arrival'}
                      </p>
                    </div>
                    {completedWaypoints.includes(loc.label) && <CheckCircle2 size={18} className="text-emerald-500" />}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-zinc-400 text-center font-bold uppercase tracking-widest">Tap waypoints as you arrive</p>
            </div>
          ) : (
            <>
              <div className="dashboard-card p-6 bg-slate-900 text-white border-0 overflow-hidden relative">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest leading-none mb-1">Impact Analytics</p>
                    <h3 className="text-2xl font-black">₹{ (4.2 * (pools.length + 1)).toFixed(1) } Lakhs</h3>
                  </div>
                  <div className="p-2 bg-primary/20 rounded-lg text-primary shadow-lg shadow-primary/20">
                    <TrendingUp size={20} />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    +12% Community Growth
                  </p>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Total Earnings Saved</p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                <h4 className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <span className="flex items-center gap-2"><Info size={12} /> How it Works</span>
                </h4>
                <ol className="space-y-2">
                  <li className="text-[10px] text-amber-800 flex gap-2">
                    <span className="font-bold opacity-50">01</span>
                    Scan for nearby farmer harvests.
                  </li>
                  <li className="text-[10px] text-amber-800 flex gap-2">
                    <span className="font-bold opacity-50">02</span>
                    The Hub bundles pickups into "Smart Loops".
                  </li>
                  <li className="text-[10px] text-amber-800 flex gap-2">
                    <span className="font-bold opacity-50">03</span>
                    Accept a loop to launch satellite navigation.
                  </li>
                </ol>
              </div>
            </>
          )}

          {!isInMission && (
            <div className="flex items-center gap-2 px-2 pt-2">
              <div className={`w-2 h-2 rounded-full ${pools.length > 0 ? 'bg-primary' : (pendingSubmissions.length > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-300')}`} />
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                {pools.length > 0 ? 'Optimized Pickups Ready' : (pendingSubmissions.length > 0 ? `${pendingSubmissions.length} Harvests Waiting` : 'Scanning for Pickups...')}
              </h3>
            </div>
          )}
        </div>

        <div className="flex-grow flex flex-col gap-4 overflow-hidden">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <Package size={14} className="text-slate-400" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Route Clusters</span>
            </div>
            <button 
              onClick={handlePoolCrops}
              disabled={loading}
              className="px-3 py-1.5 bg-white border border-zinc-200 rounded-lg hover:border-primary transition-all flex items-center gap-2 group shadow-sm active:scale-95"
            >
              <RefreshCcw size={12} className={`${loading ? 'animate-spin' : ''} text-slate-400 group-hover:text-primary`} />
              <span className="text-[10px] font-bold text-slate-600">Re-Optimize</span>
            </button>
          </div>

          <div className="flex-grow overflow-y-auto pr-2 space-y-4 custom-scrollbar">
            {pools.length === 0 && pendingSubmissions.length === 0 ? (
              <div className="dashboard-card p-10 border-dashed flex flex-col items-center justify-center text-center space-y-4 bg-zinc-50/50">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-zinc-100">
                  <Navigation2 size={24} className="text-zinc-200 rotate-45" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-800">No Data Detected</p>
                  <p className="text-xs text-slate-400 leading-relaxed">List a harvest as a farmer to see it appear here in the Logistics Hub.</p>
                </div>
              </div>
            ) : (
              <>
                {pools.map((pool) => (
                  <motion.div
                    key={pool.id}
                    layoutId={pool.id}
                    onClick={() => setActivePool(pool)}
                    className={`dashboard-card p-5 cursor-pointer relative transition-all group ${
                      activePool?.id === pool.id 
                        ? 'border-primary ring-2 ring-primary/20 shadow-lg' 
                        : 'hover:border-primary/50'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl transition-colors ${activePool?.id === pool.id ? 'bg-primary text-white' : 'bg-zinc-100 text-slate-400'}`}>
                          <Truck size={18} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 leading-none">Smart-Loop #{pool.id.slice(-4)}</h4>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Efficiency: High</p>
                        </div>
                      </div>
                      {activePool?.id === pool.id && (
                        <div className="bg-primary/10 text-primary p-1 rounded-full animate-pulse">
                          <CheckCircle2 size={14} />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-zinc-100 pt-4">
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Pickups</p>
                        <p className="text-sm font-black text-slate-900">{pool.submissionIds.length} Farms</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Eco-Credit</p>
                        <p className="text-sm font-black text-emerald-600">+₹34.20</p>
                      </div>
                    </div>

                    {activePool?.id === pool.id && (
                      <motion.div 
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 pt-4 border-t border-dashed border-zinc-200"
                      >
                        <ul className="space-y-2">
                          {pool.locations.slice(0, 3).map((loc: any, i: number) => (
                            <li key={i} className="flex items-center gap-2 text-[10px] font-medium text-slate-500">
                              <div className="w-1 h-1 rounded-full bg-slate-300" />
                              {loc.label} Harvest
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    )}
                  </motion.div>
                ))}

                {!activePool && pendingSubmissions.map((sub) => (
                  <motion.div
                    key={sub.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="dashboard-card p-4 border-dashed border-zinc-200 hover:border-emerald-400 transition-colors cursor-help"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                        <MapPin size={16} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{sub.crop_type} Listed</h4>
                        <p className="text-[10px] text-slate-400 font-medium tracking-tight">Active & scanning for loops...</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </>
            )}
          </div>
        </div>

        <div className="pt-4 mt-auto">
          <button 
            disabled={!activePool || loading}
            onClick={handleAcceptPool}
            className={`btn-primary w-full shadow-lg py-5 text-lg flex items-center justify-center gap-3 transition-all ${
              !activePool || loading ? 'opacity-50 cursor-not-allowed bg-zinc-400' : 'shadow-primary/20'
            }`}
          >
            {loading ? <Loader2 size={24} className="animate-spin" /> : <Navigation2 size={24} className="fill-current rotate-45" />}
            <div className="text-left">
              <span className="block text-xs font-black uppercase tracking-widest opacity-60 leading-none">Dispatcher</span>
              <span className="font-black text-lg uppercase tracking-tight">Accept & Navigate</span>
            </div>
          </button>
        </div>
      </aside>

      {/* Main Column - Mission Control & Live Intel */}
      <div className="flex-1 flex flex-col gap-6 w-full pt-16 lg:pt-0">
        <div className={`flex-grow dashboard-card relative overflow-hidden bg-slate-950 border-slate-800 shadow-2xl group transition-all duration-500 ${isInMission ? 'min-h-[450px]' : 'min-h-[500px]'}`}>
          {isInMission && activePool ? (
            <div className="absolute inset-0 z-20 flex flex-col md:flex-row">
              {/* Left Side: Tactical Map (Offline fallback exists inside) */}
              <div className="flex-1 relative border-r border-white/5 bg-zinc-900">
                <MapComponent 
                  markers={[activePool.locations[activeWaypointIndex]]} 
                  center={activePool.locations[activeWaypointIndex]}
                  drawRoute={true}
                />
                <div className="absolute bottom-6 left-6 flex items-center gap-2 bg-slate-900/80 backdrop-blur px-3 py-1.5 rounded-full border border-white/10">
                   <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                   <span className="text-[8px] font-black uppercase text-white/60 tracking-widest">Waypoint {activeWaypointIndex + 1} Target</span>
                </div>
              </div>

              {/* Right Side: Arrival Control */}
              <div className="w-full md:w-80 bg-slate-900 flex flex-col p-8 justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Package size={120} className="text-white" />
                </div>
                
                <div className="space-y-6 relative z-10">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] leading-none">Dispatcher Active</p>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tight leading-none">Arrived at Site?</h3>
                  </div>

                  <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white">
                        <MapPin size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest leading-none">Current Target</p>
                        <p className="text-sm font-black text-white uppercase">{activePool.locations[activeWaypointIndex]?.label} Farm</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 relative z-10">
                  <button 
                    onClick={() => handleArrival(activePool.locations[activeWaypointIndex].label)}
                    disabled={isVerifying || completedWaypoints.includes(activePool.locations[activeWaypointIndex].label)}
                    className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 transition-all ${
                      completedWaypoints.includes(activePool.locations[activeWaypointIndex].label)
                        ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                        : 'bg-primary text-white shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95'
                    }`}
                  >
                    {isVerifying ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : completedWaypoints.includes(activePool.locations[activeWaypointIndex].label) ? (
                      <>
                        <CheckCircle2 size={18} />
                        Pickup Recorded
                      </>
                    ) : (
                      <>
                        <RefreshCcw size={18} />
                        Verify Harvest Scan
                      </>
                    )}
                  </button>
                  <p className="text-center text-[9px] text-white/30 font-bold uppercase tracking-widest">
                    AI verification required for eco-credit eligibility
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <MapComponent 
                markers={allMarkers} 
                center={activePool ? activePool.locations[0] : (pendingSubmissions[0] || undefined)}
                drawRoute={!!activePool}
              />
              
              {/* Intelligence Overlays */}
              <div className="absolute top-6 left-6 z-10 w-72 space-y-4">
                <AnimatePresence>
                  {activePool && !isInMission && (
                    <motion.div 
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: -20, opacity: 0 }}
                      className="bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-zinc-200 shadow-2xl space-y-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary text-white rounded-lg shadow-inner">
                          <TrendingUp size={16} />
                        </div>
                        <div>
                          <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest leading-none">Optimized Mission</h3>
                          <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">ID: LOOP-{activePool.id.slice(-6)}</p>
                        </div>
                      </div>

                      <p className="text-[11px] leading-relaxed text-slate-600 border-l-2 border-primary pl-3">
                        Our hub has bundled <span className="font-bold text-slate-900">{activePool.submissionIds.length} farmers</span> into one high-efficiency loop. This reduces fuel consumption by <span className="text-primary font-bold">24%</span>.
                      </p>

                      <div className="flex gap-2">
                        <span className="px-2 py-1 bg-zinc-100 rounded text-[9px] font-bold text-slate-500">TRAFFIC AWARE</span>
                        <span className="px-2 py-1 bg-zinc-100 rounded text-[9px] font-bold text-slate-500">COLD CHAIN</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="absolute bottom-6 right-6 flex flex-col items-end gap-3 z-10">
                <div className="bg-slate-900 text-white px-4 py-2 rounded-full shadow-xl flex items-center gap-3 border border-white/10">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">Vision Node: Active</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Tactical Feed */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'System Health', value: 'Synchronized', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50/20 shadow-inner' },
            { label: 'Active Harvests', value: `${pendingSubmissions.length} Batches`, icon: Package, color: 'text-slate-900', bg: 'bg-white' },
            { label: 'Sync Status', value: 'Live', icon: Clock, color: 'text-slate-900', bg: 'bg-white' },
            { label: 'Search Radius', value: '45km Radius', icon: Navigation2, color: 'text-slate-900', bg: 'bg-white' }
          ].map((stat, i) => (
            <div key={i} className={`dashboard-card p-4 flex items-center gap-3 ${stat.bg}`}>
              <div className={`p-2 rounded-lg ${stat.bg.includes('emerald') ? 'bg-white text-emerald-500 shadow-sm' : 'bg-zinc-50 border border-zinc-100 text-slate-400'}`}>
                <stat.icon size={16} />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{stat.label}</p>
                <p className={`text-[11px] font-black uppercase ${stat.color}`}>{stat.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
