import { Meteor } from 'meteor/meteor';
import mqtt from 'mqtt';
import modbus from 'h5.modbus';
import net from 'net';

let topicQuery;
let master;
Meteor.startup(() => {
    // code to run on server at startup
    Messages.remove({});
    var socket = new net.Socket();

    master = modbus.createMaster({
        transport: {
            type: 'ip',
            connection: {
                type: 'tcp',
                socket: socket,
                host: '10.210.10.63',
                port: 502,
                autoConnect: true,
                autoReconnect: true,
                minConnectTime: 2500,
                maxReconnectTime: 5000
            }
        },
        suppressTransactionErrors: false,
        retryOnException: true,
        maxConcurrentRequests: 1,
        defaultUnit: 3,
        defaultMaxRetries: 3,
        defaultTimeout: 100
    });

    master.once('connected', () => console.log("modbus connected"));
});

// data has to be published, autopublish is turned off!
// return only the last 10 messages to the client
Meteor.publish("mqttMessages", function () {
    return Messages.find({}, {sort: {ts: -1}, limit: 2});
});
Meteor.publish("mqttBatteryLogs", function () {
    return BatteryLogs.find({});
});
//Meteor.publish("controlstrategies", () => {return ControlStrategy.find({}) } );

// initialize the mqtt client from mqtt npm-package
//let mqtt = Meteor.npmRequire("mqtt");
var mqttClient = mqtt.connect(config);//mqtt://10.210.10.29:1883"
mqttClient
    .on("connect", function () {
        console.log("mqtt client connected");
    })
    .on("message", function (topic, message) {
        console.log(topic + ": " + message);
        // build the object to store
        let msg;
        if (topic === "si/sascha/battery") {
            msg = {
                message: extractBatteryJsonPayload(JSON.parse(message)),
                topic: topic,
                ts: new Date()
            };
            addMsgToCollection(msg);
        }
        if (topic.startsWith("em/")) {
            msg = {
                message: extractEMData(JSON.parse(message)),
                topic: topic,
                ts: new Date()
            };
            addMsgToCollection(msg);
        }
        if (topic === "batterylogs") {
            msg = {
                message: extractBatteryLogs(JSON.parse(message)),
                topic: topic,
                ts: new Date()
            };
            addBatteryLogsToCollection(msg);
        }
        // add the message to the collection (see below...)
        //addMsgToCollection(msg);
    });

// function is called when message is received (see above)
// to get access to Meteor resources from non-Meteor callbacks, this has to be bound in Meteor environment
var addMsgToCollection = Meteor.bindEnvironment(function (message) {
    Messages.insert(message);
});
var addBatteryLogsToCollection = Meteor.bindEnvironment(function (message) {
    BatteryLogs.insert(message);
});

// some methods called by the client
Meteor.methods({
    // start receiving messages with the set topic-query
    startClient: function () {
        console.log("startClient called");
        //mqttClient.subscribe(topicQuery);
    },
    // stop receiving messages
    stopClient: function () {
        console.log("stopClient called");
        mqttClient.unsubscribe(topicQuery);
    },
    // set a new topic query, unsubscribe from the old and subscribe to the new one
    setTopicQuery: function (newTopicQuery) {
        console.log("set new Topic: " + newTopicQuery);
        //mqttClient.unsubscribe(topicQuery).subscribe(newTopicQuery);
        mqttClient.subscribe(newTopicQuery);
        topicQuery = newTopicQuery;
    },
    // send the topic query to the caller
    getTopicQuery: function () {
        return topicQuery;
    },
    // publishes a message with a topic to the broker
    publishMessage: function (topic, message) {
        console.log("message to send: " + topic + ": " + message);
        mqttClient.publish(topic, message, function () {
            console.log("message sent: " + message);
        });
    },
    getConfigValues: function () {
        return config;
    },

    writeActivePower: function (text) {
        let b = new Buffer(4);
        b.writeInt32BE(parseInt(text), 0);
        let buf2 = new Buffer(b);
        master.writeMultipleRegisters(40149, buf2, {
            unit: 3,
            maxRetries: 3,
            timeout: 2000,
            interval: -1,
            onComplete: function (err, response) {
                if (err) {
                    console.err(err.message);
                    console.err('I make the error here!');
                } else {
                    console.log(response);
                    console.log(response.exceptionCode);
                }
            }
        });
    },
    activate: function () {
        console.log("802");
        let b = new Buffer(4);
        b.writeUInt32BE(802, 0);
        let activateVal = new Buffer(b);
        master.writeMultipleRegisters(40151, activateVal, {
            unit: 3,
            timeout: 6000,
            maxRetries: 3,
            interval: -1,
            onComplete: function (err, response) {
                if (err) {
                    console.err(err.message);
                } else {
                    console.log(response);
                    console.log(response.exceptionCode);
                }
            }
        });
    },
    deactivate: function () {
        console.log("803");
        let b = new Buffer(4);
        b.writeUInt32BE(803, 0);
        let buf2 = new Buffer(b);
        master.writeMultipleRegisters(40151, buf2, {
            unit: 3,
            timeout: 6000,
            maxRetries: 3,
            interval: -1,
            onComplete: function (err, response) {
                if (err) {
                    console.err(err.message);
                } else {
                    console.log(response);
                    console.log(response.exceptionCode);
                }
            }
        });
    },
    parseUpload(data) {
        //check( data, Array );
        for (let i = 0; i < data.length; i++) {
            let item = data[i];
            //let exists = ControlStrategy.findOne( { controlId: item.controlId } );
            ControlStrategy.insert(item);
            /*if ( !exists ) {
             ControlStrategy.insert( item );
             } else {
             console.warn( 'Rejected. This item already exists.' );
             }*/
        }
    },
    startStrategies: function () {
        console.log("start control strategy");
        /**
         *    1) retrieve residual and duration
         *    2) contruct buffer object
         *    3) write with modbus t=seconds long
         *    4) log the data via mqtt
         */
        /*ControlStrategy.find({}, {limit: 5}).forEach((d) => {
         //console.log(d.duration);
         mqttClient.publish('logs', JSON.stringify(d));
         });*/
        let soc;
        let jsondata = {};
        master.readHoldingRegisters(30845, 2, {
            unit: 3,
            maxRetries: 3,
            timeout: 6000,
            interval: 8000,
            onComplete: function (err, response) {
                if (err) {
                    console.error(err.message);
                }
                else {
                    soc = response.values.readUInt32BE(0);
                    console.log("SOC Value : " + soc);
                }
            }
        });

        let data = ControlStrategy.find({}, {limit: 5}).fetch();
        for (let i = 0; i < data.length; ++i) {
            let b = new Buffer(4);
            b.writeInt32BE((data[i].residual * 1000).toFixed(0), 0);
            let buf = new Buffer(b);
            console.log("Modbus Write: " + buf.readInt32BE(0));

            master.writeMultipleRegisters(40149, buf, {
                unit: 3,
                maxRetries: 3,
                timeout: 6000,
                interval: -1,
                onComplete: function(err, response) {
                    if (err) {
                        console.err(err.message);
                        console.err('I make the error here!');
                    }else {
                        jsondata.t          = data[i].t;
                        jsondata.charge     = data[i].charge;
                        jsondata.discharge  = data[i].discharge;
                        jsondata.soc_soll   = data[i].soc;
                        jsondata.soc_ist    = soc;
                        jsondata.residual   = data[i].residual;
                        mqttClient.publish("dynamicfeedinlogs", JSON.stringify(jsondata));

                        console.log(response);
                        console.log(response.exceptionCode);
                    }
                }
            });

            sleep2(data[i].duration*1000);
        }
    }
});

function extractBatteryLogs(jsondata) {
    return `soc_soll:${jsondata.soc_soll} soc_ist:${jsondata.soc_ist} p_soll:${jsondata.p_soll}
	p_soll_neu:${jsondata.p_soll_neu} modus:${jsondata.modus} algorun:{jsondata.algorun}`;
}

function extractEMData(jsondata) {
    return `pbezug:${jsondata.pbezug} peinspeisung:${jsondata.peinspeisung} u1:${jsondata.u1} u2:${jsondata.u2} u3:${jsondata.u3} emid:${jsondata.emid}`;
}


function extractBatteryJsonPayload(jsondata) {
    return `c_cha:${jsondata.c_cha} c_dis:${jsondata.c_dis} e_cons:${jsondata.e_cons}
	 e_consday:${jsondata.e_consday} e_fiday:${jsondata.e_fiday} e_cntrgridref:${jsondata.e_cntrgridref} \n
	 e_cntrgridfi:${jsondata.e_cntrgridfi} e_cntrgen:${jsondata.e_cntrgen} e_scincr:${jsondata.e_scincr} \n
	 e_scincrday:${jsondata.e_scincrday} e_consint:${jsondata.e_consint} e_abs:${jsondata.e_abs} \n
	 e_rel:${jsondata.e_rel} p_ac:${jsondata.p_ac} u_ac1:${jsondata.u_ac1} u_ac2:${jsondata.u_ac2} \n
	 u_ac3:${jsondata.u_ac3} f_grid:${jsondata.f_grid} q_reactive:${jsondata.q_reactive} \n
	 st_om:${jsondata.st_om} i_dc:${jsondata.i_dc} soc:${jsondata.soc} soh:${jsondata.soh} \n
	 t_bat:${jsondata.t_bat} u_dc:${jsondata.u_dc} u_dcchaset:${jsondata.u_dcchaset}
	 n_cycles:${jsondata.n_cycles} soc_maint:${jsondata.soc_maint} p_load:${jsondata.p_load} \n
	 p_gridref:${jsondata.p_gridref} p_gridfi:${jsondata.p_gridfi} p_pv:${jsondata.p_pv} p_sc:${jsondata.p_sc}
	 p_scincr:${jsondata.p_scincr} p_extout:${jsondata.p_extout} q_ext:${jsondata.q_ext} f_ext:${jsondata.f_ext} \n
	 u_acext1:${jsondata.u_acext1} u_acext2:${jsondata.u_acext2} u_acext3:${jsondata.u_acext3}
	 i_acext1:${jsondata.i_acext1} i_acext2:${jsondata.i_acext2} i_acext3:${jsondata.i_acext3} \n
	 i_acgrid1:${jsondata.i_acgrid1} i_acgrid2:${jsondata.i_acgrid2} i_acgrid3:${jsondata.i_acgrid3}
	 p_pvout:${jsondata.p_pvout} i_acexttotal:${jsondata.i_acexttotal} deltasoc_:${jsondata.deltasoc_} \n
	 r_chadis:${jsondata.r_chadis} t_rmgful:${jsondata.t_rmgful} t_rmgequ:${jsondata.t_rmgequ}
	 t_rmgapt:${jsondata.t_rmgapt} e_pvtotal:${jsondata.e_pvtotal} n_equ:${jsondata.n_equ}
	 n_ful:${jsondata.n_ful} deltasoc_disful:${jsondata.deltasoc_disful} deltasoc_disequ:${jsondata.deltasoc_disequ}`;
}

// delete every 120 seconds old data (messages) from the collection/mongodb
Meteor.setInterval(function () {
    Messages.remove({});
}, 2 * 60 * 1000);

function sleep(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}

function sleep2(milliseconds) {
    var start = new Date().getTime();
    for (var i = 0; i < 1e10; i++) {
        if ((new Date().getTime() - start) > milliseconds) {
            break;
        }
    }
}

setTimeout(() => {
    console.log("802");
    let b = new Buffer(4);
    b.writeUInt32BE(802, 0);
    let activateVal = new Buffer(b);
    master.writeMultipleRegisters(40151, activateVal, {
        unit: 3,
        timeout: 6000,
        maxRetries: 3,
        interval: 3600000,
        onComplete: function (err, response) {
            if (err) {
                console.err(err.message);
                console.log("automatic activation failed");
            } else {
                console.log(response);
                console.log("automatic activation");
                console.log(response.exceptionCode);
            }
        }
    });
}, 3600000);
