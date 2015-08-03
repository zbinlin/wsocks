"use strict";

var net = require("net");
var tls = require("tls");
var fs = require("fs");
var path = require("path");
var crypto = require("crypto");

var createHttpServer = require("../lib/anti-gfw").createHttpServer;

var Server = module.exports = function (config) {
    if (!(this instanceof Server)) {
        return new Server(config);
    }
    var CIPHER = config.cipher;
    var PASSWORD = config.password;
    var KEY = new Buffer(PASSWORD);

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
        return pathname.replace(/^~(?:(?=\/|\\)|$)/, function () { return homeDir })
                   .replace(/\\|\//g, path.sep);
    }

    var REMOTE_HOST = config["remote-host"];
    var REMOTE_PORT = config["remote-port"];

    var server = (enableTls ? tls : net).createServer(opt, function (socket) {
        var cipher = crypto.createCipher(CIPHER, KEY);
        var decipher = crypto.createDecipher(CIPHER, KEY);
        var remoteSocket = net.connect({
            port: REMOTE_PORT,
            host: REMOTE_HOST
        });

        socket.on("error", errorCallback);
        remoteSocket.on("error", errorCallback);
        socket.on("close", cleanup);
        remoteSocket.on("close", cleanup);

        socket.pipe(createHttpServer())
              .pipe(decipher)
              .pipe(remoteSocket)
              .pipe(cipher)
              .pipe(socket);

        function errorCallback(e) {
            remoteSocket.destroy();
            socket.destroy();

            console.error(this === socket ? "Socket:" : "RemoteSocket:", e.message || e);
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
        socks5 = require("../lib/socks5")({
            port: config["remote-port"],
            host: config["remote-host"]
        }, function () {
            console.log("\n启动 SOCKS5 服务...");
            console.log("==========================================");
            console.log("socks5 server listing " + config["remote-host"] + ":" + config["remote-port"]);
            console.log("==========================================\n");
            listen();
        }).on("error", function (e) {
            if (e.errno === "EADDRINUSE") {
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
    }
};
