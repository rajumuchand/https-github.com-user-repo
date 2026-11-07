# Cyber Security App

## Run locally

Requires Node.js 22.9 or newer. Create a local `.env` file based on `.env.example`, then add your OpenAI API key. Keep `.env` private; it is excluded from Git.

Start the app with:

```sh
npm start
```

For one-click startup in VS Code, open [main.js](./main.js) and click the Run button. The file loads `.env` when present and starts the existing server.

Open `http://127.0.0.1:3000` on this computer to view the ARGOS ATLAS HUD demo. The original security console remains available at `http://127.0.0.1:3000/index.html`. To use the app from a phone or another computer on the same trusted Wi-Fi network, find this computer's LAN address with `ipconfig getifaddr en0` on macOS, then open `http://<LAN-IP>:3000` on the other device. Keep the server running and allow incoming connections through the computer's firewall if prompted.

The server listens on all network interfaces by default for same-network access. Set `HOST=127.0.0.1` in `.env` to restrict it to this computer. The app has no sign-in; do not expose port 3000 to the public internet or an untrusted network. Without an API key, the on-device checker still works. Hosted AI is disabled until the server detects an `OPENAI_API_KEY` value in `.env`.

## Privacy

Hosted AI is off by default. When enabled, the current message and up to 10 recent chat turns are sent through the local server to OpenAI. Requests use `store: false`; the API key stays on the server and is never sent to the browser. The local checker does not send chat text to OpenAI. OpenAI API usage may incur charges. If a shell-level `OPENAI_API_KEY` is already set, it takes precedence over the value in `.env`.
