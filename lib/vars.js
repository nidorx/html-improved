'use strict';

var _ = require('lodash');
var escape = require('escape-html');
var JSONfn = require('jsonfn').JSONfn;

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
            fnValuesBody.push(JSONfn.stringify(variables[attr])
                    .replace(/^"|"$/g, '')
                    .replace(/(\\n)/g, '')
                    .replace(/(\\")/g, '"')
                    .replace(/(\\')/g, "'")
                    );
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
        if (value === 'false') {
            value = false;
        } else if (value === 'true') {
            value = true;
        } else if (value.match(/^[0-9.]*$/) || value.match(/^[{\[].*[\]}]$/) || value.match(/^[(].*[)]$/)) {
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

    var regexVars = /<(vars)((?:\s+([a-zA-Z][A-Za-z0-9-_]*)(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(\/?)>/;
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