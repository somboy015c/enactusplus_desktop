# EnactusNG Plus – Desktop app (Windows + macOS)

A real app with its own screens (splash with the web spinner, 3-slide welcome, timeline, connect, messages, projects…).
It does **not** load the website: the interface is inside the app and only the data comes from your Plus server.
Everything is built by GitHub Actions – you never run a command.

## 1. Upload ONE server file (needed for the desktop app)
Upload `server-patch/enactus_core/plus/api.php` to your server, replacing `enactus_core/plus/api.php`.
It only adds the desktop app to the list of allowed apps (CORS). The Android app does not need this.

## 2. Set up (once, in the browser only)
1. Create a **private** GitHub repository and upload the *contents* of this folder (include the hidden `.github` folder).
2. Open `app.config.json`: `plusUrl` is `https://plus.enactus.org.ng`. Change it only if your Plus address is different.
3. Open the **Actions** tab – the build starts automatically (about 10–15 minutes).
4. Open **Releases**: **EnactusNGPlus.exe** (Windows) and **EnactusNGPlus.dmg** (macOS).

## Customising
- Splash background: `src/assets/img/splash-bg.jpg` (same file name). Colours and buttons: `src/assets/native.css`.
- Welcome slides: `src/index.html` (search for `b-slide`).
- The timeline, chat, projects etc. are your own `src/assets/app.js` and `plus.css`; when you update them on the website, copy the new files here.
