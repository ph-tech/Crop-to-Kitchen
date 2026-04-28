import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';
import { 
  TrendingUp, Leaf, ShoppingBag, Clock, ArrowUpRight, 
  BarChart3, PieChart as PieChartIcon, Activity, Zap
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, limit, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { motion } from 'motion/react';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

export default function ImpactReports() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'submissions'), orderBy('timestamp', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const submissions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setData(submissions);
      setLoading(false);
    }, (error) => {
      console.error("ImpactReports Firestore Error:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Compute stats
  const totalKg = data.length * 15; // Mock weight per submission for now
  const totalEarnings = data.reduce((acc, curr) => acc + ((1 - Math.abs(0.7 - (curr.ripeness_index || 0.7))) * 350), 0);
  const avgShelfLife = data.reduce((acc, curr) => acc + (curr.days_to_spoilage || 0), 0) / (data.length || 1);

  // Freshness Data for Pie Chart
  const freshnessData = [
    { name: 'Peak', value: data.filter(d => d.ripeness_index > 0.8).length },
    { name: 'Optimal', value: data.filter(d => d.ripeness_index > 0.4 && d.ripeness_index <= 0.8).length },
    { name: 'Early', value: data.filter(d => d.ripeness_index <= 0.4).length },
  ].filter(d => d.value > 0);

  // Growth Data for Line Chart
  const reversedData = [...data].reverse();
  const growthData = reversedData.map((d, i) => {
    const cumulativeSlice = reversedData.slice(0, i + 1);
    const earnings = cumulativeSlice.reduce((acc, curr) => 
      acc + ((1 - Math.abs(0.7 - (curr.ripeness_index || 0.7))) * 350), 0
    );
    return {
      time: i + 1,
      name: d.crop_type,
      earnings: Math.round(earnings)
    };
  });

  const handleSimulateData = async () => {
    setLoading(true);
    try {
      const crops = ['Tomato', 'Spinach', 'Wheat', 'Mango'];
      const batch = [];
      for (let i = 0; i < 6; i++) {
        batch.push(addDoc(collection(db, 'submissions'), {
          crop_type: crops[Math.floor(Math.random() * crops.length)],
          ripeness_index: 0.3 + Math.random() * 0.6,
          days_to_spoilage: Math.floor(Math.random() * 7) + 1,
          location: { lat: 18.5204 + (Math.random() - 0.5) * 0.1, lng: 73.8567 + (Math.random() - 0.5) * 0.1 },
          status: 'pending_pickup',
          timestamp: Timestamp.now()
        }));
      }
      await Promise.all(batch);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Activity className="animate-spin text-primary" size={32} />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Generating Visual Insights...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] dashboard-card border-dashed bg-zinc-50/50 space-y-6">
        <div className="p-6 bg-white rounded-[2rem] shadow-xl border border-zinc-100 flex items-center justify-center text-primary">
          <BarChart3 size={48} />
        </div>
        <div className="text-center space-y-2">
          <h3 className="font-black text-2xl text-slate-900 uppercase tracking-tight">Intelligence Node Idle</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto font-medium leading-relaxed">
            Real-time visual insights require live harvest data. Once farmers list their crops in the <span className="text-primary font-bold">Farmer Portal</span>, this dashboard will generate impact reports.
          </p>
          <div className="pt-4">
            <button 
              onClick={handleSimulateData}
              className="px-6 py-3 bg-slate-900 shadow-xl shadow-slate-900/20 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95"
            >
              Simulate Network Data
            </button>
          </div>
        </div>
        <div className="flex gap-2">
           <div className="w-1.5 h-1.5 rounded-full bg-zinc-300 animate-pulse" />
           <div className="w-1.5 h-1.5 rounded-full bg-zinc-300 animate-pulse delay-75" />
           <div className="w-1.5 h-1.5 rounded-full bg-zinc-300 animate-pulse delay-150" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Market Volume', value: `₹${totalEarnings.toLocaleString()}`, icon: ShoppingBag, color: 'text-emerald-500', bg: 'bg-emerald-50' },
          { label: 'Food Rescued', value: `${totalKg} KG`, icon: Leaf, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'Avg Stability', value: `${avgShelfLife.toFixed(1)} Days`, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50' },
          { label: 'AI Clusters', value: Math.ceil(data.length / 3), icon: Zap, color: 'text-primary', bg: 'bg-primary/10' },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="dashboard-card p-6 flex flex-col justify-between"
          >
            <div className={`p-3 rounded-2xl w-fit ${stat.bg} ${stat.color} mb-4`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">{stat.label}</p>
              <div className="flex items-end justify-between">
                <h4 className="text-2xl font-black text-slate-900 tracking-tight">{stat.value}</h4>
                <div className="flex items-center gap-1 text-emerald-600 font-bold text-xs">
                  <ArrowUpRight size={14} />
                  <span>Rank Top 5%</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Earnings Growth Line Chart */}
        <div className="lg:col-span-2 dashboard-card p-8 space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-lg text-slate-900 leading-tight">Earnings Velocity</h3>
              <p className="text-xs text-slate-400 font-medium">Cumulative market value of protected harvests over time.</p>
            </div>
            <TrendingUp size={20} className="text-emerald-500" />
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthData}>
                <defs>
                  <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="time" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }}
                  label={{ value: 'Submission Sequence', position: 'insideBottom', offset: -5, fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }}
                  tickFormatter={(val) => `₹${val}`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="earnings" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorEarnings)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quality Distribution Pie Chart */}
        <div className="dashboard-card p-8 space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-lg text-slate-900 leading-tight">Harvest Status</h3>
              <p className="text-xs text-slate-400 font-medium">Current ripeness index distribution.</p>
            </div>
            <PieChartIcon size={20} className="text-blue-500" />
          </div>

          <div className="h-[250px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={freshnessData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {freshnessData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} cornerRadius={10} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-3 mt-4">
            {freshnessData.map((d, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-xs font-bold text-slate-600 underline decoration-slate-200 decoration-2 underline-offset-4">{d.name} Stage</span>
                </div>
                <span className="text-xs font-black text-slate-900">{((d.value / data.length) * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
