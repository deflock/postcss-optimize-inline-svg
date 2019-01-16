'use strict';

const postcss = require('postcss');
const plugin = require('..').default;

process.chdir(__dirname);

/**
 * @param {string} input
 * @param {string} expected
 * @param {Object} pluginOptions
 * @param {Object} postcssOptions
 * @param {Array} warnings
 * @returns {Promise}
 */
function run(input, expected, pluginOptions = {}, postcssOptions = {}, warnings = []) {
    return postcss([plugin(pluginOptions)])
        .process(input, Object.assign({from: 'input.css'}, postcssOptions))
        .then((result) => {
            const resultWarnings = result.warnings();
            resultWarnings.forEach((warning, index) => {
                expect(warnings[index]).toEqual(warning.text);
            });
            expect(resultWarnings.length).toEqual(warnings.length);
            expect(result.css).toEqual(expected);
            return result;
        });
}

it('should work', () => {
    run(
        'a { background: url(\'data:image/svg+xml;charset=utf-8,<?xml version="1.0" encoding="utf-8"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg version="1.1" id="Layer_13" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 20 20" enable-background="new 0 0 20 20" xml:space="preserve"><polygon id="star_filled_1_" fill-rule="evenodd" clip-rule="evenodd" points="10,0 13.1,6.6 20,7.6 15,12.7 16.2,20 10,16.6 3.8,20 5,12.7 0,7.6 6.9,6.6 "/></svg>\') }',
        'a { background: url(\'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path fill-rule="evenodd" clip-rule="evenodd" d="M10 0l3.1 6.6 6.9 1-5 5.1 1.2 7.3-6.2-3.4L3.8 20 5 12.7 0 7.6l6.9-1z"/></svg>\') }'
    );
});
