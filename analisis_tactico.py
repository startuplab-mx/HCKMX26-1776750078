import sys
import json
import cv2
import numpy as np
from ultralytics import YOLO
import requests
import torch
import os
import urllib3

# Desactivamos advertencias de SSL para que no ensucien la consola
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

class FiltroInteligencia:
    def __init__(self):
        # ⚠️ VITAL: verbose=False evita que la IA imprima su progreso en consola y rompa el JSON
        self.model = YOLO("yolov8x-oiv7.pt", verbose=False)
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        self.model.to(self.device)

        # Mapeo semántico de riesgos
        self.categorias = {
            "ARMAMENTO": ['weapon', 'gun', 'rifle', 'arm', 'shotgun', 'pistol', 'cannon', 'machine gun'],
            "MOVILIDAD": ['vehicle', 'truck', 'car', 'tank', 'van', 'pickup', 'land vehicle', 'ambulance'],
            "ESCENARIO": ['mountain', 'tree', 'forest', 'wood', 'plant', 'building', 'house', 'ruins', 'shack', 'wall', 'rock', 'cliff']
        }

    def obtener_imagen(self, entrada):
        if os.path.exists(entrada):
            return cv2.imread(entrada)
        try:
            res = requests.get(entrada, verify=False, timeout=10)
            if res.status_code == 200:
                return cv2.imdecode(np.frombuffer(res.content, np.uint8), cv2.IMREAD_COLOR)
            return None
        except:
            return None

    def triage(self, img):
        # ⚠️ VITAL: verbose=False en la inferencia
        resultados = self.model(img, verbose=False)
        
        riesgos_detectados = {}
        conteo_categorias = 0

        for r in resultados:
            cajas = r.boxes
            for caja in cajas:
                clase_id = int(caja.cls[0])
                nombre_clase = self.model.names[clase_id].lower()

                # Clasificar el objeto detectado
                for categoria, palabras_clave in self.categorias.items():
                    if any(pc in nombre_clase for pc in palabras_clave):
                        if categoria not in riesgos_detectados:
                            riesgos_detectados[categoria] = set()
                            conteo_categorias += 1
                        riesgos_detectados[categoria].add(nombre_clase)
        
        return riesgos_detectados, conteo_categorias

if __name__ == "__main__":
    try:
        # 1. Leer el JSON enviado por Node.js a través de los argumentos del sistema
        if len(sys.argv) < 2:
            raise ValueError("No se recibio el JSON de entrada desde Node.js")

        input_json = sys.argv[1]
        data = json.loads(input_json)
        cover_url = data.get("image_source")

        if not cover_url:
            raise ValueError("El JSON no contiene el campo 'image_source'")

        # 2. Inicializar el modelo
        app = FiltroInteligencia()

        # 3. Obtener la imagen
        img = app.obtener_imagen(cover_url)
        if img is None:
            raise ValueError(f"No se pudo descargar o procesar la imagen: {cover_url}")

        # 4. Ejecutar el análisis (Triage)
        riesgos_detectados, conteo_riesgos = app.triage(img)

        # 5. Lógica de Decisión estricta para Node.js
        if conteo_riesgos >= 2:
            nivel_amenaza = "alto"
            decision = "amenaza"
        elif conteo_riesgos == 1:
            nivel_amenaza = "medio"
            decision = "amenaza"
        else:
            nivel_amenaza = "nulo"
            decision = "seguro"

        # 6. Imprimir ÚNICAMENTE el JSON de respuesta
        # Convertimos los conjuntos (sets) a listas para que el JSON sea válido
        detalles_riesgos = {k: list(v) for k, v in riesgos_detectados.items()}

        respuesta = {
            "status": "success",
            "decision": decision,
            "nivel": nivel_amenaza,
            "detalles": detalles_riesgos
        }
        
        # El ÚNICO print del sistema
        print(json.dumps(respuesta))

    except Exception as e:
        # Respuesta de error en formato JSON
        error_resp = {
            "status": "error",
            "message": str(e),
            "decision": "desconocido",
            "nivel": "desconocido"
        }
        print(json.dumps(error_resp))