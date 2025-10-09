from typing import Optional
from langchain.tools import BaseTool
from langchain.callbacks.manager import CallbackManagerForToolRun
import os
import re
from pydub import AudioSegment
from pydub.generators import Sine
import requests

class AudioMixerTool(BaseTool):
    name: str = "audio_mixer"
    description: str = "Mix audio files using PyDub to create final scene"
    
    def _run(self, query: str, run_manager: Optional[CallbackManagerForToolRun] = None) -> str:
        """Mix all audio elements into final scene using PyDub with sequential ordering"""
        try:
            os.makedirs("mixed_scenes", exist_ok=True)
            
            # Parse audio elements in script order
            audio_sequence = []
            lines = query.split('\n')
            
            for line in lines:
                # Find TTS files
                tts_match = re.search(r'tts_[\w\-]+\.mp3', line)
                if tts_match:
                    audio_sequence.append(('tts', tts_match.group()))
                
                # Find sound effects
                sfx_match = re.search(r'sounds/[\w\-]+\.(mp3|wav)', line)
                if sfx_match:
                    audio_sequence.append(('sfx', sfx_match.group()))
            
            if not audio_sequence:
                return "No audio files found to mix."
            
            # Build sequential audio
            mixed_audio = AudioSegment.empty()
            
            for audio_type, filename in audio_sequence:
                try:
                    if audio_type == 'tts':
                        audio_path = f"tts_audio/{filename}"
                        if os.path.exists(audio_path):
                            audio_clip = AudioSegment.from_mp3(audio_path)
                            mixed_audio += audio_clip
                    
                    elif audio_type == 'sfx':
                        if os.path.exists(filename):
                            sfx_clip = AudioSegment.from_file(filename)
                            # Limit SFX duration to 3 seconds max
                            if len(sfx_clip) > 3000:
                                sfx_clip = sfx_clip[:3000]
                            mixed_audio += sfx_clip - 5  # Reduce volume slightly
                            
                except Exception as e:
                    print(f"Error loading {filename}: {e}")
                    continue
            
            if len(mixed_audio) == 0:
                return "No valid audio files could be loaded - no MP3 created."
            
            # Export final mixed scene only if we have actual audio
            scene_id = str(abs(hash(query)))[:8]
            output_file = f"mixed_scenes/scene_{scene_id}.mp3"
            mixed_audio.export(output_file, format="mp3")
            
            return f"🎬 Final Scene Created: {output_file}\nAudio URL: http://localhost:8001/audio/scene_{scene_id}.mp3\nSequential mix: {len(audio_sequence)} audio elements\nDuration: {len(mixed_audio)/1000:.1f}s"
            
        except Exception as e:
            return f"Error mixing audio: {str(e)}"