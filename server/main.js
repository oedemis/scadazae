import { Meteor } from 'meteor/meteor';
import mqtt from 'mqtt';

var topicQuery = "#";

Meteor.startup(() => {
  // code to run on server at startup
   Messages.remove({});
});

// data has to be published, autopublish is turned off!
// return only the last 10 messages to the client
Meteor.publish("mqttMessages", function() {
    return Messages.find({}, {sort: {ts: -1}, limit: 10});
});

// initialize the mqtt client from mqtt npm-package
//let mqtt = Meteor.npmRequire("mqtt");
let mqttClient = mqtt.connect(config);//mqtt://10.210.10.29:1883"
mqttClient
    .on("connect", function() {
        console.log("client connected");
    })
    .on("message", function(topic, message) {
        console.log(topic + ": " + message);
        // build the object to store
        var msg = {
            message: message,
            topic: topic,
            ts: new Date()
        };
        // add the message to the collection (see below...)
        addMsgToCollection(msg);
    });

// function is called when message is received (see above)
// to get access to Meteor resources from non-Meteor callbacks, this has to be bound in Meteor environment
var addMsgToCollection = Meteor.bindEnvironment(function(message) {
    Messages.insert(message);
});

// some methods called by the client
Meteor.methods({
    // start receiving messages with the set topic-query
    startClient: function() {
        console.log("startClient called");
        mqttClient.subscribe(topicQuery);
    },
    // stop receiving messages
    stopClient: function() {
        console.log("stopClient called");
        mqttClient.unsubscribe(topicQuery);
    },
    // set a new topic query, unsubscribe from the old and subscribe to the new one
    setTopicQuery: function(newTopicQuery) {
        console.log("set new Topic: " + newTopicQuery);
        mqttClient.unsubscribe(topicQuery).subscribe(newTopicQuery);
        topicQuery = newTopicQuery;
    },
    // send the topic query to the caller
    getTopicQuery: function() {
        return topicQuery;
    },
    // publishes a message with a topic to the broker
    publishMessage: function(topic, message) {
        console.log("message to send: " + topic + ": " + message);
        mqttClient.publish(topic, message, function() {
            console.log("message sent: " + message);
        });
    },
    getConfigValues: function() {
        return config;
    }
});

// delete every 120 seconds old data (messages) from the collection/mongodb
Meteor.setInterval(function() {
    Messages.remove({});
}, 2*60*1000);