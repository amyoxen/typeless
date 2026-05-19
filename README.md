# VoiceCraft Dictation

A Typeless-inspired desktop dictation app built with Electron, React, and OpenAI.

## Features

- Record microphone audio from a desktop app
- Transcribe speech with OpenAI speech-to-text
- Polish dictated speech into clean written text
- Remove filler words and repetition
- Tone modes: natural, professional, short, friendly, email, notes
- Copy polished text to the clipboard
- Global shortcut: `Ctrl+Shift+Space`

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env` from `.env.example` and add your OpenAI API key:

   ```bash
   cp .env.example .env
   ```

3. Start the app:

   ```bash
   npm run dev
   ```

## Notes

The OpenAI API key is read by Electron's main process and is not exposed to the React UI.
