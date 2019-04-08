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

const textButtonElement = (text, value) => ({
  type: "button",
  text: {
    type: "plain_text",
    text: "not a bot I promise :no_entry_sign: :robot_face:",
    emoji: true
  },
  value: "not a bot"
})

// Begin the welcome process
const startWelcomeConversation = (message, record) => {
  var {text, user, team_id} = message

  var {apps, users, channels} = record

  bot.startConversation(message, function(err,convo) {
    console.log(`Ah! A new person named ${user} has arrived...`)

    record.set({
      'Greeted': true
    })

    convo.say({
      delay: 0,
      text: `Oh hey what's up. Welcome to Hack Club`
    })

    convo.say({
      delay: 0,
      text: `My name is Chris, I build stuff around here`
    })

    convo.ask({
      delay: 2000,
      text: 'dummy text',
      blocks: [
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": "Do me a quick favor and click that button. This just tells me you're not a spambot"
          }
        },
        {"type": "divider"},
        {
          "type": "actions",
          "elements": [
            textButtonElement("not a bot I promise :no_entry_sign: :robot_face:", "not a bot")
          ]
        }
      ]
    }, [
      {
        pattern: 'not a bot',
        callback: function(response, convo) {
          console.log(`Confirmed that ${user} is not a bot.`)
          
          bot.replyInteractive(response, `_yessss the way you did that was so human-like._`)
          convo.gotoThread('welcome')

          record.set({
            'Engaged': true
          })

          setTimeout(() => bot.say({
            user: `@${apps.bank}`,
            channel: `@${apps.bank}`,
            text: `<@${apps.bank}> give <@${user}> 20`
          }), 2000)
        },
      }
    ])

    convo.addMessage({
      delay: 1000,
      text: `Awesome thanks. Here, take some gold for your trouble`
    }, 'welcome')

    convo.addMessage({
      delay: 4000,
      text: `Okay, now that I know you're not a bot, I have a confession:\n\nI am totally a bot. The real Chris can't be awake 24/7.`
    }, 'welcome')

    convo.addMessage({
      delay: 1500,
      text: `Hope we can talk for real though—message me any time <@${users.cwalker}>.`
    }, 'welcome')

    convo.addQuestion({
      delay: 1500,
      text: 'dummy text',
      blocks: [
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": "In the meantime, let's get you situated.\n\nWhat brings you here?"
          }
        },
        {"type": "divider"},
        {
          "type": "actions",
          "elements": [
            textButtonElement("Running a club :hack_club:", "club"),
            textButtonElement("Coding help :laptop_fire:", "code"),
            textButtonElement("just chillin :dark_sunglasses:", "chill")
          ]
        }
      ]
    }, [
      {
        pattern: 'club',
        callback: function(response, convo) {
          console.log(`So ${user} is here because they run a club (or aspire to). I'll send them to #leaders`)
          
          bot.replyInteractive(response, `_"Club Leader". You say it casually. Even though that basically makes you Hack Club royalty._`)
          convo.gotoThread('club_thread')

          bot.say({
            user: `@${users.msw}`,
            channel: `@${users.msw}`,
            text: `Heads-up, <@${user}> is here about starting a club`
          })

          record.set({
            'Reason for Joining': 'club'
          })
        },
      },
      {
        pattern: 'code',
        callback: function(response, convo) {
          console.log(`Sounds like ${user} could use some coding help. I'll send them to #code`)
          
          bot.replyInteractive(response, `_Ah yes, it seems your computer has grown legs and is trying to kill you._`)
          convo.gotoThread('code_thread')

          bot.say({
            user: `@${users.cwalker}`,
            channel: `@${users.cwalker}`,
            text: `Heads-up, <@${user}> is here for coding help`
          })

          record.set({
            'Reason for Joining': 'code'
          })
        },
      },
      {
        pattern: 'chill',
        callback: function(response, convo) {
          console.log(`I guess ${user} is just here to chill. I'll send them to #lounge`)
          
          bot.replyInteractive(response, `_straight chillin._`)
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
      text: `Nice. We're thrilled to have you!`,
    }, 'club_thread')

    convo.addMessage({
      delay: 1500,
      text: `You should definitely talk to <@${users.msw}> about your club, if you haven't already.`,
      action: 'intro_thread'
    }, 'club_thread')

    // create a path for 'code' users
    convo.addMessage({
      delay: 1500,
      text: `:ok_hand: We'll do our best to help. Just post your question to <#${channels.code}|code>`,
    }, 'code_thread')

    convo.addMessage({
      delay: 1500,
      text: `It may take a minute for someone with the right expertise to see it. Hang out and talk for a bit—someone can probably help`,
      action: 'intro_thread'
    }, 'code_thread')

    // create a path for 'chill' users
    convo.addMessage({
      delay: 1500,
      text: `Perfect. Everyone here is super friendly—if you see a conversation, just jump in.`,
      action: 'intro_thread',
    }, 'chill_thread')

    convo.addMessage({
      delay: 1500,
      text: `We have tons of channels here, but <#${channels.lounge}|lounge> is the best place to start.`,
      action: 'intro_thread',
    }, 'chill_thread')

    convo.addMessage({
      delay: 2000,
      text: `Ok last thing: it helps a lot if people know a bit about you. Most people start with an introduction in <#${channels.welcome}|welcome>`
    }, 'intro_thread')

    convo.addQuestion({
      delay: 1500,
      text: 'dummy text',
      blocks: [
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": "Do you want to introduce yourself now?"
          }
        },
        {"type": "divider"},
        {
          "type": "actions",
          "elements": [
            textButtonElement("Sure, why not :shrug:", "yes"),
            textButtonElement("Nah, I just wanna lurk. :shell:", "no")
          ]
        }
      ]
    }, [
      {
        pattern: 'yes',
        callback: function(response, convo) {
          console.log(`${user} wants to make an introduction in the welcome channel`)
          
          bot.replyInteractive(response, `_let's do it_`)
          convo.gotoThread('intro_yes_thread')

          setTimeout(() => bot.say({
            channel: `@${channels.welcome}`,
            text: `Hey folks, we have a new member! <@${user}>, please introduce yourself.`
          }), 4000)

          record.set({
            'Introduction': 'accepted'
          })
        },
      },
      {
        pattern: 'no',
        callback: function(response, convo) {
          console.log(`${user} doesn't want an introduction.`)
          
          bot.replyInteractive(response, `_You choose to live life in the shadows._`)
          convo.gotoThread('intro_no_thread')

          record.set({
            'Introduction': 'declined'
          })
        },
      }
    ])

    convo.addMessage({
      delay: 1500,
      text: `Awesome! I'll send an intro prompt for you. See you over there`,
      action: 'completed'
    }, 'intro_yes_thread')

    convo.addMessage({
      delay: 1500,
      text: `Ok, see you around then—and remember, message <@${users.cwalker}> if you need anything.`,
      action: 'completed'
    }, 'intro_no_thread')
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
      bot.reply(message, `Hello again!`)
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
        refreshNewbies(() => {
          console.log(`Current Newbies:`)
          console.log(newbies)
          
          // Block initiation of contact with users in the main Hack Club workspace
          if (team_id == 'T0266FRGM') return
  
          startWelcomeConversation(fakeMessage, record)
        })
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