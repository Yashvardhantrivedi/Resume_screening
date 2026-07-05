const { app, BrowserWindow, utilityProcess, shell, dialog } = require("electron");
const path = require("path");
const http = require("http");

const PORT = 3210;
const URL = `http://127.0.0.1:${PORT}`;

let serverProc = null;
let mainWindow = null;

function serverDir() {
  // Packaged: standalone server ships in Resources/app. Dev: use the local build.
  return app.isPackaged
    ? path.join(process.resourcesPath, "app")
    : path.join(__dirname, "..", ".next", "standalone");
}

function startServer() {
  const dir = serverDir();
  serverProc = utilityProcess.fork(path.join(dir, "server.js"), [], {
    cwd: dir,
    stdio: "pipe",
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      // Keep the database + uploaded resumes in the OS per-user data folder,
      // NOT inside the installed app (which is read-only on macOS/Windows).
      DATA_DIR: path.join(app.getPath("userData"), "data"),
    },
  });
  serverProc.stdout?.on("data", (d) => console.log("[server]", String(d).trim()));
  serverProc.stderr?.on("data", (d) => console.error("[server]", String(d).trim()));
}

function waitForServer(retries = 120) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      const req = http.get(URL, (res) => {
        res.resume();
        resolve(undefined);
      });
      req.on("error", () => {
        if (n <= 0) reject(new Error("Server did not start in time"));
        else setTimeout(() => attempt(n - 1), 500);
      });
      req.setTimeout(1000, () => req.destroy());
    };
    attempt(retries);
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    title: "ResumeRank",
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  // External links (LinkedIn/GitHub profiles, provider key pages) open in the browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http") && !url.startsWith(URL)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  try {
    await waitForServer();
    await mainWindow.loadURL(URL);
    mainWindow.show();
  } catch (err) {
    dialog.showErrorBox(
      "ResumeRank failed to start",
      `The internal server did not start.\n\n${err.message}`
    );
    app.quit();
  }
}

app.whenReady().then(() => {
  startServer();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  if (serverProc) serverProc.kill();
});
