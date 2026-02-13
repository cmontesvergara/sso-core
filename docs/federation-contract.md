# Contrato de Federación de Documentación — v1.0

## 1. Propósito

Este documento define las reglas mínimas para integrar repositorios externos
("Sources") dentro de la Plataforma Central de Documentación.

El objetivo es:

- Garantizar documentación consistente
- Facilitar el onboarding
- Asegurar ownership
- Permitir sincronización automática
- Evitar estructura tipo wiki

Este contrato aplica a todos los repositorios federados.

---

## 2. Modelo de Documentación

La plataforma se organiza en tres niveles:

1. Portal: Navegación central
2. Proyecto: Unidad principal de documentación
3. Source: Repositorio federado sincronizado

El portal no replica repositorios.
Compone información desde Sources bajo una estructura estándar.

---

## 3. Definiciones

### 3.1 Proyecto

Un Proyecto representa un producto o sistema documentado dentro del portal.

Cada proyecto vive en:

domains/<domain>/<project>/


Y contiene vistas estándar:

- onboarding
- architecture
- integration
- operations
- governance

---

### 3.2 Source

Un Source es un repositorio externo que provee documentación estructurada
para uno o más proyectos.

Los Sources son sincronizados automáticamente
y no se exponen directamente al usuario final.

---

## 4. Estructura Obligatoria del Source

Todo repositorio federado debe contener en su raíz:

docs/
├─ onboarding.md
├─ architecture.md
├─ integration.md
├─ operations.md
└─ meta.json


Ningún Source será integrado sin esta estructura.

---

### 4.1 Descripción de Archivos

#### onboarding.md

Debe incluir:

- Propósito del sistema
- Instrucciones de setup
- Ejecución local
- Dependencias
- Problemas comunes
- Canales de soporte

---

#### architecture.md

Debe incluir:

- Diagrama general
- Componentes principales
- Decisiones técnicas relevantes
- Dependencias externas

---

#### integration.md

Debe incluir:

- APIs expuestas
- Ejemplos de consumo
- Contratos
- Autenticación
- Casos de uso

---

#### operations.md

Debe incluir:

- Deploy
- Configuración
- Monitoreo
- Alertas
- Rollback
- Incidentes comunes

---

#### meta.json

Archivo obligatorio de metadata.

Formato mínimo:

```json
{
  "name": "payments-core-api",
  "domain": "payments",
  "project": "core-api",
  "ownerTeam": "payments-team",
  "techLead": "lead@company.com",
  "supportChannel": "#payments",
  "lifecycle": "active",
  "version": "1.0.0",
  "lastReviewed": "2026-02-01"
}