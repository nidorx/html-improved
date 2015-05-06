

var operatorsRegExp = /"(?:[^"]|\\")*"|'(?:[^']|\\')*'|\s+(?:and|or|lt|gt|eq|ne|lt|gt|ge|le)\s+/g;
var replacements = {
    'and': ' && ',
    'or': ' || ',
    'eq': ' === ',
    'ne': ' !== ',
    'lt': ' < ',
    'gt': ' > ',
    'ge': ' >= ',
    'le': ' <= '
};

function handleBinaryOperators(str) {
    return str.replace(operatorsRegExp, function (match) {
        return replacements[match.trim()] || match;
    });
}

function Expression(expression, replaceSpecialOperators) {
    if (!expression) {
        throw new Error('expression argument is required');
    }
    if (replaceSpecialOperators !== false && typeof expression === 'string') {
        expression = handleBinaryOperators(expression);
    }
    this.expression = expression;
}

Expression.prototype = {
    getExpression: function () {
        return this.expression;
    },
    toString: function () {
        return this.expression.toString();
    }
};




