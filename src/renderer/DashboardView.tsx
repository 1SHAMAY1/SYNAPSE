import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Activity, Brain, Database, Zap, Terminal, Shield } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface Metrics {
  l0?: number;
  l1: number;
  l2: number;
  l3: number;
  chat?: number;
  total: number;
}

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

interface Thought {
  role: string;
  content: string;
  type: 'THINK' | 'COMM' | 'ACTION';
  timestamp: number;
}

interface DashboardProps {
  metrics: Metrics;
  thoughts: Thought[];
  swarmStatus: AgentStatus[];
  velocity?: number;
  duration?: number;
}

const DashboardView: React.FC<DashboardProps> = ({ metrics, thoughts, swarmStatus, velocity, duration }) => {
  const getIpc = () => (window as any).ipcRenderer;
  const traceEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    traceEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [thoughts]);


  const chartData = {
    labels: ['L0 (Session Log)', 'L1 (Context)', 'L2 (Consolidated)', 'L3 (Synaptic)'],
    datasets: [
      {
        label: 'Entries',
        data: [metrics.chat || 0, metrics.l1, metrics.l2, metrics.l3],
        backgroundColor: [
          'rgba(59, 130, 246, 0.4)', // Blue for L0
          'rgba(16, 185, 129, 0.6)',
          'rgba(52, 211, 153, 0.4)',
          'rgba(110, 231, 183, 0.2)',
        ],
        borderColor: '#10b981',
        borderWidth: 1,
        borderRadius: 8,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    scales: {
      y: { beginAtZero: true, grid: { display: false }, ticks: { color: '#64748b' } },
      x: { grid: { display: false }, ticks: { color: '#64748b' } }
    },
    plugins: {
      legend: { display: false },
    }
  };

  // ── Metabolic Accounting ──────────────────────────────────────────────
  const totalHiveTokens = swarmStatus.reduce((acc, s) => acc + (s.usage?.totalTokens || 0), 0);
  const providerUsage = swarmStatus.reduce((acc: any, s) => {
    const alias = s.status === 'FAILED' ? 'N/A' : s.role === 'COORDINATOR' ? 'PRIMARY' : 'HIVE';
    acc[alias] = (acc[alias] || 0) + (s.usage?.totalTokens || 0);
    return acc;
  }, {});

  const topConsumers = [...swarmStatus]
    .filter(s => (s.usage?.totalTokens || 0) > 0)
    .sort((a, b) => (b.usage?.totalTokens || 0) - (a.usage?.totalTokens || 0))
    .slice(0, 5);

  return (
    <div className="h-full flex flex-col gap-6 overflow-y-auto pr-2 pb-8 scrollbar-hide">
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tier Metrics */}
        <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-emerald-500/10 rounded-2xl">
              <BarChart className="text-emerald-500" size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight text-slate-100">Knowledge Hierarchy</h3>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Agent Context Distribution</p>
            </div>
          </div>
          <div className="h-64">
            <Bar data={chartData} options={chartOptions} />
          </div>
        </div>

        {/* Efficiency Stats */}
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-3xl p-8 flex flex-col justify-between">
          <div className="flex items-center gap-4 mb-4">
            <Shield className="text-emerald-500" size={24} />
            <h3 className="text-sm font-bold uppercase tracking-wider">System Autonomy</h3>
          </div>
          
          <div className="space-y-6">
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Context Density</p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-bold tracking-tight text-emerald-500">
                  {metrics.l2 > 0 ? (metrics.l2 / (metrics.l1 + 1)).toFixed(1) : '1.0'}x
                </span>
                <span className="text-[10px] text-slate-500 pb-1 uppercase font-bold tracking-wider leading-none">Compression</span>
              </div>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: `${Math.min((metrics.l2 / (metrics.l1 + 1)) * 100, 100)}%` }}
                 className="h-full bg-emerald-500" 
               />
            </div>
            <p className="text-[10px] text-emerald-500/60 leading-relaxed italic font-medium">
              * Dynamic Context Optimization is active. Local data fragments are recursively consolidated into high-density knowledge nodes to ensure long-term retrieval performance.
            </p>
          </div>
        </div>
      </div>

      {/* Metabolic Velocity & Efficiency Card */}
      <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/5 border border-emerald-500/20 rounded-3xl p-8 backdrop-blur-xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-2xl">
              <Zap className="text-emerald-500" size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight text-emerald-400">Processing Throughput</h3>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold tracking-wider">System Operational Efficiency</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Efficiency Rating</span>
            <div className="text-2xl font-black text-emerald-500">{(velocity && velocity > 500) ? 'EXCELLENT' : (velocity && velocity > 200) ? 'NOMINAL' : 'AWAITING RUN'}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-black/20 border border-white/5 p-6 rounded-2xl">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Throughput Velocity</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-white tabular-nums">{velocity || 0}</span>
              <span className="text-xs text-emerald-500 font-bold">TPS</span>
            </div>
            <p className="text-[9px] text-slate-600 mt-2 uppercase">Tokens Per Second (Composite Swarm)</p>
          </div>

          <div className="bg-black/20 border border-white/5 p-6 rounded-2xl">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Average Response</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-white tabular-nums tracking-tight">{duration?.toFixed(1) || '0.0'}</span>
              <span className="text-xs text-blue-500 font-bold uppercase tracking-wider">Seconds</span>
            </div>
            <p className="text-[9px] text-slate-600 mt-2 uppercase">Mean Latency Per Node</p>
          </div>

          <div className="bg-black/20 border border-white/5 p-6 rounded-2xl">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Spawning Factor</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-white tabular-nums">{swarmStatus.length}</span>
              <span className="text-xs text-amber-500 font-bold">NODES</span>
            </div>
            <p className="text-[9px] text-slate-600 mt-2 uppercase">Concurrent Lifecycle Slots</p>
          </div>
        </div>
      </div>

      {/* Metabolic Consumption Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl">
          <div className="flex items-center gap-4 mb-6">
            <Zap className="text-amber-500" size={20} />
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Metabolic Consumption</h3>
          </div>
          <div className="space-y-4">
            {Object.entries(providerUsage).map(([alias, usage]: any) => (
              <div key={alias} className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{alias}</span>
                <div className="flex-1 mx-4 h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500/40" style={{ width: `${(usage / (totalHiveTokens || 1)) * 100}%` }} />
                </div>
                <span className="text-[10px] font-mono text-amber-500 font-bold">{usage.toLocaleString()} tkn</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl">
          <div className="flex items-center gap-4 mb-6">
            <Activity className="text-emerald-500" size={20} />
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Node Leaderboard (Top Consumers)</h3>
          </div>
          <div className="space-y-3">
            {topConsumers.map((node, i) => (
              <div key={node.role} className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <span className="text-[9px] font-black text-slate-700">0{i+1}</span>
                  <span className="text-[10px] font-bold text-slate-300 group-hover:text-emerald-400 transition-colors uppercase tracking-tighter">{node.role}</span>
                </div>
                <div className="flex gap-4 items-center">
                  <span className="text-[8px] font-mono text-slate-600">P:{node.usage?.promptTokens} / C:{node.usage?.completionTokens}</span>
                  <span className="text-[10px] font-black text-emerald-500/60 font-mono">Σ {node.usage?.totalTokens}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Swarm Trace */}
      <div className="bg-slate-950 border border-slate-900 rounded-3xl flex flex-col h-96">
        <div className="p-6 border-b border-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Terminal className="text-slate-500" size={20} />
            <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400">Swarm Activity Trace</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Live Telemetry</span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-3 font-mono text-[10px] uppercase tracking-wider scrollbar-hide">
          {thoughts.length === 0 && (
            <div className="h-full flex items-center justify-center opacity-20">
              Awaiting Swarm Initialization...
            </div>
          )}
          {thoughts.map((t, i) => (
            <div key={i} className="flex gap-4 items-start border-l border-slate-800 pl-4 py-1">
              <span className="text-slate-600 w-16">{new Date(t.timestamp).toLocaleTimeString([], { hour12: false })}</span>
              <span className={`font-black ${t.role === 'COORDINATOR' ? 'text-emerald-500' : 'text-slate-400'}`}>[{t.role}]</span>
              <span className={`${t.type === 'COMM' ? 'text-blue-400 italic' : t.type === 'ACTION' ? 'text-emerald-400' : 'text-slate-500'}`}>
                {t.content}
              </span>
            </div>
          ))}
          <div ref={traceEndRef} />
        </div>
      </div>

    </div>
  );
};

export default DashboardView;
