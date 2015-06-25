
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


/etc/wsocks/keys/{证书}
/etc/wsocks/config.json
~/.wsocks/keys/{证书}
~/.wsocks/config.json
