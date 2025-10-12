import React, { useState } from 'react'
import axios from 'axios'

const API_BASE = 'http://localhost:8000';
const AI_API_BASE = 'http://localhost:8001';

function AISceneCreator({ characters, voices, onTracksChange }) {
  const [context, setContext] = useState('');
  const [aiSceneCharacters, setAiSceneCharacters] = useState([]);
  const [manualSceneCharacters, setManualSceneCharacters] = useState([]);
  const [script, setScript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCreatingScene, setIsCreatingScene] = useState(false);
  const [aiSceneId, setAiSceneId] = useState('');
  const [manualSceneId, setManualSceneId] = useState('');
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [aiAudioUrl, setAiAudioUrl] = useState('');
  const [manualAudioUrl, setManualAudioUrl] = useState('');
  const [useManualInput, setUseManualInput] = useState(false);

  const addCharacter = () => {
    if (useManualInput) {
      setManualSceneCharacters([...manualSceneCharacters, { name: '', voiceId: '' }]);
    } else {
      setAiSceneCharacters([...aiSceneCharacters, { name: '', voiceId: '' }]);
    }
  };

  const updateCharacter = (index, field, value) => {
    if (useManualInput) {
      const updated = [...manualSceneCharacters];
      updated[index][field] = value;
      setManualSceneCharacters(updated);
    } else {
      const updated = [...aiSceneCharacters];
      updated[index][field] = value;
      setAiSceneCharacters(updated);
    }
  };

  const removeCharacter = (index) => {
    if (useManualInput) {
      setManualSceneCharacters(manualSceneCharacters.filter((_, i) => i !== index));
    } else {
      setAiSceneCharacters(aiSceneCharacters.filter((_, i) => i !== index));
    }
  };

  const createScene = async () => {
    if (!context.trim() || aiSceneCharacters.length === 0) {
      alert('Please fill in context and add characters');
      return;
    }

    setIsCreatingScene(true);
    try {
      const response = await axios.post(`${AI_API_BASE}/create-scene`, {
        description: context,
        characters: aiSceneCharacters,
        style: "cinematic"
      });
      
      setScript(response.data.script);
      setAiSceneId(response.data.scene_id);
    } catch (error) {
      console.error('Error creating scene:', error);
      alert('Error creating scene. Please try again.');
    } finally {
      setIsCreatingScene(false);
    }
  };



  const processScene = async () => {
    // This function is now integrated into createScene
    // The AI agent handles the full workflow automatically
    alert('Scene processing is now integrated into the Create Scene workflow!');
  };

  const generateAudio = async () => {
    if (useManualInput) {
      // For manual input, create scene and generate audio in one step
      if (!script.trim() || manualSceneCharacters.length === 0) {
        alert('Please fill in script and add characters');
        return;
      }

      setIsGeneratingAudio(true);
      try {
        // Create manual scene first, then generate audio using same process as AI
        const sceneResponse = await axios.post(`${AI_API_BASE}/create-manual-scene`, {
          script: script,
          characters: manualSceneCharacters,
          title: 'Manual Scene'
        });
        
        // Use the same audio generation as AI mode
        const audioResponse = await axios.post(`${AI_API_BASE}/generate-audio/${sceneResponse.data.scene_id}`);
        setManualAudioUrl(audioResponse.data.mixed_audio_url || audioResponse.data.audio_url);
        setManualSceneId(sceneResponse.data.scene_id);
      } catch (error) {
        console.error('Error generating audio:', error);
        alert('Error generating audio. Please try again.');
      } finally {
        setIsGeneratingAudio(false);
      }
    } else {
      // For AI generation, use existing scene
      if (!aiSceneId) {
        alert('No scene available to generate audio');
        return;
      }

      setIsGeneratingAudio(true);
      try {
        const response = await axios.post(`${AI_API_BASE}/generate-audio/${aiSceneId}`);
        setAiAudioUrl(response.data.mixed_audio_url || response.data.audio_url);
      } catch (error) {
        console.error('Error generating audio:', error);
        alert('Error generating audio. Please try again.');
      } finally {
        setIsGeneratingAudio(false);
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Mode Toggle */}
      <div className="bg-gradient-to-br from-white to-indigo-50/40 rounded-3xl p-6 card-shadow hover:card-shadow-hover transition-all duration-200">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          <svg className="w-5 h-5 inline mr-2" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97 0-.33-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1 0 .33.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66Z"/>
          </svg>
          Input Mode
        </h2>
        <div className="flex gap-4">
          <button
            onClick={() => {
              setUseManualInput(false);
              // Clear manual input data when switching to AI mode
              setManualAudioUrl('');
              setManualSceneId('');
            }}
            className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
              !useManualInput 
                ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <svg className="w-4 h-4 inline mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            AI Generation
          </button>
          <button
            onClick={() => {
              setUseManualInput(true);
              // Clear AI data when switching to manual mode
              setAiAudioUrl('');
              setAiSceneId('');
            }}
            className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
              useManualInput 
                ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <svg className="w-4 h-4 inline mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
            </svg>
            Manual Input
          </button>
        </div>
        <p className="text-gray-600 text-sm mt-2">
          {useManualInput 
            ? 'Enter your scene script manually (useful when AI credits are low)' 
            : 'Let AI generate the scene script from your description'
          }
        </p>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Context Section - AI Mode */}
          {!useManualInput && (
            <div className="bg-gradient-to-br from-white to-emerald-50/40 rounded-3xl p-6 card-shadow hover:card-shadow-hover transition-all duration-200">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                <svg className="w-5 h-5 inline mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
                </svg>
                Scene Context
              </h2>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Describe the scene setting, mood, and atmosphere..."
                className="w-full h-32 bg-white border border-gray-200 rounded-xl p-3 text-gray-900 placeholder-gray-500 resize-none focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100"
              />
            </div>
          )}

          {/* Characters Section */}
          <div className="bg-gradient-to-br from-white to-violet-50/40 rounded-3xl p-6 card-shadow hover:card-shadow-hover transition-all duration-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            <svg className="w-5 h-5 inline mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
            Scene Characters
          </h2>
          <button
            onClick={addCharacter}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors duration-200"
          >
            + Add Character
          </button>
        </div>
        
        <div className="space-y-3">
          {(useManualInput ? manualSceneCharacters : aiSceneCharacters).map((char, index) => (
            <div key={index} className="flex gap-3 items-center">
              <input
                type="text"
                value={char.name}
                onChange={(e) => updateCharacter(index, 'name', e.target.value)}
                placeholder="Character name"
                className="flex-1 bg-white border border-gray-200 rounded-xl p-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100"
              />
              <select
                value={char.voiceId}
                onChange={(e) => updateCharacter(index, 'voiceId', e.target.value)}
                className="flex-1 bg-white border border-gray-200 rounded-xl p-3 text-gray-900 focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100"
              >
                <option value="">Select voice</option>
                {voices.map(voice => (
                  <option key={voice.voiceId} value={voice.voiceId}>{voice.displayName}</option>
                ))}
              </select>
              <button
                onClick={() => removeCharacter(index)}
                className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-xl transition-colors duration-200"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                </svg>
              </button>
            </div>
          ))}
          
          {(useManualInput ? manualSceneCharacters : aiSceneCharacters).length === 0 && (
            <p className="text-gray-500 text-center py-4">No characters added yet</p>
          )}
          </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Script Section */}
          <div className="bg-gradient-to-br from-white to-blue-50/40 rounded-3xl p-6 card-shadow hover:card-shadow-hover transition-all duration-200 h-fit">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          <svg className="w-5 h-5 inline mr-2" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
          </svg>
          Script
        </h2>
        <div className="text-sm text-gray-600 mb-3">
          {useManualInput 
            ? 'Enter your complete scene script with format: [SCENE: description], CHARACTER: "dialogue", [SFX: effect]'
            : 'Generated script will appear here after creating scene'
          }
        </div>
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder={useManualInput 
            ? `[SCENE: A dark alley at night]\n[SFX: rain]\nJOHN: "We need to talk."\n[SFX: footsteps]\nMARY: "I've been waiting for you."`
            : 'Generated script will appear here...'
          }
          readOnly={!useManualInput}
          className={`w-full h-64 xl:h-80 bg-white border border-gray-200 rounded-xl p-3 text-gray-900 placeholder-gray-500 resize-none focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100 font-mono text-sm ${!useManualInput ? 'bg-gray-50' : ''}`}
          />
          </div>
          {/* Audio Player */}
          {((!useManualInput && aiAudioUrl) || (useManualInput && manualAudioUrl)) && (
            <div className="bg-gradient-to-br from-white to-pink-50/40 rounded-3xl p-6 card-shadow hover:card-shadow-hover transition-all duration-200">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                <svg className="w-5 h-5 inline mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
                Generated Audio
              </h2>
              <audio controls className="w-full">
                <source src={useManualInput ? manualAudioUrl : aiAudioUrl} type="audio/mpeg" />
                Your browser does not support the audio element.
              </audio>
              <div className="mt-2 text-sm text-gray-600">
                Audio URL: <a href={useManualInput ? manualAudioUrl : aiAudioUrl} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">{useManualInput ? manualAudioUrl : aiAudioUrl}</a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        {!useManualInput ? (
          <>
            <button
              onClick={createScene}
              disabled={isCreatingScene || (aiSceneCharacters.length === 0 || !context.trim())}
              className="px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {isCreatingScene ? (
                <>
                  <svg className="w-4 h-4 inline mr-2 animate-spin" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/>
                  </svg>
                  AI Agent Working...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 inline mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
                  </svg>
                  Create Scene
                </>
              )}
            </button>
            
            {aiSceneId && (
              <button
                onClick={generateAudio}
                disabled={isGeneratingAudio}
                className="px-8 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-xl transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                {isGeneratingAudio ? (
                  <>
                    <svg className="w-4 h-4 inline mr-2 animate-spin" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/>
                    </svg>
                    Generating Audio...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 inline mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                    Generate Audio
                  </>
                )}
              </button>
            )}
          </>
        ) : (
          <button
            onClick={generateAudio}
            disabled={isGeneratingAudio || !script.trim() || manualSceneCharacters.length === 0}
            className="px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            {isGeneratingAudio ? (
              <>
                <svg className="w-4 h-4 inline mr-2 animate-spin" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/>
                </svg>
                Generating Audio...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 inline mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
                Generate Audio
              </>
            )}
          </button>
        )}
      </div>




    </div>
  );
}

export default AISceneCreator;