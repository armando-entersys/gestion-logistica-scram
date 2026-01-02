export default () => ({
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
    timeout: 30000,
  },

  googleMaps: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY,
  },

  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY,
    from: process.env.EMAIL_FROM || 'noreply@entersys.mx',
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
  },
});
