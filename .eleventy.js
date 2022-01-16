const path = require("path");
const fs = require("fs");

const deepmerge = require("deepmerge");
const sass = require("sass");
const cleanCss = require("clean-css");

/**
 * Write CSS to file-system, and sourceMap if passed
 * 
 * @param {object} opts
 * @param {string} opts.dir
 * @param {string} opts.file
 * @param {string} opts.css
 * @param {string} [opts.sourceMap]
 */
function write(opts) {
    try {
        fs.accessSync(opts.dir)
    } catch(error) {
        if(error.code === "ENOENT") {
            fs.mkdirSync(opts.dir, { recursive: true })
        } else {
            throw error;
        }
    }

    if(opts.sourceMap) {
        fs.writeFileSync(path.join(opts.dir, opts.file + ".map"), opts.sourceMap, 'utf-8');
        opts.css += `\n/*# sourceMappingURL=${opts.file}.map */`;
    }

    fs.writeFileSync(path.join(opts.dir, opts.file), opts.css, 'utf-8');
}

/**
 * Minify CSS
 * 
 * @param {string} css - CSS to minify
 * @param {object} opts
 * @param {MinifyLevel} opts.level
 * @param {string} [opts.sourceMap]
 * @param {string} [opts.sourceMapDir] - required if `opts.sourceMap` is passed
 */
function minify(css, opts){
    // [1] Initialize Clean-CSS
    const cleaner = new cleanCss({
        level: opts.minify,
        ...(opts.sourceMap ? {
            sourceMap: true,
            rebaseTo: opts.sourceMapDir
        } : {})
    });
    
    // [2] Minify CSS
    const minified = opts.sourceMap ? cleaner.minify(css, opts.sourceMap) : cleaner.minify(css);

    // [3] Error Handling
    if(!minified.styles) {
        throw minified.errors;
    }
    
    if(minified.errors.length > 0 || minified.warnings.length > 0) {
        console.error({
            errors: minified.errors,
            warnings: minified.warnings
        });
    }

    return {
        styles: minified.styles,
        sourceMap: minified.sourceMap?.toString()
    }
}

/**
 * Compile sass/scss
 * 
 * @param {string} filePath
 * @param {{emitSourceMap: boolean}} [opts={emitSourceMap: false}] 
 * @returns {css: string, sourceMap ?: string}
 */
function compile(filePath, opts) {
    const result = sass.compile(filePath, {
        loadPaths: [ "node_modules" ],
        style: "expanded",
        ...(opts.emitSourceMap ? {
            sourceMap: true,
        }: {})
    });

    return {
        css: result.css,
        sourceMap: opts.emitSourceMap ? JSON.stringify({
            ...result.sourceMap,
            file: path.basename(filePath)
        }) : ""
    };
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
        let {css, sourceMap} = compile(path.join(options.dir, options.file), {
            emitSourceMap: options.sourceMap
        });

        // NOTE: options.minify could be `0`, and still be valid
        if(options.minify !== false) {
            const res = minify(css, {
                level: options.minify,
                ...(options.sourceMap ? {
                    sourceMap: sourceMap,
                    sourceMapDir: options.outDir
                }: {})
            });
            
            css = res.styles;
            sourceMap = res.sourceMap;
        }

        write({
            dir: options.outDir,
            file: options.outFile,
            css,
            ...(options.sourceMap ? { sourceMap }: {})
        });
    })

}

module.exports = SassPlugin;