const path = require('path');
const { app, BrowserWindow, Menu, ipcMain } = require('electron');

function getRendererUrlForPath(routePath) {
  const safePath = typeof routePath === 'string' && routePath.startsWith('/') ? routePath : '/home';

  if (!app.isPackaged) {
    return `http://localhost:5173/#${safePath}`;
  }

  const uiDist = path.join(__dirname, '..', 'cheflive-v2-ui', 'dist');
  const indexPath = path.join(uiDist, 'index.html');
  const asUrl = new URL(`file://${indexPath.replace(/\\/g, '/')}`);
  asUrl.hash = safePath;
  return asUrl.toString();
}

/** @param {Electron.BrowserWindow} mainWindow */
function buildAppMenu(mainWindow) {
  /** @type {Electron.MenuItemConstructorOptions[]} */
  const template = [
    {
      label: 'Home',
      click: () => mainWindow.webContents.send('app:navigate', { path: '/home' }),
    },
    {
      label: 'Inventory',
      submenu: [
        {
          label: 'Ingredients',
          click: () => mainWindow.webContents.send('app:navigate', { path: '/inventory/ingredients' }),
        },
        {
          label: 'Preparations',
          click: () => mainWindow.webContents.send('app:navigate', { path: '/inventory/preparations' }),
        },
      ],
    },
    {
      label: 'Purchases',
      submenu: [
        {
          label: 'Create',
          click: () => mainWindow.webContents.send('app:navigate', { path: '/purchases/create' }),
        },
        {
          label: 'History',
          click: () => mainWindow.webContents.send('app:navigate', { path: '/purchases/history' }),
        },
      ],
    },
    {
      label: 'Transfers',
      submenu: [
        {
          label: 'Create',
          click: () => mainWindow.webContents.send('app:navigate', { path: '/transfers/create' }),
        },
        {
          label: 'History',
          click: () => mainWindow.webContents.send('app:navigate', { path: '/transfers/history' }),
        },
      ],
    },
    {
      label: 'Utilizations',
      submenu: [
        {
          label: 'Create',
          click: () => mainWindow.webContents.send('app:navigate', { path: '/utilizations/create' }),
        },
        {
          label: 'History',
          click: () => mainWindow.webContents.send('app:navigate', { path: '/utilizations/history' }),
        },
      ],
    },
    {
      label: 'Report',
      submenu: [
        {
          label: 'Purchase report',
          click: () => mainWindow.webContents.send('app:navigate', { path: '/report/purchases' }),
        },
        {
          label: 'Usage report',
          click: () => mainWindow.webContents.send('app:navigate', { path: '/report/usage' }),
        },
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'togglefullscreen' }, { role: 'close' }],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow.webContents.reload(),
        },
        { role: 'toggledevtools' },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    backgroundColor: '#0b1020',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  win.once('ready-to-show', () => win.show());

  const menu = buildAppMenu(win);
  Menu.setApplicationMenu(menu);

  if (!app.isPackaged) {
    const devUrl = 'http://localhost:5173';

    const tryLoad = async (attempt = 0) => {
      try {
        await win.loadURL(devUrl);
      } catch (err) {
        if (attempt >= 10) throw err;
        setTimeout(() => void tryLoad(attempt + 1), 300);
      }
    };

    void tryLoad();
    return win;
  }

  const uiDist = path.join(__dirname, '..', 'cheflive-v2-ui', 'dist');
  win.loadFile(path.join(uiDist, 'index.html'));
  return win;
}

app.whenReady().then(() => {
  createMainWindow();

  ipcMain.handle('app:openWindow', async (_event, payload) => {
    const routePath = payload?.path ?? '/home';
    const title = payload?.title ?? 'Cheflive';

    const child = new BrowserWindow({
      width: 900,
      height: 700,
      title,
      parent: BrowserWindow.getFocusedWindow() ?? undefined,
      modal: false,
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, 'preload.cjs'),
      },
    });

    child.once('ready-to-show', () => child.show());
    await child.loadURL(getRendererUrlForPath(routePath));
    return true;
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

