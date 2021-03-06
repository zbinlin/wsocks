"use strict";

var fs = require("fs");
var path = require("path");
var readline = require("readline");
var child_process = require("child_process");

var sequence = require("fn-sequence");

var print = require("./print");

var Client = require("../client");
var Server = require("../server");

function CLI(agent) {
    if (!(this instanceof CLI)) {
        return new CLI(agent);
    }
    this.agent = agent;
    var homeDir = process.env[~process.platform.indexOf("win") ? "USERPROFILE" : "HOME"];
    this.configDir = path.join(homeDir, ".wsocks");
    this.configFile = path.join(this.configDir, agent + ".json");
    var defaultConfig = {
        "host": "localhost",
        "port": agent == "client" ? 1080 : 8443,
        "remote-host": "localhost",
        "remote-port": agent == "client" ? 8443 : 1080,
        "cipher": "RC4",
        "password": "password",
        "enable-tls": false,
        "http-ping": true,
        "ca-cert-file": "~/.wsocks/keys/ca-cert.pem",
        "key-file": "~/.wsocks/keys/" + agent + "-key.pem",
        "cert-file": "~/.wsocks/keys/" + agent + "-cert.pem"
    };
    agent === "server" && (defaultConfig.withinSOCKS = true);
    this.defaultConfig = Object.freeze(defaultConfig);
}
CLI.prototype.validateConfig = function (key, value) {
    return this.defaultConfig.hasOwnProperty(key);
};
CLI.prototype.fixConfigValue = function (key, value) {
    var defaultConfig = this.defaultConfig;
    var defaultValue = defaultConfig[key];
    switch (typeof defaultValue) {
        case typeof value:
            return value;
            break;
        case "string":
            return value + "";
            break;
        case "number":
            return +value;
            break;
        case "boolean":
            return "true" == (value || "true").toLowerCase();
        default:
            return value;
    }
};
CLI.prototype.start = function (argv) {
    var defaultConfig = this.defaultConfig;
    var config = {};
    try {
        var configStr = fs.readFileSync(this.configFile, {
            encoding: "utf8"
        });
        config = JSON.parse(configStr);
    } catch (ex) {
        console.warn(ex.message || ex);
    }
    for (var key in defaultConfig) {
        if (!config.hasOwnProperty(key)) {
            config[key] = defaultConfig[key];
        }
    }
    var isBackground = false;
    var parsedArgv = this.parseArgv(argv);
    for (var i = 0, len = parsedArgv.length; i < len; i++) {
        var arg = parsedArgv[i];
        var key = arg[0];
        var val = arg[1];
        if (key === "-b" || val === "--background") {
            isBackground = true;
        } else if (this.validateConfig(key)) {
            config[key] = this.fixConfigValue(key, val);
        }
    }
    if (isBackground) {
        console.log("未支持，在类 unix 下可以在终端运行: (wsocks " + this.agent + " &)");
    }

    switch (this.agent) {
        case "client":
            new Client(config).start();
            break;
        case "server":
            new Server(config).start();
            break;
    }

};

CLI.prototype.stop = function () {
    console.log("未支持！");
};

CLI.prototype.init = function () {
    var agent = this.agent;
    var dir = this.configDir;
    var configFile = this.configFile;
    var defaultConfig = this.defaultConfig;
    fs.exists(dir, function (isExist) {
        if (isExist) {
            fs.stat(dir, function (err, stat) {
                if (!err && !stat.isDirectory()) {
                    run(new Error(path.resolve(dir) + " 不是一个有效的目录"));
                } else {
                    run(null);
                }
            });
        } else {
            fs.mkdir(dir, function (err) {
                run(err);
            });
        }
    });
    function run(err) {
        if (err) {
            console.log();
            console.log("****无法创建配置目录：" + path.resolve(dir) + "，请根据以下错误进行检查：****\n")
            console.error(err.message || err.stock || err);
            console.log();
            return;
        }

        var rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        var config = {};
        try {
            config = fs.readFileSync(configFile, {
                encoding: "utf8"
            });
            config = JSON.parse(config);
        } catch (ex) {}
        for (var key in defaultConfig) {
            if (!config.hasOwnProperty(key)) {
                config[key] = defaultConfig[key];
            }
        }

        var questions = [
            function _setHost(value, next) {
                rl.question("host: (" + config.host + ") ", function (answer) {
                    answer = answer.toLowerCase();
                    if (answer) {
                        config["host"] = answer;
                    }
                    next();
                });
            },
            function _setPort(value, next) {
                rl.question("port: (" + config.port + ") ", function (answer) {
                    if (answer.length === 0) {
                        next(null, undefined, agent);
                        return;
                    }
                    answer = +answer;
                    if (isNaN(answer)) {
                        console.log("请输入一个有效有数字！");
                        _setPort(value, next);
                    } else {
                        config["port"] = answer;
                        next(null, undefined, agent);
                    }
                });
            },
            {
                server: [
                    function _withinSOCKS(value, next) {
                        rl.question("是否使用内置的 SOCKS5 代理服务器: [yes/no] (" + (config.withinSOCKS ? "yes" : "no") + ") ", function (answer) {
                            answer.length === 0 && (answer = "yes");
                            if (/^\s*y(es)?\s*$/i.test(answer)) {
                                config.withinSOCKS = true;
                                next(null, undefined, "yes");
                            } else if (/^\s*no?\s*$/i.test(answer)) {
                                config.withinSOCKS = false;
                                next(null, undefined, "no");
                            } else {
                                _withinSOCKS(value, next);
                            }
                        });
                    },
                    {
                        yes: null,
                        no: [
                            function _setRemoteHost(value, next) {
                                rl.question("SOCKS 代理服务器 host: (" + config["remote-host"] + ") ", function (answer) {
                                    answer = answer.toLowerCase();
                                    answer && (config["remote-host"] = answer);
                                    next();
                                });
                            },
                            function _setRemotePort(value, next) {
                                rl.question("SOCKS 代理服务器 port: (" + config["remote-port"] + ") ", function (answer) {
                                    if (answer.length === 0) {
                                        next();
                                        return;
                                    }
                                    answer = +answer;
                                    if (isNaN(answer)) {
                                        console.log("请输入一个有效有数字！");
                                        _setRemotePort(next);
                                    } else {
                                        config["remote-port"] = answer;
                                        next();
                                    }
                                });
                            }
                        ]
                    }
                ],
                client: [
                    function _setRemoteHost(value, next) {
                        rl.question("服务器端 host: (" + config["remote-host"] + ") ", function (answer) {
                            answer = answer.toLowerCase();
                            answer && (config["remote-host"] = answer);
                            next();
                        });
                    },
                    function _setRemotePort(value, next) {
                        rl.question("服务器端 port: (" + config["remote-port"] + ") ", function (answer) {
                            if (answer.length === 0) {
                                next();
                                return;
                            }
                            answer = +answer;
                            if (isNaN(answer)) {
                                console.log("请输入一个有效有数字！");
                                _setRemotePort(next);
                            } else {
                                config["remote-port"] = answer;
                                next();
                            }
                        });
                    }
                ]
            },
            function _setCipher(value, next) {
                rl.question("加密方式: (" + config["cipher"] + ") ", function (answer) {
                    answer && (config["cipher"] = answer);
                    next();
                });
            },
            function _setPassword(value, next) {
                rl.question("密码: (" + config["password"] + ") ", function (answer) {
                    answer && (config["password"] = answer);
                    next();
                });
            },
            function _setEnableTLS(value, next) {
                rl.question("是否使用 TLS 连接: [yes/no] (" + (config["enable-tls"] ? "yes" : "no") + ") ", function (answer) {
                    answer.length === 0 && (answer = "no");
                    if (/^\s*y(es)?\s*$/i.test(answer)) {
                        config["enable-tls"] = true;
                        next(null, undefined, "yes");
                    } else if (/^\s*no?\s*$/i.test(answer)) {
                        config["enable-tls"] = false;
                        next(null, undefined, "no");
                    } else {
                        _setEnableTLS(value, next);
                    }
                });
            },
            {
                yes: [
                    function _setCACertFile(value, next) {
                        rl.question("CA 证书文件路径: (" + config["ca-cert-file"] + ") ", function (answer) {
                            answer && (config["ca-cert-file"] = answer);
                            next();
                        });
                    },
                    function _setKeyFile(value, next) {
                        rl.question("证书密钥文件路径: (" + config["key-file"] + ") ", function (answer) {
                            answer && (config["key-file"] = answer);
                            next();
                        });
                    },
                    function _setCertFile(value, next) {
                        rl.question("证书文件路径: (" + config["cert-file"] + ") ", function (answer) {
                            answer && (config["cert-file"] = answer);
                            next();
                        });
                    }
                ]
            }
        ];
        sequence(questions, function (err) {
            if (err) throw err;
            var str = JSON.stringify(config, null, "    ");
            console.log("\n" + str.replace(/^/gm, "  ") + "\n")
            rl.question("请确认，是否保存到 " + configFile + "？[yes/no] (yes) ", function (answer) {
                answer.length === 0 && (answer = "yes");
                if (/^\s*y(es)?\s*$/i.test(answer)) {
                    fs.writeFile(configFile, str, function (err) {
                        if (err) {
                            console.log("\n保存失败，请根据以下错误信息进行排查\n");
                            console.log(err.message || err);
                            console.log();
                        } else {
                            console.log("\n保存成功！\n");
                        }
                    });
                }
                rl.close();
            });
        });
    }
};

CLI.prototype.list = function () {
    try {
        var configStr = fs.readFileSync(this.configFile, {
            encoding: "utf8"
        });
        var config = JSON.parse(configStr);
        if (arguments.length > 0) {
            console.log("\n" + config[arguments[0]] + "\n");
        } else {
            console.log("\n" + configStr + "\n");
        }
    } catch (ex) {
        console.error(ex);
    }
};

CLI.prototype.get = function (key) {
    return this.list(key);
};

CLI.prototype.set = function (key, value) {
    var agent = this.agent;
    var dir = this.configDir;
    var configFile = this.configFile;

    var configs = [];
    if (arguments.length === 1 && Array.isArray(key)) {
        configs = key.slice(0);
    } else {
        configs.push([key, this.fixConfigValue(key, value)]);
    }

    var that = this;

    fs.exists(dir, function (isExist) {
        if (isExist) {
            fs.stat(dir, function (err, stat) {
                if (!err && !stat.isDirectory()) {
                    run(new Error(path.resolve(dir) + " 不是一个有效的目录"));
                } else {
                    run(null);
                }
            });
        } else {
            fs.mkdir(dir, function (err) {
                run(err);
            });
        }
    });
    function run(err) {
        if (err) {
            console.log();
            console.log("****无法创建配置目录：" + path.resolve(dir) + "，请根据以下错误进行检查：****\n")
            console.error(err.message || err.stock || err);
            console.log();
            return;
        }

        var config = {};
        try {
            config = fs.readFileSync(configFile, {
                encoding: "utf8"
            });
            config = JSON.parse(config);
        } catch (ex) {}

        var newConfig = [];
        for (var i = 0, len = configs.length; i < len; i++) {
            var item = configs[i];
            var key = item[0];
            var val = item[1];
            if (that.validateConfig(key)) {
                config[key] = val;
                newConfig.push(item.join(" = "));
            }
        }

        fs.writeFile(configFile, JSON.stringify(config, null, "    "), function (err) {
            if (err) {
                console.log("\n保存失败，请根据以下错误信息进行排查\n");
                console.log(err.message || err);
                console.log();
            } else {
                console.log("\n" + newConfig.join("\n") + "\n");
                console.log("设置成功！\n");
            }
        });
    }
};

CLI.prototype.parseArgv = function (argv) {
    argv = argv.slice();
    var parsedArgv = [];
    while (argv.length) {
        var arg = argv.shift();
        var idx = arg.indexOf("=");
        if (idx > 0) {
            var key = arg.slice(0, idx);
            var val = arg.slice(idx + 1);
        } else {
            var key = arg;
            var val = null;
        }
        parsedArgv.push([key, this.fixConfigValue(key, val === null ? val = argv.shift() : val)]);
    }
    return parsedArgv;
};

CLI.prototype.parse = function (argv) {
    if (isHelp(argv[1])) {
        return print.help(this.agent, argv[0]);
    }
    outer: switch (argv[0]) {
        case "start":
            this.start(argv.slice(1));
            break;
        case "stop":
            this.stop();
            break;
        case "init":
            this.init();
            break;
        case "list":
            this.list();
            break;
        case "get":
            this.get(argv[1]);
            break;
        case "set":
            var parsedArgv = this.parseArgv(argv.slice(1));
            for (var i = 0, len = parsedArgv.length; i < len; i++) {
                var arg = parsedArgv[i];
                var key = arg[0];
                var val = arg[1];
                if (!this.defaultConfig.hasOwnProperty(key)) {
                    console.error();
                    console.error("Error invalid option:", key);
                    console.error();
                    break outer;
                }
            }
            this.set(parsedArgv);
            break;
        default:
            print.help();
    }

    function isHelp(str) {
        return str === "-h" || str === "--help" || str === "help";
    }
};

module.exports = function (agent) {
    if (!agent || (agent !== "client" && agent !== "server")) {
        throw new Error();
    }

    return new CLI(agent);
};
