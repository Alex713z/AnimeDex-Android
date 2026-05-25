export default {
    name: "Hanime (+18)",

    search: async (query, http) => {
        const url = 'https://search.htv-services.com/';
        try {
            const response = await http.post({
                url,
                data: {
                    search_text: query,
                    blacklist: [],
                    brands: [],
                    order_by: 'views',
                    ordering: 'desc',
                    page: 0,
                    tags: [],
                    tags_mode: 'AND'
                },
                headers: {
                    'Content-Type': 'application/json;charset=UTF-8'
                }
            });

            // Parse response (contains stringified JSON in hits)
            const data = response.data;
            const hits = JSON.parse(data.hits) || [];
            
            return hits.map(hit => ({
                title: hit.name,
                image: hit.poster_url || hit.cover_url,
                slug: hit.slug,
                isHentai: true
            }));
        } catch (e) {
            console.error(e);
            return [];
        }
    },

    getServers: async (animeTitle, ep, http, slug) => {
        // En Hanime, el item ya viene con el slug
        if (!slug) {
            // Fallback: intentar buscar por titulo para obtener slug
            const searchResults = await searchHanimeHelper(animeTitle, http);
            if (searchResults.length === 0) return [];
            slug = searchResults[0].slug;
        }

        try {
            const watchUrl = `https://hanime.tv/videos/hentai/${slug}`;
            const pageRes = await http.get({
                url: watchUrl,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            const html = pageRes.data;
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            let jsMetadata = '';
            doc.querySelectorAll('script').forEach(el => {
                const text = el.textContent || '';
                if (text.includes('window.__NUXT__')) {
                    jsMetadata = text;
                }
            });

            if (!jsMetadata) return [];

            // Ejecutar NUXT script en sandbox para extraer estado
            const sandboxNuxt = { window: {} };
            const runNuxt = new Function('window', jsMetadata);
            runNuxt(sandboxNuxt.window);
            const nuxtObj = sandboxNuxt.window.__NUXT__;

            if (!nuxtObj || !nuxtObj.state || !nuxtObj.state.data || !nuxtObj.state.data.video || !nuxtObj.state.data.video.hentai_video) {
                return [];
            }

            const videoInfo = nuxtObj.state.data.video.hentai_video;
            const videoId = videoInfo.id;

            let vendorUrl = '';
            doc.querySelectorAll('script').forEach(el => {
                const src = el.getAttribute('src') || '';
                if (src.includes('hanime-cdn.com/js/vendor.')) {
                    vendorUrl = src;
                }
            });

            if (!vendorUrl) {
                const match = html.match(/<script.*src="(https:\/\/hanime-cdn\.com\/js\/vendor\.[^"]+)"/);
                if (match) vendorUrl = match[1];
            }

            if (!vendorUrl) return [];

            // Descargar script vendor
            const vendorRes = await http.get({
                url: vendorUrl,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://hanime.tv/'
                }
            });

            let ssignature = '';
            let stime = '';

            const windowObj = {};
            const windowProxy = new Proxy(windowObj, {
                set(target, prop, value) {
                    if (prop === 'ssignature') ssignature = value;
                    if (prop === 'stime') stime = value;
                    target[prop] = value;
                    return true;
                },
                get(target, prop) {
                    if (prop === 'top') return { location: { origin: 'https://hanime.tv' } };
                    if (prop === 'addEventListener') return () => {};
                    return target[prop];
                }
            });

            const runVendor = new Function('window', 'globalThis', vendorRes.data);
            runVendor(windowProxy, { window: windowProxy });

            // Esperar firma (suele ser inmediato)
            for (let attempt = 0; attempt < 10; attempt++) {
                if (ssignature && stime) break;
                await new Promise(r => setTimeout(r, 50));
            }

            if (!ssignature || !stime) return [];

            // Consultar manifest
            const manifestUrl = `https://h.freeanimehentai.net/api/v8/guest/videos/${videoId}/manifest`;
            const manifestRes = await http.get({
                url: manifestUrl,
                headers: {
                    'Accept': 'application/json',
                    'Origin': 'https://hanime.tv',
                    'Referer': 'https://hanime.tv/',
                    'X-Signature': ssignature,
                    'X-Time': stime,
                    'X-Signature-Version': 'web2',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            const resolvedList = [];
            if (manifestRes.data && manifestRes.data.videos_manifest && manifestRes.data.videos_manifest.servers) {
                for (const server of manifestRes.data.videos_manifest.servers) {
                    if (server.streams) {
                        for (const stream of server.streams) {
                            if (stream.url && stream.url.includes('.m3u8')) {
                                resolvedList.push({
                                    name: `Hanime - Shiva (${stream.height}p)`,
                                    m3u8: stream.url
                                });
                            }
                        }
                    }
                }
            }

            return resolvedList;
        } catch (e) {
            console.error(e);
            return [];
        }
    }
};

async function searchHanimeHelper(query, http) {
    try {
        const response = await http.post({
            url: 'https://search.htv-services.com/',
            data: {
                search_text: query,
                blacklist: [],
                brands: [],
                order_by: 'views',
                ordering: 'desc',
                page: 0,
                tags: [],
                tags_mode: 'AND'
            }
        });
        const hits = JSON.parse(response.data.hits) || [];
        return hits.map(hit => ({ slug: hit.slug }));
    } catch (e) {
        return [];
    }
}
