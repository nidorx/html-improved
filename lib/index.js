/* global require */

'use strict';

// @TODO: Async loading (Promise)
var htmlLoad = require('./html-load');
var blocksParser = require('./blocks');

// Todos os arquivos existentes neste template
var ALL_FILES = [];

// Todas as strings de apoio usados nos templates para logs e exceções
var ALL_STRINGS = [];

/**
 * Registra uma string usada no template e retorna o índice do mesmo
 *
 * @param str
 * @returns {number}
 */
function getString(str) {
    if (ALL_STRINGS.indexOf(str) < 0) {
        ALL_STRINGS.push(str);
    }

    return ALL_STRINGS.indexOf(str);
}

/**
 * Utilitário para obter um nome de variável único
 */
var getVariable = (function () {
    var VARIABLE_INDEX = 0;
    var VARIABLE_CHAR_CODE = 97;

    return function () {
        var variable = String.fromCharCode(VARIABLE_CHAR_CODE);
        if (VARIABLE_INDEX > 0) {
            variable += VARIABLE_INDEX;
        }


        VARIABLE_CHAR_CODE++;
        if (VARIABLE_CHAR_CODE > 122) {
            VARIABLE_CHAR_CODE = 97;
            VARIABLE_INDEX++;
        }

        return '_' + variable;
    }
})();

var FN_LOOP = [
    'function __loop(iterator, value) {',
    '    if (value) {',
    '        var i, l;',
    '        if (Array.isArray(value)) {',
    '            for (i = 0, l = value.length; i < l; i++) {',
    '                iterator(i, value[i]);',
    '            }',
    '        } else {',
    '            for (i in value) {',
    '                if (!value.hasOwnProperty(i)) {',
    '                    continue;',
    '                }',
    '                iterator(i, value[i]);',
    '            }',
    '        }',
    '    }',
    '}',
].join('').replace(/\s+/g, ' ');

// Permite estourar uma exceção
var FN_RAISE = [
    'function __raise(file, line, column, msg, cause) {',
    ' if(cause) { msg += " (" + cause.message + ")";}',
    ' msg += "\\n    at " + __files[file] + ":" + line + ":" + column;',
    ' throw new Error(msg);',
    '}'
].join('');

/*
 * escape-html
 *
 * Copyright(c) 2012-2013 TJ Holowaychuk
 * Copyright(c) 2015 Andreas Lubbe
 * Copyright(c) 2015 Tiancheng "Timothy" Gu
 * MIT Licensed
 *
 * https://github.com/component/escape-html/blob/master/index.js
 *
 * @type {string}
 */
var ESCAPE_HTML_MIN = 'var __escape_html_regex=/["\'&<>]/;function __escape_html(e){var a,t=""+e,r=__escape_html_regex.exec(t);if(!r)return t;var c="",s=0,n=0;for(s=r.index;s<t.length;s++){switch(t.charCodeAt(s)){case 34:a="&quot;";break;case 38:a="&amp;";break;case 39:a="&#39;";break;case 60:a="&lt;";break;case 62:a="&gt;";break;default:continue}n!==s&&(c+=t.substring(n,s)),n=s+1,c+=a}return n!==s?c+t.substring(n,s):c}';

/**
 * Elementos html que não possui filhos
 *
 * @type {string[]}
 */
const EMPTY_ELEMENTS = [
    "DOCTYPE",
    "area",
    "base",
    "basefont",
    "br",
    "col",
    "command",
    "embed",
    "frame",
    "hr",
    "img",
    "input",
    "isindex",
    "keygen",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr"
];

/**
 * Gera nome de variável
 *
 * @param attribute
 * @returns {string}
 */
function camelize(attribute) {
    return attribute
        .replace(/[^a-z$_]/gi, ' ')
        .replace(/^\s*|\s*$/g, '')
        .replace(/\s+([a-z])/gi, function ($0, $1) {
            return $1.toUpperCase()
        });
}

/**
 * Transforma um texto puro em variáveis valoráveis
 *
 * !{expressao} #{expressao}
 *
 * @param text
 */
function parseExpressions(text, line, column, file) {
    text = text
        .replace(/(^[\s\n\r]+)/g, function ($0, $1) {
            var parts = $1.split('\n');
            line += parts.length - 1;
            column = parts.pop().length;
            return ''
        })
        .replace(/^\s*|\s*$/g, '');

    // O conteúdo sendo processado
    var content = '';

    // Ponteiros
    var i = 0;
    var l = text.length;

    // Indica a posição (linha e bloco) do início do conteúdo
    var contentStartLine = line;
    var contentStartColumn = column;

    // Está processando uma expressão (iniciou em "!{" ou "#{")
    var inExpression = false;

    // Permite descobrir a quantiade de chaves abertas dentro de uma expressão
    var innerBrackets = 0;

    // As expressões processadas
    var expressions = [];

    for (; i < l; i++) {
        var c = text[i];
        var next = text[i + 1];
        var prev = text[i - 1];

        if (c === '\n') {
            line++;
            column = 0;
        }

        column++;

        if (!inExpression) {
            if ((c === '!' || c === '#') && next === '{') {
                inExpression = true;
                if (content !== '') {
                    expressions.push('' + JSON.stringify(content));
                }
                content = '';
                contentStartLine = line;
                contentStartColumn = column;
            }
        } else {
            if (c === '{' && prev === '\\') {
                innerBrackets++;
            } else if (c === '}') {
                if (innerBrackets > 0) {
                    innerBrackets--;
                } else {

                    inExpression = false;
                    var expressionValue = content.substr(2);
                    expressions.push(
                        '(function(){ try{ return ' +
                        (content[0] === '#' ? '__escape_html(' + expressionValue + ')' : expressionValue) +
                        '; } catch(e){ __raise(' + file + ',' + contentStartLine + ',' + contentStartColumn +
                        ", [__strings[" + getString('Error in expression') + "],__strings[" + getString(JSON.stringify(expressionValue)) + "]].join(' '), e)} return '';})()"
                    );
                    content = '';
                    contentStartLine = line;
                    contentStartColumn = column;
                    continue;
                }
            }
        }

        content += c;
    }

    // Se não houver expressões, a renderização usará o conteúdo bruto
    if (expressions.length === 0) {
        return undefined;
    }

    if (content !== '') {
        expressions.push('' + JSON.stringify(content));
    }

    return expressions;
}


/**
 * Faz o parsing de um html
 *
 * @param filePath
 * @param fileLoader
 * @param locals
 * @returns {{parent: null, children: Array, attributes: {}, tag: string}[]}
 */
function parseTree(filePath, fileLoader, locals) {

    // Limpa as variaveis de contexto
    ALL_FILES = [];
    ALL_STRINGS = [];

    // <extends/>, <include/>
    var html = htmlLoad(filePath, {
        fileLoader: fileLoader
    });
    html = blocksParser(html);

    // Está processando uma tag
    var inTag = false;

    // Está processando o nome da tag
    var inTagName = false;

    // Está processando o nome de um atributo de uma TAG
    var inAttributeName = false;

    // Está processando um valor de um atributo de uma TAG
    var inAttributeValue = false;

    // O elemento atual sendo processado
    var NODE = {
        tag: 'root',
        attributes: {},
        children: [],
        parent: null
    };

    // A árvore de elementos
    var TREE = [NODE];

    // Informações sobre o atributo atual sendo processado
    var ATTRIBUTE;

    // Conteúdo sendo processado (nome de tag, de atributos, valores, inner text, etc)
    var content = '';

    // Variável auxiliar para tratar conteúdo limpo (trim)
    var contentTrim = '';

    // contadores
    var i = 0;
    var l = html.length;

    // Informações sobre a linha, arquivo e bloco atual
    var line, file, column = 0;

    // Indica a posição (linha e bloco) do início do conteúdo
    var contentStartLine = 1;
    var contentStartColumn = 1;

    /**
     * A cada quebra de linha, obtém a linha atual e o nome do arquivo.
     *
     * O loader prefixa todos as linhas do arquivo carregado no formato abaixo
     *
     * "<LINHA> <NOME_ARQUIVO>|<CONTEUDO_ORIGINAL>".
     *
     * Esse método remove a linha, o nome do arquivo e o marcador, permitindo o processamento do conteúdo no
     * loop principal
     *
     * @param c
     */
    var checkFileLine = function (c) {
        if (c === '\n') {
            var lineFile = '';
            c = '';
            while (c !== '|') {
                lineFile += c;
                c = html[++i];
            }
            var parts = lineFile.split(' ');
            line = Number.parseInt(parts[0], 10);
            file = parts[1];
            if (ALL_FILES.indexOf(file) < 0) {
                ALL_FILES.push(file);
            }
            file = ALL_FILES.indexOf(file);
            column = 0;
        }
    };

    /**
     * Faz o incremento do ponteiro enquanto a condição for satisfeita
     *
     * @param cond
     */
    var incWhile = function (cond) {
        var c = html[++i];
        column++;
        while (true) {
            checkFileLine(c);
            if (!cond(c)) {
                break;
            }
            c = html[++i];
            column++;
        }
    };

    /**
     * Limpa o conteúdo e faz a marcação do seu início
     */
    var contentClear = function () {
        content = '';
        contentStartLine = line;
        // +1 = Esse método sempre é invocado antes de incrementar o bloco (i++)
        contentStartColumn = column + 1;
    };

    // Fluxo principal
    for (; i < l; i++, column++) {
        var c = html[i];
        checkFileLine(c);

        var next = html[i + 1];
        if (!inTag && c === '<') {

            if (next === '/') {
                // Close tag

                // Check for close tag
                var closeTag = '';
                incWhile(function (c) {
                    if (c !== '>') {
                        closeTag += c;
                        return true;
                    }
                    return false;
                });

                if (closeTag === ('/' + NODE.tag)) {
                    contentTrim = content.replace(/^\s*|\s*$/g, '');
                    if (contentTrim !== '') {
                        NODE.children.push({
                            tag: 'TEXT',
                            content: contentTrim,
                            expressions: parseExpressions(content, contentStartLine, contentStartColumn, file),
                            attributes: [],
                            children: [],
                            parent: NODE,
                            line: contentStartLine,
                            file: file,
                            column: contentStartColumn
                        });
                    }
                    contentClear();
                    NODE = NODE.parent;

                    // c = <

                } else {
                    content += closeTag;
                }
            } else if (next === '!') {
                // <!DOCTYPE html> || <!--...-->
                if (html[i + 2] === '-') {
                    // COMMENT
                    contentClear();
                    incWhile(function (c) {

                        content += c;

                        if (content.endsWith('-->')) {
                            return false;
                        }
                        return true;
                    });

                    // NODE.children.push({
                    //     tag: 'COMMENT',
                    //     attributes: [],
                    //     children: [],
                    //     // Remove "!--" and "-->"
                    //     content: content.substr(3, content.length - 6),
                    //     parent: NODE
                    // });
                    contentClear();
                } else {
                    // DOCTYPE
                    inTag = true;
                    inTagName = true;
                    var NEWNODE = {
                        tag: 'DOCTYPE',
                        attributes: [],
                        children: [],
                        parent: NODE,
                        line: line,
                        file: file,
                        column: column
                    };
                    NODE.children.push(NEWNODE);
                    NODE = NEWNODE;
                }
            } else {
                contentTrim = content.replace(/^\s*|\s*$/g, '');
                if (contentTrim !== '') {
                    NODE.children.push({
                        tag: 'TEXT',
                        content: contentTrim,
                        expressions: parseExpressions(content, line, column, file),
                        attributes: [],
                        children: [],
                        parent: NODE,
                        line: contentStartLine,
                        file: file,
                        column: contentStartColumn
                    });
                }
                contentClear();
                inTag = true;
                inTagName = true;
                var NEWNODE = {
                    tag: '',
                    attributes: [],
                    children: [],
                    parent: NODE,
                    line: line,
                    file: file,
                    column: column
                };
                NODE.children.push(NEWNODE);
                NODE = NEWNODE;
            }
            continue;
        } else if (inTag) {

            if (c === '>' && !inAttributeValue) {
                if (!NODE.tag) {
                    NODE.tag = content;
                }

                contentTrim = content.replace(/^\s*|\s*$/g, '');
                if (inAttributeName && contentTrim !== '' && contentTrim !== '/') {
                    ATTRIBUTE = {
                        name: contentTrim,
                        value: '',
                        line: line,
                        file: file,
                        column: column
                    };
                    NODE.attributes.push(ATTRIBUTE);
                }

                if (html[i - 1] === '/' || EMPTY_ELEMENTS.indexOf(NODE.tag) >= 0) {
                    // Self close tag
                    NODE = NODE.parent;
                }

                inTag = false;
                inTagName = false;
                inAttributeName = false;
                inAttributeValue = false;
                contentClear();
                continue;
            }

            if (inTagName) {
                if (c === ' ' || c === '\n') {
                    inTagName = false;
                    inAttributeName = true;
                    NODE.tag = content.replace(/^\s*|\s*$/g, '');
                    if (NODE.tag === '!DOCTYPE') {
                        NODE.tag = 'DOCTYPE';
                    }
                    contentClear();
                }
            } else if (inAttributeName) {


                if (next === '/') {
                    // Self close tag
                    continue;
                }
                contentTrim = content.replace(/^\s*|\s*$/g, '');

                if (c === '=' || (c === ' ' && contentTrim !== '')) {
                    ATTRIBUTE = {
                        name: contentTrim,
                        value: '',
                        line: line,
                        file: file,
                        column: column - contentTrim.length
                    };
                    NODE.attributes.push(ATTRIBUTE);

                    contentClear();

                    if (c === ' ') {
                        // Next attribute
                        inAttributeName = true;
                        inAttributeValue = false;
                    } else {
                        incWhile(function (c) {
                            return c !== '"';
                        });
                        inAttributeName = false;
                        inAttributeValue = true;
                    }
                    continue;
                }
            } else if (inAttributeValue) {
                if (c === '"') {
                    inAttributeName = true;
                    inAttributeValue = false;
                    ATTRIBUTE.value = content.replace(/^\s*|\s*$/g, '');
                    ATTRIBUTE.expressions = parseExpressions(content, line, column, file);
                    contentClear();
                    continue;
                }
            }
        }

        content += c;
    }


    return TREE;
}


/**
 * Faz a renderização dos atributos de uma TAG
 *
 * @param attributes
 * @returns {string}
 */
function renderAttributes(attributes) {
    let out = attributes
        .map(function (attr) {
            if (attr.expressions) {
                var expressions = attr.expressions
                    .map(function (exp) {
                        return 'out += ' + exp
                    })
                    .join(';');
                return attr.name + "=\"'; " + expressions + ";out += '\"";
            } else if (attr.value) {
                return attr.name + '=' + JSON.stringify(attr.value);
            }

            return attr.name;
        })
        .join(' ');
    if (out !== '') {
        return ' ' + out;
    }
    return '';
}


/**
 * Gera o conteúdo compilado
 *
 * @param NODE
 * @param content
 * @param MIXINS
 * @returns {*}
 */
function compileFunctionBody(NODE, content, MIXINS) {
    switch (NODE.tag) {
        case 'DOCTYPE':
            content += "out += '<!DOCTYPE" + renderAttributes(NODE.attributes) + ">';";
            break;
        case 'TEXT':
            if (NODE.expressions) {
                var expressions = NODE.expressions
                    .map(function (exp) {
                        return 'out += ' + exp
                    })
                    .join(';');
                content += expressions + ';';
            } else {
                content += "out += " + JSON.stringify(NODE.content) + ";";
            }
            break;
        // case 'COMMENT':
        //     content += 'out += "<!--${JSON.stringify(NODE.content)}-->";';
        //     break;
        case 'vars':
            NODE.attributes.forEach(function (attr) {
                var value = attr.value;

                if (attr.expressions) {
                    if (attr.expressions.length > 1) {
                        var expressions = attr.expressions
                            .map(function (exp) {
                                return 'out += ' + exp
                            })
                            .join(';');
                        value = "(function(){ var out = ''; " + expressions + "; return out;})()"
                    } else {
                        value = attr.expressions[0]
                    }
                }

                if (["'", '{', '(', '[', '!'].indexOf(value[0]) >= 0 || ['true', 'false', 'null', 'undefined'].indexOf(value) >= 0 || value.match(/\d+/)) {
                    content += 'var ' + camelize(attr.name) + ' = ' + value + ';';
                } else {
                    content += 'var ' + camelize(attr.name) + ' = ' + JSON.stringify(value) + ';';
                }
            });
            break;
        case 'if':
            var conditionAttr = NODE.attributes.find(function (value) {
                return value.name === 'cond';
            }) || {value: 'false', line: 0, column: 0};

            var cond = getVariable();

            content += 'var ' + cond + ' = false; try { ' + cond + ' = ' + conditionAttr.value + '; } catch(e) {';
            content += ' __raise(' + conditionAttr.file + ',' + conditionAttr.line + ',' + conditionAttr.column +
                ", [__strings[" + getString('Error on condition') + "], __strings[" + getString(JSON.stringify(conditionAttr.value)) + "]].join(' '), e);";
            content += '} if(' + cond + ') {';
            if (NODE.children && NODE.children.length > 0) {
                NODE.children.forEach(function (child) {
                    content = compileFunctionBody(child, content, MIXINS);
                });
            }
            content += '}';
            break;
        case 'each':
            // var="value" in="specs"
            var varAttr = NODE.attributes.find(function (value) {
                return value.name === 'var';
            }) || {value: undefined};


            var inAttr = NODE.attributes.find(function (value) {
                return value.name === 'in';
            }) || {value: '[]'};

            var value = inAttr.value;
            var keyName = '$key';
            var valueName = '$value';
            var keyValueName = varAttr.value;
            if (keyValueName) {
                // No formato var="$key:$value"
                var parts = keyValueName.match(/([a-z_][a-z0-9_]*)(?:,([a-z_][a-z0-9_]*))?/gi);
                if (parts.length > 1) {
                    keyName = parts[0];
                    valueName = parts[1];
                } else {
                    valueName = parts[0];
                }
            }

            var iterate = getVariable();
            var variable = getVariable();
            var i = getVariable();
            var l = getVariable();

            content += 'var ' + iterate + ' = function(' + keyName + ', ' + valueName + '){';
            if (NODE.children && NODE.children.length > 0) {
                NODE.children.forEach(function (child) {
                    content = compileFunctionBody(child, content, MIXINS);
                });
            }
            content += '};';

            content += [
                'var ' + variable + ' = false, ' + i + ', ' + l + ';',
                "try{ " + variable + " = " + value + ";} catch(e) { console.error(e); }",
                'if(' + variable + ') { __loop(' + iterate + ', ' + variable + '); }'
            ].join('');

            break;

        case 'mixin':
            // name="feature-group" params="title, description"
            var nameAttr = NODE.attributes.find(function (value) {
                return value.name === 'name';
            }) || {value: undefined};

            var paramsAttr = NODE.attributes.find(function (value) {
                return value.name === 'params';
            }) || {value: ''};

            // @TODO: Validar nome obrigatório

            var params = paramsAttr.value.split(',').map(function (param) {
                return {
                    name: camelize(param)
                };
            });
            var name = nameAttr.value;
            var nameCamel = camelize(name);

            MIXINS[name] = {
                name: nameCamel,
                params: params
            };

            var paramNames = ['$content']
                .concat(params.map(function (param) {
                    return param.name;
                }))
                .filter(function (param) {
                    return param !== ''
                })
                .join(', ');

            content += 'function ' + nameCamel + '(' + paramNames + '){ var out = "";';
            if (NODE.children && NODE.children.length > 0) {
                NODE.children.forEach(function (child) {
                    content = compileFunctionBody(child, content, MIXINS);
                });
            }
            content += ' return out;}';
            break;
        default:
            if (EMPTY_ELEMENTS.indexOf(NODE.tag) >= 0) {
                content += "out += '<" + NODE.tag + renderAttributes(NODE.attributes) + ">';";

                // @TODO: Doctipe self-close tag
                // if (html5) {
                //     content += '>';
                // } else {
                //     content += '/>';
                // }
            } else {
                if (MIXINS[NODE.tag]) {
                    var mixin = MIXINS[NODE.tag];

                    NODE.attributes.forEach(function (attr) {
                        attr._camelized = camelize(attr.name);
                    });

                    var params = mixin.params.map(function (param) {
                        var attr = NODE.attributes.find(function (value) {
                            return value._camelized === param.name;
                        }) || {value: 'undefined'};

                        var value = attr.value;

                        if (attr.expressions) {
                            if (attr.expressions.length > 1) {
                                var expressions = attr.expressions
                                    .map(function (exp) {
                                        return 'out += ' + exp
                                    })
                                    .join(';');
                                value = "(function(){ var out = ''; " + expressions + "; return out;})()"
                            } else {
                                value = attr.expressions[0]
                            }
                        }

                        if (["'", '{', '(', '[', '!'].indexOf(value[0]) >= 0 || ['true', 'false', 'null', 'undefined'].indexOf(value) >= 0 || value.match(/^[\d.]+$/g)) {
                            return value;
                        }

                        return '' + JSON.stringify(value);
                    });

                    var innerContent = "''";
                    if (NODE.children && NODE.children.length > 0) {
                        innerContent = "(function(){ var out = '';";
                        NODE.children.forEach(function (child) {
                            innerContent = compileFunctionBody(child, innerContent, MIXINS);
                        });
                        innerContent += ' return out;})()';
                    }

                    content += "out += " + mixin.name + "(" + innerContent + ", " + params.join(',') + ");";
                } else {
                    if (NODE.tag !== 'root') {
                        content += "out += '<" + NODE.tag + renderAttributes(NODE.attributes) + ">';";
                    }

                    if (NODE.children && NODE.children.length > 0) {
                        NODE.children.forEach(function (child) {
                            content = compileFunctionBody(child, content, MIXINS);
                        });
                    }

                    if (NODE.tag !== 'root' && EMPTY_ELEMENTS.indexOf(NODE.tag) < 0) {
                        content += "out += '</" + NODE.tag + ">';";
                    }
                }

            }
    }

    return content;
}


/**
 *
 * @param {String} filePath
 * @param {Function} fileLoader
 * @param {Object} locals
 * @returns {String}
 */
function htmlImproved(filePath, fileLoader, locals) {

    var DOM = parseTree(filePath, fileLoader, locals);

    // var cache = [];
    // console.log(JSON.stringify(DOM, function (key, value) {
    //     if (typeof value === 'object' && value !== null) {
    //         if (cache.indexOf(value) !== -1) {
    //             // Circular reference found, discard key
    //             return;
    //         }
    //         // Store value in our collection
    //         cache.push(value);
    //     }
    //     return value;
    // }));
    // cache = null; // Enable garbage collection

    var content = ESCAPE_HTML_MIN;
    content += 'var __files = ' + JSON.stringify(ALL_FILES) + ';';
    content += 'var __strings = ' + JSON.stringify(ALL_STRINGS) + ';';
    content += FN_LOOP;
    content += FN_RAISE;
    content += 'var out = "";';
    content = compileFunctionBody(DOM[0], content, {});
    content += 'return out;';

    try {
        var fn = new Function('locals', content);
        return fn(locals);
    } catch (e) {
        console.error(content);
        console.error(e);

        throw e;
    }
}

module.exports = htmlImproved;
