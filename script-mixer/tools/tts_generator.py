from typing import Optional
from langchain.tools import BaseTool
from langchain.callbacks.manager import CallbackManagerForToolRun
import requests
import os
import re
import base64
from dotenv import load_dotenv

# Load .env from parent directory
load_dotenv(dotenv_path="../../.env")

class TTSGeneratorTool(BaseTool):
    name: str = "tts_generator"
    description: str = "Generate text-to-speech audio for character dialogues using Murf API"
    
    def _run(self, query: str, run_manager: Optional[CallbackManagerForToolRun] = None) -> str:
        """Generate TTS for character dialogues using Murf API"""
        try:
            # Parse dialogues from query
            dialogue_pattern = r'([A-Z][A-Z\s]+):\s*"([^"]+)"'
            matches = re.findall(dialogue_pattern, query)
            
            if not matches:
                return "No dialogues found for TTS generation."
            
            generated_files = []
            murf_api_key = os.getenv("MURF_API_KEY")
            
            if not murf_api_key:
                return "Error: MURF_API_KEY not found"
            
            headers = {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "api-key": murf_api_key
            }
            
            for i, (character, dialogue) in enumerate(matches):
                try:
                    # Generate TTS for each dialogue using Murf API
                    payload = {
                        "voiceId": "en-US-davis",
                        "style": "Conversational",
                        "text": dialogue,
                        "rate": 0,
                        "pitch": 0,
                        "sampleRate": 48000,
                        "format": "MP3",
                        "channelType": "MONO"
                    }
                    
                    response = requests.post(
                        "https://api.murf.ai/v1/speech/generate",
                        headers=headers,
                        json=payload
                    )
                    
                    if response.status_code == 200:
                        response_data = response.json()
                        audio_url = response_data.get("audioFile")
                        
                        if audio_url:
                            # Download and save the audio file
                            audio_response = requests.get(audio_url)
                            if audio_response.status_code == 200:
                                filename = f"tts_{character.lower().replace(' ', '_')}_{i}.mp3"
                                filepath = f"tts_audio/{filename}"
                                
                                # Ensure directory exists
                                os.makedirs("tts_audio", exist_ok=True)
                                
                                # Save audio file
                                with open(filepath, "wb") as f:
                                    f.write(audio_response.content)
                                
                                generated_files.append({
                                    'character': character,
                                    'dialogue': dialogue,
                                    'filename': filename,
                                    'filepath': filepath
                                })
                    
                except Exception as e:
                    print(f"Error generating TTS for {character}: {e}")
                    continue
            
            if generated_files:
                result = "Generated TTS Files:\n"
                for file_info in generated_files:
                    result += f"- {file_info['character']}: {file_info['filename']}\n"
                return result
            else:
                return "No TTS files were generated successfully."
            
        except Exception as e:
            return f"Error generating TTS: {str(e)}"