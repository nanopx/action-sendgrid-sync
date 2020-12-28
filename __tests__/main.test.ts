import * as process from 'process'
import * as cp from 'child_process'
import * as path from 'path'

test('test runs', () => {
  process.env['ACTIONS_RUNNER_DEBUG'] = 'true'
  process.env['INPUT_TEMPLATESDIR'] = './templates'
  process.env['INPUT_PARTIALSDIR'] = './partials'
  process.env['GITHUB_REPOSITORY'] = 'nanopx/action-sendgrid-sync'
  process.env['GITHUB_SHA'] = 'ef26051771b839bf19b10a220a1dfe1645a6756f'

  const np = process.execPath
  const ip = path.join(__dirname, '..', 'lib', 'main.js')
  const options: cp.ExecFileSyncOptions = {
    env: process.env
  }

  console.log(cp.execFileSync(np, [ip], options).toString())
})
