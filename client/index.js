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

var REMOTE_PORT = clientConfig["remote-port"] || 1981;
var REMOTE_ADDR = clientConfig["remote-addr"] || null;
var LOCAL_PORT = clientConfig["local-port"] || 3333;
var LOCAL_ADDR = clientConfig["local-addr"] || null;

var ALGORITHM = clientConfig.algorithm || "RC4";
var PASSWORD = clientConfig.algorithm || "password";

var CLIENT_KEY_FILE = clientConfig["client-key-file"] || path.resolve(__dirname, "../keys/client-key.pem");
var CLIENT_CERT_FILE = clientConfig["client-cert-file"] || path.resolve(__dirname, "../keys/client-cert.pem");
var CA_CERT_FILE = clientConfig["ca-cert-file"] || path.resolve(__dirname, "../keys/ca-cert.pem");

var opt = {
    key: fs.readFileSync(path.resolve(BASE_DIR, CLIENT_KEY_FILE)),
    cert: fs.readFileSync(path.resolve(BASE_DIR, CLIENT_CERT_FILE)),
    rejectUnauthorized: true,
    ca: [
        fs.readFileSync(path.resolve(BASE_DIR, CA_CERT_FILE))
    ]
};
opt.port = REMOTE_PORT;
opt.host = REMOTE_ADDR;

var server = net.createServer(function (socket) {
    var cipher = crypto.createCipher(ALGORITHM, new Buffer(PASSWORD));
    var decipher = crypto.createDecipher(ALGORITHM, new Buffer(PASSWORD));
    var remoteSocket = tls.connect(opt);
    socket.pipe(cipher).pipe(remoteSocket).on("error", function (e) {
        console.error(e);
    }).pipe(decipher).pipe(socket).on("error", function (e) {
        console.error(e);
    });
});

server.listen(LOCAL_PORT, LOCAL_ADDR, function () {
    console.log("listening...");
    console.log([LOCAL_ADDR || "0.0.0.0", LOCAL_PORT].join(":"));
});

server.on("error", function (e) {
    console.error(e);
});
