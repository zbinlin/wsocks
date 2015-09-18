"use strict";

var childProcess = require("child_process");
var ENV_FORK_ID = "__FORK_SELF_" + __filename.replace(/[/\/;,]/g, "_") + "__";
if (!(ENV_FORK_ID in process.env)) {
    module.exports = function socks(cfg, onConnect, onError) {
        function fork(opts, env) {
            if (!Array.isArray(opts)) {
                opts = [];
            }
            return childProcess.fork(__filename, opts, {
                env: env || process.env
            });
        }
        var opts = process.argv.slice(2);
        var env = (function () {
            var env = process.env;
            var keys = Object.keys(env);
            var newEnv = keys.reduce(function (newEnv, key) {
                newEnv[key] = env[key];
                return newEnv;
            }, {});
            newEnv[ENV_FORK_ID] = process.pid;
            return newEnv;
        }());
        env.PORT = cfg.port;
        env.HOST = cfg.host;
        var evt = new (require("events").EventEmitter)();
        var firstRun = true;
        (function forever() {
            var args = arguments;
            var child = fork.apply(undefined, args);
            if (firstRun) {
                firstRun = false;
                child.on("message", function (obj) {
                    switch (obj.code) {
                        case 0:
                            onConnect(obj.msg);
                            break;
                        case 1:
                            onError(obj.msg);
                            break;
                    }
                });
            }
            child.once("exit", function (code, signal) {
                if (code !== 0) {
                    evt.removeAllListeners("close");
                    forever.apply(undefined, args);
                }
                process.removeListener("eixt", onExit);
            });
            evt.on("close", function () {
                child.send({
                    msg: "close"
                });
            });
            process.on("exit", onExit);
            function onExit() {
                child.kill();
            }
        }).call(undefined, opts, env);

        return {
            close: function () {
                evt.emit("close");
            }
        };
    };
} else {
(function () {

var path = require("path");

var socks5 = require("../lib/socks5");

var env = process.env;
var argv = process.argv.slice(2);

var DEFAULT_HOST = null; /* ipv4: 0.0 ipv6: 0::0 */
var DEFAULT_PORT = 1080;

var host = ("HOST" in env) ? env["HOST"] : DEFAULT_HOST;
var port = ("PORT" in env) ? env["PORT"] : DEFAULT_PORT;

argv.forEach(function (key, idx, arr) {
    switch (key) {
        case "-p":
        case "--port":
            port = arr[idx + 1];
            break;
        case "-h":
        case "--host":
            host = arr[idx + 1];
            break;
    }
});
if (isNaN(+port)) {
    console.warn("Invaild port: %s, use default port: %s", port, DEFAULT_PORT);
    port = DEFAULT_PORT;
} else {
    port = +port;
}

var socket = socks5({
    port: port,
    host: host
}, function () {
    process.send({
        code: 0,
        msg: "startup"
    });
}).on("error", function (e) {
    process.send({
        code: 1,
        msg: e.stack || e.message || e
    });
    process.exit(0);
});

process.on("message", function (obj) {
    if (obj.msg === "close") {
        socket && socket.close && socket.close();
    }
});

})();
}
