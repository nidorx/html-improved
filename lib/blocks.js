'use strict';

var BLOCK_MARK = '__H_t_M_l_B_l_O_c_K__';

/**
 * Faz o processamento de blocos (<block/>) do template
 *
 * @param {String} template
 * @returns {Function}
 */
var blocksParser = function (template) {
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

    return proccessBlocksInfo(template, blocksInfo);
};

/**
 * Finaliza o processamento do template
 * 
 * @param {String} template
 * @param {Array} blocksInfo
 * @returns {Function}
 */
var proccessBlocksInfo = function (template, blocksInfo) {
    var ID_BLOCK_SEQ = 1;

    // filtra apenas os blocos pai
    var blocks = blocksInfo.filter(function (item) {
        return !item.parent;
    });
    var contents = {};

    var addBlockContent = function (blockname, action, content) {
        var out = '';
        if (!content) {
            content = '';
        }
        if (!contents[blockname]) {
            contents[blockname] = {
                id: (ID_BLOCK_SEQ++),
                content: ''
            };
            out = BLOCK_MARK + contents[blockname].id;
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
    };


    var parseBlockTemplateContent = function (block) {
        block.children.forEach(function (child) {
            block.content = block.content.replace(child.text, parseBlockTemplateContent(child));
        });
        return addBlockContent(block.name, block.action, block.content);
    };

    //Faz as alterações no template para refletir a execuçaõ dos elementos
    blocks.forEach(function (block) {
        template = template.replace(block.text, parseBlockTemplateContent(block));
    });

    return (function (template) {
        // faz o escape do html
        while (true) {
            if (template.indexOf(BLOCK_MARK) < 0) {
                break;
            }

            for (var i in contents) {
                var block = contents[i];
                var regex = new RegExp(BLOCK_MARK + block.id, 'g');
                template = template.replace(regex, [block.content].join('\n'));
            }
        }
        return template;
    })(template);
};

module.exports = blocksParser;