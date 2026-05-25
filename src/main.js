import { CapacitorHttp } from '@capacitor/core';
import JKanimePlugin from '../plugins/jkanime.js';
import AnimeFLVPlugin from '../plugins/animeflv.js';
import HanimePlugin from '../plugins/hanime.js';
import NyaaPlugin from '../plugins/nyaa.js';

// Registro de plugins
const plugins = {
    'jkanime': JKanimePlugin,
    'animeflv': AnimeFLVPlugin,
    'nyaa': NyaaPlugin,
    'hanime': HanimePlugin
};

let searchMode = 'anime';       // 'anime' o 'hentai'
let selectedAnime = null;
let activeResults = [];
let hlsInstance = null;

// Elementos del DOM
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const resultsContainer = document.getElementById('resultsContainer');
const statusDiv = document.getElementById('status');

const episodesSection = document.getElementById('episodesSection');
const episodesContainer = document.getElementById('episodesContainer');
const animeDetailsTitle = document.getElementById('animeDetailsTitle');
const backToResultsBtn = document.getElementById('backToResultsBtn');

const serverSection = document.getElementById('serverSection');
const serverGroups = document.getElementById('serverGroups');
const backToEpisodesBtn = document.getElementById('backToEpisodesBtn');
const blockAdsCheckbox = document.getElementById('block-ads');

const playerContainer = document.getElementById('playerContainer');
const videoPlayer = document.getElementById('videoPlayer');
const closePlayerBtn = document.getElementById('closePlayerBtn');
const playingTitle = document.getElementById('playingTitle');

const modeAnimeBtn = document.getElementById('mode-anime');
const modeHentaiBtn = document.getElementById('mode-hentai');
const mainTitle = document.getElementById('main-title');

// ==========================================
// CONFIGURACIÓN DE INTERFAZ Y EVENTOS
// ==========================================

// Botones de Modo
modeAnimeBtn.addEventListener('click', () => {
    if (searchMode === 'anime') return;
    searchMode = 'anime';
    document.body.classList.remove('hentai-mode');
    modeAnimeBtn.classList.add('active');
    modeHentaiBtn.classList.remove('active');
    mainTitle.textContent = "AnimeDex";
    searchInput.placeholder = "Buscar anime...";
    resetUI();
});

modeHentaiBtn.addEventListener('click', () => {
    if (searchMode === 'hentai') return;
    searchMode = 'hentai';
    document.body.classList.add('hentai-mode');
    modeHentaiBtn.classList.add('active');
    modeAnimeBtn.classList.remove('active');
    mainTitle.textContent = "AnimeDex Adulto";
    searchInput.placeholder = "Buscar en Hanime...";
    resetUI();
});

function setStatus(msg) {
    statusDiv.textContent = msg;
}

function resetUI() {
    resultsContainer.innerHTML = '';
    resultsContainer.classList.remove('hidden');
    episodesSection.classList.add('hidden');
    serverSection.classList.add('hidden');
    playerContainer.classList.add('hidden');
    setStatus("Escribe tu búsqueda y presiona Buscar.");
    if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
    }
    videoPlayer.src = '';
}

// ==========================================
// LOGICA DE BUSQUEDA
// ==========================================

searchBtn.addEventListener('click', performSearch);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
});

async function performSearch() {
    const query = searchInput.value.trim();
    if (!query) return;

    setStatus("Buscando resultados...");
    resultsContainer.innerHTML = '';
    episodesSection.classList.add('hidden');
    serverSection.classList.add('hidden');

    try {
        if (searchMode === 'anime') {
            // Busqueda universal de Anime usando AniList GraphQL (no requiere CORS)
            const gqlQuery = `query($s:String){Page(page:1,perPage:15){media(search:$s,type:ANIME,sort:POPULARITY_DESC){id title{romaji english}coverImage{large}episodes}}}`;
            const response = await fetch("https://graphql.anilist.co", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: gqlQuery, variables: { s: query } })
            });
            const resData = await response.json();
            const mediaList = resData.data?.Page?.media || [];

            if (mediaList.length === 0) {
                setStatus("No se encontraron resultados.");
                return;
            }

            activeResults = mediaList.map(a => ({
                id: a.id,
                title: a.title.english || a.title.romaji,
                romaji: a.title.romaji,
                image: a.coverImage.large,
                episodes: a.episodes || 12
            }));

        } else {
            // Busqueda de Hentai usando Hanime API
            const results = await plugins.hanime.search(query, CapacitorHttp);
            if (results.length === 0) {
                setStatus("No se encontraron resultados.");
                return;
            }
            activeResults = results;
        }

        setStatus(`Se encontraron ${activeResults.length} resultados:`);
        renderResults();

    } catch (e) {
        setStatus("Error en la búsqueda: " + e.message);
    }
}

function renderResults() {
    resultsContainer.innerHTML = '';
    activeResults.forEach(item => {
        const card = document.createElement('div');
        card.className = 'anime-card';
        card.innerHTML = `
            <img src="${item.image}" alt="${item.title}" onerror="this.src='https://placehold.co/130x180?text=Sin+Imagen'">
            <div class="card-info">
                <h3>${item.title}</h3>
                <span>${item.episodes ? item.episodes + ' Episodios' : 'Película/OVA'}</span>
            </div>
        `;
        card.addEventListener('click', () => showEpisodes(item));
        resultsContainer.appendChild(card);
    });
}

// ==========================================
// LOGICA DE EPISODIOS
// ==========================================

function showEpisodes(anime) {
    selectedAnime = anime;
    resultsContainer.classList.add('hidden');
    episodesSection.classList.remove('hidden');
    serverSection.classList.add('hidden');
    animeDetailsTitle.textContent = anime.title;
    
    episodesContainer.innerHTML = '';
    setStatus("Cargando lista de episodios...");

    const totalEps = anime.episodes || 1;
    for (let i = 1; i <= totalEps; i++) {
        const btn = document.createElement('button');
        btn.className = 'ep-btn';
        btn.textContent = `Ep ${i}`;
        btn.addEventListener('click', () => fetchServers(i));
        episodesContainer.appendChild(btn);
    }
    setStatus(`${totalEps} episodios disponibles.`);
}

backToResultsBtn.addEventListener('click', () => {
    episodesSection.classList.add('hidden');
    resultsContainer.classList.remove('hidden');
    setStatus("Resultados de búsqueda:");
});

// ==========================================
// LOGICA DE SERVIDORES Y RESOLVER
// ==========================================

async function fetchServers(epNumber) {
    setStatus(`Buscando servidores para el Ep ${epNumber}...`);
    serverSection.classList.add('hidden');
    serverGroups.innerHTML = '';

    try {
        let servers = [];

        if (searchMode === 'hentai') {
            servers = await plugins.hanime.getServers(selectedAnime.title, 1, CapacitorHttp, selectedAnime.slug);
        } else {
            // Cargar en paralelo todos los proveedores disponibles para Anime
            const flvPromise = plugins.animeflv.getServers(selectedAnime.title, epNumber, CapacitorHttp).catch(e => {
                console.error("FLV Error:", e);
                return [];
            });
            const jkPromise = plugins.jkanime.getServers(selectedAnime.title, epNumber, CapacitorHttp).catch(e => {
                console.error("JK Error:", e);
                return [];
            });
            const nyaaPromise = plugins.nyaa.getServers(selectedAnime.title, epNumber, CapacitorHttp).catch(e => {
                console.error("Nyaa Error:", e);
                return [];
            });

            const results = await Promise.all([flvPromise, jkPromise, nyaaPromise]);
            servers = results.flat(); // Combinar todos los resultados en un array
        }

        if (servers.length === 0) {
            setStatus("No se encontraron servidores de reproducción.");
            return;
        }

        setStatus(`Servidores listos para Episodio ${epNumber}:`);
        renderServers(servers, epNumber);
        serverSection.classList.remove('hidden');
        episodesSection.classList.add('hidden');

    } catch (e) {
        setStatus("Error al cargar servidores: " + e.message);
    }
}

function renderServers(servers, epNumber) {
    serverGroups.innerHTML = '';

    // Agrupar
    const directServers = servers.filter(s => s.m3u8 || s.mp4);
    const iframeServers = servers.filter(s => s.iframe && !s.m3u8 && !s.mp4 && !s.torrent);
    const torrentServers = servers.filter(s => s.torrent);

    if (directServers.length > 0) {
        createGroup("⚡ Reproductores Directos (Carga Rápida)", directServers, epNumber);
    }
    if (torrentServers.length > 0) {
        createGroup("💾 Torrents de Alta Calidad", torrentServers, epNumber);
    }
    if (iframeServers.length > 0) {
        createGroup("🌐 Servidores Web (Con Publicidad)", iframeServers, epNumber);
    }
}

function createGroup(titleText, list, epNumber) {
    const group = document.createElement('div');
    group.className = 'server-group';
    
    const title = document.createElement('h3');
    title.className = 'group-title';
    title.textContent = titleText;
    group.appendChild(title);

    const btnCont = document.createElement('div');
    btnCont.className = 'server-buttons';

    list.forEach(srv => {
        const btn = document.createElement('button');
        btn.className = 'ep-btn';
        btn.textContent = srv.name.replace(/^(FLV|JK|NYAA)\s*-\s*/, "");
        btn.addEventListener('click', () => loadVideo(srv, epNumber));
        btnCont.appendChild(btn);
    });

    group.appendChild(btnCont);
    serverGroups.appendChild(group);
}

backToEpisodesBtn.addEventListener('click', () => {
    serverSection.classList.add('hidden');
    episodesSection.classList.remove('hidden');
    setStatus("Selecciona un episodio:");
});

// ==========================================
// REPRODUCTOR Y LANZADORES EXTERNOS
// ==========================================

async function loadVideo(srv, epNumber) {
    playingTitle.textContent = `${selectedAnime.title} - Ep ${epNumber} [${srv.name}]`;
    
    // Detener instancia previa
    if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
    }
    videoPlayer.src = '';
    videoPlayer.removeAttribute('src');

    // 1. Caso Torrent
    if (srv.torrent) {
        showTorrentOptions(srv);
        return;
    }

    // 2. Directo m3u8 (HLS)
    if (srv.m3u8) {
        playerContainer.classList.remove('hidden');
        setupExternalPlayerButtons(srv.m3u8);
        
        if (Hls.isSupported()) {
            hlsInstance = new Hls();
            hlsInstance.loadSource(srv.m3u8);
            hlsInstance.attachMedia(videoPlayer);
            hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
                videoPlayer.play().catch(err => console.log("Autoplay blocked", err));
            });
            hlsInstance.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal && srv.iframe) {
                    // Fallback a iframe
                    loadIframeFallback(srv.iframe);
                }
            });
        } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
            videoPlayer.src = srv.m3u8;
            videoPlayer.play().catch(err => console.log("Autoplay blocked", err));
        } else if (srv.iframe) {
            loadIframeFallback(srv.iframe);
        }
        return;
    }

    // 3. Directo MP4
    if (srv.mp4) {
        playerContainer.classList.remove('hidden');
        setupExternalPlayerButtons(srv.mp4);
        videoPlayer.src = srv.mp4;
        videoPlayer.play().catch(err => console.log("Autoplay blocked", err));
        return;
    }

    // 4. Iframe normal
    if (srv.iframe) {
        playerContainer.classList.remove('hidden');
        loadIframeFallback(srv.iframe);
        return;
    }
}

function loadIframeFallback(iframeUrl) {
    const useSandbox = blockAdsCheckbox.checked;
    const sandboxAttr = useSandbox ? 'sandbox="allow-scripts allow-same-origin allow-presentation"' : '';
    
    const container = document.getElementById('videoContainer');
    container.innerHTML = `<iframe src="${iframeUrl}" width="100%" height="100%" frameborder="0" allowfullscreen scrolling="no" ${sandboxAttr}></iframe>`;
    
    // Quitar botones de reproductor externo para iframes
    const extBar = document.getElementById('externalPlayerBar');
    if (extBar) extBar.remove();
}

function setupExternalPlayerButtons(videoUrl) {
    // Asegurar que el contenedor tenga el elemento de video nativo
    const container = document.getElementById('videoContainer');
    container.innerHTML = `<video id="videoPlayer" controls></video>`;
    
    // Reasignar variable
    const newPlayer = document.getElementById('videoPlayer');
    
    // Crear barra de botones si no existe
    let extBar = document.getElementById('externalPlayerBar');
    if (!extBar) {
        extBar = document.createElement('div');
        extBar.id = 'externalPlayerBar';
        extBar.style.display = 'flex';
        extBar.style.gap = '8px';
        extBar.style.padding = '10px';
        extBar.style.justifyContent = 'center';
        extBar.style.background = '#111';
        
        const mpvBtn = document.createElement('button');
        mpvBtn.className = 'ext-btn mpv';
        mpvBtn.style.padding = '8px 12px';
        mpvBtn.style.borderRadius = '6px';
        mpvBtn.style.fontSize = '12px';
        mpvBtn.textContent = '⚡ Abrir en MPV';
        mpvBtn.addEventListener('click', () => launchIntent(videoUrl, 'mpv'));

        const vlcBtn = document.createElement('button');
        vlcBtn.className = 'ext-btn vlc';
        vlcBtn.style.padding = '8px 12px';
        vlcBtn.style.borderRadius = '6px';
        vlcBtn.style.fontSize = '12px';
        vlcBtn.textContent = '🧡 Abrir en VLC';
        vlcBtn.addEventListener('click', () => launchIntent(videoUrl, 'vlc'));

        extBar.appendChild(mpvBtn);
        extBar.appendChild(vlcBtn);
        playerContainer.appendChild(extBar);
    }
}

function showTorrentOptions(srv) {
    const container = document.getElementById('videoContainer');
    container.innerHTML = `
        <div class="torrent-card">
            <h3>⚡ Opciones de Torrent</h3>
            <p><strong>${srv.name}</strong></p>
            <p>Has seleccionado un archivo torrent. Se descargará secuencialmente en memoria mediante WebTorrent.</p>
            <div class="external-actions">
                <button id="torrentBrowserBtn" class="ext-btn browser">🌐 Reproducir en Navegador (Lento/Carga en Blob)</button>
                <p style="font-size:10px; color:#ef4444; margin-top:8px;">
                   *Los reproductores externos VLC/MPV no soportan la lectura directa de torrents WebRTC del navegador. Te sugerimos usar "Ver en Navegador" o buscar opciones directas (HLS/MP4).
                </p>
            </div>
            <div id="torrentStatus" style="font-size:12px; color:#9ca3af; margin-top:10px;"></div>
        </div>
    `;

    playerContainer.classList.remove('hidden');
    
    // Quitar barra de reproductor externo si existe
    const extBar = document.getElementById('externalPlayerBar');
    if (extBar) extBar.remove();

    const browserBtn = document.getElementById('torrentBrowserBtn');
    const statusText = document.getElementById('torrentStatus');

    browserBtn.addEventListener('click', async () => {
        statusText.textContent = "Conectando al enjambre de torrents (esto puede demorar)...";
        try {
            const blobUrl = await plugins.nyaa.getVideo(srv, CapacitorHttp);
            statusText.textContent = "¡Torrent listo! Cargando reproductor...";
            
            // Cargar reproductor de video
            container.innerHTML = `<video id="videoPlayer" controls></video>`;
            const p = document.getElementById('videoPlayer');
            p.src = blobUrl;
            p.play();
        } catch (err) {
            statusText.textContent = "Error al descargar el torrent: " + err.message;
        }
    });
}

function launchIntent(url, player) {
    const pkg = player === 'vlc' ? 'org.videolan.vlc' : 'is.xyz.mpv';
    let cleanUrl = url;
    let scheme = 'http';
    
    if (url.startsWith('https://')) {
        scheme = 'https';
        cleanUrl = url.substring(8);
    } else if (url.startsWith('http://')) {
        scheme = 'http';
        cleanUrl = url.substring(7);
    }
    
    const intentUrl = `intent://${cleanUrl}#Intent;scheme=${scheme};package=${pkg};end`;
    
    window.location.href = intentUrl;
}

closePlayerBtn.addEventListener('click', () => {
    playerContainer.classList.add('hidden');
    
    // Restablecer video
    if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
    }
    
    const p = document.getElementById('videoPlayer');
    if (p) {
        p.pause();
        p.src = '';
    }

    const extBar = document.getElementById('externalPlayerBar');
    if (extBar) extBar.remove();
});

setStatus("Escribe tu búsqueda y presiona Buscar.");
