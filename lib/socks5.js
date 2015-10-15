var net = require("net");

var ipHelper = require("ip-helper");

module.exports = function (config, listening) {

    config["port"] || (config["port"] = 1080);
    config["host"] || (config["host"] = null);

    if ("function" !== typeof listening) {
        listening = function () {};
    }

    var server = net.createServer({
        allowHalfOpen: false
    }, function (socket) {
        var init = false;
        var remoteSocket, authReq = false;
        socket.on("data", function (b) {
            if (!init) {
                init = true;
                switch (b[0]) {
                    case 0x04:
                        socket.write(new Buffer.concat([new Buffer([0x00, 0x5b]), b.slice(2, 8)]));
                        break;
                    case 0x05:
                        var ver = 0x05, buffers = [];
                        var methods = b.slice(2, b[1] + 2);
                        var hasAuth = config["username"] && config["password"];
                        for (var i = 0; i < methods.length; i++) {
                            if (hasAuth && 0x02 === methods[i]) { /* USERNAME/PASSWORD */
                                buffers.unshift(new Buffer([ver, 0x02])); /* 優先使用 口令/密碼 驗證 */
                                authReq = true;
                                break;
                            } else if (!hasAuth && 0x00 === methods[i]) {
                                buffers.push(new Buffer([ver, 0x00]));
                            }
                        }
                        buffers.push(new Buffer([ver, 0xff]));
                        socket.write(buffers[0]);
                        break;
                    default:
                        socket.end();
                }
            } else if (authReq) {
                authReq = false;
                if (0x01 !== b[0]) {
                    socket.end();
                }
                var username = b.toString("ascii", 2, b[1] + 2),
                    password = b.toString("ascii", b[1] + 2, b[b[1] + 2] + b[1] + 2);
                var status = (username === config["username"] && password === config["password"]);
                if (!status) {
                    socket.write([0x01, 0x00]);
                } else {
                    socket.end([0x01, 0x01]);
                }
            } else if (!remoteSocket) {
                remoteSocket = new net.Socket();
                var host = "", port = 0;
                switch (b[3]) {
                    case 0x01: /* IPv4 */
                        host = ipHelper.buf2str(b.slice(4, 8), "IPv4");
                        port = b.slice(8, 10).readUInt16BE(0);
                        break;
                    case 0x03: /* Domain */
                        var l = b[4];
                        host = b.toString("ascii", 5, 5 + l);
                        port = b.slice(5 + l, 5 + l + 2).readUInt16BE(0);
                        break;
                    case 0x04: /* IPv6 */
                        host = ipHelper.buf2str(b.slice(4, 20), "IPv6");
                        port = b.slice(20, 22).readUInt16BE(0);
                        break;
                    default:
                }
                var localAddress = ipHelper.str2buf(socket.localAddress),
                    localPort = new Buffer([socket.localPort >>> 8, socket.localPort & 0xFF]),
                    addressType = new Buffer([net.isIPv4(socket.localAddress) ? 0x01 : net.isIPv6(socket.localAddress) ? 0x04 : 0x03]);
                switch (b[1]) {
                    case 0x01: /* CONNECT */
                        remoteSocket.connect(port, host, function () {
                            var buf = Buffer.concat([new Buffer([0x05, 0x00, 0x00]), addressType, localAddress, localPort]);
                            socket.write(buf);
                            remoteSocket.pipe(socket);
                        });
                        remoteSocket.once("error", function __remote_socket_error_handle__(err) {
                            remoteSocket.unpipe(socket);
                            try {
                                socket.end(Buffer.concat([new Buffer([0x05, 0x01, 0x00]), addressType, localAddress, localPort]));
                            } catch (ex) {
                                socket.destroy();
                            }
                        });
                        remoteSocket.once("close", function __remote_socket_close_handle__() {
                            this.removeAllListeners("error");
                            remoteSocket = null;
                            try {
                                socket.end();
                            } catch (ex) {
                            }
                        });
                        break;
                    case 0x02: /* BIND */
                    case 0x03: /* UDP ASSOCIATE */
                    default: /* Command not supported */
                        socket.end(Buffer.concat([new Buffer([0x05, 0x07, 0x00]), addressType, localAddress, localPort]));
                        return;
                }
            } else {
                remoteSocket.write(b);
            }
        }).once("error", function __socket_error_handle__(err) {
            remoteSocket && remoteSocket.destroy();
            socket.destroy();
        }).once("close", function __socket_close_handle() {
            if (remoteSocket) {
                remoteSocket.unpipe(socket);
                remoteSocket.destroy();
                process.nextTick(function () {
                    remoteSocket = null;
                });
            }
        });

    }).listen(config["port"], config["host"], listening);

    return server;

};

