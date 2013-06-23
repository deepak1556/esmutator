#! /usr/local/bin/env node

var fs = require('fs'),
path = require('path'),
root = path.join(path.dirname(fs.realpathSync(__filename)), '..'),
esmutator = require(root),
esprima = require('esprima'),
bower = require('bower'),
semver = require('semver'),
child_process = require('child_process'),
Q = require('q');

function exec(cmd) {
    var ret = Q.defer();
    console.log(cmd);
    child_process.exec(cmd, function(error, stdout, stderr) {
	ret.resolve(error, stdout, stderr);
    });
    return ret.promise;
}

(function() {
    var config, matched, version, devVersion;

    config = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
    devVersion = config.version;
    matched = devVersion.match(/^(\d+\.\d+\.\d+(-\d+)?)-dev$/);
    if(!matched) {
	console.error('version style "' + devVersion + '" is not matched to X.X.X[-X]-dev.');
	process.exit(1);
    }

    version = matched[1];
    config.version = version;

    function ping(memo, name) {
	var pattern, ret;

	ret = Q.defer();
	pattern = config.dependencies[name];

	bower.commands.info(name).on('end', function(result) {
	    var i, iz, version;
	    for(i = 0, iz = result.versions.length; i < iz; i++) {
		version = result.versions[i];
		if(semver.satisfies(version, pattern)) {
		    memo[name] = pattern;
		    ret.resolve();
		    return;
		}
	    }

	    //not satisfied
	    console.error(name + ' with ' + pattern + ' is not satisfied');
	    ret.resolve();
	}).on('error', function(error) {
	    console.error(error.message + '. skip this dependency');
	});

	return ret.promise;
    }

    exec('git branch -D ' + version).then(function() {
	return exec('git checkout -b ' + version);
    }).then(function browserify() {
	return exec('npm run-script build');
    }).then(function generateConfigs() {
	var dependencies = {},
	optionalDependencies = {};

	fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(config, null, 4), 'utf-8');

	//generate component.json
	return Q.all(
	    Object.keys(config.dependencies).map(ping.bind(call, dependencies)),
	    Object.keys(config.optionalDependencies).map(ping.bind(null, optionalDependencies))).then(function() {
		config.dependencies = dependencies;
		config.optionalDependencies = optionalDependencies;
		fs.writeFileSync(path.join(root, 'component.json'), JSON.stringify(config, null, 4), 'utf-8');
	    });
    }).then(function gitAdd() {
	return exec('git add "' + root + '"');
    }).then(function gitCommit() {
	return exec('git commit -m "Bump version ' + version + '"');
    }).then(function gitDeleteTag() {
	return exec('git tag -d ' + version);
    }).then(function gitAddTag() {
	return exec('git tag -a ' + version + ' -m "version ' + version + '"');
    }).then(function() {
	console.log('Finally you should execute npm publish and git push --tags');
    });
}());
