import React, { useState } from 'react';
import { supabase } from '../services/supabase';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true); // Växla mellan Logga in / Registrera

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Välkommen! Kolla din mail för att verifiera kontot om det krävs, annars är du inloggad.');
      }
    } catch (error: any) {
      alert(error.error_description || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-900 text-white">
      <div className="w-full max-w-md p-8 bg-gray-800 rounded-xl shadow-lg border border-gray-700">
        <h1 className="text-3xl font-bold mb-6 text-center text-blue-400">
          MorphFit
        </h1>
        <h2 className="text-xl font-semibold mb-6 text-center">
          {isLogin ? 'Logga in på ditt konto' : 'Skapa ett nytt konto'}
        </h2>
        
        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm mb-1 text-gray-300">E-post</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 outline-none transition-colors"
              placeholder="din@epost.se"
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1 text-gray-300">Lösenord</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 outline-none transition-colors"
              placeholder="Minst 6 tecken"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-bold transition-colors disabled:opacity-50 mt-4"
          >
            {loading ? 'Laddar...' : (isLogin ? 'Logga in' : 'Registrera dig')}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-blue-400 hover:text-blue-300 underline"
          >
            {isLogin 
              ? 'Har du inget konto? Registrera dig här.' 
              : 'Har du redan ett konto? Logga in.'}
          </button>
        </div>
      </div>
    </div>
  );
}
