import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, orderBy, getDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const Live = () => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [error, setError] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [onlineStatus, setOnlineStatus] = useState({});
  const navigate = useNavigate();

  // Enhanced online status tracking
  const updateOnlineStatus = async (userId, isOnline) => {
    try {
      // Add new presence record
      await addDoc(collection(db, 'presence'), {
        userId,
        isOnline,
        timestamp: new Date(),
        lastUpdated: new Date()
      });
      
      // Update user's lastActive field when going offline
      if (!isOnline) {
        await updateDoc(doc(db, 'users', userId), {
          lastActive: new Date()
        });
      }
    } catch (err) {
      console.error('Error updating online status:', err);
    }
  };

  // Handle logout with proper status update
  const handleLogout = async () => {
    try {
      if (auth.currentUser) {
        await updateOnlineStatus(auth.currentUser.uid, false);
      }
      await auth.signOut();
      navigate('/login');
    } catch (err) {
      console.error('Error during logout:', err);
      setError('Failed to logout properly');
    }
  };

  // Function to delete a message
  const deleteMessage = async (messageId, senderId) => {
    if (!selectedContact || !auth.currentUser) return;
    
    // Check if user is admin or the message sender
    if (userRole !== 'admin' && senderId !== auth.currentUser.uid) {
      setError('You can only delete your own messages');
      return;
    }

    try {
      const chatId = [auth.currentUser.uid, selectedContact.id].sort().join('_');
      await deleteDoc(doc(db, 'chats', chatId, 'messages', messageId));
      setError(null);
      toast.success('Message deleted successfully');
    } catch (err) {
      console.error('Error deleting message:', err.message);
      setError('Failed to delete message. Please try again.');
    }
  };

  // Auth state and user role management
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        navigate('/login');
      } else {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setUserRole(userDoc.data().role);
            await updateOnlineStatus(user.uid, true);
          } else {
            setError('User data not found.');
            navigate('/login');
          }
        } catch (err) {
          console.error('Error fetching user role:', err.message);
          setError('Failed to load user data. Please try again.');
        }
      }
    });
    return unsubscribe;
  }, [navigate]);

  // Enhanced real-time presence tracking
  useEffect(() => {
    if (!userRole) return;

    // Heartbeat to keep status active
    const heartbeatInterval = setInterval(() => {
      if (auth.currentUser) {
        updateOnlineStatus(auth.currentUser.uid, true);
      }
    }, 30000); // Update every 30 seconds

    // Handle page/tab closing
    const handleBeforeUnload = () => {
      if (auth.currentUser) {
        updateOnlineStatus(auth.currentUser.uid, false);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Subscribe to presence updates with optimized query
    const presenceQuery = query(
      collection(db, 'presence'),
      orderBy('timestamp', 'desc')
    );
    
    const presenceUnsubscribe = onSnapshot(presenceQuery, (snapshot) => {
      const statusUpdates = {};
      const now = new Date();
      
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        // Consider user offline if no update in last 2 minutes
        const isRecent = (now - data.timestamp.toDate()) < 120000;
        statusUpdates[data.userId] = data.isOnline && isRecent;
      });

      setOnlineStatus(prev => ({
        ...prev,
        ...statusUpdates
      }));
    });

    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      presenceUnsubscribe();
      
      if (auth.currentUser) {
        updateOnlineStatus(auth.currentUser.uid, false);
      }
    };
  }, [userRole]);

  // Fetch contacts with online status
  useEffect(() => {
    if (!userRole) return;

    const fetchContacts = () => {
      let contactsQuery;
      if (userRole === 'doctor') {
        // Doctors can see both users and admins
        contactsQuery = query(
          collection(db, 'users'),
          where('role', 'in', ['user', 'admin'])
        );
      } else if (userRole === 'admin') {
        // Admins can see both doctors and users
        contactsQuery = query(
          collection(db, 'users'),
          where('role', 'in', ['doctor', 'user'])
        );
      } else {
        // Regular users can only see doctors (not admins)
        contactsQuery = query(
          collection(db, 'users'),
          where('role', '==', 'doctor')
        );
      }

      const unsubscribe = onSnapshot(contactsQuery, (snapshot) => {
        const contactsList = snapshot.docs.map((doc) => ({ 
          id: doc.id, 
          ...doc.data(),
          isOnline: onlineStatus[doc.id] || false
        }));
        setContacts(contactsList);
        setError(null);
      }, (err) => {
        console.error('Error fetching contacts:', err.message);
        setError('Failed to load contacts. Please try again later.');
      });

      return unsubscribe;
    };

    const unsubscribe = fetchContacts();
    return () => unsubscribe();
  }, [userRole, onlineStatus]);

  // Fetch messages for the selected contact
  useEffect(() => {
    if (!selectedContact || !auth.currentUser) {
      setMessages([]);
      return;
    }

    const chatId = [auth.currentUser.uid, selectedContact.id].sort().join('_');
    const messagesQuery = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('timestamp')
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const messagesList = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMessages(messagesList);
      setError(null);

      if (userRole === 'doctor') {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' && change.doc.data().senderId !== auth.currentUser.uid) {
            const newMessage = change.doc.data();
            toast.info(`New message from ${selectedContact.firstName}: ${newMessage.text}`, {
              position: 'top-right',
              autoClose: 5000,
              hideProgressBar: false,
              closeOnClick: true,
              pauseOnHover: true,
              draggable: true,
            });
          }
        });
      }
    }, (err) => {
      console.error('Error fetching messages:', err.message);
      setError('Failed to load messages. Please try again later.');
    });

    return () => unsubscribe();
  }, [selectedContact, userRole]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || !selectedContact || !auth.currentUser) {
      setError('Please enter a message and select a contact.');
      return;
    }

    try {
      const chatId = [auth.currentUser.uid, selectedContact.id].sort().join('_');
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text: message,
        senderId: auth.currentUser.uid,
        timestamp: new Date(),
      });
      setMessage('');
      setError(null);
    } catch (err) {
      console.error('Error sending message:', err.message);
      setError('Failed to send message. Please try again.');
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <ToastContainer />

      {/* Contact List */}
      <div className="w-1/4 bg-white p-4 border-r">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            {userRole === 'doctor' ? 'Patients & Admins' : 
             userRole === 'admin' ? 'All Users' : 'Doctors'}
          </h2>
          <button 
            onClick={handleLogout}
            className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
          >
            Logout
          </button>
        </div>
        
        {error && <p className="text-red-500 mb-4">{error}</p>}
        
        {contacts.length > 0 ? (
          <ul>
            {contacts.map((contact) => (
              <li
                key={contact.id}
                onClick={() => setSelectedContact(contact)}
                className={`p-2 cursor-pointer flex items-center ${
                  selectedContact?.id === contact.id ? 'bg-blue-100' : 'hover:bg-gray-100'
                }`}
              >
                <span 
                  className={`inline-block w-3 h-3 rounded-full mr-2 ${
                    onlineStatus[contact.id] ? 'bg-green-500' : 'bg-red-500'
                  }`}
                  title={onlineStatus[contact.id] ? 'Online' : 'Offline'}
                ></span>
                <div>
                  <p>{contact.firstName} {contact.lastName}</p>
                  <p className="text-xs text-gray-500">
                    {contact.role} • {onlineStatus[contact.id] ? 'Online' : 'Offline'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">No contacts available</p>
        )}
      </div>

      {/* Chat Window */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 p-4 overflow-y-auto">
          {selectedContact ? (
            <>
              <div className="flex items-center mb-4">
                <span 
                  className={`inline-block w-3 h-3 rounded-full mr-2 ${
                    onlineStatus[selectedContact.id] ? 'bg-green-500' : 'bg-red-500'
                  }`}
                  title={onlineStatus[selectedContact.id] ? 'Online' : 'Offline'}
                ></span>
                <h3 className="text-lg font-semibold">
                  {selectedContact.firstName} {selectedContact.lastName} ({selectedContact.role})
                </h3>
              </div>
              
              {messages.length > 0 ? (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`mb-4 group relative ${
                      msg.senderId === auth.currentUser?.uid ? 'text-right' : 'text-left'
                    }`}
                  >
                    <div
                      className={`inline-block p-2 rounded-lg ${
                        msg.senderId === auth.currentUser?.uid
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-800'
                      }`}
                    >
                      {msg.text}
                      {/* Delete button - only shown on hover and if user has permission */}
                      {(userRole === 'admin' || msg.senderId === auth.currentUser?.uid) && (
                        <button
                          onClick={() => deleteMessage(msg.id, msg.senderId)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                          title="Delete message"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500">No messages yet. Start the conversation!</p>
              )}
            </>
          ) : (
            <p className="text-gray-500">
              Select a {userRole === 'doctor' ? 'patient or admin' : userRole === 'admin' ? 'user or doctor' : 'doctor'} to start chatting.
            </p>
          )}
        </div>

        {/* Message Input */}
        {selectedContact && (
          <form onSubmit={sendMessage} className="p-4 border-t">
            <div className="flex">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 p-2 border rounded-lg"
              />
              <button
                type="submit"
                className="ml-2 bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700"
              >
                Send
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default Live;