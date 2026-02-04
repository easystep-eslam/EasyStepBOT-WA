const axios = require('axios')

const settings = require('../settings')

/**

 * API Factory

 * @param {'lolhuman' | 'autoresbot'} type

 */

module.exports = (type = 'lolhuman') => {

  // Lolhuman API

  if (type === 'lolhuman') {

    if (!settings.apiKey) {

      throw new Error('LOLHUMAN_API_KEY_MISSING')

    }

    return axios.create({

      baseURL: 'https://api.lolhuman.xyz',

      params: {

        apikey: settings.apiKey

      }

    })

  }

  // Autoresbot API

  if (type === 'autoresbot') {

    if (!settings.autoresbotKey) {

      throw new Error('AUTORESBOT_API_KEY_MISSING')

    }

    return axios.create({

      baseURL: 'https://api.autoresbot.com',

      params: {

        apikey: settings.autoresbotKey

      },

      headers: {

        'User-Agent': 'Mozilla/5.0',

        'Accept': 'application/json,text/plain,*/*'

      },

      timeout: 90000

    })

  }

  throw new Error(`UNKNOWN_API_TYPE: ${type}`)

}