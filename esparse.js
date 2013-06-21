(function(root, factory) {
    if(typeof define === 'function' && define.amd) {
	define(['exports'], factory);
    }else if(typeof exports !== 'undefined') {
	factory('exports');
    }else {
	factory((root.esparse = {}));
    }
}(this, function(exports) {
    'use strict';

    var options, sourceFile, input, inputLen;

    function setOptions(opts) {
	options = opts || {};
	for (var opt in defaultOptions) if (!Object.prototype.hasOwnProperty.call(options, opt))
	    options[opt] = defaultOptions[opt];
	sourceFile = options.sourceFile || null;
    }

    var getLineInfo = exports.getLineInfo = function(input, offset) {
	for (var line = 1, cur = 0;;) {
	    lineBreak.lastIndex = cur;
	    var match = lineBreak.exec(input);
	    if (match && match.index < offset) {
		++line;
		cur = match.index + match[0].length;
	    } else break;
	}
	return {line: line, column: offset - cur};
    };
}));