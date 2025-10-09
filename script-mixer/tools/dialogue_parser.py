from typing import Optional
from langchain.tools import BaseTool
from langchain.callbacks.manager import CallbackManagerForToolRun
import re

class DialogueParserTool(BaseTool):
    name: str = "dialogue_parser"
    description: str = "Parse and extract character dialogues from scripts"
    
    def _run(self, query: str, run_manager: Optional[CallbackManagerForToolRun] = None) -> str:
        """Parse character dialogues from script"""
        try:
            # Extract character dialogues using regex
            dialogue_pattern = r'([A-Z][A-Z\s]+):\s*"([^"]+)"'
            matches = re.findall(dialogue_pattern, query)
            
            parsed_dialogues = []
            for character, dialogue in matches:
                parsed_dialogues.append({
                    "character": character.strip(),
                    "dialogue": dialogue.strip()
                })
            
            if not parsed_dialogues:
                return "No character dialogues found in the script."
            
            result = "Parsed Dialogues:\n"
            for i, item in enumerate(parsed_dialogues, 1):
                result += f"{i}. {item['character']}: \"{item['dialogue']}\"\n"
            
            return result
            
        except Exception as e:
            return f"Error parsing dialogues: {str(e)}"