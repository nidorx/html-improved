#!/usr/bin/env node

var exec = require('child_process').exec;

(function (commands) {
    var next = function () {
        var command = commands.shift();
        if (!command) {
            return;
        }
        exec(command, function (err, stdout, stderr) {
            console.log(stdout);
            if (err) {
                console.log(stderr);
                throw err;
            }

            next();
        });
    };
    next();
})([
    'node \"./node_modules/jscoverage/bin/jscoverage\" lib lib-cov',
//    'node \"./node_modules/mocha/bin/_mocha\" -t 60000 -r jscoverage -R spec --covout=html test/'
    // test unitário
    'node \"./node_modules/mocha/bin/_mocha\" -R spec',
    // cobertura de teste unitario
    'node \"./node_modules/mocha/bin/_mocha\" -R html-cov > coverage.html'
]);