import { resolveServer } from './resolvers.js';

export default {
    name: "JKanime",

    search: async (query, http) => {
        const url = `https://jkanime.net/buscar/${encodeURIComponent(query)}/1/`;
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
            const items = doc.querySelectorAll('.anime__item');
            const results = [];

            items.forEach(el => {
                const a = el.querySelector('.anime__item__text h5 a');
                if (!a) return;
                const titleText = a.textContent.trim();
                const href = a.getAttribute('href') || '';
                const pic = el.querySelector('.anime__item__pic');
                const image = pic ? pic.getAttribute('data-setbg') : '';
                const parts = href.split('/').filter(p => p);
                const slug = parts[parts.length - 1];
                if (slug && slug !== 'buscar') {
                    results.push({
                        title: titleText,
                        image: image,
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
        // 1. Buscar el slug correcto
        const cleanTitle = animeTitle.replace(/[^0-9a-zA-Z]+/g, ' ').trim();
        const searchResults = await JKanimeSearchHelper(cleanTitle, http);
        if (searchResults.length === 0) return [];
        
        const slug = searchResults[0].slug;
        const url = `https://jkanime.net/${slug}/${ep}/`;
        
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
            
            const servers = [];

            // 1. Extraer servidores internos (Desu, Magi, Desuka)
            const localServers = [];
            doc.querySelectorAll('a').forEach(el => {
                const href = el.getAttribute('href') || '';
                const matchOption = href.match(/^#option(\d+)$/);
                if (matchOption) {
                    const idx = parseInt(matchOption[1]);
                    const name = el.textContent.trim();
                    localServers.push({ index: idx, name: name });
                }
            });

            const videoMap = {};
            doc.querySelectorAll('script').forEach(el => {
                const scriptText = el.textContent || '';
                if (scriptText.includes('video[')) {
                    const lines = scriptText.split('\n');
                    for (const line of lines) {
                        if (line.includes('video[') && line.includes('src=')) {
                            const idxMatch = line.match(/video\[(\d+)\]/);
                            const srcMatch = line.match(/src=["']([^"']+)["']/);
                            if (idxMatch && srcMatch) {
                                videoMap[parseInt(idxMatch[1])] = srcMatch[1];
                            }
                        }
                    }
                }
            });

            localServers.forEach(ls => {
                const srcUrl = videoMap[ls.index];
                if (srcUrl) {
                    servers.push({
                        server: ls.name,
                        url: srcUrl,
                        lang: 'SUB'
                    });
                }
            });

            // 2. Extraer servidores externos (var servers = ...)
            doc.querySelectorAll('script').forEach(el => {
                const scriptText = el.textContent || '';
                if (scriptText.includes('var servers =')) {
                    const match = scriptText.match(/var servers\s*=\s*(\[.*?\]);/);
                    if (match) {
                        try {
                            const parsed = JSON.parse(match[1]);
                            parsed.forEach(s => {
                                let decodedRemote = '';
                                if (s.remote) {
                                    try {
                                        decodedRemote = atob(s.remote).trim();
                                    } catch (b64Err) {
                                        // ignore
                                    }
                                }
                                servers.push({
                                    server: s.server,
                                    url: decodedRemote,
                                    lang: s.lang === 1 ? 'SUB' : 'LAT'
                                });
                            });
                        } catch (e) {
                            // ignore
                        }
                    }
                }
            });

            // Resolviendo los servidores
            const resolvedList = [];
            const activeServers = servers.filter(s => s.lang === 'SUB' && s.server.toLowerCase() !== 'mega' && s.server.toLowerCase() !== 'mediafire');

            for (const s of activeServers) {
                if (s.url) {
                    const directUrl = await resolveServer(s.server, s.url, http);
                    if (directUrl) {
                        const isM3u8 = directUrl.includes('.m3u8');
                        resolvedList.push({
                            name: `JK - ${s.server} (Directo ${isM3u8 ? 'HLS' : 'MP4'})`,
                            m3u8: isM3u8 ? directUrl : null,
                            mp4: !isM3u8 ? directUrl : null,
                            iframe: s.url
                        });
                        continue;
                    }
                }
                resolvedList.push({
                    name: `JK - ${s.server}`,
                    iframe: s.url
                });
            }

            return resolvedList;
        } catch (err) {
            console.error(err);
            return [];
        }
    }
};

async function JKanimeSearchHelper(query, http) {
    const url = `https://jkanime.net/buscar/${encodeURIComponent(query)}/1/`;
    try {
        const response = await http.get({ url });
        const html = response.data;
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const items = doc.querySelectorAll('.anime__item');
        const results = [];
        items.forEach(el => {
            const a = el.querySelector('.anime__item__text h5 a');
            if (!a) return;
            const titleText = a.textContent.trim();
            const href = a.getAttribute('href') || '';
            const parts = href.split('/').filter(p => p);
            const slug = parts[parts.length - 1];
            if (slug && slug !== 'buscar') {
                results.push({ title: titleText, slug: slug });
            }
        });
        return results;
    } catch (e) {
        return [];
    }
}
