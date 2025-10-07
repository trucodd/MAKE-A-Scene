import React, { useState, useEffect } from 'react';
import axios from 'axios';
import CharacterManager from './components/CharacterManager';
import ChatArea from './components/ChatArea';
import AudioTimeline from './components/AudioTimeline';
import './App.css';

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
    <div className="App">
      <header className="app-header">
        <h1>MAKE-A-Scene Chatbot</h1>
        <nav>
          <button 
            className={activeTab === 'chat' ? 'active' : ''}
            onClick={() => setActiveTab('chat')}
          >
            Chat
          </button>
          <button 
            className={activeTab === 'characters' ? 'active' : ''}
            onClick={() => setActiveTab('characters')}
          >
            Characters
          </button>
          <button 
            className={activeTab === 'mixer' ? 'active' : ''}
            onClick={() => setActiveTab('mixer')}
          >
            🎬 Timeline Editor
          </button>
        </nav>
      </header>
      
      <main className="app-main">
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