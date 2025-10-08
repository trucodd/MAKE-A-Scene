import React, { useState } from 'react'
import axios from 'axios'

const API_BASE = 'http://localhost:8000';
const AI_API_BASE = 'http://localhost:8001';

function AISceneCreator({ characters, voices, onTracksChange }) {
  const [context, setContext] = useState('');
  const [sceneCharacters, setSceneCharacters] = useState([]);
  const [script, setScript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCreatingScene, setIsCreatingScene] = useState(false);
  const [currentSceneId, setCurrentSceneId] = useState('');
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [useManualInput, setUseManualInput] = useState(false);
  const [manualScript, setManualScript] = useState('');
  const [sceneTitle, setSceneTitle] = useState('');

  const addCharacter = () => {
    setSceneCharacters([...sceneCharacters, { name: '', voiceId: '' }]);
  };

  const updateCharacter = (index, field, value) => {
    const updated = [...sceneCharacters];
    updated[index][field] = value;
    setSceneCharacters(updated);
  };

  const removeCharacter = (index) => {
    setSceneCharacters(sceneCharacters.filter((_, i) => i !== index));
  };

  const createScene = async () => {
    if (!context.trim() || sceneCharacters.length === 0) {
      alert('Please fill in context and add characters');
      return;
    }

    setIsCreatingScene(true);
    try {
      const response = await axios.post(`${AI_API_BASE}/create-scene`, {
        description: context,
        characters: sceneCharacters,
        style: "cinematic"
      });
      
      setScript(response.data.script);
      setCurrentSceneId(response.data.scene_id);
    } catch (error) {
      console.error('Error creating scene:', error);
      alert('Error creating scene. Please try again.');
    } finally {
      setIsCreatingScene(false);
    }
  };

  const createManualScene = async () => {
    if (!manualScript.trim() || !sceneTitle.trim()) {
      alert('Please fill in scene title and script');
      return;
    }

    setIsCreatingScene(true);
    try {
      const response = await axios.post(`${AI_API_BASE}/create-manual-scene`, {
        script: manualScript,
        characters: sceneCharacters,
        title: sceneTitle
      });
      
      setScript(response.data.script);
      setCurrentSceneId(response.data.scene_id);
    } catch (error) {
      console.error('Error creating manual scene:', error);
      alert('Error creating manual scene. Please try again.');
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
    if (!currentSceneId) {
      alert('No scene available to generate audio');
      return;
    }

    setIsGeneratingAudio(true);
    try {
      const response = await axios.post(`${AI_API_BASE}/generate-audio/${currentSceneId}`);
      setAudioUrl(response.data.audio_url);
    } catch (error) {
      console.error('Error generating audio:', error);
      alert('Error generating audio. Please try again.');
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Mode Toggle */}
      <div className="bg-white rounded-3xl p-6 card-shadow hover:card-shadow-hover transition-all duration-200">
        <h2 className="text-xl font-bold text-gray-900 mb-4">⚙️ Input Mode</h2>
        <div className="flex gap-4">
          <button
            onClick={() => setUseManualInput(false)}
            className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
              !useManualInput 
                ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            🤖 AI Generation
          </button>
          <button
            onClick={() => setUseManualInput(true)}
            className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
              useManualInput 
                ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            ✍️ Manual Input
          </button>
        </div>
        <p className="text-gray-600 text-sm mt-2">
          {useManualInput 
            ? 'Enter your scene script manually (useful when AI credits are low)' 
            : 'Let AI generate the scene script from your description'
          }
        </p>
      </div>

      {/* Context Section - AI Mode */}
      {!useManualInput && (
        <div className="bg-white rounded-3xl p-6 card-shadow hover:card-shadow-hover transition-all duration-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4">🎬 Scene Context</h2>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Describe the scene setting, mood, and atmosphere..."
            className="w-full h-24 bg-white border border-gray-200 rounded-xl p-3 text-gray-900 placeholder-gray-500 resize-none focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100"
          />
        </div>
      )}

      {/* Manual Input Section */}
      {useManualInput && (
        <div className="bg-white rounded-3xl p-6 card-shadow hover:card-shadow-hover transition-all duration-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4">✍️ Manual Scene Input</h2>
          <div className="space-y-4">
            <input
              type="text"
              value={sceneTitle}
              onChange={(e) => setSceneTitle(e.target.value)}
              placeholder="Scene title (e.g., 'Dramatic Confrontation')"
              className="w-full bg-white border border-gray-200 rounded-xl p-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100"
            />
            <textarea
              value={manualScript}
              onChange={(e) => setManualScript(e.target.value)}
              placeholder={`Enter your complete scene script here...

Example format:
[SCENE: A dark alley at night]
JOHN: "We need to talk."
[SFX: footsteps echoing]
MARY: "I've been waiting for you."
[CAMERA: Close-up on Mary's face]`}
              className="w-full h-40 bg-white border border-gray-200 rounded-xl p-3 text-gray-900 placeholder-gray-500 resize-none focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100 font-mono text-sm"
            />
          </div>
        </div>
      )}

      {/* Characters Section */}
      <div className="bg-white rounded-3xl p-6 card-shadow hover:card-shadow-hover transition-all duration-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">👥 Scene Characters</h2>
          <button
            onClick={addCharacter}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors duration-200"
          >
            + Add Character
          </button>
        </div>
        
        <div className="space-y-3">
          {sceneCharacters.map((char, index) => (
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
                ✕
              </button>
            </div>
          ))}
          
          {sceneCharacters.length === 0 && (
            <p className="text-gray-500 text-center py-4">No characters added yet</p>
          )}
        </div>
      </div>

      {/* Script Section */}
      <div className="bg-white rounded-3xl p-6 card-shadow hover:card-shadow-hover transition-all duration-200">
        <h2 className="text-xl font-bold text-gray-900 mb-4">📝 Script</h2>
        <div className="text-sm text-gray-600 mb-3">
          Use @CharacterName: "dialogue" format. Example: @John: "Hello there!" @Mary: "Hi John!"
        </div>
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder="@John: &quot;Hello there!&quot;&#10;@Mary: &quot;Hi John, how are you?&quot;&#10;@John: &quot;I'm doing great, thanks for asking!&quot;"
          className="w-full h-40 bg-white border border-gray-200 rounded-xl p-3 text-gray-900 placeholder-gray-500 resize-none focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100 font-mono text-sm"
        />
      </div>



      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        {!useManualInput ? (
          <button
            onClick={createScene}
            disabled={isCreatingScene || (!useManualInput && (sceneCharacters.length === 0 || !context.trim())) || (useManualInput && (!manualScript.trim() || !sceneTitle.trim()))}
            className="px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            {isCreatingScene ? '🔄 AI Agent Working...' : '🎬 Create Complete Scene'}
          </button>
        ) : (
          <button
            onClick={createManualScene}
            disabled={isCreatingScene || !manualScript.trim() || !sceneTitle.trim()}
            className="px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            {isCreatingScene ? '✍️ Creating Manual Scene...' : '✍️ Create Manual Scene'}
          </button>
        )}
        
        {currentSceneId && (
          <button
            onClick={generateAudio}
            disabled={isGeneratingAudio}
            className="px-8 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-xl transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            {isGeneratingAudio ? '🎵 Generating Audio...' : '🎵 Generate MP3 Audio'}
          </button>
        )}
      </div>



      {/* Audio Player */}
      {audioUrl && (
        <div className="bg-white rounded-3xl p-6 card-shadow hover:card-shadow-hover transition-all duration-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4">🎵 Generated Audio</h2>
          <audio controls className="w-full">
            <source src={audioUrl} type="audio/mpeg" />
            Your browser does not support the audio element.
          </audio>
          <div className="mt-2 text-sm text-gray-600">
            Audio URL: <a href={audioUrl} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">{audioUrl}</a>
          </div>
        </div>
      )}
    </div>
  );
}

export default AISceneCreator;