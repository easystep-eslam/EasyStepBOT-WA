const axios = require('axios');

const providers = [

    {

        name: 'PrinceTech',

        enabled: true,

        async enhance(url) {

            const res = await axios.get(

                `https://api.princetechn.com/api/tools/remini`,

                {

                    params: {

                        apikey: 'prince_tech_api_azfsbshfb',

                        url

                    },

                    timeout: 60000

                }

            );

            if (

                res.data?.result?.success &&

                res.data?.result?.image_url

            ) {

                return res.data.result.image_url;

            }

            throw new Error(

                res.data?.result?.error ||

                res.data?.result?.message ||

                'PrinceTech failed'

            );

        }

    },

    // 🔥 API احتياطي (مثال)

    {

        name: 'BackupAPI',

        enabled: true,

        async enhance(url) {

            const res = await axios.get(

                `https://example.com/api/remini`,

                { params: { url } }

            );

            if (res.data?.image) {

                return res.data.image;

            }

            throw new Error('Backup API failed');

        }

    }

];

async function smartEnhance(imageUrl) {

    for (const api of providers) {

        if (!api.enabled) continue;

        try {

            console.log(`🧠 Trying ${api.name}`);

            return await api.enhance(imageUrl);

        } catch (e) {

            console.warn(`❌ ${api.name} failed:`, e.message);

            // لو Rate limit → نكمّل على اللي بعده

            if (e.message.includes('429')) continue;

            // لو مشكلة صورة → نوقف فورًا

            if (e.message.includes('image')) throw e;

        }

    }

    throw new Error('ALL_APIS_FAILED');

}

module.exports = { smartEnhance };