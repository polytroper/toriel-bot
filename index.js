var Botkit = require('botkit')
var Airtable = require('airtable')
var _ = require('lodash')
var Airbot = require('./airbot.js').default

const {
  getChannels,
  getApps,
  getChannelName,
  getAppName,
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


// Our list of members that joined within the last few days
const newbies = []

// Refresh the list of new members
const refreshNewbies = cb => {
  console.log('Refreshing newbies...')
  newbies.length = 0
  base('toriel').select({
    view: "Newbies"
  }).eachPage(function page(records, fetchNextPage) {
    records.forEach(function(record) {
      newbies.push(record.get('User'))
    })

    fetchNextPage()
  }, function done(err) {
    if (err) { console.error(err); return; }

    console.log('Newbies refreshed')
    cb()
  })
}

// Should booting of entire bot wait for newbies to populate?
refreshNewbies(() => {})

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

  var {apps, users, channels} = record

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

    record.set({
      'Greeted': true
    })

    convo.ask({
      delay: 2000,
      text: `What brings you here?`,
      blocks: [
        {
          "type": "actions",
          "elements": [
            {
              "type": "button",
              "text": {
                "type": "plain_text",
                "text": "Running a club :hack_club:",
                "emoji": true
              },
              "value": "club"
            },
            {
              "type": "button",
              "text": {
                "type": "plain_text",
                "text": "Coding help :laptop_fire:",
                "emoji": true
              },
              "value": "code"
            },
            {
              "type": "button",
              "text": {
                "type": "plain_text",
                "text": "just chillin :dark_sunglasses:",
                "emoji": true
              },
              "value": "chill"
            }
          ]
        }
      ]
    }, [
      {
        pattern: 'club',
        callback: function(response, convo) {
          console.log(`${user}: ${response.text}`)
          console.log(`So ${user} is here because they run a club (or aspire to). I'll send them to #leaders`)
          
          convo.gotoThread('club_thread')

          setTimeout(() => bot.say(kidMessage), 8000)

          record.set({
            'Reason for Joining': 'club'
          })
        },
      },
      {
        pattern: 'code',
        callback: function(response, convo) {
          console.log(`${user}: ${response.text}`)
          console.log(`Sounds like ${user} could use some coding help. I'll send them to #code`)
          
          convo.gotoThread('code_thread')

          record.set({
            'Reason for Joining': 'code'
          })
        },
      },
      {
        pattern: 'chill',
        callback: function(response, convo) {
          console.log(`${user}: ${response.text}`)
          console.log(`I guess ${user} is just here to chill. I'll send them to #lounge`)
          
          convo.gotoThread('chill_thread')

          record.set({
            'Reason for Joining': 'chill'
          })
        },
      }
    ])
    
    // create a path for 'club' users
    convo.addMessage({
      delay: 1500,
      text: `Oh how lovely! Well, head over to <#${channels.hq}|hq> and introduce yourself.`,
      action: 'goodbye_thread'
    }, 'club_thread')

    // create a path for 'code' users
    convo.addMessage({
      delay: 1500,
      text: `Wonderful! Whatever questions you have, post them in <#${channels.code}|code>`,
      action: 'goodbye_thread'
    }, 'code_thread')

    // create a path for 'chill' users
    convo.addMessage({
      delay: 1500,
      text: `That's mostly what I'm here for too. Introduce yourself in <#${channels.lounge}|lounge>—a lot of people hang out there.`,
      action: 'goodbye_thread',
    }, 'chill_thread')

    convo.addMessage({
      delay: 2000,
      text: `Good luck out there! And if you need anything, just message <@${users.cwalker}>—he can help.`,
      action: 'completed'
    }, 'goodbye_thread')

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
        refreshNewbies()

        console.log(`Current Newbies:`)
        console.log(newbies)
        
        // For now, don't initiate contact with users in the main Hack Club workspace
        if (team_id == 'T0266FRGM') return

        startWelcomeConversation(fakeMessage, record)
      })
  })
})

controller.hears([/(?<=<@)([A-z|0-9]+)(?=>)/g, /.*/], 'ambient', (bot, message) => {
  var {event, team_id, match} = message
  var {user, text, channel} = event

  // Ignore "<user> is typing in <channel>..." messages
  if (_.includes(text, ' is typing in #')) return

  // console.log(message)
  console.log(`Message in ${channel}: ${text}`)

  // For messages from non-newbies, see if a newbie is mentioned
  if (!_.includes(newbies, user)) {
    console.log(`Checking for newbie mentions:`)
    console.log(match)

    var newbieMatches = _.filter(match, v => _.includes(newbies, v))

    if (newbieMatches.length == 0) return

    console.log(`We got newbie mentions!`)
    console.log(newbieMatches)

    // Record each newbie's mention
    _.each(newbieMatches, v => {
      Record(v, team_id, record => {
        var totalMentions = record.get('Total Mentions')
    
        // Catch unfdefined values for totalMentions
        if (!totalMentions) totalMentions = 0
    
        record.set({
          'Total Mentions': totalMentions+1
        })
      })
    })

    return
  }

  var channelName = getChannelName(channel, team_id)

  console.log(`One of our new friends—${user}—posted a message in #${channelName}: ${text}`)

  // Stop here if we don't know the name of the channel
  if (channelName == channel) return

  Record(user, team_id, record => {
    var channelsUsed = _.clone(record.get('Channels Used'))
    var totalMessages = record.get('Total Messages')

    // Catch unfdefined values for totalMessages
    if (!totalMessages) totalMessages = 0

    // Apparently this will come back undefined from airtable if it's empty??
    if (!channelsUsed) channelsUsed = []

    if (!_.includes(channelsUsed, channelName))
      channelsUsed.push(channelName)

    record.set({
      'Channels Used': channelsUsed,
      'Total Messages': totalMessages+1
    })
  })
})

controller.on('im_open', (bot, message) => {
  var {user, channel} = message

  console.log(`An IM was just opened by user ${user}`)
})

// Disabled for now, because members join lounge by default
/*
controller.on('member_joined_channel', (bot, message) => {
  var {user, team_id, channel} = message

  // Only proceed for #lounge
  if (channel != getChannels(team_id).lounge) return

  console.log(message)
  console.log(`Looks like ${user} made their way to lounge! I'm so glad they're finding their way.`)

  Record(user, team_id, record => {
    record.set({
      'Joined Lounge': true,
    })
  })
})
*/

controller.hears('.*', 'direct_mention,direct_message', (bot, message) => {
  var {text, user} = message
  console.log(message)
  console.log(`${user}:\n${text}`)
  console.log(`Oh, ${user} said something but I don\'t understand it...`)

  // Ignore if reply is in a thread. Hack to work around infinite bot loops.
  if (_.has(message.event, 'parent_user_id')) return

  bot.replyInThread(message, 'Oh um... I\'m sorry, I don\'t understand.')
})