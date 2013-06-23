function(exports, opts) {
    "use strict";

    var options, input, inputLen, record;

    var defaultOptions = exports.defaultOptions = {
	strictSemicolons: false,
	allowTrailingCommas: true,
	forbidReserved: false,
	locations: false,
	onComment: null,
	ranges: false,
	existingTree: null,
	record: null
    }

    exports.parse = function(inpt, opts) {
	input = String(inpt);
	inputLen = input.length;
	setOptions(opts);
	initToken();
	return parseTopLevel(options.existingTree);
    }

    function setOptions(opts) {
	options = opts || {};
	for(var opt in defaultOptions) {
	    if(!Object.prototype.hasOwnProperty.call(options, opt)) {
		options[opt] = defaultOptions[opt];
	    }
	}
	record = options.record || null;
    }

    var getLineInfo = exports.getLineInfo = function(input, offset) {
	for(var line=1, cur = 0;;) {
	    lineBreak.lastIndex = cur;
	    var match = lineBreak.exec(input);
	    if(match && match.index < offset) {
		++line;
		cur = match.index + match[0].length;
	    }else {
		break;
	    }   
	}

	return {line: line, column: offest - cur};
    }

    exports.tokenize = function(inpt, opts) {
	input = String(inpt);
	inputLen = input.length;
	setOptions(opts);
	initToken();

	var t = {};
	function getToken(forcedregExp) {
	    t = readToken(forcedRegToken);
	    t.startLoc = tokstartloc;
	    t.endLoc = tokendloc;

	    return t;
	}

	getToken.jumpTo = function(pos, regallowed) {
	    tokpos = pos;
	    if(options.locations) {
		tokcurline = toklinestart = lineBreak.lastIndex = 0;
		var match;
		while((match = lineBreak.exec(input) && match.index < pos)) {
		    ++tokcurline;
		    toklinestart = match.index + match[0].length;
		}
	    }

	    var ch = input.charAt(pos - 1);
	    tokregexallowed = regallowed;
	    skipSpace();
	}

	return getToken;
    }

    var tokpos; //current position of the tokenizer in the input
    var tokstart, tokend; //start and end offsets of current token
    var tokstartloc, tokendloc; //to hold objects containing tokens start and end line/column pairs 
    var toktype, tokvalue; //type and value of current token
    var tokregexallowed; //to distinguish between operators and regular expressions, check if the last token was allowed to be followed by an expression.
    var tokcurline, toklinestart; //keep track of current line and check if a new line has been entered
    var laststart, lastend, lastendloc; //info about the previous token useful when traversing a node
    var inFunction, labels, strict; //check for function integrity

    function raise(pos, message) {
	var loc = getLineInfo(input, pos);
	message += " (" + loc.line + ":" + loc.column + ")";
	var err = new SyntaxError(message);
	err.pos = pos;
	err.loc = loc;
	err.raisedAt = tokpos;
	throw err;
    }

    function predict(words) {
	words = words.split(" ");
	var f = "", cats = [];
  	out: {
	    for(var i = 0; i < words.length; i++) {
		for(var j = 0; j < cats.length; j++) {
		    if(cats[j][0].length == words[i].length) {
			cats[j].push(words[i]);
			continue out;
		    }
		    cats.push([words[i]]);
		}
	    }
	}

	function  compare(arr) {
	    if(arr.length == 1) {
		return f += "return str === " + JSON.stringify(arr[0]) + ";";
	    }
	    f += "switch(arr){";
	    for(var i = 0; i < arr.length; i++) {
		f += "case " + JSON.stringify(arr[i]) + ":";
	    }
	    f += "return true}return false;";
	}

	if(cats.length > 3) {
	    cats.sort(function(a, b) {
		return b.length - a.length; 
	    });
	    f += "switch(str.length){";
	    for(var i = 0; i < cats.length; i++) {
		var cat = cats[i];
		f += "case " + cat[0].length + ":";
		compare(cat);
	    }
	    f += "}";
	}else {
	    compare(words);
	}

	return new Function("str", f);
    }
    
    //ecmascript 3 reserved wordlist
    var reservedWord3 = predict("abstract boolean byte char class double enum export extends final float goto implements import int interface long native package private protected public short static super synchronized throws transient volatile");

    //ecmascrpt5 reserved wordlist
    var reservedWord5 = predict("class enum extends super const export import");

    //reserved words in strict mode
    var strictreservedWord = predict("implements interface let package private protected public static yield");

    //frbidden variables in strict mode
    var strictbadword = predict("eval arguements");

    var keyword = predict("break case catch continue debugger default do else finally for function if return switch throw try var while with null true false instanceof typeof void delete new in this");

    function line_loc_t() {
	this.line = tokendline;
	this.column = tokpos - toklinestart;
    }

    function initToken() {
	tokcurline = 1;
	tokpos = toklinestart = 0;
	tokregexpallowed = true;
	skipSpace();
    }

    function finishToken(type, val) {
	tokend = tokpos;
	if(option.locations) {
	    tokendloc = new line_loc_t;
	}
	toktype = type;
	skipSpace();
	tokval = val;
	tokregexallowed = type.beforeExpr;
    }
}
