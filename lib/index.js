/* global require */

'use strict';

var path = require('path');
var htmlLoad = require('./html-load');
var varsParser = require('./vars');
var blocksParser = require('./blocks');
var mixinsParser = require('./mixins');
var conditionalParser = require('./conditional');

/**
 *
 * @param {String} filePath
 * @param {Function} fileLoader
 * @param {Object} defaultVars
 * @returns {String}
 */
var htmlImproved = function (filePath, fileLoader, defaultVars) {

    // <extends/>, <include/>
    var html = htmlLoad(filePath, {
        fileLoader: fileLoader
    });

    // os mixins são carregados por arquivo
    var mixins = new mixinsParser();

    // as variaveis do template
    var variables = (defaultVars) ? defaultVars : {};

    // <mixin/> (1ª aparição: criacao, demais aparições: replace)
    html = mixins.parseHtmlForInstances(html);

    // <vars/> (geração das variaveis)
    html = varsParser.parseHtml(html, variables);

    // <if/> (condicionais, execução das condicionais para geração do template)
    html = conditionalParser(html, variables);

    // <block/> (1ª aparição: definição, demais aparições: replace|prepend|append)
    html = blocksParser(html);

    // <elements/>(execução os mixins)
    html = mixins.processHtml(html, variables);

    // #{vars} (escapando as variaveis no template)
    html = varsParser.escapeValues(html, variables);

    return html;
};

module.exports = htmlImproved;