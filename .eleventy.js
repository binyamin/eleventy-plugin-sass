const path = require("path");
const fs = require("fs");

const deepmerge = require("deepmerge");
const sass = require("sass");
const cleanCss = require("clean-css");

/**
 * 
 * @param {string} css un-minified css
 * @param {{level: MinifyLevel}} [opts={level: 1}]
 * @returns {string} minified css
 */
function minify(css, opts={ level: 1 }) {
    const cleaner = new cleanCss({
        level: opts.level
    });
    const minified = cleaner.minify(css);
    
    if(!minified.styles) {
        throw minified.errors;
    }
    
    if(minified.errors || minified.warnings) {
        console.error({
            errors: minified.errors,
            warnings: minified.warnings
        });
    }
    
    return minified.styles;
}

/**
 * 
 * @typedef {0|1|2} MinifyLevel See <https://github.com/clean-css/clean-css#optimization-levels>
 * 
 * @todo inline sourcemaps
 * @todo combine dir & file, outDir & outFile
 * 
 * @param {import("@11ty/eleventy/src/UserConfig")} eleventyConfig
 * @param {object} options
 * @param {string} options.dir root directory for sass files
 * @param {string} options.file input path (sass)
 * @param {string} options.outDir output dir, absolute path
 * @param {string} options.outFile output file (css)
 * @param {boolean} [options.sourceMap=true] Generate sourceMaps? `true` means "external", `false` means none
 * @param {boolean|MinifyLevel} [options.minify=true] Run through CleanCSS. You may want to only minify in production
 */
function SassPlugin(eleventyConfig, options) {
    /**
     * @type {Partial<options>}
     */
    const defaultOptions = {
        sourceMap: true,
        minify: true
    }

    options = deepmerge(defaultOptions, options);
    if(options.minify === true) options.minify = 1;

    eleventyConfig.addWatchTarget(options.dir)
    
    eleventyConfig.on("beforeBuild", function() {
        const result = sass.compile(path.join(options.dir, options.file), {
            loadPaths: [ "node_modules" ],
            sourceMap: !!options.sourceMap,
            style: "expanded"
        });

        let css = options.minify !== false ? minify(result.css, { level: options.minify }) : result.css;

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