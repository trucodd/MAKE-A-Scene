from typing import Optional
from langchain.tools import BaseTool
from langchain.callbacks.manager import CallbackManagerForToolRun
from langchain_google_genai import ChatGoogleGenerativeAI
import os
from dotenv import load_dotenv

# Load .env from parent directory
load_dotenv(dotenv_path="../../.env")

class ScriptGeneratorTool(BaseTool):
    name: str = "script_generator"
    description: str = "Generate detailed cinematic scripts from scene descriptions"
    
    def _run(self, query: str, run_manager: Optional[CallbackManagerForToolRun] = None) -> str:
        """Generate a cinematic script from description"""
        prompt = f"""
        Create a detailed cinematic script for: {query}
        
        Format the script with:
        - Scene descriptions in [SCENE: description]
        - Character dialogue as CHARACTER: "dialogue"
        - Sound effect cues as [SFX: effect description]
        - Camera directions as [CAMERA: direction]
        
        Make it engaging and cinematic.
        """
        
        try:
            llm = ChatGoogleGenerativeAI(
                model="models/gemini-2.0-flash-exp",
                google_api_key=os.getenv("GEMINI_KEY")
            )
            response = llm.invoke(prompt)
            return response.content
        except Exception as e:
            return f"Error generating script: {str(e)}"