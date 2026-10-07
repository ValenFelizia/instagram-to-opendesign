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
contextBridge.exposeInMainWorld('guidedWork', {
  status: projectId => ipcRenderer.invoke('guided:request', { action: 'status', projectId }),
  plan: (projectId, taskId, taskRevision, options) => ipcRenderer.invoke('guided:request', { action: 'plan', projectId, taskId, taskRevision, options }),
  preview: (projectId, jobId) => ipcRenderer.invoke('guided:request', { action: 'preview', projectId, jobId }),
  authorize: (projectId, jobId, planHash, consent) => ipcRenderer.invoke('guided:request', { action: 'authorize', projectId, jobId, planHash, consent }),
  run: (projectId, jobId, planHash, authorization, recovery) => ipcRenderer.invoke('guided:request', { action: 'run', projectId, jobId, planHash, authorization, recovery }),
  stop: (projectId, jobId) => ipcRenderer.invoke('guided:request', { action: 'stop', projectId, jobId }),
  retry: (projectId, jobId, planHash) => ipcRenderer.invoke('guided:request', { action: 'retry', projectId, jobId, planHash }),
  reconcile: (projectId, jobId, requestId, planHash) => ipcRenderer.invoke('guided:request', { action: 'reconcile', projectId, jobId, requestId, planHash }),
  authorityCreate: (projectId, request) => ipcRenderer.invoke('guided:request', { action: 'authority-create', projectId, request }),
  authorityPreview: (projectId, taskId) => ipcRenderer.invoke('guided:request', { action: 'authority-preview', projectId, taskId }),
  authoritySelect: (projectId, taskId, revision, request, directions) => ipcRenderer.invoke('guided:request', { action: 'authority-select', projectId, taskId, revision, request, directions }),
  authorityReview: (projectId, taskId, revision, expectedKey, reviewer) => ipcRenderer.invoke('guided:request', { action: 'authority-review', projectId, taskId, revision, expectedKey, reviewer }),
  deliveryPreview: (projectId, taskId, revision, recipient) => ipcRenderer.invoke('guided:request', { action: 'delivery-preview', projectId, taskId, revision, recipient }),
  deliveryCreate: (projectId, taskId, revision, selection) => ipcRenderer.invoke('guided:request', { action: 'delivery-create', projectId, taskId, revision, selection }),
  deliveryHistory: projectId => ipcRenderer.invoke('guided:request', { action: 'delivery-history', projectId }),
  deliveryExport: (projectId, deliveryId) => ipcRenderer.invoke('guided:request', { action: 'delivery-export', projectId, deliveryId })
});
