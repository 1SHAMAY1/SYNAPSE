import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Settings, Database, Cpu, Send, Trash2, Shield, Box, X, Minus, BarChart, Copy, Check, Image, Users, Terminal, Activity, Square } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import DashboardView from './DashboardView';
import AgentsView from './AgentsView';
import SessionRail from './SessionRail';

const getIpc = () => (window as any).ipcRenderer;

interface Session {
  id: number;
  name: string;
  timestamp: number;
}

type AgentRole =
  | 'COORDINATOR' | 'RESEARCHER' | 'ARCHITECT' | 'CODER' | 'CRITIC'
  | 'INTJ' | 'INTP' | 'ENTJ' | 'ENTP'
  | 'INFJ' | 'INFP' | 'ENFJ' | 'ENFP'
  | 'ISTJ' | 'ISFJ' | 'ESTJ' | 'ESFJ'
  | 'ISTP' | 'ISFP' | 'ESTP' | 'ESFP';

interface Message {
  id?: number;
  role: string;
  content: string;
  imageData?: string;
  timestamp: number;
  hardened_to_id?: number;
  hardened_content?: string;
}

const AGENT_META: Record<AgentRole, { label: string; color: string; bg: string; border: string; icon: string }> = {
  RESEARCHER: { label: 'Researcher', color: 'text-cyan-400', bg: 'bg-cyan-500/5', border: 'border-cyan-500/20', icon: '📡' },
  ARCHITECT: { label: 'Architect', color: 'text-violet-400', bg: 'bg-violet-500/5', border: 'border-violet-500/20', icon: '🏗️' },
  CODER: { label: 'Coder', color: 'text-emerald-400', bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', icon: '⚙️' },
  CRITIC: { label: 'Critic', color: 'text-amber-400', bg: 'bg-amber-500/5', border: 'border-amber-500/20', icon: '🔍' },
  COORDINATOR: { label: 'Coordinator', color: 'text-slate-300', bg: 'bg-slate-800/60', border: 'border-slate-700', icon: '🧠' },
  INTJ: { label: 'INTJ · Architect', color: 'text-violet-300', bg: 'bg-violet-900/20', border: 'border-violet-500/25', icon: '♟️' },
  INTP: { label: 'INTP · Logician', color: 'text-violet-300', bg: 'bg-violet-900/20', border: 'border-violet-500/25', icon: '🔭' },
  ENTJ: { label: 'ENTJ · Commander', color: 'text-violet-300', bg: 'bg-violet-900/20', border: 'border-violet-500/25', icon: '⚡' },
  ENTP: { label: 'ENTP · Debater', color: 'text-violet-300', bg: 'bg-violet-900/20', border: 'border-violet-500/25', icon: '💡' },
  INFJ: { label: 'INFJ · Advocate', color: 'text-teal-300', bg: 'bg-teal-900/20', border: 'border-teal-500/25', icon: '🌿' },
  INFP: { label: 'INFP · Mediator', color: 'text-teal-300', bg: 'bg-teal-900/20', border: 'border-teal-500/25', icon: '🕊️' },
  ENFJ: { label: 'Protagonist', color: 'text-teal-300', bg: 'bg-teal-900/20', border: 'border-teal-500/25', icon: '🌟' },
  ENFP: { label: 'Campaigner', color: 'text-teal-300', bg: 'bg-teal-900/20', border: 'border-teal-500/25', icon: '🎨' },
  ISTJ: { label: 'Logistician', color: 'text-blue-300', bg: 'bg-blue-900/20', border: 'border-blue-500/25', icon: '📋' },
  ISFJ: { label: 'Defender', color: 'text-blue-300', bg: 'bg-blue-900/20', border: 'border-blue-500/25', icon: '🛡️' },
  ESTJ: { label: 'Executive', color: 'text-blue-300', bg: 'bg-blue-900/20', border: 'border-blue-500/25', icon: '📌' },
  ESFJ: { label: 'Consul', color: 'text-blue-300', bg: 'bg-blue-900/20', border: 'border-blue-500/25', icon: '🤝' },
  ISTP: { label: 'Virtuoso', color: 'text-orange-300', bg: 'bg-orange-900/20', border: 'border-orange-500/25', icon: '🔧' },
  ISFP: { label: 'Adventurer', color: 'text-orange-300', bg: 'bg-orange-900/20', border: 'border-orange-500/25', icon: '🎭' },
  ESTP: { label: 'Entrepreneur', color: 'text-orange-300', bg: 'bg-orange-900/20', border: 'border-orange-500/25', icon: '🚀' },
  ESFP: { label: 'Entertainer', color: 'text-orange-300', bg: 'bg-orange-900/20', border: 'border-orange-500/25', icon: '🎤' },
};

const ALL_AGENT_ROLES: string[] = Object.keys(AGENT_META);
const isAgentRole = (role: string): role is AgentRole => ALL_AGENT_ROLES.includes(role);

interface Metrics { l1: number; l2: number; l3: number; total: number; chat?: number; }
interface Thought { role: string; content: string; type: 'THINK' | 'COMM' | 'ACTION'; timestamp: number; }

// ── Utility Components ───────────────────────────────────────────────────────

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1 px-2 py-1 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all text-[9px] font-black uppercase tracking-widest">
      {copied ? <Check size={9} className="text-emerald-400" /> : <Copy size={9} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
};

const CodeBlock: React.FC<{ language?: string; children: string }> = ({ language, children }) => {
  const [copied, setCopied] = useState(false);
  return (
    <div className="my-3 rounded-2xl overflow-hidden border border-slate-800 bg-[#0d0d0d]">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest font-mono">{language || 'code'}</span>
        <button onClick={() => { navigator.clipboard.writeText(children); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400 text-[9px] font-black uppercase tracking-widest transition-all">
          {copied ? <Check size={9} className="text-emerald-400" /> : <Copy size={9} />}
          {copied ? 'Copied!' : 'Copy Code'}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-[11px] leading-relaxed text-slate-300 font-mono whitespace-pre">
        <code>{children}</code>
      </pre>
    </div>
  );
};

const MD_COMPONENTS = {
  code({ node, inline, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || '');
    const str = String(children).replace(/\n$/, '');
    if (!inline && (match || str.includes('\n'))) return <CodeBlock language={match?.[1]}>{str}</CodeBlock>;
    return <code className="bg-slate-800 text-emerald-400 px-1.5 py-0.5 rounded text-[10px] font-mono" {...props}>{children}</code>;
  },
};

// ── Sub-Components (Hoisted for Stability) ───────────────────────────────────

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center p-12 text-center">
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl mb-6">
            <X className="text-red-500" size={32} />
          </div>
          <h1 className="text-xl font-black text-white uppercase tracking-tighter mb-2">Cognitive Fault Detected</h1>
          <p className="text-xs text-slate-500 font-mono max-w-md break-all uppercase tracking-widest leading-relaxed">
            {this.state.error?.message || 'Unknown Runtime Exception'}
          </p>
          <button onClick={() => window.location.reload()} className="mt-8 px-6 py-3 bg-slate-100 text-slate-950 text-[10px] font-black uppercase rounded-xl tracking-widest">Reboot System</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const NavIcon = ({ icon, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={`p-5 rounded-3xl transition-all relative ${active ? 'bg-slate-950 text-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.1)] border border-slate-800' : 'text-slate-600 hover:text-slate-400'
      }`}
  >
    {icon ? React.cloneElement(icon, { size: 24 }) : null}
    {active && <motion.div layoutId="nav-dot" className="absolute -right-1 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-emerald-500 rounded-full" />}
  </button>
);

const MemoryView = ({ onPurge }: { onPurge: () => void }) => {
  const [memories, setMemories] = useState<any[]>([]);
  useEffect(() => {
    if (getIpc()) getIpc().invoke('get_memories', { layer: 1, limit: 100 }).then((data: any) => setMemories(Array.isArray(data) ? data : []));
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 h-full overflow-y-auto pr-6 pb-20 scrollbar-hide">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-xl font-bold text-slate-100 border-l-4 border-emerald-500 pl-4 tracking-tight">System Archive</h2>
        <button
          onClick={() => { if (confirm('⚠️ CRITICAL: Permanently erase all local context and logs?')) onPurge(); }}
          className="px-5 py-2.5 bg-red-500/5 border border-red-500/20 text-red-500 rounded-xl text-[11px] font-bold uppercase hover:bg-red-500/10 transition-all tracking-wider flex items-center gap-2"
        >
          <Trash2 size={12} /> Wipe System Memory
        </button>
      </div>
      {memories.length === 0 && <p className="text-slate-700 italic text-sm tracking-widest py-20 text-center uppercase font-black opacity-20">Archive Empty</p>}
      {memories.map((m, i) => (
        <div key={i} className="bg-slate-900/40 border border-slate-800 p-8 rounded-[2rem] space-y-4 hover:border-emerald-500/20 transition-all group">
          <div className="flex justify-between items-center text-[10px] font-black text-emerald-500/40 uppercase tracking-widest">
            <span className="bg-emerald-500/5 px-3 py-1 rounded-full border border-emerald-500/10">Ref Segment 0x{(m?.id || 0).toString(16).toUpperCase()}</span>
            <span className="font-mono text-slate-700">{m?.timestamp ? new Date(m.timestamp * 1000).toLocaleString() : 'N/A'}</span>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed font-medium group-hover:text-slate-200 transition-colors">{m?.content || 'No context available'}</p>
        </div>
      ))}
    </motion.div>
  );
};

const ProviderCard = ({ provider, index, config, setConfig, detectSdk, removeProvider }: any) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-[2rem] relative group hover:border-emerald-500/30 transition-all">
      <div className="flex gap-6 items-center">
        <div className="flex-1">
          <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest block mb-1">Provider Name</label>
          <input value={provider?.alias || ''} onChange={(e) => {
            const next = { ...config };
            next.providers[index].alias = e.target.value;
            setConfig(next);
          }} className="w-full bg-transparent border-none text-slate-200 font-bold focus:text-emerald-500 outline-none transition-all placeholder:text-slate-800" placeholder="e.g. Primary Gemini" />
        </div>

        <div className="flex-[1.5]">
          <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest block mb-1">Secret Key</label>
          <input type="password" value={provider?.apiKey || ''} onChange={(e) => {
            const key = e.target.value;
            const { sdk, model } = detectSdk(key);
            const next = { ...config };
            next.providers[index].apiKey = key;
            if (!provider.sdk) next.providers[index].sdk = sdk;
            if (!provider.modelId) next.providers[index].modelId = model;
            setConfig(next);
          }} placeholder="Paste API Key..." className="w-full bg-slate-950/50 border border-slate-800/50 rounded-2xl px-4 py-2 text-xs font-mono text-emerald-500 outline-none focus:border-emerald-500/30" />
        </div>

        <div className="flex-1">
          <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest block mb-1">Model ID</label>
          <input value={provider?.modelId || ''} onChange={(e) => {
            const next = { ...config };
            next.providers[index].modelId = e.target.value;
            setConfig(next);
          }} placeholder="e.g. gemini-flash-latest" className="w-full bg-slate-950/50 border border-slate-800/50 rounded-2xl px-4 py-2 text-xs font-mono text-slate-400 outline-none focus:border-emerald-500/30" />
        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => setShowAdvanced(!showAdvanced)} className={`p-3 rounded-xl transition-all ${showAdvanced ? 'bg-emerald-500/10 text-emerald-500' : 'text-slate-700 hover:text-slate-400'}`}>
            <Settings size={14} />
          </button>
          <button onClick={() => removeProvider(index)} className="p-3 text-slate-700 hover:text-red-500 transition-all">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {showAdvanced && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-4 pt-4 border-t border-slate-800/50 grid grid-cols-2 gap-4">
          <div>
            <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest block mb-1">SDK Platform</label>
            <input value={provider?.sdk || ''} onChange={(e) => {
              const next = { ...config };
              next.providers[index].sdk = e.target.value;
              setConfig(next);
            }} placeholder="e.g. google or openai-compatible" className="w-full bg-slate-950/50 border border-slate-800/50 rounded-lg px-3 py-1.5 text-[10px] font-mono text-slate-400 outline-none focus:border-emerald-500/30" />
          </div>
          {provider?.sdk === 'openai-compatible' && (
            <div>
              <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest block mb-1">Base URL</label>
              <input value={provider?.baseURL || ''} onChange={(e) => {
                const next = { ...config };
                next.providers[index].baseURL = e.target.value;
                setConfig(next);
              }} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-[10px] font-mono text-slate-400 outline-none" />
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

const SettingsView = ({ config, setConfig }: any) => {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const addProvider = () => {
    const next = { ...config };
    next.providers = next.providers || [];
    next.providers.push({ alias: 'New Provider', sdk: 'google', apiKey: '', modelId: 'gemini-1.5-flash' });
    setConfig(next);
  };

  const removeProvider = (index: number) => {
    const next = { ...config };
    next.providers.splice(index, 1);
    setConfig(next);
  };

  const update = (path: string, val: any) => {
    const next = { ...config };
    const parts = path.split('.');
    let curr = next;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!curr[parts[i]]) curr[parts[i]] = {};
      curr = curr[parts[i]];
    }
    curr[parts[parts.length - 1]] = val;
    setConfig(next);
  };

  const save = async () => {
    setSaving(true);
    const ipc = getIpc();
    if (ipc) {
      const finalConfig = { ...config };
      if (!finalConfig.default_provider_alias && finalConfig.providers?.length > 0) {
        finalConfig.default_provider_alias = finalConfig.providers[0].alias;
      }
      await ipc.invoke('save_config', finalConfig);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  };

  const detectSdk = (key: string): { sdk: any, model: string } => {
    if (key?.startsWith('sk-ant')) return { sdk: 'anthropic', model: 'claude-3-5-sonnet-20240620' };
    if (key?.startsWith('sk-')) return { sdk: 'openai', model: 'gpt-4o' };
    if (key?.startsWith('AIza')) return { sdk: 'google', model: 'gemini-flash-latest' };
    return { sdk: 'google', model: 'gemini-flash-latest' };
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full overflow-y-auto space-y-12 pr-6 pb-32 scrollbar-hide">
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-100 border-l-4 border-emerald-500 pl-4 uppercase tracking-tighter">AI Provider Registry</h2>
          <button onClick={addProvider} className="px-5 py-2.5 bg-emerald-500/5 border border-emerald-500/20 text-emerald-500 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-500/10 transition-all tracking-widest">+ Add Instance</button>
        </div>
        <div className="grid grid-cols-1 gap-4">
          {(config?.providers || []).map((p: any, i: number) => (
            <ProviderCard key={i} provider={p} index={i} config={config} setConfig={setConfig} detectSdk={detectSdk} removeProvider={removeProvider} />
          ))}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-8">
        <section className="space-y-6">
          <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
            <Shield size={12} className="text-emerald-500" /> Cognitive Engine
          </h2>
          <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl space-y-6">
            <div>
              <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest block mb-2">Primary Active Provider Alias</label>
              <select value={config?.default_provider_alias || ''} onChange={(e) => update('default_provider_alias', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-emerald-500 outline-none">
                {(config?.providers || []).map((p: any) => <option key={p.alias} value={p.alias}>{p.alias}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest block mb-2">Recursive Search Depth (Nodes)</label>
              <input type="number" value={config?.system?.recursive_threshold || 10} onChange={(e) => update('system.recursive_threshold', parseInt(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-slate-300 outline-none" />
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
            <Box size={12} className="text-emerald-500" /> Infrastructure
          </h2>
          <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl space-y-6">
            <div>
              <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest block mb-2">L1 Memory Path (Local SQLite)</label>
              <input value={config?.system?.sqlite_db_path || ''} onChange={(e) => update('system.sqlite_db_path', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-mono text-slate-500 outline-none" />
            </div>
            <div>
              <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest block mb-2">Swarm Node Identity</label>
              <input value={config?.system?.server_name || ''} onChange={(e) => update('system.server_name', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-slate-300 outline-none" />
            </div>
          </div>
        </section>
      </div>

      <div className="fixed bottom-10 right-10 left-32">
        <button onClick={save} disabled={saving} className={`w-full py-5 rounded-3xl font-black text-[10px] uppercase tracking-[0.5em] shadow-2xl transition-all active:scale-95 ${saved ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-950 hover:bg-emerald-500 hover:text-white'} disabled:opacity-20`}>
          {saving ? 'Synchronizing Node Config...' : saved ? '✓ Config Synchronized' : 'Execute System Update'}
        </button>
      </div>
    </motion.div>
  );
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'chat' | 'memory' | 'settings' | 'system' | 'swarm'>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [totalTokens, setTotalTokens] = useState(0);
  const [swarmStatus, setSwarmStatus] = useState<any[]>([]);
  const [pastedImage, setPastedImage] = useState<string | null>(null); // base64 vision
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Session Control State (Gated)
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const activeSessionIdRef = useRef<number | null>(null);
  const [velocity, setVelocity] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [avgResponseTime, setAvgResponseTime] = useState<number>(0);
  const responseCountRef = useRef<number>(0);

  // Hoisted System Telemetry (Persistent across tabs)
  const [metrics, setMetrics] = useState<Metrics>({ l1: 0, l2: 0, l3: 0, total: 0 });
  const [thoughts, setThoughts] = useState<Thought[]>([]);

  const runStartRef = useRef<number>(0);
  const runTokensRef = useRef<number>(0);

  useEffect(() => {
    let interval: any;
    if (isThinking) {
      interval = setInterval(() => {
        const d = (Date.now() - runStartRef.current) / 1000;
        setDuration(d);
        const tokensDelta = Math.max(0, metrics.total - runTokensRef.current);
        setVelocity(Math.round(tokensDelta / (d || 1)));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isThinking, metrics.total]);

  // Config State
  const [config, setConfig] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>(['Initializing internal bootstrap...']);

  const addLog = (msg: string) => setLogs(prev => [...prev.slice(-4), `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    chatEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    if (activeTab === 'chat') {
      setTimeout(() => scrollToBottom('auto'), 100);
    }
  }, [messages.length, activeTab]);

  // 1. Boot: load config + chat history
  useEffect(() => {
    const boot = async () => {
      const ipc = getIpc();
      if (!ipc) { setTimeout(boot, 200); return; }
      try {
        addLog('IPC Bridge established. Fetching config...');
        const data = await ipc.invoke('get_config');
        setConfig(data);
        addLog('Environment synchronized.');
        if (!data.providers || data.providers.length === 0) {
          addLog('No providers detected. Redirecting to Settings...');
          setActiveTab('settings');
        }

        // Load Session Registry
        const sessionList = await ipc.invoke('get_missions');
        setSessions(sessionList || []);
        if (sessionList?.length > 0) {
          const lastId = sessionList[0].id;
          setActiveSessionId(lastId);
          activeSessionIdRef.current = lastId;

          // Load active session history
          const history = await ipc.invoke('get_chat_history', { sessionId: lastId });
          if (Array.isArray(history)) {
            const loaded = history.map((m: any) => ({
              id: m.id, role: m.role, content: m.content,
              imageData: m.image_data || undefined, timestamp: m.timestamp,
            }));
            setMessages(loaded);
            addLog(`Restored Session 0x${lastId.toString(16).toUpperCase()}.`);
          }
        }
      } catch (e) {
        addLog(`Boot error: ${e instanceof Error ? e.message : 'Unknown'}`);
      }
    };
    boot();
  }, []);

  // 2. Poll Swarm Status
  useEffect(() => {
    const interval = setInterval(async () => {
      const ipc = getIpc();
      if (ipc) { const status = await ipc.invoke('get_swarm_status'); setSwarmStatus(status || []); }
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // 3. Live agent messages — stream to UI + persist to L0
  useEffect(() => {
    const ipc = getIpc();
    if (!ipc) return;

    const handler = (msg: { role: AgentRole; content: string; sessionId: number; usage?: any; timestamp: number }) => {
      // ── Session Gating ──────────────────────────────────────────────────
      if (msg.sessionId === activeSessionIdRef.current) {
        const newMsg: Message = { role: msg.role, content: msg.content, timestamp: msg.timestamp };
        setMessages(prev => [...prev, newMsg]);
      }

      // ── Live Telemetry Spike ─────────────────────────────────────────────
      if (isThinking && msg.usage) {
        responseCountRef.current += 1;
        const totalRunTime = (Date.now() - runStartRef.current) / 1000;
        setAvgResponseTime(totalRunTime / responseCountRef.current);
        
        // Immediate TPS update based on this agent's payload
        const runTokens = (metrics.total - runTokensRef.current) + (msg.usage.totalTokens || 0);
        setVelocity(Math.round(runTokens / (totalRunTime || 1)));
      }

      // Persist to L0 Tactical Log tagged to originating session
      ipc.invoke('save_chat_message', { role: msg.role, content: msg.content, missionId: msg.sessionId });
    };

    ipc.on('swarm_message', handler);
    return () => ipc.removeListener('swarm_message', handler);
  }, [isThinking, metrics.total]);

  // 4. Global Telemetry
  useEffect(() => {
    const ipc = getIpc();
    if (!ipc) return;
    const fetchMetrics = async () => { const d = await ipc.invoke('get_system_metrics'); if (d) setMetrics(d); };
    fetchMetrics();
    const metricsInterval = setInterval(fetchMetrics, 3000);
    const thoughtHandler = (t: Thought & { sessionId: number }) => {
      if (t.sessionId === activeSessionIdRef.current) {
        setThoughts(prev => [t, ...prev].slice(0, 100));
      }
    };
    ipc.on('swarm_thought', thoughtHandler);
    return () => { clearInterval(metricsInterval); ipc.removeListener('swarm_thought', thoughtHandler); };
  }, []);

  // 5. 1-Hour Rolling Retention
  useEffect(() => {
    const c = setInterval(() => {
      const h = Date.now() - 3600000;
      setThoughts(prev => prev.filter(t => t.timestamp > h));
    }, 30000);
    return () => clearInterval(c);
  }, []);

  const handlePurgeAllData = async () => {
    const ipc = getIpc();
    if (!ipc) return;
    try {
      await ipc.invoke('purge_all_data');
      setMessages([]);
      setThoughts([]);
      setMetrics({ l1: 0, l2: 0, l3: 0, total: 0 });
      addLog('SESSION DATA PURGED. SYSTEM RESET COMPLETE.');
    } catch (e) {
      console.error(e);
    }
  };

  // 6. Ctrl+V Screenshot Paste
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (!blob) continue;
          const reader = new FileReader();
          reader.onload = () => setPastedImage(reader.result as string);
          reader.readAsDataURL(blob);
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleDeleteMessage = async (id?: number) => {
    if (!id) return;
    const ipc = getIpc();
    await ipc?.invoke('delete_chat_message', { id });
    setMessages(prev => prev.filter(m => m.id !== id));
  };

  const handleClearChat = async () => {
    const ipc = getIpc();
    await ipc?.invoke('clear_chat_history');
    setMessages([]);
  };

  // 7. Session Control Logic
  const handleSwitchSession = async (id: number) => {
    const ipc = getIpc();
    if (!ipc || id === activeSessionId) return;
    setActiveSessionId(id);
    activeSessionIdRef.current = id;
    setMessages([]); // Flush UI while loading
    const history = await ipc.invoke('get_chat_history', { sessionId: id });
    const loaded = history.map((m: any) => ({
      id: m.id, role: m.role, content: m.content,
      imageData: m.image_data || undefined, timestamp: m.timestamp,
    }));
    setMessages(loaded);
  };

  const handleCreateSession = async () => {
    const ipc = getIpc();
    if (!ipc) return;
    
    // Electron's native prompt() is often blocked or silent. Auto-generating Hex-ID.
    const hexGen = Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0');
    const name = `Session 0x${hexGen}`;

    try {
      const newId = await ipc.invoke('create_mission', { name });
      const sessionList = await ipc.invoke('get_missions');
      setSessions(sessionList);
      setActiveTab('chat'); // Teleport to chat interface
      handleSwitchSession(newId);
      addLog(`[SYSTEM] Initialized secure cognitive partition: ${name}`);
    } catch (e: any) {
      console.error('Session Creation Failed:', e);
      addLog(`[ERROR] Failed to initialize partition: ${e.message}`);
    }
  };

  const handleDeleteSession = async (id: number) => {
    const ipc = getIpc();
    if (!ipc || id === 1) return;
    if (!confirm('Erase session history and associated cognitive context?')) return;
    await ipc.invoke('delete_mission', { id });
    const sessionList = await ipc.invoke('get_missions');
    setSessions(sessionList);
    if (activeSessionId === id) handleSwitchSession(1);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() && !pastedImage) return;
    const ipc = getIpc();
    if (!ipc) return;

    const msgContent = inputText || '[Image attached for analysis]';
    const image = pastedImage || undefined;
    setPastedImage(null);
    setInputText('');

    // Persist user msg tagged to active session
    const savedId = await ipc.invoke('save_chat_message', { role: 'user', content: msgContent, imageData: image, sessionId: activeSessionId });
    const userMsg: Message = { id: savedId, role: 'user', content: msgContent, imageData: image, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);

    // Interjection
    if (isThinking) {
      try { await ipc.invoke('interject_swarm', { message: msgContent, sessionId: activeSessionId }); } catch (e) { console.error(e); }
      return;
    }

    setIsThinking(true);
    runStartRef.current = Date.now();
    runTokensRef.current = metrics.total;
    responseCountRef.current = 0;
    setAvgResponseTime(0);

    try {
      const response = await ipc.invoke('query_swarm', { task: msgContent, imageData: image, sessionId: activeSessionId });
      if (response) {
        if (response.content) {
          const savedAiId = await ipc.invoke('save_chat_message', { role: 'assistant', content: response.content, sessionId: activeSessionId });
          setMessages(prev => [...prev, { id: savedAiId, role: 'assistant', content: response.content, timestamp: Date.now() }]);
        }
        if (response.usage) addLog(`Session complete. Total tokens: ${response.usage?.totalTokens || 0}`);
        if (response.velocity) setVelocity(response.velocity);
        if (response.duration) setDuration(response.duration);
      }
    } catch (error: any) {
      setMessages(prev => [...prev, { role: 'error', content: `Sync Error: ${error.message}`, timestamp: Date.now() }]);
    } finally {
      setIsThinking(false);
    }
  };

  if (!config) return (
    <div className="h-screen w-screen bg-black flex flex-col items-center justify-center gap-8">
      <div className="flex flex-col items-center gap-4">
        <div className="font-mono text-emerald-500 animate-pulse uppercase tracking-[0.5em] text-sm">Initializing Synapse...</div>
        <div className="text-[8px] font-mono text-slate-700 uppercase tracking-widest">
          Bridge: {(window as any).ipcRenderer ? 'Ready' : 'Waiting...'} | Auth: Pending
        </div>
      </div>

      <div className="w-64 space-y-2">
        {logs.map((log, i) => (
          <div key={i} className="text-[9px] font-mono text-emerald-500/40 truncate text-center lowercase">
            {log}
          </div>
        ))}
      </div>
    </div>
  );

  const isOperational = config && config.providers?.length > 0 && config.default_provider_alias;

  return (
    <ErrorBoundary>
      <div className="h-screen w-screen bg-[#0a0a0a] flex overflow-hidden text-slate-200 font-sans selection:bg-emerald-500/30">

        {/* Session Management Rail */}
        <SessionRail
          sessions={sessions}
          activeSessionId={activeSessionId || 0}
          onSwitch={handleSwitchSession}
          onCreate={handleCreateSession}
          onDelete={handleDeleteSession}
        />

        {/* Tab Sidebar - Silver & Green Metallic (Z-10) */}
        <nav className="w-20 bg-slate-900 border-r border-slate-800 h-full flex flex-col items-center py-8 gap-8 z-10">
          <div className="p-3 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.3)]">
            <Cpu className="text-white w-6 h-6" />
          </div>

          <nav className="flex flex-col gap-6 mt-12">
            <NavIcon active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} icon={<MessageSquare />} />
            <NavIcon active={activeTab === 'swarm'} onClick={() => setActiveTab('swarm')} icon={<Users />} />
            <NavIcon active={activeTab === 'memory'} onClick={() => setActiveTab('memory')} icon={<Database />} />
            <NavIcon active={activeTab === 'system'} onClick={() => setActiveTab('system')} icon={<BarChart />} />
            <NavIcon active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings />} />
          </nav>

          <div className="mt-auto mb-4">
            <div className={`w-10 h-10 rounded-full border flex items-center justify-center bg-slate-950 transition-all duration-500 ${isOperational ? 'border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]'}`}>
              <div className={`w-2 h-2 rounded-full transition-all duration-500 ${isOperational ? 'bg-emerald-500 animate-ping' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'}`} />
            </div>
          </div>
        </nav>

        {/* Main Framework */}
        <main className="flex-1 flex flex-col p-8 h-full relative overflow-hidden">

          {/* Animated Silver/Green Mesh Header */}
          <header className="flex justify-between items-center mb-10 flex-shrink-0 select-none" style={{ WebkitAppRegion: 'drag' } as any}>
            <div className="flex flex-col" style={{ WebkitAppRegion: 'no-drag' } as any}>
              <h1 className="text-3xl font-black tracking-tighter text-slate-100 flex items-center gap-3">
                SYNAPSE <span className="text-emerald-500 text-[10px] border border-emerald-500/30 px-3 py-1 rounded-full uppercase tracking-[0.3em] bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.1)]">Swarm Native</span>
              </h1>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-2 flex items-center gap-2">
                <Shield size={10} className={isOperational ? 'text-emerald-500' : 'text-red-500'} /> System Status: {isOperational ? 'Operational' : 'Awaiting Connection'} · {config?.system?.server_name || 'Synapse'}
              </p>
            </div>

            <div className="flex gap-3 items-center" style={{ WebkitAppRegion: 'no-drag' } as any}>
              <div className="flex gap-2 mr-4 border-r border-slate-800 pr-6">
                {/* ── Collapsed Hive Indicator ── */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={() => setActiveTab('swarm')}
                  className="px-4 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-emerald-400 flex items-center gap-3 transition-all shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                >
                  <Activity size={14} className={swarmStatus.some(s => s.status === 'THINKING') ? 'animate-pulse' : ''} />
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    {swarmStatus.filter(s => s.status === 'THINKING').length > 0
                      ? `Hive Scaling: ${swarmStatus.filter(s => s.status === 'THINKING').length} Active`
                      : `Swarm Ready: ${swarmStatus.length} Nodes`}
                  </span>
                </motion.button>
              </div>

              {/* Native Controls */}
              <div className="flex gap-2">
                <button
                  onClick={() => getIpc()?.invoke('window_minimize')}
                  className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 hover:text-emerald-500 hover:border-emerald-500/50 transition-all"
                >
                  <Minus size={16} />
                </button>
                <button
                  onClick={() => getIpc()?.invoke('window_toggle_maximize')}
                  className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 hover:text-emerald-500 hover:border-emerald-500/50 transition-all"
                >
                  <Square size={14} />
                </button>
                <button
                  onClick={() => getIpc()?.invoke('window_close')}
                  className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 hover:text-red-500 hover:border-red-500/50 transition-all"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-hidden relative">
            <AnimatePresence mode="wait">
              {activeTab === 'chat' && (
                <motion.div key="chat" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="h-full flex flex-col">
                  {/* ... contents remain same ... */}
                  <div className="flex-1 overflow-y-auto space-y-8 pr-4 pb-32 scrollbar-hide">
                    {messages.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-center opacity-10">
                        <Cpu size={64} strokeWidth={1} className="text-emerald-500 mb-4" />
                        <p className="text-sm font-black uppercase tracking-[0.5em]">Waiting for System Input</p>
                      </div>
                    )}

                    {(() => {
                      const groups: any[] = [];
                      messages.forEach(msg => {
                        const last = groups[groups.length - 1];
                        if (msg.hardened_to_id && last && last.hardened_to_id === msg.hardened_to_id) {
                          last.items.push(msg);
                        } else if (msg.hardened_to_id) {
                          groups.push({ type: 'hardened', hardened_to_id: msg.hardened_to_id, content: msg.hardened_content, items: [msg] });
                        } else {
                          groups.push({ type: 'raw', ...msg });
                        }
                      });

                      return groups.map((group, i) => {
                        if (group.type === 'hardened') {
                          return <SovereignBlock key={`h-${group.hardened_to_id}`} summary={group.content} messages={group.items} />;
                        }

                        const msg = group as any;
                        if (msg.role === 'error') return (
                          <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                            <div className="max-w-[75%] px-6 py-4 rounded-[2rem] bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium">⚠️ {msg.content}</div>
                          </motion.div>
                        );

                        const agent = isAgentRole(msg.role) ? AGENT_META[msg.role as AgentRole] : null;

                        if (msg.role === 'user') return (
                          <motion.div key={i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex justify-end flex-col items-end gap-2 group">
                            <div className="max-w-[85%] px-6 py-4 rounded-[2rem] rounded-tr-sm bg-emerald-600/10 border border-emerald-500/20 text-emerald-50 text-sm leading-relaxed ml-12 shadow-sm">
                              {msg.imageData && (
                                <div className="mb-4 rounded-xl overflow-hidden border border-emerald-500/30">
                                  <img src={msg.imageData} className="max-w-full h-auto" alt="pasted visual" />
                                </div>
                              )}
                              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={MD_COMPONENTS}>{msg.content}</ReactMarkdown>
                            </div>
                            <div className="flex items-center gap-4 px-4 opacity-0 group-hover:opacity-100 transition-all duration-300">
                              <CopyButton text={msg.content} />
                              {msg.id && (
                                <button onClick={() => handleDeleteMessage(msg.id)} className="text-[9px] font-black uppercase tracking-widest text-slate-600 hover:text-red-400 flex items-center gap-1 transition-all">
                                  <Trash2 size={9} /> Purge
                                </button>
                              )}
                            </div>
                          </motion.div>
                        );

                        if (agent) return (
                          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex justify-start flex-col gap-2 mr-12 group">
                            <div className="flex items-center justify-between pl-1">
                              <div className="flex items-center gap-2">
                                <span className="text-base leading-none">{agent.icon}</span>
                                <span className={`text-[10px] font-black uppercase tracking-[0.25em] ${agent.color}`}>{agent.label}</span>
                              </div>
                              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-4 transition-all duration-300">
                                <CopyButton text={msg.content} />
                                {msg.id && (
                                  <button onClick={() => handleDeleteMessage(msg.id)} className="text-[9px] font-black uppercase tracking-widest text-slate-700 hover:text-red-400 transition-all">
                                    Delete
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className={`px-7 py-6 rounded-[2rem] rounded-tl-sm text-sm leading-relaxed border ${agent.bg} ${agent.border} ${agent.color.replace('400', '100')} shadow-sm backdrop-blur-sm`}>
                              <div className="prose-synapse text-slate-200">
                                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={MD_COMPONENTS}>{msg.content}</ReactMarkdown>
                              </div>
                            </div>
                          </motion.div>
                        );

                        return (
                          <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start mr-12 group flex-col gap-2">
                            <div className="max-w-[75%] px-6 py-4 rounded-[2rem] bg-slate-900/60 border border-slate-800 text-slate-300 text-sm leading-relaxed">
                              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={MD_COMPONENTS}>{msg.content}</ReactMarkdown>
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 px-4 transition-all">
                              <CopyButton text={msg.content} />
                            </div>
                          </motion.div>
                        );
                      });
                    })()}

                    {isThinking && (
                      <div className="flex justify-start pl-2">
                        <div className="bg-slate-900/40 border border-emerald-500/10 px-6 py-4 rounded-3xl flex gap-2 shadow-inner">
                          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" />
                          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* ── Input Tactical Overlay ────────────────────────────── */}
                  <div className="absolute bottom-6 left-0 right-0 z-20 px-1">
                    <AnimatePresence>
                      {pastedImage && (
                        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="absolute bottom-20 left-4 bg-slate-900/95 border border-emerald-500/30 p-2 rounded-2xl shadow-2xl backdrop-blur-md">
                          <div className="relative">
                            <img src={pastedImage} className="h-32 rounded-xl object-cover" alt="pasted visual preview" />
                            <button onClick={() => setPastedImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg hover:bg-red-600 transition-colors">
                              <X size={12} strokeWidth={3} />
                            </button>
                            <div className="absolute bottom-0 left-0 right-0 bg-emerald-500/80 py-1 text-center font-black text-[8px] text-black uppercase tracking-widest rounded-b-xl">Visual Buffer Cached</div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-2.5 flex items-center gap-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl mx-1 transform focus-within:border-emerald-500/40 transition-all duration-500">
                      <button onClick={handleClearChat} title="Clear Mission History" className="p-4 text-slate-700 hover:text-red-500 transition-all">
                        <Trash2 size={20} strokeWidth={1.5} />
                      </button>
                      <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder={isThinking ? "Inject steering command..." : "Deploy tactical objective..."}
                        className="flex-1 bg-transparent border-none outline-none px-4 text-sm text-slate-100 placeholder:text-slate-700 font-medium font-mono"
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!inputText.trim() && !pastedImage}
                        className={`p-4 text-white rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-30 disabled:hover:scale-100 ${isThinking ? 'bg-amber-500 shadow-amber-500/40' : 'bg-emerald-500 shadow-emerald-500/40'}`}
                      >
                        <Send size={18} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'system' && (
                <motion.div key="system" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                  <DashboardView
                    metrics={metrics}
                    thoughts={thoughts}
                    swarmStatus={swarmStatus}
                    velocity={velocity}
                    duration={avgResponseTime}
                  />
                </motion.div>
              )}
              {activeTab === 'swarm' && (
                <motion.div key="swarm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                  <AgentsView swarmStatus={swarmStatus} />
                </motion.div>
              )}
              {activeTab === 'settings' && <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full"><SettingsView config={config} setConfig={setConfig} /></motion.div>}
              {activeTab === 'memory' && <motion.div key="memory" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full"><MemoryView onPurge={handlePurgeAllData} /></motion.div>}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
};

// ── Sovereign Block Component (Metallic Hardening) ───────────────────────────
const SovereignBlock = ({ summary, messages }: { summary: string, messages: any[] }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative my-8"
    >
      <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/20 to-blue-500/20 rounded-[2rem] blur opacity-30" />
      <div className="relative bg-slate-950/80 border border-emerald-500/30 rounded-[2rem] overflow-hidden backdrop-blur-xl">
        {/* Metallic Header */}
        <div className="bg-gradient-to-r from-emerald-500/10 via-slate-800/50 to-emerald-500/10 px-8 py-4 border-b border-emerald-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <Box className="text-emerald-500" size={14} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Consolidated Knowledge Node</span>
              <p className="text-[9px] text-slate-500 font-medium italic">Dynamic Memory Compression Active</p>
            </div>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-4 py-1.5 rounded-full border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all"
          >
            {isExpanded ? 'Collapse' : 'Expand Context'}
          </button>
        </div>

        <div className="p-8">
          <div className="flex gap-4">
            <div className="flex-1">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Terminal size={12} className="text-emerald-500" /> Segment Summary
              </h4>
              <div className="text-sm text-slate-300 font-normal leading-relaxed italic border-l-2 border-emerald-500/30 pl-4 py-1">
                {summary}
              </div>
            </div>
            <div className="text-right flex flex-col justify-center border-l border-slate-800/50 pl-6">
              <span className="text-[20px] font-bold text-emerald-500/40 leading-none">{messages.length}</span>
              <span className="text-[9px] text-slate-600 uppercase font-black">History</span>
            </div>
          </div>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-8 pt-8 border-t border-slate-800 space-y-6 overflow-hidden"
              >
                {messages.map((m, idx) => (
                  <div key={idx} className="flex gap-4 items-start group">
                    <span className="text-[9px] font-black uppercase text-slate-600 w-24 pt-1">[{m.role}]</span>
                    <div className="flex-1 text-xs text-slate-400 leading-relaxed group-hover:text-slate-200 transition-colors">
                      {m.content}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

export default App;
