import fs from 'fs/promises';

// Mantenemos la URL de prueba como solicitaste
const post_url = "https://www.tiktok.com/@cookshowtrevor/video/7520777544975568158";

// Extraemos el ID del video (el último segmento de la URL)
const post_id = post_url.split('/').pop();

console.log('Retrieved post id: ', post_id);

// Cabeceras exactas de tu script original
const headers = {
    'accept': '*/*',
    'accept-language': 'en-US, en;q=0.9,fa;q=0.8',
    'cache-control': 'no-cache',
    'pragma': 'no-cache',
    'priority': 'u=1, i',
    'referer': 'https://www.tiktok.com/explore',
    'sec-ch-ua': '"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
};

// Función para realizar la petición HTTP
async function req(postId, cursor) {
    // URL con los tokens tal cual estaban en el script original
    // const url = `https://www.tiktok.com/api/comment/list/?WebIdLastTime=1776998797&aid=1988&app_language=en-GB&app_name=tiktok_web&aweme_id=${postId}&browser_language=en-GB&browser_name=Mozilla&browser_online=true&browser_platform=Win32&browser_version=5.0%20%28Windows%20NT%2010.0%3B%20Win64%3B%20x64%29%20AppleWebKit%2F537.36%20%28KHTML%2C%20like%20Gecko%29%20Chrome%2F147.0.0.0%20Safari%2F537.36&channel=tiktok_web&cookie_enabled=true&count=20&cursor=${cursor}&data_collection_enabled=false&device_id=7632151705426249236&device_platform=web_pc&focus_state=true&from_page=video&history_len=2&is_fullscreen=false&is_page_visible=true&odinId=7632151602183652372&os=windows&priority_region=&referer=https%3A%2F%2Fwww.tiktok.com%2F%40cookshowtrevor%2Fvideo%2F7520777544975568158&region=MX&root_referer=https%3A%2F%2Fwww.tiktok.com%2F%40cookshowtrevor%2Fvideo%2F7520777544975568158&screen_height=864&screen_width=1536&tz_name=America%2FMexico_City&user_is_login=false&webcast_language=en-GB&msToken=pMw2hqc3qxudFvc4UNF64A5rwFYQmo4sFoL6lvQ09ruG7DtvbdD3aY1Gov88CPjJxNSNLU-UEwrHYHDR8nm6ZE5131p1_uedVacwDBT3WiuwSgwjfAaPUuPMGkrqALUbGRe9hqNpGlMGAUzzG0AJ9AinpA==&X-Bogus=DFSzsIVYHXsANaRCCbq5O5VRr3N-&X-Gnarly=MPfxb9oJIj7rni4X/M-I6d675oxCLB7iwUMJf0dc2Y-OFSQMGS5OkXxSayULsm8TsPd9XdocxlOdy-KWxpk2NuWrftJKzFppnrsSP2Ke7aYGzToTiNiz-0aS0pLpLegKuhbAbZuswFH2BNuF2Xa7LunCHGKLr-XgiClVW8H0a2fyoyizsn-yRgJma8Pi-oIfOmA9YrVrnPIQXcoUJyeMQVuvGG60thRBZ4lz-shSBIB22lk0f0xRV4OfGEaigLEPjnuoNye7pA4xhTn6Vw64kOaB-z58JCwOxABBJvgO/DexruMAhcEcK/ZAQXIcbxMzMEaPIGRChu==`;
    const url = `https://www.tiktok.com/api/comment/list/?WebIdLastTime=1776998797&aid=1988&app_language=en-GB&app_name=tiktok_web&aweme_id=${postId}&browser_language=en-GB&browser_name=Mozilla&browser_online=true&browser_platform=Win32&browser_version=5.0%20%28Windows%20NT%2010.0%3B%20Win64%3B%20x64%29%20AppleWebKit%2F537.36%20%28KHTML%2C%20like%20Gecko%29%20Chrome%2F147.0.0.0%20Safari%2F537.36&channel=tiktok_web&cookie_enabled=true&count=20&cursor=${cursor}&data_collection_enabled=false&device_id=7632151705426249236&device_platform=web_pc&focus_state=true&from_page=video&history_len=2&is_fullscreen=false&is_page_visible=true&odinId=7632151602183652372&os=windows&priority_region=&referer=https%3A%2F%2Fwww.tiktok.com%2F%40cookshowtrevor%2Fvideo%2F7520777544975568158&region=MX&root_referer=https%3A%2F%2Fwww.tiktok.com%2F%40cookshowtrevor%2Fvideo%2F7520777544975568158&screen_height=864&screen_width=1536&tz_name=America%2FMexico_City&user_is_login=false&verifyFp=verify_moewxa0k_b6fkaE8n_zHlx_4PR1_A978_fuHc5q2827MW&webcast_language=en-GB&msToken=G5LzOpDLzHi1e4PlYdTwHOCCs0hz2cB9yl5f6hfwlSSSifQ6c71iQrjsDBw4tMvHQGPkWUJ2Wc8gbYlAslgRtTpHRTq4FqOw5gGbkKN2EYrvpc6LLy_88mX2Sy3YtNQA8mI29VuFBuEmfdwPI8DmiFoKFg==&X-Bogus=DFSzsIVYTfUANaRCCbogh5VRr3E6&X-Gnarly=McRLMzgEZ78306cp4ISb3gzmTNC/OfoaNBJYSuFaotkmM6MBl-OaNzHCNeyRkvQMndxm7dWLkbPDoGnfYEXWHeI5rXpAQQVARDfq/cdq0HsX84Dzzy0ujLXGx/N8PpkerE8bucQgiTm91HNI0HcudKWRfGLfdn/Z-9o8X/qwCgRJjjL3BaYAfbfKQT6Fxt3Ujz2YxayLW2G/DpwLbnzKjk7cmzVrvwdXLiAzx6Zi23tqU3bsizmJ-2sHje2AYjfDSQjoaIzVBxz6Ds5w9FZIAt0fJ30hZwDsF1gYfnj6CyG-2pVuxaVWwcs0OzI5RpA6DR8HsycbTk==`

    const response = await fetch(url, { headers });

    if (!response.ok) {
        throw new Error(`Error en la petición: ${response.status} ${response.statusText}`);
    }

    return await response.json();
}

// Función para parsear la data y extraer el texto de los comentarios
function parser(data, commentsArray) {
    if (!data || !data.comments) return data;

    for (const cm of data.comments) {
        let com = "";
        if (cm.share_info && cm.share_info.desc) {
            com = cm.share_info.desc;
        }

        if (com === "") {
            com = cm.text || "";
        }

        commentsArray.push(com);
    }
    return data;
}

// Función principal autoejecutable
async function main() {
    // Inicializamos el arreglo de comentarios tal como en Python
    const commentsArray = [{ 'post_url': post_url }];
    let curs = 0;

    try {
        while (true) {
            const rawData = await req(post_id, curs);
            const parsedData = parser(rawData, commentsArray);

            if (parsedData.has_more === 1) {
                curs += 20;
                console.log('Moving to the next cursor (loading new comments)');

                // Buena práctica en scraping: Pausa breve para evitar banneos rápidos
                await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
                console.log('No more comments to read');
                break;
            }
        }

        // Guardar en el archivo JSON
        await fs.writeFile('output.json', JSON.stringify(commentsArray, null, 4), 'utf-8');
        console.log('\nComments have been successfully saved');

    } catch (error) {
        console.error('🚨 Error crítico al extraer los comentarios:', error);
    }
}

main();