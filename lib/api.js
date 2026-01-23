const axios = require('axios')

const settings = require('../settings')

module.exports = () =>

  axios.create({

    baseURL: 'https://api.lolhuman.xyz',

    params: { apikey: settings.apiKey }

  })