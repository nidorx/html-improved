
/* global __dirname */


var fs = require('fs');
var path = require('path');
var assert = require("assert");
var htmlImproved = (fs.existsSync(path.join(__dirname, './../lib-cov')))
        ? require('./../lib-cov/index')
        : require('./../lib/index');

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
    },
    'Exceptions': {
        'Não deve permitir herança cíclica': [
            'inheritance-cyclic.html',
            'Cyclic/recursive inheritance identified'
        ],
        'Não deve permitir herança múltipla': [
            'inheritance-multiple.html',
            'Identified multiple inheritance'
        ],
        'Não deve permitir include cíclico': [
            'include-cyclic.html',
            'Cyclic/recursive include identified'
        ],
        'Os parametros de um mixin devem ser válidos': [
            'invalid-mixin-parameter.html',
            'Mixin created with invalid parameter'
        ],
    }
};


var cleanHtml = function (html) {
    return html.replace(/(\n)/g, '').replace(/(\s+)/g, '');
};

var doTestFile = function (info, callback) {

};

for (var groupName in TEST_LIST) {
    describe(groupName, function () {
        for (var testDescription in TEST_LIST[groupName]) {
            (function (testInfo) {
                var filePath = testInfo;
                var erroMessage;
                if (Array.isArray(testInfo)) {
                    filePath = testInfo[0];
                    erroMessage = testInfo[1];
                }

                it(testDescription, function () {
                    if (erroMessage) {
                        assert.throws(function () {
                            htmlImproved(path.join(TESTE_FILES_DIR, filePath));
                        }, function (err) {
                            var regx = (RegExp('^' + (erroMessage.replace(/([/])/g, '\\$1'))));
                            //console.log('regx', regx, err.message)
                            if ((err instanceof Error) && regx.test(err.message)) {
                                return true;
                            }
                        });
                    } else {
                        var data = (fs.readFileSync(path.join(EXPECTED_FILES_DIR, filePath)) + '');
                        var html = htmlImproved(path.join(TESTE_FILES_DIR, filePath));
                        assert.equal(cleanHtml(html), cleanHtml(data + ''));
                    }
                });
            })(TEST_LIST[groupName][testDescription]);
        }
    });
}




