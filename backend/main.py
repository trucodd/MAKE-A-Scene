from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
import uuid
from sqlalchemy.orm import Session
import requests
import base64
import io
from pydub import AudioSegment

from models import *
from tts_handler import generate_tts_audio
from database import get_db, create_tables, Character as DBCharacter, Message as DBMessage
from audio_mixer import mix_audio_tracks

load_dotenv(dotenv_path="../.env")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)





def call_gemini_api(prompt: str) -> str:
    """Call Gemini API directly"""
    try:
        import google.generativeai as genai
        
        api_key = os.getenv('GEMINI_KEY')
        if not api_key:
            print("ERROR: GEMINI_KEY not found in environment")
            return prompt
        
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('models/gemini-2.0-flash-exp')
        
        response = model.generate_content(prompt)
        return response.text
        
    except Exception as e:
        print(f"Error calling Gemini API: {e}")
        return prompt

def rephrase_text_with_llm(text: str, tags: str = None) -> str:
    if tags:
        tag_instruction = f"Apply these style tags: {tags}. "
    else:
        tag_instruction = ""
    
    prompt = f"""Improve this dialogue by making it more natural and engaging. {tag_instruction}Only return the dialogue itself - no scene descriptions, no actions in asterisks or parentheses, just the spoken words. Keep the core meaning but enhance the flow and impact.

Original: {text}

Improved dialogue:"""
    
    response = call_gemini_api(prompt)
    
    # Extract just the improved text
    if "Improved dialogue:" in response:
        improved_text = response.split("Improved dialogue:")[-1].strip()
    elif "Improved:" in response:
        improved_text = response.split("Improved:")[-1].strip()
    else:
        improved_text = response.strip()
    
    # Remove quotes if present
    if improved_text.startswith('"') and improved_text.endswith('"'):
        improved_text = improved_text[1:-1]
    
    # Remove any action descriptions in asterisks or parentheses
    import re
    improved_text = re.sub(r'\*[^*]*\*', '', improved_text)
    improved_text = re.sub(r'\([^)]*\)', '', improved_text)
    
    return improved_text.strip()

def apply_character_consistency(text: str, character_name: str, character_description: str = None) -> str:
    if not character_description:
        # If no description, just do basic rephrasing
        return rephrase_text_with_llm(text)
    
    prompt = f"""Rephrase the following dialogue to match {character_name}'s speaking style. Character description: {character_description}

Only return the rephrased dialogue - no scene descriptions, no actions, just the spoken words that {character_name} would say. Keep the same meaning but adjust the tone, word choice, and style to match the character.

Original dialogue: {text}

Rephrased dialogue:"""
    
    response = call_gemini_api(prompt)
    
    # Clean up the response
    if "Rephrased dialogue:" in response:
        rephrased = response.split("Rephrased dialogue:")[-1].strip()
    else:
        rephrased = response.strip()
    
    # Remove quotes if present
    if rephrased.startswith('"') and rephrased.endswith('"'):
        rephrased = rephrased[1:-1]
    
    # Remove any action descriptions in asterisks or parentheses
    import re
    rephrased = re.sub(r'\*[^*]*\*', '', rephrased)
    rephrased = re.sub(r'\([^)]*\)', '', rephrased)
    
    return rephrased.strip()

@app.get("/voices")
async def get_voices():
    try:
        murf_api_key = os.getenv("MURF_API_KEY")
        if not murf_api_key:
            return []
        
        headers = {
            "Accept": "application/json",
            "api-key": murf_api_key
        }
        
        response = requests.get(
            "https://api.murf.ai/v1/speech/voices",
            headers=headers
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            print(f"Murf voices API error: {response.text}")
            return []
    except Exception as e:
        print(f"Error fetching voices: {e}")
        return []

@app.on_event("startup")
async def startup_event():
    create_tables()
    # Add default narrator character
    db = next(get_db())
    existing = db.query(DBCharacter).filter(DBCharacter.name == "Narrator").first()
    if not existing:
        narrator = DBCharacter(
            name="Narrator",
            description="A neutral storyteller who describes scenes and events objectively.",
            voice_id="en-US-ken"
        )
        db.add(narrator)
        db.commit()
    db.close()

@app.post("/characters")
async def create_character(character: Character, db: Session = Depends(get_db)):
    db_character = DBCharacter(
        name=character.name,
        description=character.description or "",
        voice_id=character.voice_id
    )
    db.add(db_character)
    db.commit()
    return {"message": f"Character {character.name} created successfully"}

@app.put("/characters/{character_name}")
async def update_character(character_name: str, character: Character, db: Session = Depends(get_db)):
    db_character = db.query(DBCharacter).filter(DBCharacter.name == character_name).first()
    if not db_character:
        raise HTTPException(status_code=404, detail="Character not found")
    
    db_character.description = character.description or ""
    db_character.voice_id = character.voice_id
    db.commit()
    return {"message": f"Character {character_name} updated successfully"}

@app.get("/characters")
async def get_characters(db: Session = Depends(get_db)):
    characters = db.query(DBCharacter).all()
    return [{"name": c.name, "description": c.description, "voice_id": c.voice_id} for c in characters]

@app.post("/rephrase")
async def rephrase_text(request: RephraseRequest):
    try:
        print(f"Rephrase request: {request.text}, character: {request.character_name}")
        text = request.text
        
        if request.character_name and request.character_name != "Narrator":
            db = next(get_db())
            character_data = db.query(DBCharacter).filter(DBCharacter.name == request.character_name).first()
            db.close()
            
            if character_data:
                print(f"Applying character consistency for {request.character_name}")
                rephrased_text = apply_character_consistency(
                    text, 
                    request.character_name, 
                    character_data.description
                )
            else:
                # Character not found, do basic rephrase
                rephrased_text = rephrase_text_with_llm(text, request.tags)
        else:
            # No character or Narrator - do basic rephrase
            rephrased_text = rephrase_text_with_llm(text, request.tags)
        
        print(f"Final rephrased result: {rephrased_text}")
        return {"rephrased_text": rephrased_text}
        
    except Exception as e:
        print(f"Rephrase error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/send")
async def send_message(message: SendMessage, db: Session = Depends(get_db)):
    try:
        # Get character voice settings
        voice_id = "en-US-ken"
        voice_style = message.voice_style or "Conversational"
        
        character = db.query(DBCharacter).filter(DBCharacter.name == message.character_name).first()
        if character:
            voice_id = character.voice_id
        
        # Generate TTS for the message
        audio_data = generate_tts_audio(message.text, voice_id, voice_style)
        
        # Store user message with audio
        audio_id = str(uuid.uuid4())
        user_msg = DBMessage(
            content=message.text,
            character_name=message.character_name,
            audio_data=audio_data,
            audio_id=audio_id,
            sender="user"
        )
        db.add(user_msg)
        db.commit()
        
        return {
            "user_message": {
                "text": user_msg.content, 
                "character_name": user_msg.character_name, 
                "audio_data": user_msg.audio_data,
                "audio_id": user_msg.audio_id,
                "sender": "user"
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.get("/messages")
async def get_messages(db: Session = Depends(get_db)):
    messages = db.query(DBMessage).filter(DBMessage.sender == "user").order_by(DBMessage.created_at).all()
    return [{
        "text": m.content,
        "character_name": m.character_name,
        "sender": m.sender,
        "audio_data": m.audio_data,
        "audio_id": m.audio_id,
        "background_sound": m.background_sound
    } for m in messages]

@app.get("/background-sounds")
async def get_background_sounds(search: str = ""):
    try:
        # Use Freesound API if key is available
        api_key = os.getenv("FREESOUND_API_KEY")
        if api_key and api_key != "your_freesound_api_key_here":
            headers = {"Authorization": f"Token {api_key}"}
            params = {
                "query": search or "ambient background",
                "filter": "duration:[1.0 TO 30.0] type:wav OR type:mp3",
                "fields": "id,name,previews,description",
                "page_size": 15
            }
            response = requests.get("https://freesound.org/apiv2/search/text/", headers=headers, params=params)
            if response.status_code == 200:
                data = response.json()
                return [{"id": str(sound["id"]), "name": sound["name"][:50], "url": sound["previews"]["preview-hq-mp3"]} for sound in data["results"] if sound.get("previews")]
    except Exception as e:
        print(f"Freesound API error: {e}")
    
    # Fallback to sample sounds
    return [
        {"id": "rain", "name": "Rain", "url": "https://www.soundjay.com/misc/sounds/rain-01.wav"},
        {"id": "forest", "name": "Forest", "url": "https://www.soundjay.com/nature/sounds/forest-01.wav"},
        {"id": "ocean", "name": "Ocean Waves", "url": "https://www.soundjay.com/nature/sounds/ocean-01.wav"},
        {"id": "fire", "name": "Crackling Fire", "url": "https://www.soundjay.com/misc/sounds/fire-01.wav"}
    ]

@app.get("/audio-waveform/{audio_id}")
async def get_audio_waveform(audio_id: str, db: Session = Depends(get_db)):
    try:
        message = db.query(DBMessage).filter(DBMessage.audio_id == audio_id).first()
        if not message or not message.audio_data:
            raise HTTPException(status_code=404, detail="Audio not found")
        
        # Return mock waveform data for visualization
        # In a real implementation, you'd analyze the actual audio
        tts_waveform = [0.2, 0.5, 0.8, 0.3, 0.7, 0.4, 0.9, 0.1, 0.6, 0.5] * 10
        
        return {
            "tts_audio": {
                "waveform": tts_waveform,
                "duration": len(tts_waveform) * 0.1,
                "volume": 1.0
            },
            "background_sounds": []
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/mix-audio")
async def mix_audio(request: AudioMixRequest, db: Session = Depends(get_db)):
    try:
        message = db.query(DBMessage).filter(DBMessage.audio_id == request.audio_id).first()
        if not message:
            raise HTTPException(status_code=404, detail="Audio not found")
        
        # Store background sound URL for backend processing
        message.background_sound = request.background_sound_url
        db.commit()
        
        # Return waveform data for visualization
        tts_waveform = [0.2, 0.5, 0.8, 0.3, 0.7, 0.4, 0.9, 0.1, 0.6, 0.5] * 10
        bg_waveform = [0.1, 0.3, 0.2, 0.4, 0.1, 0.2, 0.3, 0.1, 0.2, 0.1] * 8
        
        return {
            "tts_waveform": tts_waveform,
            "tts_duration": len(tts_waveform) * 0.1,
            "background_waveform": bg_waveform,
            "background_duration": len(bg_waveform) * 0.1,
            "tts_volume": 1.0,
            "background_volume": 0.5
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/adjust-volume")
async def adjust_volume(request: VolumeAdjustRequest, db: Session = Depends(get_db)):
    try:
        message = db.query(DBMessage).filter(DBMessage.audio_id == request.audio_id).first()
        if not message or not message.audio_data:
            raise HTTPException(status_code=404, detail="Audio not found")
        
        # Generate real-time preview with new volume settings
        tts_audio_data = base64.b64decode(message.audio_data.split(',')[1])
        tts_audio = AudioSegment.from_mp3(io.BytesIO(tts_audio_data))
        
        # Apply TTS volume (convert 0-1 range to dB)
        volume_db = 20 * (request.tts_volume - 1)
        tts_audio = tts_audio + volume_db
        
        # If background sound exists, mix it
        if message.background_sound:
            try:
                bg_response = requests.get(message.background_sound)
                bg_audio = AudioSegment.from_file(io.BytesIO(bg_response.content))
                
                # Apply background volume
                bg_volume_db = 20 * (request.background_volume - 1)
                bg_audio = bg_audio + bg_volume_db
                
                # Loop background to match TTS duration
                if len(bg_audio) < len(tts_audio):
                    bg_audio = bg_audio * (len(tts_audio) // len(bg_audio) + 1)
                bg_audio = bg_audio[:len(tts_audio)]
                
                # Mix the audio
                mixed_audio = tts_audio.overlay(bg_audio)
            except:
                mixed_audio = tts_audio
        else:
            mixed_audio = tts_audio
        
        # Export to base64
        output_buffer = io.BytesIO()
        mixed_audio.export(output_buffer, format="mp3")
        mixed_audio_b64 = base64.b64encode(output_buffer.getvalue()).decode('utf-8')
        
        return {
            "tts_volume": request.tts_volume,
            "background_volume": request.background_volume,
            "preview_audio_data": f"data:audio/mp3;base64,{mixed_audio_b64}"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/preview-mix")
async def preview_mix(request: VolumeAdjustRequest, db: Session = Depends(get_db)):
    try:
        message = db.query(DBMessage).filter(DBMessage.audio_id == request.audio_id).first()
        if not message or not message.audio_data:
            raise HTTPException(status_code=404, detail="Audio not found")
        
        # Decode TTS audio from base64
        tts_audio_data = base64.b64decode(message.audio_data.split(',')[1])
        tts_audio = AudioSegment.from_mp3(io.BytesIO(tts_audio_data))
        
        # Apply TTS volume
        tts_audio = tts_audio + (20 * (request.tts_volume - 1))  # Convert to dB
        
        # If background sound exists, mix it
        if message.background_sound:
            try:
                # Download background audio
                bg_response = requests.get(message.background_sound)
                bg_audio = AudioSegment.from_file(io.BytesIO(bg_response.content))
                
                # Apply background volume
                bg_audio = bg_audio + (20 * (request.background_volume - 1))
                
                # Loop background to match TTS duration
                if len(bg_audio) < len(tts_audio):
                    bg_audio = bg_audio * (len(tts_audio) // len(bg_audio) + 1)
                bg_audio = bg_audio[:len(tts_audio)]
                
                # Mix the audio
                mixed_audio = tts_audio.overlay(bg_audio)
            except:
                mixed_audio = tts_audio
        else:
            mixed_audio = tts_audio
        
        # Export to base64
        output_buffer = io.BytesIO()
        mixed_audio.export(output_buffer, format="mp3")
        mixed_audio_b64 = base64.b64encode(output_buffer.getvalue()).decode('utf-8')
        
        return {
            "preview_audio_data": f"data:audio/mp3;base64,{mixed_audio_b64}",
            "tts_volume": request.tts_volume,
            "background_volume": request.background_volume,
            "message": "Preview generated with backend audio mixing"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/finalize-mix")
async def finalize_mix(request: VolumeAdjustRequest, db: Session = Depends(get_db)):
    try:
        message = db.query(DBMessage).filter(DBMessage.audio_id == request.audio_id).first()
        if not message or not message.audio_data:
            raise HTTPException(status_code=404, detail="Audio not found")
        
        # Create final mixed audio using same logic as preview
        tts_audio_data = base64.b64decode(message.audio_data.split(',')[1])
        tts_audio = AudioSegment.from_mp3(io.BytesIO(tts_audio_data))
        tts_audio = tts_audio + (20 * (request.tts_volume - 1))
        
        if message.background_sound:
            try:
                bg_response = requests.get(message.background_sound)
                bg_audio = AudioSegment.from_file(io.BytesIO(bg_response.content))
                bg_audio = bg_audio + (20 * (request.background_volume - 1))
                
                if len(bg_audio) < len(tts_audio):
                    bg_audio = bg_audio * (len(tts_audio) // len(bg_audio) + 1)
                bg_audio = bg_audio[:len(tts_audio)]
                
                final_audio = tts_audio.overlay(bg_audio)
            except:
                final_audio = tts_audio
        else:
            final_audio = tts_audio
        
        # Save final mixed audio
        output_buffer = io.BytesIO()
        final_audio.export(output_buffer, format="mp3")
        final_audio_b64 = base64.b64encode(output_buffer.getvalue()).decode('utf-8')
        
        # Update message with final mixed audio
        message.audio_data = f"data:audio/mp3;base64,{final_audio_b64}"
        db.commit()
        
        return {
            "message": "Audio mix finalized and saved",
            "mixed_audio_data": message.audio_data,
            "final_tts_volume": request.tts_volume,
            "final_background_volume": request.background_volume
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/mix-audio-tracks")
async def mix_audio_tracks(request: MixAudioTracksRequest):
    try:
        # Separate TTS and background tracks
        tts_tracks = [track for track in request.tracks if track.type == 'tts']
        bg_tracks = [track for track in request.tracks if track.type == 'background']
        
        if not tts_tracks:
            raise HTTPException(status_code=400, detail="No TTS tracks provided")
        
        # Concatenate TTS tracks sequentially
        combined_tts = None
        for track in tts_tracks:
            # Decode audio data
            if track.audioData.startswith('data:audio'):
                audio_data = base64.b64decode(track.audioData.split(',')[1])
            else:
                # If it's a URL, download it
                response = requests.get(track.audioData)
                audio_data = response.content
            
            audio_segment = AudioSegment.from_file(io.BytesIO(audio_data))
            
            if combined_tts is None:
                combined_tts = audio_segment
            else:
                combined_tts = combined_tts + audio_segment
        
        # Apply main volume to TTS
        main_volume = tts_tracks[0].volume if tts_tracks else 1.0
        combined_tts = combined_tts + (20 * (main_volume - 1))
        
        # Add background tracks
        final_audio = combined_tts
        
        for bg_track in bg_tracks:
            try:
                # Download background audio
                if bg_track.audioData.startswith('http'):
                    bg_response = requests.get(bg_track.audioData)
                    bg_audio = AudioSegment.from_file(io.BytesIO(bg_response.content))
                else:
                    # Base64 encoded
                    bg_data = base64.b64decode(bg_track.audioData.split(',')[1])
                    bg_audio = AudioSegment.from_file(io.BytesIO(bg_data))
                
                # Apply volume
                bg_audio = bg_audio + (20 * (bg_track.volume - 1))
                
                if bg_track.insertAfter is not None:
                    # Insert after specific TTS clip (not implemented for now - treat as overlay)
                    pass
                
                # Loop background to match main audio duration
                if len(bg_audio) < len(final_audio):
                    bg_audio = bg_audio * (len(final_audio) // len(bg_audio) + 1)
                bg_audio = bg_audio[:len(final_audio)]
                
                # Overlay background
                final_audio = final_audio.overlay(bg_audio)
                
            except Exception as e:
                print(f"Error processing background track {bg_track.name}: {e}")
                continue
        
        # Export final mixed audio
        output_buffer = io.BytesIO()
        final_audio.export(output_buffer, format="mp3")
        mixed_audio_b64 = base64.b64encode(output_buffer.getvalue()).decode('utf-8')
        
        return {
            "mixed_audio_data": f"data:audio/mp3;base64,{mixed_audio_b64}",
            "message": "Audio tracks mixed successfully"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/mix-audio-tracks")
async def mix_tracks(request: MixAudioTracksRequest):
    return await mix_audio_tracks(request)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)