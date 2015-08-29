'use strict';

var _ = require('lodash');
var escape = require('escape-html');

/**
 * Facilita o DEBUG durante o desenvolvimento
 * 
 * @param {type} flag
 * @returns {undefined}
 */
var LOG = function (flag) {
    if (!flag) {
        return;
    }
    var args = [].slice.call(arguments, 1);
    console.log.apply(console, args);
};


/**
 * Cria uma função usada para avaliar uma expressão
 *
 * @param {Object} variables
 * @returns {Function}
 */
var expressionEvaluator = function (variables) {
    var fnValuesBody = [];
    for (var attr in variables) {
        if (!variables.hasOwnProperty(attr)) {
            continue;
        }

        fnValuesBody.push('var ' + attr + ' = ');

        if (typeof variables[attr] === 'string') {
            fnValuesBody.push(JSON.stringify(variables[attr]));
        } else {
            var value = JSON.stringify(variables[attr], function (key, value) {
                if (typeof value === 'function') {
                    return value.toString();
                }
                return value;
            });
            if (value === undefined) {
                value = 'undefined';
            } else {
                value = value.replace(/^"|"$/g, '')
                        .replace(/\\n/g, '\n')
                        .replace(/\\b/g, '\b')
                        .replace(/\\f/g, '\f')
                        .replace(/\\r/g, '\r')
                        .replace(/\\t/g, '\t')
                        //@todo: /u - hexadecimal
                        .replace(/\\("|'')/g, '$1');
            }
            fnValuesBody.push(value);
        }


        fnValuesBody.push(';');

    }

    fnValuesBody = fnValuesBody.join('');

    return function (expression) {
        return (new Function(fnValuesBody + '; return (' + expression + ')'))();
    };
};

var evaluate = function (value, variables) {
    if (typeof value === 'string') {
        value = value.replace(/^(\s)*|(\s)$/g, '');
        if (value.match(/(^')([\s\S]*)('$)/g)) {
            // string escapada
            value = value.replace(/(^')([\s\S]*)('$)/g, '$2');
        } else if (value === 'false') {
            value = false;
        } else if (value === 'true') {
            value = true;
        } else if (value.match(/^[0-9.]*$/) || value.match(/^[{\[][\s\S]*[\]}]$/) || value.match(/^[(][\s\S]*[)]$/)) {
            // numeros, objects o expressoes
            value = expressionEvaluator(variables)(value);
        }
    }
    return value;
};

/**
 * Processa as definições de variáveis (<vars/>) do template
 *
 * @param {String} template
 * @param {Object} variables Referencia para as variaveis
 * @returns {String}
 */
var parseHtml = function (template, variables) {
    // buscando as variáveis definidas

    var regexVars = /<(vars)((?:\s+([a-zA-Z][A-Za-z0-9-_]*)(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(?:\/>|>\s*<\/vars>)/;
    while (true) {
        var matchVars = template.match(regexVars);
        if (!matchVars) {
            break;
        }
        template = template.replace(matchVars[0], '');
        var attributesHtml = matchVars[2];
        var regexAttrs = /([a-z][a-z0-9-_]*)="([^"]*)?"/gi;
        while (true) {
            var match = regexAttrs.exec(attributesHtml);
            if (!match) {
                break;
            }
            var attribute = match[1].replace(/-([a-z])/g, function ($0, $1) {
                return $1.toUpperCase();
            });
            var value = match[2];
            variables[attribute] = evaluate(value, variables);
        }
    }
    return template;
};

/**
 * Processa um template, escapando os valores das variáveis
 *
 * @param {String} html
 * @param {Object} variables
 * @returns {String}
 */
var escapeValues = function (html, variables) {
    var evaluator = expressionEvaluator(variables);

    html = html.replace(/([!#])\{([^}]*)\}/g, function ($0, $1, $expr) {
        var value = '';

        try {
            value = evaluator($expr);
        } catch (err) {
            console.log('Error executing expression: ' + $0 + ' <' + err.message + '>');
        }

        if (value === undefined) {
            value = '';
        }

        if ($1 === '#') {
            value = escape(value);
        }

        return value;
    });
    return html;
};

module.exports = {
    evaluate: evaluate,
    expressionEvaluator: expressionEvaluator,
    parseHtml: parseHtml,
    escapeValues: escapeValues
};