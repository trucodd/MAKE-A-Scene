import React, { useState, useEffect } from 'react'
import axios from 'axios'
import CharacterManager from './components/CharacterManager'
import ChatArea from './components/ChatArea'
import AudioTimeline from './components/AudioTimeline'
import LandingPage from './components/LandingPage'
import AISceneCreator from './components/AISceneCreator'
import './App.css'

const API_BASE = 'http://localhost:8000';

function App() {
  const [characters, setCharacters] = useState([]);
  const [voices, setVoices] = useState([]);
  const [activeTab, setActiveTab] = useState('chat');
  const [mixerTracks, setMixerTracks] = useState([]);
  const [showLanding, setShowLanding] = useState(true);
  const [appMode, setAppMode] = useState('story'); // 'story' or 'ai-scene'

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
    return <LandingPage 
      onEnterApp={() => {
        setAppMode('story');
        setActiveTab('chat');
        setShowLanding(false);
      }} 
      onEnterAIScene={() => {
        setAppMode('ai-scene');
        setActiveTab('ai-scene');
        setShowLanding(false);
      }}
    />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Ethereal gradient accent - used sparingly */}
      <div className="fixed top-20 right-20 w-96 h-96 ethereal-gradient rounded-full opacity-30 pointer-events-none"></div>
      
      <div className="max-w-7xl mx-auto">
        <header className="bg-white rounded-2xl p-6 mb-4 card-shadow">
          <div className="flex justify-between items-center">
            <button 
              onClick={() => setShowLanding(true)}
              className="flex items-center space-x-1 text-gray-600 hover:text-gray-900 transition-colors duration-200 text-base font-medium px-2 py-1 rounded-lg hover:bg-gray-50"
            >
              <span>←</span>
              <span>Home</span>
            </button>
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <span className="text-gray-900 font-semibold text-xl">
                {appMode === 'story' ? 'MAKE-A-Scene' : 'AI Scene Creator'}
              </span>
            </div>
            <nav className="flex gap-2">
              {appMode === 'story' ? (
                <>
                  <button 
                    className={`px-3 py-1.5 rounded-lg font-medium text-base transition-all duration-200 ${
                      activeTab === 'chat' 
                        ? 'bg-purple-600 text-white shadow-sm' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                    onClick={() => setActiveTab('chat')}
                  >
                    Chat
                  </button>
                  <button 
                    className={`px-3 py-1.5 rounded-lg font-medium text-base transition-all duration-200 ${
                      activeTab === 'characters' 
                        ? 'bg-purple-600 text-white shadow-sm' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                    onClick={() => setActiveTab('characters')}
                  >
                    Characters
                  </button>
                  <button 
                    className={`px-3 py-1.5 rounded-lg font-medium text-base transition-all duration-200 ${
                      activeTab === 'mixer' 
                        ? 'bg-purple-600 text-white shadow-sm' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                    onClick={() => setActiveTab('mixer')}
                  >
                    Timeline
                  </button>
                </>
              ) : (
                <button 
                  className="bg-purple-600 text-white font-medium px-3 py-1.5 rounded-lg text-base shadow-sm"
                >
                  AI Scene Creator
                </button>
              )}
            </nav>
          </div>
        </header>
      
      <main>
        {appMode === 'story' ? (
          <>
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
          </>
        ) : (
          <AISceneCreator 
            characters={characters}
            voices={voices}
            onTracksChange={setMixerTracks}
          />
        )}
      </main>
      </div>
    </div>
  );
}

export default App;