from typing import Optional
from langchain.tools import BaseTool
from langchain.callbacks.manager import CallbackManagerForToolRun
from langchain_openai import ChatOpenAI
import os

class TextEnhancerTool(BaseTool):
    name: str = "text_enhancer"
    description: str = "Enhance and rephrase text for better cinematic quality"
    
    def _run(self, query: str, run_manager: Optional[CallbackManagerForToolRun] = None) -> str:
        """Enhance text with AI rephrasing for cinematic quality"""
        prompt = f"""
        Enhance the following text for cinematic quality:
        
        {query}
        
        Improve:
        - Dialogue naturalness and flow
        - Emotional impact
        - Character voice consistency
        - Dramatic tension
        - Cinematic language
        
        Keep the same structure but make it more engaging.
        """
        
        try:
            llm = ChatOpenAI(
                model="gpt-4o-mini",
                openai_api_key=os.getenv("OPENROUTER_API_KEY"),
                openai_api_base="https://openrouter.ai/api/v1"
            )
            response = llm.invoke(prompt)
            return response.content
        except Exception as e:
            return f"Error enhancing text: {str(e)}"