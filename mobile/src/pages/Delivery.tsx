import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  Camera,
  Pen,
  CheckCircle,
  MapPin,
  User,
  XCircle,
} from 'lucide-react';

import {
  db,
  markOrderDeliveredLocally,
  saveEvidenceLocally,
} from '@/lib/db';
import useSync from '@/hooks/useSync';

export default function DeliveryPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { triggerSync } = useSync();

  const [evidenceType, setEvidenceType] = useState<'PHOTO' | 'SIGNATURE'>('PHOTO');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);

  // Get order from local DB
  const order = useLiveQuery(
    () => (orderId ? db.orders.get(orderId) : undefined),
    [orderId]
  );

  // Setup signature canvas
  useEffect(() => {
    if (evidenceType === 'SIGNATURE' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      // Set canvas size
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;

      if (ctx) {
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
      }
    }
  }, [evidenceType]);

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setPhotoDataUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Signature drawing handlers
  const getCoordinates = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const touch = 'touches' in e ? e.touches[0] : e;

    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.TouchEvent | React.MouseEvent) => {
    isDrawingRef.current = true;
    const coords = getCoordinates(e);
    if (coords && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.beginPath();
      ctx?.moveTo(coords.x, coords.y);
    }
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawingRef.current) return;
    const coords = getCoordinates(e);
    if (coords && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.lineTo(coords.x, coords.y);
      ctx?.stroke();
    }
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
    if (canvasRef.current) {
      setSignatureDataUrl(canvasRef.current.toDataURL('image/png'));
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      setSignatureDataUrl(null);
    }
  };

  const handleSubmit = async () => {
    if (!orderId) return;

    const dataUrl = evidenceType === 'PHOTO' ? photoDataUrl : signatureDataUrl;

    if (!dataUrl) {
      setError('Por favor captura evidencia antes de confirmar');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Get current location
      let latitude: number | undefined;
      let longitude: number | undefined;

      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
          });
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } catch {
        console.warn('Could not get location');
      }

      // Save evidence locally
      await saveEvidenceLocally({
        orderId,
        type: evidenceType,
        dataUrl,
        capturedAt: new Date().toISOString(),
        latitude,
        longitude,
        uploaded: false,
      });

      // Mark order as delivered (Optimistic UI)
      await markOrderDeliveredLocally(orderId);

      // Try to sync immediately if online
      triggerSync();

      // Navigate back
      navigate('/route');
    } catch (err) {
      console.error('Error submitting delivery:', err);
      setError('Error al guardar. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!order) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white px-4 py-3 shadow-sm safe-area-top">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/route')}
            className="p-2 -ml-2 rounded-lg active:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Confirmar Entrega</h1>
            <p className="text-sm text-gray-500">{order.bindId}</p>
          </div>
        </div>
      </header>

      {/* Order Info */}
      <div className="bg-white px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3 mb-3">
          <User className="w-5 h-5 text-gray-400" />
          <span className="font-medium">{order.clientName}</span>
        </div>
        <div className="flex items-start gap-3 text-sm text-gray-600">
          <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
          <div>
            <p>
              {order.addressRaw.street} {order.addressRaw.number}
            </p>
            <p>
              {order.addressRaw.neighborhood}, {order.addressRaw.city}
            </p>
          </div>
        </div>
      </div>

      {/* Evidence Type Tabs */}
      <div className="flex bg-white border-b border-gray-100">
        <button
          onClick={() => setEvidenceType('PHOTO')}
          className={`flex-1 py-3 text-center font-medium transition-colors ${
            evidenceType === 'PHOTO'
              ? 'text-primary-600 border-b-2 border-primary-500'
              : 'text-gray-500'
          }`}
        >
          <Camera className="w-5 h-5 mx-auto mb-1" />
          Foto
        </button>
        <button
          onClick={() => setEvidenceType('SIGNATURE')}
          className={`flex-1 py-3 text-center font-medium transition-colors ${
            evidenceType === 'SIGNATURE'
              ? 'text-primary-600 border-b-2 border-primary-500'
              : 'text-gray-500'
          }`}
        >
          <Pen className="w-5 h-5 mx-auto mb-1" />
          Firma
        </button>
      </div>

      {/* Evidence Capture Area */}
      <div className="flex-1 p-4">
        {evidenceType === 'PHOTO' ? (
          <div className="h-full">
            {photoDataUrl ? (
              <div className="relative h-full">
                <img
                  src={photoDataUrl}
                  alt="Evidencia"
                  className="w-full h-full object-contain rounded-xl"
                />
                <button
                  onClick={() => setPhotoDataUrl(null)}
                  className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-full min-h-[300px] border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-500 active:bg-gray-50"
              >
                <Camera className="w-16 h-16 mb-4" />
                <p className="font-medium">Tomar Foto</p>
                <p className="text-sm">del paquete en el domicilio</p>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoCapture}
              className="hidden"
            />
          </div>
        ) : (
          <div className="h-full">
            <div className="relative h-full min-h-[300px] bg-white rounded-xl border-2 border-gray-300">
              <canvas
                ref={canvasRef}
                className="w-full h-full touch-none"
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
              />
              {!signatureDataUrl && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <p className="text-gray-400">Firme aqui</p>
                </div>
              )}
              {signatureDataUrl && (
                <button
                  onClick={clearSignature}
                  className="absolute top-2 right-2 px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-4 mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Submit Button */}
      <div className="p-4 bg-white safe-area-bottom">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full btn btn-success flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              Confirmar Entrega
            </>
          )}
        </button>
      </div>
    </div>
  );
}
