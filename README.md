
**仅测试，现不可用**

```
Usage: wsocks [ -h | --help ]
       wsocks { -v | --version }
       wsocks OBJECT COMMAND [-h | --help]

where OBJECT := { client | server }

     COMMAND := { start [ -b | --background ] [ CONFIG ] |
                   stop |
                   init |
                   list |
                   get [ KEY ] |
                   set [ KEY{ = | SPACE }VALUE ]
                 }
      CONFIG := { KEY{ = | SPACE }VALUE }
         KEY := { host | port | password }
       SPACE := { \32 }
       VALUE := { string }
```

    wsocks { -v | --version }
    wsocks { client | server } [-h | --help]
    wsocks { client | server } start [ -b | --background] [ CONFIG ]
    wsocks { client | server } stop
    wsocks { client | server } init
    wsocks { client | server } list
    wsocks { client | server } get [ KEY ]
    wsocks { client | server } set { KEY=VALUE }

    wsocks client list # list client configure
    wsocks client init # initial client configure
    wsocks client set password=password # set client configure item
    wsocks server get password # get client configure item

    wsocks client start # start client
    wsocks server start # start server
    wsocks server stop # stop server
    wsocks server start -b --background # start server with background


```
client: host port server-host server-port cipher password ca-cert-file client-key-file client-cert-file
server: socks-host socks-port within-socks host port cipher password ca-cert-file server-key-file server-cert-file
```


## Support Ciphers

```
node -e 'console.log(require("crypto").getCiphers().filter(x => /-cfb[18]?$|-ofb$|-ctr|rc4/i.test(x)))';
```

* aes-128-cfb
* aes-128-cfb1
* aes-128-cfb8
* aes-128-ctr
* aes-128-ofb
* aes-192-cfb
* aes-192-cfb1
* aes-192-cfb8
* aes-192-ctr
* aes-192-ofb
* aes-256-cfb
* aes-256-cfb1
* aes-256-cfb8
* aes-256-ctr
* aes-256-ofb
* bf-cfb
* bf-ofb
* camellia-128-cfb
* camellia-128-cfb1
* camellia-128-cfb8
* camellia-128-ofb
* camellia-192-cfb
* camellia-192-cfb1
* camellia-192-cfb8
* camellia-192-ofb
* camellia-256-cfb
* camellia-256-cfb1
* camellia-256-cfb8
* camellia-256-ofb
* cast5-cfb
* cast5-ofb
* des-cfb
* des-cfb1
* des-cfb8
* des-ede-cfb
* des-ede-ofb
* des-ede3-cfb
* des-ede3-cfb1
* des-ede3-cfb8
* des-ede3-ofb
* des-ofb
* idea-cfb
* idea-ofb
* rc2-cfb
* rc2-ofb
* rc4
* rc4-40
* rc4-hmac-md5
* seed-cfb
* seed-ofb


<del>`/etc/wsocks/keys/{证书}`</del>

<del>`/etc/wsocks/config.json`</del>

`~/.wsocks/keys/{证书}`

`~/.wsocks/config.json`
