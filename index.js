var Botkit = require('botkit')
var Airtable = require('airtable')
var _ = require('lodash')
var Airbot = require('./airbot.js').default

const {
  getChannels,
  getApps,
  Record,
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

// Give directions to lounge
const startDirectionsConversation = (message, record) => {
  var {text, user, team_id} = message

  var apps = record.apps
  var channels = record.channels
  var bankUser = apps.bank
  var kidUser = apps.kid

  bot.startPrivateConversation(message, function(err,convo) {
    console.log(`Now that the poor child is gone, maybe ${user} could use some directions to town?`)

    convo.say({
      delay: 2000,
      text: `I do hope that child finds his way.`
    })

    convo.say({
      delay: 2000,
      text: `Say, you could probably use some directions.`
    })

    convo.say({
      delay: 2000,
      text: `Have you been to <#${channels.lounge}|lounge> yet? That's where folks tend to hang out.`
    })

    convo.say({
      delay: 2000,
      text: `Head on over there and introduce yourself!`
    })
  })
}

// Begin the welcome process
const startWelcomeConversation = (message, record) => {
  var {text, user, team_id} = message

  var apps = record.apps
  var bankUser = apps.bank
  var kidUser = apps.kid

  bot.startConversation(message, function(err,convo) {
    console.log(`Ah! A new person named ${user} has arrived...`)

    convo.say({
      delay: 0,
      text: `Oh hello... I don't think I recognize you.`
    })
    convo.say({
      delay: 1500,
      text: `...you must be new in town.`
    })

    convo.say({
      delay: 1500,
      text: `You look a little hungry. Have some bread—I baked it fresh this morning!`
    })

    const kidMessage = {
      user: `@${kidUser}`,
      channel: `@${kidUser}`,
      text: `meet <@${user}>`,
    }

    convo.addQuestion({
      delay: 2000,
      text: `Do you... want peanut butter on your bread?`
    }, [
      {
        pattern: bot.utterances.yes,
        callback: function(response, convo) {
          console.log(`${user}: ${response.text}`)
          console.log(`Indeed, ${user} wants peanut butter!`)
          
          convo.gotoThread('yes_thread')

          setTimeout(() => bot.say(kidMessage), 8000)

          record.set({
            'Greeted': true,
            'Peanut Butter': true
          }, () => {})
        },
      },
      {
        pattern: bot.utterances.no,
        callback: function(response, convo) {
          console.log(`${user}: ${response.text}`)
          console.log(`Oh, ${user} doesn't want any peanut butter.`)

          convo.gotoThread('no_thread')

          setTimeout(() => bot.say(kidMessage), 8000)

          record.set({
            'Greeted': true,
            'Peanut Butter': false
          }, () => {})
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
      delay: 1500,
      text: 'Oh, good! I like peanut butter too.',
      action: 'kid_arrives'
    },'yes_thread')

    // create a path for when a user says NO
    convo.addMessage({
      delay: 1500,
      text: 'Oh... okay, no peanut butter then.',
    },'no_thread')

    convo.addMessage({
      delay: 1500,
      text: '...maybe later.',
      action: 'kid_arrives'
    },'no_thread')

    convo.addMessage({
      text: 'Oh, um. I don\'t think I understand.\n...do you want peanut butter?',
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

controller.hears(/thanks, <@([A-z|0-9]+)> gave me a cat/i, 'direct_message', (bot, message) => {
  var {text, user, team_id, match} = message
  var target = match[1]

  var fakeMessage = {
    user: target,
    team_id,
    channel: '@'+target,
  }

  console.log(`How lovely, ${user} gave the cat to the poor child.`)

  Record(user, team_id, record => {
    record.set({
      'Cat Received': true
    }, () => startDirectionsConversation(fakeMessage, record))
  })
})

controller.on('team_join', (bot, message) => {
  var {user, team_id} = message

  console.log(message)
  console.log(`Somebody named ${user.id} has come along... I don't think I recognize them. Perhaps they need help!`)

  // Workaround to avoid bug where conversation doesn't work without an initiating interaction from user
  // Taken from: https://github.com/howdyai/botkit/issues/422#issuecomment-258875047
  bot.api.im.open({
    user: user.id
  }, (err, res) => {
      var fakeMessage = {
        user: user.id,
        channel: res.channel.id,
        team_id
      }

      if (err) {
        bot.botkit.log(`Failed to open IM with ${user}`, err)
        return
      }
      Record(user.id, team_id, record => {
        startWelcomeConversation(fakeMessage, record)
      })
  })
})

controller.on('member_joined_channel', (bot, message) => {
  var {user, team_id} = message

  console.log(message)
  console.log(`Looks like ${user} made their way to lounge! I'm so glad they're finding their way.`)


  Record(user, team_id, record => {
    record.set({
      'Joined Lounge': true,
    })
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