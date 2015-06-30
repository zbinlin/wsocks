"use strict";

var net = require("net");
var debuglog = require("util").debuglog || function (prefix) {
    var ps = prefix.split(":");
    prefix = ps[0];
    var level = ps[1] || "info";
    var debugs = (process.env["NODE_DEBUG"] || "").split(",");
    if (debugs.some(function (item) {
        return item.toLowerCase() == prefix.toLowerCase();
    })) {
        prefix = prefix.toUpperCase() + " " + process.pid + ":";
    } else {
        prefix = null;
    }

    return function (str) {
        if (prefix) {
            console.log(prefix, str);
        }
    };
};
var logger = {};
logger.debug = debuglog("ip-helper:debug");
logger.info = debuglog("ip-helper:info");
logger.warn = debuglog("ip-helper:warn");
logger.error = debuglog("ip-helper:error");

var format = {
    bold: function (str) {
        return "\u001b[1m" +  str + "\u001b[0m";
    }
}


/*
 * 将有效的数字（32位整数值） IPv4 地址转成字串串形式：xx.xx.xx.xx
 * 如果无法转换（不是有效的地址），将直接返回原来的值。
 *
 * @param {*} ip
 * @return {string|*}
 */
function ip2str(ip) {
    try {
        var num = Number(ip);
        if (num >>> 24 > 0) {
            var a = num >>> 24;
            var b = num >>> 16 & 0xff;
            var c = num >>> 8 & 0xff;
            var d = num & 0xff;
            return [a, b, c, d].join(".");
        } else {
            return ip;
        }
    } catch (ex) {
        return ip;
    }
}

/*
* IP 地址字符串轉換為 IP buffer 對象
* 如：
*  127.0.0.1 轉換成 <Buffer[7f, 00, 00, 01]>
*  2001:0DB8::1428:57ab 轉換成 <Buffer 20 01 0d b8 00 00 00 00 00 00 00 00 14 28 57 ab>
*  @param {string} str
*  @returns {Buffer}
*/
function ip_str2buf(str) {

    // 将数字形式的 ip，如 0xffffffff 转成字符串 "255.255.255.255"
    str = ip2str(str);

    str = ipv4(str);
    str = ipv6(str);

    if (net.isIPv4(str)) {
        return new Buffer(str.split(".").map(function (item) {
            return parseInt(item, 10);
        }));
    } else if (net.isIPv6(str)) {
        return new Buffer(str.split(":").reduce(function (pre, cur, idx, arr) {
            pre.push(parseInt(cur, 16) >>> 8)
            pre.push(0xFF & parseInt(cur, 16));
            return pre;
        }, []));
    } else {
        throw new Error("非法 IP 地址：" + str + "！");
    }

    function ipv4(str) {
        var arr = str.split(".");
        var len = arr.length;
        if (len > 1 && len < 4) {
            arr.splice.bind(arr, len - 1, 0).apply(null, [0, 0].slice(0, 4 - len));
            return arr.join(".");
        }
        return str;
    }
    function ipv6(str) {
        if ("string" !== typeof str) {
            logger.debug("ipv6 %s", str);
            return str;
        }
        var H = "0000:0000:0000:0000:0000:0000:0000:0000".split(":");
        if (str == "::") {
            return H.join(":");
        }
        if (/:{3,}/.test(str)) {
            logger.debug("ipv6 invaild %s, string contain `:::`", format.bold(str));
            return str;
        }
        // ipv6 中只允许 :: 出现最多一处
        var colons = str.match(/::/g);
        if (colons && colons.length > 1) {
            logger.debug("ipv6 invaild %s, found multi ::", format.bold(str));
            return str;
        }
        var arr = str.split(":");
        if (arr.length > 8) {
            logger.debug("ipv6 invaild %s, : more than 7", format.bold(str));
            return str;
        }
        if (arr.length < 8 && !colons) {
            logger.debug("ipv6 invaild %s, no more ::", format.bold(str));
            return str;
        }
        if (arr.length == 7 && colons) {
            logger.debug("ipv6 invaild %s,  RFC 5952 recommends that a double colon must not be used to denote an omitted single section of zeroes.", format.bold(str));
            return str;
        }
        try {
            var oarr = H.slice(0, H.length - arr.length + 1);
            return arr.reduce(function (narr, item, idx) {
                if (item === "") {/* :: */
                    if (idx == 0 || idx == arr.length - 1) {
                        return narr;
                    }
                    narr.push.apply(narr, oarr);
                    oarr = [];
                } else {
                    if (!/^[a-f0-9]{1,4}$/i.test(item)) {
                        logger.debug("ipv6 invaild %s at %d: %s", format.bold(str), idx, item);
                        throw new Error;
                    }
                    narr.push(item);
                }
                return narr;
            }, []).join(":");
        } catch (ex) {
            logger.debug("ipv6 invaild %s, failed to expand, more: %s\n%s", format.bold(str), ex.message || ex, ex.stack || "");
            return str;
        }
    }
}

/*
* IP Buffer 對象轉換成 IP 地址字符串
* 如：
* <Buffer 7f 00 00 01> 轉換成 127.0.0.1
* @param {Buffer} buf
* @param {string} [type = "ipv4"]
* @returns {string}
*/
function ip_buf2str(buf, type) {
    var str = "";
    if (!(buf instanceof Buffer)) {
        throw new Error("第一個參數::" + buf + ":: 不是一個 Buffer 對象！");
    }
    if (!type) {
        type = "ipv4";
    }
    type += "";
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
            str = trimIpv6(str);
            break;
        default:
            throw new Error("第二個參數 ::" + type + ":: 為未知類型！");
    }
    if (net.isIP(str)) {
        return str;
    } else {
        throw new Error("無法轉換成合法的 IP 地址！");
    }

    function trimIpv6(ip) {
        if (!net.isIPv6(ip)) return ip;

        ip = ip.replace(/(^|:)0+(\w)/g, "$1$2");

        if (!/::/.test(ip)) {
            return ip.replace(/(^|:)(?:0{1,4}:(?:0{1,4}$)?){2,}/, "::");
        }
        return ip;
    }
}

exports.ip_str2buf = ip_str2buf;
exports.ip_buf2str = ip_buf2str;
