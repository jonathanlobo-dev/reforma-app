"""Traducciones del backend: mensajes de error/cuota y personalización de
"El Maestro" por idioma. ES es el idioma base; EN/PT/IT están completos
(Fase 3). El resolver (`_resolver`) siempre cae a ES si a algún idioma le
faltara una clave — nunca un KeyError, aunque se agregue un idioma nuevo a
medias."""

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
        "pt": "O serviço está na capacidade máxima neste momento. Tente novamente daqui a pouco.",
        "it": "Il servizio è al massimo della capacità in questo momento. Riprova tra poco.",
    },
    "contenido": {
        "es": "La imagen o el pedido no pasó los filtros de contenido. Intenta con otra foto u otra descripción.",
        "en": "The image or request didn't pass our content filters. Try a different photo or description.",
        "pt": "A imagem ou o pedido não passou nos filtros de conteúdo. Tente com outra foto ou outra descrição.",
        "it": "L'immagine o la richiesta non ha superato i filtri di contenuto. Prova con un'altra foto o descrizione.",
    },
    "timeout": {
        "es": "La generación tardó demasiado y se canceló. Intenta de nuevo.",
        "en": "The generation took too long and was canceled. Please try again.",
        "pt": "A geração demorou demais e foi cancelada. Tente novamente.",
        "it": "La generazione ha impiegato troppo tempo ed è stata annullata. Riprova.",
    },
    "rate_limit": {
        "es": "Hay muchas personas generando en este momento. Intenta en unos minutos.",
        "en": "Lots of people are generating right now. Try again in a few minutes.",
        "pt": "Muitas pessoas estão gerando neste momento. Tente novamente em alguns minutos.",
        "it": "Molte persone stanno generando in questo momento. Riprova tra qualche minuto.",
    },
    "falta_mascara": {
        "es": "Falta pintar la zona a cambiar. Vuelve atrás y usa el pincel.",
        "en": "You still need to paint the area to change. Go back and use the brush.",
        "pt": "Falta pintar a área a mudar. Volte e use o pincel.",
        "it": "Devi ancora dipingere l'area da cambiare. Torna indietro e usa il pennello.",
    },
    "falta_referencia": {
        "es": "Falta la foto de inspiración. Vuelve atrás y súbela.",
        "en": "The inspiration photo is missing. Go back and upload it.",
        "pt": "Falta a foto de inspiração. Volte e a envie.",
        "it": "Manca la foto di ispirazione. Torna indietro e caricala.",
    },
    "generico": {
        "es": "Algo salió mal generando tu transformación. Intenta de nuevo.",
        "en": "Something went wrong generating your transformation. Please try again.",
        "pt": "Algo deu errado ao gerar sua transformação. Tente novamente.",
        "it": "Qualcosa è andato storto generando la tua trasformazione. Riprova.",
    },
}


def error_msg(clave: str, lang: str) -> str:
    return _resolver(ERRORES, clave, lang)


# ─── Mensajes de cuota (límites diarios) ─────────────────────────────────────

CUOTAS = {
    "limite_imagenes_free": {
        "es": "Llegaste al límite de {n} imágenes por hoy. Hazte Premium para más.",
        "en": "You've reached today's limit of {n} images. Go Premium for more.",
        "pt": "Você atingiu o limite de {n} imagens por hoje. Assine o Premium para mais.",
        "it": "Hai raggiunto il limite di {n} immagini per oggi. Passa a Premium per averne di più.",
    },
    "limite_imagenes_premium": {
        "es": "Llegaste al límite de {n} imágenes por hoy.",
        "en": "You've reached today's limit of {n} images.",
        "pt": "Você atingiu o limite de {n} imagens por hoje.",
        "it": "Hai raggiunto il limite di {n} immagini per oggi.",
    },
    "limite_videos_lock": {
        "es": "Los videos son Premium. Hazte Premium para desbloquearlos.",
        "en": "Videos are a Premium feature. Go Premium to unlock them.",
        "pt": "Os vídeos são Premium. Assine o Premium para desbloqueá-los.",
        "it": "I video sono una funzione Premium. Passa a Premium per sbloccarli.",
    },
    "limite_videos_free": {
        "es": "Llegaste a tu límite de {n} video(s) por hoy. Hazte Premium para más.",
        "en": "You've reached your limit of {n} video(s) for today. Go Premium for more.",
        "pt": "Você atingiu seu limite de {n} vídeo(s) por hoje. Assine o Premium para mais.",
        "it": "Hai raggiunto il tuo limite di {n} video per oggi. Passa a Premium per averne di più.",
    },
    "limite_videos_premium": {
        "es": "Llegaste al límite de {n} video(s) por hoy.",
        "en": "You've reached the limit of {n} video(s) for today.",
        "pt": "Você atingiu o limite de {n} vídeo(s) por hoje.",
        "it": "Hai raggiunto il limite di {n} video per oggi.",
    },
    "limite_global_videos": {
        "es": "El sistema alcanzó su límite diario de videos. Intenta mañana.",
        "en": "The system reached its daily video limit. Try again tomorrow.",
        "pt": "O sistema atingiu seu limite diário de vídeos. Tente amanhã.",
        "it": "Il sistema ha raggiunto il limite giornaliero di video. Riprova domani.",
    },
    "limite_chats": {
        "es": "El Maestro descansa: llegaste a los {n} mensajes de hoy. Vuelve mañana.",
        "en": "The Foreman is resting: you've reached {n} messages today. Come back tomorrow.",
        "pt": "O Mestre está descansando: você atingiu {n} mensagens hoje. Volte amanhã.",
        "it": "Il Maestro si sta riposando: hai raggiunto {n} messaggi oggi. Torna domani.",
    },
    "limite_ip": {
        "es": "Se alcanzó el límite diario desde esta red. Intenta mañana.",
        "en": "The daily limit for this network has been reached. Try again tomorrow.",
        "pt": "O limite diário desta rede foi atingido. Tente amanhã.",
        "it": "È stato raggiunto il limite giornaliero per questa rete. Riprova domani.",
    },
    "requiere_suscripcion": {
        "es": "Necesitas una suscripción activa para generar. Empieza tu prueba gratis.",
        "en": "You need an active subscription to generate. Start your free trial.",
        "pt": "Você precisa de uma assinatura ativa para gerar. Comece seu teste grátis.",
        "it": "Serve un abbonamento attivo per generare. Inizia la prova gratuita.",
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
        "pt": "Só é possível transformar espaços ou objetos reais da sua foto.",
        "it": "È possibile trasformare solo spazi o oggetti reali della tua foto.",
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
