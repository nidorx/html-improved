'use strict';

var _ = require('lodash');
var escape = require('escape-html');


var variables = {
    evaluate: function (value) {
        if (typeof value === 'string') {
            if (value.match(/^[{\[]/) || value.match(/^[0-9]*$/)) {
                value = (new Function('return (' + value + ')'))();
            }
        }
        return value;
    },
    /**
     * Percorre um template em busca de definições de variáveis
     *
     * @param {type} template
     * @param {type} varInstance
     * @returns {unresolved}
     */
    parse: function (template, varInstance) {
        // buscando as variáveis definidas
        template = template.replace(/<vars\s*([^>]*)\s*\/>/g, function ($0, attributesHtml) {
            attributesHtml.replace(/([a-z][a-z0-9-_]*)="([^"]*)?"/gi, function ($0, attribute, value) {
                attribute = attribute.replace(/-([a-z])/g, function ($0, $1) {
                    return $1.toUpperCase();
                });
                varInstance[attribute] = variables.evaluate(value);
            });
            return '';
        });
        return template;
    },
    /**
     * Executa a substituição
     *
     * @param {type} html
     * @param {type} values
     * @returns {unresolved}
     */
    processHtml: function (html, values) {
        var fnValuesBody = [];
        for (var attr in values) {
            if (!values.hasOwnProperty(attr)) {
                continue;
            }
            fnValuesBody.push('var ' + attr + ' = ' + JSON.stringify(values[attr]) + ';');
        }

        fnValuesBody = fnValuesBody.join('');

        html = html.replace(/([!#])\{([^}]*)\}/g, function ($0, $1, $expr) {
            var value = '';
            try {
                value = (new Function(fnValuesBody + '; return ' + $expr))();
            } catch (err) {
                console.log('Error executing expression: ' + $0 + ' <' + err.message + '>');
            }
            if ($1 === '#') {
                value = escape(value);
            }
            return value;
        });
        return html;
    }
};


module.exports = variables;