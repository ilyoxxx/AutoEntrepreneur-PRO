const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Data storage path
const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'data.json');

// Initialize DB
function initDB() {
  if (!fs.existsSync(dbPath)) {
    const defaultData = {
      profile: {
        nom: '',
        prenom: '',
        siret: '',
        activite: 'BIC', // BIC, BNC, SERVICE
        adresse: '',
        email: '',
        urssafConnected: false,
        urssafToken: null,
      },
      factures: [],
      declarations: [],
      clients: [],
      settings: {
        tauxBIC: 12.3,
        tauxBNC: 21.2,
        tauxSERVICE: 21.2,
        autoCalcul: true,
      }
    };
    fs.writeFileSync(dbPath, JSON.stringify(defaultData, null, 2));
  }
  return JSON.parse(fs.readFileSync(dbPath));
}

function saveDB(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0a0a0f',
    icon: path.join(__dirname, 'public', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile('src/index.html');

  // Open links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─── IPC Handlers ───────────────────────────────────────────────────────────

ipcMain.handle('db:get', () => initDB());

ipcMain.handle('db:save', (_, data) => {
  saveDB(data);
  return true;
});

ipcMain.handle('window:minimize', () => mainWindow.minimize());
ipcMain.handle('window:maximize', () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.handle('window:close', () => mainWindow.close());

// URSSAF OAuth simulation (real integration requires URSSAF API credentials)
ipcMain.handle('urssaf:connect', async (_, credentials) => {
  // In production: OAuth2 flow with URSSAF API
  // https://developer.urssaf.fr
  await new Promise(r => setTimeout(r, 1500));
  if (credentials.siret && credentials.password) {
    return { success: true, token: 'urssaf_token_' + Date.now() };
  }
  return { success: false, error: 'Identifiants incorrects' };
});

ipcMain.handle('urssaf:declarer', async (_, declaration) => {
  // In production: POST to URSSAF API with declaration data
  await new Promise(r => setTimeout(r, 2000));
  return {
    success: true,
    reference: 'DECL-' + Date.now(),
    montantDu: declaration.cotisations,
    dateEcheance: declaration.dateEcheance,
  };
});

ipcMain.handle('export:pdf', async (_, content) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: `facture-${Date.now()}.html`,
    filters: [{ name: 'HTML', extensions: ['html'] }],
  });
  if (filePath) {
    fs.writeFileSync(filePath, content);
    shell.openPath(filePath);
    return { success: true };
  }
  return { success: false };
});

ipcMain.handle('export:csv', async (_, rows) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: `export-${Date.now()}.csv`,
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  });
  if (filePath) {
    fs.writeFileSync(filePath, rows);
    return { success: true };
  }
  return { success: false };
});
