import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, RefreshCcw, CheckCircle2, MapPin, Loader2, Sparkles, AlertCircle, Zap, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeCropImage } from '../services/geminiService';
import { collection, addDoc, Timestamp, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';

export default function FarmerView() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [criticalCrops, setCriticalCrops] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!auth.currentUser) {
      setCriticalCrops([]);
      return;
    }

    const q = query(
      collection(db, 'submissions'), 
      where('farmerId', '==', auth.currentUser.uid),
      where('status', '==', 'pending_pickup')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const critical = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((d: any) => d.days_to_spoilage < 2);
      setCriticalCrops(critical);
    }, (error) => {
      console.error("Critical crops fetch error:", error);
    });

    return () => unsubscribe();
  }, [auth.currentUser]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(selected);
    }
  };

  useEffect(() => {
    const fetchLocation = () => {
      if (!navigator.geolocation) {
        setLocation({ lat: 18.5204, lng: 73.8567 });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => {
          console.error("Location error", err);
          setLocation({ lat: 18.5204, lng: 73.8567 });
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    };
    fetchLocation();
  }, []);

  const handleSubmit = async () => {
    if (!preview) return;
    if (!location) {
      alert("Fetching your location... please wait a moment and try again.");
      return;
    }
    setAnalyzing(true);
    try {
      const base64 = preview.split(',')[1];
      const analysis = await analyzeCropImage(base64);
      setResult(analysis);
    } catch (err) {
      console.error(err);
      alert("Analysis failed. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSync = async () => {
    if (!result || !location) return;
    
    if (!auth.currentUser) {
      alert("Please Sign In in the header to list your harvest.");
      return;
    }

    try {
      const docData = {
        ...result,
        location,
        timestamp: Timestamp.now(),
        status: 'pending_pickup',
        farmerId: auth.currentUser.uid,
        photoUrl: '', 
      };
      
      const path = 'submissions';
      try {
        await addDoc(collection(db, path), docData);
        alert("Success! Your crop is listed for pickup.");
        setPreview(null);
        setResult(null);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to sync data. " + (err instanceof Error ? err.message : ""));
    }
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col items-stretch gap-8 relative">
      <AnimatePresence>
        {criticalCrops.length > 0 && (
          <motion.div 
            initial={{ height: 0, opacity: 0, y: -20 }}
            animate={{ height: 'auto', opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -20 }}
            className="mb-4"
          >
            <div className="bg-red-50 border-2 border-red-200 p-6 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-red-500/10">
              <div className="flex items-center gap-6">
                <div className="p-4 bg-red-500 text-white rounded-2xl animate-pulse shadow-lg shadow-red-500/30">
                  <ShieldAlert size={28} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none mb-1">Critical Spoilage Alert</h3>
                  <p className="text-sm font-bold text-red-600/80">
                    {criticalCrops.length} {criticalCrops.length === 1 ? 'batch' : 'batches'} are at risk (&lt; 48h shelf life). Recommend priority transport.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 px-4 bg-white rounded-xl border border-red-100 flex items-center justify-center">
                   <span className="text-xs font-black text-red-600 uppercase tracking-widest">Immediate Pickup Advised</span>
                </div>
                <button 
                  onClick={() => window.scrollTo({ top: 1000, behavior: 'smooth' })}
                  className="p-3 bg-red-600 text-white rounded-xl shadow-lg shadow-red-600/20 hover:bg-red-700 transition-colors"
                >
                  <RefreshCcw size={20} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row gap-10 items-start">
      {!auth.currentUser && (
        <div className="absolute inset-x-0 -top-4 -bottom-4 z-[60] bg-white/40 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center rounded-3xl">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-slate-950 text-white p-10 rounded-[2.5rem] shadow-2xl shadow-slate-950/40 space-y-6 max-w-sm border border-white/10"
          >
            <div className="p-4 bg-primary/20 rounded-full w-fit mx-auto border border-primary/30">
              <Sparkles size={32} className="text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black uppercase tracking-tight">Access Locked</h3>
              <p className="text-[10px] text-white/40 leading-relaxed uppercase tracking-[0.2em] font-black">
                Account Verification Required
              </p>
            </div>
            <p className="text-xs text-white/60 leading-relaxed font-medium">
              To list your harvest and claim <span className="text-primary font-bold">Logistics Credits (₹)</span>, please sign in using the button in the header.
            </p>
          </motion.div>
        </div>
      )}
      {/* Left Column: Intake */}
      <div className="flex-1 space-y-6 w-full">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <Camera size={20} />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Crop Analysis</h2>
        </div>
        
        <p className="text-slate-500 leading-relaxed max-w-sm">
          Snap a photo of your harvest. Our AI detects ripeness and shelf-life to optimize logistics.
        </p>

        {!preview ? (
          <motion.div 
            whileHover={{ y: -5 }}
            onClick={() => fileInputRef.current?.click()}
            className="aspect-[4/3] dashboard-card flex flex-col items-center justify-center space-y-4 cursor-pointer group bg-zinc-50 border-dashed border-2"
          >
            <div className="p-5 bg-white rounded-2xl shadow-sm border border-zinc-100 group-hover:scale-110 transition-transform">
              <Camera size={40} className="text-primary" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="font-bold text-slate-800">Tap to Capture</p>
              <p className="text-xs text-slate-400">Camera or Photo Library</p>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-6">
            <div className="relative aspect-[4/3] dashboard-card overflow-hidden">
              <img src={preview} alt="Crop" className="w-full h-full object-cover" />
              {analyzing && (
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                  <Loader2 className="animate-spin mb-4" size={40} />
                  <p className="font-bold tracking-widest text-[10px] uppercase">AI Analyzing Sample...</p>
                </div>
              )}
            </div>

            {!result && (
              <div className="flex flex-col gap-4">
                <button
                  disabled={analyzing}
                  onClick={handleSubmit}
                  className="btn-primary w-full shadow-lg shadow-primary/20"
                >
                  <Sparkles size={20} />
                  <span>Analyze Crop Quality</span>
                </button>
                <div className="flex items-center gap-4">
                  <div className="h-px flex-grow bg-zinc-200" />
                  <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest">or</span>
                  <div className="h-px flex-grow bg-zinc-200" />
                </div>
                <button 
                  onClick={() => {
                    const mockLocation = { lat: 18.5204 + (Math.random() - 0.5) * 0.01, lng: 73.8567 + (Math.random() - 0.5) * 0.01 };
                    setResult({ crop_type: "Heritage Tomato", ripeness_index: 0.7, days_to_spoilage: 4 });
                    setLocation(mockLocation);
                  }}
                  className="btn-secondary w-full"
                >
                  Quick Manual Listing
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Column: AI Insights */}
      <div className="w-full md:w-[400px] space-y-6">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Quality Report</h3>
        
        <AnimatePresence mode="wait">
          {result ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-8 space-y-8 bg-slate-900 text-white rounded-[2rem] border-0 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4">
                <div className="bg-primary/20 text-primary px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-primary/30">
                  AI Certified
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] leading-none mb-1">Detected Variety</p>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Crop Name"
                    value={result.crop_type} 
                    onChange={(e) => setResult({...result, crop_type: e.target.value})}
                    className="text-3xl font-black uppercase bg-transparent outline-none border-b-2 border-white/10 w-full focus:border-primary transition-all pb-3 placeholder:text-white/10 text-white"
                  />
                  <div className="absolute right-0 bottom-4">
                    <Sparkles size={18} className="text-primary animate-pulse" />
                  </div>
                </div>
              </div>

              <div className="space-y-5 bg-white/5 p-6 rounded-3xl border border-white/5">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-widest leading-none">Ripeness Stage</p>
                    <p className="text-lg font-black tracking-tight text-white">
                      {result.ripeness_index > 0.8 ? 'Peak/Overripe' : result.ripeness_index > 0.4 ? 'Optimal/Ripe' : 'Unripe/Young'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xl font-mono text-primary font-black tracking-tighter">{(result.ripeness_index * 100).toFixed(0)}%</span>
                  </div>
                </div>
                <div className="relative h-3 bg-white/5 rounded-full overflow-hidden border border-white/5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${result.ripeness_index * 100}%` }}
                    className={`absolute h-full rounded-full ${
                      result.ripeness_index > 0.8 ? 'bg-amber-500 shadow-[0_0_15px_-3px_#f59e0b]' : result.ripeness_index > 0.4 ? 'bg-emerald-500 shadow-[0_0_15px_-3px_#10b981]' : 'bg-blue-500 shadow-[0_0_15px_-3px_#3b82f6]'
                    }`}
                  />
                  <input 
                    type="range" min="0" max="1" step="0.05" 
                    value={result.ripeness_index} 
                    onChange={(e) => setResult({...result, ripeness_index: parseFloat(e.target.value)})}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Shelf Life</p>
                    <div className="flex items-end gap-1">
                      <span className="text-3xl font-black">{result.days_to_spoilage}</span>
                      <span className="text-[10px] font-bold text-white/40 mb-1">DAYS</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Market Val.</p>
                    <div className="flex items-end gap-0.5">
                      <span className="text-xs font-bold text-emerald-400 mb-1">₹</span>
                      <span className="text-2xl font-black text-emerald-400">
                        {((1 - Math.abs(0.7 - result.ripeness_index)) * 350).toFixed(2)}
                      </span>
                      <span className="text-[10px] font-bold text-white/40 mb-1 ml-1">/KG</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Priority</p>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tight ${
                      result.days_to_spoilage < 3 ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-primary/20 text-primary border border-primary/30'
                    }`}>
                      {result.days_to_spoilage < 3 ? 'CRITICAL' : 'STANDARD'}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Nutri-Score</p>
                    <div className="flex gap-1">
                      {['A', 'B', 'C', 'D'].map(grade => (
                        <div 
                          key={grade}
                          className={`w-5 h-5 flex items-center justify-center rounded text-[10px] font-black ${
                            (grade === 'A' && result.ripeness_index > 0.6) || (grade === 'B' && result.ripeness_index <= 0.6) 
                              ? 'bg-emerald-500 text-white' 
                              : 'bg-white/5 text-white/20'
                          }`}
                        >
                          {grade}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex flex-col gap-3">
                <button 
                  onClick={handleSync}
                  className="btn-primary w-full py-4 text-lg group overflow-hidden relative"
                >
                  <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                  <CheckCircle2 size={20} className="relative z-10" />
                  <span className="relative z-10">List for Pickup</span>
                </button>
                <button 
                  onClick={() => { setPreview(null); setResult(null); }}
                  className="text-xs font-bold text-white/40 hover:text-white transition-colors uppercase tracking-widest text-center py-2"
                >
                  Discard Analysis
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="dashboard-card p-12 flex flex-col items-center justify-center text-center space-y-4 border-dashed bg-zinc-50/50">
              <div className="p-4 bg-zinc-100 rounded-full">
                <Sparkles size={24} className="text-zinc-300" />
              </div>
              <p className="text-sm font-medium text-slate-400">Awaiting visual input for harvest diagnostics.</p>
            </div>
          )}
        </AnimatePresence>

        {location && (
          <div className="p-4 bg-primary/5 rounded-2xl flex items-center gap-3 border border-primary/10">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <MapPin size={16} className="text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Geo-Lock Active</p>
              <p className="text-xs font-bold text-slate-900">{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</p>
            </div>
          </div>
        )}
      </div>

      </div>

      <input 
        type="file" 
        accept="image/*" 
        capture="environment" 
        ref={fileInputRef} 
        onChange={handleFile} 
        className="hidden" 
      />
    </div>
  );
}
