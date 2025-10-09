from typing import Optional
from langchain.tools import BaseTool
from langchain.callbacks.manager import CallbackManagerForToolRun
import requests
import os

class SoundEffectsTool(BaseTool):
    name: str = "sound_effects"
    description: str = "Search and add cinematic sound effects using Freesound API"
    
    def _run(self, query: str, run_manager: Optional[CallbackManagerForToolRun] = None) -> str:
        """Search for cinematic sound effects"""
        try:
            # Extract sound effect cues from script
            sound_cues = []
            lines = query.split('\n')
            
            for line in lines:
                if '[SFX:' in line:
                    # Extract sound effect description
                    start = line.find('[SFX:') + 5
                    end = line.find(']', start)
                    if end > start:
                        sound_desc = line[start:end].strip()
                        sound_cues.append(sound_desc)
            
            if not sound_cues:
                return "No sound effect cues found in the script."
            
            # Search for each sound effect
            found_sounds = []
            api_key = os.getenv("FREESOUND_API_KEY")
            base_url = "https://freesound.org/apiv2"
            headers = {'Authorization': f'Token {api_key}'} if api_key else {}
            
            for cue in sound_cues:
                try:
                    params = {
                        'query': f'"{cue}" cinematic',
                        'filter': 'duration:[0.1 TO 10] tag:(cinematic OR foley OR sfx)',
                        'sort': 'score',
                        'page_size': 3
                    }
                    
                    response = requests.get(
                        f'{base_url}/search/text/',
                        headers=headers,
                        params=params
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        results = data.get('results', [])
                        if results:
                            sound = results[0]
                            found_sounds.append({
                                'cue': cue,
                                'id': sound['id'],
                                'name': sound['name'],
                                'preview_url': sound.get('previews', {}).get('preview-hq-mp3')
                            })
                
                except Exception as e:
                    print(f"Error searching for sound '{cue}': {e}")
                    continue
            
            if not found_sounds:
                return "No suitable sound effects found."
            
            result = "Found Sound Effects:\n"
            for sound in found_sounds:
                result += f"- {sound['cue']}: {sound['name']} (ID: {sound['id']})\n"
            
            return result
            
        except Exception as e:
            return f"Error searching sound effects: {str(e)}"