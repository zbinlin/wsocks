"use strict";

var net = require("net");
var stream = require("stream");
var StringDecoder = require("string_decoder").StringDecoder;

exports.createHttpClient = function (socket) {

    var path = "/" + Math.floor(Math.random() * 10000) + ".html";
    var host = socket.remoteAddress + ":" + socket.remotePort;

    var requestHeader = [
        "GET " + path + " HTTP/1.1",
        "Host: " + host,
        "Accept: */*",
        "User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:40.0) Gecko/20100101 Firefox/40.0",
    ].join("\r\n");
    requestHeader = Buffer.from(requestHeader, "binary");

    socket.write(requestHeader);
    socket.resume();

    return socket;
};

exports.createHttpServer = function () {

    var transform = new stream.Transform;
    var firstRun = true, isAntiGFW = false;
    var sockets = [];

    transform._transform = function (chunk, encoding, next) {
        if (firstRun) {
            firstRun = false;
            var txt = this.stringDecoder.write(chunk);
            if (/^\w+\s+(\S+)\s+HTTP\/\d+\.\d+/i.test(txt)) {
                isAntiGFW = true;
                var responseBody = [
                    '<!DOCTYPE html>',
                        '<html lang="zh-Hans">',
                        '<head>',
                            '<meta charset="UTF-8">',
                            '<title>Hello World</title>',
                        '</head>',
                        '<body>',
                            "Hello World: " + Math.random(),
                        '</body>',
                    '</html>',
                ""].join("\n");
                responseBody = Buffer.from(responseBody);
                var responseHeader = [
                    "HTTP/1.1 200 OK",
                    "Data: " + new Date().toUTCString(),
                    "Content-Type: text/html; charset=utf-8",
                    "Content-Length: " + responseBody.length,
                    "Connection: close"
                ].join("\r\n");
                responseHeader = Buffer.from(responseHeader, "binary");
                var response = Buffer.concat([responseHeader, Buffer.from("\r\n\r\n", "binary"), responseBody]);
                sockets.forEach(function (socket) {
                    socket.end(response);
                });
                next();
            } else {
                next(null, chunk);
            }
        } else if (isAntiGFW) {
            next();
        } else {
            next(null, chunk);
        }
    };
    transform.on("pipe", function (src) {
        this.stringDecoder = new StringDecoder("ascii");
        sockets.push(src);
    });
    transform.on("unpipe", function (src) {
        this.stringDecoder.end();
        delete this.stringDecoder;
        for (var i = 0; i < sockets.length; i++) {
            if (sockets[i] === src) {
                sockets.splice(i--, 1);
            }
        }
    });

    return transform;
}
