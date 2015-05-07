'use strict';

var _ = require('lodash');
var varsParser = require('./vars');
var conditionalParser = require('./conditional');

var Mixin = function (name, template, params) {
    this.name = name;
    this.template = template;
    this.params = (!params) ? [] : params.split(',').map(function (param) {
        param = param.replace(/(^\s*)|(\s*$)/g, '');
        if (!(/(^[a-z_])([a-z0-9_]*)$/gi).test(param)) {
            throw new Error('Mixin created with invalid parameter: "' + param + '"');
        }
        return param;
    });
};


var Mixins = function () {
    this.mixins = {};
};

Mixins.prototype.getMixin = function (name) {
    return this.mixins[name];
};

Mixins.prototype.registerMixin = function (name, template, params) {
    var mixin = new Mixin(name, template, params);
    if (this.mixins[name]) {
        //console.log('mixin com o nome "' + name + '" atualizado para <![[\n' + template + '\n]]>');
    } else {
        //console.log('mixin criado com o nome "' + name + '" e o template <![[\n' + template + '\n]]>');
    }
    this.mixins[name] = mixin;
};

Mixins.prototype.getList = function () {
    return _.uniq(_.keys(this.mixins));
};

/**
 * Faz o processamento de um html, executando todos os mixins registrados
 *
 * @param {String} html
 * @param {Object} variables
 * @returns {String} O html processado
 */
Mixins.prototype.processHtml = function (html, variables) {
    var that = this;
    _.each(this.getList(), function (mixinName) {
        html = that._processMixinCalls(html, mixinName, variables);
    });
    return html;
};

/**
 * Faz o processamento de um html, executando um mixin específico
 *
 * @param {String} html
 * @param {String} mixinName
 * @param {Object} variables
 * @returns {String}
 */
Mixins.prototype._processMixinCalls = function (html, mixinName, variables) {
    var regex = new RegExp('<(\/)?' + mixinName + '\\s*(?:>|([^>]*)?>)', 'gi');
    var elementsInfo = [];
    var elementActual;
    while (true) {
        var match = regex.exec(html);
        if (!match) {
            break;
        }
        var elementTag = match[0];
        var isOpeningTag = !match[1];
        var elementAttributes = match[2];
        var mayHaveContent = !elementTag.match(/\/>$/g);
        if (isOpeningTag) {
            var elementNew = {
                mixinName: mixinName,
                start: match.index,
                end: 0,
                contentStart: match.index + elementTag.length,
                contentEnd: 0,
                content: '',
                text: '',
                parent: elementActual,
                attributes: elementAttributes,
                children: []
            };
            elementsInfo.push(elementNew);

            if (elementActual) {
                elementActual.children.push(elementNew);
            }
            elementActual = elementNew;

            // tag sem conteúdo, <tag />
            if (!mayHaveContent) {
                elementActual.end = match.index + elementTag.length;
                elementActual.contentEnd = elementActual.contentStart;
                elementActual.content = '';
                elementActual.text = elementTag;
                // remove a barra final
                elementActual.attributes = elementAttributes.replace(/\/$/g, '');
                elementActual = (elementActual && elementActual.parent) ? elementActual.parent : null;
            }
        } else {
            elementActual.end = match.index + elementTag.length;
            elementActual.contentEnd = match.index;
            elementActual.content = html.substr(elementActual.contentStart, elementActual.contentEnd - elementActual.contentStart);
            elementActual.text = html.substr(elementActual.start, elementActual.end - elementActual.start);
            elementActual = (elementActual && elementActual.parent) ? elementActual.parent : null;
        }
    }

    // filtra apenas os elementos pai
    var elements = elementsInfo.filter(function (item) {
        return !item.parent;
    });

    //Faz as alterações no template para refletir a execuçaõ dos elementos
    var that = this;
    elements.forEach(function (element) {
        html = html.replace(element.text, that._processMixinCall(element, variables));
    });

    return html;
};

/**
 * Faz o processamento de uma chamada ao mixin
 *
 * @param {Object} elementInfo
 * @param {Object} variables
 * @returns {String}
 */
Mixins.prototype._processMixinCall = function (elementInfo, variables) {
    if (!variables) {
        variables = {};
    }

    var mixin = this.getMixin(elementInfo.mixinName);

    // as variáveis disponíveis para executar o mixin
    var mixinVariables = _.clone(variables, true);

    // validação dos atributos de execução do mixin
    if (elementInfo.attributes) {
        var mixinArgumentsCheck = {};
        elementInfo.attributes.replace(/([a-z_][a-z-_]*)="([^"]*)?"/gi, function ($0, attribute, value) {
            attribute = attribute.replace(/-([a-z])/g, function ($0, $1) {
                return $1.toUpperCase();
            });

            mixinVariables[attribute] = varsParser.evaluate(value, mixinVariables);

            if (mixin.params.indexOf(attribute) >= 0) {
                mixinArgumentsCheck[attribute] = true;
            }
        });

        // verifica se todos os parametros obrigatórios do mixin foram setados
        _.each(mixin.params, function (param) {
            if (!mixinArgumentsCheck.hasOwnProperty(param)) {
                throw new Error([
                    'Parâmetro "' + param + '" é requerido para o mixin "' + elementInfo.mixinName + '"',
                    ' proximo de: <![[\n' + elementInfo.text + '\n]]>>'
                ].join(''));
            }
        });
    }

    // renderiza os elementos filhos no template
    var that = this;
    elementInfo.children.forEach(function (child) {
        var childContent = that._processMixinCall(child, mixinVariables);
        elementInfo.content = elementInfo.content.replace(child.text, childContent);
    });

    // processa o template e os mixins filhos
    var mixinHtml = mixin.template;

    // <vars/> (geração das variaveis)
    mixinHtml = varsParser.parseHtml(mixinHtml, mixinVariables);

    // adiciona a variavel conteudo ao mixin
    mixinVariables.$content = elementInfo.content;

    //<if/> (condicionais, execução das condicionais para geração do template)
    mixinHtml = conditionalParser(mixinHtml, mixinVariables);

    // #{vars} (escapando as variaveis no template)
    mixinHtml = varsParser.escapeValues(mixinHtml, mixinVariables);

    return this.processHtml(mixinHtml, mixinVariables);
};

/**
 * Varre um html a procura de definições de mixins
 *
 * @param {String} html
 * @returns {String} O html processado
 */
Mixins.prototype.parseHtmlForInstances = function (html) {
    var regex = /<(\/)?mixin(?:\s*>|\s+([^>]*)?>)/g;
    var mixinsInfo = [];
    var mixinInfoActual;
    while (true) {
        var match = regex.exec(html);
        if (!match) {
            break;
        }
        var mixinTag = match[0];
        var isOpeningTag = !match[1];
        var mixinAttributes = match[2];
        var mayHaveContent = !mixinTag.match(/\/>$/g);
        if (isOpeningTag) {
            var mixinInfoNew = {
                start: match.index,
                end: 0,
                contentStart: match.index + mixinTag.length,
                contentEnd: 0,
                content: '',
                text: '',
                parent: mixinInfoActual,
                attributes: mixinAttributes,
                children: []
            };
            mixinsInfo.push(mixinInfoNew);

            if (mixinInfoActual) {
                mixinInfoActual.children.push(mixinInfoNew);
            }
            mixinInfoActual = mixinInfoNew;

            // tag sem conteúdo, <tag />
            if (!mayHaveContent) {
                mixinInfoActual.end = match.index + mixinTag.length;
                mixinInfoActual.contentEnd = mixinInfoActual.contentStart;
                mixinInfoActual.content = '';
                mixinInfoActual.text = mixinTag;
                // remove a barra final
                mixinInfoActual.attributes = mixinAttributes.replace(/\/$/g, '');
                mixinInfoActual = (mixinInfoActual && mixinInfoActual.parent) ? mixinInfoActual.parent : null;
            }
        } else {
            mixinInfoActual.end = match.index + mixinTag.length;
            mixinInfoActual.contentEnd = match.index;
            mixinInfoActual.content = html.substr(mixinInfoActual.contentStart, mixinInfoActual.contentEnd - mixinInfoActual.contentStart);
            mixinInfoActual.text = html.substr(mixinInfoActual.start, mixinInfoActual.end - mixinInfoActual.start);
            mixinInfoActual = (mixinInfoActual && mixinInfoActual.parent) ? mixinInfoActual.parent : null;
        }
    }

    // filtra apenas os mixins que nao possuem pai
    var mixins = mixinsInfo.filter(function (item) {
        return !item.parent;
    });

    // altera o template, removendo as definições dos mixins
    var that = this;
    mixins.forEach(function (mixinInfo) {
        that._parseMixinInfoHtmlContent(mixinInfo);
        html = html.replace(mixinInfo.text, '');
    });

    return html;
};


/**
 * Faz o processamento de um info de mixin
 *
 * @param {Object} mixinInfo
 * @returns {String}
 */
Mixins.prototype._parseMixinInfoHtmlContent = function (mixinInfo) {
    if (!mixinInfo.attributes) {
        // mixin inválido, necessita do nome
        return;
    }

    var mixinAttributes = {};
    mixinInfo.attributes.replace(/([a-z-]*)="([^"]*)?"/g, function ($0, attributeName, attributeValue) {
        attributeName = attributeName.replace(/-([a-z])/g, function ($0, $1) {
            return $1.toUpperCase();
        });
        mixinAttributes[attributeName] = attributeValue;
    });

    // um mixin precisa ter nome
    if (!mixinAttributes.name) {
        return;
    }

    // processa os mixins filhos deste
    var that = this;
    mixinInfo.children.forEach(function (child) {
        that._parseMixinInfoHtmlContent(child);
        mixinInfo.content = mixinInfo.content.replace(child.text, '');
    });

    // registra esse mixin
    this.registerMixin(mixinAttributes.name, mixinInfo.content, mixinAttributes.params);
};


module.exports = Mixins;