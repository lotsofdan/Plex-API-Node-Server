var app = require('http').createServer()
  , io = require('socket.io').listen(app)
  , fs = require('fs')
  , request = require('request')
  , parseString = require('xml2js').parseString;
app.listen(3000);

console.log("server listening")

io.sockets.on('connection', function (socket) {
    socket.emit("connected", true)
    socket.on('login', function (data) {
        console.log("recieved login req")
        console.log(data.username + " connected and wants to login");
        var auth = "Basic " + new Buffer(data.username + ":" + data.password).toString("base64");
        var options = {
            uri: 'https://my.plexapp.com/users/sign_in.json',
            method: 'POST',
            headers: {
                'Authorization':auth,
                'X-Plex-Platform':'Android',
                'X-Plex-Platform-Version': '1',
                'X-Plex-Provides': "player",
                'X-Plex-Version':'any string',
                'X-Plex-Device':'DanTest',
                'X-Plex-Client-Identifier':122
            }
        };
        request(options, function (error, response, body) {
                socket.emit("logged_in", body)
                console.log(body)
        });
    });

    socket.on('servers', function (data) {
        console.log("server request for token" + data)
            var options = {
                uri: 'https://plex.tv/pms/servers.xml',
                method: 'GET',
                headers: {
                    'X-Plex-Token': data
                }
            };
        console.log(options)
        request(options, function (error, response, body) {
            parseString(body, function (err, result) {
                console.log("recieved, sending out")
                socket.emit("server_list", result)
                var addr_string = result.MediaContainer.Server[0].$.scheme + "://" + result.MediaContainer.Server[0].$.address + ":" + result.MediaContainer.Server[0].$.port
                options.uri = addr_string + "/library/sections"
                options.headers = {
                    'X-Plex-Token': result.MediaContainer.Server[0].$.accessToken,
                    'Accept': 'application/json'
                }
                request(options, function (error, response, body) {
                    socket.emit("server_categories", body)
                })

                options.uri = addr_string + "/library/onDeck"
                request(options, function (error, response, body) {
                    var obj = { server_string: addr_string, access_token: result.MediaContainer.Server[0].$.accessToken, content: body }
                    socket.emit("server_selected", obj)
                })

            });
        });
    })

    socket.on('change_server', function (data) {
        var addr_string = data.scheme + "://" + data.address + ":" + data.port
        console.log("server change request to " + data)
        var options = {
            uri: addr_string + "/library/sections",
            method: 'GET',
            headers: {
                'X-Plex-Token': data.access_token,
                'Accept': 'application/json'
            }
        };
        request(options, function (error, response, body) {
            socket.emit("server_categories", body)
        })

        options.uri = addr_string + "/library/onDeck"
        request(options, function (error, response, body) {
            var obj = {server_string: addr_string, access_token: data.access_token, content:body}
            socket.emit("server_selected", obj)
        })
    })
});