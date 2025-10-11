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
    description: str = "Generate detailed cinematic scripts from scene descriptions with specific characters"
    
    def _run(self, query: str, run_manager: Optional[CallbackManagerForToolRun] = None) -> str:
        """Generate a cinematic script from description with specific character names"""
        prompt = query  # Use the query directly as it's already formatted in ai_agent.py
        
        try:
            llm = ChatGoogleGenerativeAI(
                model="models/gemini-2.0-flash-exp",
                google_api_key=os.getenv("GEMINI_KEY")
            )
            response = llm.invoke(prompt)
            return response.content
        except Exception as e:
            return f"Error generating script: {str(e)}"