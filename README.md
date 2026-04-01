# Sistema de Control de Actas de Asignación y Devolución

Este sistema permite gestionar el flujo de entrega y recepción de activos institucionales.

## Requisitos Previos

- Node.js instalado.
- Cuenta de Cloudflare (opcional para desarrollo local, necesaria para despliegue).

## Pasos para el Primer Inicio (Local)

1. **Instalar Dependencias**:
   ```bash
   npm install
   ```

2. **Inicializar Base de Datos D1 (Local)**:
   ```bash
   npx wrangler d1 execute detalle_activos_tierras --file=./sql/schema.sql --local
   ```

3. **Ejecutar el Sistema Completo**:
   Primero, construye el frontend:
   ```bash
   npm run build
   ```
   Luego, inicia el entorno de Pages (incluye API y Frontend):
   ```bash
   npm run pages:dev
   ```

4. **Acceder a la Aplicación**:
   Abre tu navegador en el enlace que proporcione el comando anterior (normalmente `http://localhost:8788`).

## Despliegue en Cloudflare Pages

1. **GitHub**: Sube este código a un repositorio.
2. **Dashboard de Cloudflare**:
   - Ve a **Workers & Pages** > **Create application** > **Pages**.
   - Conecta tu repositorio.
   - **Build Command**: `npm run build`
   - **Build Output**: `dist`
3. **Vincular D1**:
   - En el proyecto de Pages > **Settings** > **Functions** > **D1 database bindings**.
   - Añade un binding con el nombre `DB` y selecciona tu base de datos `sistema_actas_db`.

## Estructura del Proyecto

- `/src`: Código fuente del Frontend (React + Tailwind).
- `/worker`: Lógica del Backend (API Hono).
- `/sql`: Esquema de base de datos SQL para D1.
- `wrangler.toml`: Configuración de Cloudflare.
