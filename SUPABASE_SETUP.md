# Configurar Supabase (persistencia del backend)

Resuelve el disco efímero de Render: los trabajos van a Postgres y las
imágenes/videos a Supabase Storage. Ambos sobreviven a los reinicios.

Todo esto es **gratis** (plan free de Supabase). ~5 minutos.

## 1. Crear el proyecto

1. Entra a **supabase.com** → *Start your project* → inicia sesión (GitHub sirve).
2. **New project**. Ponle nombre (ej. `reforma`), elige región cercana
   (ej. *East US* / *South America (São Paulo)*), y **define una contraseña de
   base de datos** — GUÁRDALA, la necesitas en el paso 3.
3. Espera ~2 min a que se aprovisione.

## 2. Crear el bucket de Storage (público)

1. Menú izquierdo → **Storage** → **New bucket**.
2. Nombre: `reforma`. Marca **Public bucket** ✅ (para que las imágenes tengan
   URL pública). Create.

## 3. Copiar las 3 credenciales

**a) DATABASE_URL** — menú → **Project Settings** (engranaje) → **Database** →
sección *Connection string* → pestaña **URI**. Copia la que dice **Transaction**
(termina en `:6543/postgres`). Reemplaza `[YOUR-PASSWORD]` por la contraseña del
paso 1. Queda algo así:
```
postgresql://postgres.abcd1234:TU_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

**b) SUPABASE_URL** — Project Settings → **API** → *Project URL*:
```
https://abcd1234.supabase.co
```

**c) SUPABASE_SERVICE_KEY** — Project Settings → **API** → *Project API keys* →
copia la **`service_role`** (la secreta, NO la `anon`). Empieza con `eyJ...`.

## 4. Pásame las 3 (o ponlas tú)

Con esas 3 (DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY) yo pruebo primero
en local y luego las pones en Render:

**En Render:** dashboard → tu servicio `reforma-backend` → **Environment** →
**Add Environment Variable** por cada una:
- `DATABASE_URL` = (la del paso 3a)
- `SUPABASE_URL` = (3b)
- `SUPABASE_SERVICE_KEY` = (3c)
- `SUPABASE_BUCKET` = `reforma`

Guarda → Render redespliega solo (~2 min). Listo: los resultados ya persisten.

> ⚠️ La `service_role` key es secreta (acceso total a tu Supabase). No la subas
> a git ni la compartas en público. En el repo solo va vacía en `.env.example`.
