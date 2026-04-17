import Database from 'better-sqlite3';
import path from 'path';

export interface MemoryEntry {
  id?: number;
  layer: 1 | 2 | 3;
  content: string;
  metadata: string; // JSON string
  timestamp?: number;
}

export interface ChatMessage {
  id?: number;
  mission_id: number;
  role: string;
  content: string;
  image_data?: string; // base64 encoded
  timestamp: number;
  hardened_to_id?: number;
  hardened_content?: string;
}

export interface Mission {
  id: number;
  name: string;
  timestamp: number;
}

export class MemoryEngine {
  private db: Database.Database;

  constructor(dbPath: string) {
    console.log(`[MEMORY] Initializing SQLite Engine: ${dbPath}`);
    try {
      this.db = new Database(dbPath);
      this.initSchema();
    } catch (e) {
      console.error("[MEMORY] Critical initialization failure:", e);
      throw e;
    }
  }

  private initSchema() {
    this.db.exec(`
      -- Mission Lifecycle Table
      CREATE TABLE IF NOT EXISTS missions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );

      -- L1/L2/L3 AI Brain (Compacted by Recursive Engine)
      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        layer INTEGER NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT,
        timestamp DATETIME DEFAULT (STRFTIME('%s', 'now'))
      );
      CREATE INDEX IF NOT EXISTS idx_layer ON memories(layer);

      -- L0 Tactical Log (Raw UI Chat)
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mission_id INTEGER DEFAULT 1,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        image_data TEXT,
        timestamp INTEGER NOT NULL,
        hardened_to_id INTEGER DEFAULT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_chat_ts ON chat_messages(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_chat_mission ON chat_messages(mission_id);
    `);

    // ── Self-Healing Migration ──
    const missionCount = this.db.prepare('SELECT COUNT(*) as count FROM missions').get() as { count: number };
    if (missionCount.count === 0) {
      this.db.prepare("INSERT INTO missions (id, name, timestamp) VALUES (1, 'Default Mission', ?)").run(Date.now());
    }

    // Ensure mission_id column exists (for existing DBs)
    try {
      this.db.prepare('SELECT mission_id FROM chat_messages LIMIT 1').get();
    } catch {
      this.db.exec('ALTER TABLE chat_messages ADD COLUMN mission_id INTEGER DEFAULT 1');
    }

    // Ensure hardened_to_id column exists
    try {
      this.db.prepare('SELECT hardened_to_id FROM chat_messages LIMIT 1').get();
    } catch {
      this.db.exec('ALTER TABLE chat_messages ADD COLUMN hardened_to_id INTEGER DEFAULT NULL');
    }
  }

  // ── L1/L2/L3 Brain Methods ─────────────────────────────────────────────────

  async addMemory(layer: 1 | 2 | 3, content: string, metadata: object = {}) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO memories (layer, content, metadata)
        VALUES (?, ?, ?)
      `);
      const result = stmt.run(layer, content, JSON.stringify(metadata));
      return result.lastInsertRowid;
    } catch (e) {
      console.error("[MEMORY] Write failed:", e);
      return -1;
    }
  }

  async getMemories(layer?: 1 | 2 | 3, limit: number = 20) {
    let query = 'SELECT * FROM memories';
    const params: any[] = [];

    if (layer) {
      query += ' WHERE layer = ?';
      params.push(layer);
    }

    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as MemoryEntry[];
  }

  async getMetrics() {
    const l1 = this.db.prepare('SELECT COUNT(*) as count FROM memories WHERE layer = 1').get() as { count: number };
    const l2 = this.db.prepare('SELECT COUNT(*) as count FROM memories WHERE layer = 2').get() as { count: number };
    const l3 = this.db.prepare('SELECT COUNT(*) as count FROM memories WHERE layer = 3').get() as { count: number };
    const l0 = this.db.prepare('SELECT COUNT(*) as count FROM chat_messages').get() as { count: number };

    return {
      l1: l1.count,
      l2: l2.count,
      l3: l3.count,
      total: l1.count + l2.count + l3.count,
      chat: l0.count,
    };
  }

  async clearLayer(layer: number) {
    this.db.prepare('DELETE FROM memories WHERE layer = ?').run(layer);
  }

  // ── Mission Lifecycle Methods ──────────────────────────────────────────

  createMission(name: string): number {
    const stmt = this.db.prepare('INSERT INTO missions (name, timestamp) VALUES (?, ?)');
    const result = stmt.run(name, Date.now());
    return result.lastInsertRowid as number;
  }

  getMissions(): Mission[] {
    return this.db.prepare('SELECT * FROM missions ORDER BY timestamp DESC').all() as Mission[];
  }

  deleteMission(id: number) {
    if (id === 1) return; // Protected Default Mission
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM chat_messages WHERE mission_id = ?').run(id);
      this.db.prepare('DELETE FROM missions WHERE id = ?').run(id);
    })();
  }

  // ── L0 Tactical Chat Log Methods (Mission-Aware) ──────────────────────────

  addChatMessage(role: string, content: string, imageData?: string, missionId: number = 1): number {
    const stmt = this.db.prepare(`
      INSERT INTO chat_messages (mission_id, role, content, image_data, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    // Per-mission rolling window: keep max 1000 messages per session
    const countRow = this.db.prepare('SELECT COUNT(*) as count FROM chat_messages WHERE mission_id = ?').get(missionId) as { count: number };
    if (countRow.count >= 1000) {
      this.db.prepare(`
        DELETE FROM chat_messages WHERE id IN (
          SELECT id FROM chat_messages WHERE mission_id = ? ORDER BY timestamp ASC LIMIT 100
        )
      `).run(missionId);
    }

    const result = stmt.run(missionId, role, content, imageData || null, Date.now());
    return result.lastInsertRowid as number;
  }

  getChatHistory(missionId: number = 1, limit: number = 100): ChatMessage[] {
    return this.db.prepare(`
      SELECT * FROM (
        SELECT c.*, m.content as hardened_content 
        FROM chat_messages c
        LEFT JOIN memories m ON c.hardened_to_id = m.id
        WHERE c.mission_id = ? 
        ORDER BY c.timestamp DESC LIMIT ?
      ) ORDER BY timestamp ASC
    `).all(missionId, limit) as ChatMessage[];
  }

  hardenSegment(missionId: number, startId: number, endId: number, memoryId: number) {
    this.db.prepare(`
      UPDATE chat_messages 
      SET hardened_to_id = ? 
      WHERE mission_id = ? AND id >= ? AND id <= ?
    `).run(memoryId, missionId, startId, endId);
  }

  clearChatHistory() {
    this.db.prepare('DELETE FROM chat_messages').run();
  }

  purgeAllData() {
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM memories').run();
      this.db.prepare('DELETE FROM chat_messages').run();
      this.db.prepare('DELETE FROM sqlite_sequence WHERE name IN ("memories", "chat_messages")').run();
    })();
  }

  deleteChatMessage(id: number) {
    this.db.prepare('DELETE FROM chat_messages WHERE id = ?').run(id);
  }

  // ── Predictive Context Retrieval (Semantic RAG) ────────────────────────────
  // Fetches the most relevant historical memories by keyword match as a lightweight
  // semantic proxy until a full embedding model is wired in.
  getRelevantContext(query: string, topK: number = 5): string {
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    if (words.length === 0) return '';

    // Score each L2/L3 memory by keyword overlap
    const memories = this.db.prepare(`
      SELECT content FROM memories WHERE layer IN (2, 3) ORDER BY timestamp DESC LIMIT 200
    `).all() as { content: string }[];

    const scored = memories.map(m => {
      const text = m.content.toLowerCase();
      const score = words.reduce((acc, w) => acc + (text.includes(w) ? 1 : 0), 0);
      return { content: m.content, score };
    });

    return scored
      .filter(m => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(m => m.content)
      .join('\n---\n');
  }
}
