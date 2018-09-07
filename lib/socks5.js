var net = require("net");

var ipHelper = require("ip-helper");

module.exports = function (config, listening) {

    config["port"] || (config["port"] = 1080);
    config["host"] || (config["host"] = undefined);

    if ("function" !== typeof listening) {
        listening = function () {};
    }

    var server = net.createServer({
        allowHalfOpen: false
    }, function (socket) {
        socket.on("readable", function __readable_handle__() {
            var buffer = socket.read();
            for (
                var buf;
                null !== (buf = socket.read());
                buffer = Buffer.concat([buffer, buf])
            );
            if (buffer === null) {
                destroy();
                return;
            }
            var cursor = 0;
            var addressType = buffer[0];
            cursor += 1;
            var host, port;
            switch (addressType) {
                case 0x01:
                    try {
                        host = ipHelper.buf2str(
                            buffer.slice(cursor, cursor + 4)
                        );
                    } catch (ex) {
                        console.error(ex.message, cursor, buffer);
                        destroy();
                        return;
                    }
                    cursor += 4;
                    try {
                        port = buffer.readUInt16BE(cursor);
                    } catch (ex) {
                        console.error(ex.message, cursor, buffer);
                        destroy();
                        return;
                    }
                    break;
                case 0x03:
                    var len = buffer[cursor];
                    cursor += 1;
                    host = buffer.slice(cursor, cursor + len).toString("ascii");
                    cursor += len;
                    try {
                        port = buffer.readUInt16BE(cursor);
                    } catch (ex) {
                        console.error(ex.message, cursor, buffer);
                        destroy();
                        return;
                    }
                    break;
                case 0x04:
                    try {
                        host = ipHelper.buf2str(
                            buffer.slice(cursor, cursor + 16)
                        );
                    } catch (ex) {
                        console.error(ex.message, cursor, buffer);
                        destroy();
                        return;
                    }
                    cursor += 16;
                    try {
                        port = buffer.readUInt16BE(cursor);
                    } catch (ex) {
                        console.error(ex.message, cursor, buffer);
                        destroy();
                        return;
                    }
                    break;
                default:
                    destroy();
                    return;
            }
            socket.removeListener("readable", __readable_handle__);

            var remoteSocket = net.connect({
                host: host,
                port: port
            });
            remoteSocket.once("connect", function () {
                remoteSocket.removeListener("error", onError);
                var buf = Buffer.from([0x05, 0x00, 0x00]);
                var host = socket.address();
                var addressType = Buffer.from([0x00]);
                if (host.family === "IPv4") {
                    addressType[0] = 0x01;
                } else if (host.family === "IPv6") {
                    addressType[0] = 0x04;
                }
                var hostname = ipHelper.str2buf(host.address || "127.0.0.1");
                var port = Buffer.alloc(2);
                port.writeUInt16BE(host.port, 0); // node 0.10 需要指定 offset
                buf = Buffer.concat([buf, addressType, hostname, port]);
                socket.write(buf);

                socket.pipe(remoteSocket).pipe(socket);
                socket.on("error", function (err) {
                    console.error("socks5 socket error", err.message);
                    remoteSocket.destroy();
                });
                remoteSocket.on("error", function (err) {
                    console.error("remote socket error", err.message);
                    socket.destroy();
                });
            });
            remoteSocket.on("error", onError);

            function onError(err) {
                if (err.errno === "ECONNREFUSED") {
                    socket.end(Buffer.from([0x05, 0x05, 0x00]));
                } else {
                    socket.end(Buffer.from([0x05, 0x04, 0x00]));
                }
            }

            function destroy() {
                socket.removeListener("readable", __readable_handle__);
                socket.end(Buffer.from([0x05, 0x01, 0x00]));
            }

            socket.once("close", function () {
                remoteSocket.destroy();
            });
        });
    }).listen(config["port"], config["host"], listening);

    return server;

};

