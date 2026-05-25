import { CapacitorHttp } from '@capacitor/core';
import JKanimePlugin from '../plugins/jkanime.js';
import NyaaPlugin from '../plugins/nyaa.js';
import HanimePlugin from '../plugins/hanime.js';
import AnimeFLVPlugin from '../plugins/animeflv.js';

// Registro de plugins
const plugins = {
    'jkanime': JKanimePlugin,
    'animeflv': AnimeFLVPlugin,
    'nyaa': NyaaPlugin,
    'hanime': HanimePlugin
};

let currentPlugin = 'jkanime';

const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const pluginSelect = document.getElementById('pluginSelect');
const resultsContainer = document.getElementById('resultsContainer');
const playerContainer = document.getElementById('playerContainer');
const videoPlayer = document.getElementById('videoPlayer');
const closePlayerBtn = document.getElementById('closePlayerBtn');

// Inicializar selector de plugins
Object.keys(plugins).forEach(key => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = plugins[key].name;
    pluginSelect.appendChild(option);
});

pluginSelect.addEventListener('change', (e) => {
    currentPlugin = e.target.value;
});

// Búsqueda
searchBtn.addEventListener('click', async () => {
    const query = searchInput.value;
    if (!query) return;

    resultsContainer.innerHTML = '<p>Buscando...</p>';
    
    try {
        const plugin = plugins[currentPlugin];
        const results = await plugin.search(query, CapacitorHttp);
        
        resultsContainer.innerHTML = '';
        if (results.length === 0) {
            resultsContainer.innerHTML = '<p>No se encontraron resultados.</p>';
            return;
        }

        results.forEach(item => {
            const card = document.createElement('div');
            card.className = 'anime-card';
            card.innerHTML = `
                <img src="${item.image}" alt="${item.title}">
                <h3>${item.title}</h3>
            `;
            card.addEventListener('click', () => loadVideo(item));
            resultsContainer.appendChild(card);
        });
    } catch (error) {
        resultsContainer.innerHTML = `<p>Error: ${error.message}</p>`;
    }
});

async function loadVideo(item) {
    try {
        const plugin = plugins[currentPlugin];
        // En un caso real, el plugin obtendría el enlace directo mp4 o magnet
        const videoUrl = await plugin.getVideo(item, CapacitorHttp);
        
        playerContainer.classList.remove('hidden');
        videoPlayer.src = videoUrl;
        videoPlayer.play();
    } catch (error) {
        alert('Error al cargar el video: ' + error.message);
    }
}

closePlayerBtn.addEventListener('click', () => {
    playerContainer.classList.add('hidden');
    videoPlayer.pause();
    videoPlayer.src = '';
});
