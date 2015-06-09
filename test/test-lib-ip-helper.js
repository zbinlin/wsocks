"use strict";

var assert = require("assert");
var util = require("util");
var rewire = require("rewire");

var ipHelper = require("../lib/ip-helper");

var testLibIpHelper = function () {
    describe("test lib module: ip-helper.js", function () {
        var IP_STR_1 = "127.0.0.1",
            IP_STR_2 = "2001:DB8::1428:57ab",
            IP_BUF_1 = new Buffer([127, 0, 0, 1]),
            IP_BUF_2 = new Buffer([0x20, 0x01, 0x0d, 0xb8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x14, 0x28, 0x57, 0xab]);
        describe(".ip_str2buf", function () {
            it(IP_STR_1 + " -> " + util.inspect(IP_BUF_1), function () {
                assert.ok(ipHelper.ip_str2buf(IP_STR_1).equals(IP_BUF_1));
            });

            it(IP_STR_2 + " -> " + util.inspect(IP_BUF_2), function () {
                assert.ok(ipHelper.ip_str2buf(IP_STR_2).equals(IP_BUF_2));
            });

            it("abcd should throw an Error", function () {
                assert.throws(function () {
                    ipHelper.ip_str2buf("abcd");
                }, /非法 IP 地址/)
            });
        });

        describe(".ip_buf2str", function () {
            it(util.inspect(IP_BUF_1) + " -> " + IP_STR_1, function () {
                assert.equal(ipHelper.ip_buf2str(IP_BUF_1),
                             IP_STR_1
                );
            });
            it(util.inspect(IP_BUF_2) + " -> " + IP_STR_2, function () {
                assert.equal(ipHelper.ip_buf2str(IP_BUF_2, "ipv6").toLowerCase(),
                             IP_STR_2.toLowerCase()
                );
            });
        });

        describe("<private>ip2str", function () {
            var ipHelper = rewire("../lib/ip-helper.js");
            var ip2str = ipHelper.__get__("ip2str");
            var tests = [
                { ip: "127.0.0.1", expected: "127.0.0.1" },
                { ip: 0x01000000, expected: "1.0.0.0" },
                { ip: 0xffffffff, expected: "255.255.255.255" },
            ];
            tests.forEach(function (test) {
                it((typeof test.ip == "number" ? "0x" + test.ip.toString(16) : test.ip) + " -> " + test.expected, function () {
                    assert.equal(ip2str(test.ip), test.expected);
                });
            });
        });
    });
};

module.exports = testLibIpHelper
