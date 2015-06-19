"use strict";

var assert = require("assert");
var util = require("util");

var sequence = require("../lib/sequence");

module.exports = function testLibSequence() {
    describe("test lib/sequence.js", function () {
        it("一般的序列", function (done) {
            var arr = [
                function (value, next) {
                    next();
                },
                function (value, next) {
                    next();
                }
            ];

            sequence(arr, done);
        });

        it("出现异常提前结束序列", function (done) {
            var err = new Error;
            var arr = [
                function (value, next) {
                    next(err);
                },
                function (value, next) {
                    next();
                }
            ];

            sequence(arr, function (err) {
                if (err instanceof Error) {
                    done();
                } else {
                    done(new Error("出现异常无法提前结束"));
                }
            });
        });

        it("有分支的序列", function (done) {
            var expected = [1, 2, "b", 4];
            var rst = [];
            var arr = [
                function (value, next) {
                    rst.push(1);
                    next();
                },
                function (value, next) {
                    rst.push(2);
                    next(null, undefined, "b");
                },
                {
                    a: function (value, next) {
                        rst.push("a");
                        next();
                    },
                    b: function (value, next) {
                        rst.push("b");
                        next();
                    }
                },
                function (value, next) {
                    rst.push(4);
                    next();
                }
            ];
            sequence(arr, function () {
                try {
                    assert.equal(rst.toString(), expected.toString());
                    done();
                } catch (ex) {
                    done(ex);
                }
            });
        });

        it("提前结束的序列", function (done) {
            var expected = [1, 2, "a"];
            var rst = [];
            var arr = [
                function (value, next) {
                    rst.push(1);
                    next();
                },
                function (value, next) {
                    rst.push(2);
                    next(null, undefined, "a");
                },
                {
                    a: function (value, next) {
                        rst.push("a");
                        next(null, undefined, -9999); /* !hack, 跳到上 9999 层，因为这里没有 9999 层，因此会直接跳到结束 */
                    },
                    b: function (value, next) {
                        rst.push("b");
                        next();
                    }
                },
                function (value, next) {
                    rst.push(4);
                    next();
                }
            ];
            sequence(arr, function () {
                try {
                    assert.equal(rst.toString(), expected.toString());
                    done();
                } catch (ex) {
                    done(ex);
                }
            });
        });

        it("多重分支的序列", function (done) {
            var expected = [1, 2, "a1", "a2", "m1", 4];
            var rst = [];
            var arr = [
                function (value, next) {
                    rst.push(1);
                    next();
                },
                function (value, next) {
                    rst.push(2);
                    next(null, undefined, "a");
                },
                {
                    a: [
                        function (value, next) {
                            rst.push("a1");
                            next();
                        },
                        function (value, next) {
                            rst.push("a2");
                            next(null, undefined, "m");
                        },
                        {
                            m: [
                                function (value, next) {
                                    rst.push("m1");
                                    next(null, undefined, -2); /* 跳到上二层 */
                                },
                                function (value, next) {
                                    rst.push("m2");
                                    next();
                                }
                            ],
                            n: [
                                function (value, next) {
                                    rst.push("n");
                                    next();
                                }
                            ]
                        },
                        function (value, next) {
                            rst.push("a4");
                            next();
                        },
                    ],
                    b: [
                        function (value, next) {
                            rst.push("b");
                            next();
                        }
                    ]
                },
                function (value, next) {
                    rst.push(4);
                    next();
                }
            ];
            sequence(arr, function () {
                try {
                    assert.equal(rst.toString(), expected.toString());
                    done();
                } catch (ex) {
                    done(ex);
                }
            });
        });

        it("可以传值的序列", function (done) {
            var arr = [
                function (value, next) {
                    next(value);
                },
                function (value, next) {
                    next(value);
                }
            ];

            sequence(arr, 1, function (val) {
                try {
                    assert.equal(val, 1);
                    done();
                } catch (ex) {
                    done(ex);
                }
            });
        });

        it("如果数组里包含非函数及对象时，该元素会作为值传递到下一个函数里", function (done) {
            var arr = [
                function (value, next) {
                    next(null, value);
                },
                100,
                function (value, next) {
                    next(null, value);
                },
                123
            ];

            sequence(arr, function (err, val) {
                try {
                    assert.equal(val, 123);
                    done();
                } catch (ex) {
                    done(ex);
                }
            });
        });

    });
};
