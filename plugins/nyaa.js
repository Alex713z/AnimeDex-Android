import WebTorrent from 'webtorrent/dist/webtorrent.min.js';

let client = null;
function getTorrentClient() {
    if (!client) {
        client = new WebTorrent();
    }
    return client;
}

export default {
    name: "Nyaa (Torrents)",

    search: async (query, http) => {
        // Buscamos torrents subtitulados
        const url = `https://nyaa.si/?page=rss&q=${encodeURIComponent(query)}&c=1_2&f=0`;
        try {
            const response = await http.get({
                url,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(response.data, 'text/xml');
            const items = xmlDoc.getElementsByTagName('item');
            const results = [];

            for (let i = 0; i < Math.min(items.length, 12); i++) {
                const item = items[i];
                const title = item.getElementsByTagName('title')[0]?.textContent || 'Sin título';
                const magnet = item.getElementsByTagName('link')[0]?.textContent || '';
                
                // Extraer seeders y size (tienen namespace nyaa:seeders, nyaa:size)
                const seeders = item.getElementsByTagName('nyaa:seeders')[0]?.textContent || 
                                item.getElementsByTagName('seeders')[0]?.textContent || 
                                '0';
                const size = item.getElementsByTagName('nyaa:size')[0]?.textContent || 
                             item.getElementsByTagName('size')[0]?.textContent || 
                             'Desconocido';

                if (magnet.startsWith('magnet:')) {
                    results.push({
                        title: title,
                        image: 'https://via.placeholder.com/200x300?text=Torrent+HD',
                        magnet: magnet,
                        seeders: parseInt(seeders),
                        size: size
                    });
                }
            }
            return results;
        } catch (e) {
            console.error(e);
            return [];
        }
    },

    getServers: async (animeTitle, ep, http) => {
        // En Nyaa, buscamos el torrent específico para el episodio
        const cleanTitle = animeTitle.replace(/[^0-9a-zA-Z]+/g, ' ').trim();
        const paddedEp = String(ep).padStart(2, '0');
        
        // Probamos buscar con número de capítulo con ceros a la izquierda y normal
        const queries = [
            `"${cleanTitle}" ${paddedEp}`,
            `"${cleanTitle}" ${ep}`
        ];

        const allResults = [];
        const wt = getTorrentClient();

        // Limpiar errores del cliente anterior
        wt.removeAllListeners('error');
        wt.on('error', (err) => {
            console.error('[WebTorrent Global Error]', err.message);
        });

        for (const q of queries) {
            const url = `https://nyaa.si/?page=rss&q=${encodeURIComponent(q)}&c=1_2&f=0`;
            try {
                const response = await http.get({ url });
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(response.data, 'text/xml');
                const items = xmlDoc.getElementsByTagName('item');
                
                for (let i = 0; i < Math.min(items.length, 5); i++) {
                    const item = items[i];
                    const title = item.getElementsByTagName('title')[0]?.textContent || 'Sin título';
                    const magnet = item.getElementsByTagName('link')[0]?.textContent || '';
                    const seeders = item.getElementsByTagName('nyaa:seeders')[0]?.textContent || '0';
                    const size = item.getElementsByTagName('nyaa:size')[0]?.textContent || 'Desconocido';

                    if (magnet.startsWith('magnet:') && parseInt(seeders) >= 2) {
                        allResults.push({
                            title,
                            magnet,
                            seeders: parseInt(seeders),
                            size
                        });
                    }
                }
                if (allResults.length > 0) break; // Si encontramos con la primera query, paramos
            } catch (e) {
                console.error(e);
            }
        }

        // Convertir resultados de Torrent en formato de Servidores para la interfaz
        const serversList = [];
        allResults.sort((a, b) => b.seeders - a.seeders).slice(0, 5).forEach(t => {
            const lowerTitle = t.title.toLowerCase();
            const isSpanish = lowerTitle.includes('esp') || lowerTitle.includes('spa') || lowerTitle.includes('sub español') || lowerTitle.includes('multi') || lowerTitle.includes('erai-raws') || lowerTitle.includes('puya');
            const tag = isSpanish ? '[ESP/MULTI]' : '[ENG/RAW]';
            
            serversList.push({
                name: `NYAA - ${tag} ${t.title} (${t.size}, Seeds: ${t.seeders})`,
                torrent: t.magnet,
                title: t.title
            });
        });

        return serversList;
    },

    getVideo: async (item, http) => {
        // Resolver y reproducir usando WebTorrent en navegador (como blob)
        const wt = getTorrentClient();
        return new Promise((resolve, reject) => {
            let torrent = wt.get(item.magnet);
            if (!torrent) {
                torrent = wt.add(item.magnet);
            }

            const checkTorrent = (t) => {
                const file = t.files.find(f => f.name.endsWith('.mp4') || f.name.endsWith('.mkv'));
                if (file) {
                    file.getBlobURL((err, url) => {
                        if (err) reject(err);
                        else resolve(url);
                    });
                } else {
                    reject(new Error("No se encontró video compatible (.mp4, .mkv) en el torrent"));
                }
            };

            if (torrent.ready) {
                checkTorrent(torrent);
            } else {
                torrent.once('ready', () => checkTorrent(torrent));
                torrent.on('error', (err) => reject(err));
            }
        });
    }
};
