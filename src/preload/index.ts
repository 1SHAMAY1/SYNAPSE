import { contextBridge, ipcRenderer } from 'electron';

const listeners = new Map<string, any>();

contextBridge.exposeInMainWorld('ipcRenderer', {
  invoke: (channel: string, data?: any) => ipcRenderer.invoke(channel, data),
  on: (channel: string, func: (...args: any[]) => void) => {
    const wrapper = (_event: any, ...args: any[]) => func(...args);
    listeners.set(channel + func.toString(), wrapper);
    ipcRenderer.on(channel, wrapper);
  },
  removeListener: (channel: string, func: (...args: any[]) => void) => {
    const key = channel + func.toString();
    const wrapper = listeners.get(key);
    if (wrapper) {
      ipcRenderer.removeListener(channel, wrapper);
      listeners.delete(key);
    }
  },
  minimize: () => ipcRenderer.invoke('window_minimize'),
  close: () => ipcRenderer.invoke('window_close'),
});
