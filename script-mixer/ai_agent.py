import os
import sys
import uuid
import asyncio
import io
from typing import Dict, List, Any, Optional
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.agents import initialize_agent, AgentType
from langchain.tools import BaseTool
from langchain.callbacks.manager import CallbackManagerForToolRun
from langchain.memory import ConversationBufferMemory
from langchain.schema import BaseMessage
from pydantic import BaseModel
from dotenv import load_dotenv

# Load .env from parent directory
load_dotenv(dotenv_path="../.env")

# Add parent directory to path for importing backend modules
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from tools.script_generator import ScriptGeneratorTool
from tools.dialogue_parser import DialogueParserTool
from tools.text_enhancer import TextEnhancerTool
from tools.sound_effects import SoundEffectsTool
from tools.tts_generator import TTSGeneratorTool
from tools.audio_mixer import AudioMixerTool

class SceneCreatorAgent:
    def __init__(self):
        self.llm = ChatGoogleGenerativeAI(
            model="models/gemini-2.0-flash-exp",
            google_api_key=os.getenv("GEMINI_KEY")
        )
        
        # Initialize only script generation tool for create_scene
        self.script_tool = ScriptGeneratorTool()
        
        # Initialize all tools for audio generation
        self.audio_tools = [
            DialogueParserTool(),
            TextEnhancerTool(),
            SoundEffectsTool(),
            TTSGeneratorTool(),
            AudioMixerTool()
        ]
        
        # Initialize agent with memory
        self.memory = ConversationBufferMemory(
            memory_key="chat_history",
            return_messages=True
        )
        
        # Agent for audio generation only
        self.audio_agent = initialize_agent(
            self.audio_tools,
            self.llm,
            agent=AgentType.CHAT_CONVERSATIONAL_REACT_DESCRIPTION,
            verbose=True,
            memory=self.memory,
            max_iterations=3
        )
        
        self.scenes = {}
    
    async def create_scene(self, description: str, characters: List[Dict], style: str = "cinematic") -> Dict[str, Any]:
        """Generate scene script with sound effect cues for user editing"""
        scene_id = str(uuid.uuid4())
        
        # Prepare the script generation prompt with rich sound effects
        character_names = [char.get('name', '').upper() for char in characters if char.get('name')]
        
        if not character_names:
            return {
                "scene_id": scene_id,
                "script": "",
                "audio_files": [],
                "mixed_audio_path": "",
                "status": "error: No characters provided"
            }
        
        workflow_prompt = f"""
        Create a detailed cinematic script for: "{description}"
        
        MANDATORY: You MUST use ONLY these exact character names: {', '.join(character_names)}
        DO NOT create new character names. Use ONLY: {', '.join(character_names)}
        
        CRITICAL FORMAT REQUIREMENTS:
        - Scene descriptions in [SCENE: description]
        - Character dialogue MUST be: CHARACTER_NAME: "dialogue" (use ONLY these names: {', '.join(character_names)})
        - Sound effect cues as [SFX: effect description] (include many: rain, footsteps, thunder, car door slam, engine start, tires screeching, etc.)
        - Camera directions as [CAMERA: direction]
        
        Example format:
        [SCENE: A dark alley at midnight, rain falling]
        [SFX: rain]
        {character_names[0]}: "We need to talk about what happened."
        [SFX: footsteps]
        {character_names[1] if len(character_names) > 1 else character_names[0]}: "I've been waiting for you to say that."
        [SFX: thunder]
        
        REMEMBER: Use ONLY these character names: {', '.join(character_names)}
        Make it engaging and cinematic with detailed sound design.
        """
        
        try:
            # Generate script with sound effects using Gemini
            script_result = self.script_tool._run(workflow_prompt)
            
            # Store the scene (script only)
            scene_data = {
                "scene_id": scene_id,
                "description": description,
                "characters": characters,
                "style": style,
                "script": script_result,
                "audio_files": [],
                "mixed_audio_path": "",
                "status": "script_generated"
            }
            
            self.scenes[scene_id] = scene_data
            return scene_data
            
        except Exception as e:
            error_scene = {
                "scene_id": scene_id,
                "script": "",
                "audio_files": [],
                "mixed_audio_path": "",
                "status": f"error: {str(e)}"
            }
            self.scenes[scene_id] = error_scene
            return error_scene
    
    async def create_manual_scene(self, script: str, characters: List[Dict], title: str = "Manual Scene") -> Dict[str, Any]:
        """Create a scene with manually entered script (no AI generation)"""
        scene_id = str(uuid.uuid4())
        
        try:
            # Store the manually entered scene
            scene_data = {
                "scene_id": scene_id,
                "description": title,
                "characters": characters,
                "style": "manual",
                "script": script,
                "audio_files": [],
                "mixed_audio_path": "",
                "status": "script_manual"
            }
            
            self.scenes[scene_id] = scene_data
            return scene_data
            
        except Exception as e:
            error_scene = {
                "scene_id": scene_id,
                "script": "",
                "audio_files": [],
                "mixed_audio_path": "",
                "status": f"error: {str(e)}"
            }
            self.scenes[scene_id] = error_scene
            return error_scene
    
    async def get_scene(self, scene_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a scene by ID"""
        return self.scenes.get(scene_id)
    
    async def generate_audio(self, scene_id: str) -> Optional[Dict[str, Any]]:
        """Generate TTS + Search Sound Effects from Freesound API"""
        print(f"Starting audio generation for scene: {scene_id}")
        scene = self.scenes.get(scene_id)
        if not scene:
            print(f"Scene not found: {scene_id}")
            return None
        
        print(f"Scene found: {scene.get('status', 'unknown')}")
        try:
            import re
            import requests
            import json
            from pydub import AudioSegment
            
            generated_files = []
            
            # Step 1: Generate TTS for dialogues using Murf API with dynamic voice IDs
            dialogue_pattern = r'([A-Z][A-Z\s]+):\s*"([^"]+)"'
            matches = re.findall(dialogue_pattern, scene['script'])
            
            # Create character to voice mapping with robust name matching
            character_voices = {}
            for char in scene.get('characters', []):
                char_name = char.get('name', '').upper().strip()
                voice_id = char.get('voiceId', 'en-US-davis')  # Default voice
                if char_name:
                    character_voices[char_name] = voice_id
                    # Also add variations for robust matching
                    character_voices[char_name.replace(' ', '')] = voice_id
                    character_voices[char_name.split()[0]] = voice_id  # First name only
            
            print(f"Character voice mapping: {character_voices}")
            
            tts_files = []
            if matches:
                from tts_handler import generate_tts_audio
                for i, (character, dialogue) in enumerate(matches):
                    # Get voice ID for this character with robust matching
                    char_clean = character.strip().upper()
                    voice_id = (character_voices.get(char_clean) or 
                               character_voices.get(char_clean.replace(' ', '')) or 
                               character_voices.get(char_clean.split()[0]) if char_clean.split() else None or
                               'en-US-davis')  # Final fallback
                    
                    # Map invalid voice IDs to valid Murf IDs
                    voice_mapping = {
                        'en-US-aria': 'en-US-jenny',
                        'en-US-neural': 'en-US-davis'
                    }
                    voice_id = voice_mapping.get(voice_id, voice_id)
                    print(f"Generating TTS for {character} with voice {voice_id}: {dialogue}")
                    
                    tts_data = generate_tts_audio(dialogue, voice_id)
                    if tts_data:
                        # Save TTS as actual MP3 file
                        filename = f"tts_{character.lower()}_{i}.mp3"
                        filepath = f"tts_audio/{filename}"
                        
                        # Convert base64 to MP3 file
                        import base64
                        audio_bytes = base64.b64decode(tts_data.split(',')[1])
                        with open(filepath, "wb") as f:
                            f.write(audio_bytes)
                        
                        tts_info = {
                            "type": "tts",
                            "character": character,
                            "dialogue": dialogue,
                            "voice_id": voice_id,
                            "audio_url": f"http://localhost:8001/tts/{filename}",
                            "filename": filename
                        }
                        tts_files.append(tts_info)
                        generated_files.append(tts_info)
            
            # Step 2: Search and download sound effects from Freesound API
            sfx_pattern = r'\[SFX:\s*([^\]]+)\]'
            sfx_matches = re.findall(sfx_pattern, scene['script'])
            
            sfx_files = []
            if sfx_matches:
                api_key = os.getenv("FREESOUND_API_KEY")
                headers = {'Authorization': f'Token {api_key}'} if api_key else {}
                
                for i, sfx_desc in enumerate(sfx_matches):
                    try:
                        # Try multiple search strategies
                        search_queries = [
                            f'"{sfx_desc}"',
                            sfx_desc,
                            sfx_desc.split()[0] if ' ' in sfx_desc else sfx_desc
                        ]
                        
                        sound_found = False
                        for query in search_queries:
                            if sound_found:
                                break
                                
                            params = {
                                'query': query,
                                'filter': 'duration:[0.1 TO 8]',
                                'sort': 'score',
                                'page_size': 5,
                                'fields': 'id,name,previews,duration'
                            }
                            
                            response = requests.get(
                                'https://freesound.org/apiv2/search/text/',
                                headers=headers,
                                params=params,
                                timeout=10
                            )
                            
                            if response.status_code == 200:
                                data = response.json()
                                results = data.get('results', [])
                                print(f"Freesound search '{query}': {len(results)} results")
                                
                                if results:
                                    for sound in results:
                                        preview_url = sound.get('previews', {}).get('preview-hq-mp3')
                                        if preview_url:
                                            # Download and process the sound effect
                                            try:
                                                sfx_response = requests.get(preview_url, timeout=15)
                                                if sfx_response.status_code == 200:
                                                    # Load audio with pydub
                                                    sfx_segment = AudioSegment.from_file(
                                                        io.BytesIO(sfx_response.content)
                                                    )
                                                    
                                                    # Process the sound effect
                                                    # Limit duration to 4 seconds max
                                                    if len(sfx_segment) > 4000:
                                                        sfx_segment = sfx_segment[:4000]
                                                    
                                                    # Fade in/out to avoid clicks
                                                    if len(sfx_segment) > 200:
                                                        sfx_segment = sfx_segment.fade_in(100).fade_out(100)
                                                    
                                                    # Reduce volume
                                                    sfx_segment = sfx_segment - 10  # -10dB
                                                    
                                                    # Save processed SFX
                                                    sfx_filename = f"sfx_{i}_{sfx_desc.replace(' ', '_')[:15]}.mp3"
                                                    sfx_path = f"sounds/{sfx_filename}"
                                                    sfx_segment.export(sfx_path, format="mp3")
                                                    
                                                    sfx_info = {
                                                        "type": "sfx",
                                                        "description": sfx_desc,
                                                        "name": sound['name'],
                                                        "url": preview_url,
                                                        "filename": sfx_filename,
                                                        "local_path": sfx_path,
                                                        "duration_ms": len(sfx_segment)
                                                    }
                                                    sfx_files.append(sfx_info)
                                                    generated_files.append(sfx_info)
                                                    print(f"Downloaded & processed SFX: {sfx_desc} -> {sound['name']} ({len(sfx_segment)/1000:.1f}s)")
                                                    sound_found = True
                                                    break
                                            except Exception as download_error:
                                                print(f"Error downloading SFX {preview_url}: {download_error}")
                                                continue
                                    
                            else:
                                print(f"Freesound API error for '{query}': {response.status_code}")
                        
                        if not sound_found:
                            print(f"No usable SFX found for: {sfx_desc}")
                            
                    except Exception as e:
                        print(f"Error processing SFX '{sfx_desc}': {e}")
                        continue
            
            # Step 3: Create intelligent mixed audio with proper timing
            
            # Create base audio from TTS with proper spacing
            final_audio = AudioSegment.empty()
            dialogue_positions = []  # Track where each dialogue is placed
            
            # Add all TTS files with natural spacing
            print(f"Building base audio from {len(tts_files)} TTS files")
            current_position = 0
            for i, tts_file in enumerate(tts_files):
                try:
                    tts_path = f"tts_audio/{tts_file['filename']}"
                    if os.path.exists(tts_path):
                        tts_segment = AudioSegment.from_mp3(tts_path)
                        
                        # Add some silence before dialogue (except first)
                        if i > 0:
                            pause_duration = 800  # 0.8s between dialogues
                            final_audio += AudioSegment.silent(duration=pause_duration)
                            current_position += pause_duration
                        
                        # Record dialogue position for SFX timing
                        dialogue_positions.append({
                            'start': current_position,
                            'end': current_position + len(tts_segment),
                            'character': tts_file['character']
                        })
                        
                        final_audio += tts_segment
                        current_position += len(tts_segment)
                        print(f"Added TTS {i+1}: {tts_file['character']} at {current_position/1000:.1f}s")
                except Exception as e:
                    print(f"Error loading TTS {tts_file['filename']}: {e}")
                    continue
            
            # Add sound effects strategically
            print(f"Overlaying {len(sfx_files)} sound effects")
            for i, sfx_file in enumerate(sfx_files):
                try:
                    if 'local_path' in sfx_file and os.path.exists(sfx_file['local_path']):
                        sfx_segment = AudioSegment.from_mp3(sfx_file['local_path'])
                        
                        # Determine placement strategy based on SFX type
                        sfx_desc = sfx_file['description'].lower()
                        
                        if any(word in sfx_desc for word in ['rain', 'wind', 'ambient', 'atmosphere']):
                            # Ambient sounds: play throughout as background
                            if len(final_audio) > len(sfx_segment):
                                # Loop ambient sound to cover full duration
                                loops_needed = (len(final_audio) // len(sfx_segment)) + 1
                                extended_sfx = sfx_segment * loops_needed
                                extended_sfx = extended_sfx[:len(final_audio)]
                                final_audio = final_audio.overlay(extended_sfx)
                                print(f"Added ambient SFX: {sfx_desc} (looped background)")
                            else:
                                final_audio = final_audio.overlay(sfx_segment)
                                print(f"Added ambient SFX: {sfx_desc} (overlay)")
                        
                        elif any(word in sfx_desc for word in ['door', 'car', 'engine', 'slam', 'crash']):
                            # Action sounds: place between dialogues
                            if dialogue_positions and i < len(dialogue_positions) - 1:
                                # Place between current and next dialogue
                                placement_pos = dialogue_positions[i]['end'] + 200  # 0.2s after dialogue ends
                                final_audio = final_audio.overlay(sfx_segment, position=placement_pos)
                                print(f"Added action SFX: {sfx_desc} at {placement_pos/1000:.1f}s")
                            else:
                                # Place at end if no more dialogues
                                final_audio = final_audio.overlay(sfx_segment, position=len(final_audio)-len(sfx_segment))
                                print(f"Added action SFX: {sfx_desc} at end")
                        
                        else:
                            # General sounds: distribute evenly
                            if len(final_audio) > 0:
                                placement_pos = (i * len(final_audio)) // max(len(sfx_files), 1)
                                final_audio = final_audio.overlay(sfx_segment, position=placement_pos)
                                print(f"Added general SFX: {sfx_desc} at {placement_pos/1000:.1f}s")
                            else:
                                final_audio += sfx_segment
                                print(f"Added SFX: {sfx_desc} as base")
                                
                except Exception as e:
                    print(f"Error overlaying SFX {sfx_file['description']}: {e}")
                    continue
            
            # Step 4: Export final mixed scene with normalization
            if len(final_audio) > 0:
                # Normalize audio to prevent clipping and ensure good levels
                final_audio = final_audio.normalize()
                
                # Apply gentle compression to even out levels
                if final_audio.max_dBFS > -6:
                    final_audio = final_audio.apply_gain(-6 - final_audio.max_dBFS)
                
                mixed_filename = f"scene_{scene_id}_mixed.mp3"
                mixed_path = f"mixed_scenes/{mixed_filename}"
                
                # Export with good quality settings
                final_audio.export(
                    mixed_path, 
                    format="mp3",
                    bitrate="192k",
                    parameters=["-q:a", "2"]  # High quality VBR
                )
                
                mixed_url = f"http://localhost:8001/audio/{mixed_filename}"
                
                # Save detailed audio info
                audio_info = {
                    "scene_id": scene_id,
                    "tts_files": tts_files,
                    "sfx_files": sfx_files,
                    "mixed_audio_url": mixed_url,
                    "duration_seconds": len(final_audio) / 1000,
                    "dialogue_positions": dialogue_positions,
                    "final_loudness_dbfs": final_audio.dBFS,
                    "status": "mixed_complete"
                }
                
                json_filename = f"scene_{scene_id}.json"
                json_path = f"mixed_scenes/{json_filename}"
                with open(json_path, "w") as f:
                    json.dump(audio_info, f, indent=2)
                
                # Update scene
                scene["audio_files"] = [mixed_url]
                scene["mixed_audio_path"] = mixed_url
                scene["status"] = "audio_mixed"
                
                return {
                    "scene_id": scene_id,
                    "mixed_audio_url": mixed_url,
                    "status": "Complete mixed audio with SFX generated",
                    "tts_count": len(tts_files),
                    "sfx_count": len(sfx_files),
                    "sfx_processed": len([s for s in sfx_files if 'local_path' in s]),
                    "duration": f"{len(final_audio)/1000:.1f}s",
                    "loudness": f"{final_audio.dBFS:.1f} dBFS",
                    "message": "TTS + Freesound SFX intelligently mixed with proper timing"
                }
            else:
                return {
                    "scene_id": scene_id,
                    "status": "No audio generated",
                    "message": "No TTS or sound effects found"
                }
            
        except Exception as e:
            print(f"Exception in generate_audio: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                "scene_id": scene_id,
                "status": f"Error generating audio: {str(e)}",
                "tts_count": len(tts_files) if 'tts_files' in locals() else 0,
                "sfx_count": len(sfx_files) if 'sfx_files' in locals() else 0
            }