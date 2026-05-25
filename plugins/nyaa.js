import WebTorrent from 'webtorrent/dist/webtorrent.min.js';

const client = new WebTorrent();

// Nyaa Plugin (Torrents)
export default {
    name: "Nyaa (Torrents)",
    
    search: async (query, http) => {
        // Buscamos en Nyaa (puede requerir parseo de RSS o HTML)
        const options = {
            url: `https://nyaa.si/?page=rss&q=${encodeURIComponent(query)}&c=1_2&f=0`,
        };
        
        try {
            const response = await http.get(options);
            // Simulación de resultados RSS parseados
            return [
                {
                    title: "[Subs] Ejemplo Nyaa Torrent",
                    image: "https://via.placeholder.com/200x300?text=Torrent",
                    magnet: "magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel" // Sintel de prueba
                }
            ];
        } catch (e) {
            return [];
        }
    },

    getVideo: async (item, http) => {
        return new Promise((resolve, reject) => {
            client.add(item.magnet, (torrent) => {
                const file = torrent.files.find(f => f.name.endsWith('.mp4') || f.name.endsWith('.mkv'));
                if (file) {
                    // En un navegador/Capacitor web no podemos montar un servidor local fácilmente para MP4
                    // File.getBlobURL es la forma nativa de webtorrent en el navegador
                    file.getBlobURL((err, url) => {
                        if (err) reject(err);
                        else resolve(url);
                    });
                } else {
                    reject(new Error("No se encontró video compatible en el torrent"));
                }
            });
            torrent.on('error', (err) => reject(err));
        });
    }
};
