import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-primary-700">
      <div className="text-center text-white">
        <h1 className="text-5xl font-bold mb-4">SCRAM</h1>
        <p className="text-xl mb-8 opacity-90">Sistema de Gestión Logística</p>

        <div className="space-y-4">
          <Link
            href="/login"
            className="block w-64 mx-auto btn bg-white text-primary-600 hover:bg-gray-100"
          >
            Iniciar Sesión
          </Link>
          <Link
            href="/planning"
            className="block w-64 mx-auto btn bg-primary-800 text-white hover:bg-primary-900"
          >
            Panel de Tráfico
          </Link>
        </div>
      </div>
    </main>
  );
}
