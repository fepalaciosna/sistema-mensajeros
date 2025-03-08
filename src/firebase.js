import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCwCLOS7Lxu4nr7X5G2_3pgy4DlK7mlNj4",
  authDomain: "recoleccion-217f8.firebaseapp.com",
  projectId: "recoleccion-217f8",
  storageBucket: "recoleccion-217f8.firebasestorage.app",
  messagingSenderId: "45749650409",
  appId: "1:45749650409:web:e2434b53a2fe1a793f8178"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };