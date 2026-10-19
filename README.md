# Vyom: portfolio AI chatbot (one HTML file + secure Gemini backend)

Your API key lives only in `.env` on the server. The browser talks to `/api/chat`; the server talks to Gemini.

## 1. Get a Gemini API key
1. Open https://aistudio.google.com/apikey and sign in with Google.
2. Click **Create API key** and copy it.

## 2. Install Node.js
Download the LTS version from https://nodejs.org (version 18 or newer). Check it in a terminal: `node -v`

## 3. Set up the project
```
cd vyom-chat
npm install
```
Copy `.env.example` to `.env` (Windows: `copy .env.example .env`, Mac/Linux: `cp .env.example .env`), open `.env` and paste your key after `GEMINI_API_KEY=`.

## 4. Make it yours
- `server.js`: edit the `PERSONA` text (your name, skills, projects, contact). This is what the bot knows about you.
- `public/index.html`: edit the `EDIT ME` block at the top of the script (name, owner, FAQ cards, typed lines). Colours are the `--a1`, `--a2`, `--a3` variables in the CSS.

## 5. Run it
```
npm start
```
Open **http://localhost:3000** (do not double-click index.html; the backend must serve it).

## Test checklist
1. Sidebar footer shows **Backend online**. If it says offline, the server is not running.
2. Click an FAQ card: the reply streams in word by word and the chat appears in the sidebar.
3. Ask for a Markdown table and a code block; use the **Copy** button on the code.
4. Press the stop button mid-reply, then use **Regenerate** on a finished reply.
5. Attach a photo (paperclip, drag and drop, or paste) and ask "What is in this image?"
6. Rename a chat (pencil), search for a word from it, delete it (trash, click twice).
7. Refresh the page: your chats are still there.
8. Shrink the window below 800 px: the sidebar becomes a drawer.
9. Security check: open DevTools, Network tab, send a message. The request goes to `/api/chat` and your key appears nowhere. Searching the page source for your key finds nothing.
10. Break it on purpose: put a wrong key in `.env`, restart, send a message. You should see a friendly error, not a crash.

## Troubleshooting
- **Gemini rejected the request**: check the key and `GEMINI_MODEL` in `.env` (model names change; pick a current one in AI Studio).
- **Quota or busy message**: free keys have per-minute limits. Wait and retry.
- **Port in use**: change `PORT` in `.env`.

## Putting it on your portfolio
1. Deploy this folder to a Node host (Render, Railway, Fly.io). Set `GEMINI_API_KEY` in the host's environment settings, not in a file you upload.
2. Easiest: link to the deployed URL from your portfolio, or embed it with `<iframe src="https://your-app.example.com" style="width:100%;height:80vh;border:0"></iframe>`.
3. To host the HTML elsewhere instead, set `const API='https://your-app.example.com'` in `index.html` and `ALLOWED_ORIGIN=https://your-portfolio.com` in the server's environment.
