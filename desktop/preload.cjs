const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('localWorkspace', {
  list: () => ipcRenderer.invoke('workspace:request', { action: 'list' }),
  create: (name, url, location) => ipcRenderer.invoke('workspace:request', { action: 'create', name, url, location }),
  pickImport: () => ipcRenderer.invoke('workspace:request', { action: 'pick-import' }),
  cancelImport: () => ipcRenderer.invoke('workspace:request', { action: 'cancel-import' }),
  importCopy: (name, url, token) => ipcRenderer.invoke('workspace:request', { action: 'import', name, url, token }),
  open: id => ipcRenderer.invoke('workspace:request', { action: 'open', id }),
  exportBackup: id => ipcRenderer.invoke('workspace:request', { action: 'export', id, scope: 'project-backup' }),
  trash: id => ipcRenderer.invoke('workspace:request', { action: 'trash', id, scope: 'project' }),
  restore: id => ipcRenderer.invoke('workspace:request', { action: 'restore', id }),
  credentialStatus: () => ipcRenderer.invoke('workspace:request', { action: 'credential-status' }),
  saveCredential: (provider, key) => ipcRenderer.invoke('workspace:request', { action: 'credential-save', provider, key }),
  removeCredential: provider => ipcRenderer.invoke('workspace:request', { action: 'credential-remove', provider })
});
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
