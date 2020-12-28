import * as process from 'process'
import * as cp from 'child_process'
import * as path from 'path'

// shows how the runner will run a javascript action with env / stdout protocol
test('test runs', () => {
  process.env['ACTIONS_RUNNER_DEBUG'] = 'true'
  process.env['INPUT_TEMPLATESDIR'] = './templates'
  process.env['INPUT_PARTIALSDIR'] = './partials'
  const np = process.execPath
  const ip = path.join(__dirname, '..', 'lib', 'main.js')
  const options: cp.ExecFileSyncOptions = {
    env: process.env
  }
  console.log(cp.execFileSync(np, [ip], options).toString())
})
