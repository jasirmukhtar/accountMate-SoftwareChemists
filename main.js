const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let mainWindow;
let serverProcess;

function startServer() {
  serverProcess = fork(path.join(__dirname, 'backend/server.js'), [], {
    env: { ...process.env, NODE_ENV: 'production' }
  });
  serverProcess.on('message', (msg) => {
    if (msg === 'ready') createWindow();
  });
  serverProcess.on('error', (err) => console.error('Server error:', err));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    title: 'AccountMate',
    icon: path.join(__dirname, 'frontend/assets/icon.png'),
    show: false,
    backgroundColor: '#0f0f14'
  });

  mainWindow.loadURL('http://localhost:3737');
  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(startServer);

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});