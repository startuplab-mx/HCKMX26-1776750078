DROP DATABASE IF EXISTS hack_shell;
CREATE DATABASE hack_shell;
USE hack_shell;

CREATE TABLE target_user (
    user_id VARCHAR(50) PRIMARY KEY,             -- authorMeta.id
    username VARCHAR(255),                       -- authorMeta.name (ej. r5559361)
    nickname VARCHAR(255),                       -- authorMeta.nickName (ej. R5🍕35z😈)
    is_verified BOOLEAN DEFAULT FALSE,           -- authorMeta.verified
    avatar_url TEXT,                             -- authorMeta.avatar (Para mostrar la foto en el dashboard)
    
    -- Estas métricas de usuario son brutales para ver qué tan grande es la red del reclutador
    followers_count INT DEFAULT 0,               -- authorMeta.fans
    following_count INT DEFAULT 0,               -- authorMeta.following
    total_likes_received INT DEFAULT 0,          -- authorMeta.heart
    total_videos INT DEFAULT 0                   -- authorMeta.video
);

CREATE TABLE target_tiktok (
    tiktok_id VARCHAR(50) PRIMARY KEY,           -- id
    user_id VARCHAR(50),                         -- Relación al reclutador
    
    -- Metadatos del video
    descripcion TEXT,                            -- text (Texto crudo del video)
    fecha_publicacion DATETIME,                  -- createTimeISO (Útil para graficar actividad en el tiempo)
    video_url TEXT,                              -- webVideoUrl
    cover_url TEXT,                              -- videoMeta.coverUrl (Para mostrar la miniatura)
    
    -- Métricas de viralidad (El alcance del cibercrimen)
    play_count INT DEFAULT 0,                    -- playCount (Vistas)
    digg_count INT DEFAULT 0,                    -- diggCount (Likes)
    comment_count INT DEFAULT 0,                 -- commentCount (Comentarios)
    share_count INT DEFAULT 0,                   -- shareCount (Compartidos)
    
    -- Elementos para las gráficas del Dashboard (Extraídos en Node.js antes del INSERT)
    hashtags TEXT,                               -- Guardar separados por comas: "fyp,cjng,belico"
    emojis_detectados VARCHAR(255),              -- Guardar juntos: "🍕🐓🪖"
    
    -- ==========================================
    -- RESULTADOS DEL "INVERTED CHRISTMAS TREE"
    -- ==========================================
    score_alpha INT DEFAULT 0,                   -- Puntuación de amenaza (Fuse.js)
    resultado_beta VARCHAR(100),                 -- Ej: "CRÍTICO (Reclutamiento Activo)"
    resultado_omega VARCHAR(100),                -- Ej: "AMENAZA CONFIRMADA"
    razon_condena TEXT,                          -- El porqué el pipeline lo marcó como peligroso
    fecha_deteccion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES target_user(user_id)
);

-- ==========================================
-- 2. TABLAS PARA VIDEOS NORMALES (GRUPO DE CONTROL)
-- ==========================================
-- Estas tablas son idénticas en estructura de metadatos, 
-- pero sin las columnas del pipeline de amenazas. 
-- Sirven para el Dashboard para comparar "Tráfico Normal" vs "Tráfico Criminal".

CREATE TABLE normal_user (
    user_id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(255),
    nickname VARCHAR(255),
    is_verified BOOLEAN DEFAULT FALSE,
    avatar_url TEXT,
    followers_count INT DEFAULT 0,
    following_count INT DEFAULT 0,
    total_likes_received INT DEFAULT 0,
    total_videos INT DEFAULT 0
);

CREATE TABLE normal_tiktok (
    tiktok_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50),
    descripcion TEXT,
    fecha_publicacion DATETIME,
    video_url TEXT,
    cover_url TEXT,
    play_count INT DEFAULT 0,
    digg_count INT DEFAULT 0,
    comment_count INT DEFAULT 0,
    share_count INT DEFAULT 0,
    hashtags TEXT,
    emojis_detectados VARCHAR(255),
    
    FOREIGN KEY (user_id) REFERENCES normal_user(user_id)
);