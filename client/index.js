"use strict";

var net = require("net");
var tls = require("tls");
var fs = require("fs");
var path = require("path");
var crypto = require("crypto");

var createHttpPingClient = require("../lib/http-ping-service").createHttpClient;

var Client = module.exports = function (config) {
    if (!(this instanceof Client)) {
        return new Client(config);
    }
    var CIPHER = config.cipher;
    var PASSWORD = config.password;
    var KEY = new Buffer(PASSWORD);

    var opt = {
        host: config["remote-host"],
        port: config["remote-port"]
    };

    var CA_CERT_FILE = resolve(config["ca-cert-file"]);
    var KEY_FILE = resolve(config["key-file"]);
    var CERT_FILE = resolve(config["cert-file"]);

    var enableTls = config["enable-tls"];
    if (enableTls) {
        try {
            opt.ca = [fs.readFileSync(CA_CERT_FILE)];
            opt.key = fs.readFileSync(KEY_FILE);
            opt.cert = fs.readFileSync(CERT_FILE);
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

    var server = net.createServer(function (socket) {
        // anti GFW
        if (config["http-ping"]) {
            (enableTls ? tls : net).connect(opt, function () {
                createHttpPingClient(this);
            }).on("error", function () {});
        }

        var cipher = crypto.createCipher(CIPHER, KEY);
        var decipher = crypto.createDecipher(CIPHER, KEY);
        var remoteSocket = (enableTls ? tls : net).connect(opt);

        socket.on("error", errorCallback);
        remoteSocket.on("error", errorCallback);
        socket.on("close", cleanup);
        remoteSocket.on("close", cleanup);

        socket.pipe(cipher).pipe(remoteSocket).pipe(decipher).pipe(socket);

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

Client.prototype.start = function () {
    if (!this.server) {
        return;
    }
    var config = this.config;
    this.server.listen(config.port, config.host, function () {
        console.log("\nstart...");
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
    });
};

Client.prototype.stop = function () {
    if (!this.server) {
        return;
    }
    try { // node v0.10.*
        this.server.close();
    } catch (ex) {
    }
};
