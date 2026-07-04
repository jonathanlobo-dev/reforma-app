"""Almacenamiento de los archivos generados.

  - Supabase Storage  si SUPABASE_URL está configurado → URL pública persistente.
  - Disco local (/media/…)  si no                       → solo dev.

El procesamiento sigue ocurriendo en disco local (efímero); solo el RESULTADO
se sube a Supabase para que sobreviva a los reinicios del contenedor.
"""
import mimetypes
from pathlib import Path

import requests

import config


def subir(local_path: Path, tid: str, nombre: str) -> str:
    """Sube un archivo y devuelve la URL usable por el frontend.

    Supabase → https://…/storage/v1/object/public/<bucket>/<tid>/<nombre>
    Local    → /media/<tid>/<nombre> (el frontend le antepone API_BASE)
    """
    if not config.USA_SUPABASE:
        return f"/media/{tid}/{nombre}"

    destino = f"{tid}/{nombre}"
    mime = mimetypes.guess_type(nombre)[0] or "application/octet-stream"
    url = f"{config.SUPABASE_URL}/storage/v1/object/{config.SUPABASE_BUCKET}/{destino}"
    with open(local_path, "rb") as f:
        r = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {config.SUPABASE_SERVICE_KEY}",
                "Content-Type": mime,
                "x-upsert": "true",
            },
            data=f.read(),
            timeout=120,
        )
    if r.status_code not in (200, 201):
        raise RuntimeError(f"Supabase Storage {r.status_code}: {r.text[:200]}")
    return f"{config.SUPABASE_URL}/storage/v1/object/public/{config.SUPABASE_BUCKET}/{destino}"
