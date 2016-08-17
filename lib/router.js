Router.configure({
  //loadingTemplate: 'loading',
  waitOn: function() { return Meteor.subscribe("mqttMessages"); }
});

Router.route('/', function () {
  this.layout('ApplicationLayout', {
    //this.render('Home');
  });
  this.render('Home');
});

Router.route('/plots', function () {
  this.layout('ApplicationLayout', {
    data: function() { return Messages.find(); }
  });
  this.render('Plot');
});

Router.route('/sicontrol', function () {
  this.layout('ApplicationLayout', {
  });
  this.render('SIControl');
});

Router.route('/nodered', function () {
  this.layout('ApplicationLayout', {
  });
  this.render('NodeRed');
});

Router.route('/batterylogs', function () {
  this.layout('ApplicationLayout', {
  });
  this.render('Batterylogs');
});
