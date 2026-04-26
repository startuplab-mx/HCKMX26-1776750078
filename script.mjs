import fs from 'fs';
import { ApifyClient } from 'apify-client';
import Fuse from 'fuse.js';
import AhoCorasick from 'aho-corasick';
import { execFile } from 'child_process';
import { promisify } from 'util';
import mysql from 'mysql2/promise';

const execFileAsync = promisify(execFile);

const apifyClient = new ApifyClient({
    token: process.env.APIFY_TOKEN
});

const dbConfig = {
    host: 'db-desarrollo-web.ccns8wxeigtt.us-east-1.rds.amazonaws.com',
    user: 'admin',
    password: process.env.DB_PASSWORD,
    database: 'hack_shell',
    charset: 'utf8mb4'
};

const diccionarioAmenazas = [
    { termino: "cjng", peso: 50 },
    { termino: "cartel", peso: 50 },
    { termino: "4L", peso: 40 },
    { termino: "reclutamiento", peso: 50 },
    { termino: "belico", peso: 30 },
    { termino: "alucin", peso: 15 },
    { termino: "plaza", peso: 20 },
    { termino: "sinaloa", peso: 10 }
];

const palabrasSeguras = ["pizza", "food", "recipe", "comida", "pollo", "chef"];

// Configuración de Filtro Beta (Aho-Corasick)
const frasesReclutamiento = [
    "info", "cuanto pagan", "manda dm", "manda msj",
    "manda mensaje", "quiero trabajar", "jalo", "hay jale",
    "me interesa", "donde firmo", "quiero entrar", "necesito paro",
    "quiero chambear", "hay jale"
];
const frasesAdmiracion = ["puro cjng", "pura mayiza", "pura chapiza", "CDN", "🫡", "arriba las 4l", "puras 4l", "patrón", "MJ", "al millon", "señor de los gallos", "la empresa", "puro jefe"];

const acReclutamiento = new AhoCorasick(frasesReclutamiento);
const acAdmiracion = new AhoCorasick(frasesAdmiracion);

// Lógica del Filtro Alpha (Fuse.js)
const fuse = new Fuse(diccionarioAmenazas, { keys: ['termino'], threshold: 0.3 });

// Extraer emojis
function extraerEmojis(texto) {
    const regex = /[\p{Extended_Pictographic}]/gu;
    return (texto || '').match(regex)?.join('') || '';
}

function evaluarReelAlpha(tiktok) {
    const texto = (tiktok.text || "").toLowerCase();
    const hashtags = (tiktok.hashtags || []).map(h => h.name.toLowerCase()).join(" ");
    const todoElTexto = texto + " " + hashtags;

    // Regla de descarte por contexto
    if ((todoElTexto.includes('🍕') || todoElTexto.includes('🐓')) && palabrasSeguras.some(p => todoElTexto.includes(p))) {
        return { score: 0, motivo: "Contexto de comida detectado" };
    }

    // Si no tiene texto ni hashtags, es sospechoso por ofuscación
    if (!tiktok.text && (!tiktok.hashtags || tiktok.hashtags.length === 0)) {
        return { score: 35, motivo: "Posible ofuscación (Sin metadatos)" };
    }

    let score = 0;
    const palabras = todoElTexto.split(/\s+/);
    palabras.forEach(p => {
        const res = fuse.search(p);
        if (res.length > 0) score += res[0].item.peso;
    });

    if (todoElTexto.includes('🍕') && todoElTexto.includes('🐓')) score += 40;

    return { score, url: tiktok.webVideoUrl, motivo: "Análisis de términos y emojis" };
}

// Filtro Beta (Análisis de Comentarios)
function analizarComentariosBeta(comentarios) {
    const textoJunto = comentarios.join(" ").toLowerCase();

    // Búsqueda en un solo traverse con Aho-Corasick
    const hitsReclutamiento = acReclutamiento.search(textoJunto).length;
    const hitsAdmiracion = acAdmiracion.search(textoJunto).length;

    let nivelRiesgo = "ALTO (Pendiente)";
    if (hitsReclutamiento >= 2) nivelRiesgo = "CRÍTICO (Reclutamiento Activo)";
    else if (hitsAdmiracion >= 3) nivelRiesgo = "CRÍTICO (Idolatría Criminal)";

    return { hitsReclutamiento, hitsAdmiracion, nivelRiesgo };
}

// Comunicación con el Filtro Omega (Python)
async function ejecutarFiltroOmega(coverUrl) {
    console.log(`Omega analizando cover: ${coverUrl}`);

    const inputPayload = JSON.stringify({ image_source: coverUrl });

    try {
        // Ejecutamos Python pasando el JSON como argumento
        const { stdout } = await execFileAsync('python', ['analisis_tactico.py', inputPayload]);

        // Convertir respuesta de Python a JSON
        const resultado = JSON.parse(stdout.trim());
        return resultado;

    } catch (error) {
        console.error("Error en script de Python:", error.message);
        return { status: "error", decision: "desconocido" };
    }
}

// Registro de tiktoks a la DB
async function registrarEnBD(tiktokId, dataOriginal, esAmenaza, evalFinal = {}) {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        const autor = dataOriginal.authorMeta;
        const prefix = esAmenaza ? 'target' : 'normal';

        // Intentar inserción de Usuario
        const sqlUser = `INSERT IGNORE INTO ${prefix}_user
            (user_id, username, nickname, is_verified, avatar_url, followers_count, following_count, total_likes_received, total_videos)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        await connection.execute(sqlUser, [
            autor.id, autor.name, autor.nickName, autor.verified ? 1 : 0, autor.avatar,
            autor.fans, autor.following, autor.heart, autor.video
        ]);

        // Insertar TikTok con métricas
        const hashtags = dataOriginal.hashtags ? dataOriginal.hashtags.map(h => h.name).join(',') : '';
        const emojis = extraerEmojis(dataOriginal.text);

        if (esAmenaza) {
            const sqlTiktok = `INSERT IGNORE INTO target_tiktok
                (tiktok_id, user_id, descripcion, fecha_publicacion, video_url, cover_url, play_count, digg_count, comment_count, share_count, hashtags, emojis_detectados, score_alpha, resultado_beta, resultado_omega, razon_condena)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            await connection.execute(sqlTiktok, [
                tiktokId, autor.id, dataOriginal.text, dataOriginal.createTimeISO, dataOriginal.webVideoUrl,
                dataOriginal.videoMeta?.coverUrl, dataOriginal.playCount, dataOriginal.diggCount, dataOriginal.commentCount, dataOriginal.shareCount,
                hashtags, emojis, evalFinal.scoreAlpha, evalFinal.resultadoBeta, evalFinal.resultadoOmega, evalFinal.razonCondena
            ]);
        } else {
            const sqlTiktok = `INSERT IGNORE INTO normal_tiktok
                (tiktok_id, user_id, descripcion, fecha_publicacion, video_url, cover_url, play_count, digg_count, comment_count, share_count, hashtags, emojis_detectados)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            await connection.execute(sqlTiktok, [
                tiktokId, autor.id, dataOriginal.text, dataOriginal.createTimeISO, dataOriginal.webVideoUrl,
                dataOriginal.videoMeta?.coverUrl, dataOriginal.playCount, dataOriginal.diggCount, dataOriginal.commentCount, dataOriginal.shareCount,
                hashtags, emojis
            ]);
        }

    } catch (err) {
        console.error(`Error BD en TikTok ${tiktokId}:`, err.message);
    } finally {
        if (connection) await connection.end();
    }
}

// Función medular de la propuesta: INVERTED CHRISTMAS TREE 
async function executeInvertedChristmasTree() {
    try {
        // --- CAPA 1: Alpha (Ejecución de búsquedas automatizadas) TODO ---
        const rawData = fs.readFileSync('./scrapetest.json', 'utf-8');
        const tiktoks = JSON.parse(rawData);

        // Mapa para acceder O(1) a los metadatos originales
        const tiktokMap = new Map(tiktoks.map(t => [t.id, t]));

        console.log(`\nINICIANDO PIPELINE INVERTED CHRISTMAS TREE - Analizando ${tiktoks.length} videos...`);

        const sospechososAlpha = [];

        // --- CAPA 2: Beta (Descripción y Hashtags) ---
        for (const t of tiktoks) {
            const res = evaluarReelAlpha(t);
            if (res.score >= 30) {
                sospechososAlpha.push({ id: t.id, scoreAlpha: res.score });
            } else {
                // Si se descarta, se considera genuino
                await registrarEnBD(t.id, t, false);
            }
        }

        if (sospechososAlpha.length === 0) return console.log("No hay amenazas.");

        // --- CAPA 3: Sigma (Comentarios con Apify) ---
        const urlsBeta = sospechososAlpha.map(s => tiktokMap.get(s.id).webVideoUrl);
        const run = await apifyClient.actor("clockworks/tiktok-comments-scraper").call({ postURLs: urlsBeta, commentsPerPost: 20 });
        const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

        const comentariosPorVideo = {};
        items.forEach(i => {
            if (!comentariosPorVideo[i.postURL]) comentariosPorVideo[i.postURL] = [];
            comentariosPorVideo[i.postURL].push(i.text);
        });

        // --- CAPA 4: OMEGA (Computer Vision con Python) ---
        for (const s of sospechososAlpha) {
            const original = tiktokMap.get(s.id);
            const comentarios = comentariosPorVideo[original.webVideoUrl] || [];
            const evalBeta = analizarComentariosBeta(comentarios);

            let confirmado = false;
            let evalFinal = { scoreAlpha: s.scoreAlpha, resultadoBeta: evalBeta.nivelRiesgo, resultadoOmega: 'No requerido', razonCondena: '' };

            if (evalBeta.nivelRiesgo.includes("CRÍTICO")) {
                confirmado = true;
                evalFinal.razonCondena = "Detectado por densidad de comentarios de reclutamiento.";
            } else {
                const resOmega = await ejecutarFiltroOmega(original.videoMeta?.coverUrl);
                if (resOmega.decision === "amenaza" && (resOmega.nivel === "alto" || resOmega.nivel === "medio")) {
                    confirmado = true;
                    evalFinal.resultadoOmega = `AMENAZA (${resOmega.nivel})`;
                    evalFinal.razonCondena = "Análisis táctico visual detectó elementos criminales.";
                }
            }

            // Resultado final (Estrella o Descarte)
            await registrarEnBD(s.id, original, confirmado, evalFinal);
            console.log(confirmado ? `AMENAZA CONFIRMADA: ${s.id}` : `Descartado por Omega: ${s.id}`);
        }

        console.log("\nPipeline finalizado. Base de Datos actualizada.");

    } catch (error) {
        console.error("Error crítico:", error);
    }
}

executeInvertedChristmasTree();