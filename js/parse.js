
/*jslint sloppy:true browser:true */
/*global esprima:true, YUI:true, require:true */

var parseId, tree;

function id(i) {
    return document.getElementById(i);
}

YUI({ gallery: 'gallery-2013.01.09-23-24' }).use('gallery-sm-treeview', function (Y) {

    window.updateTree = function (syntax) {

        if (typeof syntax === 'undefined') {
            return;
        }

        if (id('tab_tree').className !== 'active') {
            return;
        }

        if (typeof tree === 'undefined') {
            tree = new Y.TreeView({
                lazyRender: false,
                container: '#treeview'
            });
            tree.render();
        }

        function collapseAll() {
            Y.all('.yui3-treeview-can-have-children').each(function () {
                tree.getNodeById(this.get('id')).close();
            });
        }

        function expandAll() {
            Y.all('.yui3-treeview-can-have-children').each(function () {
                tree.getNodeById(this.get('id')).open();
            });
        }

        id('collapse').onclick = collapseAll;
        id('expand').onclick = expandAll;

        function isArray(o) {
            return (typeof Array.isArray === 'function') ? Array.isArray(o) :
                Object.prototype.toString.apply(o) === '[object Array]';
        }

        function convert(name, node) {
            var i, key, item, subitem;

            item = tree.createNode();

            switch (typeof node) {

            case 'string':
            case 'number':
            case 'boolean':
                item.label = name + ': ' + node.toString();
                break;

            case 'object':
                if (!node) {
                    item.label = name + ': null';
                    return item;
                }
                if (node instanceof RegExp) {
                    item.label = name + ': ' + node.toString();
                    return item;
                }
                item.label = name;
                if (isArray(node)) {
                    if (node.length === 2 && name === 'range') {
                        item.label = name + ': [' + node[0] + ', ' + node[1] + ']';
                    } else {
                        item.label = item.label + ' [' + node.length + ']';
                        for (i = 0; i < node.length; i += 1) {
                            subitem = convert(String(i), node[i]);
                            if (subitem.children.length === 1) {
                                item.append(subitem.children[0]);
                            } else {
                                item.append(subitem);
                            }
                        }
                    }

                } else {
                    if (typeof node.type !== 'undefined') {
                        item.label = name;
                        subitem = tree.createNode();
                        subitem.label = node.type;
                        item.append(subitem);
                        for (key in node) {
                            if (Object.prototype.hasOwnProperty.call(node, key)) {
                                if (key !== 'type') {
                                    subitem.append(convert(key, node[key]));
                                }
                            }
                        }
                    } else {
                        for (key in node) {
                            if (Object.prototype.hasOwnProperty.call(node, key)) {
                                item.append(convert(key, node[key]));
                            }
                        }
                    }
                }
                break;

            default:
                item.label = '[Unknown]';
                break;
            }

            return item;
        }


        tree.clear();
        document.getElementById('treeview').innerHTML = '';
        tree.rootNode.append(convert('Program body', syntax.body));
        tree.render();

        expandAll();
    };

});


function parse(delay) {
    if (parseId) {
        window.clearTimeout(parseId);
    }

    parseId = window.setTimeout(function () {
        var code, options, result, el, str;

        // Special handling for regular expression literal since we need to
        // convert it to a string literal, otherwise it will be decoded
        // as object "{}" and the regular expression would be lost.
        function adjustRegexLiteral(key, value) {
            if (key === 'value' && value instanceof RegExp) {
                value = value.toString();
            }
            return value;
        }

        code = window.editor.getText();

        options = {
            comment: false,
            loc: false
        };

        id('info').className = 'alert-box secondary';

        try {
            result = esprima.parse(code, options);
            str = JSON.stringify(result, adjustRegexLiteral, 4);
            options.tokens = true;
            if (window.updateTree) {
                window.updateTree(result);
            }
            id('info').innerHTML = 'No error';
        } catch (e) {
            if (window.updateTree) {
                window.updateTree();
            }
            str = e.name + ': ' + e.message;
            id('info').innerHTML  = str;
            id('info').className = 'alert-box alert';
        }

        el = id('show_tree');
        el.value = str;

        el = id('url');
        el.value = location.protocol + "//" + location.host + location.pathname + '?code=' + encodeURIComponent(code);

        parseId = undefined;
    }, delay || 811);
}

window.onload = function () {
    function quickParse() { parse(1); }

    try {
        require(['custom/editor'], function (editor) {
            var queries, elements, code, i, iz, pair;

            window.editor = editor({ parent: 'editor', lang: 'js' });
	    window.c_editor = editor({ parent: 'converted_editor', lang: 'js' });
            window.editor.getTextView().getModel().addEventListener("Changed", parse);
            parse(100);

            if (location.search) {
                queries = {};
                elements = location.search.substring(1).split(/[;&]/);
                for (i = 0, iz = elements.length; i < iz; i += 1) {
                    pair = elements[i].split('=');
                    if (pair.length === 2) {
                        queries[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
                    }
                }
                code = queries.code;
                if (code) {
                    window.editor.setText(code);
                    quickParse();
                }
            }
        });
    } catch (e) {
    }


};
