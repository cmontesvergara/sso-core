---
title: "BIGSO IdP Core - Documentación"
---

# BIGSO IdP Core

Sistema de **Single Sign-On (SSO)** empresarial open-source con arquitectura hexagonal, multi-tenancy completo y Authorization Code Flow seguro.

## 🚀 Características Principales

### Autenticación

- **Authorization Code Flow** — Flujo inspirado en OAuth 2.0 con códigos de un solo uso
- **JWT RS256** — Firma asimétrica con claves RSA
- **Argon2** — Hashing de contraseñas resistente a GPUs
- **2FA/TOTP** — Autenticación de dos factores con QR codes
- **Cookies HttpOnly** — Sesiones seguras inmunes a XSS

### Multi-Tenancy

- **Aislamiento de datos** — Row-Level Security (RLS) en PostgreSQL
- **RBAC granular** — Roles y permisos por aplicación y tenant
- **App Resources** — Catálogo dinámico de recursos por aplicación

### Arquitectura

- **Clean Architecture** — Separación de responsabilidades en capas
- **Hexagonal** — Ports & Adapters para testabilidad
- **Domain-Driven Design** — Entidades de dominio puras
- **TypeScript Strict** — Tipado completo en toda la base de código

## Stack Tecnológico

| Tecnología | Propósito |
|:---|:---|
| Node.js + Express | Backend API |
| PostgreSQL + Prisma | Base de datos con ORM |
| Redis | Cache y gestión de sesiones |
| JWT (RS256) | Tokens de autenticación |
| Argon2 | Hashing de contraseñas |

## 📚 Documentación

| Sección | Descripción |
|:---|:---|
| [Primeros Pasos](getting-started) | Instalación y configuración inicial |
| [Arquitectura](architecture) | Arquitectura hexagonal, componentes, flujos |
| [API Reference](api-reference) | Todos los endpoints con ejemplos |
| [Database Schema](database-schema) | Modelos y diagrama ER |
| [Multi-Tenancy](multi-tenancy) | Aislamiento, RBAC y gestión de apps |
| [Integración de Apps](application-integration) | Guía para integrar aplicaciones externas |
| [Configuración](configuration) | Variables de entorno y config.yaml |
| [Seguridad](security) | Cookies, rate limiting, 2FA, RLS |
| [Deployment](deployment) | Docker, Nginx, health checks |

## 🏗️ Estructura del Proyecto

```
idp-core/
├── src-hex/                    # Código fuente (arquitectura hexagonal)
│   ├── domain/                 # Entidades, value objects, reglas de negocio
│   ├── application/            # Casos de uso, DTOs, ports
│   ├── infrastructure/         # Implementaciones (Prisma, Redis, Express)
│   ├── interfaces/            # Entry points (HTTP, CLI)
│   └── __tests__/             # Tests organizados por capa
├── docs/shared/               # Esta documentación
├── prisma/                    # Schema y migraciones
├── migrations/                # Migraciones SQL
├── keys/                      # Claves JWT (no versionado)
├── config.yaml                # Configuración centralizada
└── index.ts                   # Entry point
```

## 🆘 Soporte

- **Issues**: Abre un issue en el repositorio
- **Email**: cmontes@biglabs.com
- **Documentación técnica**: Ver [AGENTS.md](../AGENTS.md) para contexto de desarrollo

---

*Documentación versión 2.0.0 — Actualizada para arquitectura hexagonal*
