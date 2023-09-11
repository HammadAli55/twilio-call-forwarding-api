require('dotenv').config();
const express = require('express');
const http = require('http');
const twilio = require('twilio');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);

// Replace these values with your Twilio Account SID and Auth Token
const TwilioAccountSID = process.env.TWILIO_ACCOUNT_SID;
const TwilioAuthToken = process.env.TWILIO_AUTH_TOKEN;

// Replace these numbers with your main IVR number and the number to forward to
const MAIN_IVR_NUMBER = '+17043135714';
const FORWARD_TO_NUMBER = '+923365500513';

// MongoDB connection URL and options
const mongoURL = process.env.MONGODB_URL; // Replace with your MongoDB connection URL
const MONGODB_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
};

mongoose.connect(mongoURL, MONGODB_OPTIONS);

// Define a schema for call logs
const CallLogSchema = new mongoose.Schema({
  caller: String,
  callStatus: String,
  userPressed: String,
  timestamp: { type: Date, default: Date.now },
});

const CallLog = mongoose.model('CallLog', CallLogSchema);

// Create a Twilio client
const client = new twilio(TwilioAccountSID, TwilioAuthToken);

app.use(express.urlencoded({ extended: true }));

// Handle incoming calls
app.post('/voice', async (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();

  const userPressed = req.body.Digits;
  const caller = req.body.From;

  if (userPressed === '1') {
    // Forward the call to another phone number
    twiml.dial(FORWARD_TO_NUMBER);
  } else if (userPressed === '2') {
    // Allow the caller to leave a voicemail
    twiml.say('Please leave a voicemail after the tone.');
    twiml.record({
      action: '/voicemail',
      maxLength: 60, // Maximum voicemail length in seconds
      playBeep: true,
    });
  } else {
    // Invalid input, redirect to the main IVR menu
    twiml.redirect('/ivr-menu');
  }

  // Log the call in the database
  await CallLog.create({
    caller,
    callStatus: 'Received',
    userPressed,
  });

  res.type('text/xml');
  res.send(twiml.toString());
});

// Handle voicemail recording
app.post('/voicemail', async (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();

  twiml.say('Thank you for leaving a voicemail. Goodbye.');

  // Log the voicemail in the database
  await CallLog.create({
    caller: req.body.From,
    callStatus: 'Voicemail',
  });

  res.type('text/xml');
  res.send(twiml.toString());
});

// Main IVR menu
app.post('/ivr-menu', (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();

  twiml.gather({
    numDigits: 1,
    action: '/voice',
  }, (gatherNode) => {
    gatherNode.say('Welcome to our IVR system. Press 1 to forward your call, or press 2 to leave a voicemail.');
  });

  res.type('text/xml');
  res.send(twiml.toString());
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
