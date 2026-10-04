const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, utilityProcess, session, dialog, safeStorage } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { CHANNEL, UPDATES, validRequest, trustedSender, workerEnvironment } = require('./protocol.cjs');
const { Supervisor } = require('./supervisor.cjs');
const { Workspace } = require('./workspace.cjs');
const { Credentials } = require('./credentials.cjs');
const { BROKER, Broker } = require('./broker.cjs');

app.setName('Instagram to OpenDesign');
// Test launches isolate Chromium files; this argument is not exposed through renderer IPC.
const testData = process.argv.find(arg => arg.startsWith('--shell-test-data='));
if (testData && path.isAbsolute(testData.slice(18))) app.setPath('userData', testData.slice(18));
const hidden = process.argv.includes('--shell-test-hidden');
let window = null;
let tray = null;
let supervisor = null;
let exiting = false;
let allowQuit = false;
let closeExplained = false;
let startupStep = 'ready';
const documentUrl = pathToFileURL(path.join(__dirname, 'ui', 'index.html')).href;
const allowedFiles = new Set(['index.html', 'app.js', 'workspace.js', 'styles.css'].map(name => pathToFileURL(path.join(__dirname, 'ui', name)).href));

function openWindow() {
  if (exiting) return;
  if (!app.isReady()) { app.once('ready', openWindow); return; }
  if (window && !window.isDestroyed()) { if (window.isMinimized()) window.restore(); if (!hidden) window.show(); window.focus(); return; }
  window = new BrowserWindow({
    width: 900, height: 650, minWidth: 360, minHeight: 450, show: false,
    backgroundColor: '#f6f7f8', title: 'Instagram to OpenDesign',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), sandbox: true,
      contextIsolation: true, nodeIntegration: false, webSecurity: true, webviewTag: false, devTools: false }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (url !== documentUrl) event.preventDefault(); });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  const ownedWindow = window;
  window.webContents.on('render-process-gone', () => { if (!ownedWindow.isDestroyed()) ownedWindow.destroy(); });
  window.on('close', event => {
    if (exiting || closeExplained) return;
    event.preventDefault();
    window.webContents.send('app-shell:closing');
  });
  window.on('closed', () => { if (window === ownedWindow) window = null; });
  window.once('ready-to-show', () => { if (!hidden) window.show(); });
  window.loadURL(documentUrl);
}

async function exit() {
  if (exiting) return;
  exiting = true;
  await supervisor?.shutdown();
  allowQuit = true;
  tray?.destroy();
  app.quit();
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', openWindow);
  app.on('activate', openWindow);
  app.on('window-all-closed', () => {});
  app.on('before-quit', event => { if (!allowQuit) { event.preventDefault(); void exit(); } });
  app.whenReady().then(() => {
    startupStep = 'permissions';
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !allowedFiles.has(details.url) }));
    session.defaultSession.on('will-download', event => event.preventDefault());
    startupStep = 'workspace';
    // Test profiles are isolated; normal projects live outside browser data and the checkout.
    const localData = process.env.LOCALAPPDATA && path.isAbsolute(process.env.LOCALAPPDATA) ? process.env.LOCALAPPDATA : path.join(app.getPath('home'), 'AppData', 'Local');
    const localRoot = testData ? path.join(app.getPath('userData'), 'workspace') : path.join(localData, 'Instagram to OpenDesign', 'workspace');
    const workspace = new Workspace(localRoot);
    const credentials = new Credentials(path.join(localRoot, 'credentials'), safeStorage);
    ipcMain.handle(BROKER, (event, request) => {
      const authorized = () => trustedSender(event, window, documentUrl) && !exiting;
      if (!authorized()) return { ok: false, code: 'request-unavailable' };
      const broker = new Broker(workspace, credentials, dialog, { window: () => window, authorized,
        forbidden: [path.join(localRoot, 'credentials'), app.getAppPath()], importForbidden: [localRoot] });
      return broker.handle(request);
    });
    startupStep = 'supervisor';
    supervisor = new Supervisor(() => utilityProcess.fork(path.join(__dirname, 'worker.cjs'), [], {
      env: workerEnvironment(process.env), stdio: 'ignore', serviceName: 'Local shell check'
    }));
    supervisor.on('state', state => { if (window && !window.isDestroyed()) window.webContents.send(UPDATES, state); });
    ipcMain.handle(CHANNEL, (event, request) => {
      if (!trustedSender(event, window, documentUrl) || !validRequest(request) || exiting) return { ok: false, code: 'request-unavailable' };
      if (request.action === 'status') return { ok: true, state: supervisor.snapshot() };
      if (request.action === 'start-check') return { ok: supervisor.start(), state: supervisor.snapshot() };
      if (request.action === 'exit') { void exit(); return { ok: true }; }
    });
    ipcMain.on('app-shell:close-confirmed', event => {
      if (!trustedSender(event, window, documentUrl) || exiting) return;
      closeExplained = true;
      window.close();
    });
    // An authored bitmap keeps packaging independent of private logos or remote assets.
    startupStep = 'tray';
    const pixels = Buffer.alloc(16 * 16 * 4);
    for (let i = 0; i < pixels.length; i += 4) { pixels[i] = 54; pixels[i + 1] = 91; pixels[i + 2] = 39; pixels[i + 3] = 255; }
    tray = new Tray(nativeImage.createFromBuffer(pixels, { width: 16, height: 16 }));
    tray.setToolTip('Instagram to OpenDesign');
    tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Abrir', click: openWindow }, { type: 'separator' }, { label: 'Salir', click: exit }]));
    tray.on('double-click', openWindow);
    startupStep = 'menu';
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: 'Aplicación', submenu: [{ label: 'Abrir', accelerator: 'Ctrl+Shift+O', click: openWindow },
        { label: 'Salir', accelerator: 'Ctrl+Q', click: exit }] },
      { label: 'Editar', submenu: [{ role: 'copy', label: 'Copiar' }, { role: 'selectAll', label: 'Seleccionar todo' }] },
      { label: 'Vista', submenu: [{ role: 'resetZoom', label: 'Tamaño original' }, { role: 'zoomIn', label: 'Acercar' }, { role: 'zoomOut', label: 'Alejar' }] }
    ]));
    startupStep = 'worker';
    supervisor.boot();
    startupStep = 'window';
    openWindow();
  }).catch(error => { console.error(`APP_SHELL_START_FAILED:${startupStep}:${error.name}`); allowQuit = true; app.exit(1); });
}
