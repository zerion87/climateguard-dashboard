  
module.exports = function(eleventyConfig) {
    eleventyConfig.addPassthroughCopy("src/styles");
    eleventyConfig.addPassthroughCopy("src/leaflet");
    eleventyConfig.addPassthroughCopy("src/scripts");
    return {
      dir: {
        input: "src",
        includes: "includes",
        output: "_site"
      }
    };
  };
  
