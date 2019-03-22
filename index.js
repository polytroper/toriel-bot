var Botkit = require('botkit')
var Airtable = require('airtable')
var _ = require('lodash')

var base = new Airtable({apiKey: process.env.AIRTABLE_KEY}).base(process.env.AIRTABLE_BASE);

// Bank user ids by team_id
var bankUsers = {
  T0266FRGM: 'UH50T81A6',
  TH438LCR3: 'UH2HS2SBS',
}

var redisConfig = {
  url: process.env.REDISCLOUD_URL
}
var redisStorage = require('botkit-storage-redis')(redisConfig)

console.log("Booting Toriel bot")

var startState = 'Cat Requested'

function createCatQuestState(user, cb = () => {}) {
  console.log(`Creating balance for User ${user}`)
  
  base('States').create({
    "User": user,
    "CatQuest": startState
  }, function(err, record) {
      if (err) { console.error(err); return; }
      console.log(`New record created for User ${user}`)
      // console.log(record)
      cb(startState, record)
  });
}

function setCatQuestState(id, state, cb = () => {}) {
  console.log(`Setting CatQuest for Record ${id} to ${state}`)

  base('States').update(id, {
    "CatQuest": state
  }, function(err, record) {
    if (err) { console.error(err); return; }
    console.log(`CatQuest for Record ${id} set to ${state}`)
    cb(state, record)
  })
}

function getCatQuestState(user, cb = () => {}) {
  console.log(`Retrieving CatQuest for User ${user}`)

  base('States').select({
    filterByFormula: `User = "${user}"`
  }).firstPage(function page(err, records) {
    if (err) {
      console.error(err)
      return
    }

    if (records.length == 0) {
      console.log(`No CatQuest state found for User ${user}.`)
      createCatQuestState(user, cb)
    }
    else {
      var record = records[0]
      var fields = record.fields
      var state = fields['CatQuest']
      console.log(`CatQuest state for User ${user} is ${state}`)
      console.log(fields)
      cb(balance, record)
    }
  })
}

var controller = Botkit.slackbot({
  clientId: process.env.SLACK_CLIENT_ID,
  clientSecret: process.env.SLACK_CLIENT_SECRET,
  clientSigningSecret: process.env.SLACK_CLIENT_SIGNING_SECRET,
  scopes: ['bot', 'chat:write:bot'],
  storage: redisStorage
});

controller.startTicking();

controller.setupWebserver(process.env.PORT, function(err,webserver) {
    controller.createWebhookEndpoints(controller.webserver)
    controller.createOauthEndpoints(controller.webserver)
});

var bot = controller.spawn({
});

bot.say({
  text: 'Awake',
  channel: '@UDK5M9Y13'
});

controller.hears(['question me'], 'message_received', function(bot,message) {


});

// @bot hello --> Begins the Cat Rescue quest
controller.hears(/hello/i, 'direct_message', (bot, message) => {
  // console.log(message)
  var {text, user, team_id} = message
  var bankUser = bankUsers[team_id]

  console.log(`${user}: ${text}`)
  console.log(`Oh, user ${user} says hello. How wonderful!`)

  bot.startConversation(message, function(err,convo) {
    // create a path for the goodbye
    convo.addMessage({
      delay: 2000,
      text: `Well, goodbye for now <@${user}>... don't be a stranger!`,
      action: 'completed'
    },'goodbye')
    
    // create a path for when a user says YES
    convo.addMessage({
      text: 'Oh, good! I am sure you will enjoy it!',
      action: 'goodbye'
    },'yes_thread')

    // create a path for when a user says NO
    convo.addMessage({
      text: 'Oh... okay, no cake for now then.',
    },'no_thread')

    convo.addMessage({
      delay: 2000,
      text: '...maybe later.',
      action: 'goodbye'
    },'no_thread')

    // create a path where neither option was matched
    // this message has an action field, which directs botkit to go back to the `default` thread after sending this message.
    convo.addMessage({
      text: 'Oh, um. I don\'t think I understand.\n...do you want the cake?',
      action: 'default',
    },'bad_response')

    console.log(`What's this? Someone named ${user} is saying hello...`)

    convo.say({
      delay: 0,
      text: `Oh hello... I don't think I recognize you.`
    })
    convo.say({
      delay: 1500,
      text: `...you must be new in town.`
    })

    // Create a yes/no question in the default thread...
    convo.addQuestion({
      delay: 2000,
      text: `You look a little hungry. Would you like some carrot cake? I baked it just this morning!`
    }, [
      {
        pattern: bot.utterances.yes,
        callback: function(response, convo) {
          console.log(`${user}: ${response.text}`)
          console.log(`Ooh, ${user} wants to try my cake! I do hope they enjoy it`)
          
          convo.gotoThread('yes_thread')
        },
      },
      {
        pattern: bot.utterances.no,
        callback: function(response, convo) {
          console.log(`${user}: ${response.text}`)
          console.log(`I guess ${user} doesn't want to try the cake. Oh well :(`)

          convo.gotoThread('no_thread')
        },
      },
      {
        default: true,
        callback: function(response, convo) {
          convo.gotoThread('bad_response')
        },
      }
    ],{},'default')

  })
})

controller.hears('.*', 'direct_mention,direct_message', (bot, message) => {
  var {text, user} = message
  console.log(message)
  console.log(`${user}:\n${text}`)
  console.log(`Oh, ${user} said something but I don\'t understand it...`)

  // Ignore if reply is in a thread. Hack to work around infinite bot loops.
  if (_.has(message.event, 'parent_user_id')) return

  bot.replyInThread(message, 'Oh um... I\'m sorry, I don\'t understand.')
})