import React from 'react';

function LandingPage({ onEnterApp, onEnterAIScene }) {
  return (
    <div className="min-h-screen bg-gray-50 relative overflow-hidden">
      {/* Ethereal gradient accents */}
      <div className="fixed top-20 right-20 w-96 h-96 ethereal-gradient rounded-full opacity-20 pointer-events-none"></div>
      <div className="fixed bottom-20 left-20 w-80 h-80 ethereal-gradient rounded-full opacity-15 pointer-events-none"></div>
      
      {/* Header */}
      <header className="relative z-10 flex justify-between items-center p-6 max-w-7xl mx-auto bg-white rounded-2xl mt-6 card-shadow">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          <span className="text-gray-900 font-bold text-xl">MAKE-A-Scene</span>
        </div>
        
        <button 
          onClick={onEnterApp}
          className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-xl font-semibold transition-all duration-200 hover:-translate-y-0.5"
        >
          Enter App →
        </button>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-24">
        {/* Hero Section */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center bg-white rounded-full px-4 py-2 mb-8 card-shadow">
            <svg className="w-4 h-4 text-purple-600 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            <span className="text-purple-600 text-sm font-medium">Unlock creativity with AI</span>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            <span className="text-gray-900">Create Cinematic</span>
            <br />
            <span className="text-purple-600">
              Audio Scenes
            </span>
            <span className="text-gray-900"> with AI</span>
          </h1>
          
          <p className="text-gray-600 text-xl max-w-3xl mx-auto mb-12 leading-relaxed">
            Mix dialogue, sound effects, and background music with professional audio timeline editing
            <br />
            powered by AI script generation and text-to-speech
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button 
              onClick={onEnterApp}
              className="bg-purple-600 hover:bg-purple-700 text-white px-12 py-4 rounded-2xl font-bold text-lg transition-all duration-200 hover:-translate-y-1 card-shadow-hover"
            >
              Start Creating Stories
            </button>
            <button 
              onClick={onEnterAIScene}
              className="bg-white hover:bg-gray-50 text-gray-900 border border-gray-200 px-12 py-4 rounded-2xl font-bold text-lg transition-all duration-200 hover:-translate-y-1 card-shadow"
            >
              🤖 AI Scene Creator
            </button>
          </div>
        </div>

        {/* Features Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {/* AI Scene Generation */}
          <div className="bg-white rounded-3xl p-8 card-shadow hover:card-shadow-hover transition-all duration-200 hover:-translate-y-1">
            <div className="w-14 h-14 bg-purple-600 rounded-2xl flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z"/>
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-4">AI Scene Creator</h3>
            <p className="text-gray-600 leading-relaxed">
              Generate complete audio scenes from simple descriptions. AI creates scripts, adds sound effects, and produces professional audio.
            </p>
          </div>

          {/* Character Voices */}
          <div className="bg-white rounded-3xl p-8 card-shadow hover:card-shadow-hover transition-all duration-200 hover:-translate-y-1">
            <div className="w-14 h-14 bg-purple-600 rounded-2xl flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,16H19Z"/>
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-4">Character Voices</h3>
            <p className="text-gray-600 leading-relaxed">
              Create unique characters with distinct voices using Murf API's professional text-to-speech. Multiple voice options for each character.
            </p>
          </div>

          {/* Audio Timeline */}
          <div className="bg-white rounded-3xl p-8 card-shadow hover:card-shadow-hover transition-all duration-200 hover:-translate-y-1">
            <div className="w-14 h-14 bg-purple-600 rounded-2xl flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-4">Timeline Editor</h3>
            <p className="text-gray-600 leading-relaxed">
              Professional audio timeline with drag-and-drop editing, volume control, trimming, and real-time waveform visualization.
            </p>
          </div>
        </div>

        {/* Additional Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Sound Library */}
          <div className="bg-white rounded-3xl p-8 card-shadow hover:card-shadow-hover transition-all duration-200 hover:-translate-y-1">
            <div className="w-14 h-14 bg-purple-600 rounded-2xl flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.85 14,18.71V20.77C18.01,19.86 21,16.28 21,12C21,7.72 18.01,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z"/>
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-4">Sound Effects Integration</h3>
            <p className="text-gray-600 leading-relaxed">
              Integrate with Freesound API to search and add professional sound effects and ambient sounds directly to your timeline.
            </p>
          </div>

          {/* Audio Mixing */}
          <div className="bg-white rounded-3xl p-8 card-shadow hover:card-shadow-hover transition-all duration-200 hover:-translate-y-1">
            <div className="w-14 h-14 bg-purple-600 rounded-2xl flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14,20.75C14,21.38 13.38,22 12.75,22H11.25C10.62,22 10,21.38 10,20.75V19.5H14V20.75M12,4.5C9.24,4.5 7,6.74 7,9.5C7,12.26 9.24,14.5 12,14.5C14.76,14.5 17,12.26 17,9.5C17,6.74 14.76,4.5 12,4.5M12,2A7.5,7.5 0 0,1 19.5,9.5C19.5,11.6 18.7,13.51 17.35,14.96L16.61,15.69C16.22,16.08 16,16.61 16,17.17V18H8V17.17C8,16.61 7.78,16.08 7.39,15.69L6.65,14.96C5.3,13.51 4.5,11.6 4.5,9.5A7.5,7.5 0 0,1 12,2Z"/>
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-4">Professional Audio Mixing</h3>
            <p className="text-gray-600 leading-relaxed">
              Advanced audio processing with volume control, fading, crossfading, and multi-track mixing powered by PyDub and FFmpeg.
            </p>
          </div>
        </div>
      </main>


    </div>
  );
}

export default LandingPage;