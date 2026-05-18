import React, { useState, useEffect } from 'react';
import { format, startOfWeek, addDays, eachDayOfInterval, isSameDay } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import { Assignment, ShiftTemplate, User } from '../types';
import { Clock, Calendar, AlertCircle, Box, Zap, MapPin, X, Send, UserCircle, Umbrella } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { INDIAN_HOLIDAYS, getDayInfo } from '../constants';

export function EmployeeSchedule() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [colleagues, setColleagues] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [swapForm, setSwapForm] = useState({ toUserId: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tplRes, asnRes, userRes] = await Promise.all([
          fetch('/api/templates').then(r => r.json()),
          fetch(`/api/assignments?department=${user?.department}`).then(r => r.json()),
          fetch(`/api/users?department=${user?.department}`).then(r => r.json())
        ]);
        setTemplates(tplRes);
        setAssignments(asnRes.filter((a: Assignment) => a.userId === user?.id));
        setColleagues(userRes.filter((u: User) => u.id !== user?.id));
      } catch (e) {
        console.error(e);
      }
    };
    if (user) fetchData();
  }, [user]);

  const handleSwapInit = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setIsModalOpen(true);
  };

  const handleSwapSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment || !swapForm.toUserId) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/swaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId: user?.id,
          toUserId: swapForm.toUserId,
          assignmentId: selectedAssignment.id,
          reason: swapForm.reason
        })
      });
      if (res.ok) {
        setIsModalOpen(false);
        setSwapForm({ toUserId: '', reason: '' });
        // Optionally show success toast
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const today = new Date();
  const start = startOfWeek(today, { weekStartsOn: 1 });
  const end = addDays(start, 14); // View 2 weeks
  const days = eachDayOfInterval({ start, end });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-10"
    >
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-5xl font-black tracking-tighter text-white mb-2 uppercase">My <span className="text-indigo-500">Protocol</span></h1>
          <p className="text-slate-500 font-mono text-[10px] uppercase tracking-[0.4em]">Personal Temporal Allocation Grid</p>
        </div>
        <div className="flex glass-morphism rounded-2xl p-1">
          <div className="px-6 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 rounded-xl border border-indigo-500/20 flex items-center gap-2">
            <Zap className="w-3 h-3 animate-pulse" /> Live Sync
          </div>
        </div>
      </header>

      <div className="grid gap-6">
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayAssignments = assignments.filter(a => a.date === dateStr);
          const isToday = isSameDay(day, today);
          const dayInfo = getDayInfo(day);

          return (
            <motion.div 
              key={day.toISOString()}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                "glass-morphism rounded-[2rem] p-8 flex items-center justify-between group relative overflow-hidden transition-all",
                isToday && "border-indigo-500/30 scale-[1.02] shadow-indigo-500/10 shadow-2xl",
                dayInfo.isNonWorking && "border-amber-500/20 bg-amber-500/[0.02]"
              )}
            >
              {isToday && (
                <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500" />
              )}
              {dayInfo.isNonWorking && (
                <div className="absolute top-0 right-0 p-4">
                   <Umbrella className="w-5 h-5 text-amber-500/20" />
                </div>
              )}

              <div className="flex items-center gap-10">
                <div className="text-center min-w-[80px]">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600 mb-1">{format(day, 'EEE')}</p>
                  <p className={cn(
                    "text-3xl font-black tracking-tighter",
                    isToday ? "text-indigo-400" : dayInfo.isNonWorking ? "text-amber-500" : "text-white"
                  )}>{format(day, 'd')}</p>
                  <p className="text-[9px] font-bold uppercase text-slate-700">{format(day, 'MMM')}</p>
                </div>

                <div className="h-12 w-[1px] bg-white/5" />

                <div className="space-y-4">
                  {dayInfo.isNonWorking ? (
                    <div className="flex items-center gap-3 text-amber-500/70">
                       <Umbrella className="w-4 h-4" />
                       <span className="text-[10px] font-black uppercase tracking-[0.4em]">{dayInfo.label}</span>
                    </div>
                  ) : dayAssignments.length > 0 ? (
                    dayAssignments.map(assign => {
                      const tpl = templates.find(t => t.id === assign.shiftId);
                      return (
                        <div key={assign.id} className="flex items-center gap-8">
                           <div className="flex flex-col">
                              <span className="text-sm font-black text-white uppercase tracking-tight">{tpl?.name || 'Shift'}</span>
                              <span className="text-xs font-mono text-slate-500">{tpl?.startTime} — {tpl?.endTime}</span>
                           </div>
                           <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-lg border border-white/5">
                                <Clock className="w-3 h-3 text-slate-600" />
                                <span className="text-[9px] font-black text-slate-400">8.0H</span>
                              </div>
                              <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-lg border border-white/5">
                                <MapPin className="w-3 h-3 text-slate-600" />
                                <span className="text-[9px] font-black text-slate-400 uppercase">{user?.department}</span>
                              </div>
                           </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex items-center gap-3 text-slate-700">
                       <AlertCircle className="w-4 h-4" />
                       <span className="text-[10px] font-black uppercase tracking-[0.4em]">Operational Standby (Off)</span>
                    </div>
                  )}
                </div>
              </div>

              {dayAssignments.length > 0 && (
                <button 
                  onClick={() => handleSwapInit(dayAssignments[0])}
                  className="px-6 py-3 bg-slate-900 border border-white/5 text-slate-500 rounded-2xl text-[9px] font-black tracking-widest uppercase hover:text-white hover:border-indigo-500/30 transition-all"
                >
                  Swap Request
                </button>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Swap Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-md glass-morphism rounded-[2.5rem] p-10 relative overflow-hidden"
            >
              <button 
                onClick={() => setIsModalOpen(false)}
                className="absolute top-8 right-8 text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-8">
                <h3 className="text-3xl font-black tracking-tighter text-white uppercase mb-2">Initialize <span className="text-indigo-400">Swap</span></h3>
                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Protocol Reassignment Request</p>
              </div>

              <form onSubmit={handleSwapSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2">Select Target Colleague</label>
                  <div className="relative">
                    <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                    <select
                      required
                      className="w-full bg-slate-900/50 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-xs font-bold text-white uppercase tracking-widest focus:border-indigo-500/50 focus:outline-none transition-colors appearance-none"
                      value={swapForm.toUserId}
                      onChange={e => setSwapForm({ ...swapForm, toUserId: e.target.value })}
                    >
                      <option value="">Choose Personnel...</option>
                      {colleagues.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                   <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2">Reason for Mutation</label>
                   <textarea
                    required
                    placeholder="Enter justification for temporal shift..."
                    className="w-full bg-slate-900/50 border border-white/10 rounded-2xl py-4 px-6 text-xs font-bold text-white tracking-widest focus:border-indigo-500/50 focus:outline-none transition-colors min-h-[100px]"
                    value={swapForm.reason}
                    onChange={e => setSwapForm({ ...swapForm, reason: e.target.value })}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || !swapForm.toUserId}
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
    </motion.div>
  );
}