module.exports = {
    mode: "development",
    entry: {
        sunburstScript: "./lib/page/sunburstScript.js"
    },
    output: {
        filename: "[name]-bundle.js",
        library: "SunburstYo"
    }
}