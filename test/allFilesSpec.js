/* global __dirname */


var fs = require('fs');
var path = require('path');
var assert = require("assert");
var htmlImproved = require('./../lib/index');

var TESTE_FILES_DIR = __dirname + '/files/';
var EXPECTED_FILES_DIR = TESTE_FILES_DIR + '/expected/';

var TEST_LIST = {
    'Funcionalidades': {
        'Deve permitir extends simples': 'extends-simple.html',
        'Deve permitir extends complexo (com mixins e etc)': 'extends-full.html',
        'Deve permitir include de arquivos raw': 'include-raw.html',
        'Deve permitir o uso de condicionais': 'conditional.html',
        'Deve permitir o uso de variáveis complexas': 'variables.html',
        'Deve permitir a definição de variáveis dentro do mixin': 'mixin-variables.html',
        'Deve permitir o uso de condicionais dentro do mixin': 'mixin-conditional.html',
        'Deve permitir loop (each)': 'loop.html',
    },
    'Exceptions': {
        'Não deve permitir herança cíclica': [
            'inheritance-cyclic.html',
            /Cyclic\/recursive inheritance identified/
        ],
        'Não deve permitir herança múltipla': [
            'inheritance-multiple.html',
            /Identified multiple inheritance/
        ],
        'Não deve permitir include cíclico': [
            'include-cyclic.html',
            /Cyclic\/recursive include identified/
        ],
        'Deve exibir erro quando expressão está errada': [
            'expression-error.html',
            /.*Error in expression "key" \(key is not defined\) at .*4:13/
        ]
    }
};


var cleanHtml = function (html) {
    return html.replace(/(\n)/g, '').replace(/(\s+)/g, '');
};

var doTestFile = function (info, callback) {

};

for (var groupName in TEST_LIST) {
    describe(groupName, function () {
        for (var title in TEST_LIST[groupName]) {
            (function (testInfo) {
                var file = testInfo;
                var errorPattern;
                if (Array.isArray(testInfo)) {
                    file = testInfo[0];
                    errorPattern = testInfo[1];
                }

                it(title, function () {
                    if (errorPattern) {
                        assert.throws(function () {
                            htmlImproved(path.join(TESTE_FILES_DIR, file));
                        }, errorPattern);
                    } else {
                        var data = (fs.readFileSync(path.join(EXPECTED_FILES_DIR, file)) + '');
                        var html = htmlImproved(path.join(TESTE_FILES_DIR, file));
                        assert.equal(cleanHtml(html), cleanHtml(data + ''));
                    }
                });
            })(TEST_LIST[groupName][title]);
        }
    });
}




