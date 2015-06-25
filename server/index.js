"use strict";

var net = require("net");
var tls = require("tls");
var fs = require("fs");
var path = require("path");
var crypto = require("crypto");

var Server = module.exports = function (config) {
    if (!(this instanceof Server)) {
        return new Server(config);
    }
    var CIPHER = config.cipher;
    var PASSWORD = config.password;
    var KEY = crypto.pbkdf2Sync(PASSWORD, "wsocks-salt", 4096, 512, "sha256");

    var opt = {
    };

    var CA_CERT_FILE = resolve(config["ca-cert-file"]);
    var KEY_FILE = resolve(config["key-file"]);
    var CERT_FILE = resolve(config["cert-file"]);

    var enableTls = config.enableTls;
    if (enableTls) {
        try {
            opt["ca-cert-file"] = fs.readFileSync(CA_CERT_FILE);
            opt["key-file"] = fs.readFileSync(KEY_FILE);
            opt["cert-file"] = fs.readFileSync(CERT_FILE);
            opt["requestCert"] = true;
            opt["rejectUnauthorized"] = true;
        } catch (ex) {
            console.error(ex);
        }
    }
    function resolve(path) {
        var homeDir = process.env[~process.platform.indexOf("win") ? "USERPROFILE" : "HOME"];
        return path.replace(/^~(?:(?=\/|\\)|$)/, function () { return homeDir })
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
        socket.pipe(decipher).pipe(remoteSocket).on("error", function (e) {
            remoteSocket.destroy();
            socket.destroy();
            console.error(e.message || e);
        }).pipe(cipher).pipe(socket).on("error", function (e) {
            console.error(e.message || e);
        });
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
    this.server.close();
};
