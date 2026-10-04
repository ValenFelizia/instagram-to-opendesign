const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('appShell', {
  status: () => ipcRenderer.invoke('app-shell:request', { action: 'status' }),
  startCheck: () => ipcRenderer.invoke('app-shell:request', { action: 'start-check' }),
  exit: () => ipcRenderer.invoke('app-shell:request', { action: 'exit' }),
  confirmClose: () => ipcRenderer.send('app-shell:close-confirmed'),
  onState: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('app-shell:state', listener);
    return () => ipcRenderer.removeListener('app-shell:state', listener);
  },
  onClosing: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = () => callback();
    ipcRenderer.on('app-shell:closing', listener);
    return () => ipcRenderer.removeListener('app-shell:closing', listener);
  }
});
