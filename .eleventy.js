const path = require("path");
const fs = require("fs");

const deepmerge = require("deepmerge");
const sass = require("sass");
const cleanCss = require("clean-css");

function minify(css) {
    const cleaner = new cleanCss();
    const minified = cleaner.minify(css);
    if(!minified.styles) throw minified.errors;
    else return minified.styles;
}

/**
 * 
 * @todo inline sourcemaps
 * 
 * @param {import("@11ty/eleventy/src/UserConfig")} eleventyConfig
 * @param {object} options
 * @param {string} options.dir root directory for sass files
 * @param {string} options.file input path (sass)
 * @param {string} options.outDir output dir, absolute path
 * @param {string} options.outFile output file (css)
 * @param {boolean} [options.sourceMap=true] Generate sourceMaps? `true` means "external", `false` means none
 * @param {boolean} [options.minify=true] Run through CleanCSS. You may want to only minify in production
 */
function SassPlugin(eleventyConfig, options) {
    const defaultOptions = {
        sourceMap: true,
        minify: true
    }

    options = deepmerge(defaultOptions, options);

    eleventyConfig.addWatchTarget(options.dir)
    
    eleventyConfig.on("beforeBuild", function() {
        const result = sass.compile(path.join(options.dir, options.file), {
            loadPaths: [ "node_modules" ],
            sourceMap: !!options.sourceMap,
            style: "expanded"
        });

        let css = options.minify ? minify(result.css) : result.css;

        try {
            fs.accessSync(options.outDir)
        } catch(error) {
            if(error.code === "ENOENT") {
                fs.mkdirSync(options.outDir, { recursive: true })
            } else {
                throw error;
            }
        }
        if(result.sourceMap && options.sourceMap) {
            css += `\n/*# sourceMappingURL=${options.outFile}.map */`
            fs.writeFileSync(
                path.join(options.outDir, options.outFile + ".map"),
                JSON.stringify({...result.sourceMap, file: options.outFile}),
                'utf-8'
            );
        }
        fs.writeFileSync(path.join(options.outDir, options.outFile), css, 'utf-8')
    })

}

module.exports = SassPlugin;