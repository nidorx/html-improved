// '<for var="varName" in="variables.algo"></for>'.match(/<(\/)?for\s*(?:>|(?:var="([^"]*)")?\s*(?:in="\s*([^"]*)")?\s*?>)/g)

'use strict';

var _ = require('lodash');
var varsParser = require('./vars');
var conditionalParser = require('./conditional');

var LOOP_MARK = '__H_t_M_l_E_a_C_h_L_o_O_p__';
var LOOPS_SEQ = 1;

var Loop = function () {

};

Loop.prototype.parseHtmlForInstances = function (html, variables) {

    var regex = /<(\/)?each\s*(?:>|(?:var="([^"]*)")?\s*(?:in="\s*([^"]*)")?\s*?>)/g;
    var loopsInfo = [];
    var blockActual;
    while (true) {
        var match = regex.exec(html);
        if (!match) {
            break;
        }
        var blockTag = match[0];

        var isOpeningTag = !match[1];
        var keyValueName = match[2];
        var mayHaveContent = !blockTag.match(/\/>$/g);
        if (isOpeningTag) {
            var variable = match[3];
            if (!variable) {
                //error
                throw new Error('O parametro "in" é requerido para o loop ');
            }

            var keyName = '$key';
            var valueName = '$value';
            if (keyValueName) {
                var parts = keyValueName.match(/([a-z_][a-z0-9_]*)(?:,([a-z_][a-z0-9_]*))?/gi);
                if (parts.length > 1) {
                    keyName = parts[0];
                    valueName = parts[1];
                } else {
                    valueName = parts[0];
                }
            }
            var blockNew = {
                mark: LOOP_MARK + (LOOPS_SEQ++),
                keyName: keyName,
                valueName: valueName,
                variable: variable,
                start: match.index,
                end: 0,
                contentStart: match.index + blockTag.length,
                contentEnd: 0,
                content: '',
                text: '',
                parent: blockActual,
                children: []
            };
            loopsInfo.push(blockNew);

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
            blockActual.content = html.substr(blockActual.contentStart, blockActual.contentEnd - blockActual.contentStart);
            blockActual.text = html.substr(blockActual.start, blockActual.end - blockActual.start);
            blockActual = (blockActual && blockActual.parent) ? blockActual.parent : null;
        }
    }

    // filtra apenas os mixins que nao possuem pai
    this.loops = loopsInfo.filter(function (item) {
        return !item.parent;
    });

    // altera o template, removendo as definições dos mixins

    this.loops.forEach(function (loopInfo) {
        parseLoopInstance(loopInfo);
        html = html.replace(loopInfo.text, loopInfo.mark);
    });

    return html;
};

var parseLoopInstance = function (loopInfo) {
    loopInfo.children.forEach(function (child) {
        parseLoopInstance(child);
        loopInfo.content = loopInfo.content.replace(child.text, child.mark);
    });
};


Loop.prototype.processHtml = function (html, variables) {
    _.each(this.loops, function (loop) {
        html = html.replace(loop.mark, proccessLoop(loop, variables));
    });

    return html;
};

/**
 * Processa um condicional específico
 *
 * @param {Object} loop
 * @param {Object} variables
 * @returns {String}
 */
var proccessLoop = function (loop, variables) {
    var html = '';
    var variable = false;
    try {
        variable = varsParser.evaluate('(' + loop.variable + ')', variables);
    } catch (err) {
        console.error('Error executing loop expression: ' + loop.variable + ' <' + err.message + '>');
    }

    if (variable === false) {
        return html;
    }

    var loopVariables = _.clone(variables, true);

    (function (iterate) {
        if (Array.isArray(variable)) {
            for (var i = 0, l = variable.length; i < l; i++) {
                iterate(i, variable[i]);
            }
        } else {
            for (var i in variable) {
                if (!variable.hasOwnProperty(i)) {
                    continue;
                }
                iterate(i, variable[i]);
            }
        }
    })(function (key, value) {
        loopVariables.$key = loopVariables[loop.keyName] = key;
        loopVariables.$value = loopVariables[loop.valueName] = value;

        var loopHtml = loop.content;

        //<if/> (condicionais, execução das condicionais para geração do template)
        loopHtml = conditionalParser(loopHtml, loopVariables);

        loop.children.forEach(function (child) {
            loopHtml = loopHtml.replace(child.mark, proccessLoop(child, loopVariables));
        });

        // #{vars} (escapando as variaveis no template)
        loopHtml = varsParser.escapeValues(loopHtml, loopVariables);

        html += loopHtml;
    });

    return html;
};

module.exports = Loop;
