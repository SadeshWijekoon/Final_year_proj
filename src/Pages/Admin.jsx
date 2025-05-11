import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  deleteDoc,
  getDoc,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useNavigate } from 'react-router-dom';

const ADMIN_EMAIL = "admin@example.com";

const Admin = () => {
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState([]);
  const [isAddingDoctor, setIsAddingDoctor] = useState(false);
  const [newDoctor, setNewDoctor] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });
  const [adminPassword, setAdminPassword] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        const user = auth.currentUser;
        if (!user || user.email !== ADMIN_EMAIL) {
          navigate('/login');
          return;
        }

        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().role === 'admin') {
          setCurrentUser(userDoc.data());
          fetchDoctors();
        } else {
          await signOut(auth);
          navigate('/login');
        }
      } catch (error) {
        setErrorMessage('Authentication error. Please login again.');
        await signOut(auth);
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };

    const fetchDoctors = () => {
      const q = query(collection(db, 'users'), where('role', '==', 'doctor'));
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const doctorsList = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setDoctors(doctorsList);
      }, (error) => {
        setErrorMessage(`Failed to fetch doctors: ${error.message}`);
      });
      return () => unsubscribe();
    };

    checkAdminAccess();
  }, [navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewDoctor((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAdminPasswordChange = (e) => {
    setAdminPassword(e.target.value);
  };

  const addDoctor = async (e) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    if (
      !newDoctor.firstName.trim() ||
      !newDoctor.lastName.trim() ||
      !newDoctor.email.trim() ||
      newDoctor.password.length < 6
    ) {
      setErrorMessage('All fields are required and password must be at least 6 characters');
      return;
    }

    if (!adminPassword.trim()) {
      setErrorMessage('Please enter your admin password to confirm');
      return;
    }

    try {
      // Store admin email for re-authentication
      const adminEmail = auth.currentUser.email;

      // Create the new doctor
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        newDoctor.email,
        newDoctor.password
      );
      const user = userCredential.user;

      // Store doctor data in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        firstName: newDoctor.firstName,
        lastName: newDoctor.lastName,
        email: newDoctor.email,
        uid: user.uid,
        role: 'doctor',
        createdBy: auth.currentUser.uid,
        createdAt: new Date(),
      });

      // Sign out the newly created doctor
      await signOut(auth);

      // Re-sign in the admin
      await signInWithEmailAndPassword(auth, adminEmail, adminPassword);

      // Reset form
      setNewDoctor({ firstName: '', lastName: '', email: '', password: '' });
      setAdminPassword('');
      setSuccessMessage('Doctor added successfully! They can now log in with their credentials.');
      setIsAddingDoctor(false);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setErrorMessage(error.message);
      // Attempt to sign the admin back in if the process fails
      try {
        await signInWithEmailAndPassword(auth, ADMIN_EMAIL, adminPassword);
      } catch (reSignInError) {
        setErrorMessage('Failed to re-authenticate admin: ' + reSignInError.message);
        navigate('/login');
      }
    }
  };

  const removeDoctor = async (doctorId) => {
    if (!window.confirm('Are you sure you want to remove this doctor?')) return;

    try {
      await deleteDoc(doc(db, 'users', doctorId));
      setSuccessMessage('Doctor removed successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setErrorMessage('Failed to remove doctor: ' + error.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  if (loading) return <div className="flex justify-center items-center h-screen">Loading...</div>;

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <button 
          onClick={handleLogout} 
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded transition"
        >
          Logout
        </button>
      </div>

      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {errorMessage}
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Doctor Management</h2>
          <button
            onClick={() => setIsAddingDoctor(!isAddingDoctor)}
            className={`px-4 py-2 rounded transition ${isAddingDoctor ? 'bg-gray-500 hover:bg-gray-600' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
          >
            {isAddingDoctor ? 'Cancel' : 'Add Doctor'}
          </button>
        </div>

        {isAddingDoctor && (
          <form onSubmit={addDoctor} className="mb-6 p-4 border rounded-lg bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block mb-1 font-medium">First Name</label>
                <input
                  type="text"
                  name="firstName"
                  value={newDoctor.firstName}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block mb-1 font-medium">Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  value={newDoctor.lastName}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block mb-1 font-medium">Email</label>
              <input
                type="email"
                name="email"
                value={newDoctor.email}
                onChange={handleInputChange}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            
            <div className="mb-4">
              <label className="block mb-1 font-medium">Password</label>
              <input
                type="password"
                name="password"
                value={newDoctor.password}
                onChange={handleInputChange}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
                minLength="6"
              />
            </div>
            
            <div className="mb-4">
              <label className="block mb-1 font-medium">Your Admin Password (for confirmation)</label>
              <input
                type="password"
                value={adminPassword}
                onChange={handleAdminPasswordChange}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            
            <button 
              type="submit" 
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition"
            >
              Add Doctor
            </button>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-3 text-left">First Name</th>
                <th className="border p-3 text-left">Last Name</th>
                <th className="border p-3 text-left">Email</th>
                <th className="border p-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {doctors.length > 0 ? (
                doctors.map((doctor) => (
                  <tr key={doctor.id} className="hover:bg-gray-50">
                    <td className="border p-3">{doctor.firstName}</td>
                    <td className="border p-3">{doctor.lastName}</td>
                    <td className="border p-3">{doctor.email}</td>
                    <td className="border p-3">
                      <button
                        onClick={() => removeDoctor(doctor.id)}
                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm transition"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="border p-3 text-center text-gray-500">
                    No doctors found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Admin;