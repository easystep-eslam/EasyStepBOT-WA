function levenshtein(a, b) {

    const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i])

    for (let j = 0; j <= a.length; j++) matrix[0][j] = j

    for (let i = 1; i <= b.length; i++) {

        for (let j = 1; j <= a.length; j++) {

            matrix[i][j] = b[i - 1] === a[j - 1]

                ? matrix[i - 1][j - 1]

                : Math.min(

                    matrix[i - 1][j] + 1,

                    matrix[i][j - 1] + 1,

                    matrix[i - 1][j - 1] + 1

                )

        }

    }

    return matrix[b.length][a.length]

}

function findClosestCommand(input, commands) {

    let closest = null

    let minDistance = Infinity

    for (const cmd of commands) {

        const dist = levenshtein(input, cmd)

        if (dist < minDistance) {

            minDistance = dist

            closest = cmd

        }

    }

    return minDistance <= 3 ? closest : null

}

module.exports = { findClosestCommand }