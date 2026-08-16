# Luma chatbot

Luma is an all-purpose chatbot with a browser interface and a secure local Node.js server. The server calls the Gemini API, so your API key is never exposed to the browser.

## Run it

1. Install Node.js 18 or newer.
2. Copy `.env.example` to a new file named `.env`.
3. Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
4. Put your Gemini API key after `GEMINI_API_KEY=` in `.env`.
5. Run `npm start` from this folder.
6. Visit `http://localhost:3000` in your browser.

Gemini has a free tier with usage limits. Keep `.env` private and never paste its contents into the browser or commit it to Git.
