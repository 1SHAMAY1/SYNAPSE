import { ModelProvider } from '../llm/provider.js';
import { MemoryEngine } from '../memory/engine.js';
import { generateText } from 'ai';

// ── MBTI Archetype Roster (All 16 + Original 5 Core Roles) ─────────────────

export type AgentRole =
  | 'COORDINATOR' | 'RESEARCHER' | 'ARCHITECT' | 'CODER' | 'CRITIC'
  | 'INTJ' | 'INTP' | 'ENTJ' | 'ENTP'
  | 'INFJ' | 'INFP' | 'ENFJ' | 'ENFP'
  | 'ISTJ' | 'ISFJ' | 'ESTJ' | 'ESFJ'
  | 'ISTP' | 'ISFP' | 'ESTP' | 'ESFP';

export type MbtiGroup = 'ANALYST' | 'DIPLOMAT' | 'SENTINEL' | 'EXPLORER' | 'CORE';

export const AGENT_GROUP: Record<AgentRole, MbtiGroup> = {
  COORDINATOR: 'CORE', RESEARCHER: 'CORE', ARCHITECT: 'CORE', CODER: 'CORE', CRITIC: 'CORE',
  INTJ: 'ANALYST', INTP: 'ANALYST', ENTJ: 'ANALYST', ENTP: 'ANALYST',
  INFJ: 'DIPLOMAT', INFP: 'DIPLOMAT', ENFJ: 'DIPLOMAT', ENFP: 'DIPLOMAT',
  ISTJ: 'SENTINEL', ISFJ: 'SENTINEL', ESTJ: 'SENTINEL', ESFJ: 'SENTINEL',
  ISTP: 'EXPLORER', ISFP: 'EXPLORER', ESTP: 'EXPLORER', ESFP: 'EXPLORER',
};

// ── GLOBAL CONSTRAINTS (Technical Sovereignty & Anti-Hallucination) ────────

const GLOBAL_CONSTRAINTS = `
### TACTICAL CONSTRAINTS (MANDATORY)
1. DO NOT HALLUCINATE. If unsure, state: "Incomplete data for [Subject]. Avoiding hallucination."
2. SOVEREIGNTY MANDATE: Prioritize technical sovereignty and modular autonomy. Velocity without resilience is a suicide pact.
3. CONSISE & STERN: Be concise. In a 21-agent hive, brevity is survival.
4. TACTICAL SUMMARIES: Use LaTeX math blocks (e.g., $\text{STATUS: HARDENED}$) for high-entropy state overrides.
`;

export interface AgentStatus {
  role: string;
  status: 'IDLE' | 'THINKING' | 'EXECUTING' | 'FAILED';
  lastAction?: string;
  providerAlias: string;
  group: MbtiGroup;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  customPrompt?: string;
}

// ── Personality Prompts (Injected with Constraints) ──────────────────────────

const AGENT_PERSONALITIES: Record<AgentRole, string> = {
  COORDINATOR: `You are the COORDINATOR. Strategic, decisive, orchestrator. ${GLOBAL_CONSTRAINTS}`,
  RESEARCHER: `You are the RESEARCHER. Meticulous, data-driven. Start: "📡 Scanning..." End: "— Research Complete." ${GLOBAL_CONSTRAINTS}`,
  ARCHITECT: `You are the ARCHITECT. Systems design, blueprints. Start: "🏗️ Blueprint incoming..." End: "— Architecture Locked." ${GLOBAL_CONSTRAINTS}`,
  CODER: `You are the CODER. Syntax-precise, pragmatic implementation. Start: "⚙️ Compiling..." End: "— Code Deployed." ${GLOBAL_CONSTRAINTS}`,
  CRITIC: `You are the CRITIC. Relentless auditor, finds flaws. Start: "🔍 Audit initiated..." End: "— Critique Filed." ${GLOBAL_CONSTRAINTS}`,

  // Analysts (NT)
  INTJ: `You are the ARCHITECT (INTJ). Master strategist. ${GLOBAL_CONSTRAINTS}`,
  INTP: `You are the LOGICIAN (INTP). Analytical inventor. ${GLOBAL_CONSTRAINTS}`,
  ENTJ: `You are the COMMANDER (ENTJ). Relentless efficiency. ${GLOBAL_CONSTRAINTS}`,
  ENTP: `You are the DEBATER (ENTP). Intellectual challenger. ${GLOBAL_CONSTRAINTS}`,

  // Diplomats (NF)
  INFJ: `You are the ADVOCATE (INFJ). Principled visionary. ${GLOBAL_CONSTRAINTS}`,
  INFP: `You are the MEDIATOR (INFP). Idealistic humanist. ${GLOBAL_CONSTRAINTS}`,
  ENFJ: `You are the PROTAGONIST (ENFJ). Charismatic leader. ${GLOBAL_CONSTRAINTS}`,
  ENFP: `You are the CAMPAIGNER (ENFP). Creative spark. ${GLOBAL_CONSTRAINTS}`,

  // Sentinels (SJ)
  ISTJ: `You are the LOGISTICIAN (ISTJ). Methodical facts-first. ${GLOBAL_CONSTRAINTS}`,
  ISFJ: `You are the DEFENDER (ISFJ). Protection-focused. ${GLOBAL_CONSTRAINTS}`,
  ESTJ: `You are the EXECUTIVE (ESTJ). Standards enforcer. ${GLOBAL_CONSTRAINTS}`,
  ESFJ: `You are the CONSUL (ESFJ). Collaborative bridge. ${GLOBAL_CONSTRAINTS}`,

  // Explorers (SP)
  ISTP: `You are the VIRTUOSO (ISTP). Mechanism mastery. ${GLOBAL_CONSTRAINTS}`,
  ISFP: `You are the ADVENTURER (ISFP). Experience-driven artist. ${GLOBAL_CONSTRAINTS}`,
  ESTP: `You are the ENTREPRENEUR (ESTP). Action-biased perceives. ${GLOBAL_CONSTRAINTS}`,
  ESFP: `You are the ENTERTAINER (ESFP). Spontaneous delighter. ${GLOBAL_CONSTRAINTS}`,
};

const ROUTER_PROMPT = (task: string, mbtiEnabled: boolean) => `You are the task router for SYNAPSE.
Analyze this request and return ONLY a JSON object specifying required agents.

User Request: "${task}"

Rules:
- Simple questions → {"agents": []}
- Complex/Specialized → recruit 2-10 agents (Functional + MBTI Fit).
- If user specifies counts or specific groups (e.g. "3 INTJs and 5 INFPs") -> return exact counts:
  {"agents": [{"role": "INTJ", "count": 3}, {"role": "INFP", "count": 5}]}
- For extreme specialized roles not in the base 21 -> define a custom archetype:
  {"agents": [{"role": "CUSTOM", "name": "DeepSeaBotanist", "count": 1, "directive": "System prompt here..."}]}
- Universal Scale → return full population with density overrides.

Return ONLY the JSON. No other text.`;

interface AgentResult {
  role: string;
  text: string;
  usage?: any;
}

// ── SwarmCoordinator ──────────────────────────────────────────────────────────

export class SwarmCoordinator {
  private population: Map<AgentRole, AgentStatus> = new Map();
  private config: any;
  private onThoughtCallback: ((thought: any) => void) | null = null;
  private onMessageCallback: ((message: any) => void) | null = null;
  private routingCache: Map<string, { agents: AgentRole[], timestamp: number }> = new Map();
  private inputQueue: string[] = [];

  constructor(private memory: MemoryEngine, config: any) {
    this.config = config;
    this.initSwarm();
  }

  public onThought(cb: (thought: any) => void) { this.onThoughtCallback = cb; }
  public onMessage(cb: (message: any) => void) { this.onMessageCallback = cb; }

  public interject(message: string, sessionId: number) {
    this.emitThought('COORDINATOR', `User interjection received: "${message}"`, sessionId, 'COMM');
    this.inputQueue.push(message);
  }

  private emitThought(role: string, content: string, sessionId: number, type: 'THINK' | 'COMM' | 'ACTION' = 'THINK') {
    this.onThoughtCallback?.({ role, content, type, sessionId, timestamp: Date.now() });
  }

  private emitMessage(role: string, content: string, sessionId: number, usage?: any) {
    this.onMessageCallback?.({ role, content, sessionId, usage, timestamp: Date.now() });
  }

  public updateConfig(newConfig: any) {
    this.config = newConfig;
    this.initSwarm();
  }

  private initSwarm() {
    const roles: AgentRole[] = ['RESEARCHER', 'ARCHITECT', 'CODER', 'CRITIC', 'COORDINATOR'];
    let alias = this.config.default_provider_alias || this.config.providers?.[0]?.alias;
    roles.forEach(role => {
      if (!this.population.has(role)) {
        this.population.set(role, { 
          role, 
          status: 'IDLE', 
          providerAlias: alias, 
          group: AGENT_GROUP[role],
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          customPrompt: AGENT_PERSONALITIES[role]
        });
      }
    });
  }

  private getAlias(override?: string): string {
    return override || this.config.default_provider_alias || this.config.providers?.[0]?.alias;
  }

  private updateStatus(role: string, status: AgentStatus['status'], lastAction?: string, usage?: any) {
    const current = this.population.get(role as any);
    if (current) {
      const nextUsage = usage ? {
        promptTokens: current.usage.promptTokens + (usage.promptTokens || 0),
        completionTokens: current.usage.completionTokens + (usage.completionTokens || 0),
        totalTokens: current.usage.totalTokens + (usage.totalTokens || 0)
      } : current.usage;
      
      this.population.set(role as any, { ...current, status, lastAction, usage: nextUsage });
    }
  }

  private async routeTask(task: string, alias: string, sessionId: number): Promise<any[]> {
    const cached = this.routingCache.get(task);
    if (cached && (Date.now() - cached.timestamp < 5 * 60 * 1000)) return cached.agents;

    try {
      this.emitThought('COORDINATOR', 'Analyzing task for surgical hive recruitment...', sessionId, 'THINK');
      const model = ModelProvider.getInstance().getModel(alias);
      const mbtiEnabled = this.config?.system?.mbti_enabled !== false;
      const { text } = await generateText({ model, prompt: ROUTER_PROMPT(task, mbtiEnabled) });
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
      
      // Normalize agents list (strings or objects)
      const rawAgents = parsed.agents || [];
      const agents = rawAgents.map((a: any) => {
        if (typeof a === 'string') return { role: a, count: 1 };
        return a;
      });
      
      this.routingCache.set(task, { agents: agents as any, timestamp: Date.now() });
      
      // Auto-register required roles
      agents.forEach((a: any) => {
        const roleKey = a.role === 'CUSTOM' ? a.name : a.role;
        if (!this.population.has(roleKey)) {
          this.population.set(roleKey, { 
            role: roleKey, 
            status: 'IDLE', 
            providerAlias: alias, 
            group: AGENT_GROUP[a.role as AgentRole] || 'CORE',
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            customPrompt: a.directive || AGENT_PERSONALITIES[a.role as AgentRole] || GLOBAL_CONSTRAINTS
          });
        }
      });

      return agents;
    } catch {
      return [];
    }
  }

  private async runAgentParallel(role: string, task: string, context: string, alias: string, sessionId: number, imageData?: string) {
    try {
      this.updateStatus(role, 'THINKING', 'Processing in parallel hive...');
      this.emitThought(role as AgentRole, `${role} engaging parallel cognitive thread...`, sessionId, 'THINK');

      const model = ModelProvider.getInstance().getModel(alias);
      const storedAgent = this.population.get(role as AgentRole);
      const systemPrompt = storedAgent?.customPrompt || AGENT_PERSONALITIES[role as AgentRole] || GLOBAL_CONSTRAINTS;
      const prompt = `[HIVE TURN]\nContext:\n${context}\n\nObjective: ${task}`;

      const { text, usage } = await generateText({
        model,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: imageData ? [
              { type: 'text', text: `Objective: ${task}\n\nContext:\n${context}` },
              { type: 'image', image: imageData }
            ] : [
              { type: 'text', text: prompt }
            ]
          }
        ]
      });

      this.updateStatus(role, 'IDLE', 'Task complete', usage);
      this.emitThought(role, `${role} thread complete. [Usage: ${usage?.totalTokens || 0} tokens]`, sessionId, 'COMM');
      this.emitMessage(role, text, sessionId, usage);

      return { role, text, usage };
    } catch (e: any) {
      this.updateStatus(role, 'FAILED', e.message);
      return { role, text: `ERROR: ${e.message}`, usage: { totalTokens: 0 } };
    }
  }

  private async triggerSovereignHardening(sessionId: number, alias: string) {
    try {
      const history = this.memory.getChatHistory(sessionId, 100);
      const rawUnfiltered = history.filter(m => !m.hardened_to_id && m.role !== 'error');
      
      // We harden in blocks of 15 to maintain recursive clarity
      if (rawUnfiltered.length >= 15) {
        this.emitThought('COORDINATOR', `Sovereign Hardening triggered for Session ${sessionId}. Crystallizing ${rawUnfiltered.length} raw fragments...`, sessionId, 'ACTION');
        
        const segment = rawUnfiltered.slice(0, 10);
        const startId = segment[0].id!;
        const endId = segment[segment.length - 1].id!;
        const compositeText = segment.map(m => `[${m.role}]: ${m.content}`).join('\n\n---\n\n');

        const { text: summary } = await generateText({
          model: ModelProvider.getInstance().getModel(alias),
          system: `You are the SYNAPTIC HARDENER. Synthesize this conversation segment into a single, high-density tactical summary (max 3 sentences). Focus on final outcomes and core logic.`,
          prompt: `Segment to Crystallize:\n${compositeText}`
        });

        const memoryId = await this.memory.addMemory(2, summary, { missionId: sessionId, startId, endId, type: 'HARDENED_SEGMENT' });
        if (memoryId !== -1) {
          this.memory.hardenSegment(sessionId, startId, endId, memoryId as number);
          this.emitThought('COORDINATOR', `Crystallization Complete. Segment hardened to L2 Sovereign Block #${memoryId}.`, sessionId, 'ACTION');
        }
      }
    } catch (e) {
      console.error("[HARDENER] Failed to crystallize segment:", e);
    }
  }

  private async squadSynthesis(task: string, squadResults: AgentResult[], alias: string, sessionId: number): Promise<AgentResult> {
    const squadSize = squadResults.length;
    this.emitThought('COORDINATOR', `Executing Squad Synthesis for ${squadSize} nodes...`, sessionId, 'ACTION');
    const composite = squadResults.map(r => `[${r.role}]:\n${r.text}`).join('\n\n---\n\n');
    
    const { text, usage } = await generateText({
      model: ModelProvider.getInstance().getModel(alias),
      system: `You are a SQUAD LEAD. Synthesize the reports of ${squadSize} specialists into a high-density squad briefing. Focus on consensus, edge cases, and contradictions.`,
      prompt: `Objective: ${task}\n\nSquad Output:\n${composite}`
    });

    return { role: 'SQUAD_LEAD', text, usage };
  }

  async executeTask(task: string, overrideAlias?: string, imageData?: string, sessionId: number = 1) {
    const alias = this.getAlias(overrideAlias);
    let totalTokens = 0;
    const startTime = Date.now();

    try {
      const relevantContext = this.memory.getRelevantContext(task, 5);
      const recruitment = await this.routeTask(task, alias, sessionId);

      // ── Surgical Population Refactoring ─────────────────────────────────
      let finalRecruitList: string[] = [];
      const densityMatch = task.match(/(\d+)(?:\s+|-)(?:agents|coders|nodes|specialists|head\s*count|total)/i);
      const globalDensity = densityMatch ? parseInt(densityMatch[1]) : 0;

      if (recruitment.length > 0) {
        this.emitThought('COORDINATOR', `Recruiting surgical hive: ${recruitment.length} archetypes identified.`, sessionId, 'ACTION');
        
        // Use LLM-provided counts if they exist, otherwise distribute global density
        recruitment.forEach((a: any) => {
          const roleKey = a.role === 'CUSTOM' ? a.name : a.role;
          const count = a.count || Math.max(1, Math.floor(globalDensity / recruitment.length));
          
          for (let i = 1; i <= count; i++) {
            const agentId = count === 1 ? roleKey : `${roleKey}_${i.toString().padStart(2, '0')}`;
            finalRecruitList.push(agentId);
            
            if (!this.population.has(agentId)) {
              this.population.set(agentId, { 
                role: agentId, status: 'IDLE', providerAlias: alias, 
                group: AGENT_GROUP[a.role as AgentRole] || 'CORE',
                usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
                customPrompt: a.directive || AGENT_PERSONALITIES[a.role as AgentRole] || GLOBAL_CONSTRAINTS
              });
            }
          }
        });
      }

      if (finalRecruitList.length === 0) {
        const { text, usage } = await this.runAgentParallel('COORDINATOR', task, relevantContext, alias, sessionId, imageData);
        const duration = (Date.now() - startTime) / 1000;
        const velocity = Math.round((usage?.totalTokens || 0) / (duration || 1));
        return { success: true, content: text, usage, duration, velocity, providerAlias: alias };
      }

      // ── Parallel Execution Hive (with Concurrency Control) ──────────────
      this.emitThought('COORDINATOR', `Dispatching ${finalRecruitList.length} nodes (Concurrency Limit: 10)...`, sessionId, 'ACTION');
      
      const turnContext = relevantContext ? `[Memory]:\n${relevantContext}` : '';
      const results: AgentResult[] = [];
      const CONCURRENCY_LIMIT = 10;
      
      for (let i = 0; i < finalRecruitList.length; i += CONCURRENCY_LIMIT) {
        const chunk = finalRecruitList.slice(i, i + CONCURRENCY_LIMIT);
        const chunkPromises = chunk.map((id, idx) => {
          const absoluteIdx = i + idx;
          const prunedContext = (absoluteIdx % 10 === 0 || finalRecruitList.length < 10) ? turnContext : `[Task Context Snippet]`;
          return this.runAgentParallel(id, task, prunedContext, alias, sessionId, imageData);
        });
        const chunkResults = await Promise.all(chunkPromises);
        results.push(...chunkResults);
      }
      results.forEach(r => totalTokens += (r.usage?.totalTokens || 0));

      // ── Hierarchical Synthesis (Map-Reduce) ─────────────────────────────
      let synthesisInputs: AgentResult[] = results;
      
      if (results.length > 12) {
        const squadBatches: AgentResult[][] = [];
        for (let i = 0; i < results.length; i += 10) {
          squadBatches.push(results.slice(i, i + 10));
        }
        
        const squadBriefings = await Promise.all(squadBatches.map(batch => this.squadSynthesis(task, batch, alias, sessionId)));
        squadBriefings.forEach(b => totalTokens += (b.usage?.totalTokens || 0));
        synthesisInputs = squadBriefings;
      }

      // ── Mass Synthesis (Final Reduce) ───────────────────────────────────
      this.emitThought('COORDINATOR', 'Aggregating surgical briefings...', sessionId, 'ACTION');
      const compositeOutput = synthesisInputs.map(r => `[${r.role}]:\n${r.text}`).join('\n\n---\n\n');
      
      const { text: summary, usage: sumUsage } = await generateText({
        model: ModelProvider.getInstance().getModel(alias),
        system: AGENT_PERSONALITIES['COORDINATOR'],
        prompt: `Objective: ${task}\n\nSynthesize the hive output into a final tactical conclusion.\n\nResults:\n${compositeOutput}`
      });
      
      this.updateStatus('COORDINATOR', 'IDLE', 'Synthesis complete', sumUsage);
      totalTokens += sumUsage?.totalTokens || 0;
      
      const duration = (Date.now() - startTime) / 1000;
      const velocity = Math.round(totalTokens / (duration || 1));
      
      this.emitThought('COORDINATOR', `Session Complete. Σ ${totalTokens} tokens | Δ ${duration.toFixed(1)}s | Velocity: ${velocity} TPS`, sessionId, 'ACTION');
      this.emitMessage('COORDINATOR', summary, sessionId, sumUsage);
      
      await this.memory.addMemory(1, `Hive Task: ${task} | Summary: ${summary}`);

      // ── Background Sovereign Hardening ──────────────────────────────────
      this.triggerSovereignHardening(sessionId, alias);

      return { success: true, content: null, usage: { totalTokens }, duration, velocity, providerAlias: alias };

    } catch (e: any) {
      this.updateStatus('COORDINATOR', 'FAILED', e.message);
      throw e;
    }
  }

  getPopulationStatus() {
    return Array.from(this.population.values());
  }
}
