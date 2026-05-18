import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import { SwapRequest, User, ShiftTemplate, Assignment } from '../types';
import { Repeat, Check, X, Clock, AlertTriangle, Plus, Loader2, Send, UserCircle, ShieldCheck } from 'lucide-react';
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
  const [conflictPopup, setConflictPopup] = useState<{ visible: boolean; shiftName: string }>({ visible: false, shiftName: '' });
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
    const isInvolved = swap.fromUserId === user?.id || swap.toUserId === user?.id;

    if (activeTab === 'active') {
      if (user?.role === 'admin') {
        return swap.status === 'peer_accepted';
      }
      if (swap.toUserId === user?.id) return swap.status === 'pending';
      if (swap.fromUserId === user?.id) return swap.status === 'pending' || swap.status === 'peer_accepted';
      return false;
    } else {
      const isResolved = swap.status === 'approved' || swap.status === 'rejected';
      if (user?.role === 'admin') return isResolved;
      return isResolved && isInvolved;
    }
  });

  const handlePeerAction = async (id: string, accepted: boolean) => {
    try {
      const res = await fetch(`/api/swaps/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: accepted ? 'peer_accepted' : 'rejected' })
      });
      if (res.ok) fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAdminAction = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const res = await fetch(`/api/swaps/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSwapSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!swapForm.assignmentId || !swapForm.toUserId || !swapForm.date) return;

    const myAssignment = myAssignments.find(a => a.id === swapForm.assignmentId);
    if (!myAssignment) return;

    const myAssignmentShiftId = myAssignment.shiftId;
    const myAssignmentDate = myAssignment.date;

    // Strict frontend conflict filter: Check if target coworker works ANY shift on this exact day
    const conflict = allAssignments.find(a =>
      String(a.userId) === String(swapForm.toUserId) &&
      a.date === myAssignmentDate
    );

    if (conflict) {
      const colleagueShiftName = templates.find(t => t.id === conflict.shiftId)?.name || 'another';

      // Dispatched background audit trace
      fetch('/api/swaps/rejected-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId: user?.id,
          toUserId: swapForm.toUserId,
          assignmentId: swapForm.assignmentId,
          date: myAssignmentDate,
          shiftId: myAssignmentShiftId,
          reason: `Frontend Error: Target system identity is already assigned to the ${colleagueShiftName} shift.`,
          rejectedAt: new Date().toISOString()
        })
      }).catch(console.error);

      // Force state setup to trigger popups safely
      setConflictPopup({ visible: true, shiftName: colleagueShiftName });
      setSubmitting(false);
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

      if (!res.ok) {
        const body = await res.json();
        if (res.status === 409) {
          // If fallback fails or backend catches a race condition conflict
          const matchedShift = allAssignments.find(a => String(a.userId) === String(swapForm.toUserId) && a.date === myAssignmentDate);
          const shiftName = templates.find(t => t.id === matchedShift?.shiftId)?.name || 'same';
          setConflictPopup({ visible: true, shiftName });
        } else {
          setError(body.error || 'Failed to submit swap request.');
        }
        return;
      }

      setIsModalOpen(false);
      setSwapForm({ assignmentId: '', date: '', toUserId: '', reason: '' });
      fetchData();
    } catch (e) {
      console.error(e);
      setError('Network error. Please try again.');
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
          const isPeerPending = swap.status === 'pending' && swap.toUserId === user?.id;
          const isAwaitingAdmin = swap.status === 'peer_accepted' && user?.role === 'admin';
          const isRequesterWaiting = swap.fromUserId === user?.id && (swap.status === 'pending' || swap.status === 'peer_accepted');

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
                  {swap.status === 'peer_accepted' && (
                    <div className="mt-3 flex items-center gap-2">
                      <Check className="w-3 h-3 text-emerald-500" />
                      <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Peer Accepted · Awaiting Admin Approval</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-6">
                {isPeerPending && (
                  <div className="flex gap-4">
                    <button
                      onClick={() => handlePeerAction(swap.id, true)}
                      className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-2xl border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center shadow-lg shadow-emerald-500/10"
                      title="Accept Swap"
                    >
                      <Check className="w-6 h-6" />
                    </button>
                    <button
                      onClick={() => handlePeerAction(swap.id, false)}
                      className="w-12 h-12 bg-rose-500/10 text-rose-500 rounded-2xl border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center shadow-lg shadow-rose-500/10"
                      title="Decline Swap"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                )}

                {isAwaitingAdmin && (
                  <div className="flex gap-4">
                    <button
                      onClick={() => handleAdminAction(swap.id, 'approved')}
                      className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-2xl border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center shadow-lg shadow-emerald-500/10"
                      title="Approve Swap"
                    >
                      <ShieldCheck className="w-6 h-6" />
                    </button>
                    <button
                      onClick={() => handleAdminAction(swap.id, 'rejected')}
                      className="w-12 h-12 bg-rose-500/10 text-rose-500 rounded-2xl border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center shadow-lg shadow-rose-500/10"
                      title="Reject Swap"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                )}

                {isRequesterWaiting && (
                  <div className="px-6 py-3 bg-slate-900 border border-white/5 text-slate-400 rounded-2xl text-[10px] font-black tracking-widest uppercase flex items-center gap-3">
                    <Clock className="w-4 h-4 animate-pulse" />
                    {swap.status === 'pending' ? 'Awaiting Peer' : 'Awaiting Admin'}
                  </div>
                )}

                {(swap.status === 'approved' || swap.status === 'rejected') && (
                  <div className={cn(
                    "px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border",
                    swap.status === 'approved'
                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-emerald-500/10"
                      : "bg-rose-500/10 text-rose-500 border-rose-500/20 shadow-rose-500/10"
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
        conflictPopup={conflictPopup}
        onDismissConflict={() => {
          setConflictPopup({ visible: false, shiftName: '' });
          setSwapForm(f => ({ ...f, toUserId: '' }));
        }}
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
  error,
  conflictPopup,
  onDismissConflict
}: any) {
  const colleagues = users.filter((u: any) => u.id !== currentUserId);
  const availableDates = [...new Set(assignments.map((a: any) => a.date))].sort();

  return (
    <>
      <AnimatePresence>
        {conflictPopup?.visible && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[999] bg-slate-950/75 backdrop-blur-sm"
            />
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 32 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 32 }}
                transition={{ type: 'spring', stiffness: 340, damping: 26 }}
                className="w-full max-w-sm bg-slate-900 border border-rose-500/30 rounded-[2rem] p-10 shadow-2xl shadow-rose-950/50 text-center relative overflow-hidden"
              >
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="w-16 h-16 mx-auto mb-6 rounded-3xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shadow-lg shadow-rose-500/10">
                  <AlertTriangle className="w-8 h-8 text-rose-400" />
                </div>

                <h3 className="text-xl font-black text-white uppercase tracking-tight mb-3">
                  Conflict <span className="text-rose-500">Detected</span>
                </h3>

                <p className="text-[10px] font-mono text-slate-400 uppercase tracking-[0.2em] leading-relaxed mb-8 text-center">
                  Selected personnel is already assigned to the{' '}
                  <span className="text-rose-400 font-black">{conflictPopup.shiftName}</span>{' '}
                  shift on this date.
                  <br /><br />
                  Please choose a different colleague.
                </p>

                <button
                  type="button"
                  onClick={onDismissConflict}
                  className="w-full py-4 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] transition-all shadow-lg shadow-rose-950/30"
                >
                  Choose Different Personnel
                </button>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

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
                type="button"
                onClick={onClose}
                className="absolute top-8 right-8 text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-8">
                <h3 className="text-3xl font-black tracking-tighter text-white uppercase mb-2">
                  Request <span className="text-indigo-400">Mutation</span>
                </h3>
                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                  Protocol Reassignment Request
                </p>
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
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2">
                    Select Date to Swap
                  </label>
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
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2">
                    Select Target Colleague
                  </label>
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
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2">
                    Justification
                  </label>
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
    </>
  );
}