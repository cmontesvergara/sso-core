# Email Service Adapters

El sistema SSO soporta múltiples proveedores de email para máxima flexibilidad. Elige el que mejor se adapte a tu caso de uso.

## Proveedores Soportados

### 1. **Ethereal** (Development)
- ✅ Perfecto para desarrollo local
- ✅ Crea automáticamente cuenta de prueba
- ✅ No requiere API key
- ✅ Emails se abren en navegador (vista previa)

**Configuración**:
```bash
NODE_ENV=development
EMAIL_PROVIDER=ethereal
EMAIL_FROM=noreply@sso.local
```

**Ventajas**:
- Zero setup
- Emails capturados automáticamente
- Debugging visual

**Desventajas**:
- Solo para desarrollo
- No es un servicio real

---

### 2. **Resend** (Production Recommended)
- ✅ API moderna y simple
- ✅ Deliverability garantizada
- ✅ Dashboard completo
- ✅ Planes de pago flexibles
- ✅ Soporte para React Email templates

**Configuración**:
```bash
NODE_ENV=production
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com
```

**Cómo obtener API Key**:
1. Ir a https://resend.com
2. Crear cuenta (gratis hasta 100 emails)
3. Navegar a Settings → API Keys
4. Copiar API key y agregarla al `.env`

**Ventajas**:
- Mejor deliverability
- Dashboard analytics
- React Email integration (opcional)
- Soporte técnico
- Escalable

**Desventajas**:
- Requiere API key
- Costo por emails (después de límite gratis)

**Ejemplo de uso**:
```typescript
// Automático - el servicio usa Resend si está configurado
await Email.sendEmailVerification(
  userId,
  'user@example.com',
  'https://app.example.com/verify'
);
```

---

### 3. **SMTP/Nodemailer** (Flexible)
- ✅ Compatible con cualquier SMTP server
- ✅ Soporta Mailtrap, SendGrid, AWS SES, etc.
- ✅ Control total

**Configuración**:
```bash
NODE_ENV=production
EMAIL_PROVIDER=nodemailer
EMAIL_HOST=smtp.mailtrap.io
EMAIL_PORT=2525
EMAIL_SECURE=false
EMAIL_USER=your_username
EMAIL_PASS=your_password
EMAIL_FROM=noreply@yourdomain.com
```

**Proveedores SMTP Populares**:

#### Mailtrap (Testing)
```bash
EMAIL_HOST=smtp.mailtrap.io
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=abc123def456
EMAIL_PASS=abc123def456password
```

#### SendGrid
```bash
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=apikey
EMAIL_PASS=SG.xxxxxxxxxxxxxxxxxxxx
```

#### AWS SES
```bash
EMAIL_HOST=email-smtp.us-east-1.amazonaws.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your_ses_username
EMAIL_PASS=your_ses_password
```

#### Gmail (SMTP)
```bash
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your_app_password  # Usar App Password, no contraseña regular
```

**Ventajas**:
- Compatible con cualquier SMTP
- Control total del servidor
- Muchas opciones disponibles

**Desventajas**:
- Requiere setup adicional
- Responsabilidad de mantener servidor
- Menos features que servicios especializados

---

## Comparativa

| Característica | Ethereal | Resend | SMTP |
|---|---|---|---|
| Desarrollo | ✅ | ✅ | ✅ |
| Producción | ❌ | ✅ | ✅ |
| Setup | 0 minutos | 5 minutos | 15+ minutos |
| Deliverability | N/A | Excelente | Variable |
| Analytics | ❌ | ✅ | Depende |
| Costo | Gratis | Freemium | Variable |
| API Key | No | Sí | Depende |
| Templates | ❌ | ✅ (React) | No |

---

## Migración Entre Proveedores

No requiere cambios en el código. Solo actualiza las variables de entorno:

### De Ethereal a Resend
```bash
# Antes
NODE_ENV=development
EMAIL_PROVIDER=ethereal

# Después
NODE_ENV=production
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
```

El servicio automáticamente usará Resend en lugar de Ethereal.

---

## Implementación Técnica

### Arquitectura de Proveedores

```typescript
// src/services/email.ts

export type EmailProvider = 'nodemailer' | 'resend' | 'ethereal';

export class EmailService {
  async sendEmail(options: SendEmailOptions): Promise<void> {
    if (this.provider === 'resend') {
      await this.sendViaResend(options);
    } else {
      await this.sendViaNodemailer(options);
    }
  }

  private async sendViaResend(options: SendEmailOptions): Promise<void> {
    const result = await this.resend.emails.send({
      from: this.config.from!,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
  }

  private async sendViaNodemailer(options: SendEmailOptions): Promise<void> {
    const result = await this.transporter.sendMail({
      from: this.config.from,
      ...options,
    });
  }
}
```

### Provider Detection

El provider se detecta automáticamente basado en:
1. `NODE_ENV` environment variable
2. Variables de entorno específicas del provider
3. Fallback a configuración por defecto

```typescript
private loadConfig(): EmailConfig {
  const provider = (process.env.EMAIL_PROVIDER || 'ethereal') as EmailProvider;

  if (provider === 'resend') {
    return {
      provider: 'resend',
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM,
    };
  }
  // ... más configs
}
```

---

## Testing

### Verificar Configuración

```bash
# Check current provider
curl http://localhost:3567/health

# El servicio logea el provider durante init:
# "Initializing email service with provider: resend"
```

### Enviar Email de Prueba

```bash
# Registrar usuario (triggers email verification)
curl -X POST http://localhost:3567/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "firstName": "Test",
    "lastName": "User"
  }'
```

### Verificar Logs

```bash
# Ver logs de email (formato JSON)
tail -f logs/app.log | grep -i "email"

# Ejemplo output:
# {"level":"info","message":"Email sent via Resend to test@example.com:","id":"xxxx"}
```

---

## Troubleshooting

### Resend API Key no funciona
```bash
# Verificar:
1. API key es válida (starts with "re_")
2. Cuenta Resend está activa
3. EMAIL_PROVIDER=resend está en .env
4. NODE_ENV no es 'development' (forces Ethereal)
```

### Emails no se envían con SMTP
```bash
# Verificar:
1. HOST/PORT correctos (telnet host port)
2. Credenciales válidas
3. Firewall no bloquea conexión
4. Provider requiere TLS (secure=true)
```

### Ethereal no crea cuenta automáticamente
```bash
# Manualmente en development:
NODE_ENV=development
EMAIL_PROVIDER=ethereal

# Logs mostrarán URL con preview de emails
```

---

## Mejores Prácticas

### 1. Development
```bash
NODE_ENV=development
EMAIL_PROVIDER=ethereal  # Auto-setup
```

### 2. Staging
```bash
NODE_ENV=staging
EMAIL_PROVIDER=resend  # O SMTP testing
RESEND_API_KEY=re_xxxx
```

### 3. Production
```bash
NODE_ENV=production
EMAIL_PROVIDER=resend  # Recomendado
RESEND_API_KEY=<secreto en AWS Secrets Manager>
```

### 4. Monitoreo

```typescript
// Log todas las entregas de email
logger.info(`Email sent to ${email}:`, {
  id: messageId,
  provider,
  timestamp: new Date().toISOString(),
});
```

---

## Extensiones Futuras

Fácil agregar más proveedores:

```typescript
// Ejemplo: AWS SES
if (this.provider === 'ses') {
  await this.sendViaSES(options);
}

// Ejemplo: Mailgun
if (this.provider === 'mailgun') {
  await this.sendViaMailgun(options);
}

// Ejemplo: Sendbird
if (this.provider === 'sendbird') {
  await this.sendViaSendbird(options);
}
```

---

## Referencias

- **Resend**: https://resend.com/docs
- **Nodemailer**: https://nodemailer.com
- **Ethereal**: https://ethereal.email
- **Mailtrap**: https://mailtrap.io
- **SendGrid**: https://sendgrid.com

---

**Última actualización**: 12 de enero de 2026  
**Versión**: 2.1.0
