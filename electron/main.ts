import { app, BrowserWindow, clipboard, Menu, nativeImage, Notification, Tray } from 'electron'
import path from 'node:path'
import ImgNoMes from '../src/assets/nomes.png';
import ImgNewMes from '../src/assets/newmes.png';
//import SoundNewMess from '../src/assets/newmes.mp3';

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

let lastMessageWithTime: string = '';

let win: BrowserWindow | null
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())

  })



  let interval: NodeJS.Timeout;
  let setNewMesasge: boolean = false;
  let hasNewMessage: boolean = false;
  let windowsIsNotFocus: boolean = false;

  /*
  setTimeout(() => {
    if (windowsIsNotFocus) {
      hasNewMessage = true;
      flashTray();
    }
  }, 3000)
  */

  const iconNoMes = nativeImage.createFromDataURL(ImgNoMes);
  const iconNewMes = nativeImage.createFromDataURL(ImgNewMes);

  const tray = new Tray(iconNoMes)

  function flashTray() {
    if (!hasNewMessage) return;

    win?.flashFrame(true);
    clearInterval(interval);
    interval = setInterval(() => {
      if (setNewMesasge) {
        tray.setImage(iconNewMes);
      } else {
        tray.setImage(iconNoMes);
      }
      setNewMesasge = !setNewMesasge;
    }, 500)
  }

  win.on("blur", () => {
    windowsIsNotFocus = true;
  });

  win.on("focus", () => {
    windowsIsNotFocus = false;
    hasNewMessage = false;
    clearInterval(interval);
    tray.setImage(iconNoMes);
    win?.flashFrame(false);
  });

  //win.setIcon(trayIcon);


  tray.on("click", () => {
    if (win?.isMinimized() == true) {
      win?.restore();
      win?.focus();
      hasNewMessage = false;
      clearInterval(interval);
    }
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(process.env.DIST, 'index.html'))

  }

  win.setMenu(getMenu(win));

  setInterval(async () => {

    const accountName: string = await win?.webContents.executeJavaScript('document.querySelectorAll(".bx-im-navigation__user_container .bx-im-avatar__container")[0]?.title');
    const chatWith = await win?.webContents.executeJavaScript('document.querySelector(".bx-im-chat-header__title .bx-im-chat-title__text")?.innerText');
    const lastTimeMessage = await win?.webContents.executeJavaScript('Array.from(document.querySelectorAll("div.bx-im-message-status__date")).at(-1)?.innerText');
    const lastMessage: string = await win?.webContents.executeJavaScript('Array.from(document.querySelectorAll("div.bx-im-message-default-content__text")).at(-1)?.innerText');
    const lastMessageSendedFrom: string = await win?.webContents.executeJavaScript('Array.from(document.querySelectorAll(".bx-im-avatar__container")).at(-1)?.title');

    if (lastTimeMessage + lastMessage != lastMessageWithTime) {

      lastMessageWithTime = lastTimeMessage + lastMessage;

      if (windowsIsNotFocus && accountName != lastMessageSendedFrom) {
        showNotification(win, `Изменения в чате с ${chatWith}`, lastMessage);
        hasNewMessage = true;
        flashTray();
      }

    }
  }, 5000);

}

function showNotification(win: BrowserWindow | null, title: string, body: string) {
  if (Notification.isSupported()) { // Проверка поддержки уведомлений
    const notification = new Notification({
      title: title,
      body: body
      // Здесь вы можете добавить другие опции, например, иконку
    });

    notification.show();

    notification.on('click', () => {
      if (win?.isMinimized() == true) {
        win?.restore();
        win?.focus();
      }
    });
  } else {
    console.log('Уведомления не поддерживаются на этой платформе');
  }
}

function getMenu(win: BrowserWindow): Menu {
  const menu = Menu.buildFromTemplate([{
    label: 'Меню', submenu: [
      {
        label: 'Перейти по адесу в буфере', click() {
          win.loadURL(clipboard.readText());
        }
      },{
        label: 'Убрать панель слева', click() {
          win.webContents.executeJavaScript('document.querySelector(".bx-im-messenger__list_container").remove()');
        }
      },
      {
        label: 'Отладка', click() {
          win.webContents.openDevTools();
        }
      }
    ]
  }]);
  return menu;
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)
