import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
//Previous libraries
import React, { useState, useEffect } from 'react';
import { Clock, User, MapPin, Settings, PlusCircle, CheckCircle, Truck, Trash2, Lock } from 'lucide-react';
import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

// Main App Component
const MessengerTrackingApp = () => {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // Application state
  const [view, setView] = useState('tracking'); // tracking, tripPlanner, admin
  const [messengers, setMessengers] = useState([]);
  const [locations, setLocations] = useState([]);
  
  const [tripDetails, setTripDetails] = useState({
    messengerId: '',
    origin: '',
    destination: '',
  });
  
  const [newMessenger, setNewMessenger] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Sistema de contraseña - Contraseña establecida (mejor usar variable de entorno en producción)
  const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD || "recollect2025";
  
  // Cargar datos iniciales
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      
      // Verificar si hay datos y cargarlos inicialmente si no existen
      const messengersSnapshot = await getDocs(collection(db, "messengers"));
      const locationsSnapshot = await getDocs(collection(db, "locations"));
      
      // Si no hay mensajeros ni ubicaciones, cargar datos iniciales
      if (messengersSnapshot.empty && locationsSnapshot.empty) {
        await initializeFirebaseData();
      }
      
      // Configurar escuchas en tiempo real
      setupFirebaseListeners();
      
      setLoading(false);
    };
    
    loadInitialData();
  }, []);
  
  // Inicializar datos si la base de datos está vacía
  const initializeFirebaseData = async () => {
    console.log("Inicializando datos en Firebase...");
    
    // Datos iniciales de ubicaciones
    const initialLocations = [
      'Almacén A', 'Almacén B', 'Almacén C', 'Cliente A', 'Cliente B', 'Cliente C', 'Oficina'
    ];
    
    // Cargar ubicaciones iniciales
    for (const location of initialLocations) {
      await addDoc(collection(db, "locations"), { name: location });
    }
    
    // Datos iniciales de mensajeros
    const initialMessengers = [
      { name: 'Juan Pérez', status: 'idle', origin: '', destination: '', startTime: null, endTime: null, duration: 0 },
      { name: 'Ana Martínez', status: 'on-route', origin: 'Almacén A', destination: 'Cliente B', startTime: Timestamp.fromDate(new Date(Date.now() - 45 * 60000)), endTime: null, duration: 45 },
      { name: 'Miguel Rodríguez', status: 'completed', origin: 'Oficina', destination: 'Almacén C', startTime: Timestamp.fromDate(new Date(Date.now() - 120 * 60000)), endTime: Timestamp.fromDate(new Date()), duration: 120 },
    ];
    
    // Cargar mensajeros iniciales
    for (const messenger of initialMessengers) {
      await addDoc(collection(db, "messengers"), messenger);
    }
    
    console.log("Datos iniciales cargados correctamente.");
  };
  
  // Configurar escuchas en tiempo real para Firestore
  const setupFirebaseListeners = () => {
    // Escucha para mensajeros
    const unsubscribeMessengers = onSnapshot(collection(db, "messengers"), (snapshot) => {
      const messengerData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Convertir Timestamp a Date para facilitar su uso
        startTime: doc.data().startTime ? doc.data().startTime.toDate() : null,
        endTime: doc.data().endTime ? doc.data().endTime.toDate() : null
      }));
      setMessengers(messengerData);
    });
    
    // Escucha para ubicaciones
    const unsubscribeLocations = onSnapshot(collection(db, "locations"), (snapshot) => {
      const locationData = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      }));
      setLocations(locationData.map(loc => loc.name));
    });
    
    // Limpiar escuchas al desmontar
    return () => {
      unsubscribeMessengers();
      unsubscribeLocations();
    };
  };
  
  // Actualizar duración de viajes en curso
  useEffect(() => {
    // No ejecutar si no hay mensajeros o aún estamos cargando
    if (loading || messengers.length === 0) return;
    
    const interval = setInterval(async () => {
      for (const messenger of messengers) {
        if (messenger.status === 'on-route') {
          const now = new Date();
          const start = new Date(messenger.startTime);
          const durationMinutes = Math.floor((now - start) / 60000);
          
          // Actualizar duración en Firestore
          const messengerRef = doc(db, "messengers", messenger.id);
          await updateDoc(messengerRef, { duration: durationMinutes });
        }
      }
    }, 60000); // Actualizar cada minuto
    
    return () => clearInterval(interval);
  }, [loading, messengers]);
  
  // Handle login
  const handleLogin = (e) => {
    e.preventDefault();
    console.log("Intento de inicio de sesión con:", password);
    if (password === APP_PASSWORD) {
      console.log("Contraseña correcta, autenticando...");
      setIsAuthenticated(true);
      setLoginError('');
    } else {
      console.log("Contraseña incorrecta");
      setLoginError('Contraseña incorrecta');
    }
  };
  
  // Handle logout
  const handleLogout = () => {
    setIsAuthenticated(false);
    setPassword('');
  };
  
  // Start a new trip
  const startTrip = async () => {
    if (!tripDetails.messengerId || !tripDetails.origin || !tripDetails.destination) {
      alert('Por favor seleccione un mensajero, origen y destino');
      return;
    }
    
    try {
      // Obtener referencia al documento del mensajero
      const messengerRef = doc(db, "messengers", tripDetails.messengerId);
      
      // Actualizar el documento
      await updateDoc(messengerRef, {
        status: 'on-route',
        origin: tripDetails.origin,
        destination: tripDetails.destination,
        startTime: Timestamp.fromDate(new Date()),
        endTime: null,
        duration: 0
      });
      
      // Reiniciar detalles del viaje y volver a la vista de seguimiento
      setTripDetails({ messengerId: '', origin: '', destination: '' });
      setView('tracking');
    } catch (error) {
      console.error("Error al iniciar viaje:", error);
      alert("Error al iniciar el viaje. Inténtelo nuevamente.");
    }
  };
  
  // Complete a trip
  const completeTrip = async (id) => {
    try {
      // Obtener el mensajero actual
      const messenger = messengers.find(m => m.id === id);
      if (!messenger || messenger.status !== 'on-route') return;
      
      const now = new Date();
      const start = new Date(messenger.startTime);
      const durationMinutes = Math.floor((now - start) / 60000);
      
      // Actualizar el documento
      const messengerRef = doc(db, "messengers", id);
      await updateDoc(messengerRef, {
        status: 'completed',
        endTime: Timestamp.fromDate(now),
        duration: durationMinutes
      });
    } catch (error) {
      console.error("Error al completar viaje:", error);
      alert("Error al completar el viaje. Inténtelo nuevamente.");
    }
  };
  
  // Add new messenger
  const addMessenger = async () => {
    if (!newMessenger.trim()) return;
    
    try {
      // Crear nuevo documento de mensajero
      await addDoc(collection(db, "messengers"), {
        name: newMessenger,
        status: 'idle',
        origin: '',
        destination: '',
        startTime: null,
        endTime: null,
        duration: 0
      });
      
      // Limpiar el formulario
      setNewMessenger('');
    } catch (error) {
      console.error("Error al añadir mensajero:", error);
      alert("Error al añadir el mensajero. Inténtelo nuevamente.");
    }
  };
  
  // Add new location
  const addLocation = async () => {
    if (!newLocation.trim() || locations.includes(newLocation)) return;
    
    try {
      // Crear nuevo documento de ubicación
      await addDoc(collection(db, "locations"), {
        name: newLocation
      });
      
      // Limpiar el formulario
      setNewLocation('');
    } catch (error) {
      console.error("Error al añadir ubicación:", error);
      alert("Error al añadir la ubicación. Inténtelo nuevamente.");
    }
  };
  
  // Delete messenger
  const deleteMessenger = async (id) => {
    // Verificar si el mensajero está en ruta
    const messenger = messengers.find(m => m.id === id);
    if (messenger && messenger.status === 'on-route') {
      alert('No se puede eliminar un mensajero que está en ruta');
      return;
    }
    
    try {
      // Eliminar documento
      await deleteDoc(doc(db, "messengers", id));
    } catch (error) {
      console.error("Error al eliminar mensajero:", error);
      alert("Error al eliminar el mensajero. Inténtelo nuevamente.");
    }
  };
  
  // Delete location
  const deleteLocation = async (locationToDelete) => {
    // Verificar si la ubicación está en uso
    const isLocationInUse = messengers.some(
      messenger => 
        messenger.origin === locationToDelete || 
        messenger.destination === locationToDelete
    );
    
    if (isLocationInUse) {
      alert('No se puede eliminar una ubicación que está siendo utilizada');
      return;
    }
    
    try {
      // Buscar el ID del documento de ubicación
      const locationsSnapshot = await getDocs(
        query(collection(db, "locations"), where("name", "==", locationToDelete))
      );
      
      if (!locationsSnapshot.empty) {
        // Eliminar el documento
        await deleteDoc(doc(db, "locations", locationsSnapshot.docs[0].id));
      }
    } catch (error) {
      console.error("Error al eliminar ubicación:", error);
      alert("Error al eliminar la ubicación. Inténtelo nuevamente.");
    }
  };
  
  // Render the login view
  const renderLoginView = () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-blue-700 mb-2">Sistema de Seguimiento de Mensajeros</h1>
          <p className="text-gray-600">Por favor ingrese la contraseña para acceder</p>
        </div>
        
        <div className="mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="password"
              className="pl-10 w-full p-3 border rounded-lg"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {loginError && (
            <p className="mt-2 text-sm text-red-600">{loginError}</p>
          )}
        </div>
        
        <button
          onClick={handleLogin}
          className="w-full bg-blue-600 text-white p-3 rounded-lg font-medium hover:bg-blue-700 transition"
        >
          Iniciar Sesión
        </button>
      </div>
    </div>
  );
  
  // Render loading view
  const renderLoadingView = () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-700 mx-auto mb-4"></div>
        <p className="text-gray-600">Cargando datos...</p>
      </div>
    </div>
  );
  
  // Render the tracking view
  const renderTrackingView = () => (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center"><Truck className="mr-2" /> Panel de Seguimiento de Mensajeros</h2>
      
      <div className="overflow-x-auto bg-white shadow-md rounded-lg">
        <table className="min-w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-3 px-4 text-left">Mensajero</th>
              <th className="py-3 px-4 text-left">Estado</th>
              <th className="py-3 px-4 text-left">Origen</th>
              <th className="py-3 px-4 text-left">Destino</th>
              <th className="py-3 px-4 text-left">Duración (min)</th>
              <th className="py-3 px-4 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {messengers.map(messenger => (
              <tr key={messenger.id} className="border-t">
                <td className="py-3 px-4">{messenger.name}</td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    messenger.status === 'idle' ? 'bg-gray-200' 
                    : messenger.status === 'on-route' ? 'bg-blue-200 text-blue-800' 
                    : 'bg-green-200 text-green-800'
                  }`}>
                    {messenger.status === 'idle' ? 'Disponible' 
                    : messenger.status === 'on-route' ? 'En Ruta' 
                    : 'Completado'}
                  </span>
                </td>
                <td className="py-3 px-4">{messenger.origin || '-'}</td>
                <td className="py-3 px-4">{messenger.destination || '-'}</td>
                <td className="py-3 px-4">{messenger.duration > 0 ? `${messenger.duration}m` : '-'}</td>
                <td className="py-3 px-4">
                  {messenger.status === 'on-route' && (
                    <button 
                      onClick={() => completeTrip(messenger.id)}
                      className="bg-green-500 text-white px-3 py-1 rounded text-sm flex items-center">
                      <CheckCircle size={16} className="mr-1" /> Completar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="flex mt-6 gap-4">
        <button 
          onClick={() => setView('tripPlanner')}
          className="flex-1 bg-blue-600 text-white p-3 rounded-lg font-medium flex items-center justify-center">
          <MapPin size={18} className="mr-2" /> Planificar Viaje
        </button>
        <button 
          onClick={() => setView('admin')}
          className="flex-1 bg-gray-600 text-white p-3 rounded-lg font-medium flex items-center justify-center">
          <Settings size={18} className="mr-2" /> Configuración Admin
        </button>
      </div>
    </div>
  );
  
  // Render the trip planner view
  const renderTripPlannerView = () => (
    <div className="p-6 max-w-lg mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center"><MapPin className="mr-2" /> Planificar tu Viaje</h2>
      
      <div className="bg-white shadow-md rounded-lg p-6">
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Seleccionar Mensajero</label>
          <select 
            className="w-full p-2 border rounded-md"
            value={tripDetails.messengerId}
            onChange={e => setTripDetails({...tripDetails, messengerId: e.target.value})}>
            <option value="">Seleccionar mensajero...</option>
            {messengers
              .filter(m => m.status !== 'on-route')
              .map(messenger => (
                <option key={messenger.id} value={messenger.id}>{messenger.name}</option>
              ))
            }
          </select>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Origen</label>
          <select 
            className="w-full p-2 border rounded-md"
            value={tripDetails.origin}
            onChange={e => setTripDetails({...tripDetails, origin: e.target.value})}>
            <option value="">Seleccionar origen...</option>
            {locations.map(location => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>
        </div>
        
        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">Destino</label>
          <select 
            className="w-full p-2 border rounded-md"
            value={tripDetails.destination}
            onChange={e => setTripDetails({...tripDetails, destination: e.target.value})}>
            <option value="">Seleccionar destino...</option>
            {locations
              .filter(loc => loc !== tripDetails.origin)
              .map(location => (
                <option key={location} value={location}>{location}</option>
              ))
            }
          </select>
        </div>
        
        <div className="flex gap-4">
          <button 
            onClick={() => setView('tracking')}
            className="flex-1 bg-gray-500 text-white p-3 rounded-lg">
            Cancelar
          </button>
          <button 
            onClick={startTrip}
            className="flex-1 bg-blue-600 text-white p-3 rounded-lg font-medium">
            Iniciar Viaje
          </button>
        </div>
      </div>
    </div>
  );
  
  // Render the admin view
  const renderAdminView = () => (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center"><Settings className="mr-2" /> Configuración de Administrador</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Messengers Management */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center"><User className="mr-2" /> Administrar Mensajeros</h3>
          
          <div className="mb-4 flex">
            <input 
              type="text"
              className="flex-1 p-2 border rounded-l-md"
              placeholder="Nombre del mensajero"
              value={newMessenger}
              onChange={e => setNewMessenger(e.target.value)}
            />
            <button 
              onClick={addMessenger}
              className="bg-blue-600 text-white px-4 rounded-r-md flex items-center">
              <PlusCircle size={16} className="mr-1" /> Añadir
            </button>
          </div>
          
          <div className="overflow-y-auto max-h-64 border rounded-md">
            <ul className="divide-y">
              {messengers.map(messenger => (
                <li key={messenger.id} className="p-3 flex justify-between items-center">
                  <span>{messenger.name}</span>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      messenger.status === 'idle' ? 'bg-gray-200' 
                      : messenger.status === 'on-route' ? 'bg-blue-200 text-blue-800' 
                      : 'bg-green-200 text-green-800'
                    }`}>
                      {messenger.status === 'idle' ? 'Disponible' 
                      : messenger.status === 'on-route' ? 'En Ruta' 
                      : 'Completado'}
                    </span>
                    <button 
                      onClick={() => deleteMessenger(messenger.id)}
                      className={`text-red-500 hover:text-red-700 ${messenger.status === 'on-route' ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title="Eliminar mensajero"
                      disabled={messenger.status === 'on-route'}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        {/* Locations Management */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center"><MapPin className="mr-2" /> Administrar Ubicaciones</h3>
          
          <div className="mb-4 flex">
            <input 
              type="text"
              className="flex-1 p-2 border rounded-l-md"
              placeholder="Nombre de la ubicación"
              value={newLocation}
              onChange={e => setNewLocation(e.target.value)}
            />
            <button 
              onClick={addLocation}
              className="bg-blue-600 text-white px-4 rounded-r-md flex items-center">
              <PlusCircle size={16} className="mr-1" /> Añadir
            </button>
          </div>
          
          <div className="overflow-y-auto max-h-64 border rounded-md">
            <ul className="divide-y">
              {locations.map(location => (
                <li key={location} className="p-3 flex justify-between items-center">
                  <span>{location}</span>
                  <button 
                    onClick={() => deleteLocation(location)}
                    className="text-red-500 hover:text-red-700"
                    title="Eliminar ubicación">
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      
      <div className="mt-6">
        <button 
          onClick={() => setView('tracking')}
          className="bg-blue-600 text-white p-3 rounded-lg font-medium">
          Volver al Seguimiento
        </button>
      </div>
    </div>
  );
  
  // Si no está autenticado, mostrar login
  if (!isAuthenticated) {
    return renderLoginView();
  }
  
  // Si está cargando, mostrar vista de carga
  if (loading) {
    return renderLoadingView();
  }
  
  // Renderizar la vista adecuada según el estado actual
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-blue-700 text-white p-4 shadow-md">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">Sistema de Seguimiento de Mensajeros</h1>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setView('tracking')}
              className={`text-sm font-medium py-1 px-2 rounded ${view === 'tracking' ? 'bg-blue-900' : ''}`}>
              Tablero
            </button>
            <button 
              onClick={() => setView('tripPlanner')}
              className={`text-sm font-medium py-1 px-2 rounded ${view === 'tripPlanner' ? 'bg-blue-900' : ''}`}>
              Planificar
            </button>
            <button 
              onClick={() => setView('admin')}
              className={`text-sm font-medium py-1 px-2 rounded ${view === 'admin' ? 'bg-blue-900' : ''}`}>
              Admin
            </button>
            <button 
              onClick={handleLogout}
              className="text-sm font-medium py-1 px-2 bg-red-700 rounded hover:bg-red-800">
              Cerrar Sesión
            </button>
          </div>
        </div>
      </header>
      
      <main>
        {view === 'tracking' && renderTrackingView()}
        {view === 'tripPlanner' && renderTripPlannerView()}
        {view === 'admin' && renderAdminView()}
      </main>
    </div>
  );
};

export default MessengerTrackingApp;