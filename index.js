var Botkit = require('botkit')
var Airtable = require('airtable')
var _ = require('lodash')
var Airbot = require('./airbot.js').default

const {
  User,
  base
} = Airbot({
  botName: 'toriel',
  defaultRecord: {}
})

var redisConfig = {
  url: process.env.REDISCLOUD_URL
}
var redisStorage = require('botkit-storage-redis')(redisConfig)

console.log("Booting Toriel bot")

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

// Begin the welcome process
const startWelcomeConversation = (message, record) => {
  var {text, user, team_id} = message

  var apps = record.apps
  var bankUser = apps.bank
  var kidUser = apps.kid

  bot.startConversation(message, function(err,convo) {
    console.log(`What's this? Someone named ${user} is saying hello...`)

    convo.say({
      delay: 0,
      text: `Oh hello... I don't think I recognize you.`
    })
    convo.say({
      delay: 1500,
      text: `...you must be new in town.`
    })

    const kidMessage = {
      user: `@${kidUser}`,
      channel: `@${kidUser}`,
      text: `meet <@${user}>`,
    }

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

          setTimeout(() => bot.say(kidMessage), 8000)

          record.set({
            'Greeted': true,
            'Peanut Butter': true
          })
        },
      },
      {
        pattern: bot.utterances.no,
        callback: function(response, convo) {
          console.log(`${user}: ${response.text}`)
          console.log(`I guess ${user} doesn't want to try the cake. Oh well :(`)

          convo.gotoThread('no_thread')

          setTimeout(() => bot.say(kidMessage), 8000)

          record.set({
            'Greeted': true,
            'Peanut Butter': false
          })
        },
      },
      {
        default: true,
        callback: function(response, convo) {
          convo.gotoThread('bad_response')
        },
      }
    ],{},'default')
    
    // create a path for when a user says YES
    convo.addMessage({
      text: 'Oh, good! I am sure you will enjoy it!',
      action: 'kid_arrives'
    },'yes_thread')

    // create a path for when a user says NO
    convo.addMessage({
      text: 'Oh... okay, no cake for now then.',
    },'no_thread')

    convo.addMessage({
      delay: 2000,
      text: '...maybe later.',
      action: 'kid_arrives'
    },'no_thread')

    convo.addMessage({
      text: 'Oh, um. I don\'t think I understand.\n...do you want the cake?',
      action: 'default',
    },'bad_response')

    convo.addMessage({
      delay: 2000,
      text: `Oh! Another visitor. My, what a busy day.`,
    },'kid_arrives')

    convo.addMessage({
      delay: 15000,
      text: `Poor thing. He comes around these parts to beg from the farms.`,
    },'kid_arrives')

    convo.addMessage({
      delay: 1000,
      text: `I swear, every time he's looking for a cat...`,
    },'kid_arrives')

    convo.addMessage({
      delay: 1000,
      text: `Just give him this one :cat:. The little dearie doesn't seem to know the difference.`,
      action: 'completed'
    },'kid_arrives')

  })
}

// @bot hello --> Begins the welcome process
controller.hears(/hello/i, 'direct_message', (bot, message) => {
  // console.log(message)
  var {text, user, team_id} = message

  console.log(`${user}: ${text}`)
  console.log(`Oh, user ${user} says hello. How wonderful!`)

  Record(user, team_id, record => {
    if (!record.get('Greeted'))
      startWelcomeConversation(message, record)
    else
      bot.reply(message, 'Oh hello again! I hope you are doing well here.')
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