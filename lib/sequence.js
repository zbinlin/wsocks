"use strict";

module.exports = function sequence(arr, done) {
    if (!Array.isArray(arr)) {
        throw new TypeError("传入的第一个参数必须是一个数组");
    }
    if (typeof done !== "function") {
        done = function () {};
    }
    var index = -1, levels = [];
    function next(err, idx) {
        if (err) {
            done(err);
            return;
        }
        var tmpEl = null;
        if (typeof idx === "string") {
            tmpEl = arr[++index];
            tmpEl = tmpEl[idx];
            if (!tmpEl && !Array.isArray(tmpEl) && typeof tmpEl !== "function") {
                done(new Error("无法跳转到指定的分支：" + idx));
                return;
            } else if (typeof tmpEl === "function") {
                tmpEl = [tmpEl];
            }
            levels.push({
                value: arr,
                index: index
            });
            arr = tmpEl;
            index = -1;
            tmpEl = null;
        } else if (idx < 0) {
            idx = levels.length + idx;
            tmpEl = levels[idx];
            levels.splice(idx);
            if (tmpEl) {
                arr = tmpEl.value;
                index = tmpEl.index;
            } else {
                done();
                return;
            }
            tmpEl = null;
        }
        ++index;
        if (index >= arr.length) {
            tmpEl = null;
            while (tmpEl = levels.pop()) {
                arr = tmpEl.value;
                index = tmpEl.index + 1;
                if (index < arr.length) {
                    break;
                }
            }
            if (!tmpEl) {
                done();
                return;
            }
            tmpEl = null;
        }
        var fn = arr[index];
        if (typeof fn === "function") {
            fn(next);
        } else {
            done(new TypeError("序列项：[" + arr + "][" + (index - 1) + "] 不是一个函数"));
        }
    }
    next(null);
};
