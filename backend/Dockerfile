# Backend Reforma AI — imagen con ffmpeg (comparaciones/crossfade) y fuente
# DejaVu para los overlays. Render/Fly/Railway la construyen tal cual.
FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Fuente Linux para drawtext (en Windows el default es arialbd.ttf)
ENV FONT_PATH=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf

EXPOSE 8077

# Render inyecta $PORT; local usa 8077.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8077}"]
