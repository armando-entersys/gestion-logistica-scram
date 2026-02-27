import { useState, useRef } from 'react';
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
  TextField,
  Alert,
  CircularProgress,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PersonIcon from '@mui/icons-material/Person';
import CancelIcon from '@mui/icons-material/Cancel';

import { db, completeRouteStopLocally } from '@/lib/db';
import useSync from '@/hooks/useSync';

export default function CompleteStopPage() {
  const { stopId } = useParams<{ stopId: string }>();
  const navigate = useNavigate();
  const { triggerSync } = useSync();

  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Get stop from local DB
  const stop = useLiveQuery(
    () => (stopId ? db.routeStops.get(stopId) : undefined),
    [stopId]
  );

  const isPickup = stop?.stopType === 'PICKUP';
  const title = isPickup ? 'Completar Recolección' : 'Completar Visita';
  const themeColor = isPickup ? '#1976d2' : '#9c27b0';

  // Compress image
  const compressImage = (file: File, maxWidth = 1200, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

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
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedDataUrl = await compressImage(file);
        setPhotoDataUrl(compressedDataUrl);
      } catch (err) {
        console.error('Error compressing image:', err);
        const reader = new FileReader();
        reader.onload = () => setPhotoDataUrl(reader.result as string);
        reader.readAsDataURL(file);
      }
    }
  };

  const handleSubmit = async () => {
    if (!stopId) return;

    // For PICKUP, photo is required
    if (isPickup && !photoDataUrl) {
      setError('Por favor captura una foto de la recolección');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await completeRouteStopLocally(
        stopId,
        completionNotes.trim() || undefined,
        photoDataUrl || undefined,
      );

      triggerSync();
      navigate('/route');
    } catch (err) {
      console.error('Error completing stop:', err);
      setError('Error al guardar. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!stop) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: 'background.default', height: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <AppBar position="static" sx={{ bgcolor: themeColor }} elevation={1}>
        <Toolbar>
          <IconButton edge="start" onClick={() => navigate('/route')} sx={{ mr: 1, color: 'white' }}>
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography variant="h6" fontWeight={700} color="white">
              {title}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
              {stop.clientName}
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Stop Info */}
      <Paper sx={{ mx: 0, borderRadius: 0 }} elevation={0}>
        <Box sx={{ px: 2, py: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
            <PersonIcon color="action" />
            <Typography variant="subtitle1" fontWeight={500}>
              {stop.clientName}
            </Typography>
          </Stack>
          {stop.addressRaw && (
            <Stack direction="row" spacing={1.5} alignItems="flex-start" mb={1}>
              <LocationOnIcon color="action" sx={{ mt: 0.3 }} />
              <Box>
                <Typography variant="body2" color="text.secondary">
                  {stop.addressRaw.street} {stop.addressRaw.number}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {stop.addressRaw.neighborhood}, {stop.addressRaw.city}
                </Typography>
              </Box>
            </Stack>
          )}
          {stop.description && (
            <Typography variant="body2" color="text.secondary" fontStyle="italic">
              {stop.description}
            </Typography>
          )}
          {stop.itemsDescription && (
            <Box sx={{ mt: 1, bgcolor: 'grey.50', p: 1.5, borderRadius: 1, border: '1px dashed', borderColor: 'grey.300' }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary">
                {isPickup ? 'A recoger:' : 'Documentos:'}
              </Typography>
              <Typography variant="body2">{stop.itemsDescription}</Typography>
            </Box>
          )}
        </Box>
      </Paper>

      {/* Photo Capture */}
      <Box sx={{ flex: 1, p: 2, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        <Typography variant="subtitle2" fontWeight={700} color="text.secondary" mb={1}>
          Foto {isPickup ? '(requerida)' : '(opcional)'}
        </Typography>

        {photoDataUrl ? (
          <Box sx={{ position: 'relative', mb: 2 }}>
            <Box
              component="img"
              src={photoDataUrl}
              alt="Evidencia"
              sx={{
                width: '100%',
                maxHeight: 250,
                objectFit: 'contain',
                borderRadius: 2,
              }}
            />
            <IconButton
              onClick={() => setPhotoDataUrl(null)}
              sx={{
                position: 'absolute',
                top: 4,
                right: 4,
                bgcolor: 'error.main',
                color: 'white',
                '&:hover': { bgcolor: 'error.dark' },
              }}
              size="small"
            >
              <CancelIcon fontSize="small" />
            </IconButton>
          </Box>
        ) : (
          <Box
            sx={{
              border: 2,
              borderStyle: 'dashed',
              borderColor: 'divider',
              borderRadius: 2,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              p: 3,
              mb: 2,
            }}
          >
            <Stack direction="row" spacing={2}>
              <Button
                variant="contained"
                onClick={() => cameraInputRef.current?.click()}
                startIcon={<CameraAltIcon />}
                sx={{ bgcolor: themeColor }}
              >
                Cámara
              </Button>
              <Button
                variant="outlined"
                onClick={() => galleryInputRef.current?.click()}
                startIcon={<PhotoLibraryIcon />}
              >
                Galería
              </Button>
            </Stack>
          </Box>
        )}

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoCapture}
          style={{ display: 'none' }}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoCapture}
          style={{ display: 'none' }}
        />

        {/* Notes */}
        <TextField
          label="Notas"
          value={completionNotes}
          onChange={(e) => setCompletionNotes(e.target.value)}
          fullWidth
          multiline
          rows={3}
          placeholder={isPickup ? 'Ej: Se recogieron 5 cajas...' : 'Ej: Se entregaron facturas FA123, FA124...'}
          sx={{ mb: 2 }}
        />
      </Box>

      {/* Error */}
      {error && (
        <Box sx={{ px: 2, pb: 1 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      )}

      {/* Submit */}
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
          sx={{ py: 1.5, bgcolor: themeColor, '&:hover': { bgcolor: themeColor } }}
        >
          {isSubmitting ? 'Guardando...' : title}
        </Button>
      </Paper>
    </Box>
  );
}
