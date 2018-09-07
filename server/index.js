"use strict";

var net = require("net");
var tls = require("tls");
var fs = require("fs");
var path = require("path");
var crypto = require("crypto");
var stream = require("stream");

var createHttpPingServer = require("../lib/http-ping-service").createHttpServer;

var Server = module.exports = function (config) {
    if (!(this instanceof Server)) {
        return new Server(config);
    }
    var CIPHER = config.cipher;
    var PASSWORD = config.password;
    var KEY = Buffer.from(PASSWORD);

    var opt = {
    };

    var CA_CERT_FILE = resolve(config["ca-cert-file"]);
    var KEY_FILE = resolve(config["key-file"]);
    var CERT_FILE = resolve(config["cert-file"]);

    var enableTls = config["enable-tls"];
    if (enableTls) {
        try {
            opt.ca = fs.readFileSync(CA_CERT_FILE);
            opt.key = fs.readFileSync(KEY_FILE);
            opt.cert = fs.readFileSync(CERT_FILE);
            opt.requestCert = true;
            opt.rejectUnauthorized = true;
        } catch (ex) {
            throw ex;
        }
    }
    function resolve(pathname) {
        var homeDir = process.env[~process.platform.indexOf("win") ? "USERPROFILE" : "HOME"];
        return pathname.replace(/^~(?:(?=\/|\\)|$)/, function () { return homeDir; })
                   .replace(/\\|\//g, path.sep);
    }

    var REMOTE_HOST = config["remote-host"];
    var REMOTE_PORT = config["remote-port"];

    var server = (enableTls ? tls : net).createServer(opt, function (socket) {
        var cipher = crypto.createCipher(CIPHER, KEY);
        var decipher = crypto.createDecipher(CIPHER, KEY);
        var remoteSocket = net.connect({
            port: REMOTE_PORT,
            host: REMOTE_HOST,
        });

        socket.on("error", errorCallback);
        remoteSocket.on("error", errorCallback);
        socket.on("close", cleanup);
        remoteSocket.on("close", cleanup);

        var pingService = config["http-ping"] ? createHttpPingServer()
                                              : new stream.PassThrough();

        socket.setNoDelay(true);
        socket.pipe(pingService)
              .pipe(decipher)
              .pipe(remoteSocket);

        function throttle(func, maxSize, onEnd) {
            var buffers = [];
            buffers.size = 0;
            var pending = true;
            var ended = false;
            remoteSocket.once("end", function () {
                ended = true;
                remoteSocket.removeListener("end", handleData);
            });
            return function onData(data) {
                buffers.push(data);
                buffers.size += data.length;

                if (buffers.size >= maxSize) {
                    this.pause();
                }

                const next = () => {
                    this.isPaused() && this.resume();
                    perform(next);
                };

                if (pending === true) {
                    pending = false;
                    perform(next);
                }
            };
            function perform(next) {
                if (buffers.length === 0) {
                    pending = true;
                    ended && onEnd();
                    return;
                }
                var data = Buffer.concat(buffers, buffers.size);
                buffers.length = 0;
                buffers.size = 0;
                if (ended) {
                    onEnd(data);
                } else {
                    process.nextTick(func, data, next);
                }
            }
        }

        var handleData = throttle(function (data, next) {
            if (false === cipher.write(data)) {
                cipher.once("drain", next);
            } else {
                setImmediate(next);
            }
        }, 64 * 1024, function onEnd(data) {
            if (data) {
                cipher.end(data);
            } else {
                cipher.end();
            }
        });
        remoteSocket.on("data", handleData);

        cipher.pipe(socket);

        function errorCallback(e) {
            console.error(this === socket ? "Socket:" : "RemoteSocket:", e.message || e);

            var pipes = [].concat(this._readableState.pipes).filter(function (dest) {
                return !!dest;
            });

            this.destroy();
            this.unpipe();

            if (!pipes.length) return;

            var emptyReader = new stream.Readable();
            emptyReader._read = function () {};
            emptyReader.push(null);

            pipes.forEach(function (dest) {
                emptyReader.pipe(dest);
            });
            pipes.length = 0;
        }

        function cleanup() {
            this.removeListener("close", cleanup);
            this.removeListener("error", errorCallback);
        }
    });

    this.config = config;
    this.server = server;
};
Server.prototype.start = function () {
    if (!this.server) {
        return;
    }
    var config = this.config;
    var that = this;
    var socks5;
    if (config.withinSOCKS) {
        socks5 = require("./socks")({
            port: config["remote-port"],
            host: config["remote-host"],
        }, function () {
            console.log("\n启动 SOCKS5 服务...");
            console.log("==========================================");
            console.log("socks5 server listing " + config["remote-host"] + ":" + config["remote-port"]);
            console.log("==========================================\n");
            listen();
        }, function (e) {
            if (e.indexOf("EADDRINUSE") > 0) {
                console.log("\n====================== Error ======================");
                console.log("remote-host:remote-port");
                console.log(" " + config["remote-host"] + ":" + config["remote-port"] + " 已经被使用，请使用其他地址或端口！");
                console.log("===================================================\n");
            }
            that.stop();
        });
    } else {
        listen();
    }
    function listen() {
        that.server.listen(config.port, config.host, function () {
            console.log("\n启动代理服务器...");
            console.log("=============== Configure ================");
            console.log(JSON.stringify(config, null, "    "));
            console.log("==========================================\n");
        }).on("error", function (e) {
            console.log(e);
            if (e.errno === "EADDRINUSE") {
                console.log("\n====================== Error ======================");
                console.log("host:port");
                console.log(" " + config.host + ":" + config.port + " 已经被使用，请使用其他地址或端口！");
                console.log("===================================================\n");
            }
            if (socks5) {
                socks5.close();
            }
        });
    }
};
Server.prototype.stop = function () {
    if (!this.server) {
        return;
    }
    try { // node v0.10.*
        this.server.close();
    } catch (ex) {
        // empty
    }
};
