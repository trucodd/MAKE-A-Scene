import React from 'react';

function LandingPage({ onEnterApp }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-purple-900/20 to-green-900/20 relative overflow-hidden">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(138,43,226,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(138,43,226,0.1)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
      
      {/* Header */}
      <header className="relative z-10 flex justify-between items-center p-6 max-w-7xl mx-auto">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-green-400 rounded-lg flex items-center justify-center">
            <span className="text-black font-bold text-sm">🎭</span>
          </div>
          <span className="text-white font-bold text-xl">MAKE-A-Scene</span>
        </div>
        

        
        <button 
          onClick={onEnterApp}
          className="bg-gradient-to-r from-purple-600 to-green-500 text-white px-6 py-2 rounded-full font-semibold hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-300 hover:-translate-y-0.5"
        >
          Enter App →
        </button>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-32">
        {/* Hero Section */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center bg-purple-900/30 border border-purple-500/30 rounded-full px-4 py-2 mb-8">
            <span className="text-purple-400 text-sm">🔒 Unlock creativity with us</span>
          </div>
          
          <h1 className="text-6xl md:text-7xl font-bold mb-6 leading-tight">
            <span className="text-white">Create Interactive</span>
            <br />
            <span className="bg-gradient-to-r from-green-400 via-purple-500 to-green-400 bg-clip-text text-transparent">
              AI-Powered
            </span>
            <span className="text-white"> Conversations</span>
          </h1>
          
          <p className="text-gray-300 text-xl max-w-3xl mx-auto mb-12 leading-relaxed">
            Build consistent characters with unique voices and personalities,
            <br />
            enhanced with AI rephrasing and professional text-to-speech
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button 
              onClick={onEnterApp}
              className="bg-gradient-to-r from-purple-600 to-green-500 text-white px-12 py-4 rounded-lg font-bold text-lg hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-300 hover:-translate-y-0.5"
            >
              Start Creating Stories
            </button>
          </div>
        </div>

        {/* Features Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {/* Character Management */}
          <div className="bg-black/60 border border-purple-500/30 rounded-2xl p-6 backdrop-blur-sm hover:border-green-400/50 transition-all duration-300">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-green-400 rounded-lg flex items-center justify-center mb-4">
              <span className="text-2xl">🎭</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Character Management</h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              Create consistent characters with unique personalities, descriptions, and voice selections for immersive storytelling.
            </p>
          </div>

          {/* AI-Powered Rephrasing */}
          <div className="bg-black/60 border border-purple-500/30 rounded-2xl p-6 backdrop-blur-sm hover:border-green-400/50 transition-all duration-300">
            <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-purple-500 rounded-lg flex items-center justify-center mb-4">
              <span className="text-2xl">🤖</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-3">AI Text Enhancement</h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              Enhance your writing with AI-powered rephrasing that maintains character consistency and improves narrative flow.
            </p>
          </div>

          {/* Text-to-Speech */}
          <div className="bg-black/60 border border-purple-500/30 rounded-2xl p-6 backdrop-blur-sm hover:border-green-400/50 transition-all duration-300">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-green-400 rounded-lg flex items-center justify-center mb-4">
              <span className="text-2xl">🔊</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Professional TTS</h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              Convert your text to high-quality speech with multiple voice options and styles for each character.
            </p>
          </div>
        </div>

        {/* Additional Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Timeline Editor */}
          <div className="bg-black/60 border border-purple-500/30 rounded-2xl p-6 backdrop-blur-sm hover:border-green-400/50 transition-all duration-300">
            <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-purple-500 rounded-lg flex items-center justify-center mb-4">
              <span className="text-2xl">🎬</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Audio Timeline Editor</h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              Mix and edit audio tracks with precise timing control, background sounds, and professional audio mixing capabilities.
            </p>
          </div>

          {/* Real-time Chat */}
          <div className="bg-black/60 border border-purple-500/30 rounded-2xl p-6 backdrop-blur-sm hover:border-green-400/50 transition-all duration-300">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-green-400 rounded-lg flex items-center justify-center mb-4">
              <span className="text-2xl">💬</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Interactive Chat</h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              Engage in real-time conversations with your characters, complete with instant audio playback and message history.
            </p>
          </div>
        </div>
      </main>

      {/* Floating Elements */}
      <div className="absolute top-1/4 left-10 w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
      <div className="absolute top-1/3 right-20 w-1 h-1 bg-green-400 rounded-full animate-pulse"></div>
      <div className="absolute bottom-1/4 left-1/4 w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse"></div>
    </div>
  );
}

export default LandingPage;