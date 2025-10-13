# MAKE-A-Scene

AI-powered scene creator with character management, TTS generation, and audio mixing.

## Architecture

- **Frontend** - React interface for character creation and audio mixing
- **Backend** - FastAPI service for TTS, character management, and audio processing  
- **Script Mixer** - AI agent for script generation and scene creation

## Quick Start

```bash
cp .env.example .env
# Add your API keys to .env
docker-compose up
```

Access at http://localhost:3000

## API Keys Required

- `GEMINI_KEY` - AI script generation
- `MURF_API_KEY` - Text-to-speech via Murf AI
- `FREESOUND_API_KEY` - Sound effects

Built with FastAPI, React, and Docker.