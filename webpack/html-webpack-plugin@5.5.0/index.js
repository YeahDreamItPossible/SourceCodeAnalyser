'use strict';

const promisify = require('util').promisify;

const vm = require('vm');
const fs = require('fs');
const _ = require('lodash');
const path = require('path');
const { CachedChildCompilation } = require('./lib/cached-child-compiler');

const { createHtmlTagObject, htmlTagObjectToString, HtmlTagArray } = require('./lib/html-tags');

const prettyError = require('./lib/errors.js');
const chunkSorter = require('./lib/chunksorter.js');
const getHtmlWebpackPluginHooks = require('./lib/hooks.js').getHtmlWebpackPluginHooks;
const { assert } = require('console');

const fsReadFileAsync = promisify(fs.readFile);

class HtmlWebpackPlugin {
  constructor (options) {
    this.userOptions = options || {};
    this.version = HtmlWebpackPlugin.version;
  }

  apply (compiler) {
    compiler.hooks.initialize.tap('HtmlWebpackPlugin', () => {
      const userOptions = this.userOptions;

      const defaultOptions = {
        template: 'auto',
        templateContent: false,
        templateParameters: templateParametersGenerator,
        filename: 'index.html',
        publicPath: userOptions.publicPath === undefined ? 'auto' : userOptions.publicPath,
        hash: false,
        inject: userOptions.scriptLoading === 'blocking' ? 'body' : 'head',
        scriptLoading: 'defer',
        compile: true,
        favicon: false,
        minify: 'auto',
        cache: true,
        showErrors: true,
        chunks: 'all',
        excludeChunks: [],
        chunksSortMode: 'auto',
        meta: {},
        base: false,
        title: 'Webpack App',
        xhtml: false
      };

      const options = Object.assign(defaultOptions, userOptions);
      this.options = options;

      assert(options.scriptLoading === 'defer' || options.scriptLoading === 'blocking' || options.scriptLoading === 'module', 'scriptLoading needs to be set to "defer", "blocking" or "module"');
      assert(options.inject === true || options.inject === false || options.inject === 'head' || options.inject === 'body', 'inject needs to be set to true, false, "head" or "body');

      // 
      if (!userOptions.template && options.templateContent === false && options.meta) {
        const defaultMeta = {
          viewport: 'width=device-width, initial-scale=1'
        };
        options.meta = Object.assign({}, options.meta, defaultMeta, userOptions.meta);
      }

      const userOptionFilename = userOptions.filename || defaultOptions.filename;
      const filenameFunction = typeof userOptionFilename === 'function'
        ? userOptionFilename
        : (entryName) => userOptionFilename.replace(/\[name\]/g, entryName);

      const entryNames = Object.keys(compiler.options.entry);
      const outputFileNames = new Set((entryNames.length ? entryNames : ['main']).map(filenameFunction));

      const entryOptions = Array.from(outputFileNames).map((filename) => ({
        ...options,
        filename
      }));

      entryOptions.forEach((instanceOptions) => {
        hookIntoCompiler(compiler, instanceOptions, this);
      });
    });
  }

  evaluateCompilationResult (source, publicPath, templateFilename) {
    if (!source) {
      return Promise.reject(new Error('The child compilation didn\'t provide a result'));
    }
    // The LibraryTemplatePlugin stores the template result in a local variable.
    // By adding it to the end the value gets extracted during evaluation
    if (source.indexOf('HTML_WEBPACK_PLUGIN_RESULT') >= 0) {
      source += ';\nHTML_WEBPACK_PLUGIN_RESULT';
    }
    const templateWithoutLoaders = templateFilename.replace(/^.+!/, '').replace(/\?.+$/, '');
    const vmContext = vm.createContext({
      ...global,
      HTML_WEBPACK_PLUGIN: true,
      require: require,
      htmlWebpackPluginPublicPath: publicPath,
      URL: require('url').URL,
      __filename: templateWithoutLoaders
    });
    const vmScript = new vm.Script(source, { filename: templateWithoutLoaders });
    // Evaluate code and cast to string
    let newSource;
    try {
      newSource = vmScript.runInContext(vmContext);
    } catch (e) {
      return Promise.reject(e);
    }
    if (typeof newSource === 'object' && newSource.__esModule && newSource.default) {
      newSource = newSource.default;
    }
    return typeof newSource === 'string' || typeof newSource === 'function'
      ? Promise.resolve(newSource)
      : Promise.reject(new Error('The loader "' + templateWithoutLoaders + '" didn\'t return html.'));
  }
}

function hookIntoCompiler (compiler, options, plugin) {
  const webpack = compiler.webpack;
  
  let assetJson;
  
  // Array<{html: string, name: string}>
  let previousEmittedAssets = [];

  options.template = getFullTemplatePath(options.template, compiler.context);

  // Inject child compiler plugin
  const childCompilerPlugin = new CachedChildCompilation(compiler);
  if (!options.templateContent) {
    childCompilerPlugin.addEntry(options.template);
  }

  // convert absolute filename into relative so that webpack can
  // generate it at correct location
  const filename = options.filename;
  if (path.resolve(filename) === path.normalize(filename)) {
    const outputPath = (compiler.options.output.path);
    options.filename = path.relative(outputPath, filename);
  }

  const isProductionLikeMode = compiler.options.mode === 'production' || !compiler.options.mode;

  const minify = options.minify;
  if (minify === true || (minify === 'auto' && isProductionLikeMode)) {
    options.minify = {
      collapseWhitespace: true,
      keepClosingSlash: true,
      removeComments: true,
      removeRedundantAttributes: true,
      removeScriptTypeAttributes: true,
      removeStyleLinkTypeAttributes: true,
      useShortDoctype: true
    };
  }

  compiler.hooks.thisCompilation.tap('HtmlWebpackPlugin',
    (compilation) => {
      compilation.hooks.processAssets.tapAsync(
        {
          name: 'HtmlWebpackPlugin',
          stage:
          webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE
        },
        (compilationAssets, callback) => {
          // Get all entry point names for this html file
          const entryNames = Array.from(compilation.entrypoints.keys());
          const filteredEntryNames = filterChunks(entryNames, options.chunks, options.excludeChunks);
          const sortedEntryNames = sortEntryChunks(filteredEntryNames, options.chunksSortMode, compilation);

          const templateResult = options.templateContent
            ? { mainCompilationHash: compilation.hash }
            : childCompilerPlugin.getCompilationEntryResult(options.template);

          if ('error' in templateResult) {
            compilation.errors.push(prettyError(templateResult.error, compiler.context).toString());
          }

          // If the child compilation was not executed during a previous main compile run
          // it is a cached result
          const isCompilationCached = templateResult.mainCompilationHash !== compilation.hash;

          /** The public path used inside the html file */
          const htmlPublicPath = getPublicPath(compilation, options.filename, options.publicPath);

          /** Generated file paths from the entry point names */
          const assets = htmlWebpackPluginAssets(compilation, sortedEntryNames, htmlPublicPath);

          // If the template and the assets did not change we don't have to emit the html
          const newAssetJson = JSON.stringify(getAssetFiles(assets));
          if (isCompilationCached && options.cache && assetJson === newAssetJson) {
            previousEmittedAssets.forEach(({ name, html }) => {
              compilation.emitAsset(name, new webpack.sources.RawSource(html, false));
            });
            return callback();
          } else {
            previousEmittedAssets = [];
            assetJson = newAssetJson;
          }

          // The html-webpack plugin uses a object representation for the html-tags which will be injected
          // to allow altering them more easily
          // Just before they are converted a third-party-plugin author might change the order and content
          const assetsPromise = getFaviconPublicPath(options.favicon, compilation, assets.publicPath)
            .then((faviconPath) => {
              assets.favicon = faviconPath;
              return getHtmlWebpackPluginHooks(compilation).beforeAssetTagGeneration.promise({
                assets: assets,
                outputName: options.filename,
                plugin: plugin
              });
            });

          // Turn the js and css paths into grouped HtmlTagObjects
          const assetTagGroupsPromise = assetsPromise
          // And allow third-party-plugin authors to reorder and change the assetTags before they are grouped
            .then(({ assets }) => getHtmlWebpackPluginHooks(compilation).alterAssetTags.promise({
              assetTags: {
                scripts: generatedScriptTags(assets.js),
                styles: generateStyleTags(assets.css),
                meta: [
                  ...generateBaseTag(options.base),
                  ...generatedMetaTags(options.meta),
                  ...generateFaviconTags(assets.favicon)
                ]
              },
              outputName: options.filename,
              publicPath: htmlPublicPath,
              plugin: plugin
            }))
            .then(({ assetTags }) => {
              // Inject scripts to body unless it set explicitly to head
              const scriptTarget = options.inject === 'head' ||
                (options.inject !== 'body' && options.scriptLoading !== 'blocking') ? 'head' : 'body';
              // Group assets to `head` and `body` tag arrays
              const assetGroups = generateAssetGroups(assetTags, scriptTarget);
              // Allow third-party-plugin authors to reorder and change the assetTags once they are grouped
              return getHtmlWebpackPluginHooks(compilation).alterAssetTagGroups.promise({
                headTags: assetGroups.headTags,
                bodyTags: assetGroups.bodyTags,
                outputName: options.filename,
                publicPath: htmlPublicPath,
                plugin: plugin
              });
            });

          // Turn the compiled template into a nodejs function or into a nodejs string
          const templateEvaluationPromise = Promise.resolve()
            .then(() => {
              if ('error' in templateResult) {
                return options.showErrors ? prettyError(templateResult.error, compiler.context).toHtml() : 'ERROR';
              }
              // Allow to use a custom function / string instead
              if (options.templateContent !== false) {
                return options.templateContent;
              }
              // Once everything is compiled evaluate the html factory
              // and replace it with its content
              return ('compiledEntry' in templateResult)
                ? plugin.evaluateCompilationResult(templateResult.compiledEntry.content, htmlPublicPath, options.template)
                : Promise.reject(new Error('Child compilation contained no compiledEntry'));
            });
          const templateExectutionPromise = Promise.all([assetsPromise, assetTagGroupsPromise, templateEvaluationPromise])
            .then(([assetsHookResult, assetTags, compilationResult]) => typeof compilationResult !== 'function'
              ? compilationResult
              : executeTemplate(compilationResult, assetsHookResult.assets, { headTags: assetTags.headTags, bodyTags: assetTags.bodyTags }, compilation));

          const injectedHtmlPromise = Promise.all([assetTagGroupsPromise, templateExectutionPromise])
          // Allow plugins to change the html before assets are injected
            .then(([assetTags, html]) => {
              const pluginArgs = { html, headTags: assetTags.headTags, bodyTags: assetTags.bodyTags, plugin: plugin, outputName: options.filename };
              return getHtmlWebpackPluginHooks(compilation).afterTemplateExecution.promise(pluginArgs);
            })
            .then(({ html, headTags, bodyTags }) => {
              return postProcessHtml(html, assets, { headTags, bodyTags });
            });

          const emitHtmlPromise = injectedHtmlPromise
          // Allow plugins to change the html after assets are injected
            .then((html) => {
              const pluginArgs = { html, plugin: plugin, outputName: options.filename };
              return getHtmlWebpackPluginHooks(compilation).beforeEmit.promise(pluginArgs)
                .then(result => result.html);
            })
            .catch(err => {
              // In case anything went wrong the promise is resolved
              // with the error message and an error is logged
              compilation.errors.push(prettyError(err, compiler.context).toString());
              return options.showErrors ? prettyError(err, compiler.context).toHtml() : 'ERROR';
            })
            .then(html => {
              const filename = options.filename.replace(/\[templatehash([^\]]*)\]/g, require('util').deprecate(
                (match, options) => `[contenthash${options}]`,
                '[templatehash] is now [contenthash]')
              );
              const replacedFilename = replacePlaceholdersInFilename(filename, html, compilation);
              // Add the evaluated html code to the webpack assets
              compilation.emitAsset(replacedFilename.path, new webpack.sources.RawSource(html, false), replacedFilename.info);
              previousEmittedAssets.push({ name: replacedFilename.path, html });
              return replacedFilename.path;
            })
            .then((finalOutputName) => getHtmlWebpackPluginHooks(compilation).afterEmit.promise({
              outputName: finalOutputName,
              plugin: plugin
            }).catch(err => {
              console.error(err);
              return null;
            }).then(() => null));

          // Once all files are added to the webpack compilation
          // let the webpack compiler continue
          emitHtmlPromise.then(() => {
            callback();
          });
        });
    });

  function getTemplateParameters (compilation, assets, assetTags) {
    const templateParameters = options.templateParameters;
    if (templateParameters === false) {
      return Promise.resolve({});
    }
    if (typeof templateParameters !== 'function' && typeof templateParameters !== 'object') {
      throw new Error('templateParameters has to be either a function or an object');
    }
    const templateParameterFunction = typeof templateParameters === 'function'
      // A custom function can overwrite the entire template parameter preparation
      ? templateParameters
      // If the template parameters is an object merge it with the default values
      : (compilation, assets, assetTags, options) => Object.assign({},
        templateParametersGenerator(compilation, assets, assetTags, options),
        templateParameters
      );
    const preparedAssetTags = {
      headTags: prepareAssetTagGroupForRendering(assetTags.headTags),
      bodyTags: prepareAssetTagGroupForRendering(assetTags.bodyTags)
    };
    return Promise
      .resolve()
      .then(() => templateParameterFunction(compilation, assets, preparedAssetTags, options));
  }

  function executeTemplate (templateFunction, assets, assetTags, compilation) {
    // Template processing
    const templateParamsPromise = getTemplateParameters(compilation, assets, assetTags);
    return templateParamsPromise.then((templateParams) => {
      try {
        // If html is a promise return the promise
        // If html is a string turn it into a promise
        return templateFunction(templateParams);
      } catch (e) {
        compilation.errors.push(new Error('Template execution failed: ' + e));
        return Promise.reject(e);
      }
    });
  }

  function postProcessHtml (html, assets, assetTags) {
    if (typeof html !== 'string') {
      return Promise.reject(new Error('Expected html to be a string but got ' + JSON.stringify(html)));
    }
    const htmlAfterInjection = options.inject
      ? injectAssetsIntoHtml(html, assets, assetTags)
      : html;
    const htmlAfterMinification = minifyHtml(htmlAfterInjection);
    return Promise.resolve(htmlAfterMinification);
  }

  function addFileToAssets (filename, compilation) {
    filename = path.resolve(compilation.compiler.context, filename);
    return fsReadFileAsync(filename)
      .then(source => new webpack.sources.RawSource(source, false))
      .catch(() => Promise.reject(new Error('HtmlWebpackPlugin: could not load file ' + filename)))
      .then(rawSource => {
        const basename = path.basename(filename);
        compilation.fileDependencies.add(filename);
        compilation.emitAsset(basename, rawSource);
        return basename;
      });
  }

  function replacePlaceholdersInFilename (filename, fileContent, compilation) {
    if (/\[\\*([\w:]+)\\*\]/i.test(filename) === false) {
      return { path: filename, info: {} };
    }
    const hash = compiler.webpack.util.createHash(compilation.outputOptions.hashFunction);
    hash.update(fileContent);
    if (compilation.outputOptions.hashSalt) {
      hash.update(compilation.outputOptions.hashSalt);
    }
    const contentHash = hash.digest(compilation.outputOptions.hashDigest).slice(0, compilation.outputOptions.hashDigestLength);
    return compilation.getPathWithInfo(
      filename,
      {
        contentHash,
        chunk: {
          hash: contentHash,
          contentHash
        }
      }
    );
  }

  function sortEntryChunks (entryNames, sortMode, compilation) {
    // Custom function
    if (typeof sortMode === 'function') {
      return entryNames.sort(sortMode);
    }
    // Check if the given sort mode is a valid chunkSorter sort mode
    if (typeof chunkSorter[sortMode] !== 'undefined') {
      return chunkSorter[sortMode](entryNames, compilation, options);
    }
    throw new Error('"' + sortMode + '" is not a valid chunk sort mode');
  }

  function filterChunks (chunks, includedChunks, excludedChunks) {
    return chunks.filter(chunkName => {
      // Skip if the chunks should be filtered and the given chunk was not added explicity
      if (Array.isArray(includedChunks) && includedChunks.indexOf(chunkName) === -1) {
        return false;
      }
      // Skip if the chunks should be filtered and the given chunk was excluded explicity
      if (Array.isArray(excludedChunks) && excludedChunks.indexOf(chunkName) !== -1) {
        return false;
      }
      // Add otherwise
      return true;
    });
  }

  function getPublicPath (compilation, childCompilationOutputName, customPublicPath) {
    const compilationHash = compilation.hash;

    const webpackPublicPath = compilation.getAssetPath(compilation.outputOptions.publicPath, { hash: compilationHash });

    // Webpack 5 introduced "auto" as default value
    const isPublicPathDefined = webpackPublicPath !== 'auto';

    let publicPath =
      // If the html-webpack-plugin options contain a custom public path uset it
      customPublicPath !== 'auto'
        ? customPublicPath
        : (isPublicPathDefined
          // If a hard coded public path exists use it
          ? webpackPublicPath
          // If no public path was set get a relative url path
          : path.relative(path.resolve(compilation.options.output.path, path.dirname(childCompilationOutputName)), compilation.options.output.path)
            .split(path.sep).join('/')
        );

    if (publicPath.length && publicPath.substr(-1, 1) !== '/') {
      publicPath += '/';
    }

    return publicPath;
  }

  function htmlWebpackPluginAssets (compilation, entryNames, publicPath) {
    const compilationHash = compilation.hash;
    const assets = {
      // The public path
      publicPath,
      // Will contain all js and mjs files
      js: [],
      // Will contain all css files
      css: [],
      // Will contain the html5 appcache manifest files if it exists
      manifest: Object.keys(compilation.assets).find(assetFile => path.extname(assetFile) === '.appcache'),
      // Favicon
      favicon: undefined
    };

    // Append a hash for cache busting
    if (options.hash && assets.manifest) {
      assets.manifest = appendHash(assets.manifest, compilationHash);
    }

    // Extract paths to .js, .mjs and .css files from the current compilation
    const entryPointPublicPathMap = {};
    const extensionRegexp = /\.(css|js|mjs)(\?|$)/;
    for (let i = 0; i < entryNames.length; i++) {
      const entryName = entryNames[i];
      /** entryPointUnfilteredFiles - also includes hot module update files */
      const entryPointUnfilteredFiles = compilation.entrypoints.get(entryName).getFiles();

      const entryPointFiles = entryPointUnfilteredFiles.filter((chunkFile) => {
        // compilation.getAsset was introduced in webpack 4.4.0
        // once the support pre webpack 4.4.0 is dropped please
        // remove the following guard:
        const asset = compilation.getAsset && compilation.getAsset(chunkFile);
        if (!asset) {
          return true;
        }
        // Prevent hot-module files from being included:
        const assetMetaInformation = asset.info || {};
        return !(assetMetaInformation.hotModuleReplacement || assetMetaInformation.development);
      });

      // Prepend the publicPath and append the hash depending on the
      // webpack.output.publicPath and hashOptions
      // E.g. bundle.js -> /bundle.js?hash
      const entryPointPublicPaths = entryPointFiles
        .map(chunkFile => {
          const entryPointPublicPath = publicPath + urlencodePath(chunkFile);
          return options.hash
            ? appendHash(entryPointPublicPath, compilationHash)
            : entryPointPublicPath;
        });

      entryPointPublicPaths.forEach((entryPointPublicPath) => {
        const extMatch = extensionRegexp.exec(entryPointPublicPath);
        // Skip if the public path is not a .css, .mjs or .js file
        if (!extMatch) {
          return;
        }
        // Skip if this file is already known
        // (e.g. because of common chunk optimizations)
        if (entryPointPublicPathMap[entryPointPublicPath]) {
          return;
        }
        entryPointPublicPathMap[entryPointPublicPath] = true;
        // ext will contain .js or .css, because .mjs recognizes as .js
        const ext = extMatch[1] === 'mjs' ? 'js' : extMatch[1];
        assets[ext].push(entryPointPublicPath);
      });
    }
    return assets;
  }

  function getFaviconPublicPath (faviconFilePath, compilation, publicPath) {
    if (!faviconFilePath) {
      return Promise.resolve(undefined);
    }
    return addFileToAssets(faviconFilePath, compilation)
      .then((faviconName) => {
        const faviconPath = publicPath + faviconName;
        if (options.hash) {
          return appendHash(faviconPath, compilation.hash);
        }
        return faviconPath;
      });
  }

  function generatedScriptTags (jsAssets) {
    return jsAssets.map(scriptAsset => ({
      tagName: 'script',
      voidTag: false,
      meta: { plugin: 'html-webpack-plugin' },
      attributes: {
        defer: options.scriptLoading === 'defer',
        type: options.scriptLoading === 'module' ? 'module' : undefined,
        src: scriptAsset
      }
    }));
  }

  function generateStyleTags (cssAssets) {
    return cssAssets.map(styleAsset => ({
      tagName: 'link',
      voidTag: true,
      meta: { plugin: 'html-webpack-plugin' },
      attributes: {
        href: styleAsset,
        rel: 'stylesheet'
      }
    }));
  }

  function generateBaseTag (baseOption) {
    if (baseOption === false) {
      return [];
    } else {
      return [{
        tagName: 'base',
        voidTag: true,
        meta: { plugin: 'html-webpack-plugin' },
        attributes: (typeof baseOption === 'string') ? {
          href: baseOption
        } : baseOption
      }];
    }
  }

  function generatedMetaTags (metaOptions) {
    if (metaOptions === false) {
      return [];
    }
    // Make tags self-closing in case of xhtml
    // Turn { "viewport" : "width=500, initial-scale=1" } into
    // [{ name:"viewport" content:"width=500, initial-scale=1" }]
    const metaTagAttributeObjects = Object.keys(metaOptions)
      .map((metaName) => {
        const metaTagContent = metaOptions[metaName];
        return (typeof metaTagContent === 'string') ? {
          name: metaName,
          content: metaTagContent
        } : metaTagContent;
      })
      .filter((attribute) => attribute !== false);
      // Turn [{ name:"viewport" content:"width=500, initial-scale=1" }] into
      // the html-webpack-plugin tag structure
    return metaTagAttributeObjects.map((metaTagAttributes) => {
      if (metaTagAttributes === false) {
        throw new Error('Invalid meta tag');
      }
      return {
        tagName: 'meta',
        voidTag: true,
        meta: { plugin: 'html-webpack-plugin' },
        attributes: metaTagAttributes
      };
    });
  }

  function generateFaviconTags (faviconPath) {
    if (!faviconPath) {
      return [];
    }
    return [{
      tagName: 'link',
      voidTag: true,
      meta: { plugin: 'html-webpack-plugin' },
      attributes: {
        rel: 'icon',
        href: faviconPath
      }
    }];
  }

  function generateAssetGroups (assetTags, scriptTarget) {
    /** @type {{ headTags: Array<HtmlTagObject>; bodyTags: Array<HtmlTagObject>; }} */
    const result = {
      headTags: [
        ...assetTags.meta,
        ...assetTags.styles
      ],
      bodyTags: []
    };
    // Add script tags to head or body depending on
    // the htmlPluginOptions
    if (scriptTarget === 'body') {
      result.bodyTags.push(...assetTags.scripts);
    } else {
      // If script loading is blocking add the scripts to the end of the head
      // If script loading is non-blocking add the scripts infront of the css files
      const insertPosition = options.scriptLoading === 'blocking' ? result.headTags.length : assetTags.meta.length;
      result.headTags.splice(insertPosition, 0, ...assetTags.scripts);
    }
    return result;
  }

  function prepareAssetTagGroupForRendering (assetTagGroup) {
    const xhtml = options.xhtml;
    return HtmlTagArray.from(assetTagGroup.map((assetTag) => {
      const copiedAssetTag = Object.assign({}, assetTag);
      copiedAssetTag.toString = function () {
        return htmlTagObjectToString(this, xhtml);
      };
      return copiedAssetTag;
    }));
  }

  /**
   * Injects the assets into the given html string
   *
   * @param {string} html
   * The input html
   * @param {any} assets
   * @param {{
       headTags: HtmlTagObject[],
       bodyTags: HtmlTagObject[]
     }} assetTags
   * The asset tags to inject
   *
   * @returns {string}
   */
  // 
  function injectAssetsIntoHtml (html, assets, assetTags) {
    const htmlRegExp = /(<html[^>]*>)/i;
    const headRegExp = /(<\/head\s*>)/i;
    const bodyRegExp = /(<\/body\s*>)/i;
    const body = assetTags.bodyTags.map((assetTagObject) => htmlTagObjectToString(assetTagObject, options.xhtml));
    const head = assetTags.headTags.map((assetTagObject) => htmlTagObjectToString(assetTagObject, options.xhtml));

    if (body.length) {
      if (bodyRegExp.test(html)) {
        // Append assets to body element
        html = html.replace(bodyRegExp, match => body.join('') + match);
      } else {
        // Append scripts to the end of the file if no <body> element exists:
        html += body.join('');
      }
    }

    if (head.length) {
      // Create a head tag if none exists
      if (!headRegExp.test(html)) {
        if (!htmlRegExp.test(html)) {
          html = '<head></head>' + html;
        } else {
          html = html.replace(htmlRegExp, match => match + '<head></head>');
        }
      }

      // Append assets to head element
      html = html.replace(headRegExp, match => head.join('') + match);
    }

    // Inject manifest into the opening html tag
    if (assets.manifest) {
      html = html.replace(/(<html[^>]*)(>)/i, (match, start, end) => {
        // Append the manifest only if no manifest was specified
        if (/\smanifest\s*=/.test(match)) {
          return match;
        }
        return start + ' manifest="' + assets.manifest + '"' + end;
      });
    }
    return html;
  }

  function appendHash (url, hash) {
    if (!url) {
      return url;
    }
    return url + (url.indexOf('?') === -1 ? '?' : '&') + hash;
  }

  /**
   * Encode each path component using `encodeURIComponent` as files can contain characters
   * which needs special encoding in URLs like `+ `.
   *
   * Valid filesystem characters which need to be encoded for urls:
   *
   * # pound, % percent, & ampersand, { left curly bracket, } right curly bracket,
   * \ back slash, < left angle bracket, > right angle bracket, * asterisk, ? question mark,
   * blank spaces, $ dollar sign, ! exclamation point, ' single quotes, " double quotes,
   * : colon, @ at sign, + plus sign, ` backtick, | pipe, = equal sign
   *
   * However the query string must not be encoded:
   *
   *  fo:demonstration-path/very fancy+name.js?path=/home?value=abc&value=def#zzz
   *    ^             ^    ^    ^     ^    ^  ^    ^^    ^     ^   ^     ^   ^
   *    |             |    |    |     |    |  |    ||    |     |   |     |   |
   *    encoded       |    |    encoded    |  |    ||    |     |   |     |   |
   *                 ignored              ignored  ignored     ignored   ignored
   *
   * @param {string} filePath
   */
  function urlencodePath (filePath) {
    // People use the filepath in quite unexpected ways.
    // Try to extract the first querystring of the url:
    //
    // some+path/demo.html?value=abc?def
    //
    const queryStringStart = filePath.indexOf('?');
    const urlPath = queryStringStart === -1 ? filePath : filePath.substr(0, queryStringStart);
    const queryString = filePath.substr(urlPath.length);
    // Encode all parts except '/' which are not part of the querystring:
    const encodedUrlPath = urlPath.split('/').map(encodeURIComponent).join('/');
    return encodedUrlPath + queryString;
  }

  // 返回 模板文件 的绝对路径
  function getFullTemplatePath (template, context) {
    if (template === 'auto') {
      template = path.resolve(context, 'src/index.ejs');
      if (!fs.existsSync(template)) {
        template = path.join(__dirname, 'default_index.ejs');
      }
    }
    // If the template doesn't use a loader use the lodash template loader
    if (template.indexOf('!') === -1) {
      template = require.resolve('./lib/loader.js') + '!' + path.resolve(context, template);
    }
    return template.replace(
      /([!])([^/\\][^!?]+|[^/\\!?])($|\?[^!?\n]+$)/,
      (match, prefix, filepath, postfix) => prefix + path.resolve(filepath) + postfix);
  }

  // 压缩 HTML
  function minifyHtml (html) {
    if (typeof options.minify !== 'object') {
      return html;
    }
    try {
      return require('html-minifier-terser').minify(html, options.minify);
    } catch (e) {
      const isParseError = String(e.message).indexOf('Parse Error') === 0;
      if (isParseError) {
        e.message = 'html-webpack-plugin could not minify the generated output.\n' +
            'In production mode the html minifcation is enabled by default.\n' +
            'If you are not generating a valid html output please disable it manually.\n' +
            'You can do so by adding the following setting to your HtmlWebpackPlugin config:\n|\n|' +
            '    minify: false\n|\n' +
            'See https://github.com/jantimon/html-webpack-plugin#options for details.\n\n' +
            'For parser dedicated bugs please create an issue here:\n' +
            'https://danielruf.github.io/html-minifier-terser/' +
          '\n' + e.message;
      }
      throw e;
    }
  }

  /**
   * Helper to return a sorted unique array of all asset files out of the
   * asset object
   */
  // 
  function getAssetFiles (assets) {
    const files = _.uniq(Object.keys(assets).filter(assetType => assetType !== 'chunks' && assets[assetType]).reduce((files, assetType) => files.concat(assets[assetType]), []));
    files.sort();
    return files;
  }
}

function templateParametersGenerator (compilation, assets, assetTags, options) {
  return {
    compilation: compilation,
    webpackConfig: compilation.options,
    htmlWebpackPlugin: {
      tags: assetTags,
      files: assets,
      options: options
    }
  };
}

HtmlWebpackPlugin.version = 5;
HtmlWebpackPlugin.getHooks = getHtmlWebpackPluginHooks;
HtmlWebpackPlugin.createHtmlTagObject = createHtmlTagObject;

module.exports = HtmlWebpackPlugin;
