// Hanime Plugin (+18)
export default {
    name: "Hanime (+18)",
    
    search: async (query, http) => {
        const options = {
            url: `https://hw.hanime.tv/api/v8/video?id=${encodeURIComponent(query)}`,
            headers: { 'Content-Type': 'application/json' }
        };
        
        try {
            const response = await http.get(options);
            // ... lógica de parseo ...
            return [
                {
                    title: "Ejemplo Hanime",
                    image: "https://via.placeholder.com/200x300",
                    url: "example"
                }
            ];
        } catch (e) {
            return [];
        }
    },

    getVideo: async (item, http) => {
        return "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4"; // video de prueba
    }
};
