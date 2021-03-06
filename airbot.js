const Botkit = require('botkit')
const Airtable = require('airtable')
const _ = require('lodash')

// App user ids by team_id
var channelAppIds = {
    T0266FRGM: { // Hack Club
        channels: {
            lounge: 'C0266FRGV',
            ship: 'C0M8PUPU6',
            code: 'C0EA9S0A0',
            welcome: 'C75M7C0SY',
            hq: 'C0C78SG9L'
        },
        apps: {
            bank: 'UH50T81A6',
            kid: 'UH68K6MQA',
            toriel: 'UH7CT042G'
        },
        users: {
            cwalker: 'UDK5M9Y13',
            msw: 'U0C7B14Q3',
            zrl: 'U0266FRGP',
            md: 'U3EGCMEMU'
        }
    },
    TH438LCR3: { // Bot Dev
        channels: {
            lounge: 'CH3KHRL11'
        },
        apps: {
            bank: 'UH2HS2SBS',
            kid: 'UGWL1NZED',
            toriel: 'UH4VDNNLQ'
        },
        users: {
            cwalker: 'UH56DCHJS',
            msw: 'UH56DCHJS',
            zrl: 'UH56DCHJS',
            md: 'UH56DCHJS'
        }
    }
}

const Airbot = (spec) => {
    var {
        botName,
        defaultRecord = {},
    } = spec

    const base = new Airtable({apiKey: process.env.AIRTABLE_KEY}).base(process.env.AIRTABLE_BASE)

    const initializeUserRecord = (user, team, cb) => {
        console.log(`Creating record for User ${user} on team ${team}`)

        var newRecord = _.cloneDeep(defaultRecord)
        newRecord.User = user
        newRecord.Team = team

        base(botName).create(newRecord, function(err, record) {
            if (err) { console.error(err); return; }
            console.log(`New record created for User ${user}`)
            // console.log(record)
            cb(record)
        })
    }

    const updateRecord = (id, values, cb) => {
        console.log(`Updating Record ${id}`)

        base(botName).update(id, values, function(err, record) {
            if (err) { console.error(err); return; }
            console.log(`Record ${id} updated`)

            cb(record)
        })
    }

    const getUserRecord = (user, team, cb) => {
        console.log(`Retrieving record for User ${user}`)

        base(botName).select({
            filterByFormula: `User = "${user}"`
        }).firstPage(function page(err, records) {
            if (err) {
                console.error(err)
                return
            }

            if (records.length == 0) {
                console.log(`No record found for User ${user}.`)
                initializeUserRecord(user, team, cb)
            }
            else {
                var record = records[0]
                console.log(`Record found for User ${user}`)
                console.log(record.fields)
                cb(record)
            }
        })
    }

    // Creates an object with direct methods for dealing with a single user's data
    const Record = (user, team, cb) => {
        const {channels, apps, users} = channelAppIds[team]

        getUserRecord(user, team, (record) => {
            let fields = record.fields
            const id = record.id
            
            // Get a value from this user's Airbot record
            const get = key => fields[key]

            // Set a value from this user's Airbot record
            const set = (obj, cb = () => {}) => {
                updateRecord(id, obj, freshRecord => {
                    record = freshRecord
                    fields = record.fields
                    cb(record)
                })
            }

            // Refresh this user's Airbot record
            const refresh = (cb) => {
                getUserRecord(user, team, freshRecord => {
                    record = freshRecord
                    fields = record.fields
                    cb(record)
                })
            }

            const updateNames = cb => {
                bot.api.users.info({user}, (error, response) => {
                    let {name, real_name} = response.user
                    if (get('Display Name') != name || get('Real Name') != real_name) {
                        console.log(`Updating names for ${user} (${name}, ${real_name})`)
                        set({
                            'Display Name': name,
                            'Real Name': real_name
                        }, cb)
                    }
                    else cb()
                })
            }

            updateNames(() => cb({
                get,
                set,
                refresh,
                apps,
                channels,
                users
            }))
        })
    }

    const getChannels = team => channelAppIds[team].channels

    const getApps = team => channelAppIds[team].apps

    const getUsers = team => channelAppIds[team].users

    const getChannelName = (channel, team) => {
        _.each(getChannels(team), (v, k) => {
            if (v == channel) {
                channel = k
                return false
            }
        })
        return channel
    }

    const getAppName = (app, team) => {
        _.each(getApps(team), (v, k) => {
            if (v == app) {
                app = k
                return false
            }
        })
        return app
    }

    const getUserName = (user, team) => {
        _.each(getUsers(team), (v, k) => {
            if (v == user) {
                user = k
                return false
            }
        })
        return user
    }

    return {
        getChannels,
        getApps,
        getUsers,
        getChannelName,
        getAppName,
        getUserName,
        Record,
        base
    }
}

exports.default = Airbot