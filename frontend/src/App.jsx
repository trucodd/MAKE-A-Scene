import React, { useState, useEffect } from 'react'
import axios from 'axios'
import CharacterManager from './components/CharacterManager'
import ChatArea from './components/ChatArea'
import AudioTimeline from './components/AudioTimeline'
import LandingPage from './components/LandingPage'
import './App.css'

const API_BASE = 'http://localhost:8000';

function App() {
  const [characters, setCharacters] = useState([]);
  const [voices, setVoices] = useState([]);
  const [activeTab, setActiveTab] = useState('chat');
  const [mixerTracks, setMixerTracks] = useState([]);
  const [showLanding, setShowLanding] = useState(true);

  useEffect(() => {
    fetchCharacters();
    fetchVoices();
  }, []);

  const fetchVoices = async () => {
    try {
      const response = await axios.get(`${API_BASE}/voices`);
      setVoices(response.data);
    } catch (error) {
      console.error('Error fetching voices:', error);
    }
  };

  const fetchCharacters = async () => {
    try {
      const response = await axios.get(`${API_BASE}/characters`);
      setCharacters(response.data);
    } catch (error) {
      console.error('Error fetching characters:', error);
    }
  };

  const createCharacter = async (name, description, voice_id) => {
    try {
      await axios.post(`${API_BASE}/characters`, { name, description, voice_id });
      fetchCharacters();
    } catch (error) {
      console.error('Error creating character:', error);
    }
  };

  if (showLanding) {
    return <LandingPage onEnterApp={() => setShowLanding(false)} />;
  }

  return (
    <div className="max-w-7xl mx-auto p-6 min-h-screen bg-black/30 backdrop-blur-sm">
      <header className="bg-gradient-to-br from-dark-purple via-blue-900 to-dark-blue border border-deep-purple/30 rounded-xl p-4 mb-4 shadow-lg shadow-deep-purple/10">
        <div className="flex justify-between items-center">
          <button 
            onClick={() => setShowLanding(true)}
            className="flex items-center space-x-1 text-white/70 hover:text-white transition-colors text-sm"
          >
            <span>←</span>
            <span>Home</span>
          </button>
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-green-400 rounded flex items-center justify-center">
              <span className="text-black font-bold text-xs">🎭</span>
            </div>
            <span className="text-white font-bold text-lg">MAKE-A-Scene</span>
          </div>
          <nav className="flex gap-2">
            <button 
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 ${
                activeTab === 'chat' 
                  ? 'bg-gradient-to-r from-deep-purple to-neon-green text-black font-bold' 
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
              onClick={() => setActiveTab('chat')}
            >
              Chat
            </button>
            <button 
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 ${
                activeTab === 'characters' 
                  ? 'bg-gradient-to-r from-deep-purple to-neon-green text-black font-bold' 
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
              onClick={() => setActiveTab('characters')}
            >
              Characters
            </button>
            <button 
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 ${
                activeTab === 'mixer' 
                  ? 'bg-gradient-to-r from-deep-purple to-neon-green text-black font-bold' 
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
              onClick={() => setActiveTab('mixer')}
            >
              🎬 Timeline
            </button>
          </nav>
        </div>
      </header>
      
      <main>
        {activeTab === 'chat' && (
          <ChatArea 
            characters={characters} 
            mixerTracks={mixerTracks}
            onTracksChange={setMixerTracks}
          />
        )}
        {activeTab === 'characters' && (
          <CharacterManager 
            characters={characters}
            voices={voices}
            onCreateCharacter={createCharacter}
          />
        )}
        {activeTab === 'mixer' && (
          <AudioTimeline 
            tracks={mixerTracks}
            onTracksChange={setMixerTracks}
          />
        )}
      </main>
    </div>
  );
}

export default App;