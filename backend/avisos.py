"""Avisos al dueño de la app vía ntfy.sh (push gratis, sin cuenta).

Configuración: env var NTFY_TOPIC con un nombre de topic secreto (ej.
"renuevai-alertas-x9k2m"). El dueño instala la app ntfy en su teléfono y se
suscribe a ese topic. Sin NTFY_TOPIC, los avisos se omiten en silencio.

Cada tipo de aviso se manda máximo una vez por hora (no spamear si 50
usuarios chocan con el mismo error).
"""
import time

import requests

import config

_ultimo: dict = {}


def owner(mensaje: str, clave: str = "", cada_s: int = 3600) -> None:
    if not config.NTFY_TOPIC:
        return
    k = clave or mensaje
    ahora = time.time()
    if ahora - _ultimo.get(k, 0) < cada_s:
        return
    _ultimo[k] = ahora
    try:
        requests.post(
            f"https://ntfy.sh/{config.NTFY_TOPIC}",
            data=mensaje.encode("utf-8"),
            headers={"Title": "RenuevAI", "Priority": "high", "Tags": "warning"},
            timeout=10,
        )
    except Exception:
        pass  # un aviso nunca debe tumbar el pipeline
