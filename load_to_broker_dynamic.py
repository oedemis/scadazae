import csv
import datetime
from datetime import  datetime, tzinfo, timedelta
from dateutil import parser
import paho.mqtt.publish as publish
import sys
from time import sleep
import pymongo

publish.single("activatemodbus", "", hostname='192.168.0.50', port=1883);
client = pymongo.MongoClient("mongodb://127.0.0.1", 3001)
print client.database_names()
db = client.meteor
cursor = db.controlstrategies.find()
for document in cursor:
    res = int(round(float(document['residual']) * 1000))
    dt = datetime.strptime(document["t"], "%d.%m.%Y %H:%M")            # str to datetime object
    dtIsoStr = dt.strftime('%Y-%m-%d %H:%M')                    # datetime obj to str
    data = dtIsoStr + ' ' + document['charge'] + ' ' + document['discharge'] + ' ' + document['soc'] + ' ' + document['duration'] + ' ' + str(res)
    #print(document)
    #print(data)
    publish.single("dynamic", data, hostname='192.168.0.50', port=1883);
    sleep(int(document['duration']));

#len(row)-1
#publish.single("activatemodbus", "", hostname="192.168.0.50")
#f = open("Test_dynamic_limit.csv")
#f = open("Test_dynamic_limit_kurz.csv")
#reader = csv.reader(f, delimiter=';', quotechar='"')
#next(reader)
#i = 0;
#for row in reader:
#    res = int(round(float(row[5]) * 1000))
#    dt = datetime.strptime(row[0], "%d.%m.%Y %H:%M")            # str to datetime object
#    dtIsoStr = dt.strftime('%Y-%m-%d %H:%M')                    # datetime obj to str
#    data = dtIsoStr + ' ' + row[1] + ' ' + row[2] + ' ' + row[3] + ' ' + row[4] + ' ' + str( res )
    #print  data
    #publish.single("dynamic", data, hostname='192.168.0.50', port=1883);
    #print sum(1 for row in reader)
    #sleep(int(row[4]));
    #if i == sum(1 for row in reader):
    #    sys.exit()
