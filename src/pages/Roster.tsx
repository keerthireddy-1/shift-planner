import React, { useState, useEffect } from 'react';
import { 
  format, 
  startOfWeek, 
  addDays, 
  eachDayOfInterval, 
  isSameDay 
} from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import { Assignment, ShiftTemplate, User } from '../types';
import { Plus, ChevronLeft, ChevronRight, Wand2, Trash2, Repeat, Box, Zap, Umbrella } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { INDIAN_HOLIDAYS, getDayInfo } from '../constants';

export function Roster() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [isAutoScheduling, setIsAutoScheduling] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ userId: string, date: Date } | null>(null);
  const [assigningLoading, setAssigningLoading] = useState(false);

  const start = startOfWeek(currentDate, { weekStartsOn: 1 });
  const end = addDays(start, 6);
  const weekDays = eachDayOfInterval({ start, end });

  const fetchData = async () => {
    try {
      const query = user?.department ? `?department=${user.department}` : '';
      const [usrRes, tplRes, asnRes] = await Promise.all([
        fetch(`/api/users${query}`).then(r => r.json()),
        fetch('/api/templates').then(r => r.json()),
        fetch(`/api/assignments${query}`).then(r => r.json())
      ]);
      setEmployees(usrRes);
      setTemplates(tplRes);
      setAssignments(asnRes);
    } catch (e) {
      console.error("Failed to fetch roster data", e);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const handleAutoSchedule = async () => {
    if (!user || user.role !== 'admin') return;
    setIsAutoScheduling(true);
    try {
      const response = await fetch('/api/generate-roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: format(start, 'yyyy-MM-dd'),
          endDate: format(end, 'yyyy-MM-dd'),
          department: user.department
        })
      });
      const generated = await response.json();
      setAssignments(prev => [...prev, ...generated]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsAutoScheduling(false);
    }
  };

  const handleManualAssign = async (shiftId: string) => {
    if (!user || user.role !== 'admin' || !selectedCell) return;
    
    setAssigningLoading(true);
    try {
      // Overwrite logic: check for existing assignment for this user on this date
      const dateStr = format(selectedCell.date, 'yyyy-MM-dd');
      const existing = assignments.find(a => a.userId === selectedCell.userId && a.date === dateStr);
      
      if (existing) {
        await fetch(`/api/assignments/${existing.id}`, { method: 'DELETE' });
      }

      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedCell.userId,
          shiftId,
          date: dateStr
        })
      });
      const newItem = await res.json();
      setAssignments(prev => {
        const filtered = prev.filter(a => !(a.userId === selectedCell.userId && a.date === dateStr));
        return [...filtered, newItem];
      });
      setIsManualModalOpen(false);
      setSelectedCell(null);
    } catch (e) {
      console.error("Manual assign failed", e);
    } finally {
      setAssigningLoading(false);
    }
  };

  const removeAssignment = async (id: string) => {
    try {
      await fetch(`/api/assignments/${id}`, { method: 'DELETE' });
      setAssignments(prev => prev.filter(a => a.id !== id));
    } catch (e) {
      console.error("Failed to delete assignment", e);
    }
  };

  const getAssignmentsForCell = (userId: string, date: Date) => {
    return assignments.filter(a => a.userId === userId && a.date === format(date, 'yyyy-MM-dd'));
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-full h-full flex flex-col gap-8 perspective-container"
    >
      <header className="flex items-end justify-between px-2">
        <div className="flex items-center gap-6">
          <div className="w-14 h-14 glass-morphism rounded-2xl flex items-center justify-center text-indigo-400 shadow-xl shadow-indigo-500/10 border-indigo-500/20">
             <Box className="w-8 h-8" />
          </div>
          <div>
             <h2 className="text-3xl font-black tracking-tighter text-white">ORCHESTRATION <span className="text-slate-600 font-normal">/ HUB</span></h2>
             <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-indigo-500/80 flex items-center gap-2">
               <Zap className="w-3 h-3" /> Real-time Synthesis Active
             </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex bg-slate-900/80 border border-white/5 rounded-2xl p-1 shadow-2xl backdrop-blur-md">
            <button 
              onClick={() => setCurrentDate(addDays(currentDate, -7))}
              className="p-3 hover:bg-white/5 rounded-xl transition-all hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setCurrentDate(new Date())}
              className="px-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-white transition-colors"
            >
              Sync Today
            </button>
            <button 
              onClick={() => setCurrentDate(addDays(currentDate, 7))}
              className="p-3 hover:bg-white/5 rounded-xl transition-all hover:text-white"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {user?.role === 'admin' && (
            <button
              onClick={handleAutoSchedule}
              disabled={isAutoScheduling}
              className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-3 transition-all shadow-xl shadow-indigo-950/20 disabled:opacity-50"
            >
              <Wand2 className={cn("w-4 h-4", isAutoScheduling && "animate-spin")} />
              {isAutoScheduling ? 'Synthesizing...' : 'Run Auto-fill'}
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 min-h-0 glass-morphism rounded-[2.5rem] overflow-hidden flex flex-col shadow-inner">
        <div className="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
             <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">
               Cycle: {format(start, 'dd MMM')} — {format(end, 'dd MMM yyyy')}
             </span>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse table-fixed min-w-[1200px]">
            <thead className="sticky top-0 z-20">
              <tr className="bg-slate-900/90 backdrop-blur-md">
                <th className="w-72 p-6 text-left border-r border-white/5 font-black text-[10px] uppercase tracking-[0.3em] text-slate-500">Personnel Core</th>
                {weekDays.map(day => {
                  const dayInfo = getDayInfo(day);
                  return (
                    <th key={day.toISOString()} className={cn(
                      "p-6 text-center border-r border-white/5 last:border-0",
                      dayInfo.isNonWorking && "bg-amber-500/5"
                    )}>
                      <div className={cn(
                        "text-[10px] uppercase font-black tracking-[0.2em] mb-2",
                        dayInfo.isNonWorking ? "text-amber-500" : "text-slate-400"
                      )}>
                        {format(day, 'EEE d')}
                        {dayInfo.isNonWorking && <Umbrella className="w-3 h-3 inline ml-2" />}
                      </div>
                      {isSameDay(day, new Date()) && (
                        <motion.div layoutId="current-day" className="h-1 w-8 bg-indigo-500 mx-auto rounded-full mt-1 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <AnimatePresence mode="popLayout">
                {employees
                  .filter(emp => user?.role === 'admin' ? true : emp.id === user?.id)
                  .map(emp => (
                  <motion.tr 
                    key={emp.id} 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="group hover:bg-white/5 transition-colors"
                  >
                    <td className="p-6 border-r border-white/5 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xs border perspective-container",
                          emp.role === 'admin' ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400" : "bg-slate-800/50 border-white/10 text-slate-400"
                        )}>
                          <motion.span whileHover={{ rotateY: 180 }}>{emp.name.charAt(0)}</motion.span>
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-100 tracking-tight">{emp.name}</p>
                          <p className="text-[9px] text-slate-600 uppercase font-black tracking-widest">{emp.department}</p>
                        </div>
                      </div>
                    </td>
                    {weekDays.map(day => {
                      const dayAssignments = getAssignmentsForCell(emp.id, day);
                      const dayInfo = getDayInfo(day);
                      
                      return (
                        <td key={day.toISOString()} className={cn(
                          "p-4 border-r border-white/5 last:border-0 relative h-40 align-top group/cell",
                          dayInfo.isNonWorking && "bg-amber-500/[0.02]"
                        )}>
                          <div className="flex flex-col gap-3 h-full">
                            {dayAssignments.map(assign => {
                              const tpl = templates.find(t => t.id === assign.shiftId);
                              return (
                                <motion.div 
                                  layoutId={assign.id}
                                  key={assign.id}
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="p-3 rounded-2xl text-[10px] font-black border-l-4 shadow-2xl glass-morphism flex flex-col gap-2 group/item hover:scale-105 transition-transform relative z-10"
                                  style={{ 
                                    borderLeftColor: tpl?.color || '#334155', 
                                  }}
                                >
                                  <div className="flex justify-between items-start">
                                    <span className="truncate uppercase tracking-wider text-white">{tpl?.name || 'SHIFT'}</span>
                                    {user?.role === 'admin' ? (
                                      <button 
                                        onClick={() => removeAssignment(assign.id)}
                                        className="opacity-0 group-hover/item:opacity-100 text-slate-600 hover:text-rose-500 transition-all"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    ) : (
                                      <button className="opacity-0 group-hover/item:opacity-100 text-slate-600 hover:text-indigo-400 transition-all">
                                        <Repeat className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-slate-500 font-mono">
                                    <span className="w-1 h-1 bg-slate-700 rounded-full" />
                                    {tpl?.startTime} - {tpl?.endTime}
                                  </div>
                                </motion.div>
                              );
                            })}
                            
                            {user?.role === 'admin' && (
                              <button 
                                onClick={() => {
                                  setSelectedCell({ userId: emp.id, date: day });
                                  setIsManualModalOpen(true);
                                }}
                                className={cn(
                                  "absolute top-2 right-2 w-6 h-6 rounded-full bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center opacity-0 group-hover/cell:opacity-100 hover:bg-indigo-600 hover:text-white transition-all z-20 shadow-lg",
                                  dayAssignments.length > 0 && "bg-white/10 text-white border-white/20"
                                )}
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            )}
                            
                            {dayAssignments.length === 0 && (
                              <div className="flex-1 flex flex-col items-center justify-center gap-2">
                                {dayInfo.isNonWorking ? (
                                  <>
                                    <Umbrella className="w-4 h-4 text-amber-500/30" />
                                    <span className="text-[8px] font-black text-amber-500/50 uppercase tracking-widest">{dayInfo.label}</span>
                                  </>
                                ) : (
                                  <span className="text-[9px] text-slate-800 font-black uppercase tracking-[0.3em]">
                                    {user?.role === 'admin' ? 'Awaiting Protocol' : 'OFF-LINE'}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>
      <ManualAssignModal 
        isOpen={isManualModalOpen}
        onClose={() => {
          setIsManualModalOpen(false);
          setSelectedCell(null);
        }}
        onAssign={handleManualAssign}
        templates={templates}
        loading={assigningLoading}
        selectedDate={selectedCell?.date}
        employeeName={employees.find(e => e.id === selectedCell?.userId)?.name}
      />
    </motion.div>
  );
}

function ManualAssignModal({ isOpen, onClose, onAssign, templates, loading, selectedDate, employeeName }: any) {
  const [selectedShift, setSelectedShift] = useState('');

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-full max-w-md glass-morphism rounded-[2.5rem] p-10 relative overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
          >
            <div className="mb-8">
              <h3 className="text-3xl font-black tracking-tighter text-white uppercase mb-2">Protocol <span className="text-indigo-400">Override</span></h3>
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Manual Shift Injection System</p>
            </div>

            <div className="space-y-6">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Personnel</span>
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Temporal Frame</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-white">{employeeName}</span>
                  <span className="text-sm font-bold text-indigo-400">{selectedDate ? format(selectedDate, 'MMM d, yyyy') : ''}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2">Select Shift Template</label>
                <div className="grid gap-3">
                  {templates.map((tpl: any) => (
                    <button
                      key={tpl.id}
                      onClick={() => setSelectedShift(tpl.id)}
                      className={cn(
                        "p-4 rounded-2xl border text-left transition-all group relative overflow-hidden",
                        selectedShift === tpl.id 
                          ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20" 
                          : "bg-slate-900/50 border-white/5 text-slate-400 hover:border-white/20"
                      )}
                    >
                      <div className="flex justify-between items-center relative z-10">
                        <div>
                          <p className="text-xs font-black uppercase tracking-widest">{tpl.name}</p>
                          <p className="text-[10px] font-mono opacity-60 mt-1">{tpl.startTime} - {tpl.endTime}</p>
                        </div>
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tpl.color }} />
                      </div>
                      {selectedShift === tpl.id && (
                        <motion.div 
                          layoutId="active-bg"
                          className="absolute inset-0 bg-indigo-600 z-0"
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={onClose}
                  className="flex-1 px-6 py-4 rounded-2xl bg-white/5 border border-white/5 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  Abort
                </button>
                <button
                  onClick={() => onAssign(selectedShift)}
                  disabled={loading || !selectedShift}
                  className="flex-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-950/20 disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {loading ? (
                     <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      Commit Change
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}