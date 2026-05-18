import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Calendar, Layers } from 'lucide-react';

export const Splash = ({ onComplete }: { onComplete: () => void }) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 2500); 

    const steps = [500, 1200, 2000];
    steps.forEach((t, i) => setTimeout(() => setStep(i + 1), t));

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[100] bg-bg-deep flex flex-center items-center justify-center overflow-hidden">
      {/* Background Particles Simulation */}
      <div className="absolute inset-0 opacity-20">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ 
              opacity: [0.2, 0.5, 0.2], 
              scale: [1, 1.2, 1],
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight 
            }}
            transition={{ duration: 5 + Math.random() * 5, repeat: Infinity }}
            className="absolute w-1 h-1 bg-indigo-500 rounded-full blur-[1px]"
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="pre"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
            className="text-center"
          >
            <div className="w-24 h-24 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-indigo-500/30">
              <Sparkles className="w-10 h-10 text-indigo-400 animate-pulse" />
            </div>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="title"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
            className="text-center"
          >
            <h1 className="text-6xl font-black tracking-tighter glow-text mb-4">
              SHIFT <span className="text-indigo-500">MASTER</span>
            </h1>
            <p className="text-slate-500 font-mono tracking-widest uppercase text-xs">Workforce Orchestration Engine</p>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="feature"
            initial={{ opacity: 0, rotateX: -45 }}
            animate={{ opacity: 1, rotateX: 0 }}
            exit={{ opacity: 0, rotateX: 45 }}
            transition={{ type: 'spring' }}
            className="flex flex-col items-center gap-6"
          >
            <div className="relative">
               <motion.div 
                 animate={{ rotateY: 360 }}
                 transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                 className="w-32 h-32 glass-morphism rounded-3xl flex items-center justify-center relative z-10"
               >
                 <Calendar className="w-12 h-12 text-emerald-400" />
               </motion.div>
               <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full" />
            </div>
            <div className="text-center">
               <h2 className="text-2xl font-bold text-slate-100 mb-1">Rule-Based Precision</h2>
               <p className="text-slate-500 text-sm max-w-xs">AI algorithms calculating optimal coverage in real-time</p>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="final"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
             <div className="flex gap-1 mb-8 justify-center">
                {[...Array(3)].map((_, i) => (
                  <motion.div 
                    key={i}
                    animate={{ height: [20, 60, 20] }}
                    transition={{ delay: i * 0.1, repeat: Infinity }}
                    className="w-2 bg-indigo-500 rounded-full"
                  />
                ))}
             </div>
             <h3 className="text-lg font-bold uppercase tracking-[0.3em] text-indigo-400 animate-pulse">Initialising Core...</h3>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};