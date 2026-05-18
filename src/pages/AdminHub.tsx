import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { 
  Users, 
  LayoutDashboard, 
  Database,
  CheckCircle2,
  AlertCircle,
  Activity,
  Cpu,
  Globe
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

export function AdminHub() {
  const { user } = useAuth();
  const [seeding, setSeeding] = useState(false);
  const [message, setMessage] = useState('');
  const [dynamicStats, setDynamicStats] = useState<any[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const query = user?.department ? `?department=${user.department}` : '';
        const [usrRes, asnRes] = await Promise.all([
          fetch(`/api/users${query}`).then(r => r.json()),
          fetch(`/api/assignments${query}`).then(r => r.json())
        ]);
        
        const stats = usrRes.map((u: any) => {
          const userAsns = asnRes.filter((a: any) => a.userId === u.id);
          const hours = userAsns.length * 8;
          return {
            id: u.id,
            name: u.name,
            dept: u.department,
            hours,
            efficiency: Math.min(100, 85 + Math.random() * 15)
          };
        });
        setDynamicStats(stats);
      } catch (e) {
        console.error(e);
      }
    };
    if (user) fetchStats();
  }, [user]);

  const seedData = async () => {
    setSeeding(true);
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      const data = await res.json();
      setMessage(data.message);
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setSeeding(false);
    }
  };

  if (user?.role !== 'admin') return <div className="p-8 text-rose-500 font-black uppercase tracking-widest">Unauthorized Access Detected.</div>;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto space-y-10"
    >
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-5xl font-black tracking-tighter text-white mb-2">SYSTEM <span className="text-indigo-500">CONTROL</span></h1>
          <p className="text-slate-500 font-mono text-[10px] uppercase tracking-[0.4em]">Infrastructure & AI Parameter Matrix</p>
        </div>
        <div className="flex glass-morphism rounded-2xl p-1 p-1">
          <button className="px-6 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 rounded-xl border border-indigo-500/20">Active Node</button>
          <button className="px-6 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">Log Stream</button>
        </div>
      </header>

      {/* Workforce Analytics - 3D Card */}
      <section className="glass-morphism rounded-[2.5rem] overflow-hidden shadow-2xl relative">
        <div className="absolute top-0 right-0 p-8 opacity-10">
           <Activity className="w-32 h-32 text-indigo-500" />
        </div>
        
        <div className="p-10 border-b border-white/5 flex justify-between items-center relative z-10">
          <div>
            <h3 className="text-xl font-black text-white uppercase tracking-tight">Performance Matrix</h3>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Personnel Output & Temporal Load</p>
          </div>
          <div className="flex items-center gap-3">
             <div className="flex -space-x-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-[8px] font-bold">
                    {String.fromCharCode(65 + i)}
                  </div>
                ))}
             </div>
             <span className="text-[10px] font-black px-4 py-1.5 bg-rose-500/10 text-rose-500 rounded-full uppercase tracking-widest border border-rose-500/20">
               {dynamicStats.filter(s => s.hours > 48).length} Critical Alerts
             </span>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/5">
                <th className="px-10 py-5 text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Identity</th>
                <th className="px-10 py-5 text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Load Index</th>
                <th className="px-10 py-5 text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] text-center">Temporal Units</th>
                <th className="px-10 py-5 text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] text-right">Node Health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {dynamicStats.map(row => (
                <tr key={row.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-slate-800 border border-white/5 flex items-center justify-center text-[10px] font-black text-slate-400 group-hover:border-indigo-500/30 transition-colors">
                        {row.name.charAt(0)}
                      </div>
                      <span className="text-sm font-bold text-white tracking-tight">{row.name}</span>
                    </div>
                  </td>
                  <td className="px-10 py-6">
                     <div className="w-32 h-1.5 bg-slate-900 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${(row.hours / 60) * 100}%` }}
                          className={cn(
                            "h-full rounded-full",
                            row.hours > 48 ? "bg-rose-500" : "bg-indigo-500"
                          )}
                        />
                     </div>
                  </td>
                  <td className="px-10 py-6 text-center">
                    <span className={cn(
                      "text-sm font-black font-mono",
                      row.hours > 48 ? "text-rose-500" : "text-white"
                    )}>
                      {row.hours}.00H
                    </span>
                  </td>
                  <td className="px-10 py-6 text-right">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 rounded-lg border border-white/5">
                      <div className={cn("w-1.5 h-1.5 rounded-full", row.efficiency > 90 ? "bg-emerald-500 animate-pulse" : "bg-amber-500")} />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{row.efficiency}% OPTIMAL</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="p-10 glass-morphism rounded-[2.5rem] flex flex-col group relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <div className="flex items-center gap-6 mb-10">
            <div className="w-14 h-14 bg-indigo-500/10 text-indigo-500 rounded-2xl flex items-center justify-center border border-indigo-500/20 shadow-lg shadow-indigo-500/10">
              <Database className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-black text-white uppercase tracking-wider">Storage Core</h3>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">Memory Reset & Initialization</p>
            </div>
          </div>
          
          <button
            onClick={seedData}
            disabled={seeding}
            className="mt-auto w-full py-5 px-8 bg-slate-900 border border-white/5 text-white rounded-[1.5rem] font-black uppercase tracking-[0.3em] text-[10px] hover:bg-white/5 disabled:opacity-50 transition-all flex items-center justify-center gap-4 group/btn"
          >
            {seeding ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                PURGE & REINITIALISE SYSTEM
                <CheckCircle2 className="w-4 h-4 text-indigo-500 group-hover/btn:scale-125 transition-transform" />
              </>
            )}
          </button>
          
          {message && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "mt-8 p-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-4 border",
                message.startsWith('Error') ? "bg-rose-500/10 text-rose-500 border-rose-500/20" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
              )}
            >
              <AlertCircle className="w-4 h-4" />
              {message}
            </motion.div>
          )}
        </section>

        <section className="p-10 glass-morphism rounded-[2.5rem] relative group">
          <div className="flex items-center gap-6 mb-10">
            <div className="w-14 h-14 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
              <Cpu className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-black text-white uppercase tracking-wider">AI Synapse</h3>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">Local Heuristic Engine Status</p>
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="flex justify-between items-center py-4 border-b border-white/5 group-hover:border-indigo-500/20 transition-all">
              <div className="flex items-center gap-3">
                 <Globe className="w-4 h-4 text-slate-600" />
                 <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Node Connectivity</span>
              </div>
              <span className="text-[9px] font-black px-4 py-1 bg-emerald-500/10 text-emerald-500 rounded-full uppercase tracking-widest border border-emerald-500/20">Encrypted</span>
            </div>
            <div className="flex justify-between items-center py-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                 <Cpu className="w-4 h-4 text-slate-600" />
                 <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Heuristic Engine</span>
              </div>
              <span className="text-[9px] font-black px-4 py-1 bg-emerald-500/10 text-emerald-500 rounded-full uppercase tracking-widest border border-emerald-500/20">Operational</span>
            </div>
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center gap-3">
                 <Activity className="w-4 h-4 text-slate-600" />
                 <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Conflict Matrix</span>
              </div>
              <span className="text-[9px] font-black px-4 py-1 bg-slate-800 text-slate-500 rounded-full uppercase tracking-widest">Awaiting Command</span>
            </div>
          </div>
        </section>
      </div>
    </motion.div>
  );
}