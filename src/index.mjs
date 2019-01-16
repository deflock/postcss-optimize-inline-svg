import postcss from 'postcss';
import valueParser from 'postcss-value-parser';
import isSvg from 'is-svg';
import SVGO from 'svgo';

const PLUGIN_NAME = 'deflock-optimize-inline-svg';

const DATAURI_DEFAULT_PATTERNS = [/data:image\/svg\+xml(;(charset=)?utf-8)?,/];

/**
 *
 */
export default postcss.plugin(PLUGIN_NAME, (opts = {}) => {
    const options = Object.assign({
        patterns: DATAURI_DEFAULT_PATTERNS,
    }, opts);

    const svgo = new SVGO(options.svgo);

    return (css, result) => {
        return new Promise((resolve, reject) => {
            const promises = [];

            const patterns = Array.isArray(options.patterns)
                ? options.patterns
                : [options.patterns];

            css.walkDecls(decl => {
                for (const pattern of patterns) {
                    if (pattern.test(decl.value)) {
                        promises.push(transformPromise(decl, 'value', options, result, svgo));
                        break;
                    }
                }
            });

            return Promise.all(promises).then(resolve, reject);
        });
    };
});

/**
 * @param {Object} decl
 * @param {string} property
 * @param {Object} options
 * @param {Object} result
 * @param {Object} svgo
 */
function transformPromise(decl, property, options, result, svgo) {
    const promises = [];

    const parser = valueParser(decl[property]).walk(node => {
        if (node.type !== 'function' || node.value !== 'url' || !node.nodes.length) {
            return;
        }
        let {value} = node.nodes[0];
        let decodedUri, isUriEncoded;

        try {
            decodedUri = decode(value);
            isUriEncoded = decodedUri !== value;
        }
        catch (e) {
            // Swallow exception if we cannot decode the value
            isUriEncoded = false;
        }

        if (isUriEncoded) {
            value = decodedUri;
        }

        let svg = value;

        const patterns = Array.isArray(options.patterns)
            ? options.patterns
            : [options.patterns];

        for (const pattern of patterns) {
            if (pattern.test(svg)) {
                svg = svg.replace(pattern, '')
            }
        }

        if (!isSvg(svg)) {
            return;
        }

        promises.push(new Promise(async (resolve, reject) => {
            const res = await svgo.optimize(svg);

            if (res.error) {
                return reject(`${PLUGIN_NAME}: ${res.error}`);
            }

            let data = isUriEncoded ? encode(res.data) : res.data;

            // Should always encode # otherwise we yield a broken SVG
            // in Firefox (works in Chrome however). See this issue:
            // https://github.com/ben-eb/cssnano/issues/245
            data = data.replace(/#/g, '%23');

            node.nodes[0] = {
                ...node.nodes[0],
                value: 'data:image/svg+xml;charset=utf-8,' + data,
                quote: isUriEncoded ? '"' : '\'',
                type: 'string',
                before: '',
                after: '',
            };

            resolve();
        }));

        // By returning false we prevent traversal of descendent nodes within functions
        return false;
    });

    return Promise.all(promises).then(() => (decl[property] = parser.toString()));
}

/**
 * @param {string} data
 * @returns {string}
 */
function encode(data) {
    return data
        .replace(/"/g, '\'')
        .replace(/%/g, '%25')
        .replace(/</g, '%3C')
        .replace(/>/g, '%3E')
        .replace(/&/g, '%26')
        .replace(/#/g, '%23')
        .replace(/\s+/g, ' ');
}

/**
 * @param {string} data
 * @returns {string}
 */
function decode(data) {
    return decodeURIComponent(data);
}
