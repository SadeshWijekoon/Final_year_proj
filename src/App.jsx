import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Navbar from './Navbar/Navbar';
import Home from './Pages/Home';
import Chat from './pages/Chat';
import Feed from './Pages/Feed';
import LiveConsultation from './pages/Live';
import Login from './Pages/Login';
import Signup from './Pages/Signup';
import Admin from './Pages/Admin';
import { auth } from './firebase';

const ProtectedRoute = ({ children, requiredRole = 'admin' }) => {
  const user = auth.currentUser;
  
  if (!user) {
    return <Navigate to="/login" />;
  }

  // We'll check the role from Firestore in the component itself
  return children;
};

function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/feed" element={<Feed />} />
        <Route path="/live-consultation" element={<LiveConsultation />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute>
              <Admin />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;