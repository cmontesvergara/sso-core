# Arquitectura Hexagonal - sso-core

Estructura de carpetas basada en la implementación actual de sso-core, organizada siguiendo Clean Architecture / Ports & Adapters.

## Diagrama de Capas

```
┌─────────────────────────────────────────────────────────────────┐
│                        INTERFACES                               │
│     (Adaptadores que conectan el mundo exterior con la app)     │
├─────────────────────────────────────────────────────────────────┤
│  HTTP (Express)  │  CLI  │  Events  │  Queue Workers             │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                     INFRASTRUCTURE                              │
│       (Implementaciones concretas, frameworks, tools)           │
├─────────────────────────────────────────────────────────────────┤
│  Persistence  │  Web (Controllers/Middleware)  │  External     │
│  (Prisma/Redis)│                                 │  Services     │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                     APPLICATION                                   │
│              (Casos de uso, orquestación)                       │
├─────────────────────────────────────────────────────────────────┤
│  Use Cases  │  DTOs  │  Mappers  │  Application Services        │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                        DOMAIN                                     │
│         (Entidades, reglas de negocio, interfaces)             │
├─────────────────────────────────────────────────────────────────┤
│  Entities  │  Value Objects  │  Repository Interfaces  │ Events  │
└─────────────────────────────────────────────────────────────────┘
```

## Flujo de Dependencias

```
Interfaces ──▶ Infrastructure ──▶ Application ──▶ Domain
     │                │                │            │
     └────────────────┴────────────────┴────────────┘
                    (Domain no depende de nadie)
```

## Reglas

1. **Domain** no importa nada de fuera
2. **Application** solo importa de Domain
3. **Infrastructure** importa de Application y Domain
4. **Interfaces** importa de Infrastructure

## Mapeo desde implementación actual

| Implementación Actual           | Capa Hexagonal                     | Ubicación                                 |
| ------------------------------- | ---------------------------------- | ----------------------------------------- |
| `services/session/*.service.ts` | Application / Use Cases            | `application/use-cases/`                  |
| `services/authV2.ts`            | Application / Use Cases            | `application/use-cases/`                  |
| `services/user.ts`              | Application / Services             | `application/services/`                   |
| `repositories/*.prisma.ts`      | Infrastructure / Persistence       | `infrastructure/persistence/prisma/`      |
| `repositories/redis*.ts`        | Infrastructure / Persistence       | `infrastructure/persistence/redis/`       |
| `routes/v2/auth.ts`             | Infrastructure / Web               | `infrastructure/web/routes/`              |
| `services/email.ts`             | Infrastructure / External Services | `infrastructure/external-services/email/` |
| `services/redis.ts`             | Infrastructure / Config            | `infrastructure/config/`                  |
| `services/jwt.ts`               | Infrastructure / Security          | `infrastructure/security/`                |
| Entidades de Prisma             | Domain / Entities                  | `domain/entities/`                        |

## Notas

- Este es un esqueleto/propuesta basada en el código actual
- No modifica `src/`, es una referencia de cómo quedaría
- Cada README interno explica qué migrar de la implementación actual
