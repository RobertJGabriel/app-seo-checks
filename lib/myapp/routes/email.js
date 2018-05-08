var express = require('express');
var router = express.Router();
var nodemailer = require('nodemailer');


router.post('/', function (req, res) {


 const getInfo = async () => {

  let  email = req.query.email;
  var transporter = nodemailer.createTransport({
   service: 'gmail',
   auth: {
     user: 'gtirob@gmail.com',
     pass: 'gtibuddy123|'
   }
 });

 var mailOptions = {
   from: 'gtirob@gmail.com',
   to: email,
   subject: 'Sending Email using Node.js',
   text: 'That was easy!'
 };

 transporter.sendMail(mailOptions, function(error, info){
  console.log(error);
   if (error) {
    const message = {
     sent: false
    };
    res.send(message);
   } else {
    const message = {
     sent: true
    };
    res.send(message);
   }

 });






 };
 getInfo();



});


module.exports = router;
