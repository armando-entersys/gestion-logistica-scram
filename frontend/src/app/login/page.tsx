'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Truck, Mail, Lock, LogIn } from 'lucide-react';

import { authApi } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const loginMutation = useMutation({
    mutationFn: async () => {
      const response = await authApi.login(email, password);
      return response.data;
    },
    onSuccess: (data) => {
      localStorage.setItem('token', data.accessToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      toast.success('Bienvenido a SCRAM');

      // Redirect based on role
      const role = data.user.roleCode;
      if (role === 'ADMIN') {
        router.push('/planning');
      } else if (role === 'DRIVER') {
        router.push('/driver');
      } else if (role === 'SALES') {
        router.push('/sales');
      } else {
        router.push('/dashboard');
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Credenciales invalidas');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate();
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-primary-700 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full mb-4">
            <Truck className="w-8 h-8 text-primary-600" />
          </div>
          <h1 className="text-3xl font-bold text-white">SCRAM</h1>
          <p className="text-primary-100">Sistema de Gestion Logistica</p>
        </div>

        <div className="card p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">
            Iniciar Sesion
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Correo electronico
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@empresa.com"
                  className="input pl-11"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contrasena
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                  className="input pl-11"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full btn btn-primary py-3 flex items-center justify-center gap-2"
            >
              {loginMutation.isPending ? (
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

        <p className="text-center mt-6 text-primary-100 text-sm">
          SCRAM - Despacho y Ultima Milla
        </p>
      </div>
    </main>
  );
}
