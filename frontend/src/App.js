import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const BACKEND_URL = 'https://guardian-voice-backend.onrender.com';

function App() {
  const [messages, setMessages] = useState([
    { sender: 'ai', text: 'Hello! I am Guardian Voice. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [showCodeBox, setShowCodeBox] = useState(false);
  const [showVetoPanel, setShowVetoPanel] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [generatedCode, setGeneratedCode] = useState(""); 
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    
    // Browser ko pehle se voices load karne do
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }
  }, [messages]);

  const speak = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); 
      const utterance = new SpeechSynthesisUtterance(text);
      
      const voices = window.speechSynthesis.getVoices();
      const alexaVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Samantha') || v.name.includes('Zira'));
      if (alexaVoice) {
        utterance.voice = alexaVoice;
      }

      utterance.rate = 1.0; 
      utterance.pitch = 1.1; 
      
      window.speechSynthesis.speak(utterance);
    }
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Browser voice support nahi karta. Chrome use karein.");
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      handleSend(null, transcript); 
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  const handleSend = async (e, voiceText = null) => {
    if (e) e.preventDefault();
    const userMessage = voiceText || input;
    if (!userMessage.trim()) return;

    setMessages((prev) => [...prev, { sender: 'user', text: userMessage }]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await axios.post(BACKEND_URL, { message: userMessage });
      const data = response.data;
      
      setMessages((prev) => [...prev, { sender: 'ai', text: data.reply }]);
      speak(data.reply);

      if (data.uiUpdate?.showCode) {
        setShowCodeBox(true);
        setGeneratedCode(data.uiUpdate.code);
      }
      if (data.uiUpdate?.showPending) {
        setShowCodeBox(false);
        setShowVetoPanel(true);
      }
      if (data.uiUpdate?.clearPending) {
        setShowVetoPanel(false);
        setShowCodeBox(false);
      }

    } catch (error) {
      setMessages((prev) => [...prev, { sender: 'ai', text: 'Connection error.' }]);
    }
    setIsLoading(false);
  };

  const handleVeto = async () => {
    setMessages((prev) => [...prev, { sender: 'user', text: 'VETO' }]);
    speak("Action vetoed. The task remains blocked.");
    setIsLoading(true);
    try {
      const response = await axios.post(BACKEND_URL, { message: 'veto' });
      setMessages((prev) => [...prev, { sender: 'ai', text: response.data.reply }]);
      setShowVetoPanel(false);
    } catch (error) {
      console.error(error);
    }
    setIsLoading(false);
  };

  const handleAccept = async () => {
    setMessages((prev) => [...prev, { sender: 'user', text: 'ACCEPT' }]);
    speak("Action approved. Executing task now.");
    setIsLoading(true);
    try {
      const response = await axios.post(BACKEND_URL, { message: 'accept' });
      setMessages((prev) => [...prev, { sender: 'ai', text: response.data.reply }]);
      setShowVetoPanel(false);
    } catch (error) {
      console.error(error);
    }
    setIsLoading(false);
  };

  const runAutoDemo = async () => {
    if (isAutoPlaying) return;
    setIsAutoPlaying(true);
    setMessages([{ sender: 'ai', text: 'Starting automated demo sequence...' }]);
    
    await new Promise(r => setTimeout(r, 2000));
    setMessages(prev => [...prev, { sender: 'user', text: 'Alexa, unlock the front door.' }]);
    await new Promise(r => setTimeout(r, 1000));
    
    try {
      const res1 = await axios.post(BACKEND_URL, { message: 'unlock the front door' });
      setMessages(prev => [...prev, { sender: 'ai', text: res1.data.reply }]);
      speak(res1.data.reply);
      setShowCodeBox(true);
      setGeneratedCode(res1.data.uiUpdate.code);

      await new Promise(r => setTimeout(r, 6000));
      setMessages(prev => [...prev, { sender: 'user', text: `The code is ${res1.data.uiUpdate.code}` }]);
      await new Promise(r => setTimeout(r, 1000));

      const res2 = await axios.post(BACKEND_URL, { message: res1.data.uiUpdate.code });
      setMessages(prev => [...prev, { sender: 'ai', text: res2.data.reply }]);
      speak(res2.data.reply);
      setShowCodeBox(false);
      setShowVetoPanel(true);

      await new Promise(r => setTimeout(r, 4000));
      setMessages(prev => [...prev, { sender: 'user', text: 'VETO' }]);
      await new Promise(r => setTimeout(r, 1000));
      
      const res3 = await axios.post(BACKEND_URL, { message: 'veto' });
      setMessages(prev => [...prev, { sender: 'ai', text: res3.data.reply }]);
      speak(res3.data.reply);
      setShowVetoPanel(false);

    } catch (error) {
      console.error(error);
    }
    setIsAutoPlaying(false);
  };

  return (
    <div className="min-h-screen bg-[#F4F1EA] text-stone-800 flex justify-center items-center p-4 md:p-8 font-sans">
      
      <div className="w-full max-w-6xl bg-[#FDFCF8] rounded-3xl shadow-xl shadow-stone-200/60 border border-stone-200 flex flex-col md:flex-row overflow-hidden h-[90vh]">
        
        <div className="w-full md:w-1/2 flex flex-col border-b md:border-b-0 md:border-r border-stone-200">
          
          <div className="p-6 border-b border-stone-200 flex justify-between items-center bg-[#FDFCF8] z-10">
              <div className="flex items-center gap-3">
                  <div className="bg-stone-900 p-2.5 rounded-xl text-[#F4F1EA]">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
                  </div>
                  <div>
                      <h1 className="text-xl font-bold text-stone-900 tracking-tight">Guardian Voice</h1>
                      <p className="text-xs text-stone-500 font-medium tracking-wide uppercase">Alexa+ Simulator</p>
                  </div>
              </div>
              <button onClick={runAutoDemo} disabled={isAutoPlaying} className={`text-xs px-4 py-2 rounded-lg font-bold transition-all uppercase tracking-wide ${isAutoPlaying ? 'bg-stone-200 text-stone-400' : 'bg-stone-900 text-[#F4F1EA] hover:bg-stone-800'}`}>
                  {isAutoPlaying ? 'Running...' : '▶ Auto-Demo'}
              </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#F4F1EA]/50">
            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed ${msg.sender === 'user' ? 'bg-stone-900 text-[#F4F1EA] rounded-br-none shadow-md' : 'bg-white border border-stone-200 text-stone-700 rounded-bl-none shadow-sm'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isLoading && <div className="text-stone-400 text-sm animate-pulse italic">Guardian is processing...</div>}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-6 bg-[#FDFCF8] border-t border-stone-200">
              <form onSubmit={handleSend} className="flex gap-3">
                <button 
                  type="button" 
                  onClick={startListening}
                  className={`p-4 rounded-xl transition-all ${isListening ? 'bg-red-700 text-white animate-pulse shadow-lg shadow-red-700/20' : 'bg-stone-200 text-stone-600 hover:bg-stone-300'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
                </button>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Say: 'Unlock the door' or 'Play music'"
                  className="flex-1 bg-[#F4F1EA] border border-stone-300 rounded-xl px-5 py-4 text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 transition-all text-sm"
                />
                <button type="submit" className="bg-stone-900 hover:bg-stone-800 text-[#F4F1EA] px-8 py-4 rounded-xl font-bold shadow-lg shadow-stone-900/10 transition-all flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                </button>
              </form>
          </div>
        </div>

        <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col bg-[#F4F1EA] relative">
          
          <div className="mb-8 bg-stone-900 rounded-2xl p-5 shadow-inner h-40 overflow-y-auto font-mono text-xs border border-stone-800">
              <p className="text-stone-500 mb-3 tracking-widest uppercase text-[10px]">// System Security Logs</p>
              {messages.map((msg, i) => {
                  if (msg.text.includes("Playing") || msg.text.includes("currently")) return <p key={i} className="text-emerald-400 mb-1.5 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 block"></span>[LOW-RISK] Action executed.</p>;
                  if (msg.text.includes("4-digit code")) return <p key={i} className="text-amber-400 mb-1.5 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 block"></span>[HIGH-RISK] Awaiting verification.</p>;
                  if (msg.text.includes("vetoed")) return <p key={i} className="text-red-400 mb-1.5 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-400 block"></span>[VETO] Action blocked by human.</p>;
                  if (msg.text.includes("approved")) return <p key={i} className="text-emerald-400 mb-1.5 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 block"></span>[ACCEPT] Action approved.</p>;
                  if (msg.text.includes("verified")) return <p key={i} className="text-blue-400 mb-1.5 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-400 block"></span>[SECURITY] Identity verified.</p>;
                  return null;
              })}
          </div>

          <div className="flex-1 flex flex-col items-center justify-center">
              
              {showCodeBox && (
              <div className="bg-[#FDFCF8] border border-stone-200 p-8 rounded-3xl w-full max-w-md text-center shadow-xl shadow-stone-200/50 animate-in fade-in zoom-in duration-300">
                  <div className="w-16 h-16 bg-red-100 text-red-700 rounded-full flex items-center justify-center mx-auto mb-5 border border-red-200">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                  </div>
                  <h2 className="text-stone-900 font-bold text-2xl mb-2 tracking-tight">Verification Required</h2>
                  <p className="text-stone-500 mb-8 text-sm">Please read this code aloud to proceed.</p>
                  <div className="bg-[#F4F1EA] py-6 rounded-2xl tracking-[0.5em] text-5xl font-mono text-stone-900 font-bold border border-stone-300 shadow-inner">
                  {generatedCode}
                  </div>
              </div>
              )}

              {showVetoPanel && (
              <div className="bg-[#FDFCF8] border border-stone-200 p-8 rounded-3xl w-full max-w-md text-center shadow-xl shadow-stone-200/50 animate-in fade-in zoom-in duration-300">
                  <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto mb-5 border border-amber-200">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                  </div>
                  <h2 className="text-stone-900 font-bold text-2xl mb-1 tracking-tight">Pending Approval</h2>
                  <p className="text-stone-500 text-sm mb-8">A high-risk action requires your attention.</p>
                  
                  <div className="flex gap-4 justify-center">
                  <button onClick={handleAccept} className="bg-stone-200 hover:bg-stone-300 text-stone-700 px-6 py-4 rounded-xl font-bold w-full transition-all text-sm tracking-wide">
                      ACCEPT
                  </button>
                  <button onClick={handleVeto} className="bg-red-800 hover:bg-red-900 text-white px-6 py-4 rounded-xl font-bold w-full shadow-lg shadow-red-800/20 transition-all transform hover:scale-[1.02] text-sm tracking-wide">
                      VETO
                  </button>
                  </div>
              </div>
              )}

              {!showCodeBox && !showVetoPanel && (
              <div className="text-center text-stone-400">
                  <div className="w-24 h-24 mx-auto mb-6 bg-[#FDFCF8] rounded-full flex items-center justify-center shadow-sm border border-stone-200">
                      <svg className="w-10 h-10 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                  </div>
                  <p className="text-lg font-semibold text-stone-700 mb-1">System Secure</p>
                  <p className="text-sm">No pending risks detected.</p>
              </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;