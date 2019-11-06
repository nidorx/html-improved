/* global require */

'use strict';

var htmlLoad = require('./html-load');
var blocksParser = require('./blocks');

const ESCAPE_HTML_SRC = 'var matchHtmlRegExp=/["\'&<>]/;function escapeHtml(e){var a,t=""+e,r=matchHtmlRegExp.exec(t);if(!r)return t;var c="",s=0,n=0;for(s=r.index;s<t.length;s++){switch(t.charCodeAt(s)){case 34:a="&quot;";break;case 38:a="&amp;";break;case 39:a="&#39;";break;case 60:a="&lt;";break;case 62:a="&gt;";break;default:continue}n!==s&&(c+=t.substring(n,s)),n=s+1,c+=a}return n!==s?c+t.substring(n,s):c}';

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
function parseExpressions(text) {
    var i = 0;
    var content = '';
    var l = text.length;
    var inExpression = false;
    var innerBrackets = 0;
    var expressions = [];
    for (; i < l; i++) {
        var c = text[i];
        var next = text[i + 1];
        var prev = text[i - 1];

        if (!inExpression) {
            if ((c === '!' || c === '#') && next === '{') {
                inExpression = true;
                if (content !== '') {
                    expressions.push('' + JSON.stringify(content));
                }
                content = '';
            }
        } else {
            if (c === '{' && prev === '\\') {
                innerBrackets++;
            } else if (c === '}') {
                if (innerBrackets > 0) {
                    innerBrackets--;
                } else {
                    inExpression = false;
                    expressions.push(
                        '(function(){ try{ return ' +
                        (content[0] === '#' ? 'escapeHtml(' + content.substr(2) + ')' : content.substr(2))
                        + '; } catch(e){} return "";})()'
                    );
                    content = '';
                    continue;
                }
            }
        }


        content += c;
    }

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

    // @TODO: Line, Column
    var inTag = false;
    var inTagName = false;
    var inAttributeName = false;
    var inAttributeValue = false;
    var inSpace = false;
    var NODE = {
        tag: 'root',
        attributes: {},
        children: [],
        parent: null
    };
    var TREE = [NODE];
    var ATTRIBUTE;
    var content = '';
    var contentTrim = '';

    // <extends/>, <include/>
    var html = htmlLoad(filePath, {
        fileLoader: fileLoader
    });

    html = blocksParser(html);

    var i = 0;
    var l = html.length;

    function incWhile(cond) {
        while (cond(html[++i])) {
            continue;
        }
    }


    for (; i < l; i++) {
        var c = html[i];
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
                            expressions: parseExpressions(contentTrim),
                            attributes: [],
                            children: [],
                            parent: NODE
                        });
                    }
                    content = '';
                    NODE = NODE.parent;

                    // c = <

                } else {
                    content += closeTag;
                }
            } else if (next === '!') {
                // <!DOCTYPE html> || <!--...-->
                if (html[i + 2] === '-') {
                    // COMMENT
                    content = '';
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
                    content = '';
                } else {
                    // DOCTYPE
                    inTag = true;
                    inTagName = true;
                    var NEWNODE = {
                        tag: 'DOCTYPE',
                        attributes: [],
                        children: [],
                        parent: NODE
                    }
                    NODE.children.push(NEWNODE);
                    NODE = NEWNODE;
                }
            } else {
                contentTrim = content.replace(/^\s*|\s*$/g, '');
                if (contentTrim !== '') {
                    NODE.children.push({
                        tag: 'TEXT',
                        content: contentTrim,
                        expressions: parseExpressions(contentTrim),
                        attributes: [],
                        children: [],
                        parent: NODE
                    });
                }
                content = '';
                inTag = true;
                inTagName = true;
                var NEWNODE = {
                    tag: '',
                    attributes: [],
                    children: [],
                    parent: NODE
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
                        value: ''
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
                content = '';
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
                    content = '';
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
                        value: ''
                    };
                    NODE.attributes.push(ATTRIBUTE);

                    content = '';

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
                    ATTRIBUTE.expressions = parseExpressions(ATTRIBUTE.value);
                    content = '';
                    continue;
                }
            }
        }

        content += c;
    }


    return TREE;
}

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
            }) || {value: 'false'};

            content += '(function(){ var cond = false; try { cond = ' + conditionAttr.value + '; } catch(e) { } if(cond) {';
            if (NODE.children && NODE.children.length > 0) {
                NODE.children.forEach(function (child) {
                    content = compileFunctionBody(child, content, MIXINS);
                });
            }
            content += '}})();';
            break;
        case 'each':
            // var="value" in="specs"
            var varAttr = NODE.attributes.find(function (value) {
                return value.name === 'var';
            }) || {value: undefined};


            var inAttr = NODE.attributes.find(function (value) {
                return value.name === 'in';
            }) || {value: '[]'};

            var variable = inAttr.value;
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

            content += [
                '(function(iterate){',
                '  var variable = false;',
                "  try{ variable = " + variable + ";} catch(e) { console.error(e); }",
                "  if(!variable) { return '' }",
                '  if (Array.isArray(variable)) {',
                '      for (var i = 0, l = variable.length; i < l; i++) {',
                '          iterate(i, variable[i]);',
                '      }',
                '  } else {',
                '      for (var i in variable) {',
                '          if (!variable.hasOwnProperty(i)) {',
                '              continue;',
                '          }',
                '          iterate(i, variable[i]);',
                '      }',
                '  }',
                '})(function(' + keyName + ', ' + valueName + '){',
            ].join('');
            if (NODE.children && NODE.children.length > 0) {
                NODE.children.forEach(function (child) {
                    content = compileFunctionBody(child, content, MIXINS);
                });
            }
            content += '});';
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

            var paramNames = params.map(function (param) {
                return param.name;
            }).join(', ');

            content += 'function ' + nameCamel + '($content, ' + paramNames + '){ var out = "";';
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

                        if (["'", '{', '(', '[', '!'].indexOf(value[0]) >= 0 || ['true', 'false', 'null', 'undefined'].indexOf(value) >= 0 || value.match(/\d+/)) {
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
var htmlImproved = function (filePath, fileLoader, locals) {

    var DOM = parseTree(filePath, fileLoader, locals);
    var content = `${compileFunctionBody(DOM[0], ESCAPE_HTML_SRC + 'var out = "";', {})} return out;`;

    try {
        var fn = new Function('locals', content);
        return fn(locals);
    } catch (e) {
        console.error(content);

        throw e;
    }
};

module.exports = htmlImproved;
