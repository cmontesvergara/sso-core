const express = require('express');
const cookieParser = require('cookie-parser');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

// Cargar variables de entorno
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 4300;
const SSO_BACKEND_URL = process.env.SSO_BACKEND_URL || 'http://localhost:3000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:4200';
const APP_ID = process.env.APP_ID || 'your_app_id';
const COOKIE_NAME = process.env.COOKIE_NAME || 'app_session';
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || 'localhost';
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';
const COOKIE_SAME_SITE = process.env.COOKIE_SAME_SITE || 'lax';
const SESSION_MAX_AGE = parseInt(process.env.SESSION_MAX_AGE) || 86400000; // 24 horas

// ====================================
// MIDDLEWARE
// ====================================
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));

// ====================================
// SESSION STORE
// ====================================
// En producción, usar Redis o PostgreSQL
const sessions = new Map();

function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

function createSession(userData) {
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE);
  
  sessions.set(sessionId, {
    ...userData,
    expiresAt
  });
  
  return sessionId;
}

function getSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  
  // Verificar si expiró
  if (new Date() > session.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }
  
  return session;
}

function deleteSession(sessionId) {
  sessions.delete(sessionId);
}

// ====================================
// AUTH ENDPOINTS
// ====================================

/**
 * POST /api/auth/exchange
 * Intercambia el authorization code por una sesión
 */
app.post('/api/auth/exchange', async (req, res) => {
  console.log('📥 POST /api/auth/exchange');
  const { code } = req.body;

  if (!code) {
    console.log('❌ No code provided');
    return res.status(400).json({ 
      success: false, 
      error: 'Authorization code is required' 
    });
  }

  try {
    console.log('🔑 Validating code with SSO backend...');
    console.log('   Code:', code);
    console.log('   App ID:', APP_ID);
    console.log('   SSO URL:', SSO_BACKEND_URL);

    // Validar el código con el backend SSO
    const response = await axios.post(
      `${SSO_BACKEND_URL}/api/v1/auth/validate-code`,
      { 
        authCode: code, 
        appId: APP_ID 
      },
      { 
        timeout: 10000 
      }
    );

    console.log('✅ SSO Backend response:', JSON.stringify(response.data, null, 2));

    if (!response.data.success) {
      console.log('❌ Code validation failed');
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid authorization code' 
      });
    }

    // Extraer datos del usuario y tenant
    const { user, tenant } = response.data;
    const { userId, email, firstName, lastName } = user;
    const { tenantId } = tenant;

    console.log('👤 User data extracted:', { userId, email, firstName, lastName, tenantId });

    // Crear sesión local
    const sessionId = createSession({
      user: {
        userId,
        tenantId,
        email,
        firstName,
        lastName
      }
    });

    console.log('💾 Session created:', sessionId);

    // Configurar cookie
    res.cookie(COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: COOKIE_SAME_SITE,
      domain: COOKIE_DOMAIN,
      maxAge: SESSION_MAX_AGE,
      path: '/'
    });

    console.log('🍪 Cookie set:', COOKIE_NAME);
    console.log('✅ Code exchange successful');

    res.json({
      success: true,
      user: {
        userId,
        tenantId,
        email,
        firstName,
        lastName
      }
    });

  } catch (error) {
    console.error('❌ Error during code exchange:', error.message);
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', error.response.data);
    }
    res.status(500).json({ 
      success: false, 
      error: 'Failed to validate authorization code' 
    });
  }
});

/**
 * GET /api/auth/session
 * Obtiene la sesión actual del usuario
 */
app.get('/api/auth/session', (req, res) => {
  console.log('📥 GET /api/auth/session');
  
  // Headers para evitar caché
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
    'Expires': '0'
  });

  const sessionId = req.cookies[COOKIE_NAME];
  console.log('🔍 Looking for session:', sessionId ? sessionId.substring(0, 8) + '...' : 'none');

  if (!sessionId) {
    console.log('❌ No session cookie found');
    return res.status(401).json({ 
      success: false, 
      error: 'No session found' 
    });
  }

  const session = getSession(sessionId);

  if (!session) {
    console.log('❌ Session not found or expired');
    res.clearCookie(COOKIE_NAME);
    return res.status(401).json({ 
      success: false, 
      error: 'Session expired or invalid' 
    });
  }

  console.log('✅ Session found:', session.user);
  res.json(session);
});

/**
 * POST /api/auth/logout
 * Cierra la sesión del usuario
 */
app.post('/api/auth/logout', (req, res) => {
  console.log('📥 POST /api/auth/logout');
  
  const sessionId = req.cookies[COOKIE_NAME];

  if (sessionId) {
    deleteSession(sessionId);
    console.log('🗑️  Session deleted');
  }

  res.clearCookie(COOKIE_NAME);
  console.log('🍪 Cookie cleared');
  console.log('✅ Logout successful');

  res.json({ 
    success: true, 
    message: 'Logged out successfully' 
  });
});

// ====================================
// EJEMPLO: ENDPOINT PROTEGIDO
// ====================================

/**
 * Middleware para requerir autenticación
 */
function requireAuth(req, res, next) {
  const sessionId = req.cookies[COOKIE_NAME];
  
  if (!sessionId) {
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication required' 
    });
  }

  const session = getSession(sessionId);
  
  if (!session) {
    res.clearCookie(COOKIE_NAME);
    return res.status(401).json({ 
      success: false, 
      error: 'Session expired' 
    });
  }

  // Adjuntar sesión al request
  req.session = session;
  req.user = session.user;
  next();
}

/**
 * Ejemplo: Endpoint protegido
 */
app.get('/api/protected/example', requireAuth, (req, res) => {
  console.log('📥 GET /api/protected/example');
  console.log('👤 User:', req.user);
  
  res.json({
    success: true,
    message: 'This is a protected endpoint',
    user: req.user
  });
});

// ====================================
// HEALTH CHECK
// ====================================
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    app: APP_ID,
    timestamp: new Date().toISOString() 
  });
});

// ====================================
// START SERVER
// ====================================
app.listen(PORT, () => {
  console.log('');
  console.log('🚀 ========================================');
  console.log(`   App Backend Template Started`);
  console.log('   ========================================');
  console.log(`   App ID:       ${APP_ID}`);
  console.log(`   Port:         ${PORT}`);
  console.log(`   Frontend:     ${FRONTEND_URL}`);
  console.log(`   SSO Backend:  ${SSO_BACKEND_URL}`);
  console.log(`   Cookie Name:  ${COOKIE_NAME}`);
  console.log(`   Environment:  ${process.env.NODE_ENV || 'development'}`);
  console.log('   ========================================');
  console.log('');
  console.log('   Endpoints:');
  console.log(`   POST   /api/auth/exchange`);
  console.log(`   GET    /api/auth/session`);
  console.log(`   POST   /api/auth/logout`);
  console.log(`   GET    /api/protected/example`);
  console.log(`   GET    /health`);
  console.log('');
  console.log('   Ready to accept connections! 🎉');
  console.log('');
});
