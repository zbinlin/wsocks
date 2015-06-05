var net = require("net");
var tls = require("tls");
var fs = require("fs");
var path = require("path");
var crypto = require("crypto");

var BASE_DIR = path.resolve(__dirname, "../");

try {
    var config = require("../config.json");
    if (!config) {
        config = {};
    }
} catch (ex) {
    config = {};
}
var serverConfig = config.server || {};
var clientConfig = config.client || {};

var SERVER_PORT = serverConfig["server-port"] || 1981;
var SERVER_ADDR = serverConfig["server-addr"] || null;
var SOCKS_PORT = serverConfig["socks-port"] || 1999;
var SOCKS_ADDR = serverConfig["socks-addr"] || "localhost";

var ALGORITHM = serverConfig.algorithm || "RC4";
var PASSWORD = serverConfig.algorithm || "password";

var SERVER_KEY_FILE = serverConfig["server-key-file"] || path.resolve(__dirname, "../keys/server-key.pem");
var SERVER_CERT_FILE = serverConfig["server-cert-file"] || path.resolve(__dirname, "../keys/server-cert.pem");
var CA_CERT_FILE = serverConfig["ca-cert-file"] || path.resolve(__dirname, "../keys/ca-cert.pem");

require("../lib/socks5")({
    port: SOCKS_PORT,
    host: SOCKS_ADDR
}, function () {
    console.log("socks5 server start", "listing port 1999 ...");
}).on("error", function (e) {
    console.error(e);
});

var opt = {
    key: fs.readFileSync(path.resolve(BASE_DIR, SERVER_KEY_FILE)),
    cert: fs.readFileSync(path.resolve(BASE_DIR, SERVER_CERT_FILE)),
    requestCert: true,
    rejectUnauthorized: true,
    ca: [
        fs.readFileSync(path.resolve(BASE_DIR, CA_CERT_FILE))
    ]
};

var server = tls.createServer(opt, function (socket) {
    var cipher = crypto.createCipher(ALGORITHM, new Buffer(PASSWORD));
    var decipher = crypto.createDecipher(ALGORITHM, new Buffer(PASSWORD));
    var socksClient = net.connect({
        port: SOCKS_PORT,
        host: SOCKS_ADDR
    });
    socket.pipe(decipher).pipe(socksClient).pipe(cipher).pipe(socket);
});

server.listen(SERVER_PORT, SERVER_ADDR, function () {
});

server.on("error", function (e) {
    console.error(e);
});
