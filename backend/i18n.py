"""Traducciones del backend: mensajes de error/cuota y personalización de
"El Maestro" por idioma. ES es el idioma base; EN está completo; PT/IT quedan
con fallback automático a ES hasta que la Fase 3 los traduzca (mismo patrón
que el frontend: dict con huecos + fallback, nunca un KeyError)."""

IDIOMAS_SOPORTADOS = ("es", "en", "pt", "it")

NOMBRES_IDIOMA = {"es": "español", "en": "English", "pt": "português", "it": "italiano"}
NOMBRE_MAESTRO = {"es": "El Maestro", "en": "The Foreman", "pt": "O Mestre", "it": "Il Maestro"}


def normalizar_lang(lang: str | None) -> str:
    l = (lang or "es").strip().lower()[:2]
    return l if l in IDIOMAS_SOPORTADOS else "es"


def _resolver(diccionario: dict, clave: str, lang: str, **params) -> str:
    l = normalizar_lang(lang)
    d = diccionario.get(clave, {})
    plantilla = d.get(l) or d.get("es") or clave
    return plantilla.format(**params) if params else plantilla


# ─── Errores del worker (Replicate/Groq/ffmpeg traducidos a mensaje amable) ──

ERRORES = {
    "sin_credito": {
        "es": "El servicio está a máxima capacidad en este momento. Intenta de nuevo en un rato.",
        "en": "The service is at maximum capacity right now. Please try again in a bit.",
    },
    "contenido": {
        "es": "La imagen o el pedido no pasó los filtros de contenido. Intenta con otra foto u otra descripción.",
        "en": "The image or request didn't pass our content filters. Try a different photo or description.",
    },
    "timeout": {
        "es": "La generación tardó demasiado y se canceló. Intenta de nuevo.",
        "en": "The generation took too long and was canceled. Please try again.",
    },
    "rate_limit": {
        "es": "Hay muchas personas generando en este momento. Intenta en unos minutos.",
        "en": "Lots of people are generating right now. Try again in a few minutes.",
    },
    "falta_mascara": {
        "es": "Falta pintar la zona a cambiar. Vuelve atrás y usa el pincel.",
        "en": "You still need to paint the area to change. Go back and use the brush.",
    },
    "falta_referencia": {
        "es": "Falta la foto de inspiración. Vuelve atrás y súbela.",
        "en": "The inspiration photo is missing. Go back and upload it.",
    },
    "generico": {
        "es": "Algo salió mal generando tu transformación. Intenta de nuevo.",
        "en": "Something went wrong generating your transformation. Please try again.",
    },
}


def error_msg(clave: str, lang: str) -> str:
    return _resolver(ERRORES, clave, lang)


# ─── Mensajes de cuota (límites diarios) ─────────────────────────────────────

CUOTAS = {
    "limite_imagenes_free": {
        "es": "Llegaste al límite de {n} imágenes por hoy. Hazte Premium para más.",
        "en": "You've reached today's limit of {n} images. Go Premium for more.",
    },
    "limite_imagenes_premium": {
        "es": "Llegaste al límite de {n} imágenes por hoy.",
        "en": "You've reached today's limit of {n} images.",
    },
    "limite_videos_lock": {
        "es": "Los videos son Premium. Hazte Premium para desbloquearlos.",
        "en": "Videos are a Premium feature. Go Premium to unlock them.",
    },
    "limite_videos_free": {
        "es": "Llegaste a tu límite de {n} video(s) por hoy. Hazte Premium para más.",
        "en": "You've reached your limit of {n} video(s) for today. Go Premium for more.",
    },
    "limite_videos_premium": {
        "es": "Llegaste al límite de {n} video(s) por hoy.",
        "en": "You've reached the limit of {n} video(s) for today.",
    },
    "limite_global_videos": {
        "es": "El sistema alcanzó su límite diario de videos. Intenta mañana.",
        "en": "The system reached its daily video limit. Try again tomorrow.",
    },
    "limite_chats": {
        "es": "El Maestro descansa: llegaste a los {n} mensajes de hoy. Vuelve mañana.",
        "en": "The Foreman is resting: you've reached {n} messages today. Come back tomorrow.",
    },
    "limite_ip": {
        "es": "Se alcanzó el límite diario desde esta red. Intenta mañana.",
        "en": "The daily limit for this network has been reached. Try again tomorrow.",
    },
}


def cuota_msg(clave: str, lang: str, **params) -> str:
    if not clave:
        return ""
    return _resolver(CUOTAS, clave, lang, **params)


# ─── Filtro de contenido / planificador (pipeline._SYSTEM_PLAN) ─────────────

PLAN_MSGS = {
    "peticion_generica": {
        "es": "Solo se pueden transformar espacios u objetos reales de tu foto.",
        "en": "Only real spaces or objects from your photo can be transformed.",
    },
}


def plan_msg(clave: str, lang: str) -> str:
    return _resolver(PLAN_MSGS, clave, lang)


# ─── El Maestro: instrucción de idioma + nombre de personaje ────────────────

def asesor_idioma_instruccion(lang: str) -> str:
    l = normalizar_lang(lang)
    idioma_nombre = NOMBRES_IDIOMA.get(l, "español")
    nombre_persona = NOMBRE_MAESTRO.get(l, "El Maestro")
    return (
        f"\n\nIMPORTANTE: Responde SIEMPRE en {idioma_nombre}, sin importar en qué "
        f"idioma esté escrito el mensaje del usuario o el CONTEXTO. Tu nombre de "
        f'personaje en este idioma es "{nombre_persona}" — preséntate y refiérete '
        f"a ti mismo así si corresponde."
    )
