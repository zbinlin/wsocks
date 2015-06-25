"use strict";

function version() {
    console.log("\nv" + require("../package").version + "\n");
};

function multiline(fn) {
    return fn.toString().replace(/^.+\/\*([\s\S]*)(?=\*\/).+$/g, "$1");
}
function tpl(str) {
    return function (hash) {
        return str.replace(/\$\{([^}]+)\}/g, function ($0, $1) {
            return hash[$1] || "";
        });
    }
}
function help(agent, atom) {
    var hash = {
        agent: agent,
        atom: atom
    };
    var helpText = {
        "default": multiline(function () {/*
Usage: wsocks [ -h | --help ]
       wsocks { -v | --version }
       wsocks OBJECT COMMAND [-h | --help]

where OBJECT := { client | server }
     COMMAND := { start [ -b | --background ] [ CONFIG ] |
                   stop |
                   init |
                   list |
                   get [ KEY ] |
                   set [ KEY=VALUE ]
                 }
      CONFIG := { KEY{ = | SPACE }VALUE] }
         KEY := { host | port | password }
       SPACE := { \32 }
       VALUE := { string }
*/      }),
        "start": tpl(multiline(function () {/*
Usage: wsocks ${agent} ${atom} [ -b | --background ] [ CONFIG ]

where CONFIG := { KEY{ = | SPACE }VALUE }
         KEY := { host | port | password }
       SPACE := { \32 } # 空格
       VALUE := { string }

启动 ${agent} 端

选项：
 -b, --background 在后台运行
*/      }))(hash),
        "stop": tpl(multiline(function () {/*
Usage: wsocks ${agent} ${atom}

停止 ${agent} 端
*/      }))(hash),
        "init": tpl(multiline(function () {/*
Usage: wsocks ${agent} ${atom}

初始化 ${agent} 端的配置文件
*/      }))(hash),
        "list": tpl(multiline(function () {/*
Usage: wsocks ${agent} ${atom}

列出 ${agent} 端的配置选项
*/      }))(hash),
        "get": tpl(multiline(function () {/*
Usage: wsocks ${agent} ${atom} [KEY]

列出 ${agent} 端指定配置项的值
*/      }))(hash),
        "set": tpl(multiline(function () {/*
Usage: wsocks ${agent} ${atom} KEY{ = | SPACE }VALUE

设置 ${agent} 端指定配置项
*/      }))(hash)
    };
    console.log(helpText[atom] || helpText["default"]);
}

exports.version = version;
exports.help = help;
