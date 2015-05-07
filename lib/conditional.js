'use strict';

var varsParser = require('./vars');

/**
 * Permite o uso de condicionais no template
 *
 * @param {String} template
 * @param {Object} variables
 * @returns {String}
 */
var conditionalParse = function (template, variables) {
    var regex = /<(\/)?if\s*(?:>|cond="\s*([^"]*)"\s*?>)/g;
    var ifs = [];
    var blockActual;
    while (true) {
        var match = regex.exec(template);
        if (!match) {
            break;
        }
        var blockTag = match[0];
        var isOpeningTag = !match[1];
        var mayHaveContent = !blockTag.match(/\/>$/g);
        if (isOpeningTag) {
            var condExpression = match[2].replace(/^(\s)*|(\s)$/g, '');
            condExpression = (condExpression !== '') ? condExpression : 'false';
            var blockNew = {
                expression: condExpression,
                start: match.index,
                end: 0,
                contentStart: match.index + blockTag.length,
                contentEnd: 0,
                content: '',
                text: '',
                parent: blockActual,
                children: []
            };
            ifs.push(blockNew);

            if (blockActual) {
                blockActual.children.push(blockNew);
            }
            blockActual = blockNew;

            // tag sem conteúdo, <tag />
            if (!mayHaveContent) {
                blockActual.end = match.index + blockTag.length;
                blockActual.contentEnd = blockActual.contentStart;
                blockActual.content = '';
                blockActual.text = blockTag;
                // remove a barra final
                blockActual = (blockActual && blockActual.parent) ? blockActual.parent : null;
            }
        } else {
            blockActual.end = match.index + blockTag.length;
            blockActual.contentEnd = match.index;
            blockActual.content = template.substr(blockActual.contentStart, blockActual.contentEnd - blockActual.contentStart);
            blockActual.text = template.substr(blockActual.start, blockActual.end - blockActual.start);
            blockActual = (blockActual && blockActual.parent) ? blockActual.parent : null;
        }
    }

    return proccessConditionals(template, ifs, variables);
};

/**
 * Processa os condicionais
 *
 * @param {String} template
 * @param {Array} conditionalsInfo
 * @param {Object} variables
 * @returns {String}
 */
var proccessConditionals = function (template, conditionalsInfo, variables) {
    // filtra apenas os blocos pai
    var blocks = conditionalsInfo.filter(function (item) {
        return !item.parent;
    });

    //Faz as alterações no template para refletir a execuçaõ dos elementos
    blocks.forEach(function (conditional) {
        template = template.replace(conditional.text, proccessConditional(conditional, variables));
    });

    return template;
};

/**
 * Processa um condicional específico
 *
 * @param {Object} conditional
 * @param {Object} variables
 * @returns {String}
 */
var proccessConditional = function (conditional, variables) {
    // se condição valida:
    var truly = false;
    try {
        truly = varsParser.evaluate('(!!(' + conditional.expression + '))', variables);
    } catch (err) {
        console.log('Error executing conditional expression: ' + conditional.expression + ' <' + err.message + '>');
    }

    if (truly) {
        conditional.children.forEach(function (child) {
            conditional.content = conditional.content.replace(child.text, proccessConditional(child, variables));
        });
        return conditional.content;
    } else {
        return '';
    }
};


module.exports = conditionalParse;