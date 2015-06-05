var net = require("net");

module.exports = function (config, listening) {

    config["port"] || (config["port"] = 1080);
    config["host"] || (config["host"] = null);

    if ("function" !== typeof listening) {
        listening = function () {};
    }

    var server = net.createServer(function (socket) {
        var init = false;
        var remoteSocket, authReq = false;;
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
                        host = ip_buf2str(b.slice(4, 8), "IPv4");
                        port = b.slice(8, 10).readUInt16BE(0);
                        break;
                    case 0x03: /* Domain */
                        var l = b[4];
                        host = b.toString("ascii", 5, 5 + l);
                        port = b.slice(5 + l, 5 + l + 2).readUInt16BE(0);
                        break;
                    case 0x04: /* IPv6 */
                        host = ip_buf2str(b.slice(4, 20), "IPv6");
                        port = b.slice(20, 22).readUInt16BE(0);
                        break;
                    default:
                }
                var localAddress = ip_str2buf(socket.localAddress),
                    localPort = new Buffer([socket.localPort >>> 8, socket.localPort & 0xFF]),
                    addressType = new Buffer([net.isIPv4(socket.localAddress) ? 0x01 : net.isIPv6(socket.localAddress) ? 0x04 : 0x03]);
                switch (b[1]) {
                    case 0x01: /* CONNECT */
                        remoteSocket.connect(port, host, function () {
                            var buf = Buffer.concat([new Buffer([0x05, 0x00, 0x00]), addressType, localAddress, localPort]);
                            socket.write(buf);
                        });
                        remoteSocket.on("data", function (b) {
                            socket.write(b);
                        }).on("end", function () {
                            socket.end();
                        }).on("error", function (err) {
                            socket.end(Buffer.concat([new Buffer([0x05, 0x01, 0x00]), addressType, localAddress, localPort]));
                            //remoteSocket.destroy();
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
        }).on("end", function (d) {
            remoteSocket = null;
        }).on("error", function (err) {
            socket.destroy();
        });

    }).listen(config["port"], config["host"], listening);

    return server;

};

/*
* IP 地址字符串轉換為 IP buffer 對象
* 如：
*  127.0.0.1 轉換成 buffer[127, 0, 0, 1]
*  2001:0DB8::1428:57ab 轉換成 <Buffer 32 1 13 184 0 0 0 0 0 0 0 0 20 40 87 171]
*/
function ip_str2buf(str) {
    if (net.isIPv4(str)) {
        return new Buffer(str.split(".").map(function (item) {
            return parseInt(item, 10);
        }));
    } else if (net.isIPv6(str)) {
        return new Buffer(str.split(":").reduce(function (pre, cur, idx, arr) {
            if ("" === cur) {
                pre = pre.concat(new Array((8 - arr.length + 1) * 2).join("0").split("").map(Number));
            } else {
                pre.push(parseInt(cur, 16) >>> 8)
                pre.push(0xFF & parseInt(cur, 16));
            }
            return pre;
        }, []));
    } else {
        throw new Error("非法 IP 地址：" + str + "！");
        return null;
    }
}

/*
* IP Buffer 對象轉換成 IP 地址字符串
* 如：
* <Buffer 7f 00 00 01> 轉換成 127.0.0.1
*/
function ip_buf2str(buf, type) {
    var str = "";
    if (!(buf instanceof Buffer)) {
        throw new Error("第一個參數::" + buf + ":: 不是一個 Buffer 對象！");
        return str;
    }
    switch (type.toLowerCase()) {
        case "ipv4":
            str = ([]).slice.apply(buf.slice(0, 4)).join(".");
            break;
        case "ipv6":
            str = ([]).slice.apply(buf.slice(0, 16)).reduce(function (pre, cur, idx, arr) {
                if (0 === idx % 2) {
                    pre.push((cur << 8 | arr[idx + 1]).toString(16));
                }
                return pre;
            }, []).join(":");
            break;
        default:
            throw new Error("第二個參數 ::" + type + ":: 為未知類型！");
            return str;
    }
    if (net.isIP(str)) {
        return str;
    } else {
        throw new Error("無法轉換成合法的 IP 地址！");
        return "";
    }
}
