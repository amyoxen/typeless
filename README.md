# VoiceCraft Dictation

A Typeless-inspired desktop dictation app built with Electron, React, and OpenAI.

## Features

- Record microphone audio from a desktop app
- Pop up dictation with the left `Alt` key
- Press the hotkey again to stop recording and paste into the active field
- Transcribe speech with OpenAI speech-to-text
- Polish dictated speech into clean written text
- Remove filler words and repetition
- Tone modes: natural, professional, short, friendly, email, notes
- Copy polished text to the clipboard
- Optional auto-paste toggle

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

## Dictation Flow

1. Click into any text field in another app.
2. Press the left `Alt` key.
3. Speak while the VoiceCraft pop-up is recording.
4. Press the left `Alt` key again.
5. VoiceCraft transcribes, polishes, hides the pop-up, and pastes the result.

## Notes

The OpenAI API key is read by Electron's main process and is not exposed to the React UI.
