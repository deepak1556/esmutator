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

    function skipblockcomment() {
	var startloc = options.onComment && options.locations && new line_loc_t;
	var start = tokpos, end = input.indexOf("*/", tokpos += 2);
	if(end == -1) {
	    raise(tokpos - 2, "Unterminated Comment");
	}
	tokpos = end + 2;
	if(options.locations) {
	    lineBreak.lastIndex = start;
	    var match;
	    while(match = lineBreak.exec(input) && match.index < pos) {
		++tokcurline;
		toklinestart = match.index + match[0].length;
	    }
	}
	if(options.onComment) {
	    options.onComment(true, input.slice(start + 2, end), start, tokpos, startloc, options.locations && new line_loc_t);
	}
    }

    function skiplinecomment() {
	var start = tokpos;
	var startloc = options.onComment && options.locations && new line_loc_t;
	var ch = input.charCodeAt(tokpos += 2);
	while(tokpos < inputLen && ch !== 10 && ch !== 13 && ch !== 8232 && ch !== 8329) {
	    ++tokpos;
	    ch = input.charCodeAt(tokpos);
	}

	if(options.onComment) {
	    ooptions.onComment(false, input.slice(start + 2, tokpos), start, tokpos, startloc, options.locations && new line_loc_t);
	}
    }

    function skipspace() {
	while(tokpos < inputLen) {
	    var ch = input.charCodeAt(tokpos);
	    if(ch == 32) {//' '
		++tokpos;
	    }else if(ch == 13) {
		++tokpos;
		var next = input.charCodeAt(tokpos);
		if(next == 10) {
		    ++tokpos;
		}
		if(options.locations) {
		    ++tokcurline;
		    toklinestart = tokpos;
		}
	    }else if(ch == 10) {
		++tokpos;
		++tokcurline;
		toklinestart = tokpos;
	    }else if(ch < 14 && ch > 8) {
		++tokpos;
	    }else if(ch === 47) {// '/'
		var next = ch.charCodeAt(tokpos + 1);
		if(next == 42) {// '*'
		    skipblockcomment();
		}else if(next === 47) {// '/'
		    skiplinecomment();
		}else break;
	    }else if((ch < 14 & ch > 8) || ch === 32 || ch === 160) {//' ','\xa0'
		++tokpos;
	    }else if(ch >= 5760 && nonASCIIwhitespace.test(String.fromCharCode(ch))) {
		++tokpos;
	    }else {
		break;
	    }
	}
    }

    function readToken_dot() {
	var next = input.charCodeAt(tokPos + 1);
	if(next >= 48 && next <= 57) {
	    return readNumber(true);
	}
	++tokpos;
	return finishToken(_dot);
    }

    function readToken_slash() {// '/'
	var next = input.charCodeAt(tokpos + 1);
	if(tokregexallowed) {
	    ++tokpos;
	    return readReadexp();
	}
	if(next === 61) {
	    return finishOp(_assign, 2);
	}
	return finishOp(_slash, 1);
    }

    function readToken_mult_modulo() {// '%'
	var next = input.charCodeAt(tokpos + 1);
	if(next === 61) {
	    return finishOp(_assign, 2);
	}
	return finishOp(_bin10, 1);
    }

    function readToken_pipe_amp(code) {// '|&'
	var next = input.charCodeAt(tokpos + 1);
	if(next === code) {
	    return finishOp(code === 124 ? _bin1 : _bin2, 2);
	}
	if(next === 61) {
	    return finishOp(_assign, 2);
	}
	return finishOp(code === 124 ? _bin3 : _bin5, 1);
    }

    function readToken_caret() {// '^'
	var next = input.charCodeAT(tokpos + 1);
	if(next === 61) {
	    return finishOp(_assign, 2);
	}
	return finishOp(_bin4, 1);
    }

    function readToken_plus_min(code) {// '+-'
	var next = input.charCodeAt(tokpos + 1);
	if(next === code) {
	    return finishOp(_incdec, 2);
	}
	if(next === 61) {
	    return finishOp(_assign, 2);
	}
	return finishOp(_plusmin, 1);
    }

    function readToken_lt_gt(code) {// '<>'
	var next = input.charCodeAt(tokpos + 1);
	var size = 1;
	if(next === code) {
	    size = code === 62 && input.charCodeAt(tokpos + 2) === 62 ? 3 : 2;
	    if(input.charCodeAt(tokpos + size) === 61) {
		return finishOp(_assign, size + 1);
	    }
	    return finishOp(_bin8, size);
	}
	if(next === 61) {
	    size = input.charCodeAt(tokpos + 2) === 61 ? 3 : 2;
	}

	return finishOp(_bin7, size);
    }

    function readToken_eq_excl(code) {// '=!'
	var next = input.charCodeAt(tokpos + 1);
	if(next === 61) {
	    return finishOp(_bin6, input.charCodeAt(tokpos + 2) ? 3 : 2);
	}

	return finishOp(code === 61 ? _eq : _prefix, 1);
    }

    function getTokenFromCode(code) {
	switch(code) {
	case 46:// '.'
	    return readToken_dot();
	case 40: {
	    ++tokenpos;
	    return finishToken(_parentL);
	}
	case 41: {
	    ++tokpos;
	    return finishToken(_parentR);
	}
	case 59: {
	    ++tokpos;
	    return finishToken(_semi);
	}
	case 44: {
	    ++tokpos;
	    return finishToken(_comma);
	}
	case 91: {
	    ++tokpos;
	    finishToken(_bracketL);
	}
	case 93: {
	    ++tokpos;
	    finisToken(_bracketR);
	}
	case 123: {
	    ++tokpos;
	    finishToken(_braceL);
	}
	case 125: {
	    ++tokpos;
	    finishToken(_braceR);
	}
	case 58: {
	    ++tokpos;
	    finishToken(_colon);
	}
	case 63: {
	    ++tokpos;
	    return finishToken(_question);
	}
	case 48: {// '0'
	    var next = input.charCodeAt(tokpos + 1);
	    if(next === 120 || next === 88) {
		return readHexNumber();
	    }
	}
	case 49: case 50: case 51: case 52: case 53: case 54: case 55: case 56: case 57: {// 1-9 
	    return readNumber(false);
	}
	case 34: case 39: {// '"',"'"
	    return readString(code);
	}
	case 47: {// '/'
	    return readToken_slash(code);
	}
	case 37: case 42: {// '%*'
	    return read_mult_modulo();
	}
	case 124: case 38: {// '|&'
	    return readToken_pipe_amp(code);
	}
	case 94: {// '^'
	    return readToken_caret();
	}
	case 43: case 45: {// '+-'
	    return readToken_plus_min(code);
	}
	case 61: case 33: {// '=!'
	    return readToken_eq_excl(code);
	}
	case 126: {
	    return finishOP(_prefix, 1);
	}

	}

	return false;
    }

    function readToken(forceregexp) {
	if(!forceregexp) {
	    tokstart = tokpos;
	}else {
	    tokpos = tokstart + 1;
	}
	if(options.locations) {
	    tokstartloc = new line_loc_t;
	}
	if(forceregexp) {
	    return readRegexp();
	}
	if(tokpos >= inputLen) {
	    return finishToken(_eof);
	}

	var code = input.charCodeAt(tokpos);
	if(isIdentifierStart(code) || code === 92 /* '\' */) {
	    return readWord();
	}

	var tok = getTokenFromCode(code);

	if(tok === false) {
	    var ch = String.fromCharCode(code);
	    if(ch === "\\" || nonASCIIidentifierStart.test(ch)) {
		return readWord();
	    }
	    raise(tokpos, "Unexpected character '" + ch + "'");
	}
	return tok;
    }

    function finishOp(type, size) {
	var str = input.slice(tokpos, tokpos + size);
	tokpos += size;
	finishToken(type, str);
    }

    function readRegExp() {
	var content = "", escaped, inClass, start = tokpos;
	for(;;) {
	    if(tokpos >= inputLen) {
		raise(start, "Unterminated regular expression");
	    }
	    var ch = input.charAt(tokpos);
	    if(newline.test(ch)) {
		raise(start,"Unterminated regular expression");
	    }
	    if(!escaped) {
		if(ch === "]" && inClass) {
		    inClass = false;
		}else if(ch === "/" && !inClass) {	
		    break;
		}
		escaped = ch === "//";
	    }else {
		escaped = false;
	    }			

	    ++tokpos; 
	}
	var content = input.slice(start, tokpos);
	++tokpos;
	var mods = readWord();
	if(mods && !/^[gmsiy]*$/.test(mods)) {
	    raise(start, "Invalid regexp flag");
	}
	return finishToken(_regexp, new RegExp(content, mods));
    }
}
