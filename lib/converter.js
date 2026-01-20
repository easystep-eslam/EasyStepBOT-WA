const fs = require('fs');

const path = require('path');

const { spawn } = require('child_process');

const TMP_DIR = path.join(process.cwd(), 'tmp');

async function ensureTmp() {

  if (!fs.existsSync(TMP_DIR)) {

    await fs.promises.mkdir(TMP_DIR, { recursive: true });

  }

}

function ffmpeg(buffer, args = [], ext = '', ext2 = '') {

  return new Promise(async (resolve, reject) => {

    try {

      await ensureTmp();

      const base = `${Date.now()}_${Math.random().toString(16).slice(2)}`;

      const tmp = path.join(TMP_DIR, `${base}.${ext}`);

      const out = path.join(TMP_DIR, `${base}.${ext}.${ext2}`);

      await fs.promises.writeFile(tmp, buffer);

      const proc = spawn(

        'ffmpeg',

        ['-y', '-i', tmp, ...args, out],

        { stdio: 'ignore' }

      );

      proc.on('error', async (e) => {

        try { await fs.promises.unlink(tmp); } catch {}

        reject(e);

      });

      proc.on('close', async (code) => {

        try {

          try { await fs.promises.unlink(tmp); } catch {}

          if (code !== 0) {

            try { await fs.promises.unlink(out); } catch {}

            return reject(new Error(`ffmpeg exited with code ${code}`));

          }

          const data = await fs.promises.readFile(out);

          try { await fs.promises.unlink(out); } catch {}

          resolve(data);

        } catch (e) {

          reject(e);

        }

      });

    } catch (e) {

      reject(e);

    }

  });

}

/**

 * Convert Audio to Playable WhatsApp Audio

 * @param {Buffer} buffer Audio Buffer

 * @param {String} ext File Extension 

 */

function toAudio(buffer, ext) {

  return ffmpeg(

    buffer,

    ['-vn', '-ac', '2', '-b:a', '128k', '-ar', '44100', '-f', 'mp3'],

    ext,

    'mp3'

  );

}

/**

 * Convert Audio to Playable WhatsApp PTT

 * @param {Buffer} buffer Audio Buffer

 * @param {String} ext File Extension 

 */

function toPTT(buffer, ext) {

  return ffmpeg(

    buffer,

    ['-vn', '-c:a', 'libopus', '-b:a', '128k', '-vbr', 'on', '-compression_level', '10'],

    ext,

    'opus'

  );

}

/**

 * Convert Audio to Playable WhatsApp Video

 * @param {Buffer} buffer Video Buffer

 * @param {String} ext File Extension 

 */

function toVideo(buffer, ext) {

  return ffmpeg(

    buffer,

    ['-c:v', 'libx264', '-c:a', 'aac', '-ab', '128k', '-ar', '44100', '-crf', '32', '-preset', 'slow'],

    ext,

    'mp4'

  );

}

module.exports = {

  toAudio,

  toPTT,

  toVideo,

  ffmpeg

};