<h1 align="center">Soffy</h1>

<p align="center">
  <img src="./assets/brand/soffy-icon.svg" alt="Soffy" width="112" height="112" />
</p>

<p align="center">
  <strong>Project commands, from the menu bar.</strong>
</p>

<p align="center">
  Add a folder. Soffy finds the scripts.<br />
  Start, stop, and restart with a click.<br />
  See status, logs, and the port it opened.
</p>

---

Soffy lives in the macOS menu bar. Favorites sit in the popover. Everything else lives in a small window. Close the popover and the process keeps running. Quit Soffy and it shuts down what it started.

No account. No cloud. No team. It only manages processes it launched.

---

## What it actually does

**Detects the commands you already have**  
Drop in a project folder. Soffy reads `package.json` first, then Make, Just, Task, Cargo, Compose, and the rest as detectors land. Custom commands sit next to the detected ones.

**Play, stop, restart**  
One click starts a command. Stop signals the whole process group, not just the parent PID. Restart is stop then start. The popover shows running time and state.

**Logs without a terminal**  
stdout and stderr stream into a window. Search, copy, clear. Autoscroll pauses when you scroll up.

**Ports you can open**  
Soffy watches logs for URLs and confirms listening sockets on the process tree. Open the one that is actually yours.

**Favorites in the bar, the rest in the app**  
The menu bar stays a glance: a few pinned commands and whatever is running. The window holds every project.

---

## Built for

- People who keep a stack of `npm run dev` tabs open
- Local servers you want to start from the bar and forget until you need the URL
- Folders with too many scripts to remember which one is the real entry

---

## Not this

Soffy is not a full terminal, a remote runner, or a cloud dashboard. It does not SSH, schedule jobs, or sync across machines. Windows and Linux come after macOS.

---

<p align="center">
  <sub>Local. Personal. macOS first.</sub>
</p>
