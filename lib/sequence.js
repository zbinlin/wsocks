"use strict";

module.exports = function sequence(arr, initValue, done) {
    if (!Array.isArray(arr)) {
        throw new TypeError("传入的第一个参数必须是一个数组");
    }
    if (typeof initValue === "function" && done === undefined) {
        done = initValue;
        initValue = undefined;
    }
    var narr = arr.slice();
    if (typeof done !== "function") {
        done = function () {};
    }
    var index = -1, levels = [];
    function next(err, value, idx) {
        if (err) {
            done(err);
            return;
        }
        if (++index >= narr.length || idx < 0) {
            var tmpEl = null;
            if (idx < 0) {
                idx = levels.length + idx;
                tmpEl = levels[idx];
                levels.splice(idx);
            } else {
                tmpEl = levels.pop();
            }
            if (tmpEl) {
                narr = tmpEl.elems;
                index = tmpEl.index;
                next(null, value);
                return;
            } else {
                done(null, value);
                return;
            }
        }

        var nextEl = narr[index];
        var elType = ({}).toString.call(nextEl).slice(8, -1).toLowerCase();

        if (elType === "function" && !/^function\s*\*/.test(nextEl.toString())) {
            try {
                nextEl(value, next);
            } catch (ex) {
                done(ex);
            }
        } else if (elType === "array") {
            levels.push({
                elems: narr,
                index: index
            });
            narr = nextEl;
            index = -1;
            next(null, value);
        } else if (nextEl && typeof nextEl === "object" && (typeof idx === "string" || typeof idx === "symbol")) {
            nextEl = nextEl[idx];
            narr.splice(index + 1, 0, nextEl);
            next(null, value);
        } else {
            next(null, nextEl);
        }
    }
    next(null, initValue);
};
