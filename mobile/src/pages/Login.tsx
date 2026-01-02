import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Truck, Mail, Lock, LogIn } from 'lucide-react';
import { saveSession } from '@/lib/db';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email,
        password,
      });

      const { accessToken, user } = response.data;

      // Verify user is a driver
      if (user.roleCode !== 'DRIVER') {
        setError('Esta aplicacion es solo para choferes');
        setIsLoading(false);
        return;
      }

      // Save session to IndexedDB
      await saveSession({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        token: accessToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      navigate('/route');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Credenciales invalidas');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex-1 flex items-center justify-center px-6 bg-gradient-to-b from-primary-500 to-primary-700">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full mb-4">
            <Truck className="w-10 h-10 text-primary-500" />
          </div>
          <h1 className="text-3xl font-bold text-white">SCRAM</h1>
          <p className="text-primary-100">App de Chofer</p>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">
            Iniciar Sesion
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Correo
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@empresa.com"
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contrasena
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn btn-primary flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Ingresar
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
