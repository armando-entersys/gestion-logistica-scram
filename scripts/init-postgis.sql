-- Script de inicialización de PostgreSQL para SCRAM
-- Habilitar extensiones necesarias

-- PostGIS para datos geoespaciales
CREATE EXTENSION IF NOT EXISTS postgis;

-- UUID para generación de identificadores
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- pgcrypto para funciones de hash
CREATE EXTENSION IF NOT EXISTS pgcrypto;
