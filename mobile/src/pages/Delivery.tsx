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

      // Delay setup to ensure element is rendered
      requestAnimationFrame(() => {
        requestAnimationFrame(setupCanvas);
      });
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
            icon={<CameraAltIcon />}
            label="Foto"
            iconPosition="top"
          />
          <Tab
            value="SIGNATURE"
            icon={<DrawIcon />}
            label="Firma"
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
              <Button
                onClick={() => fileInputRef.current?.click()}
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
                  color: 'text.secondary',
                }}
              >
                <CameraAltIcon sx={{ fontSize: 64, mb: 2, color: 'text.disabled' }} />
                <Typography variant="subtitle1" fontWeight={500}>
                  Tomar Foto
                </Typography>
                <Typography variant="body2" color="text.disabled">
                  del paquete en el domicilio
                </Typography>
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
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
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
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
