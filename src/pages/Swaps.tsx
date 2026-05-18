import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import { SwapRequest, User, ShiftTemplate, Assignment } from '../types';
import { Repeat, Check, X, Clock, AlertTriangle, Plus, Loader2, Send, UserCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function Swaps() {
  const { user } = useAuth();
  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [users, setUsers] = useState<User[]>([]);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [myAssignments, setMyAssignments] = useState<Assignment[]>([]);
  const [allAssignments, setAllAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [swapForm, setSwapForm] = useState({ 
    assignmentId: '', 
    date: '',
    toUserId: '', 
    reason: '' 
  });

  const handleDateChange = (date: string) => {
    const assignment = myAssignments.find(a => a.date === date);
    setSwapForm({ ...swapForm, date, assignmentId: assignment?.id || '' });
  };

  const fetchData = async () => {
    try {
      const query = user?.department ? `?department=${user.department}` : '';
      const [swapRes, userRes, tplRes, asnRes] = await Promise.all([
        fetch(`/api/swaps${query}`).then(r => r.json()),
        fetch(`/api/users${query}`).then(r => r.json()),
        fetch('/api/templates').then(r => r.json()),
        fetch(`/api/assignments?department=${user?.department}`).then(r => r.json())
      ]);
      const sortedSwaps = swapRes.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setSwaps(sortedSwaps);
      setUsers(userRes);
      setTemplates(tplRes);
      setAllAssignments(asnRes);
      if (user) {
        const userAssignments = asnRes.filter((a: any) => String(a.userId) === String(user.id));
        setMyAssignments(userAssignments);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const filteredSwaps = swaps.filter(swap => {
    const isPending = swap.status === 'pending';
    const isInvolved = swap.fromUserId === user?.id || swap.toUserId === user?.id;
    
    if (activeTab === 'active') {
      if (user?.role === 'admin') return isPending;
      // Per instructions: show only swaps directed TO this user for active action
      // But we also allow them to see what they SENT in active if we want? 
      // The user said "the swap should only be displayed to the person to whom request is raised"
      // I will strictly follow that for the 'active' list but maybe history is where they see results.
      return isPending && swap.toUserId === user?.id;
    } else {
      const isHistory = swap.status !== 'pending';
      if (user?.role === 'admin') return isHistory;
      return isHistory && isInvolved;
    }
  });

  const handleAction = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const res = await fetch(`/api/swaps/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSwapSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!swapForm.assignmentId || !swapForm.toUserId || !swapForm.date) return;

    // Conflict Check: Is the target user already working the SAME shift slot?
    const myAssignment = myAssignments.find(a => a.id === swapForm.assignmentId);
    if (!myAssignment) return;

    const conflict = allAssignments.find(a => 
      String(a.userId) === String(swapForm.toUserId) && 
      a.date === swapForm.date &&
      a.shiftId === myAssignment.shiftId
    );

    if (conflict) {
      const tpl = templates.find(t => t.id === conflict.shiftId);
      setError(`Slot Occupied: Target colleague is already assigned to the ${tpl?.name || 'same'} shift slot.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/swaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId: user?.id,
          toUserId: swapForm.toUserId,
          assignmentId: swapForm.assignmentId,
          reason: swapForm.reason
        })
      });
      if (res.ok) {
        setIsModalOpen(false);
        setSwapForm({ assignmentId: '', date: '', toUserId: '', reason: '' });
        fetchData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto space-y-10"
    >
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-5xl font-black tracking-tighter text-white mb-2 uppercase">Protocol <span className="text-indigo-500">Exchanges</span></h1>
          <p className="text-slate-500 font-mono text-[10px] uppercase tracking-[0.4em]">Authorized Shift Reassignment Portal</p>
        </div>
        <div className="flex gap-4">
          <div className="flex bg-slate-900/50 p-1.5 rounded-2xl border border-white/5">
            <button 
              onClick={() => setActiveTab('active')}
              className={cn(
                "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === 'active' ? "bg-indigo-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
              )}
            >
              Action Center
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={cn(
                "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === 'history' ? "bg-indigo-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
              )}
            >
              History Log
            </button>
          </div>
          {user?.role === 'employee' && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black tracking-widest uppercase flex items-center gap-3 transition-all shadow-lg shadow-indigo-950/40"
            >
              <Plus className="w-4 h-4" /> Propose Swap
            </button>
          )}
        </div>
      </header>

      <div className="grid gap-6">
        {filteredSwaps.length === 0 ? (
          <div className="p-20 glass-morphism rounded-[2.5rem] text-center">
            <Repeat className="w-16 h-16 text-slate-800 mx-auto mb-6" />
            <h3 className="text-xl font-black text-slate-600 uppercase tracking-widest">
              {activeTab === 'active' ? 'No Active Reassignments' : 'History is Clean'}
            </h3>
            <p className="text-[10px] font-mono text-slate-700 uppercase tracking-[0.2em] mt-2">
              {activeTab === 'active' ? 'Department Temporal Flow is Stable' : 'Archived logs will appear here'}
            </p>
          </div>
        ) : filteredSwaps.map(swap => {
          const fromUser = users.find(u => u.id === swap.fromUserId);
          const toUser = users.find(u => u.id === swap.toUserId);
          
          return (
            <motion.div 
              key={swap.id} 
              whileHover={{ scale: 1.01 }}
              className="glass-morphism rounded-[2rem] p-8 flex items-center justify-between group transition-all"
            >
              <div className="flex items-center gap-8">
                <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 rounded-3xl flex items-center justify-center text-indigo-400 shadow-lg shadow-indigo-500/5">
                  <Repeat className="w-8 h-8 group-hover:rotate-180 transition-transform duration-500" />
                </div>
                <div>
                  <div className="flex items-center gap-4 mb-2">
                    <span className="text-lg font-black text-white tracking-tight uppercase">{fromUser?.name}</span>
                    <div className="flex gap-1">
                       <div className="w-1.5 h-1.5 bg-slate-700 rounded-full" />
                       <div className="w-1.5 h-1.5 bg-slate-700 rounded-full" />
                    </div>
                    <span className="text-lg font-black text-slate-500 tracking-tight uppercase">{toUser?.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono text-slate-500 uppercase tracking-widest">
                    <span className="text-indigo-400 font-black">Swap Requested</span>
                    <span className="w-1 h-1 bg-slate-800 rounded-full" />
                    <span>{format(new Date(swap.createdAt), 'MMM d, HH:mm')}</span>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                     <AlertTriangle className="w-3 h-3 text-amber-500/50" />
                     <p className="text-[10px] text-slate-400 font-medium italic tracking-wider">"{swap.reason}"</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                {swap.status === 'pending' ? (
                  (user?.role === 'admin' || user?.id === swap.toUserId) ? (
                    <div className="flex gap-4">
                      <button 
                        onClick={() => handleAction(swap.id, 'approved')}
                        className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-2xl border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center shadow-lg shadow-emerald-500/10"
                        title={user?.id === swap.toUserId ? "Accept Swap" : "Approve Swap"}
                      >
                        <Check className="w-6 h-6" />
                      </button>
                      <button 
                         onClick={() => handleAction(swap.id, 'rejected')}
                        className="w-12 h-12 bg-rose-500/10 text-rose-500 rounded-2xl border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center shadow-lg shadow-rose-500/10"
                        title={user?.id === swap.toUserId ? "Decline Swap" : "Reject Swap"}
                      >
                        <X className="w-6 h-6" />
                      </button>
                    </div>
                  ) : (
                    <div className="px-6 py-3 bg-slate-900 border border-white/5 text-slate-400 rounded-2xl text-[10px] font-black tracking-widest uppercase flex items-center gap-3">
                      <Clock className="w-4 h-4 animate-pulse" />
                      Pending Validation
                    </div>
                  )
                ) : (
                  <div className={cn(
                    "px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border",
                    swap.status === 'approved' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-emerald-500/10" : "bg-rose-500/10 text-rose-500 border-rose-500/20 shadow-rose-500/10"
                  )}>
                    Protocol {swap.status}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <SwapModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSwapSubmit}
        submitting={submitting}
        form={swapForm}
        onDateChange={handleDateChange}
        setForm={setSwapForm}
        assignments={myAssignments}
        users={users}
        currentUserId={user?.id}
        templates={templates}
        error={error}
      />
    </motion.div>
  );
}

function SwapModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  submitting, 
  form, 
  onDateChange,
  setForm, 
  assignments, 
  users, 
  currentUserId,
  templates,
  error
}: any) {
  const colleagues = users.filter((u: any) => u.id !== currentUserId);
  
  // Get unique dates from user's assignments
  const availableDates = [...new Set(assignments.map((a: any) => a.date))].sort();

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-full max-w-md glass-morphism rounded-[2.5rem] p-10 relative overflow-hidden"
          >
            <button 
              onClick={onClose}
              className="absolute top-8 right-8 text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-8">
              <h3 className="text-3xl font-black tracking-tighter text-white uppercase mb-2">Request <span className="text-indigo-400">Mutation</span></h3>
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Protocol Reassignment Request</p>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="mb-8 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex gap-3 text-rose-500 shadow-lg shadow-rose-500/5 items-center"
              >
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <p className="text-[10px] font-black uppercase tracking-wider leading-relaxed">{error}</p>
              </motion.div>
            )}

            <form onSubmit={onSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2">Select Date to Swap</label>
                <select
                  required
                  className="w-full bg-slate-900/50 border border-white/10 rounded-2xl py-4 px-6 text-xs font-bold text-white uppercase tracking-widest focus:border-indigo-500/50 focus:outline-none transition-colors appearance-none"
                  value={form.date}
                  onChange={e => onDateChange(e.target.value)}
                >
                  <option value="">{availableDates.length > 0 ? "Choose Date..." : "No shifts assigned yet"}</option>
                  {availableDates.map((date: any) => {
                    const assignment = assignments.find((a: any) => a.date === date);
                    const tpl = templates.find((t: any) => t.id === assignment?.shiftId);
                    return (
                      <option key={date} value={date}>
                        {format(new Date(date), 'EEEE, MMM d')} ({tpl?.name || 'Assigned'})
                      </option>
                    );
                  })}
                </select>
                {form.assignmentId && (
                  <p className="text-[10px] text-indigo-400 font-bold ml-2 animate-pulse uppercase tracking-widest">
                    Primary Shift Detected for selection
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2">Select Target Colleague</label>
                <div className="relative">
                  <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                  <select
                    required
                    className="w-full bg-slate-900/50 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-xs font-bold text-white uppercase tracking-widest focus:border-indigo-500/50 focus:outline-none transition-colors appearance-none"
                    value={form.toUserId}
                    onChange={e => setForm({ ...form, toUserId: e.target.value })}
                  >
                    <option value="">Choose Personnel...</option>
                    {colleagues.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2">Justification</label>
                  <textarea
                  required
                  placeholder="Reason for temporal shift..."
                  className="w-full bg-slate-900/50 border border-white/10 rounded-2xl py-4 px-6 text-xs font-bold text-white tracking-widest focus:border-indigo-500/50 focus:outline-none transition-colors min-h-[100px]"
                  value={form.reason}
                  onChange={e => setForm({ ...form, reason: e.target.value })}
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !form.assignmentId || !form.toUserId}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl py-5 text-sm font-black uppercase tracking-[0.3em] transition-all transform active:scale-95 shadow-xl shadow-indigo-950/20 disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {submitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Transmit Request
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}