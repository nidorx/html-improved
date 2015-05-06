/* global require */

'use strict';

var path = require('path');
var loadHtml = require('./loadHtml');
var varsUtil = require('./varsUtil');
var Mixins = require('./mixins');
var beautifyHtml = require('js-beautify').html_beautify;


/**
 * ordem de execução:
 * 1 - <extends/>
 * 2 - <include/>
 * 3 - <mixin/> (1ª aparição: criacao, demais aparições: replace)
 * 4 - <vars/> (geração das variaveis)
 * -- neste ponto, ja existe a definiçao das variaveis e o arquivo já está limpo
 * -- de componentes
 * 5 - <if/> (condicionais, execução das condicionais para geração do template)
 * 6 - <block/> (1ª aparição: definição, demais aparições: replace|prepend|append)
 * 7 - <elements/>(execução os mixins)
 * 8 - #{vars} (escapando as variaveis no template)
 *
 * @param {String} filePath
 * @param {Function} callback
 * @returns {undefined}
 */
var htmlImproved = function (filePath, fileLoader) {

    /*
     * <extends/>, <include/>
     */
    var html = loadHtml(filePath, {
        fileLoader: fileLoader
    });

    // os mixins são carregados por arquivo
    var mixins = new Mixins();
    // as variaveis do template
    var variables = {};
    html = varsUtil.parse(html, variables);

    // processa o html para instanciar os mixins
    html = mixins.parseHtmlForInstances(html);

    html = parseBlocks(html);

    // processa o html executando os mixins existentes
    html = mixins.processHtml(html, variables);

    html = varsUtil.processHtml(html, variables);
    html = beautifyHtml(html, {
        indent_inner_html: true,
        indent_size: 4,
        indent_char: ' ',
        brace_style: "collapse",
        indent_scripts: 'normal',
        wrap_line_length: 0,
        wrap_attributes: 'auto',
        wrap_attributes_indent_size: 4,
        preserve_newlines: false,
        max_preserve_newlines: 10,
        //unformatted                  List of tags (defaults to inline) that should not be reformatted
        end_with_newline: false
    });
    return html;
};


/**
 * Faz o parsing dos blocos
 *
 * @param {type} template
 * @returns {unresolved}
 */
var parseBlocks = function (template) {
    var regex = /<(\/)?block\s*(?:>|name="\s*([^"]*)"\s*(prepend|append|replace)?\s*([^>]*)?>)/g;
    var blocksInfo = [];
    var blockActual;
    while (true) {
        var match = regex.exec(template);
        if (!match) {
            break;
        }
        var blockTag = match[0];

        var isOpeningTag = !match[1];
        var blockName = match[2];
        var contentAction = (match[3]) ? (match[3]) : 'replace';
        var blockAttributes = (match[4]) ? match[4] : '';
        var mayHaveContent = !blockTag.match(/\/>$/g);
        if (isOpeningTag) {
            var blockNew = {
                name: blockName,
                action: contentAction,
                start: match.index,
                end: 0,
                contentStart: match.index + blockTag.length,
                contentEnd: 0,
                content: '',
                text: '',
                parent: blockActual,
                attributes: blockAttributes,
                children: []
            };
            blocksInfo.push(blockNew);

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
                blockActual.attributes = blockAttributes.replace(/\/$/g, '');
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

    var BlocosM = (function () {
        var contents = {
        };

        var ID_BLOCK = 1;

        return {
            set: function (blockname, action, content) {
                var out = '';
                if (!content) {
                    content = '';
                }
                if (!contents[blockname]) {
                    contents[blockname] = {
                        mark: '__block__' + (ID_BLOCK++),
                        content: ''
                    };
                    out = contents[blockname].mark;
                }
                switch (action) {
                    case 'append':
                        contents[blockname].content = contents[blockname].content + content;
                        break;
                    case 'prepend':
                        contents[blockname].content = content + contents[blockname].content;
                        break;
                    default: // replace
                        contents[blockname].content = content;
                        break;
                }
                return out;
            },
            escape: function (template) {
                for (var i in contents) {
                    var block = contents[i];
                    template = template.replace(block.mark, [block.content].join('\n'));
                }
                return template;
            }
        };
    })();

    var parseBlockTemplateContent = function (block) {
        block.children.forEach(function (child) {
            block.content = block.content.replace(child.text, parseBlockTemplateContent(child));
        });
        return BlocosM.set(block.name, block.action, block.content);
    };

    // filtra apenas os blocos pai
    var blocks = blocksInfo.filter(function (item) {
        return !item.parent;
    });

    //Faz as alterações no template para refletir a execuçaõ dos elementos
    blocks.forEach(function (block) {
        template = template.replace(block.text, parseBlockTemplateContent(block));
    });

    return BlocosM.escape(template);
};

module.exports = htmlImproved;