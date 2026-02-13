---
title: "SSO Core"
---

# SSO Core

Sistema de **Single Sign-On empresarial** con multi-tenancy, RBAC y Authorization Code Flow.

## Características Principales

### Autenticación

- **Authorization Code Flow** — Flujo inspirado en OAuth 2.0 con códigos de un solo uso
- **JWT RS256** — Firma asimétrica con claves RSA
- **Argon2** — Hashing de contraseñas resistente a GPUs
- **2FA** — Autenticación de dos factores con TOTP y códigos de respaldo
- **Cookies HttpOnly** — Sesiones seguras inmunes a XSS

### Multi-Tenancy

- **Aislamiento de datos** — Row-Level Security (RLS) en PostgreSQL
- **RBAC granular** — Roles y permisos por aplicación y tenant
- **App Resources** — Catálogo dinámico de recursos por aplicación

### Gestión de Aplicaciones

- **Registro centralizado** — Las apps se registran una vez en el SSO
- **Control por tenant** — Cada organización habilita las apps que necesita
- **Acceso por usuario** — Control individual de qué usuarios acceden a qué apps

## Stack

| Tecnología | Propósito |
| :--- | :--- |
| Node.js + Express | Backend API |
| PostgreSQL + Prisma | Base de datos con ORM |
| JWT (RS256) | Tokens de autenticación |
| Argon2 | Hashing de contraseñas |

## Documentación

| Sección | Descripción |
| :--- | :--- |
| [Primeros Pasos](getting-started) | Instalación y configuración inicial |
| [Arquitectura](architecture) | Componentes, flujos y decisiones de diseño |
| [API Reference](api-reference) | Todos los endpoints con ejemplos |
| [Database Schema](database-schema) | Modelos y diagrama ER |
| [Multi-Tenancy](multi-tenancy) | Aislamiento, RBAC y gestión de apps |
| [Integración de Apps](application-integration) | Guía para integrar aplicaciones externas |
| [Configuración](configuration) | Variables de entorno y config.yaml |
| [Seguridad](security) | Cookies, rate limiting, 2FA, RLS |
| [Deployment](deployment) | Docker, Nginx, health checks |
