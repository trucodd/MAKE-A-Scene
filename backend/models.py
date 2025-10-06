from pydantic import BaseModel
from typing import List, Optional

class Character(BaseModel):
    name: str
    description: str
    voice_id: str = "en-US-ken"

class RephraseRequest(BaseModel):
    text: str
    character_name: Optional[str] = None
    tags: Optional[str] = None

class SendMessage(BaseModel):
    text: str
    character_name: str
    voice_style: Optional[str] = None

class TTSRequest(BaseModel):
    text: str
    character_name: Optional[str] = None

class AudioMixRequest(BaseModel):
    audio_id: str
    background_sound_url: str

class VolumeAdjustRequest(BaseModel):
    audio_id: str
    tts_volume: float = 1.0
    background_volume: float = 0.5

class AudioTrack(BaseModel):
    id: str
    name: str
    audioData: str
    volume: float
    type: str
    insertAfter: Optional[int] = None
    overlayType: Optional[str] = "normal"  # normal, fade_in, fade_out, crossfade
    position: Optional[int] = 0  # position in milliseconds for overlay start

class MixAudioTracksRequest(BaseModel):
    tracks: List[AudioTrack]