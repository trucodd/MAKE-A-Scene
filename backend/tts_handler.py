import requests
import os
import base64
from io import BytesIO

def generate_tts_audio(text: str, voice_id: str = "en-US-davis", voice_style: str = "Conversational") -> str:
    """Generate TTS audio using Murf API and return base64 encoded audio"""
    murf_api_key = os.getenv("MURF_API_KEY")
    
    if not murf_api_key:
        print("No Murf API key found")
        return None
    
    print(f"Generating TTS for: {text}")
    
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "api-key": murf_api_key
    }
    
    payload = {
        "voiceId": voice_id,
        "style": voice_style, 
        "text": text,
        "rate": 0,
        "pitch": 0,
        "sampleRate": 48000,
        "format": "MP3",
        "channelType": "MONO"
    }
    
    try:
        response = requests.post(
            "https://api.murf.ai/v1/speech/generate",
            headers=headers,
            json=payload
        )
        
        print(f"Murf API response status: {response.status_code}")
        
        if response.status_code == 200:
            response_data = response.json()
            audio_url = response_data.get("audioFile")
            
            if audio_url:
                # Download the audio file
                audio_response = requests.get(audio_url)
                if audio_response.status_code == 200:
                    # Convert to base64
                    audio_base64 = base64.b64encode(audio_response.content).decode('utf-8')
                    return f"data:audio/mp3;base64,{audio_base64}"
                    
        print(f"TTS generation failed: {response.text}")
        return None
        
    except Exception as e:
        print(f"TTS error: {str(e)}")
        return None