import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Paper,
  Stack,
  Button,
  Tab,
  Tabs,
  Alert,
  CircularProgress,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import DrawIcon from '@mui/icons-material/Draw';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PersonIcon from '@mui/icons-material/Person';
import CancelIcon from '@mui/icons-material/Cancel';

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

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);

  // Get order from local DB
  const order = useLiveQuery(
    () => (orderId ? db.orders.get(orderId) : undefined),
    [orderId]
  );

  // Setup signature canvas with native touch event listeners
  useEffect(() => {
    if (evidenceType === 'SIGNATURE' && canvasRef.current) {
      const canvas = canvasRef.current;

      // Use requestAnimationFrame to ensure the canvas is rendered
      const setupCanvas = () => {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        // Set canvas size accounting for device pixel ratio
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Scale context to account for device pixel ratio
          ctx.scale(dpr, dpr);
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
        }
      };

      // Native touch handlers with { passive: false } to prevent page scrolling
      const handleTouchStart = (e: TouchEvent) => {
        e.preventDefault();
        isDrawingRef.current = true;
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const ctx = canvas.getContext('2d');
        if (ctx && touch) {
          ctx.beginPath();
          ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
        }
      };

      const handleTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        if (!isDrawingRef.current) return;
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const ctx = canvas.getContext('2d');
        if (ctx && touch) {
          ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
          ctx.stroke();
        }
      };

      const handleTouchEnd = (e: TouchEvent) => {
        e.preventDefault();
        isDrawingRef.current = false;
        setSignatureDataUrl(canvas.toDataURL('image/png'));
      };

      canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
      canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
      canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

      // Delay setup to ensure element is rendered
      requestAnimationFrame(() => {
        requestAnimationFrame(setupCanvas);
      });

      return () => {
        canvas.removeEventListener('touchstart', handleTouchStart);
        canvas.removeEventListener('touchmove', handleTouchMove);
        canvas.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [evidenceType]);

  // Compress image to reduce payload size
  const compressImage = (file: File, maxWidth = 1200, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // Scale down if larger than maxWidth
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        // Compress image before storing
        const compressedDataUrl = await compressImage(file);
        setPhotoDataUrl(compressedDataUrl);
      } catch (error) {
        console.error('Error compressing image:', error);
        // Fallback to original if compression fails
        const reader = new FileReader();
        reader.onload = () => {
          setPhotoDataUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
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

    // Require both photo AND signature
    if (!photoDataUrl) {
      setError('Por favor captura una foto del paquete entregado');
      setEvidenceType('PHOTO');
      return;
    }
    if (!signatureDataUrl) {
      setError('Por favor obtén la firma del cliente');
      setEvidenceType('SIGNATURE');
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

      // Save ALL captured evidence (photo AND signature if both exist)
      if (photoDataUrl) {
        await saveEvidenceLocally({
          orderId,
          type: 'PHOTO',
          dataUrl: photoDataUrl,
          capturedAt: new Date().toISOString(),
          latitude,
          longitude,
          uploaded: false,
        });
      }

      if (signatureDataUrl) {
        await saveEvidenceLocally({
          orderId,
          type: 'SIGNATURE',
          dataUrl: signatureDataUrl,
          capturedAt: new Date().toISOString(),
          latitude,
          longitude,
          uploaded: false,
        });
      }

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
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      {/* Header */}
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <IconButton edge="start" onClick={() => navigate('/route')} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Confirmar Entrega
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {order.bindId}
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Order Info */}
      <Paper sx={{ mx: 0, borderRadius: 0 }} elevation={0}>
        <Box sx={{ px: 2, py: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction="row" spacing={1.5} alignItems="center" mb={1.5}>
            <PersonIcon color="action" />
            <Typography variant="subtitle1" fontWeight={500}>
              {order.clientName}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <LocationOnIcon color="action" sx={{ mt: 0.3 }} />
            <Box>
              <Typography variant="body2" color="text.secondary">
                {order.addressRaw.street} {order.addressRaw.number}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {order.addressRaw.neighborhood}, {order.addressRaw.city}
              </Typography>
            </Box>
          </Stack>
        </Box>
      </Paper>

      {/* Evidence Type Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Tabs
          value={evidenceType}
          onChange={(_, v) => setEvidenceType(v)}
          variant="fullWidth"
        >
          <Tab
            value="PHOTO"
            icon={
              <Box sx={{ position: 'relative' }}>
                <CameraAltIcon color={photoDataUrl ? 'success' : 'inherit'} />
                {photoDataUrl && (
                  <CheckCircleIcon
                    sx={{
                      position: 'absolute',
                      top: -4,
                      right: -8,
                      fontSize: 14,
                      color: 'success.main',
                      bgcolor: 'background.paper',
                      borderRadius: '50%',
                    }}
                  />
                )}
              </Box>
            }
            label={photoDataUrl ? 'Foto ✓' : 'Foto'}
            iconPosition="top"
          />
          <Tab
            value="SIGNATURE"
            icon={
              <Box sx={{ position: 'relative' }}>
                <DrawIcon color={signatureDataUrl ? 'success' : 'inherit'} />
                {signatureDataUrl && (
                  <CheckCircleIcon
                    sx={{
                      position: 'absolute',
                      top: -4,
                      right: -8,
                      fontSize: 14,
                      color: 'success.main',
                      bgcolor: 'background.paper',
                      borderRadius: '50%',
                    }}
                  />
                )}
              </Box>
            }
            label={signatureDataUrl ? 'Firma ✓' : 'Firma'}
            iconPosition="top"
          />
        </Tabs>
      </Box>

      {/* Evidence Capture Area */}
      <Box sx={{ flex: 1, p: 2, display: 'flex', flexDirection: 'column' }}>
        {evidenceType === 'PHOTO' ? (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {photoDataUrl ? (
              <Box sx={{ position: 'relative', flex: 1 }}>
                <Box
                  component="img"
                  src={photoDataUrl}
                  alt="Evidencia"
                  sx={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    borderRadius: 3,
                  }}
                />
                <IconButton
                  onClick={() => setPhotoDataUrl(null)}
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    bgcolor: 'error.main',
                    color: 'white',
                    '&:hover': { bgcolor: 'error.dark' },
                  }}
                >
                  <CancelIcon />
                </IconButton>
              </Box>
            ) : (
              <Box
                sx={{
                  flex: 1,
                  minHeight: 300,
                  border: 2,
                  borderStyle: 'dashed',
                  borderColor: 'divider',
                  borderRadius: 3,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  p: 3,
                }}
              >
                <Typography variant="subtitle1" fontWeight={500} color="text.secondary" mb={1}>
                  Capturar evidencia fotográfica
                </Typography>
                <Stack direction="row" spacing={2}>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={() => cameraInputRef.current?.click()}
                    startIcon={<CameraAltIcon />}
                    sx={{ px: 3, py: 1.5 }}
                  >
                    Cámara
                  </Button>
                  <Button
                    variant="outlined"
                    size="large"
                    onClick={() => galleryInputRef.current?.click()}
                    startIcon={<PhotoLibraryIcon />}
                    sx={{ px: 3, py: 1.5 }}
                  >
                    Galería
                  </Button>
                </Stack>
                <Typography variant="body2" color="text.disabled" mt={1}>
                  Foto del paquete en el domicilio
                </Typography>
              </Box>
            )}
            {/* Camera input - opens camera directly */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoCapture}
              style={{ display: 'none' }}
            />
            {/* Gallery input - opens file picker/gallery */}
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoCapture}
              style={{ display: 'none' }}
            />
          </Box>
        ) : (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Box
              sx={{
                position: 'relative',
                flex: 1,
                minHeight: 300,
                bgcolor: 'background.paper',
                borderRadius: 3,
                border: 2,
                borderColor: 'divider',
                overflow: 'hidden',
              }}
            >
              <canvas
                ref={canvasRef}
                style={{
                  width: '100%',
                  height: '100%',
                  touchAction: 'none',
                  display: 'block',
                }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
              />
              {!signatureDataUrl && (
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  <Typography color="text.disabled">Firme aqui</Typography>
                </Box>
              )}
              {signatureDataUrl && (
                <Button
                  size="small"
                  onClick={clearSignature}
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                  }}
                >
                  Limpiar
                </Button>
              )}
            </Box>
          </Box>
        )}
      </Box>

      {/* Error Message */}
      {error && (
        <Box sx={{ px: 2, pb: 2 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      )}

      {/* Submit Button */}
      <Paper
        sx={{
          p: 2,
          borderRadius: 0,
          pb: 'calc(16px + var(--safe-area-inset-bottom, 0px))',
        }}
        elevation={2}
      >
        {(!photoDataUrl || !signatureDataUrl) && (
          <Typography variant="caption" color="text.secondary" textAlign="center" sx={{ mb: 1, display: 'block' }}>
            {!photoDataUrl && !signatureDataUrl
              ? 'Falta: foto y firma'
              : !photoDataUrl
              ? 'Falta: foto del paquete'
              : 'Falta: firma del cliente'}
          </Typography>
        )}
        <Button
          variant="contained"
          color="success"
          size="large"
          fullWidth
          disabled={isSubmitting}
          onClick={handleSubmit}
          startIcon={
            isSubmitting ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              <CheckCircleIcon />
            )
          }
          sx={{ py: 1.5 }}
        >
          {isSubmitting ? 'Guardando...' : 'Confirmar Entrega'}
        </Button>
      </Paper>
    </Box>
  );
}
