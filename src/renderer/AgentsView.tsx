import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Activity, Zap, Cpu, Users } from 'lucide-react';

interface AgentStatus {
  role: string;
  status: 'IDLE' | 'THINKING' | 'EXECUTING' | 'FAILED';
  lastAction?: string;
  group: 'ANALYST' | 'DIPLOMAT' | 'SENTINEL' | 'EXPLORER' | 'CORE';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

const GROUP_COLORS = {
  CORE: 'border-slate-700 bg-slate-900/40 text-slate-300',
  ANALYST: 'border-violet-500/30 bg-violet-500/5 text-violet-400',
  DIPLOMAT: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400',
  SENTINEL: 'border-blue-500/30 bg-blue-500/5 text-blue-400',
  EXPLORER: 'border-orange-500/30 bg-orange-500/5 text-orange-400',
};

const GROUP_ICONS = {
  CORE: <Cpu size={14} />,
  ANALYST: <Zap size={14} />,
  DIPLOMAT: <Shield size={14} />,
  SENTINEL: <Activity size={14} />,
  EXPLORER: <Users size={14} />,
};

interface AgentsViewProps {
  swarmStatus: AgentStatus[];
}

const AgentsView: React.FC<AgentsViewProps> = ({ swarmStatus }) => {
  // Sort by group then role
  const sortedSwarm = [...swarmStatus].sort((a, b) => {
    if (a.group !== b.group) return a.group.localeCompare(b.group);
    return a.role.localeCompare(b.role);
  });

  return (
    <div className="h-full flex flex-col gap-8 overflow-y-auto pr-2 pb-12 scrollbar-hide">
      
      {/* ── Population Metrics ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard label="Active Swarm" value={swarmStatus.length} sub="Nodes Online" icon={<Users />} />
        <MetricCard label="Hive Density" value={swarmStatus.filter(s => s.status === 'THINKING').length} sub="Threads Busy" icon={<Activity />} />
        <MetricCard label="MBTI Groups" value={5} sub="Cognitive Layers" icon={<Shield />} />
        <MetricCard label="Hallucination Guard" value="Active" sub="Constraint Mode" icon={<Zap />} color="text-emerald-500" />
      </div>

      {/* ── Swarm Composition Census ────────────────────────────────────────── */}
      <div className="bg-slate-900/40 border border-slate-800/60 rounded-3xl p-6 flex flex-wrap gap-3">
        {Object.entries(
          swarmStatus.reduce((acc: Record<string, number>, s) => {
            const base = s.role.split('_')[0]; // Handle clones
            acc[base] = (acc[base] || 0) + 1;
            return acc;
          }, {})
        ).map(([role, count]) => (
          <div key={role} className="flex items-center gap-2 bg-black/30 border border-white/5 px-3 py-1.5 rounded-xl hover:border-emerald-500/30 transition-all group">
            <span className="text-[10px] font-black text-slate-500 group-hover:text-emerald-500 transition-colors uppercase tracking-widest">{role}</span>
            <span className="w-5 h-5 flex items-center justify-center bg-emerald-500/10 rounded-lg text-[10px] font-black text-emerald-500 border border-emerald-500/20">{count}</span>
          </div>
        ))}
      </div>

      {/* ── Agent Grid ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sortedSwarm.map((agent) => (
          <motion.div
            key={agent.role}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`p-5 rounded-3xl border transition-all duration-500 ${GROUP_COLORS[agent.group]} ${
              agent.status === 'THINKING' ? 'ring-2 ring-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.1)] scale-105' : ''
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40 mb-1">{agent.group}</span>
                <h4 className="text-sm font-black tracking-tight">{agent.role}</h4>
              </div>
              <div className={`p-2 rounded-xl bg-black/20 ${agent.status === 'THINKING' ? 'text-emerald-400' : 'opacity-40'}`}>
                {GROUP_ICONS[agent.group]}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-500">Status</span>
                <span className={`text-[10px] font-black uppercase tracking-widest ${
                  agent.status === 'THINKING' ? 'text-emerald-500 animate-pulse' : agent.status === 'FAILED' ? 'text-red-500' : 'text-slate-600'
                }`}>
                  {agent.status}
                </span>
              </div>

              <div className="h-1 w-full bg-black/20 rounded-full overflow-hidden">
                {agent.status === 'THINKING' && (
                  <motion.div
                    initial={{ x: '-100%' }}
                    animate={{ x: '100%' }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                    className="h-full w-1/3 bg-emerald-500"
                  />
                )}
              </div>

              <p className="text-[10px] text-slate-500 truncate lowercase font-mono">
                {agent.lastAction || 'Awaiting engagement...'}
              </p>

              {/* Metabolic Stats */}
              {agent.usage && agent.usage.totalTokens > 0 && (
                <div className="flex justify-between items-center pt-2 border-t border-white/5 opacity-60 group-hover:opacity-100 transition-opacity">
                  <div className="flex gap-2">
                    <span className="text-[8px] font-mono text-slate-600">P:{agent.usage.promptTokens}</span>
                    <span className="text-[8px] font-mono text-slate-600">C:{agent.usage.completionTokens}</span>
                  </div>
                  <span className="text-[9px] font-black text-emerald-500/80 tracking-tighter">Σ {agent.usage.totalTokens}</span>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

    </div>
  );
};

const MetricCard: React.FC<{ label: string; value: string | number; sub: string; icon: React.ReactNode; color?: string }> = ({ label, value, sub, icon, color = 'text-slate-200' }) => (
  <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-3xl flex items-center gap-5">
    <div className="p-3 bg-black/20 rounded-2xl text-slate-500">
      {icon}
    </div>
    <div>
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-600">{label}</p>
      <div className="flex items-baseline gap-2">
        <h3 className={`text-2xl font-black tracking-tighter ${color}`}>{value}</h3>
        <span className="text-[9px] font-bold text-slate-500 uppercase">{sub}</span>
      </div>
    </div>
  </div>
);

export default AgentsView;
