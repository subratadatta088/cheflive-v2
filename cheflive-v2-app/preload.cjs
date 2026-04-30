const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cheflive', {
  onNavigate: (handler) => {
    if (typeof handler !== 'function') return () => {};
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('app:navigate', listener);
    return () => ipcRenderer.removeListener('app:navigate', listener);
  },
  openWindow: (payload) => ipcRenderer.invoke('app:openWindow', payload),
});

