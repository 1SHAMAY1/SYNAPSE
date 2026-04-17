import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Hash, Trash2, ChevronRight } from 'lucide-react';

interface Session {
  id: number;
  name: string;
  timestamp: number;
}

interface SessionRailProps {
  sessions: Session[];
  activeSessionId: number;
  onSwitch: (id: number) => void;
  onCreate: () => void;
  onDelete: (id: number) => void;
}

const SessionRail: React.FC<SessionRailProps> = ({ sessions, activeSessionId, onSwitch, onCreate, onDelete }) => {
  return (
    <div className="w-[70px] bg-black border-r border-slate-900 h-full flex flex-col items-center py-8 gap-6 z-50 pointer-events-auto">
      
      {/* ── New Session Cluster ── */}
      <motion.button
        whileHover={{ scale: 1.1, rotate: 90 }}
        whileTap={{ scale: 0.9 }}
        onClick={onCreate}
        className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 hover:bg-emerald-500 hover:text-black transition-all shadow-[0_0_15px_rgba(16,185,129,0.1)]"
        title="Initialize New Session"
      >
        <Plus size={18} strokeWidth={3} />
      </motion.button>

      <div className="w-8 h-[1px] bg-slate-900" />

      {/* ── Session List ── */}
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto scrollbar-hide w-full items-center">
        <AnimatePresence>
          {sessions.map((session) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="relative group"
            >
              <button
                onClick={() => onSwitch(session.id)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 relative ${
                  activeSessionId === session.id 
                    ? 'bg-slate-800 text-emerald-400 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]' 
                    : 'bg-slate-900/40 text-slate-700 hover:text-slate-400 hover:bg-slate-950 border border-transparent'
                }`}
                title={`Switch to Session: ${session.name}`}
              >
                <Hash size={16} strokeWidth={activeSessionId === session.id ? 2.5 : 1.5} />
                {activeSessionId === session.id && (
                  <motion.div layoutId="session-dot" className="absolute -left-4 top-1/2 -translate-y-1/2 w-1 h-4 bg-emerald-500 rounded-full" />
                )}
              </button>

              {/* ── Session Name Tooltip/Label ── */}
              <div className="absolute left-14 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900 border border-slate-800 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all shadow-2xl z-50">
                {session.name}
              </div>

              {/* ── Delete Action (Only for non-default) ── */}
              {session.id !== 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500/20 border border-red-500/40 text-red-500 opacity-0 group-hover:opacity-100 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all scale-75 group-hover:scale-100"
                  title="Archive Session"
                >
                  <Trash2 size={8} />
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="w-8 h-[1px] bg-slate-900 mt-auto" />
      <div className="p-3 bg-black/40 rounded-xl text-slate-800">
        <ChevronRight size={14} />
      </div>
    </div>
  );
};

export default SessionRail;
