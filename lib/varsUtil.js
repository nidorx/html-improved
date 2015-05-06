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
     * @param {type} vars
     * @returns {unresolved}
     */
    processHtml: function (html, vars) {
        _.each(vars, function (value, attr) {
            var regexEscaped = new RegExp('#{' + attr.replace(/([$])/, '\\$1') + '}', 'g');
            var regexUnescaped = new RegExp('\!{' + attr.replace(/([$])/, '\\$1') + '}', 'g');
            html = html
                    .replace(regexEscaped, escape(value))
                    .replace(regexUnescaped, value);
        });
        return html;
    }
};


module.exports = variables;