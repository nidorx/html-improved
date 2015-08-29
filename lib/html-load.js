/* global module */

'use strict';

var fs = require('fs');
var path = require('path');

/**
 * A função de leitura de arquivos
 *
 * @type Function
 */
var _fileLoader;

/**
 *
 * @param {type} filePath
 * @param {type} newFileLoader
 * @returns {String}
 */
var loadFile = function (filePath, newFileLoader) {
    if (typeof newFileLoader === 'function') {
        _fileLoader = newFileLoader;
    } else if (!_fileLoader) {
        _fileLoader = function (filePath) {
            return (fs.readFileSync(filePath) + '');
        };
    }
    return _fileLoader(filePath);
};

/**
 * Permite disparar erro de processamento do arquivo, facilitando o desenvolvimento
 *
 * @param {String} msg
 * @param {String} filePath
 * @param {String} template
 * @param {Object} match
 * @returns {undefined}
 */
var raiseFileError = function (msg, filePath, template, match) {
    var linha = (template.substr(0, match.index).split('\n').length);
    throw new Error(msg + ' < arquivo: "' + filePath + '", linha: ' + linha + ' >');
};


/**
 * Faz o carregamento de um html, resolvendo as heranças e os includes
 *
 * @param {String} htmlPath
 * @param {Object} config
 * @returns {String} O html com todos os includes e herança resolvidos
 */
var loadHtml = function (htmlPath, config) {
    config = (config) ? config : {};
    var html = loadFile(htmlPath, config.fileLoader);
    html = resolveRequire(html, htmlPath);
    html = resolveExtends(html, htmlPath, (config.extendsParents) ? config.extendsParents : []);
    html = resolveIncludes(html, htmlPath, (config.includeParents) ? config.includeParents : []);

    return html;
};

var resolveRequire = function (html, htmlPath) {
    return html.replace(/@require\((?:(?:(')([^']*)')|(?:(")([^"]*)"))\)/g, function ($0, $1, $2, $3, $4) {
        var quote = $1 ? $1 : $3;
        var requirePath = $2 ? $2 : $4;
        var requireRealPath = path.join(path.dirname(htmlPath), requirePath);
        return ['@require(', quote, requireRealPath, quote, ')'].join('');
    });
};

/**
 * Faz o tratamento para todas as heranças de um arquivo
 *
 * @param {String} html
 * @param {String} htmlPath
 * @param {String} parentFiles
 * @returns {String}
 */
var resolveExtends = function (html, htmlPath, parentFiles) {
    var regex = /<extends\s*file="([^"]*)"\s*(?:\/>|>\s*<\/extends>)/;
    var match = html.match(regex);
    if (!match) {
        // arquivo não possui herança
        return html;
    }

    // evita herança cíclica
    if (parentFiles.indexOf(htmlPath) >= 0) {
        raiseFileError('Cyclic/recursive inheritance identified', htmlPath, html, match);
    }

    var parentHtmlPath = path.join(path.dirname(htmlPath), match[1]);

    // remove a tag <extends /> do html
    html = html.replace(regex, '');

    // verifica se existe outro extends no mesmo arquivo
    match = html.match(regex);
    if (match) {
        raiseFileError('Identified multiple inheritance', htmlPath, html, match);
    }

    var parentTemplate = loadHtml(parentHtmlPath, {
        extendsParents: [htmlPath].concat(parentFiles)
    });

    return parentTemplate + html;
};

/**
 * Faz o parsing de todos os includes de um arquivo
 *
 * @param {String} html
 * @param {String} htmlPath
 * @param {String} parentFiles
 * @returns {String}
 */
var resolveIncludes = function (html, htmlPath, parentFiles) {
    var regex = /([ \t]*)<include\s*file="([^"]*)"\s*(?:\/>|>\s*<\/include>)/g;
    var type = /\r\n/.test(html) ? '\r\n' : '\n';
    while (true) {
        var match = regex.exec(html);
        if (!match) {
            break;
        }

        // evita includes cíclicos/recursivos
        if (parentFiles.indexOf(htmlPath) >= 0) {
            raiseFileError('Cyclic/recursive include identified', htmlPath, html, match);
        }

        var strIncludePath = match[2];
        var includeFilePath = path.join(path.dirname(htmlPath), strIncludePath);

        var includeContent;
        if (includeFilePath.match(/\.(htm|html|xhtml|xml)$/)) {
            includeContent = loadHtml(includeFilePath, {
                includeParents: [htmlPath].concat(parentFiles)
            });
        } else {
            //raw text
            includeContent = loadFile(includeFilePath);
            if (includeFilePath.match(/\.js$/)) {
                includeContent = [
                    '<script type="text/javascript">',
                    includeContent,
                    '</script>'
                ].join('');
            } else if (includeFilePath.match(/\.css$/)) {
                includeContent = [
                    '<style type="text/css">',
                    includeContent,
                    '</style>'
                ].join('');
            }
        }

        // substitui o html do include
        var spacing = match[1].replace(/\r|\n/g, '');
        html = html.replace(match[0], spacing + includeContent.replace(/(\n)/g, type + spacing));
    }
    return html;
};


module.exports = loadHtml;