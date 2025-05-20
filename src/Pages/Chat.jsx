import { useState, useEffect, useRef } from "react";
import { auth, db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { collection, doc, setDoc, getDocs, query, where, orderBy, Timestamp, writeBatch } from 'firebase/firestore';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [puterReady, setPuterReady] = useState(false);
  const [chatSessions, setChatSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const navigate = useNavigate();
  const puterScriptRef = useRef(null);
  const messagesEndRef = useRef(null);
  const canvasRef = useRef(null);

  // Floating bubbles effect
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    class Bubble {
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 5 + 2;
        this.speedX = Math.random() * 0.2 - 0.1;
        this.speedY = Math.random() * 0.2 - 0.1;
        this.opacity = Math.random() * 0.3 + 0.1;
        this.color = `rgba(26, 115, 232, ${this.opacity})`;
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;

        if (this.x > canvas.width + 5 || this.x < -5) {
          this.speedX = -this.speedX;
        }
        if (this.y > canvas.height + 5 || this.y < -5) {
          this.speedY = -this.speedY;
        }
      }

      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
      }
    }

    const bubbles = [];
    for (let i = 0; i < 30; i++) {
      bubbles.push(new Bubble());
    }

    let animationId;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      bubbles.forEach(bubble => {
        bubble.update();
        bubble.draw();
      });
      animationId = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Check authentication status
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((authUser) => {
      if (authUser) {
        setUser(authUser);
        loadChatSessions(authUser.uid);
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Load chat sessions from Firestore
  const loadChatSessions = async (userId) => {
    try {
      const sessionsRef = collection(db, 'chat_history', userId, 'sessions');
      const q = query(sessionsRef, orderBy('lastUpdated', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const sessions = [];
      querySnapshot.forEach((doc) => {
        sessions.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      setChatSessions(sessions);
      
      // If there are sessions but none active, set the most recent one as active
      if (sessions.length > 0 && !activeSession) {
        setActiveSession(sessions[0].id);
        loadChatMessages(userId, sessions[0].id);
      }
    } catch (error) {
      console.error("Error loading chat sessions:", error);
    }
  };

  // Load messages for a specific chat session
  const loadChatMessages = async (userId, sessionId) => {
    try {
      const messagesRef = collection(db, 'chat_history', userId, 'sessions', sessionId, 'messages');
      const q = query(messagesRef, orderBy('timestamp'));
      const querySnapshot = await getDocs(q);
      
      const loadedMessages = [];
      querySnapshot.forEach((doc) => {
        loadedMessages.push({
          text: doc.data().text,
          sender: doc.data().sender
        });
      });
      
      setMessages(loadedMessages);
      setActiveSession(sessionId);
      setShowHistory(false); // Close history after selecting a session
    } catch (error) {
      console.error("Error loading chat messages:", error);
    }
  };

  // Save current chat session
  const saveChatSession = async () => {
    if (!user || messages.length === 0) return;

    try {
      const sessionId = activeSession || `session_${Date.now()}`; // Ensure consistent ID format
      const sessionRef = doc(db, 'chat_history', user.uid, 'sessions', sessionId);
      
      // Save session metadata
      await setDoc(sessionRef, {
        title: messages[0]?.text?.substring(0, 50) + (messages[0]?.text?.length > 50 ? '...' : '') || 'New Chat',
        lastUpdated: Timestamp.now(),
        messageCount: messages.length,
        userId: user.uid
      }, { merge: true });

      // Clear existing messages and add all current ones using a batch
      const batch = writeBatch(db);
      
      // First get existing messages to avoid deleting and recreating unnecessarily
      const messagesRef = collection(db, 'chat_history', user.uid, 'sessions', sessionId, 'messages');
      const existingMessagesSnapshot = await getDocs(messagesRef);
      
      // Delete existing messages that are no longer in the current state
      existingMessagesSnapshot.forEach(doc => {
        const msgIndex = parseInt(doc.id.split('_')[1]);
        if (msgIndex >= messages.length) {
          batch.delete(doc.ref);
        }
      });
      
      // Add or update all current messages
      messages.forEach((msg, index) => {
        const messageRef = doc(db, 'chat_history', user.uid, 'sessions', sessionId, 'messages', `msg_${index}`);
        batch.set(messageRef, {
          text: msg.text,
          sender: msg.sender,
          timestamp: Timestamp.now(),
          userId: user.uid
        });
      });

      await batch.commit();
      
      if (!activeSession) {
        setActiveSession(sessionId);
        // Reload sessions to include the new one
        await loadChatSessions(user.uid);
      }
    } catch (error) {
      console.error("Error saving chat session:", error);
      throw error; // Rethrow to handle in caller
    }
  };

  // Create a new chat session
  const startNewChat = async () => {
    if (messages.length > 0) {
      await saveChatSession();
    }
    setMessages([]);
    setActiveSession(null);
    setInput("");
  };

  // Load Puter.js script only once
  useEffect(() => {
    if (puterScriptRef.current || !user) return;

    const checkPuterReady = () => {
      if (window.puter && window.puter.ai) {
        setPuterReady(true);
      }
    };

    const scriptExists = document.querySelector('script[src="https://js.puter.com/v2/"]');
    if (scriptExists) {
      if (window.puter && window.puter.ai) {
        setPuterReady(true);
      } else {
        scriptExists.onload = checkPuterReady;
      }
      return;
    }

    puterScriptRef.current = document.createElement('script');
    puterScriptRef.current.src = 'https://js.puter.com/v2/';
    puterScriptRef.current.async = true;
    puterScriptRef.current.onload = checkPuterReady;
    document.body.appendChild(puterScriptRef.current);

    return () => {
      if (puterScriptRef.current) {
        document.body.removeChild(puterScriptRef.current);
      }
      puterScriptRef.current = null;
    };
  }, [user]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Save chat when component unmounts or when messages change significantly
  useEffect(() => {
    return () => {
      if (user && messages.length > 0) {
        saveChatSession();
      }
    };
  }, [messages, user]);

  const extractContent = (response) => {
    console.log("Extracting content from:", response);
    
    try {
      if (typeof response === 'string') {
        if (response.startsWith('{') || response.startsWith('[')) {
          try {
            const parsedResponse = JSON.parse(response);
            return extractContent(parsedResponse);
          } catch (e) {
            console.log("Not valid JSON, using as string");
            return response;
          }
        }
        return response;
      }
      
      if (response && response.message && response.message.role === 'assistant' && response.message.content) {
        return response.message.content;
      }
      
      if (response && response.role === 'assistant' && response.content) {
        return response.content;
      }
      
      if (response && typeof response === 'object') {
        if (response.content) return response.content;
        if (response.message?.content) return response.message.content;
        
        if (response.index !== undefined && response.message) {
          if (typeof response.message === 'string') return response.message;
          if (response.message.content) return response.message.content;
        }
      }
      
      if (typeof response === 'object') {
        return JSON.stringify(response);
      }
      
      return "I received a response but couldn't extract the content. Please try again.";
    } catch (error) {
      console.error("Error extracting content:", error);
      return "Error processing response. Please try again.";
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !puterReady) return;

    const newMessages = [...messages, { text: input, sender: "user" }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const chatHistory = newMessages.map(msg => ({
        content: typeof msg.text === 'object' ? JSON.stringify(msg.text) : msg.text,
        role: msg.sender === "user" ? "user" : "assistant"
      }));

      console.log("Sending chat history:", chatHistory);

      const response = await window.puter.ai.chat(chatHistory);
      console.log("Raw API Response:", response);
      
      let botResponse = extractContent(response);
      console.log("Extracted bot response:", botResponse);
      
      const updatedMessages = [...newMessages, { text: botResponse, sender: "bot" }];
      setMessages(updatedMessages);
      
      // Save the session after receiving bot response
      await saveChatSession();
    } catch (error) {
      console.error("API Error:", error);
      setMessages([...newMessages, { 
        text: error.message || "Sorry, I encountered an error. Please try again.", 
        sender: "bot" 
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Navigation handlers
  const handleSignup = () => navigate('/signup');
  const handleLogin = () => navigate('/login');

  // Format message text for display
  const formatMessageText = (text) => {
    if (typeof text === 'string') {
      return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n\n/g, '<br/><br/>')
        .replace(/\n/g, '<br/>');
    }
    return text;
  };

  // Render for unauthenticated users
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-[#f9f9f9] to-[#e6e6e6] p-4 relative overflow-hidden">
        <canvas 
          ref={canvasRef} 
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
        />
        
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm p-8 text-center relative z-10">
          <h1 className="text-2xl font-semibold text-gray-800 mb-2">Welcome to MediHelp AI</h1>
          <p className="text-gray-600 mb-6">
            Create your account or login to access our mental health support chat.
          </p>
          <div className="flex flex-col space-y-3">
            <button
              onClick={handleSignup}
              className="bg-[#1a73e8] text-white py-2.5 px-4 rounded-lg hover:bg-[#0d5bbc] transition-colors font-medium"
            >
              Sign Up
            </button>
            <button
              onClick={handleLogin}
              className="border border-[#1a73e8] text-[#1a73e8] py-2.5 px-4 rounded-lg hover:bg-[#f5f9ff] transition-colors font-medium"
            >
              Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render for authenticated users
  return (
    <div className="flex flex-col h-screen bg-[#f9f9f9] relative overflow-hidden">
      {/* Floating bubbles canvas */}
      <canvas 
        ref={canvasRef} 
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
      />

      {/* Header */}
      <header className="bg-white border-b border-gray-200 py-3 px-4 relative z-10 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold text-gray-800">MediHelp AI</h1>
          {!puterReady && (
            <p className="text-xs text-yellow-600">Initializing AI service...</p>
          )}
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            title="Chat history"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            onClick={startNewChat}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            title="New chat"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden relative z-10">
        {/* Chat history sidebar */}
        {showHistory && (
          <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="font-medium text-gray-800">Chat History</h2>
                <button 
                  onClick={startNewChat}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  New Chat
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {chatSessions.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No previous chats found
                </div>
              ) : (
                <ul>
                  {chatSessions.map((session) => (
                    <li key={session.id}>
                      <button
                        onClick={() => loadChatMessages(user.uid, session.id)}
                        className={`w-full text-left p-3 hover:bg-gray-50 ${activeSession === session.id ? 'bg-blue-50 text-blue-600' : 'text-gray-700'}`}
                      >
                        <div className="truncate font-medium">{session.title}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(session.lastUpdated?.toDate()).toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-400">
                          {session.messageCount} messages
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                <div className="max-w-md">
                  <h2 className="text-xl font-medium mb-2">How can I help you today?</h2>
                  <p>Ask me anything about mental health, stress management, or emotional well-being.</p>
                  {!puterReady && (
                    <p className="text-sm text-yellow-600 mt-2">
                      AI service is initializing. Please wait...
                    </p>
                  )}
                </div>
              </div>
            )}
            
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-3xl rounded-xl px-4 py-3 ${
                    msg.sender === "user" 
                      ? "bg-[#1a73e8] text-white rounded-br-none" 
                      : "bg-white border border-gray-200 rounded-bl-none shadow-sm"
                  }`}
                >
                  {msg.sender === "bot" ? (
                    <div 
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: formatMessageText(msg.text) }}
                    />
                  ) : (
                    <div>{msg.text}</div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
            
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-xl rounded-bl-none px-4 py-3 shadow-sm max-w-3xl">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></div>
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="border-t border-gray-200 bg-white p-4">
            <div className="flex items-center rounded-xl border border-gray-300 bg-white focus-within:border-[#1a73e8] focus-within:shadow-md transition-all">
              <input
                type="text"
                className="flex-1 px-4 py-3 bg-transparent outline-none text-gray-800 placeholder-gray-400"
                placeholder={puterReady ? "Ask about mental health..." : "Initializing AI..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                disabled={!puterReady}
              />
              <button
                className={`m-1 p-2 rounded-lg ${
                  input.trim() && puterReady 
                    ? 'bg-[#1a73e8] text-white' 
                    : 'bg-gray-100 text-gray-400'
                }`}
                onClick={handleSendMessage}
                disabled={loading || !input.trim() || !puterReady}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              MediHelp AI may produce inaccurate information about people, places, or facts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;