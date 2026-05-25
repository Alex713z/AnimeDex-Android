import { resolveServer } from './resolvers.js';

export default {
    name: "AnimeFLV",

    search: async (query, http) => {
        const url = `https://www3.animeflv.net/browse?q=${encodeURIComponent(query)}`;
        try {
            const response = await http.get({
                url,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            const html = response.data;
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const items = doc.querySelectorAll('.ListAnimes li article.Anime');
            const results = [];

            items.forEach(el => {
                const a = el.querySelector('a');
                if (!a) return;
                const href = a.getAttribute('href') || '';
                const title = el.querySelector('.Title')?.textContent.trim() || 'Sin título';
                const imageEl = el.querySelector('.Image img');
                const image = imageEl ? (imageEl.getAttribute('src') || imageEl.getAttribute('data-src')) : '';
                
                const parts = href.split('/').filter(p => p);
                const slug = parts[parts.length - 1];
                
                if (slug) {
                    // Completar la URL de la imagen si es relativa
                    let fullImage = image;
                    if (image && image.startsWith('/')) {
                        fullImage = 'https://www3.animeflv.net' + image;
                    }
                    results.push({
                        title: title,
                        image: fullImage,
                        slug: slug
                    });
                }
            });
            return results;
        } catch (e) {
            console.error(e);
            return [];
        }
    },

    getServers: async (animeTitle, ep, http) => {
        // 1. Buscar el anime para conseguir el slug
        const cleanTitle = animeTitle.replace(/[^0-9a-zA-Z]+/g, ' ').trim();
        const searchResults = await AnimeFLVSearchHelper(cleanTitle, http);
        if (searchResults.length === 0) return [];

        const slug = searchResults[0].slug;
        const url = `https://www3.animeflv.net/ver/${slug}-${ep}`;
        
        try {
            const response = await http.get({
                url,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            const html = response.data;
            const videosMatch = html.match(/var videos\s*=\s*(\{.*?\});/);
            if (!videosMatch) return [];

            const videosObj = JSON.parse(videosMatch[1]);
            const subList = videosObj.SUB || [];
            const resolvedList = [];

            for (const s of subList) {
                if (s.server === 'mega' || s.server === 'mediafire') continue;
                const serverName = s.title || s.server.toUpperCase();
                
                if (s.code) {
                    // El s.code en AnimeFLV suele ser la URL de incrustar (iframe)
                    const directUrl = await resolveServer(s.server, s.code, http);
                    if (directUrl) {
                        const isM3u8 = directUrl.includes('.m3u8');
                        resolvedList.push({
                            name: `FLV - ${serverName} (Directo ${isM3u8 ? 'HLS' : 'MP4'})`,
                            m3u8: isM3u8 ? directUrl : null,
                            mp4: !isM3u8 ? directUrl : null,
                            iframe: s.code
                        });
                        continue;
                    }
                }

                // Servidor normal iframe fallback
                resolvedList.push({
                    name: `FLV - ${serverName}`,
                    iframe: s.code
                });
            }

            return resolvedList;
        } catch (e) {
            console.error(e);
            return [];
        }
    }
};

async function AnimeFLVSearchHelper(query, http) {
    const url = `https://www3.animeflv.net/browse?q=${encodeURIComponent(query)}`;
    try {
        const response = await http.get({ url });
        const doc = new DOMParser().parseFromString(response.data, 'text/html');
        const items = doc.querySelectorAll('.ListAnimes li article.Anime');
        const results = [];
        items.forEach(el => {
            const a = el.querySelector('a');
            if (!a) return;
            const href = a.getAttribute('href') || '';
            const title = el.querySelector('.Title')?.textContent.trim() || 'Sin título';
            const parts = href.split('/').filter(p => p);
            const slug = parts[parts.length - 1];
            if (slug) {
                results.push({ title, slug });
            }
        });
        return results;
    } catch (e) {
        return [];
    }
}
