import { useState, useEffect, useRef } from "react";
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [puterReady, setPuterReady] = useState(false);
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

    // Bubble class
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

    // Create bubbles
    const bubbles = [];
    for (let i = 0; i < 30; i++) {
      bubbles.push(new Bubble());
    }

    // Animation loop
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

    // Handle resize
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
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

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
      puterScriptRef.current = null;
    };
  }, [user]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const extractContent = (response) => {
    // Log response for debugging
    console.log("Extracting content from:", response);
    
    try {
      // If response is already a string, return it directly
      if (typeof response === 'string') {
        // If it's a JSON string, try to parse it
        if (response.startsWith('{') || response.startsWith('[')) {
          try {
            const parsedResponse = JSON.parse(response);
            return extractContent(parsedResponse); // Recursively process the parsed object
          } catch (e) {
            console.log("Not valid JSON, using as string");
            return response;
          }
        }
        return response;
      }
      
      // Handle the format in the newer example
      if (response && response.message && response.message.role === 'assistant' && response.message.content) {
        return response.message.content;
      }
      
      // Handle the format from the first example
      if (response && response.role === 'assistant' && response.content) {
        return response.content;
      }
      
      // Generic object checks
      if (response && typeof response === 'object') {
        if (response.content) return response.content;
        if (response.message?.content) return response.message.content;
        
        // Look for nested message structure
        if (response.index !== undefined && response.message) {
          if (typeof response.message === 'string') return response.message;
          if (response.message.content) return response.message.content;
        }
      }
      
      // If we couldn't extract content but have an object, convert to string for inspection
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
      // Format chat history properly
      const chatHistory = newMessages.map(msg => ({
        content: typeof msg.text === 'object' ? JSON.stringify(msg.text) : msg.text,
        role: msg.sender === "user" ? "user" : "assistant"
      }));

      // Log the chat history being sent for debugging
      console.log("Sending chat history:", chatHistory);

      // Call Puter.ai API
      const response = await window.puter.ai.chat(chatHistory);
      console.log("Raw API Response:", response);
      
      // Handle the response based on the format received
      let botResponse;
      
      // Handle string responses first (may be JSON strings)
      if (typeof response === 'string') {
        try {
          if (response.startsWith('{') || response.startsWith('[')) {
            const parsedResponse = JSON.parse(response);
            botResponse = extractContent(parsedResponse);
          } else {
            botResponse = response;
          }
        } catch (e) {
          botResponse = response; // Use as-is if parsing fails
        }
      } 
      // Handle direct object responses
      else if (typeof response === 'object') {
        // Check for the specific format seen in the examples
        if (response.message && response.message.role === 'assistant' && response.message.content) {
          botResponse = response.message.content;
        } else if (response.role === 'assistant' && response.content) {
          botResponse = response.content;
        } else {
          // Fall back to our extraction function for other formats
          botResponse = extractContent(response);
        }
      }
      else {
        // Fall back to the generic extraction if the format is not recognized
        botResponse = extractContent(response);
      }
      
      console.log("Extracted bot response:", botResponse);
      setMessages([...newMessages, { text: botResponse, sender: "bot" }]);
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
      // Simple markdown-like formatting for better readability
      return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
        .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
        .replace(/`(.*?)`/g, '<code>$1</code>') // Code
        .replace(/\n\n/g, '<br/><br/>') // Paragraphs
        .replace(/\n/g, '<br/>'); // Line breaks
    }
    return text;
  };

  // Render for unauthenticated users
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-[#f9f9f9] to-[#e6e6e6] p-4 relative overflow-hidden">
        {/* Floating bubbles canvas */}
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
      <header className="bg-white border-b border-gray-200 py-3 px-4 relative z-10">
        <h1 className="text-xl font-semibold text-gray-800">MediHelp AI</h1>
        {!puterReady && (
          <p className="text-xs text-yellow-600">Initializing AI service...</p>
        )}
      </header>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 relative z-10">
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
              className={`max-w-3xl rounded-xl px-4 py-3 relative z-10 ${
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
            <div className="bg-white border border-gray-200 rounded-xl rounded-bl-none px-4 py-3 shadow-sm max-w-3xl relative z-10">
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
      <div className="border-t border-gray-200 bg-white p-4 relative z-10">
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
  );
};

export default Chat;