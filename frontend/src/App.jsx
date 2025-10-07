import React, { useState, useEffect } from 'react'
import axios from 'axios'
import CharacterManager from './components/CharacterManager'
import ChatArea from './components/ChatArea'
import AudioTimeline from './components/AudioTimeline'
import './App.css'

const API_BASE = 'http://localhost:8000';

function App() {
  const [characters, setCharacters] = useState([]);
  const [voices, setVoices] = useState([]);
  const [activeTab, setActiveTab] = useState('chat');
  const [mixerTracks, setMixerTracks] = useState([]);

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

  return (
    <div className="max-w-7xl mx-auto p-6 min-h-screen bg-black/30 backdrop-blur-sm">
      <header className="bg-gradient-to-br from-dark-purple via-blue-900 to-dark-blue border border-deep-purple/30 rounded-2xl p-8 mb-8 shadow-2xl shadow-deep-purple/20">
        <h1 className="text-4xl font-bold text-center mb-6 bg-gradient-to-r from-neon-green via-deep-purple to-neon-green bg-clip-text text-transparent tracking-tight">
          MAKE-A-Scene Chatbot
        </h1>
        <nav className="flex gap-4 justify-center">
          <button 
            className={`px-7 py-3.5 rounded-xl font-semibold text-base transition-all duration-300 backdrop-blur-sm ${
              activeTab === 'chat' 
                ? 'bg-gradient-to-r from-deep-purple to-neon-green text-black font-bold shadow-lg shadow-neon-green/40' 
                : 'bg-gradient-to-br from-dark-purple/80 to-dark-blue/80 text-white border-2 border-deep-purple/30 hover:bg-gradient-to-br hover:from-deep-purple/30 hover:to-neon-green/30 hover:border-neon-green/50 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-deep-purple/30'
            }`}
            onClick={() => setActiveTab('chat')}
          >
            Chat
          </button>
          <button 
            className={`px-7 py-3.5 rounded-xl font-semibold text-base transition-all duration-300 backdrop-blur-sm ${
              activeTab === 'characters' 
                ? 'bg-gradient-to-r from-deep-purple to-neon-green text-black font-bold shadow-lg shadow-neon-green/40' 
                : 'bg-gradient-to-br from-dark-purple/80 to-dark-blue/80 text-white border-2 border-deep-purple/30 hover:bg-gradient-to-br hover:from-deep-purple/30 hover:to-neon-green/30 hover:border-neon-green/50 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-deep-purple/30'
            }`}
            onClick={() => setActiveTab('characters')}
          >
            Characters
          </button>
          <button 
            className={`px-7 py-3.5 rounded-xl font-semibold text-base transition-all duration-300 backdrop-blur-sm ${
              activeTab === 'mixer' 
                ? 'bg-gradient-to-r from-deep-purple to-neon-green text-black font-bold shadow-lg shadow-neon-green/40' 
                : 'bg-gradient-to-br from-dark-purple/80 to-dark-blue/80 text-white border-2 border-deep-purple/30 hover:bg-gradient-to-br hover:from-deep-purple/30 hover:to-neon-green/30 hover:border-neon-green/50 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-deep-purple/30'
            }`}
            onClick={() => setActiveTab('mixer')}
          >
            🎬 Timeline Editor
          </button>
        </nav>
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