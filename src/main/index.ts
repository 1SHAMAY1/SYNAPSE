import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { MemoryEngine } from './memory/engine.js';
import { SwarmCoordinator } from './swarm/coordinator.js';
import { ModelProvider } from './llm/provider.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let coordinator: SwarmCoordinator | null = null;
let memory: MemoryEngine | null = null;

// ── Persistence Logic ────────────────────────────────────────────────────────

const getDefaultConfig = () => ({
  system: {
    sqlite_db_path: 'synapse_memory.db',
    server_name: 'SYNAPSE-Swarm',
    server_version: '1.2.0',
    recursive_threshold: 100
  },
  providers: [],
  default_provider_alias: ''
});

const loadConfig = (rootPath: string) => {
  try {
    const configPath = path.join(rootPath, 'synapse_config.json');
    if (!fs.existsSync(configPath)) {
      const defaultConfig = getDefaultConfig();
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
      return defaultConfig;
    }
    const content = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(content || '{}');
    return config;
  } catch (e) {
    console.error("[CONFIG] Load failed:", e);
    return getDefaultConfig();
  }
};

const saveConfig = (rootPath: string, newConfig: any) => {
  fs.writeFileSync(path.join(rootPath, 'synapse_config.json'), JSON.stringify(newConfig, null, 2));
};

// ── Application Lifecycle ────────────────────────────────────────────────────

async function createWindow() {
  const rootPath = app.isPackaged ? app.getPath('userData') : process.cwd();
  const config = loadConfig(rootPath);
  const dbPath = path.join(rootPath, config.system.sqlite_db_path || 'synapse_memory.db');

  // ── 1. Initialize Core Intelligence First (Avoid Race Conditions) ──
  try {
    console.log(`[BOOT] Anchoring Swarm Intelligence at: ${dbPath}`);
    memory = new MemoryEngine(dbPath);
    coordinator = new SwarmCoordinator(memory, config);
    ModelProvider.getInstance().loadFromConfig(config);

    // Relay Thoughts to Dashboard Trace
    coordinator.onThought((thought) => {
      mainWindow?.webContents.send('swarm_thought', thought);
    });

    // Relay Agent Chat Messages to UI
    coordinator.onMessage((message) => {
      mainWindow?.webContents.send('swarm_message', message);
    });
    console.log("[BOOT] Coordinator Operational.");
  } catch (e) {
    console.error("[CORE] Initialization failed:", e);
  }

  // ── 2. Create Tactical Interface ──
  const preloadPath = app.isPackaged
    ? path.join(__dirname, '../preload/index.js')
    : path.resolve(__dirname, '../../dist/preload/index.js');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 950,
    backgroundColor: '#000000',
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─── IPC Handlers ────────────────────────────────────────────────────────────

ipcMain.handle('get_config', async () => {
  const rootPath = app.isPackaged ? app.getPath('userData') : process.cwd();
  return loadConfig(rootPath);
});

ipcMain.handle('save_config', async (_, newConfig) => {
  const rootPath = app.isPackaged ? app.getPath('userData') : process.cwd();
  saveConfig(rootPath, newConfig);
  if (memory && newConfig && coordinator) {
    ModelProvider.getInstance().loadFromConfig(newConfig);
    coordinator.updateConfig(newConfig);
  }
  return { success: true };
});

ipcMain.handle('window_minimize', () => mainWindow?.minimize());
ipcMain.handle('window_toggle_maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow?.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.handle('window_close', () => mainWindow?.close());

// ── Swarm Query (with optional image passthrough) ─────────────────────────────
ipcMain.handle('query_swarm', async (_, { task, providerLabel, imageData, sessionId }) => {
  if (!coordinator) throw new Error('Coordinator not initialized');
  // Persist user message to L0 Tactical Log
  memory?.addChatMessage('user', task, imageData, sessionId);
  return await coordinator.executeTask(task, providerLabel, imageData, sessionId || 1);
});

ipcMain.handle('interject_swarm', async (_, { message, sessionId }) => {
  if (!coordinator) return { success: false };
  coordinator.interject(message, sessionId || 1);
  return { success: true };
});

ipcMain.handle('get_swarm_status', async () => {
  if (!coordinator) return [];
  return coordinator.getPopulationStatus();
});

ipcMain.handle('get_memories', async (_, { layer, limit }) => {
  if (!memory) return [];
  return await memory.getMemories(layer, limit);
});

ipcMain.handle('get_system_metrics', async () => {
  if (!memory) return { l1: 0, l2: 0, l3: 0, total: 0, chat: 0 };
  return await memory.getMetrics();
});

// ── L0 Chat Persistence Handlers ──────────────────────────────────────────────
ipcMain.handle('get_chat_history', async (_, { missionId }) => {
  if (!memory) return [];
  return memory.getChatHistory(missionId || 1, 100);
});

ipcMain.handle('save_chat_message', async (_, { role, content, imageData, sessionId }) => {
  if (!memory) return -1;
  return memory.addChatMessage(role, content, imageData, sessionId || 1);
});

ipcMain.handle('clear_chat_history', async () => {
  if (!memory) return { success: false };
  memory.clearChatHistory();
  return { success: true };
});

ipcMain.handle('delete_chat_message', async (_, { id }) => {
  if (!memory) return { success: false };
  memory.deleteChatMessage(id);
  return { success: true };
});

ipcMain.handle('purge_all_data', async () => {
  if (!memory) return { success: false };
  memory.purgeAllData();
  return { success: true };
});

// ── Mission Lifecycle Handlers ───────────────────────────────────────────────
ipcMain.handle('get_missions', async () => {
  if (!memory) return [];
  return memory.getMissions();
});

ipcMain.handle('create_mission', async (_, { name }) => {
  if (!memory) return -1;
  return memory.createMission(name);
});

ipcMain.handle('delete_mission', async (_, { id }) => {
  if (!memory) return { success: false };
  memory.deleteMission(id);
  return { success: true };
});
