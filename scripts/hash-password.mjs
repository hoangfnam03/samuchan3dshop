import { pbkdf2Sync, randomBytes } from 'node:crypto'
import { createInterface } from 'node:readline'

const rl = createInterface({ input: process.stdin, output: process.stdout })
rl.question('Admin password: ', password => {
  const iterations = 100000
  const salt = randomBytes(16)
  const hash = pbkdf2Sync(password, salt, iterations, 32, 'sha256')
  const hex = bytes => Buffer.from(bytes).toString('hex')
  console.log('pbkdf2-sha256$' + iterations + '$' + hex(salt) + '$' + hex(hash))
  rl.close()
})

