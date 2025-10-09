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

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)





def call_openrouter_api(prompt: str) -> str:
    """Call OpenRouter API directly"""
    try:
        headers = {
            "Authorization": f"Bearer {os.getenv('GEMINI_KEY')}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": "models/gemini-2.0-flash-exp",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.3,
            "max_tokens": 300,
            "top_p": 0.7
        }
        
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=payload
        )
        
        if response.status_code == 200:
            return response.json()["choices"][0]["message"]["content"]
        else:
            print(f"OpenRouter API error: {response.text}")
            return prompt
    except Exception as e:
        print(f"Error calling OpenRouter API: {e}")
        return prompt

def rephrase_text_with_llm(text: str, tags: str = None) -> str:
    if tags:
        tag_instruction = f"Apply these style tags: {tags}. "
    else:
        tag_instruction = ""
    
    prompt = f"""Make subtle improvements to this text. {tag_instruction}Keep it natural and don't over-edit. Just polish the wording slightly while maintaining the original style and meaning.

Text: {text}

Improved:"""
    return call_openrouter_api(prompt)

def apply_character_consistency(text: str, character_name: str, character_description: str) -> str:
    prompt = f"""You are {character_name}. Character description: {character_description}

You must stay completely in character. Rewrite the following text as {character_name} would say it, maintaining their personality, speech patterns, and perspective. Keep the core message but express it in {character_name}'s unique voice.

Text to rewrite: {text}

{character_name} says:"""
    return call_openrouter_api(prompt)

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
        description=character.description,
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
    
    db_character.description = character.description
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
        
        if request.character_name:
            db = next(get_db())
            character_data = db.query(DBCharacter).filter(DBCharacter.name == request.character_name).first()
            if not character_data:
                raise HTTPException(status_code=404, detail="Character not found")
            db.close()
            print(f"Applying character consistency for {request.character_name}")
            text = apply_character_consistency(
                text, 
                request.character_name, 
                character_data.description
            )
            print(f"Character consistency result: {text}")
        
        # Rephrase the text
        print(f"Rephrasing text: {text}")
        rephrased_text = rephrase_text_with_llm(text, request.tags)
        print(f"Rephrased result: {rephrased_text}")
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
        
        # Store user message
        user_msg = DBMessage(
            content=message.text,
            character_name=message.character_name,
            sender="user"
        )
        db.add(user_msg)
        
        # Store bot response with audio
        audio_id = str(uuid.uuid4())
        bot_msg = DBMessage(
            content=f"🔊 Audio response for: {message.text}",
            character_name=None,
            audio_data=audio_data,
            audio_id=audio_id,
            sender="bot"
        )
        db.add(bot_msg)
        db.commit()
        
        return {
            "user_message": {"text": user_msg.content, "character_name": user_msg.character_name, "sender": "user"},
            "bot_response": {"text": bot_msg.content, "audio_data": bot_msg.audio_data, "audio_id": bot_msg.audio_id, "sender": "bot"}
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.get("/messages")
async def get_messages(db: Session = Depends(get_db)):
    messages = db.query(DBMessage).order_by(DBMessage.created_at).all()
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