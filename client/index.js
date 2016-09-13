"use strict";

var net = require("net");
var tls = require("tls");
var fs = require("fs");
var path = require("path");
var crypto = require("crypto");
var ipHelper = require("ip-helper");
//var Transform = require("stream").Transform;

const DEBUG = function () {
    console.error(new Date().toISOString(), ...arguments);
};

var Client = module.exports = function (config) {
    if (!(this instanceof Client)) {
        return new Client(config);
    }
    var CIPHER = config.cipher;
    var PASSWORD = config.password;
    var KEY = new Buffer(PASSWORD);

    var opt = {
        host: config["remote-host"],
        port: config["remote-port"],
    };

    var CA_CERT_FILE = this.resolve(config["ca-cert-file"]);
    var KEY_FILE = this.resolve(config["key-file"]);
    var CERT_FILE = this.resolve(config["cert-file"]);

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

    var server = net.createServer(function (socket) {
        let processor = null;
        socket.on("readable", function __readable_handle__() {
            let buffer = socket.read();
            for (
                let data;
                null !== (data = socket.read());
                Buffer.concat([buffer, data])
            );
            if (processor === null) {
                processor = parser(buffer);
            }
            try {
                let rst = processor.next(buffer);
                if (rst.done) {
                    socket.removeListener("readable", __readable_handle__);
                    socket.removeListener("error", onSocketError);
                    connect(rst.value, socket);
                } else {
                    socket.write(rst.value);
                }
            } catch (ex) {
                socket.removeListener("readable", __readable_handle__);
                socket.removeListener("error", onSocketError);
                socket.destroy();
                return;
            }
        });
        function onSocketError(err) {
            console.error("Socket:", err.message || err);
        }
        socket.on("error", onSocketError);
    });
    this.config = config;
    this.server = server;

    function connect(buf, src) {
        var cipher = crypto.createCipher(CIPHER, KEY);
        var decipher = crypto.createDecipher(CIPHER, KEY);
        let remoteSocket = (enableTls ? tls : net).connect(opt);
        remoteSocket.once("connect", function () {
            remoteSocket.removeListener("error", onError);
            let obf = new Buffer(Math.floor(Math.random() * 513));
            for (let i = 0, len = obf.length; i < len; i++) {
                obf[i] = Math.floor(Math.random() * 256);
            }
            let buffer = Buffer.concat([buf, obf]);
            cipher.write(buffer);

            src.on("error", errorCallback);
            remoteSocket.on("error", errorCallback);
            src.on("close", cleanup);
            remoteSocket.on("close", cleanup);

            //var dumpBefore = new Transform({
            //    transform(data, encoding, next) {
            //        console.error("-->", data.toString("hex"));
            //        next(null, data);
            //    },
            //});
            //var dumpAfter = new Transform({
            //    transform(data, encoding, next) {
            //        console.error("<--", data.toString("hex"));
            //        next(null, data);
            //    },
            //});

            src/*.pipe(dumpBefore)*/.pipe(cipher)
               .pipe(remoteSocket)
               .pipe(decipher)
               /*.pipe(dumpAfter)*/
               .pipe(src);

            function errorCallback(e) {
                remoteSocket.destroy();
                src.destroy();
                console.error(this === src ? "Socket:" : "RemoteSocket:", e.message || e);
            }
            function cleanup() {
                this.removeListener("close", cleanup);
                this.removeListener("error", errorCallback);
            }
        });
        remoteSocket.on("error", onError);
        function onError(err) {
            src.destroy();
            console.error("RemoteSocket", err.message);
        }
    }

    function* parser(buffer) {
        let debug1 = DEBUG.bind(undefined, "step1");
        if (!Buffer.isBuffer(buffer)) {
            debug1("no data");
            throw new TypeError("buffer is not a Buffer.");
        }
        let idx = 0;
        let cursor = idx;
        if (buffer[cursor] !== 0x05) { // 只支持 SOCKS5
            debug1("only supports SOCKS5");
            throw new Error("Only supports SOCKS5");
        }
        cursor += 1;
        let authMethodsLength = buffer[cursor];
        cursor += 1;
        let authMethods = buffer.slice(cursor, cursor + authMethodsLength);
        cursor += authMethodsLength;
        let acceptable = false;
        for (let v of authMethods) {
            if (v === 0x00) { // 只支持 0x00: No authentication
                acceptable = true;
                break;
            }
        }
        if (!acceptable) {
            debug1("only supports no authentication");
            throw new Error("Only supports no authentication");
        }

        buffer = yield new Buffer([0x05, 0x00]);

        let debug2 = DEBUG.bind("undefined", "step2");
        if (!Buffer.isBuffer(buffer)) {
            debug2("no data");
            throw new TypeError("buffer is not a Buffer.");
        }
        idx = 0;
        cursor = idx;
        if (buffer[cursor] !== 0x05) {
            debug2("only supports SOCKS5");
            throw new Error("Only supports SOCKS5");
        }
        cursor += 1;
        if (buffer[cursor] !== 0x01) { // 只支持 TCP/IP stream connection
            debug2("only supports TCP/IP stream connection", buffer[cursor]);
            throw new Error("Only supports TCP/IP stream connection");
        }
        cursor += 1;
        if (buffer[cursor] !== 0x00) { // 非法字符
            debug2("reserved, must be 0x00");
            throw new Error("reserved, must be 0x00");
        }
        cursor += 1;
        let addressType = buffer[cursor];
        let host;
        idx = cursor;
        cursor += 1;
        switch (addressType) {
            case 0x01:
                host = ipHelper.buf2str(buffer.slice(cursor, cursor + 4));
                if (!net.isIPv4(host)) {
                    debug2("invalid ipv4 ip", host);
                    throw new Error(`Invalid IPv4 ip ${host}`);
                }
                host = buffer.slice(idx, cursor + 4 + 2);
                break;
            case 0x03:
                host = buffer.slice(idx, cursor + 1 + buffer[cursor] + 2);
                break;
            case 0x04:
                host = ipHelper.buf2str(buffer.slice(cursor, cursor + 16));
                if (!net.isIPv6(host)) {
                    debug2("invalid buffer:", buffer);
                    debug2("invalid ipv6 ip", host);
                    throw new Error(`Invalid IPv6 ip: ${host}`);
                }
                host = buffer.slice(idx, cursor + 16 + 2);
                break;
            default:
                debug2("unkown address type", addressType);
                throw new Error(`Unkown address type: ${addressType}`);
        }
        return host;
    }

};

Client.prototype.resolve = function (pathname) {
    var homeDir = process.env[~process.platform.indexOf("win") ? "USERPROFILE" : "HOME"];
    return pathname.replace(/^~(?:(?=\/|\\)|$)/, function () { return homeDir; })
                   .replace(/\\|\//g, path.sep);
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
        //
    }
};
