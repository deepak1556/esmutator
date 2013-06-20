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
}));