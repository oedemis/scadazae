import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import {UploadFS} from 'meteor/jalik:ufs';

import '/imports/stores/files.js';

import './main.html';

// subscribe to the published collection
Meteor.subscribe("mqttMessages");
Meteor.subscribe("mqttBatteryLogs");
Meteor.subscribe('files');
//Meteor.subscribe("controlstrategies");


// we need a dependency later on to refresh the topic query
var topicDep = new Deps.Dependency;


// this is the dependend function to retrieve and set the topic query
Deps.autorun(function () {
    topicDep.depend();
    Meteor.call("getTopicQuery", function (err, obj) {
        Session.set("topicQuery", obj);
    });
});

Meteor.startup(function () {
    Meteor.call("getConfigValues", function (err, values) {
        Session.set("configValues", values);
    });
});

Template.config.host = function () {
    return Session.get("configValues")["host"];
};

Template.config.port = function () {
    return Session.get("configValues")["port"];
};

Template.messages.topicQuery = function () {
    return Session.get("topicQuery");
};

Template.messages.lastMessages = function () {
    return Messages.find({}, {sort: {ts: -1}});
};

// just for a better readability in the UI
Template.msg.tsString = function () {
    return this.ts.toLocaleString();
};

// the start/stop button events, call the server-side methods
Template.admin.events({
    'click #startClient': function () {
        Meteor.call("startClient");
    },
    'click #stopClient': function () {
        Meteor.call("stopClient");
    }
});

// the events for changing the topic query (for button click and pressing enter)
Template.topic.events({
    'click #sendTopicQuery': function () {
        _sendTopic();
    },
    'keyup #topicQuery': function (e) {
        if (e.type == "keyup" && e.which == 13) {
            _sendTopic();
        }
    }
});


// the click-event for publishing a message
Template.publish.events({
    'click #publishMessage': function () {
        var elTopic = document.getElementById("topic");
        var elMessage = document.getElementById("message");
        Meteor.call("publishMessage", elTopic.value, elMessage.value, function () {
            elTopic.value = "";
            elMessage.value = "";
            elTopic.focus();
        });
    }
});

Template.SIControl.events({
    'click .deactivate'() {
        Meteor.call('deactivate');
    },
    'click .activate'() {
        Meteor.call('activate');
    },
    'submit .setActivePower'(event) {
        event.preventDefault();
        const target = event.target;
        const text = target.text.value;
        Meteor.call('writeActivePower', text);
    },
    'change [name="uploadCSV"]' (event, template) {
        event.preventDefault();
        template.uploading.set( true );
        Papa.parse(event.target.files[0], {
            header: true,
            complete(results, file) {
                Meteor.call( 'parseUpload', results.data, ( error, response ) => {
                    if ( error ) {
                        Bert.alert( error.reason, 'warning' );
                    } else {
                        template.uploading.set( false );
                        Bert.alert( 'Upload complete!', 'success', 'growl-top-right' );
                    }
                });
            }
        });
    },
    'click .cancelIteration'() {
        console.log("cancel!");
        Meteor.call('cancelStrategy');
    },
    /*'submit .startIteration'(event) {
        event.preventDefault();
        const target = event.target;
        const text = target.text.value;
        Meteor.call('startStrategies', text);

        // Clear form
        target.text.value = '';
    },*/
    'click .startIteration'() {
        Meteor.call('startStrategies');
    },
    'click .deleteDB'() {
        Meteor.call('deleteDB');
    }
});

Template.upload2.events({
    'click button[name=upload]': function (ev) {
        //var self = this;  
        ev.preventDefault();
        UploadFS.selectFiles(function (file) {
            // Prepare the file to insert in database, note that we don't provide an URL,
            // it will be set automatically by the uploader when file transfer is complete.
            let strategy = {
                name: file.name,
                size: file.size,
                type: file.type
            };

            // Create a new Uploader for this file
            let uploader = new UploadFS.Uploader({
                // This is where the uploader will save the file
                store: FileStore,
                // Optimize speed transfer by increasing/decreasing chunk size automatically
                //adaptive: true,
                // Define the upload capacity (if upload speed is 1MB/s, then it will try to maintain upload at 80%, so 800KB/s)
                // (used only if adaptive = true)
                //capacity: 0.8, // 80%
                // The size of each chunk sent to the server
                //chunkSize: 8 * 1024, // 8k
                // The max chunk size (used only if adaptive = true)
                //maxChunkSize: 128 * 1024, // 128k
                // This tells how many tries to do if an error occurs during upload
                //maxTries: 5,
                // The File/Blob object containing the data
                data: file,
                // The document to save in the collection  strategy
                file: file
            });

            uploader.onAbort = function (file) {
                console.log(file.name + ' upload aborted');
            };
            uploader.onComplete = function (file) {
                console.log(file.name + ' upload completed');
            };
            uploader.onCreate = function (file) {
                console.log(file.name + ' created');
                uploader[file._id] = this;
            };
            uploader.onError = function (err, file) {
                console.error(file.name + ' could not be uploaded', err);
            };
            uploader.onProgress = function (file, progress) {
                console.log(file.name + ' :'
                    + "\n" + (progress * 100).toFixed(2) + '%'
                    + "\n" + (this.getSpeed() / 1024).toFixed(2) + 'KB/s'
                    + "\n" + 'elapsed: ' + (this.getElapsedTime() / 1000).toFixed(2) + 's'
                    + "\n" + 'remaining: ' + (this.getRemainingTime() / 1000).toFixed(2) + 's'
                );
            };
            uploader.start();
        });
    }
});


// get the new query from the input field and send it to the server, reset field
// tell the dependency, that it has changed and has to be run again
var _sendTopic = function () {
    var el = document.getElementById("topicQuery");
    var topicQuery = el.value;
    Meteor.call("setTopicQuery", topicQuery, function () {
        topicDep.changed();
        el.value = "";
        el.focus();
    });
};

Template.SIControl.onCreated(() => {
    Template.instance().uploading = new ReactiveVar(false);
});

Template.SIControl.helpers({
    uploading() {
        return Template.instance().uploading.get();
    }
});


Template.fileTable.helpers({
    files: function () {
        return Files.find({}, {
            sort: {createdAt: 1, name: 1}
        });
    }
});

Template.fileTableRow.events({
    'click [name=delete]': function (ev) {
        ev.preventDefault();
        Files.remove(this._id);
    },
    'click [name=start]' (ev) {
        ev.preventDefault();
        Meteor.call('start', this);
    }
});

Template.fileTableRow.helpers({
    canAbort: function () {
        return workers.hasOwnProperty(this._id);
    },
    canDelete: function () {
        let userId = Meteor.userId();
        return userId === this.userId || !this.userId;
    },
    formatSize: function (bytes) {
        if (bytes >= 1000000000) {
            return (bytes / 1000000000).toFixed(2) + ' GB';
        }
        if (bytes >= 1000000) {
            return (bytes / 1000000).toFixed(2) + ' MB';
        }
        if (bytes >= 1000) {
            return (bytes / 1000).toFixed(2) + ' KB';
        }
        return bytes + ' B';
    },
    progress: function () {
        return Math.round(this.progress * 10000) / 100;
    }
});