# Luma chatbot

Luma is an all-purpose chatbot with a browser interface and a secure local Node.js server. The server calls the OpenAI Responses API, so your API key is never exposed to the browser.

## Run it

1. Install Node.js 18 or newer.
2. Copy `.env.example` to a new file named `.env`.
3. Put your OpenAI API key after `OPENAI_API_KEY=` in `.env`.
4. Run `npm start` from this folder.
5. Visit `http://localhost:3000` in your browser.

The OpenAI API is billed separately from ChatGPT subscriptions. Keep `.env` private and never paste its contents into the browser or commit it to Git.
