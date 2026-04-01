const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  db: {
    get: () => ipcRenderer.invoke('db:get'),
    save: (data) => ipcRenderer.invoke('db:save', data),
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },
  urssaf: {
    connect: (credentials) => ipcRenderer.invoke('urssaf:connect', credentials),
    declarer: (declaration) => ipcRenderer.invoke('urssaf:declarer', declaration),
  },
  export: {
    pdf: (content) => ipcRenderer.invoke('export:pdf', content),
    csv: (rows) => ipcRenderer.invoke('export:csv', rows),
  },
});
