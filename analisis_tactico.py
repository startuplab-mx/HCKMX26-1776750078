import sys
import json
import cv2
import numpy as np
from ultralytics import YOLO
import yt_dlp
import requests
import torch
import os
import urllib3

# Desactivar advertencias de SSL para entornos de desarrollo
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

class FiltroInteligencia:
    def __init__(self):
        # Carga optimizada del modelo
        self.model = YOLO("yolov8x-oiv7.pt")
        self.model.to('cuda' if torch.cuda.is_available() else 'cpu')
        
        # Categorías de interés
        self.categorias_criticas = ['Weapon', 'Rifle', 'Armored vehicle', 'Truck', 'Land vehicle', 'Van']

    def analizar_entorno(self, img):
        """Detecta si la imagen corresponde a una zona rural/sierra"""
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        bajo_sierra = np.array([10, 20, 20])
        alto_sierra = np.array([30, 255, 200])
        mask_sierra = cv2.inRange(hsv, bajo_sierra, alto_sierra)
        return (cv2.countNonZero(mask_sierra) / (img.shape[0]*img.shape[1])) * 100

    def obtener_imagen(self, entrada):
        headers = {'User-Agent': 'Mozilla/5.0'}
        if os.path.exists(entrada): return cv2.imread(entrada)
        
        extensiones_img = ('.jpg', '.jpeg', '.png', '.webp', '.bmp')
        if entrada.lower().split('?')[0].endswith(extensiones_img):
            img_raw = requests.get(entrada, headers=headers, verify=False, timeout=5).content
            return cv2.imdecode(np.frombuffer(img_raw, np.uint8), cv2.IMREAD_COLOR)
        
        ydl_opts = {'skip_download': True, 'quiet': True, 'no_warnings': True, 'extract_flat': True}
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(entrada, download=False)
                img_url = info.get('thumbnail')
                img_raw = requests.get(img_url, headers=headers, verify=False, timeout=5).content
                return cv2.imdecode(np.frombuffer(img_raw, np.uint8), cv2.IMREAD_COLOR)
        except:
            return None

    def ejecutar_analisis(self, entrada):
        """Lógica principal que retorna datos estructurados para Node.js"""
        img = self.obtener_imagen(entrada)
        if img is None:
            raise ValueError(f"No se pudo cargar la imagen desde la fuente")

        arma_detectada = False
        vehiculo_detectado = False
        
        # Inferencia rápida
        results = self.model.predict(img, conf=0.15, verbose=False, imgsz=640)

        for r in results:
            for box in r.boxes:
                label = self.model.names[int(box.cls)]
                if label in ['Weapon', 'Rifle']: arma_detectada = True
                if label in ['Armored vehicle', 'Truck', 'Land vehicle', 'Van']: vehiculo_detectado = True

        # Análisis de entorno
        sierra_perc = self.analizar_entorno(img)
        es_sierra = sierra_perc > 15

        # Conteo de factores de riesgo
        factores = 0
        if arma_detectada: factores += 1
        if vehiculo_detectado: factores += 1
        if es_sierra: factores += 1

        # Determinación de niveles según tus parámetros
        amenaza_detectada = factores > 0
        if factores >= 2:
            nivel = "alto"
        elif factores == 1:
            nivel = "medio"
        else:
            nivel = "nulo"

        return amenaza_detectada, nivel

def main():
    try:
        # 1. Recibir el JSON enviado desde Node.js por argumentos de sistema
        if len(sys.argv) < 2:
            raise ValueError("No se recibió el JSON de entrada")

        input_json = sys.argv[1]
        data = json.loads(input_json)
        cover_url = data.get("image_source")

        if not cover_url:
            raise ValueError("El JSON no contiene 'image_source'")

        # 2. Instanciar y ejecutar
        filtro = FiltroInteligencia()
        es_amenaza, nivel_amenaza = filtro.ejecutar_analisis(cover_url)

        # 3. Preparar la respuesta JSON para Node.js
        decision = "amenaza" if es_amenaza else "seguro"
        
        # IMPORTANTE: Esto es lo único que el script debe imprimir en consola
        print(json.dumps({
            "decision": decision,
            "nivel": nivel_amenaza,
            "status": "success"
        }))

    except Exception as e:
        # Enviar el error a Node.js en formato JSON
        print(json.dumps({
            "status": "error",
            "message": str(e)
        }))

if __name__ == "__main__":
    main()