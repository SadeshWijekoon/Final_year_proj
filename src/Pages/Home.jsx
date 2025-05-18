import { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import Assessment from './Assessment';
import History from './History';

const Home = () => {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [user, setUser] = useState(null);
  const [showAssessment, setShowAssessment] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (authUser) => {
      if (authUser) {
        setUser(authUser);
        const userDoc = await getDoc(doc(db, 'users', authUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setName(userData.firstName);
          setRole(userData.role);
        } else {
          setUser(authUser);
          setName('');
          setRole('');
        }
      } else {
        setUser(null);
        setName('');
        setRole('');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  const handleAdminDashboard = () => {
    navigate('/admin');
  };

  const handleChat = () => {
    navigate('/chat');
  };

  const handleLogin = () => {
    navigate('/login');
  };

  const handleSignup = () => {
    navigate('/signup');
  };

  const handleChatWithPatient = () => {
    navigate('/live-consultation');
  };

  const handleCheckMentalHealth = () => {
    setShowAssessment(true);
    setShowHistory(false);
  };

  const handleViewHistory = () => {
    setShowHistory(true);
    setShowAssessment(false);
  };

  const closeAssessment = () => {
    setShowAssessment(false);
    setShowHistory(false);
  };

  const handleEmergencySupport = () => {
    window.open('https://srilankasumithrayo.lk/', '_blank');
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-blue-200 opacity-20 animate-float"
            style={{
              width: `${Math.random() * 10 + 5}rem`,
              height: `${Math.random() * 10 + 5}rem`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDuration: `${Math.random() * 20 + 10}s`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
        {[...Array(10)].map((_, i) => (
          <div
            key={i + 15}
            className="absolute rounded-full bg-indigo-200 opacity-15 animate-float-reverse"
            style={{
              width: `${Math.random() * 8 + 3}rem`,
              height: `${Math.random() * 8 + 3}rem`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDuration: `${Math.random() * 25 + 15}s`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-4">
        {user === null ? (
          <div className="text-center max-w-2xl p-8 bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20">
            <h1 className="text-4xl font-bold mb-6 text-gray-800 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Hi, Welcome to Medi Help!
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Medi Help is your comprehensive healthcare companion. Connect with 
              doctors for live consultations, chat with our AI assistant for 
              mental health support, and access personalized medical services 
              anytime, anywhere.
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={handleLogin}
                className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 px-6 transition-all duration-300 transform hover:-translate-y-1 shadow-md hover:shadow-lg"
              >
                Login
              </button>
              <button
                onClick={handleSignup}
                className="bg-green-600 text-white p-3 rounded-lg hover:bg-green-700 px-6 transition-all duration-300 transform hover:-translate-y-1 shadow-md hover:shadow-lg"
              >
                Signup
              </button>
            </div>
            <div className="mt-8 p-4 bg-red-50 rounded-lg border border-red-200 backdrop-blur-sm">
              <h3 className="text-lg font-semibold text-red-700 mb-2">Need immediate help?</h3>
              <button
                onClick={handleEmergencySupport}
                className="bg-red-600 text-white p-3 rounded-lg hover:bg-red-700 w-full flex items-center justify-center gap-2 transition-all duration-300 transform hover:scale-105"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                24/7 Emergency Support (Sumithrayo)
              </button>
            </div>
          </div>
        ) : (
          <>
            {showAssessment ? (
              <Assessment 
                user={user} 
                onClose={closeAssessment} 
                onViewHistory={handleViewHistory}
              />
            ) : showHistory ? (
              <History 
                user={user} 
                onClose={closeAssessment} 
                onTakeAssessment={handleCheckMentalHealth}
              />
            ) : (
              <div className="w-full max-w-2xl p-8 bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20">
                <h1 className="text-3xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Hi {name || 'Guest'}, Welcome to Medi Help!
                </h1>
                {role && (
                  <p className="text-xl text-gray-600 mb-6">
                    You are logged in as: <span className="font-semibold text-indigo-600">{role}</span>
                  </p>
                )}
                {/* Doctor-specific section */}
                {user && role === 'doctor' && (
                  <div className="mb-6 text-center">
                    <p className="text-xl text-gray-700 mb-4">
                      Hi Doctor {name}, welcome to Medi Help!
                    </p>
                    <button
                      onClick={handleChatWithPatient}
                      className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition-all duration-300 transform hover:-translate-y-1 shadow-md hover:shadow-lg"
                    >
                      Chat with Patient
                    </button>
                  </div>
                )}
                {/* Regular user section */}
                {user && role !== 'doctor' && role !== 'admin' && (
                  <div className="mb-6 text-center space-y-4 w-full">
                    <p className="text-xl text-gray-700 mb-4">Are You Stressed?</p>
                    <button
                      onClick={handleChat}
                      className="bg-green-600 text-white p-3 rounded-lg hover:bg-green-700 w-full transition-all duration-300 transform hover:-translate-y-1 shadow-md hover:shadow-lg"
                    >
                      Talk with us
                    </button>
                    <button
                      onClick={handleCheckMentalHealth}
                      className="bg-purple-600 text-white p-3 rounded-lg hover:bg-purple-700 w-full transition-all duration-300 transform hover:-translate-y-1 shadow-md hover:shadow-lg"
                    >
                      Check My Mental Health Status
                    </button>
                    <button
                      onClick={handleViewHistory}
                      className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 w-full transition-all duration-300 transform hover:-translate-y-1 shadow-md hover:shadow-lg"
                    >
                      View My History
                    </button>
                  </div>
                )}
                {/* Emergency support button for all users */}
                <div className="w-full mb-6 p-4 bg-red-50 rounded-lg border border-red-200 backdrop-blur-sm">
                  <h3 className="text-lg font-semibold text-red-700 mb-2">Emergency Support</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    If you're feeling distressed or need immediate emotional support, 
                    Sumithrayo provides 24/7 confidential support.
                  </p>
                  <button
                    onClick={handleEmergencySupport}
                    className="bg-red-600 text-white p-3 rounded-lg hover:bg-red-700 w-full flex items-center justify-center gap-2 transition-all duration-300 transform hover:scale-105"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    Contact Sumithrayo (24/7)
                  </button>
                </div>
                {/* Buttons for all authenticated users */}
                {user && (
                  <div className="flex flex-col gap-4">
                    {role === 'admin' && (
                      <button 
                        onClick={handleAdminDashboard}
                        className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition-all duration-300 transform hover:-translate-y-1 shadow-md hover:shadow-lg"
                      >
                        Admin Dashboard
                      </button>
                    )}
                    <button 
                      onClick={handleLogout} 
                      className="bg-red-600 text-white p-3 rounded-lg hover:bg-red-700 transition-all duration-300 transform hover:-translate-y-1 shadow-md hover:shadow-lg"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Home;