import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCxGNJ1j9z9Lc5K2Y4kbFoBIfkjgvV5mto",
  authDomain: "axon-menu-saas.firebaseapp.com",
  projectId: "axon-menu-saas",
  storageBucket: "axon-menu-saas.firebasestorage.app",
  messagingSenderId: "470423182832",
  appId: "1:470423182832:web:8b28c3844d86c1b0661135",
  measurementId: "G-495BKYT9GC"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Inicializa o Firestore
export const db = getFirestore(app);

/**
 * Função para pegar o "ID da Loja" (Tenant ID)
 * Lê da URL (subdomínio) ou usa 'demo' para localhost
 */
export function getTenantId() {
  const hostname = window.location.hostname;
  
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    // Para desenvolvimento local, você pode forçar um nome ou ler de uma porta
    return "demo-store";
  }

  // Se o domínio for pizzaria.meusite.com.br, pega "pizzaria"
  // Divide pelo ponto e pega a primeira parte
  const parts = hostname.split(".");
  return parts[0]; 
}
