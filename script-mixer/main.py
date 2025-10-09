from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os
from dotenv import load_dotenv

from ai_agent import SceneCreatorAgent

# Load .env from parent directory
load_dotenv(dotenv_path="../.env")

app = FastAPI(title="AI Scene Creator", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create directories for audio files
os.makedirs("mixed_scenes", exist_ok=True)
os.makedirs("sounds", exist_ok=True)
os.makedirs("tts_audio", exist_ok=True)

# Mount static files for audio
app.mount("/audio", StaticFiles(directory="mixed_scenes"), name="audio")
app.mount("/sounds", StaticFiles(directory="sounds"), name="sounds")
app.mount("/tts", StaticFiles(directory="tts_audio"), name="tts")

# Initialize the AI agent
scene_agent = SceneCreatorAgent()

class SceneRequest(BaseModel):
    description: str
    characters: List[Dict[str, str]] = []
    style: str = "cinematic"

class ManualSceneRequest(BaseModel):
    script: str
    characters: List[Dict[str, str]] = []
    title: str = "Manual Scene"

class SceneResponse(BaseModel):
    scene_id: str
    script: str
    audio_files: List[str]
    mixed_audio_path: str
    status: str

@app.post("/create-scene", response_model=SceneResponse)
async def create_scene(request: SceneRequest):
    """Create a complete scene with AI agent workflow"""
    try:
        result = await scene_agent.create_scene(
            description=request.description,
            characters=request.characters,
            style=request.style
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/scene/{scene_id}")
async def get_scene(scene_id: str):
    """Get scene details by ID"""
    try:
        scene = await scene_agent.get_scene(scene_id)
        if not scene:
            raise HTTPException(status_code=404, detail="Scene not found")
        return scene
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/create-manual-scene", response_model=SceneResponse)
async def create_manual_scene(request: ManualSceneRequest):
    """Create scene with manual script input"""
    try:
        result = await scene_agent.create_manual_scene(
            script=request.script,
            characters=request.characters,
            title=request.title
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-audio/{scene_id}")
async def generate_audio(scene_id: str):
    """Generate audio for an existing scene"""
    try:
        print(f"Generating audio for scene: {scene_id}")
        result = await scene_agent.generate_audio(scene_id)
        if not result:
            print(f"Scene not found: {scene_id}")
            raise HTTPException(status_code=404, detail="Scene not found")
        print(f"Audio generation result: {result}")
        return result
    except Exception as e:
        print(f"Error in generate_audio endpoint: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    return {
        "service": "AI Scene Creator",
        "version": "1.0.0",
        "endpoints": {
            "POST /create-scene": "Create a complete scene with AI agent workflow",
            "POST /create-manual-scene": "Create scene with manual script input",
            "GET /scene/{scene_id}": "Get scene details by ID",
            "POST /generate-audio/{scene_id}": "Generate audio for existing scene",
            "GET /health": "Health check"
        }
    }

@app.get("/audio/{filename}")
async def get_audio_file(filename: str):
    """Serve audio files"""
    file_path = f"mixed_scenes/{filename}"
    if os.path.exists(file_path):
        return FileResponse(file_path, media_type="audio/mpeg")
    raise HTTPException(status_code=404, detail="Audio file not found")

@app.post("/test-audio-generation")
async def test_audio_generation():
    """Test audio generation with a simple script"""
    try:
        # Create a realistic test scene with multiple sound effects
        test_script = '''[SCENE: A dark alley at midnight, rain falling]
[SFX: rain]
JOHN: "We need to talk about what happened."
[SFX: footsteps]
MARY: "I've been waiting for you to say that."
[SFX: thunder]
JOHN: "The police are getting closer to the truth."
[SFX: car door slam]
MARY: "Then we better disappear before they find us."
[SFX: engine start]
JOHN: "Are you ready for this?"
MARY: "I've been ready since the beginning."
[SFX: tires screeching]'''
        
        test_scene = {
            "scene_id": "test-123",
            "script": test_script,
            "characters": [
                {"name": "JOHN", "voiceId": "en-US-cooper"}, 
                {"name": "MARY", "voiceId": "en-US-wayne"}
            ],
            "status": "test"
        }
        
        scene_agent.scenes["test-123"] = test_scene
        
        # Test audio generation
        result = await scene_agent.generate_audio("test-123")
        return result
        
    except Exception as e:
        return {"error": str(e), "status": "failed"}

@app.get("/play-audio/{scene_id}")
async def play_audio(scene_id: str):
    """Get playable audio URLs for a scene"""
    try:
        # Get the audio info JSON file
        json_file = f"mixed_scenes/scene_{scene_id}.json"
        if os.path.exists(json_file):
            import json
            with open(json_file, 'r') as f:
                audio_info = json.load(f)
            
            # Return playable URLs
            playable_files = []
            for tts_file in audio_info.get('tts_files', []):
                playable_files.append({
                    "character": tts_file['character'],
                    "dialogue": tts_file['dialogue'],
                    "audio_url": tts_file['audio_url'],
                    "type": "tts"
                })
            
            for sfx_file in audio_info.get('sfx_files', []):
                playable_files.append({
                    "description": sfx_file['description'],
                    "name": sfx_file['name'],
                    "audio_url": sfx_file['url'],
                    "type": "sfx"
                })
            
            return {
                "scene_id": scene_id,
                "playable_files": playable_files,
                "total_files": len(playable_files)
            }
        else:
            raise HTTPException(status_code=404, detail="Audio info not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/debug-tts/{scene_id}")
async def debug_tts(scene_id: str):
    """Debug TTS generation for a scene"""
    try:
        scene = scene_agent.scenes.get(scene_id)
        if not scene:
            return {"error": "Scene not found"}
        
        import re
        dialogue_pattern = r'([A-Z][A-Z\s]+):\s*"([^"]+)"'
        matches = re.findall(dialogue_pattern, scene['script'])
        
        return {
            "scene_id": scene_id,
            "script": scene['script'],
            "dialogue_matches": matches,
            "total_dialogues": len(matches),
            "characters": scene.get('characters', [])
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/debug-sfx/{scene_id}")
async def debug_sfx(scene_id: str):
    """Debug sound effects search for a scene"""
    try:
        scene = scene_agent.scenes.get(scene_id)
        if not scene:
            return {"error": "Scene not found"}
        
        import re
        import requests
        
        sfx_pattern = r'\[SFX:\s*([^\]]+)\]'
        sfx_matches = re.findall(sfx_pattern, scene['script'])
        
        api_key = os.getenv("FREESOUND_API_KEY")
        headers = {'Authorization': f'Token {api_key}'} if api_key else {}
        
        sfx_results = []
        for sfx_desc in sfx_matches:
            try:
                params = {
                    'query': f'"{sfx_desc}" cinematic',
                    'filter': 'duration:[0.1 TO 5]',
                    'sort': 'score',
                    'page_size': 3
                }
                
                response = requests.get(
                    'https://freesound.org/apiv2/search/text/',
                    headers=headers,
                    params=params
                )
                
                if response.status_code == 200:
                    data = response.json()
                    results = data.get('results', [])
                    sfx_results.append({
                        "description": sfx_desc,
                        "status_code": response.status_code,
                        "results_count": len(results),
                        "first_result": results[0].get('name') if results else "No results found",
                        "preview_url": results[0].get('previews', {}).get('preview-hq-mp3') if results else None
                    })
                else:
                    sfx_results.append({
                        "description": sfx_desc,
                        "status_code": response.status_code,
                        "error": "API request failed"
                    })
            except Exception as e:
                sfx_results.append({
                    "description": sfx_desc,
                    "error": str(e)
                })
        
        return {
            "scene_id": scene_id,
            "sfx_matches": sfx_matches,
            "total_sfx": len(sfx_matches),
            "api_key_exists": bool(api_key),
            "search_results": sfx_results
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/debug-env")
async def debug_env():
    """Debug environment variables"""
    return {
        "murf_key_exists": bool(os.getenv("MURF_API_KEY")),
        "murf_key_length": len(os.getenv("MURF_API_KEY", "")),
        "gemini_key_exists": bool(os.getenv("GEMINI_KEY")),
        "freesound_key_exists": bool(os.getenv("FREESOUND_API_KEY")),
        "all_env_keys": [k for k in os.environ.keys() if any(x in k for x in ['MURF', 'GEMINI', 'FREESOUND'])]
    }

@app.get("/test-freesound")
async def test_freesound():
    """Test direct Freesound API access"""
    try:
        import requests
        api_key = os.getenv("FREESOUND_API_KEY")
        if not api_key:
            return {"error": "No Freesound API key found"}
        
        headers = {'Authorization': f'Token {api_key}'}
        params = {
            'query': 'rain',
            'filter': 'duration:[0.1 TO 5]',
            'sort': 'score',
            'page_size': 3,
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
            if results:
                sound = results[0]
                preview_url = sound.get('previews', {}).get('preview-hq-mp3')
                
                return {
                    "api_status": "success",
                    "sound_name": sound.get('name'),
                    "sound_id": sound.get('id'),
                    "duration": sound.get('duration'),
                    "previews_available": sound.get('previews', {}),
                    "preview_hq_mp3": sound.get('previews', {}).get('preview-hq-mp3'),
                    "preview_lq_mp3": sound.get('previews', {}).get('preview-lq-mp3'),
                    "all_previews": list(sound.get('previews', {}).keys()) if sound.get('previews') else []
                }
            else:
                return {"api_status": "success", "error": "No results found"}
        else:
            return {"api_status": "failed", "status_code": response.status_code, "error": response.text}
            
    except Exception as e:
        return {"error": str(e)}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "AI Scene Creator"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)