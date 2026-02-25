export default () => ({
  environment: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    url: process.env.REDIS_URL,
    host: process.env.REDIS_URL?.replace('redis://', '').split(':')[0] || 'localhost',
    port: parseInt(process.env.REDIS_URL?.split(':')[2] || '6379', 10),
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRATION || '1d',
  },

  bind: {
    apiUrl: process.env.BIND_API_URL,
    apiKey: process.env.BIND_API_KEY,
    syncEnabled: process.env.BIND_SYNC_ENABLED === 'true',
    timeout: 30000,
  },

  googleMaps: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY,
  },

  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY,
    from: process.env.EMAIL_FROM || 'no-reply@scram2k.com',
  },

  email: {
    override: process.env.EMAIL_OVERRIDE,
  },

  app: {
    url: process.env.APP_URL || 'https://scram.entersys.mx',
    apiUrl: process.env.API_URL || 'https://api-scram.entersys.mx',
  },

  business: {
    priorityThresholdAmount: parseInt(process.env.PRIORITY_THRESHOLD_AMOUNT || '50000', 10),
    defaultRouteStartTime: process.env.DEFAULT_ROUTE_START_TIME || '09:00',
    averageStopTimeMinutes: parseInt(process.env.AVERAGE_STOP_TIME_MINUTES || '30', 10),
    trafficBufferPercent: parseInt(process.env.TRAFFIC_BUFFER_PERCENT || '15', 10),
    maxOrdersPerDriver: parseInt(process.env.MAX_ORDERS_PER_DRIVER || '15', 10),
    // Centro de Distribución SCRAM - Punto de partida para cálculo de ETA
    // Pingüicas Lote 16, Manzana 138, Bosques de Morelos, Cuautitlán Izcalli, C.P. 54760, Estado de México
    baseLocation: {
      latitude: parseFloat(process.env.BASE_LOCATION_LAT || '19.6505'),
      longitude: parseFloat(process.env.BASE_LOCATION_LNG || '-99.2168'),
      address: 'Pingüicas Lote 16, Manzana 138, Bosques de Morelos, Cuautitlán Izcalli, C.P. 54760, Estado de México',
    },
  },
});
