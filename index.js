const _ = require('lodash');

const cheerio = require('cheerio');

const isRelativeUrl = require('is-relative-url');

const path = require('path');

const Promise = require('bluebird');

const sharp = require('gatsby-plugin-sharp');

const slash = require('slash');

const visitWithParents = require('unist-util-visit-parents');

module.exports = ({
  files,
  markdownNode,
  markdownAST,
  getNode,
  reporter,
  cache
}, pluginOptions) => {
  const defaults = {
    components: [{
      tagName: 'component-image',
      attributes: [{
        source: 'src',
        target: ''
      }]
    }],
    sharpFunction: 'fluid'
  };

  const options = _.defaults(pluginOptions, defaults);

  const generateImages = async (imageSource, optionsOverride) => {
    const parentNode = getNode(markdownNode.parent);

    if (!(parentNode && parentNode.dir)) {
      return null;
    }

    const imagePath = slash(path.join(parentNode.dir, imageSource));

    const imageNode = _.find(files, file => {
      if (file && file.absolutePath) {
        return file.absolutePath === imagePath;
      }

      return null;
    });

    if (!imageNode || !imageNode.absolutePath) {
      return null;
    }

    const applyOptions = optionsOverride !== null && typeof optionsOverride === `object` ? _.defaults(optionsOverride, options) : options;
    const result = await sharp[applyOptions.sharpFunction]({
      file: imageNode,
      args: applyOptions,
      reporter,
      cache
    });

    if (applyOptions.withWebp) {
      const webpResult = await sharp[applyOptions.sharpFunction]({
        file: imageNode,
        args: _.defaults({
          toFormat: `WEBP`
        }, applyOptions),
        reporter,
        cache
      });

      if (webpResult) {
        result.srcWebp = webpResult.src;
        result.srcSetWebp = webpResult.srcSet;
      }
    }

    if (applyOptions.tracedSVG) {
      let args = typeof applyOptions.tracedSVG === `object` ? applyOptions.tracedSVG : {}; // Translate Potrace constants (e.g. TURNPOLICY_LEFT, COLOR_AUTO) to the values Potrace expects

      const {
        Potrace
      } = require(`potrace`);

      const argsKeys = Object.keys(args);
      args = argsKeys.reduce((result, key) => {
        const value = args[key];
        result[key] = Potrace.hasOwnProperty(value) ? Potrace[value] : value;
        return result;
      }, {});
      const tracedSVG = await sharp['traceSVG']({
        file: imageNode,
        args,
        fileArgs: args,
        cache,
        reporter
      }); // Escape single quotes so the SVG data can be used in inline style attribute with single quotes

      result.tracedSVG = tracedSVG.replace(/'/g, `\\'`);

      if (!applyOptions.preserveBase64) {
        // Components such as Img (gatsby-img) use blurUp when base64 is provided. Assume the traced SVG is the preferred placeholder image when requested
        result.base64 = null;
      }
    }

    return result;
  };

  const rawHtmlNodes = [];
  visitWithParents(markdownAST, 'html', node => {
    rawHtmlNodes.push(node);
  });
  return Promise.all(rawHtmlNodes.map(node => new Promise(async resolve => {
    if (!node.value) {
      return resolve(node);
    }

    const $ = cheerio.load(node.value);
    let processComponents = []; // add any elements matching tagName set in the check node definitions

    for (const componentDefinition of options.components) {
      $(componentDefinition.tagName).each(function () {
        processComponents.push({
          ref: $(this),
          attributes: componentDefinition.attributes
        });
      });
    }

    if (!processComponents.length) {
      // No matching elements
      return resolve(node);
    }

    for (const component of processComponents) {
      for (const attribute of component.attributes) {
        let source = attribute;
        let optionsOverride = null;
        let target = '';

        if (typeof attribute === `object`) {
          source = attribute.source;
          optionsOverride = attribute.options || null;

          if (attribute.target) {
            target = attribute.target;
          } else if (optionsOverride && optionsOverride.sharpFunction) {
            target = optionsOverride.sharpFunction + source;
          }
        }

        if (!target) {
          target = options.sharpFunction + source;
        }

        const imageSource = component.ref.attr(source);

        if (!imageSource) {
          continue;
        }

        const fileType = imageSource.split(".").reverse()[0]; // sharp can't process gifs or svgs

        if (fileType !== 'gif' && fileType !== 'svg' && isRelativeUrl(imageSource)) {
          const result = await generateImages(imageSource, optionsOverride);

          if (result) {
            // set result to the targeted attribute
            component.ref.attr(target, JSON.stringify(result));
          }
        }
      }
    }

    node.type = 'html';
    node.value = $('body').html();
    return resolve(node);
  })));
};