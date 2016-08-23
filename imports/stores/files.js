import '/lib/collections/mqttmessages.js';
import {UploadFS} from 'meteor/jalik:ufs';

/**
 * File store using local file system
 * @type {UploadFS.store.Local}
 */
FileStore = new UploadFS.store.Local({
    collection: Files,
    name: 'files',
    path: '/uploads/files',
    //mode: '0744', // directory permissions
    //writeMode: '0744' // file permissions
    // permissions: defaultPermissions,
});