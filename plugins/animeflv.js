// AnimeFLV Plugin
export default {
    name: "AnimeFLV",
    
    search: async (query, http) => {
        const options = {
            url: `https://www3.animeflv.net/browse?q=${encodeURIComponent(query)}`,
        };
        
        const response = await http.get(options);
        return [
            {
                title: "Ejemplo AnimeFLV " + query,
                image: "https://via.placeholder.com/200x300",
                url: "/ejemplo/"
            }
        ];
    },

    getVideo: async (item, http) => {
        return "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4"; // video de prueba
    }
};
