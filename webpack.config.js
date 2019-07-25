module.exports = {
    mode: "development",
    entry: {
        sunburstScript: "./public/js/sunburstScript.js"
    },
    output: {
        filename: "[name]-bundle.js",
        library: "SunburstYo"
    }
}