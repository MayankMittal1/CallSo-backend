const express = require("express");
const app = express();
var http = require("http").Server(app);
var io = require("socket.io")(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(express.static("public"));
//all connected to the server users
var users = {};

//when a user connects to our sever
io.on("connection", function (connection) {
  connection.on("login", (data) => {
    data = JSON.parse(data);
    console.log("User logged", data.address);
    connection.join(data.address);
  });

  connection.on("offer", (data) => {
    data = JSON.parse(data);
    console.log("offering to", data.to);
    connection.to(data.to).emit("offer", data);
  });

  connection.on("accept", (data) => {
    data = JSON.parse(data);
    console.log("accepting to", data.to);
    connection.to(data.to).emit("accept", data);
  });

  //when server gets a message from a connected user

  connection.on("message", function (message) {
    var data;

    //accepting only JSON messages
    try {
      data = JSON.parse(message);
    } catch (e) {
      console.log("Invalid JSON");
      data = {};
    }

    //switching type of the user message
    switch (data.type) {
      //when a user tries to login
      case "login":
        console.log("User logged", data.address);

        connection.join(data.address);

        break;

      case "offer":
        //for ex. UserA wants to call UserB
        console.log("Sending offer to: ", data.to);

        //if UserB exists then send him offer details
        var conn = users[data.to];

        if (conn != null) {
          //setting that UserA connected with UserB
          connection.otherName = data.to;
          conn.send(
            "offer",
            JSON.stringify({ offer: data.offer, name: connection.name })
          );
        }

        break;

      case "answer":
        console.log("Sending answer to: ", data.address);
        //for ex. UserB answers UserA
        var conn = users[data.address];

        if (conn != null) {
          connection.otherName = data.address;
          sendTo(conn, {
            type: "answer",
            answer: data.answer,
          });
        }

        break;

      case "candidate":
        console.log("Sending candidate to:", data.address);
        var conn = users[data.address];

        if (conn != null) {
          sendTo(conn, {
            type: "candidate",
            candidate: data.candidate,
          });
        }

        break;

      case "leave":
        console.log("Disconnecting from", data.address);
        var conn = users[data.address];
        conn.otherName = null;

        //notify the other user so he can disconnect his peer connection
        if (conn != null) {
          sendTo(conn, {
            type: "leave",
          });
        }

        break;

      default:
        sendTo(connection, {
          type: "error",
          message: "Command not found: " + data.type,
        });

        break;
    }
  });

  //when user exits, for example closes a browser window
  //this may help if we are still in "offer","answer" or "candidate" state
  connection.on("close", function () {
    if (connection.name) {
      delete users[connection.name];

      if (connection.otherName) {
        console.log("Disconnecting from ", connection.otherName);
        var conn = users[connection.otherName];
        conn.otherName = null;

        if (conn != null) {
          sendTo(conn, {
            type: "leave",
          });
        }
      }
    }
  });

  connection.send("Hello world");
});

function sendTo(connection, message) {
  connection.send(JSON.stringify(message));
}

http.listen(3000, function () {
  console.log("listening on *:3000");
});
